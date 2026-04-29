# 🛡️ POR-Chain: Proof-of-Reputation Blockchain

POR-Chain is a decentralized, stateless blockchain architecture built on the principles of **Proof-of-Reputation (PoR)**. It features cryptographically-verified transactions, BFT-style consensus, and a unique reputation-based proposer selection mechanism.

## 🚀 Key Features

*   **Cryptographic Security:** Every transaction is signed using Ed25519 (Digital Signatures) and verified against the sender's public key.
*   **BFT Consensus:** 2/3 majority voting for block finalization, ensuring a fork-proof network.
*   **Reputation Engine:** Nodes gain reputation for honest participation, increasing their probability of being selected as block proposers.
*   **Multi-User Web Wallet:** Built-in dashboard with browser-side key generation—anyone with a link can join as a unique user.
*   **Magic Join:** Automated peer discovery using local port scanning (ports 5000-5010).
*   **Stateless Architecture:** Balances and history are derived dynamically by replaying the blockchain.

---

## 🛠️ Installation & Setup

### 1. Prerequisites
*   Python 3.10+
*   `virtualenv`

### 2. Initialize
```bash
chmod +x scripts/*.sh
```

### 3. Start Local Cluster
Run a pre-configured 3-node network (Nodes A, B, and C):
```bash
./scripts/start_cluster.sh
```

### 4. Access the Dashboard
Open your browser and navigate to:
*   Node A: `http://localhost:5000`
*   Node B: `http://localhost:5001`
*   Node C: `http://localhost:5002`

---

## 🌍 Global Networking (Join your Friends)

POR-Chain is ready for public internet testing using **ngrok**.

### 1. Start a Guest Gateway
Start a 4th node dedicated to your friends:
```bash
./scripts/start_node.sh 5003
```

### 2. Expose to Internet
```bash
ngrok http 5003
```

### 3. Sharing
Give the `https://...ngrok-free.app` URL to your friend. When they open it, their browser will automatically generate a **Node D** identity and sync with your local network.

---

## 📂 Project Structure

*   `backend/main.py`: Application entry point.
*   `backend/modules/blockchain.py`: Chain logic & state derivation.
*   `backend/modules/consensus.py`: BFT Voting & Proposer selection.
*   `backend/modules/identity.py`: Ed25519 Cryptography.
*   `backend/modules/reputation.py`: Reputation scoring engine.
*   `frontend/`: Premium Glassmorphic Dashboard (HTML/JS).

---

## 🛡️ Security Model

POR-Chain implements **Self-Verifying Addresses**. A Node ID is the SHA-256 hash of the node's Public Key. This allows the network to verify any transaction without a central registry, as the signature itself proves ownership of the address.

## 📜 License
MIT License.
