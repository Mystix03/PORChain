## 5. Core Algorithms

### 5.1 Algorithm: Phase 1 — Probationary Task Scoring (Equation 1)

**Source:** `backend/modules/coldstart.py → submit_task_results()`

The Phase 1 score is computed as a simple ratio of correctly completed tasks:

```
P(v_new, N) = (1/N) × Σ 1[πⱼ valid]       (Equation 1)

Where:
  N     = total number of tasks (config: PHASE1_TASK_COUNT = 5)
  πⱼ   = cryptographic proof submitted for task j
  1[·]  = indicator function (1 if valid, 0 if not)
  θ_P   = pass threshold (config: PHASE1_PASS_THRESHOLD = 0.90)

Decision: if P ≥ θ_P → advance to PHASE_2
          if P < θ_P → remain PHASE_1 (rejected)
```

#### Task Types (4 Variants)

| Task Type | Challenge | Verification Method |
|---|---|---|
| `HASH_PREIMAGE` | Random 16-byte hex string | Node must return SHA-256 hash of challenge |
| `VERIFY_HASH` | Random 16-byte hex string | Node must return SHA-256 hash of challenge |
| `SIGN_CHALLENGE` | Random 16-byte hex string | Node must sign with its Ed25519 private key |
| `POW` | Random 16-byte hex string | Node must find nonce: SHA-256(challenge + nonce) starts with N zeros |

#### Proof-of-Work Task (Detail)

```python
# Verification logic (coldstart.py, line 122-133)
combined = task["challenge"] + str(nonce)
result_hash = hashlib.sha256(combined.encode()).hexdigest()
passed = result_hash.startswith("0" * difficulty)   # difficulty = 3 zeros
```

The PoW nonce is **preserved** after Phase 1 and used in Phase 2 to compute the **Dynamic Staking discount** (see Section 9).

> 📸 **[IMAGE PLACEHOLDER]** — *Screenshot of the Merit tab (apps/web/src/components/merit.jsx) showing the Phase 1 task interface with the 4 task types. Show both the task challenge and the submission UI.*

---

### 5.2 Algorithm: Phase 2 — Stake-Backed Vouching (Equations 2 & 3)

**Source:** `backend/modules/coldstart.py → vouch()`

When a FULL_NODE vouches for a PHASE_2 candidate, two equations from the IEEE paper are applied:

**Equation 2 — Voucher Stake Amount:**
```
stake_amount = voucher_score × δ × 100

Where:
  voucher_score = reputation score of the vouching node ∈ [0.0, 1.0]
  δ             = VOUCH_DELTA = 0.15 (15%)
  × 100         = converts to POR token units

Result: The voucher's wallet balance is reduced by stake_amount (locked)
```

**Equation 3 — New Node's Starting Reputation:**
```
R_new(0) = α × R_voucher × δ

Where:
  α     = VOUCH_ALPHA = 0.5 (50% dampening)
  δ     = 0.15

So: R_new(0) = 0.5 × R_voucher × 0.15 = 0.075 × R_voucher
```
*Implementation note: In the current Python implementation, Equation 3 is applied via the reputation module's `set_initial()` rather than directly in the vouch function, since reputation is node-local.*

#### Vouching Security Gates
```python
# Security checks before any vouch is processed:
if voucher is BANNED → reject
if target is BANNED  → reject
if voucher_score < VOUCH_ELIGIBILITY_THRESHOLD (0.40) → reject
if target_phase != "PHASE_2" → reject
if voucher == target → reject (no self-vouching)
if duplicate active vouch exists → reject
if target already has VOUCHES_REQUIRED active vouches → reject
```

---

### 5.3 Algorithm: Phase 3 — Reputation Evolution (Equation 4)

**Source:** `backend/modules/reputation.py → update()`

This is the core **Exponentially Weighted Moving Average (EWMA)** reputation update formula from the IEEE paper:

```
R(t+1) = λ × R(t) + (1 - λ) × h(t)         (Equation 4)

Where:
  R(t)  = reputation at time t ∈ [0.0, 1.0]
  λ     = LAMBDA = 0.80 (decay/smoothing factor)
  h(t)  = 1.0 if honest behavior at time t
           0.0 if malicious behavior at time t

Properties:
  - λ = 0.80 means 80% weight to history, 20% weight to current event
  - Honest sequence converges toward 1.0 asymptotically
  - Dishonest event immediately resets reputation to 0.0 (implementation choice)
  - Output clamped to [0.0, 1.0]
```

#### Python Implementation

```python
# reputation.py
def update(node_id: str, honest: bool) -> float:
    r_t = scores.get(node_id, INITIAL_REPUTATION)  # 0.05 default
    h_t = 1.0 if honest else 0.0

    if not honest:
        r_next = 0.0   # THE NUKE: instant reset on malicious act
    else:
        r_next = LAMBDA * r_t + (1 - LAMBDA) * h_t   # Eq. 4

    r_next = max(0.0, min(1.0, r_next))   # clamp [0,1]
```

#### Reputation Convergence Behavior

```
Starting at R=0.05 (new node), with λ=0.80, after N honest rounds:

Round 1:  R = 0.80×0.05 + 0.20×1.0 = 0.240
Round 2:  R = 0.80×0.240 + 0.20×1.0 = 0.392
Round 3:  R = 0.80×0.392 + 0.20×1.0 = 0.514
Round 5:  R = ~0.672
Round 10: R = ~0.893
Round 20: R = ~0.988
```

> 📸 **[IMAGE PLACEHOLDER]** — *Line graph showing reputation convergence curve: X-axis = honest rounds (0-20), Y-axis = reputation score (0-1.0). Show two curves: (1) honest behavior converging toward 1.0, (2) reputation reset to 0 on malicious event. Mark the key thresholds: τᵥ=0.40 (vouch eligibility), 0.70 (full node threshold).*

---

### 5.4 Algorithm: Phase 3 Graduation

**Source:** `backend/modules/coldstart.py → record_honest_round()`

```
PHASE_3 → UNDER_OBSERVATION:  when honest_rounds ≥ PHASE3_ROUNDS (10)
UNDER_OBSERVATION → FULL_NODE: when honest_rounds ≥ PHASE3_HONEST_ROUNDS (20)
```

On graduation to `FULL_NODE`:
1. All active vouches for the node are marked `RELEASED`
2. 100% of the staked tokens are **returned** to each voucher
3. An `UNSTAKE` transaction is broadcast to the network and mined

On misbehavior in `PHASE_3`:
- Voucher's full stake is **slashed** (100% loss)

On misbehavior in `UNDER_OBSERVATION`:
- 50% of stake is **slashed**, 50% is **returned** (partial shelter)

On misbehavior as `FULL_NODE`:
- Voucher suffers no stake penalty (stake already returned at graduation)

---

## 6. Blockchain Engine

**Source:** `backend/modules/blockchain.py`

### 6.1 Block Structure

```json
{
  "index":         42,
  "previous_hash": "abc123...def456",
  "timestamp":     1714392000.0,
  "events":        [...],
  "proposer":      "node_id_hex",
  "merkle_root":   "sha256_of_events_tree",
  "hash":          "sha256_of_block",
  "signature":     "ed25519_base64_signature"
}
```

### 6.2 Block Hash Algorithm

```python
def _hash_block(block: dict) -> str:
    # Exclude hash and signature from payload
    payload = {k: v for k, v in block.items() if k not in ("hash", "signature")}
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(raw.encode()).hexdigest()
```

The deterministic `sort_keys=True` serialization ensures all nodes produce identical hashes for identical block data.

### 6.3 Merkle Tree Algorithm

```python
def _merkle_root(events: list) -> str:
    if not events:
        return hashlib.sha256(b"").hexdigest()

    # Leaf nodes: SHA-256 of each event's canonical JSON
    leaves = [hashlib.sha256(json.dumps(e, sort_keys=True).encode()).digest()
              for e in events]

    # Binary tree reduction
    while len(leaves) > 1:
        if len(leaves) % 2:
            leaves.append(leaves[-1])   # Duplicate last leaf if odd
        leaves = [
            hashlib.sha256(leaves[i] + leaves[i+1]).digest()
            for i in range(0, len(leaves), 2)
        ]
    return leaves[0].hex()
```

The Merkle root provides **O(log N)** event integrity verification.

### 6.4 Genesis Block

```python
GENESIS_GRANT_AMOUNT = 100.0  # Starting balance for all bootstrap nodes

# Fixed genesis parameters (must be static across all nodes):
{
    "index": 0,
    "previous_hash": "0" * 64,
    "timestamp": 1714392000.0,   # Fixed: April 29, 2024
    "events": [{"type": "GENESIS", "data": {"note": "POR-Chain Network Launch"}}],
    "proposer": "NETWORK",
}
```

The fixed timestamp ensures all nodes derive an **identical genesis hash** regardless of startup time.

### 6.5 Block Validation Pipeline

```
validate_block(block) → bool

Step 1: Index continuity      — block.index == len(current_chain)
Step 2: Previous hash linkage — block.previous_hash == chain[-1].hash
Step 3: Hash integrity        — SHA-256(block fields) == block.hash
Step 4: Merkle root           — merkle(events) == block.merkle_root
Step 5: Transaction validation — each TX has valid signature + sufficient balance
Step 6: Proposer check        — proposer is FULL_NODE (phase_index ≥ 3)
                              — proposer's Ed25519 signature on block.hash is valid

All 6 checks must pass. Any failure rejects the block.
```

### 6.6 Balance Calculation (Chain Replay)

State is **never stored directly** — it is always derived by replaying the blockchain:

```python
def calculate_balance(address: str, chain: list) -> dict:
    balance = 100.0    # Genesis grant for all nodes
    staked  = 0.0

    for block in chain:
        for event in block["events"]:
            if   event["type"] == "GENESIS_GRANT" and to == address: balance += amount
            elif event["type"] == "SEND":
                if from == address: balance -= amount
                if to   == address: balance += amount
            elif event["type"] == "STAKE"   and from == address:
                balance -= amount; staked += amount
            elif event["type"] == "UNSTAKE" and from == address:
                staked -= amount; balance += amount
            elif event["type"] == "SLASH"   and from == address:
                staked -= amount   # Tokens destroyed

    return {"balance": balance, "staked": staked}
```

This UTXO-like replay model ensures **mathematical consistency** — no double-spending possible.

> 📸 **[IMAGE PLACEHOLDER]** — *Screenshot of the Chain Explorer tab (chain.jsx) showing blocks with their index, hash, proposer, and event list. Show the tree-like block linkage visually.*

---

## 7. Consensus Mechanism — Proof-of-Reputation

**Source:** `backend/modules/consensus.py`

### 7.1 Proposer Selection — Weighted Random Algorithm

```
select_proposer(seed) → node_id

W(node_i) = R(node_i) / Σ R(all_full_nodes)    (Reputation-weighted probability)

Algorithm:
  1. Fetch all FULL_NODE nodes from registry
  2. Get reputation score for each
  3. Total = sum of all scores
  4. Seed the RNG with SHA-256(previous_block_hash) for determinism
  5. Draw r ~ Uniform(0, Total)
  6. Walk sorted list; return first node where cumulative ≥ r
```

```python
# Deterministic seeded RNG — all nodes compute same result
rng_seed = int(hashlib.sha256((seed or str(time.time())).encode()).hexdigest(), 16)
rng = random.Random(rng_seed)
r = rng.uniform(0, total)
cumulative = 0.0
for node_id, score in scores.items():
    cumulative += score
    if r <= cumulative:
        selected = node_id
        break
```

Using the previous block hash as seed ensures all nodes **independently agree** on who the next proposer should be without communication.

### 7.2 Block Finalization — BFT Voting (2/3 Threshold)

```
required_votes = max(1, int(full_node_count × CONSENSUS_THRESHOLD))
             = max(1, int(N × 0.667))      # BFT 2/3 majority

Voting flow:
  1. Proposer broadcasts BLOCK_PROPOSAL
  2. Each PHASE_3 / FULL_NODE validates and broadcasts BLOCK_VOTE
  3. When |votes| ≥ required_votes:
     a. Block appended to chain
     b. BLOCK_FINALIZED broadcast to all peers
     c. Pending events removed from mempool
     d. Honest round credited to all voters
```

> 📸 **[IMAGE PLACEHOLDER]** — *Diagram showing the consensus voting flow: (1) proposer selection, (2) BLOCK_PROPOSAL broadcast, (3) vote collection from FULL_NODEs and PHASE_3 nodes, (4) 2/3 threshold check, (5) BLOCK_FINALIZED broadcast. Show message arrows between 4 nodes.*

### 7.3 Chain Synchronization

On startup and every 15 seconds:
```
sync_chain_from_peers():
  For each peer:
    GET /chain → peer_chain
    if len(peer_chain) > local_length:
      if is_valid_chain(peer_chain):     # Full validation
        replace local chain with peer_chain
```

This implements the **longest valid chain rule** — the same Nakamoto consensus chain selection mechanism used by Bitcoin.

---
