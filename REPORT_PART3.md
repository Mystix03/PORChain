## 8. ML Misbehavior Oracle

**Source:** `scripts/ml-oracle/` (oracle.py, detector.py, chain_listener.py)

The ML Oracle is a **standalone Python sidecar process** that runs alongside the blockchain cluster. It uses **unsupervised machine learning** to detect misbehaving nodes without requiring pre-labeled training data.

### 8.1 Architecture

```
chain_listener.py       detector.py              oracle.py
─────────────────       ───────────────          ────────────
Poll /node/registry  →  Record state history  →  Periodic scan
every 10 seconds        per node                 every 20 seconds

NodeStateUpdate event → record_state_update()  → maybe_refit()
                                               → is_anomalous(node_id)
                                               → _submit_penalize(node_id)
                                               → POST /coldstart/penalize
```

### 8.2 ML Model: Isolation Forest

**Algorithm:** `sklearn.ensemble.IsolationForest`

Isolation Forest is an **unsupervised anomaly detection** algorithm that:
- Requires **zero labeled training data**
- Learns what "normal" looks like from live network data
- Flags statistical outliers as anomalies
- Works by randomly partitioning feature space — anomalies are isolated in fewer splits

```python
# detector.py
self._model = IsolationForest(
    contamination=0.10,    # Expected fraction of malicious nodes (10%)
    random_state=42,
    n_estimators=100,      # 100 isolation trees
)
self._model.fit(X)         # X = feature matrix of all tracked nodes
```

For small networks (< 5 nodes), `n_estimators=50` and `contamination="auto"` are used to avoid overfitting on tiny samples.

### 8.3 Feature Vector (4 Dimensions)

Each node is represented as a **4-dimensional feature vector** extracted from its recent history window (last 10 state snapshots):

```
Feature Vector = [
    f[0]: current_score      — absolute reputation score ∈ [0.0, 1.0]
    f[1]: reputation_delta   — score change over history window (latest - oldest)
    f[2]: honest_round_delta — new honest rounds completed in window
    f[3]: phase_rank         — numerical phase encoding
]

Phase Rank Encoding:
  BANNED           → 0
  UNKNOWN          → 1
  PHASE_1          → 2
  PHASE_2          → 3
  PHASE_3          → 4
  UNDER_OBSERVATION→ 5
  FULL_NODE        → 6
```

```python
# detector.py: _extract_features()
current_score      = latest["reputation_score"]
reputation_delta   = current_score - oldest["reputation_score"]
honest_round_delta = latest["honest_rounds"] - oldest["honest_rounds"]
phase_rank         = float(PHASE_RANK.get(latest["phase"], 1))

return np.array([current_score, reputation_delta, float(honest_round_delta), phase_rank])
```

### 8.4 Anomaly Scoring & Threshold

```python
score = self._model.score_samples(f.reshape(1, -1))[0]
# IsolationForest returns negative scores:
# More negative = more anomalous
# ANOMALY_THRESHOLD = -0.2 (tunable constant)

is_anomalous = score < ANOMALY_THRESHOLD   # i.e., score < -0.20
```

**Anomaly signatures that trigger detection:**
- Reputation **dropping rapidly** while phase_rank is high (indicates malicious votes)
- Honest round delta of **zero** for many periods (node stopped participating)
- Phase rank **inconsistency** with reputation (e.g., high phase but near-zero rep)
- Sudden reputation **spike** from expected behavior patterns (Sybil coordination)

### 8.5 Cooldown & Anti-Spam

```python
COOLDOWN_SEC = 300   # 5-minute cooldown per node

# Before triggering penalize:
last = self._last_slash_proposed.get(node_id, 0)
if time.time() - last < COOLDOWN_SEC:
    return   # Skip — already penalized recently
```

### 8.6 Model Refit Strategy

```
maybe_refit(force=False):
  - Triggers if new_events ≥ 5 since last fit  (incremental refit)
  - Triggers every 20 seconds regardless        (periodic forced refit)
  - Requires MIN_SAMPLES_TO_FIT = 3 nodes with history
  - Requires MIN_HISTORY_PER_NODE = 3 state snapshots per node
```

The model is continuously re-trained on fresh data, ensuring it adapts to **network growth and changing behavior patterns** without manual intervention.

### 8.7 Oracle Status Output

Every scan cycle, the oracle writes `ml_status.json` to the node's data directory:

```json
{
  "status": "online",
  "trained": true,
  "nodes_tracked": 5,
  "nodes_with_history": 4,
  "anomalies_detected": 1,
  "threshold": -0.2,
  "contamination": 0.1,
  "min_samples_needed": 3,
  "total_events": 120,
  "timestamp": 1714392060.0
}
```

This file is read by the backend to surface ML status in the dashboard.

> 📸 **[IMAGE PLACEHOLDER]** — *Diagram showing the ML oracle pipeline: (1) chain_listener polling /registry every 10s, (2) feature extraction from 4D history, (3) IsolationForest scoring, (4) anomaly decision, (5) POST /coldstart/penalize. Include a sample feature space scatter plot showing normal vs. anomalous nodes.*

> 📸 **[IMAGE PLACEHOLDER]** — *Screenshot of the ML Oracle terminal output showing: periodic scan logs, model refit messages, and an anomaly detection warning with feature values displayed.*

---

## 9. Dynamic Staking Algorithm

**Source:** `backend/modules/coldstart.py → vouch()` (lines 245-266)

This is one of the most innovative algorithmic additions **beyond** the base IEEE paper. It makes the staking amount proportional to the **computational work** the candidate performed during Phase 1 (their PoW nonce).

### 9.1 Concept

The intuition: a node that found a valid PoW nonce at a very high nonce value worked harder to prove itself. This extra work provides a **trust signal** that reduces the financial burden on their voucher.

### 9.2 Algorithm

```
Dynamic Stake Calculation:

base_delta   = VOUCH_DELTA = 0.15          (15% base stake fraction)
work_discount = pow_nonce / 1,000,000      (every 1M nonces = 1% discount)
dynamic_delta = clamp(base_delta - work_discount, 0.01, 0.15)
               (safety bounds: minimum 1%, maximum 15%)

stake_amount = voucher_reputation × dynamic_delta × 100
```

```python
# coldstart.py
base_delta    = config.VOUCH_DELTA              # 0.15
work_discount = float(target_nonce) / 1_000_000.0

# SAFETY: Clamp between 1% and 15%
dynamic_delta = max(0.01, min(base_delta, base_delta - work_discount))

stake_amount  = round(float(voucher_score) * dynamic_delta * 100.0, 4)
```

### 9.3 Stake Discount Table

| PoW Nonce | Work Discount | Effective Delta | Stake (rep=0.7) |
|---|---|---|---|
| 0 | 0.0% | 15.0% | 10.50 POR |
| 100,000 | 0.01% | 14.99% | 10.49 POR |
| 500,000 | 0.05% | 14.95% | 10.47 POR |
| 1,000,000 | 0.1% | 14.9% | 10.43 POR |
| 5,000,000 | 0.5% | 14.5% | 10.15 POR |
| 10,000,000 | 1.0% | 14.0% | 9.80 POR |
| 140,000,000 | 14.0% | 1.0% | 0.70 POR (min) |

*The discount is intentionally small for realistic PoW difficulty=3, keeping the range bounded between 1%-15%.*

### 9.4 Work Proof Propagation

The nonce travels through the system:

```
Phase 1 (submit_task_results):
  pow_nonce extracted from PoW submission
  → stored in registry via set_phase(node_id, "PHASE_2", pow_nonce=pow_nonce)
  → broadcast in PHASE_UPDATE P2P message

Phase 2 (vouch):
  target_info = await registry.get_node(target_id)
  target_nonce = target_info.get("pow_nonce", 0)
  → used in dynamic_delta calculation
  → logged in audit trail: "Work Leverage: X%"
```

> 📸 **[IMAGE PLACEHOLDER]** — *Graph showing the dynamic staking curve: X-axis = PoW nonce value (0 to 10M), Y-axis = stake discount percentage (0% to 15%). Show the linear relationship and the safety floor at 1%.*

---

## 10. Cryptographic Identity & Security

**Source:** `backend/modules/identity.py`

### 10.1 Ed25519 Keypair

Each node generates a unique **Ed25519** keypair on first startup:

```python
priv = Ed25519PrivateKey.generate()     # PyCA cryptography library
pub  = priv.public_key()
pub_bytes = pub.public_bytes(Encoding.Raw, PublicFormat.Raw)

# Node ID = raw hex of public key (32 bytes = 64 hex chars)
node_id = pub_bytes.hex()
```

The private key is stored **locally only** — it is never transmitted over any network connection.

### 10.2 Transaction Signing

Every transaction is signed before being broadcast:

```python
def sign(message: str | bytes) -> str:
    priv = Ed25519PrivateKey.from_private_bytes(b64decode(private_key))
    return b64encode(priv.sign(message.encode())).decode()

# Canonical JSON ensures deterministic serialization for signing:
def canonical(data: dict) -> str:
    return json.dumps(data, sort_keys=True, separators=(",", ":"))
```

### 10.3 Message Verification

All P2P messages include a sender signature. `routes_broadcast.py` verifies every incoming message before processing:

```python
def verify_message(msg: dict) -> bool:
    payload = {k: v for k, v in msg.items() if k != "signature"}
    return identity.verify(
        canonical(payload),
        msg["signature"],
        msg["sender_pubkey"],
    )
```

**If verification fails → HTTP 400 → message dropped.**

### 10.4 Security Gating by Phase

Financial operations are gated by node phase:

```python
# wallet.py — SEND, STAKE, UNSTAKE all check:
if registry.phase_index(current_phase) < 3:
    raise ValueError("Security Gate: Phase 3+ required")
if current_phase == "BANNED":
    raise ValueError("BANNED nodes cannot transact")
```

Phase index mapping:
```
UNKNOWN=0, PHASE_1=1, PHASE_2=2, PHASE_3=3, UNDER_OBS=4, FULL_NODE=5, BANNED=6
```

Phase 3 (index=3) is the minimum for any financial transaction.

### 10.5 Message Deduplication (Gossip Safety)

```python
_seen_ids: deque = deque(maxlen=1000)   # Ring buffer

def is_duplicate(message_id: str) -> bool:
    if message_id in _seen_ids:
        return True
    _seen_ids.append(message_id)
    return False
```

Every message has a UUID `message_id`. The ring buffer prevents the same message from being processed more than once as it propagates through the gossip network.

---

## 11. P2P Networking & Gossip Protocol

**Source:** `backend/modules/networking.py`, `backend/api/routes_broadcast.py`

### 11.1 Message Envelope Structure

```json
{
  "message_id":   "uuid-v4",
  "type":         "BLOCK_PROPOSAL | BLOCK_VOTE | NODE_JOIN | ...",
  "sender_id":    "hex_node_id",
  "sender_pubkey":"base64_ed25519_pubkey",
  "timestamp":    1714392000.0,
  "payload":      { ... },
  "signature":    "base64_ed25519_sig_of_above"
}
```

### 11.2 Message Types

| Message Type | Trigger | Handler |
|---|---|---|
| `NODE_JOIN` | Node startup | Register node, assign Phase 1 tasks |
| `BLOCK_PROPOSAL` | Proposer's turn | Validate, cache, vote |
| `BLOCK_VOTE` | Vote cast | Count votes, check 2/3 threshold |
| `BLOCK_FINALIZED` | 2/3 threshold reached | Apply block to chain (for Phase 1/2 nodes) |
| `transaction` / `TX` | Send/Stake/Unstake | Verify sig, add to mempool |
| `VOUCH` | Vouch action | Record vouch without re-staking |
| `PHASE_UPDATE` | Phase transition | Update local registry |
| `REPUTATION_UPDATE` | Honest/malicious event | Update local reputation store |

### 11.3 Gossip Rebroadcast

Every received message is **re-broadcast** to all peers (via FastAPI `BackgroundTasks`):

```python
# routes_broadcast.py
bg_tasks.add_task(networking.forward, msg)
```

This implements an **epidemic gossip protocol** — messages propagate exponentially through the network. The deduplication ring buffer prevents infinite loops.

### 11.4 Auto-Discovery (Magic Join)

```python
async def discover_local_peers(port_range=(5000, 5010)) -> list[str]:
    for port in range(5000, 5011):
        if port == my_port: continue
        url = f"http://127.0.0.1:{port}"
        # Attempt GET /node_state with 200ms timeout
        # If responds → add as peer automatically
```

Nodes scan ports 5000-5010 on startup. Any responsive node is automatically added as a peer. This enables **zero-configuration** cluster formation on a single machine.

---
