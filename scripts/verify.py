#!/usr/bin/env python3
"""
POR-Chain Live Verification Suite
Run this after starting the cluster: ./scripts/start_cluster.sh
"""
import urllib.request
import json
import hashlib
import base64
import sys

NODES = [5000, 5001, 5002, 5003]

def fetch(port, path):
    try:
        with urllib.request.urlopen(f"http://localhost:{port}{path}", timeout=3) as r:
            return json.load(r)
    except Exception as e:
        return None


def fetch_chain(port):
    """Fetch chain — handles both list and {'chain': [...]} response formats."""
    data = fetch(port, "/chain")
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        return data.get("chain", [])
    return []


def check(label, ok):
    icon = "✅" if ok else "❌"
    print(f"  {icon}  {label}")
    return ok


# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "═"*60)
print("  POR-CHAIN VERIFICATION SUITE")
print("═"*60)

# ── TEST 1: All nodes alive ───────────────────────────────────────────────────
print("\n[1] NODE LIVENESS")
all_alive = True
for port in NODES:
    state = fetch(port, "/node_state")
    ok = state is not None
    all_alive = all_alive and ok
    label = f"Node {port} is online  (Phase: {state.get('phase','?')})" if ok else f"Node {port} is OFFLINE"
    check(label, ok)

# ── TEST 2: Genesis block identical on all nodes ──────────────────────────────
print("\n[2] GENESIS BLOCK CONSENSUS")
genesis_hashes = {}
for port in NODES:
    chain = fetch_chain(port)
    if chain and len(chain) > 0:
        genesis_hashes[port] = chain[0]["hash"]
    else:
        genesis_hashes[port] = "NO_CHAIN"

all_same = len(set(genesis_hashes.values())) == 1
for port, h in genesis_hashes.items():
    check(f"Node {port} genesis = {h[:20]}...", True)
check("All nodes share identical Genesis block", all_same)

# ── TEST 3: Chain tip identical (consensus) ───────────────────────────────────
print("\n[3] CHAIN TIP CONSENSUS (All nodes must agree)")
tips = {}
heights = {}
for port in NODES:
    chain = fetch_chain(port)
    if chain:
        tips[port] = chain[-1]["hash"]
        heights[port] = len(chain)
    else:
        tips[port] = "NO_CHAIN"
        heights[port] = 0

for port in NODES:
    check(f"Node {port}: Height={heights[port]}  Tip={tips[port][:16]}...", True)

live_tips = {t for t in tips.values() if t != "NO_CHAIN"}
check("All live nodes have same chain tip (no fork)", len(live_tips) <= 1)

# ── TEST 4: Cryptographic chain integrity ─────────────────────────────────────
print("\n[4] CRYPTOGRAPHIC CHAIN INTEGRITY (Node 5000)")
chain = fetch_chain(5000)
all_valid = True
if chain:
    for i, block in enumerate(chain):
        # Recompute hash
        payload = {k: v for k, v in block.items() if k not in ("hash", "signature")}
        raw = json.dumps(payload, sort_keys=True, separators=(",", ":"))
        computed = hashlib.sha256(raw.encode()).hexdigest()
        hash_ok = computed == block["hash"]

        # Check chain link
        if i > 0:
            link_ok = block["previous_hash"] == chain[i-1]["hash"]
        else:
            link_ok = block["previous_hash"] == "0" * 64

        ok = hash_ok and link_ok
        all_valid = all_valid and ok
        check(f"Block #{i}: Hash={'OK' if hash_ok else 'TAMPERED'}  Link={'OK' if link_ok else 'BROKEN'}  Events={len(block.get('events',[]))}", ok)
    check("Entire chain is cryptographically intact", all_valid)
else:
    check("Could not fetch chain from Node 5000", False)

# ── TEST 5: Transaction signature verification ────────────────────────────────
print("\n[5] TRANSACTION SIGNATURE VERIFICATION")
try:
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
    chain = fetch_chain(5000)
    found_tx = False
    if chain:
        for block in chain:
            for ev in block.get("events", []):
                if ev.get("type") == "SEND" and ev.get("signature") and ev.get("signature") != "GENESIS_SIG":
                    payload = {k: v for k, v in ev.items() if k not in ("signature", "block_index")}
                    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
                    pub_bytes = base64.b64decode(ev["sender_pubkey"])
                    sig_bytes = base64.b64decode(ev["signature"])
                    pub = Ed25519PublicKey.from_public_bytes(pub_bytes)
                    try:
                        pub.verify(sig_bytes, canonical.encode())
                        check(f"TX {ev['tx_id'][:12]}... signature is cryptographically valid", True)
                        found_tx = True
                    except Exception:
                        check(f"TX {ev['tx_id'][:12]}... INVALID SIGNATURE", False)
                        found_tx = True
    if not found_tx:
        print("  ⚠️  No SEND transactions found yet — send one from the dashboard first!")
except ImportError:
    print("  ⚠️  cryptography library not available for sig check")

# ── Summary ───────────────────────────────────────────────────────────────────
print("\n" + "═"*60)
print("  Done. Send a transaction from the dashboard and re-run")
print("  this script to see Test 5 (signature verification).")
print("═"*60 + "\n")
