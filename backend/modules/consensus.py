"""
consensus.py — Proof-of-Reputation proposer selection and block finalization.
Proposer = weighted-random selection among FULL_NODE nodes by reputation.
"""
import hashlib
import random
import time

import config
from modules import reputation, registry, blockchain, networking


# ── Proposer Selection ────────────────────────────────────────────────────────

async def select_proposer(seed: str | None = None) -> str | None:
    """
    Weighted-random proposer selection.
    W(node_i) = R(node_i) / sum(R(all_full_nodes))
    Deterministic if seed is provided (e.g. previous block hash).
    """
    full_nodes = await registry.full_nodes()
    if not full_nodes:
        return None

    scores = {}
    for node in full_nodes:
        scores[node["node_id"]] = await reputation.get_score(node["node_id"])

    total = sum(scores.values())
    if total == 0:
        return random.choice(list(scores.keys()))

    # Deterministic weighted random using seed
    rng_seed = int(hashlib.sha256((seed or str(time.time())).encode()).hexdigest(), 16)
    rng = random.Random(rng_seed)
    r = rng.uniform(0, total)
    cumulative = 0.0
    for node_id, score in scores.items():
        cumulative += score
        if r <= cumulative:
            return node_id
    return list(scores.keys())[-1]


# ── Block Proposal Flow ───────────────────────────────────────────────────────

_pending_events: list = []
_acceptance_votes: dict[str, set] = {}   # block_hash → set of accepting node_ids


def add_pending_event(event: dict) -> None:
    tx_id = event.get("tx_id")
    if tx_id:
        if any(e.get("tx_id") == tx_id for e in _pending_events):
            return
    _pending_events.append(event)


async def run_consensus_round() -> dict | None:
    """
    Called periodically by the scheduler.
    If this node is the selected proposer, create and broadcast a block.
    """
    from modules import identity as ident
    my_id = ident.get()["node_id"]
    my_phase = await registry.get_phase(my_id)
    if my_phase != "FULL_NODE":
        return None   # Only full nodes participate in proposal

    prev = await blockchain.last_block()
    proposer = await select_proposer(seed=prev["hash"])
    if proposer != my_id:
        return None   # Not our turn

    events = list(_pending_events)
    # We do NOT clear pending events yet. We wait until the block is finalized.

    block = await blockchain.propose_block(events)
    await networking.broadcast("BLOCK_PROPOSAL", {"block": block})
    
    # Proposer also votes for its own block
    await receive_block_vote(block.get("hash"), my_id, block)
    return block


async def receive_block_proposal(block: dict, proposer_id: str) -> bool:
    """
    Called when a peer broadcasts a BLOCK_PROPOSAL.
    Validate and broadcast our acceptance vote to the network.
    """
    from modules import identity as ident
    my_id = ident.get()["node_id"]
    my_phase = await registry.get_phase(my_id)
    if my_phase not in ("PHASE_3", "FULL_NODE"):
        return False  # Only trusted nodes can vote

    valid = await blockchain.validate_block(block)
    if not valid:
        return False

    # Broadcast our vote to everyone
    await networking.broadcast("BLOCK_VOTE", {
        "block_hash": block.get("hash"),
        "voter_id": my_id,
        "block": block  # Include block so peers can verify if they missed the proposal
    })
    return True


async def receive_block_vote(block_hash: str, voter_id: str, block: dict | None = None) -> bool:
    """
    Called when a peer broadcasts a BLOCK_VOTE.
    Once we hit 2/3 threshold, append the block.
    """
    if not block_hash:
        return False

    if block_hash not in _acceptance_votes:
        _acceptance_votes[block_hash] = set()
    
    _acceptance_votes[block_hash].add(voter_id)

    # Check if we have 2/3 acceptance
    full_nodes = await registry.full_nodes()
    full_node_count = len(full_nodes)
    
    # 2/3 threshold (minimum 1)
    required = max(1, int(full_node_count * config.CONSENSUS_THRESHOLD))
    
    if len(_acceptance_votes[block_hash]) >= required:
        # We need the full block data to append
        if not block:
            return False # Waiting for the actual block proposal or another vote with data

        success = await blockchain.append_block(block)
        if success:
            del _acceptance_votes[block_hash]
            
            # Finalized! Remove accepted events from our pending pool
            block_tx_ids = {e.get("tx_id") for e in block.get("events", []) if e.get("tx_id")}
            global _pending_events
            _pending_events = [e for e in _pending_events if e.get("tx_id") not in block_tx_ids]

            # Credit proposer reputation
            await reputation.update(block["proposer"], honest=True)
            
            from modules import identity as ident
            my_id = ident.get()["node_id"]
            my_phase = await registry.get_phase(my_id)
            if my_phase == "PHASE_3":
                from modules import coldstart
                await coldstart.record_honest_round(my_id)
            
            return True
    return False


# ── Synchronization ─────────────────────────────────────────────────────────────

async def sync_chain_from_peers() -> None:
    """
    Called on startup. Queries peers for their chain.
    If a peer has a longer valid chain, replaces the local chain.
    """
    peers = await networking.load_peers()
    if not peers:
        return

    import httpx
    import logging
    log = logging.getLogger("por-chain")
    
    longest_chain = await blockchain.get_chain()
    max_length = len(longest_chain)
    updated = False

    async with httpx.AsyncClient(timeout=3.0) as client:
        for peer in peers:
            try:
                r = await client.get(f"{peer}/chain")
                if r.status_code == 200:
                    peer_chain = r.json()
                    if len(peer_chain) > max_length:
                        # Validate the peer's chain
                        if await blockchain.is_valid_chain(peer_chain):
                            max_length = len(peer_chain)
                            longest_chain = peer_chain
                            updated = True
            except Exception:
                pass  # Peer offline or error

    if updated:
        from modules import storage
        await storage.write(blockchain._CHAIN_FILE, longest_chain)
        log.info(f"🔄 Synced chain from peers! New height: {max_length}")
