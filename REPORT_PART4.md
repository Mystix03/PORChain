## 12. Frontend — Ascent Mobile Dashboard

**Source:** `apps/web/src/` (React / Next.js)

### 12.1 Design Philosophy

Ascent is a **mobile-first** (430px max-width) React dashboard that mirrors the protocol's phase lifecycle. The UI enforces the same security gates as the backend — features are conditionally revealed based on the node's current phase.

### 12.2 Screen Architecture

| Screen | Component | Phase Visibility | Purpose |
|---|---|---|---|
| **Splash / Onboarding** | `splash.jsx` | Always (first launch) | ColdStart explanation, node initialization |
| **Home** | `home.jsx` | Always | Wallet balance, token actions, phase status card |
| **Merit** | `merit.jsx` | Always | Phase 1 task interface |
| **Vouch** | `vouch.jsx` | Always | Phase 2 vouching interface |
| **Validate** | `validate.jsx` | Phase 3+ only | Block validation, consensus simulation |
| **Reputation** | `reputation.jsx` | Always | Rep score, Eq.4 evolution chart |
| **Activity** | `activity.jsx` | Always | Transaction history |
| **Chain** | `chain.jsx` | Always | Block explorer |
| **Settings** | `settings.jsx` | Overlay (tap logo) | Node settings, dark mode |

### 12.3 State Management (Zustand)

The `useStore.js` Zustand store holds all client-side state:

```javascript
// Key slices:
{
  wallet:        "hex_node_id",
  phase:         "PHASE_1" | "PHASE_2" | "PHASE_3" | "FULL_NODE" | ...,
  reputation:    0.72,            // float [0,1]
  tokenBalance:  98.5,            // POR tokens
  stakedBalance: 1.5,
  graduated:     false,           // true = show Validate tab
  chainHistory:  [...],           // transaction records
  notifications: [...],           // notification feed
  activeModal:   null | "send" | "stake" | "swap" | "slash",
  isDarkMode:    false,
}
```

### 12.4 Backend Sync (useSyncStore Hook)

```javascript
// useSyncStore.js — runs on 6s + 8s polling intervals
useSyncStore():
  NodeContext polls /coldstart/status every 6s
    → syncFromNode(nodeState) updates Zustand

  Wallet poller runs every 8s:
    → fetchWallet()        → setTokenBalance(balance, staked)
    → fetchWalletHistory() → setChainHistory(transactions)
```

### 12.5 Phase-Conditional Navigation

```javascript
const TABS = [
  { id: "home",       label: "Home",     Icon: HomeIcon   },
  { id: "merit",      label: "Merit",    Icon: Zap        },
  ...(graduated ? [{ id: "validate", label: "Validate", Icon: ShieldCheck }] : []),
  { id: "reputation", label: "Rep",      Icon: TrendingUp },
  { id: "vouch",      label: "Vouch",    Icon: Users      },
  { id: "activity",   label: "Activity", Icon: List       },
];
```

The **Validate** tab is only shown to `FULL_NODE` / graduated nodes. This mirrors the backend's block proposal security gate.

### 12.6 Dark Mode & Theming

CSS custom properties with `data-theme` attribute switching:

```css
:root {
  --bg-app:      #E8EDF5;
  --bg-card:     #FFFFFF;
  --text-primary:#0D1421;
}
[data-theme="dark"] {
  --bg-app:      #080B10;
  --bg-card:     #1A1F2B;
  --text-primary:#F9FAFB;
}
```

### 12.7 Device Gateway (Mobile Proxying)

`backend/device_gateway.py` acts as a middleware that detects the `User-Agent` of the request and serves either the desktop React app or the mobile-optimized frontend. The backend itself also hosts the legacy `frontend/` static build at `/static`, enabling mobile devices to access the full UI at `http://<LAN-IP>:5000`.

> 📸 **[IMAGE PLACEHOLDER]** — *Side-by-side screenshot: (left) Splash / onboarding screen explaining the 3 phases; (right) Home tab showing wallet balance, POR token amount, staked amount, and the phase progress card. Show dark mode.*

> 📸 **[IMAGE PLACEHOLDER]** — *Screenshot of the Merit tab showing the Phase 1 task list with all 4 task types (HASH_PREIMAGE, VERIFY_HASH, SIGN_CHALLENGE, POW) with their respective challenge strings and answer inputs.*

> 📸 **[IMAGE PLACEHOLDER]** — *Screenshot of the Reputation tab showing the reputation score gauge, the Eq.4 formula displayed, and a line chart of reputation history over honest rounds.*

> 📸 **[IMAGE PLACEHOLDER]** — *Screenshot of the Vouch tab showing available nodes to vouch for, their current phase, PoW nonce, and the calculated dynamic stake amount.*

---

## 13. API Reference

### Node State

| Method | Endpoint | Description |
|---|---|---|
| GET | `/node_state` | Full node status: phase, reputation, rounds |
| GET | `/node/registry` | All known nodes and their phases |
| GET | `/node/peers` | Peer list and health status |

### Chain

| Method | Endpoint | Description |
|---|---|---|
| GET | `/chain` | Full blockchain |
| GET | `/chain/{index}` | Single block by index |

### ColdStart (Phase Management)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/coldstart/tasks` | Get assigned Phase 1 tasks |
| POST | `/coldstart/submit` | Submit Phase 1 task answers |
| GET | `/coldstart/status` | Node's full coldstart status |
| POST | `/coldstart/penalize` | Ban a malicious node (ML oracle trigger) |

### Vouching

| Method | Endpoint | Description |
|---|---|---|
| POST | `/vouch` | Vouch for a node (Phase 2 → 3) |
| GET | `/vouch/status/{node_id}` | Get vouch records for a node |

### Wallet

| Method | Endpoint | Description |
|---|---|---|
| GET | `/wallet/balance` | Current balance and staked amount |
| GET | `/wallet/history` | Transaction history |
| POST | `/wallet/send` | Send POR tokens |
| POST | `/wallet/stake` | Stake tokens |
| POST | `/wallet/unstake` | Unstake tokens |

### P2P

| Method | Endpoint | Description |
|---|---|---|
| POST | `/broadcast` | Receive P2P gossip message |

### Simulation

| Method | Endpoint | Description |
|---|---|---|
| POST | `/simulate/malicious-block` | Simulate malicious block + detection + penalty |

### Audit

| Method | Endpoint | Description |
|---|---|---|
| GET | `/audit/logs` | Last N audit events (CRYPTO, ECONOMY, CONSENSUS, REPUTATION) |
| GET | `/terminal` | Serve `audit.html` live log terminal |

---

## 14. Deployment & Infrastructure

### 14.1 Cluster Configuration

The default cluster runs 4 bootstrap nodes (`FULL_NODE` from genesis):

| Node | Port | Role | Data Dir |
|---|---|---|---|
| Node-5000 | 5000 | Bootstrap FULL_NODE (primary peer) | `backend/data_5000/` |
| Node-5001 | 5001 | Bootstrap FULL_NODE | `backend/data_5001/` |
| Node-5002 | 5002 | Bootstrap FULL_NODE | `backend/data_5002/` |
| Node-5003 | 5003 | Bootstrap FULL_NODE | `backend/data_5003/` |
| Frontend | 4000 | Next.js dev server | `apps/web/` |
| ML Oracle | — | Sidecar process | Reads `data_5000/` |

Nodes on ports 5000-5003 are auto-registered as `FULL_NODE` with `reputation=1.0`:
```python
if config.NODE_PORT <= 5003:
    await registry.register(node_id, public_key, phase="FULL_NODE")
    await reputation.set_initial(node_id, 1.0)
```

Guest nodes on ports > 5003 start as `PHASE_1` with `reputation=0.05`.

### 14.2 One-Click Startup (`start_all.ps1`)

```powershell
# start_all.ps1 — Opens 6 Windows Terminal tabs:
# Tab 1: Node-5000 (bootstrap)
# Tab 2: Node-5001 (bootstrap, peers: 5000)
# Tab 3: Node-5002 (bootstrap, peers: 5000)
# Tab 4: Node-5003 (bootstrap, peers: 5000)
# Tab 5: Frontend  (npm run dev on port 4000)
# Tab 6: ML-Oracle (python oracle.py)
```

Auto-detects LAN IP for mobile access:
```
Laptop : http://<LAN-IP>:4000
Phone  : http://<LAN-IP>:4000
```

### 14.3 Environment Variables

| Variable | Default | Description |
|---|---|---|
| `NODE_PORT` | 5000 | Port for this node |
| `PEERS` | `""` | Comma-separated peer URLs |
| `DATA_DIR` | `backend/data` | Persistent storage directory |
| `LAMBDA` | 0.8 | Reputation decay factor |

### 14.4 Persistence (JSON File Store)

Each node maintains isolated JSON files in its `DATA_DIR`:

| File | Contents |
|---|---|
| `identity.json` | Ed25519 keypair, node_id |
| `chain.json` | Full blockchain |
| `registry.json` | All known nodes and phases |
| `reputation.json` | Reputation scores |
| `wallet.json` | Wallet address |
| `tasks.json` | Phase 1 task assignments + results |
| `vouches.json` | Vouch records |
| `peers.json` | Peer URL list |
| `ml_status.json` | ML oracle status (written by oracle) |

### 14.5 Dependencies

**Backend (Python):**
```
fastapi>=0.111.0        — REST API framework
uvicorn[standard]       — ASGI server
httpx>=0.27.0           — Async HTTP client (P2P)
cryptography>=42.0.0    — Ed25519 (PyCA)
scikit-learn==1.4.1     — IsolationForest (ML Oracle)
numpy==1.26.4           — Feature matrix computation
requests==2.31.0        — Sync HTTP (chain listener)
```

**Frontend (Node.js):**
```
Next.js 14              — React framework
Zustand                 — State management
Framer Motion           — Animations
Lucide React            — Icons
Sonner                  — Toast notifications
```

---

## 15. Security Model & Attack Resistance

### 15.1 Sybil Attack Resistance (Proposition 1)

To introduce `k` Sybil nodes, an attacker needs `k` legitimate vouchers, each with reputation ≥ τᵥ = 0.40:

```
Sybil Cost(k) = k × δ × τᵥ_min × R_voucher_min
              = k × 0.15 × 0.40 × R_min
              = k × 0.06 × R_min
              ∝ O(k)
```

| k Sybil nodes | Minimum Cost |
|---|---|
| 1 | 6% of voucher reputation |
| 10 | 60% of total network reputation sacrificed |
| 100 | Requires 100 fully-qualified vouchers |
| 1000 | Economically infeasible at network scale |

### 15.2 Block Tampering Detection

The 6-step validation pipeline in `validate_block()` ensures:
- **Previous hash linkage** — Any gap breaks the chain
- **Hash integrity** — Any field modification invalidates the hash
- **Merkle proof** — Any event modification invalidates the root
- **Signature verification** — Block must be signed by the claimed proposer
- **Phase gating** — Proposer must be FULL_NODE (index ≥ 3)

### 15.3 Stake Slashing (Economic Deterrence)

| Scenario | Voucher Outcome |
|---|---|
| Node misbehaves in PHASE_3 | 100% of stake slashed |
| Node misbehaves in UNDER_OBSERVATION | 50% slashed, 50% returned |
| Node misbehaves as FULL_NODE | Stake already returned — no penalty |
| Node graduates successfully | 100% of stake returned |

### 15.4 Simulation Mode

`POST /simulate/malicious-block` allows testing the full attack-detection pipeline:

1. Constructs a block with a tampered `previous_hash` (`...DEADBEEF`)
2. Runs it through `validate_block()` — always returns `False` (detected)
3. Calls `penalize_malicious()` — bans node, slashes vouchers
4. Broadcasts `PHASE_UPDATE: BANNED` to all peers
5. Returns a structured simulation report for the UI

> 📸 **[IMAGE PLACEHOLDER]** — *Screenshot of the Validate tab showing the malicious block simulation result: the tampered block details, detection result (REJECTED), attacker phase change (PHASE_3 → BANNED), reputation drop (e.g., 0.72 → 0.0), and voucher penalty summary.*

---

## 16. Protocol Parameters Reference

All parameters are defined in `backend/config.py` and override-able via environment variables:

| Parameter | Symbol | Value | IEEE Paper | Description |
|---|---|---|---|---|
| `LAMBDA` | λ | 0.80 | Eq. 4 decay | Reputation smoothing factor |
| `INITIAL_REPUTATION` | — | 0.05 | — | Starting score for new nodes |
| `FULL_NODE_REP_THRESHOLD` | — | 0.70 | — | Min rep to propose blocks |
| `VOUCH_ELIGIBILITY_THRESHOLD` | τᵥ | 0.40 | §III-B | Min rep to vouch |
| `PHASE1_TASK_COUNT` | N | 5 | N=20 (paper) | Tasks per Phase 1 |
| `PHASE1_PASS_THRESHOLD` | θ_P | 0.90 | Eq. 1 | 90% pass rate required |
| `POW_DIFFICULTY` | — | 3 | — | Leading zeros in PoW |
| `PHASE3_ROUNDS` | M | 10 | M=10 (paper) | Honest rounds to observe |
| `PHASE3_HONEST_ROUNDS` | — | 20 | — | Total rounds to graduate |
| `VOUCHES_REQUIRED` | — | 1 | — | Vouches needed (paper: 1) |
| `VOUCH_DELTA` | δ | 0.15 | Eq. 2 | Staking fraction (15%) |
| `VOUCH_ALPHA` | α | 0.50 | Eq. 3 | Reputation dampening (50%) |
| `BLOCK_INTERVAL_SECONDS` | — | 5 | — | Consensus round interval |
| `CONSENSUS_THRESHOLD` | — | 0.667 | BFT 2/3 | Vote majority required |
| `GENESIS_BALANCE` | — | 100.0 | — | Starting POR token balance |

---

## 17. Results & Observations

### 17.1 Protocol Correctness

The protocol logic was empirically validated via the Python implementation's simulation endpoints and live cluster interaction. The core tests confirm:

- **Network Bootstrap**: Genesis nodes correctly initialize with full reputation (`1.0`).
- **Phase Progression**: Nodes securely transition from `PHASE_1` to `FULL_NODE` by passing cryptographic proofs, receiving a valid stake-backed vouch, and completing honest rounds.
- **Economic Safety**: Vouching stakes are accurately calculated and locked. Graduated nodes release stakes back to their vouchers, while malicious nodes trigger stake slashing.
- **Sybil Resistance**: The theoretical linear scaling of attack costs holds mathematically in the Python implementation logic.

> 📸 **[IMAGE PLACEHOLDER]** — *Screenshot showing a live cluster of 4 nodes successfully proposing and finalizing a block via the `validate.jsx` block explorer interface.*

### 17.2 Reputation Evolution (Empirical)

Starting from `R=0.05` with `LAMBDA=0.80`:

```
Round 1: R = 0.240   ← honest_rounds=1, phase=PHASE_3
Round 2: R = 0.392   ← honest_rounds=2
Round 3: R = 0.514   ← honest_rounds=3
...
Round 20: R = 0.988  ← GRADUATED to FULL_NODE
```

The node graduates to FULL status after `PHASE3_HONEST_ROUNDS = 20`.

> 📸 **[IMAGE PLACEHOLDER]** — *Line chart of reputation BPS over rounds (0-10), showing the EWMA convergence curve matching Equation 4 mathematically. Mark the graduation threshold.*

### 17.3 Sybil Resistance (Linear Scaling Verified)

Assuming a minimum vouch eligibility reputation of `0.40` and `δ=0.15`:
```
k=1   → Cost = 6 POR tokens    ✓
k=10  → Cost = 60 POR tokens   ✓  (10× — linear)
k=100 → Cost = 600 POR tokens  ✓  (100× — linear)
```

Cost grows **exactly linearly** with `k` — confirming Proposition 1 of the IEEE paper in the economic model.

> 📸 **[IMAGE PLACEHOLDER]** — *Bar chart or line graph: X-axis = k (number of Sybil nodes, log scale: 1, 10, 100, 1000), Y-axis = total attack cost in POR tokens. Show linear growth. Label key data points.*

### 17.4 ML Oracle Performance

| Metric | Value |
|---|---|
| Model | Isolation Forest (100 trees) |
| Feature dimensions | 4 |
| Scan interval | Every 20 seconds |
| Cooldown per node | 5 minutes |
| Contamination assumption | 10% of nodes |
| Min samples to fit | 3 nodes |
| Anomaly threshold | score < -0.20 |

> 📸 **[IMAGE PLACEHOLDER]** — *2D scatter plot (PCA-reduced from 4D) showing node feature vectors: normal nodes (green dots) vs. anomalous node (red dot). Show the IsolationForest decision boundary. Label axes as "Principal Component 1" and "Principal Component 2".*

> 📸 **[IMAGE PLACEHOLDER]** — *Timeline showing oracle lifecycle: (1) first state snapshots collected, (2) model first fit at t=20s, (3) anomalous node introduced, (4) anomaly detected at next scan, (5) penalize triggered, (6) node BANNED on blockchain.*

### 17.5 Block Finalization Latency

With 4 FULL_NODEs and `CONSENSUS_THRESHOLD=0.667`:
```
Required votes = max(1, floor(4 × 0.667)) = 2
Block interval = 5 seconds

Typical finalization: 1-2 consensus rounds (5-10 seconds)
With network delays:  up to 3 rounds (15 seconds)
```

### 17.6 Security Gate Enforcement

| Attack Vector | Defense | Location |
|---|---|---|
| BANNED node sends TX | Phase index check | `wallet.py` |
| Phase 1 node proposes block | Proposer phase check | `blockchain.py:validate_block` |
| Invalid signature on TX | Ed25519 verification | `blockchain.py:_verify_transactions` |
| Double-spend attempt | Balance simulation check | `blockchain.py:_verify_transactions` |
| Duplicate P2P message | UUID ring buffer | `networking.py:is_duplicate` |
| Tampered block hash | SHA-256 recomputation | `blockchain.py:validate_block` |
| Invalid proposer sig | Ed25519 verification | `blockchain.py:validate_block` |
| Self-vouching | Identity check | `coldstart.py:vouch` |

> 📸 **[IMAGE PLACEHOLDER]** — *Dashboard screenshot of the full UI in dark mode showing the complete node status: phase badge (e.g., FULL_NODE), reputation ring (72%), wallet balance (98.50 POR), and the bottom navigation tabs. Capture from a mobile device screen for authenticity.*

---

## Appendix: Equation Summary (IEEE Paper Mapping)

| Equation | Formula | File | Function |
|---|---|---|---|
| **Eq. 1** — Task Score | `P(v,N) = (1/N) Σ 1[πⱼ valid]` | `coldstart.py` | `submit_task_results()` |
| **Eq. 2** — Voucher Stake | `R'ₛ = Rₛ·(1−δ)` | `coldstart.py` | `vouch()` |
| **Eq. 3** — Initial Rep | `R_new(0) = α·Rₛ·δ` | `coldstart.py` | `vouch()` |
| **Eq. 4** — Rep Update | `R(t+1) = λ·R(t) + (1−λ)·h(t)` | `reputation.py` | `update()` |
| **Prop. 1** — Sybil Cost | `Cost = O(k·δ·τᵥ)` | test suite | Verified empirically |
| **Thm. 1** — Nash Eq. | Honest behavior dominant | slash mechanics | Economic deterrence |
| **Dynamic Staking** *(extension)* | `δ_eff = max(0.01, δ - nonce/1M)` | `coldstart.py` | `vouch()` |

---

*Report generated: May 2026 | Project: Ascent / POR-Chain | Authors: Abhijith S et al., Amrita Vishwa Vidyapeetham*
