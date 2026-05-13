# POR-Chain / Ascent — Comprehensive Technical Report
### *ColdStart-PoR: Proof-of-Reputation Blockchain with ML Misbehavior Detection*

> **Authors:** Abhijith S et al., Amrita Vishwa Vidyapeetham, 2026
> **Implementation:** Python (FastAPI) + React (Next.js) + scikit-learn ML Oracle
> **Reference:** IEEE Paper — *"ColdStart-PoR: An Incentive-Compatible Reputation Bootstrapping Protocol for Proof-of-Reputation Blockchains"*

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement — The Cold-Start Problem](#2-problem-statement)
3. [System Architecture Overview](#3-system-architecture-overview)
4. [The ColdStart-PoR Protocol — Three-Phase State Machine](#4-the-coldstart-por-protocol)
5. [Core Algorithms](#5-core-algorithms)
6. [Blockchain Engine](#6-blockchain-engine)
7. [Consensus Mechanism — Proof-of-Reputation](#7-consensus-mechanism)
8. [ML Misbehavior Oracle](#8-ml-misbehavior-oracle)
9. [Dynamic Staking Algorithm](#9-dynamic-staking-algorithm)
10. [Cryptographic Identity & Security](#10-cryptographic-identity--security)
11. [P2P Networking & Gossip Protocol](#11-p2p-networking--gossip-protocol)
12. [Frontend — Ascent Mobile Dashboard](#12-frontend--ascent-mobile-dashboard)
13. [API Reference](#13-api-reference)
14. [Deployment & Infrastructure](#14-deployment--infrastructure)
15. [Security Model & Attack Resistance](#15-security-model--attack-resistance)
16. [Protocol Parameters Reference](#16-protocol-parameters-reference)
17. [Results & Observations](#17-results--observations)

---

## 1. Executive Summary

**Ascent** (internally: **POR-Chain**) is a full-stack implementation of the *ColdStart-PoR* protocol — a novel, incentive-compatible bootstrapping mechanism for Proof-of-Reputation (PoR) blockchains. The project solves the fundamental **cold-start problem**: how can a new node join a reputation-based network when it has no reputation history?

The system consists of:

| Layer | Technology | Purpose |
|---|---|---|
| **Blockchain Core** | Python / FastAPI | 4-node cluster running PoR consensus |
| **Frontend Dashboard** | React / Next.js | Mobile-first node management UI |
| **ML Oracle** | scikit-learn (Isolation Forest) | Unsupervised misbehavior detection |
| **P2P Network** | httpx async gossip | Signed message propagation |
| **Cryptography** | Ed25519 (PyCA) | Identity, signing, verification |

The protocol guarantees:
- **Incentive Compatibility** — Honest behavior is a Nash equilibrium (Theorem 1 of the IEEE paper)
- **Sybil Resistance** — Attack cost scales **linearly** O(k·τᵥ) with attacker scale (Proposition 1)
- **Decentralization** — No trusted authority after genesis seeding
- **ML-Augmented Security** — Isolation Forest anomaly detection as an autonomous sidecar

---

## 2. Problem Statement

### The Cold-Start Problem

Proof-of-Reputation blockchains select validators based on **behavioral history**. This is superior to Proof-of-Work (energy-wasteful) and Proof-of-Stake (wealth-concentration), but introduces a chicken-and-egg dilemma:

> *A new node needs reputation to participate, but needs to participate to earn reputation.*

| Prior Approach | Failure Mode |
|---|---|
| Free starting reputation for all | Sybil attack: attacker creates 1000 identities for free |
| Only founder assigns reputation | Centralized — single point of trust/failure |
| Require token stake (PoS) | Defeats the purpose of reputation; requires capital |

### ColdStart-PoR Solution

The protocol introduces a **three-phase graduated entry** that:
1. Requires cryptographic **proof of work** before any reputation is granted
2. Requires an established node to **stake collateral** as a social guarantee
3. Mandates an **observation period** where new nodes earn reputation through demonstrated behavior

The cost to introduce `k` Sybil nodes scales as:

```
Sybil Cost(k) = k × δ × τᵥ × R_voucher
             = k × 0.15 × 0.40 × R_voucher
             ∝ O(k)   — Linear scaling makes mass attacks economically infeasible
```

---

## 3. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        ASCENT / POR-CHAIN SYSTEM                        │
├───────────────────────────┬─────────────────────────────────────────────┤
│     FRONTEND (Port 4000)  │          BACKEND CLUSTER                    │
│   React / Next.js App     │                                             │
│   ┌────────────────────┐  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│   │  Ascent Dashboard  │  │  │Node:5000 │  │Node:5001 │  │Node:5002 │  │
│   │  - Home            │──┼─▶│FULL_NODE │  │FULL_NODE │  │FULL_NODE │  │
│   │  - Merit (Phase1)  │  │  │Bootstrap │  │Bootstrap │  │Bootstrap │  │
│   │  - Vouch (Phase2)  │  │  └──────────┘  └──────────┘  └──────────┘  │
│   │  - Validate        │  │        │P2P Gossip Network│                  │
│   │  - Reputation      │  │  ┌──────────┐                               │
│   │  - Activity        │  │  │Node:5003 │ (Bootstrap)                   │
│   │  - Chain Explorer  │  │  └──────────┘                               │
│   └────────────────────┘  │                                             │
│                           ├─────────────────────────────────────────────┤
│   ML Oracle (Sidecar)     │          ML-ORACLE SIDECAR                  │
│   ┌────────────────────┐  │  ┌──────────────────────────────────────┐   │
│   │  oracle.py         │  │  │ chain_listener.py → polls /registry  │   │
│   │  detector.py       │◀─┼──│ detector.py → IsolationForest model  │   │
│   │  IsolationForest   │  │  │ oracle.py → triggers /penalize       │   │
│   └────────────────────┘  │  └──────────────────────────────────────┘   │
└───────────────────────────┴─────────────────────────────────────────────┘
```

> 📸 **[IMAGE PLACEHOLDER]** — *Architecture diagram showing the full system: 4-node cluster, frontend dashboard, ML oracle, and P2P gossip network connections. Recommended: system topology diagram with port numbers labeled.*

### Directory Structure

```
Ascent-main/
├── backend/                    ← Python FastAPI node
│   ├── main.py                 ← Node entry point, lifespan, scheduler
│   ├── config.py               ← All tunable protocol parameters
│   ├── device_gateway.py       ← Mobile device routing proxy
│   ├── modules/
│   │   ├── identity.py         ← Ed25519 keypair, signing, node_id
│   │   ├── blockchain.py       ← Block creation, Merkle tree, chain validation
│   │   ├── consensus.py        ← PoR proposer selection, BFT voting
│   │   ├── coldstart.py        ← 3-phase state machine (core protocol)
│   │   ├── reputation.py       ← EWMA reputation engine (Eq. 4)
│   │   ├── registry.py         ← Node registry, phase tracking
│   │   ├── wallet.py           ← Token wallet, signed transactions
│   │   ├── networking.py       ← P2P broadcast, gossip, peer discovery
│   │   ├── storage.py          ← Async JSON file persistence
│   │   └── audit.py            ← In-memory audit event log
│   └── api/
│       ├── routes_node.py      ← Node status endpoints
│       ├── routes_chain.py     ← Chain read endpoints
│       ├── routes_tasks.py     ← Phase 1 task assignment/submission
│       ├── routes_vouch.py     ← Phase 2 vouching endpoints
│       ├── routes_wallet.py    ← Wallet balance/send/stake
│       ├── routes_broadcast.py ← P2P message receive & routing
│       ├── routes_simulate.py  ← Malicious block simulation
│       └── routes_audit.py     ← Live audit log stream
│
├── apps/web/                   ← React / Next.js frontend
│   └── src/
│       ├── app/page.jsx        ← Root app shell, navigation
│       ├── components/
│       │   ├── splash.jsx      ← ColdStart onboarding flow
│       │   ├── home.jsx        ← Dashboard / wallet home
│       │   ├── merit.jsx       ← Phase 1 task interface
│       │   ├── vouch.jsx       ← Phase 2 vouching interface
│       │   ├── validate.jsx    ← Block validation / consensus view
│       │   ├── reputation.jsx  ← Reputation score & history
│       │   ├── activity.jsx    ← Transaction history
│       │   └── chain.jsx       ← Block explorer
│       ├── chain/
│       │   ├── node.jsx        ← NodeContext: polls /coldstart/status
│       │   ├── useSyncStore.js ← Syncs backend state → Zustand
│       │   └── api.js          ← REST API client
│       └── store/useStore.js   ← Zustand global state
│
└── scripts/
    ├── start_all.ps1           ← One-click Windows Terminal launcher
    ├── start_node.ps1          ← Individual node startup script
    └── ml-oracle/
        ├── oracle.py           ← ML oracle main entry point
        ├── detector.py         ← IsolationForest anomaly detector
        └── chain_listener.py   ← Polling listener for node registry
```

---

## 4. The ColdStart-PoR Protocol

The protocol is implemented as a **strict finite state machine** with 7 states:

```
UNKNOWN → PHASE_1 → PHASE_2 → PHASE_3 → UNDER_OBSERVATION → FULL_NODE
                                    ↘              ↘
                                    BANNED ←────── BANNED
```

### State Definitions

| State | Phase | Description | Privileges |
|---|---|---|---|
| `PHASE_1` | Probation | Completing cryptographic tasks | None |
| `PHASE_2` | Awaiting Vouch | Passed tasks; needs sponsor | None |
| `PHASE_3` | Graduated | Vouched; in observation period | Vote only |
| `UNDER_OBSERVATION` | Extended Watch | After 10 honest rounds | Vote only |
| `FULL_NODE` | Full Participant | After 20 total honest rounds | Propose + Vote |
| `BANNED` | Expelled | Misbehavior detected | None |

### Phase Transition Triggers

```
PHASE_1 → PHASE_2:  Score P(v,N) = (valid/total) ≥ θ_P (0.90)  [Equation 1]
PHASE_2 → PHASE_3:  VOUCHES_REQUIRED (≥1) active vouches received
PHASE_3 → UNDER_OBS: honest_rounds ≥ PHASE3_ROUNDS (10)
UNDER_OBS → FULL_NODE: honest_rounds ≥ PHASE3_HONEST_ROUNDS (20)
ANY → BANNED:       Malicious block detected OR ML oracle flags anomaly
```

> 📸 **[IMAGE PLACEHOLDER]** — *State transition diagram with conditions on each arrow. Should show all 7 states as nodes, with transition conditions (e.g., "score ≥ 0.9", "2 vouches received") labeled on edges. Recommended: flowchart / finite state machine diagram.*

---
