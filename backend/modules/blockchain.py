"""
blockchain.py — Block creation, chain validation, and persistence.
Each block is immutable once appended. Every node validates independently.
"""
import asyncio
import hashlib
import json
import time

from modules import storage, identity

_CHAIN_FILE = "chain.json"


# ── Helpers ──────────────────────────────────────────────────────────────────

def _hash_block(block: dict) -> str:
    """SHA-256 of the block's canonical fields (excluding the hash itself)."""
    payload = {k: v for k, v in block.items() if k not in ("hash", "signature")}
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(raw.encode()).hexdigest()


def _merkle_root(events: list) -> str:
    if not events:
        return hashlib.sha256(b"").hexdigest()
    leaves = [hashlib.sha256(json.dumps(e, sort_keys=True).encode()).digest() for e in events]
    while len(leaves) > 1:
        if len(leaves) % 2:
            leaves.append(leaves[-1])
        leaves = [hashlib.sha256(leaves[i] + leaves[i + 1]).digest() for i in range(0, len(leaves), 2)]
    return leaves[0].hex()


# ── Genesis ───────────────────────────────────────────────────────────────────

GENESIS_GRANT_AMOUNT = 100.0  # Starting balance for all bootstrap nodes


def _genesis_block() -> dict:
    """
    Fixed Genesis block. It must be perfectly static so all nodes
    derive the exact same genesis hash.
    """
    events = [{"type": "GENESIS", "data": {"note": "POR-Chain Network Launch"}}]
    block = {
        "index": 0,
        "previous_hash": "0" * 64,
        "timestamp": 1714392000.0,  # Fixed timestamp: April 29, 2024
        "events": events,
        "proposer": "NETWORK",
        "merkle_root": "",
    }
    block["merkle_root"] = _merkle_root(block["events"])
    block["hash"] = _hash_block(block)
    block["signature"] = "GENESIS_SIG"
    return block


# ── Init ─────────────────────────────────────────────────────────────────────

async def init() -> list:
    """Load chain or create genesis block."""
    chain = await storage.read(_CHAIN_FILE)
    if chain:
        return chain

    genesis = _genesis_block()
    chain = [genesis]
    await storage.write(_CHAIN_FILE, chain)
    return chain


# ── Read ──────────────────────────────────────────────────────────────────────

async def get_chain() -> list:
    return await storage.read_or_default(_CHAIN_FILE, [])


async def get_block(index: int) -> dict | None:
    chain = await get_chain()
    if 0 <= index < len(chain):
        return chain[index]
    return None


async def last_block() -> dict:
    chain = await get_chain()
    return chain[-1]


# ── Write ─────────────────────────────────────────────────────────────────────

async def propose_block(events: list) -> dict:
    """Build and sign a new block from pending events."""
    node = identity.get()
    prev = await last_block()
    block = {
        "index": prev["index"] + 1,
        "previous_hash": prev["hash"],
        "timestamp": time.time(),
        "events": events,
        "proposer": node["node_id"],
        "merkle_root": _merkle_root(events),
    }
    block["hash"] = _hash_block(block)
    block["signature"] = identity.sign(block["hash"])
    return block


_append_lock = asyncio.Lock()

async def append_block(block: dict) -> bool:
    """Validate and append a block to the local chain using a lock to prevent race conditions."""
    async with _append_lock:
        chain = await get_chain()
        
        # 1. Reject if we already have this block hash (prevents double-counting)
        if any(b.get("hash") == block.get("hash") for b in chain):
            return False
            
        # 2. Reject if the index is wrong (already filled by another block)
        if block.get("index") != len(chain):
            return False

        # 3. Full cryptographic validation
        if not await validate_block(block):
            return False
            
        chain.append(block)
        await storage.write(_CHAIN_FILE, chain)
        return True


# ── State Derivation ────────────────────────────────────────────────────────────

def calculate_balance(address: str, chain: list) -> dict:
    """
    Derive the true balance of an address by replaying the blockchain.
    Everyone starts with 100 POR for this local test environment.
    """
    balance = 100.0
    staked = 0.0

    for block in chain:
        for ev in block.get("events", []):
            type_ = ev.get("type")
            amt = ev.get("amount", 0.0)

            if type_ in ("GENESIS_GRANT", "FAUCET_GRANT") and ev.get("to") == address:
                balance += amt

            elif type_ == "SEND":
                if ev.get("from") == address:
                    balance -= amt
                if ev.get("to") == address:
                    balance += amt

            elif type_ == "STAKE" and ev.get("from") == address:
                balance -= amt
                staked += amt

            elif type_ == "UNSTAKE" and ev.get("from") == address:
                staked -= amt
                balance += amt

            elif type_ == "SLASH" and ev.get("from") == address:
                staked -= amt

    return {"balance": balance, "staked": staked, "address": address}


async def _verify_transactions(events: list, chain: list) -> bool:
    """Verify that all transactions in a proposed block are valid (signatures + balances)."""
    from modules import identity
    import logging
    log = logging.getLogger("por-chain")
    
    # Create a simulated state for the duration of this block
    simulated_balances = {}

    def get_bal(addr):
        if addr not in simulated_balances:
            simulated_balances[addr] = calculate_balance(addr, chain)["balance"]
        return simulated_balances[addr]

    for ev in events:
        type_ = ev.get("type")
        # GENESIS_GRANT, FAUCET_GRANT and GENESIS events have no signatures — skip verification
        if type_ in ("GENESIS", "GENESIS_GRANT", "FAUCET_GRANT"):
            continue
        if type_ in ("SEND", "STAKE", "UNSTAKE", "SLASH"):
            sender = ev.get("from")
            amt = ev.get("amount", 0.0)
            
            # 1. Cryptographic Signature Verification
            sig = ev.get("signature")
            pubkey = ev.get("sender_pubkey")
            
            # ADDRESS VERIFICATION: The Sender ID MUST be the hash of the Public Key
            # This allows us to verify the TX even if we don't have the sender in our registry yet!
            import hashlib
            import base64
            try:
                pub_bytes = base64.b64decode(pubkey)
                derived_id = pub_bytes.hex()
                if derived_id != sender:
                    log.error(f"❌ TX Validation Failed: Sender ID {sender} does not match Public Key hash!")
                    return False
            except Exception as e:
                log.error(f"❌ TX Validation Failed: Invalid Public Key format: {e}")
                return False

            # SIGNATURE VERIFICATION: Did the owner of this pubkey sign this data?
            payload = {k: v for k, v in ev.items() if k not in ("signature", "block_index")}
            if not identity.verify(identity.canonical(payload), sig, pubkey):
                log.error(f"❌ TX Validation Failed: Cryptographic Forgery detected from {sender}!")
                return False

            # 2. Balance Verification
            if get_bal(sender) < amt:
                log.error(f"❌ TX Validation Failed: Insufficient balance for {sender} (Needed {amt})")
                return False
            
            simulated_balances[sender] -= amt
            
            if type_ == "SEND":
                receiver = ev.get("to")
                if receiver not in simulated_balances:
                    simulated_balances[receiver] = calculate_balance(receiver, chain)["balance"]
                simulated_balances[receiver] += amt

    return True


# ── Validation ────────────────────────────────────────────────────────────────

async def validate_block(block: dict) -> bool:
    """Full block validation. Returns True only if all checks pass."""
    chain = await get_chain()

    # 1. Index continuity
    expected_index = len(chain)
    if block.get("index") != expected_index:
        return False

    # 2. Previous hash linkage
    if chain:
        if block.get("previous_hash") != chain[-1]["hash"]:
            return False

    # 3. Hash integrity
    computed = _hash_block(block)
    if computed != block.get("hash"):
        return False

    # 4. Merkle root
    if _merkle_root(block.get("events", [])) != block.get("merkle_root"):
        return False

    # 5. Transaction State & Signature Validation
    # (Checking every single signature inside the block)
    if not await _verify_transactions(block.get("events", []), chain):
        return False

    # 6. Proposer signature (need proposer's pubkey from registry)
    from modules import registry as reg
    proposer_id = block.get("proposer")
    node_info = await reg.get_node(proposer_id)
    if node_info:
        if not identity.verify(block["hash"], block["signature"], node_info["public_key"]):
            return False

    return True


async def is_valid_chain(chain: list) -> bool:
    """Validate an entire chain (used when syncing from a peer)."""
    for i, block in enumerate(chain):
        if i == 0:
            if block.get("previous_hash") != "0" * 64:
                return False
        else:
            if block.get("previous_hash") != chain[i - 1].get("hash"):
                return False
            # Verify transactions dynamically up to this block
            if not await _verify_transactions(block.get("events", []), chain[:i]):
                return False
        if _hash_block(block) != block.get("hash"):
            return False
    return True
