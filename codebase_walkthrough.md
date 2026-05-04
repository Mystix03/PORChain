# 🛡️ PoR-Chain: Codebase Walkthrough

This document explains the architecture and file-by-file functionality of the **Proof-of-Reputation (PoR) Blockchain** project.

---

## 🏗️ 1. Architecture Overview
The project follows a **Decentralized Node Architecture**. Every node in the network runs the exact same code.

*   **Frontend**: A modern, interactive dashboard built with Vanilla JS and CSS.
*   **Backend**: A FastAPI (Python) server that handles the "Node Logic."
*   **Engine**: Modular Python scripts in `backend/modules/` that handle the heavy lifting (Cryptography, Consensus, and Reputation).
*   **Persistence**: Simple JSON files (`chain.json`, `reputation.json`, etc.) that act as the decentralized database.

---

## 🐍 2. Backend: The Node Engine (`backend/modules/`)

This is where the "Blockchain Magic" happens.

### `identity.py` (The Soul of the Node)
*   **Purpose**: Manages the Node's Private and Public keys.
*   **Key Feature**: Every transaction sent by your node is **digitally signed** here. It ensures that no one can impersonate you on the network.

### `blockchain.py` (The Ledger)
*   **Purpose**: Handles block creation and chain validation.
*   **Key Feature**: Implements **Merkle Trees**. It hashes all transactions in a block into a single "Merkle Root" to ensure the data is immutable.

### `reputation.py` (The PoR Formula)
*   **Purpose**: Calculates the trust score for every node.
*   **Key Feature**: Implements the **Decay Formula**: `R(t+1) = λ * R(t) + (1 - λ) * h(t)`. 
    *   It rewards honest behavior and "decays" trust over time to prevent nodes from resting on old glory.

### `zkp_stub.py` (The Privacy Shield)
*   **Purpose**: Implements the **Zero-Knowledge Proof** logic.
*   **Key Feature**: Generates **Salted Hash Commitments**. It allows you to prove you have a high reputation score without revealing the exact number to the network.

### `consensus.py` (The Network Agreement)
*   **Purpose**: Decides which node gets to propose the next block.
*   **Key Feature**: Uses **Reputation-Weighted Proposer Selection**. Nodes with higher reputation have a higher probability of being chosen to lead the network.

### `networking.py` (The P2P Layer)
*   **Purpose**: Handles communication between nodes.
*   **Key Feature**: Implements a **Gossip Protocol**. When you vouch for someone, this module "broadcasts" that information to every other node in the peer list.

### `registry.py` (The Three Phases)
*   **Purpose**: Tracks which nodes are in **Phase 1** (Candidate), **Phase 2** (Vouching), **Phase 3** (Probationary), **Phase 4** (Observation), or **Phase 5** (Full Node).

---

## 🏁 3. The Node Lifecycle (5-Phase Progression)
Your node now implements a sophisticated trust-building journey:

1.  **PHASE_1 (Candidate)**: Complete cryptographic tasks to prove basic honesty.
2.  **PHASE_2 (Vouching)**: Get a trusted node to stake tokens on your behalf.
3.  **PHASE_3 (Probationary)**: Vote for **20 rounds**. *Malicious? Voucher loses 100%.*
4.  **UNDER_OBSERVATION**: Vote for another **25 rounds**. *Malicious? Voucher loses 50%.*
5.  **FULL_NODE**: Full graduation. **Stake is automatically returned to the voucher.**

---

## 🌐 4. API: The Communication Layer (`backend/api/`)

These files define the "endpoints" that the Frontend or other Peers use to talk to the node.

*   `routes_vouch.py`: The entry point for the ZKP-secured vouching process.
*   `routes_broadcast.py`: The P2P "listener" that receives transactions and blocks from peers.
*   `routes_node.py`: Provides the data for your Dashboard (Status, Reputation, Peers).
*   `routes_audit.py`: Powers the "Observability" sidebar.

---

## 🎨 4. Frontend: The User Experience (`frontend/`)

*   `index.html`: The main dashboard layout.
*   `audit.html`: The real-time terminal that shows ZKP verification logs.
*   `js/app.js`: The "brain" of the UI. It polls the backend every 2 seconds to update your score and show the ZKP Explorer.
*   `css/style.css`: Modern, "Cyberpunk" aesthetic with glassmorphism and animations.

---

## 🚀 5. How to Demo (The "Vibecoding" Flow)
1.  **Start Nodes**: Run `main.py` on different ports (5000, 5001).
2.  **Observe**: Watch the **Consensus** logs in the Audit Sidebar as blocks are mined.
3.  **Vouch**: Use Node A to vouch for a candidate.
4.  **ZK-Proof**: Open the **Explorer** on Node A to see the commitment, and watch **Node B's sidebar** to see it independently verify the math!

---
*Created for the PoR-Chain Faculty Demonstration.*
