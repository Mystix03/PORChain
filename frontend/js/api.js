/**
 * api.js — Typed fetch wrappers for all backend endpoints.
 * BASE_URL auto-detects current host so frontend works on any device.
 */
const BASE_URL = location.origin;

const api = {
  async getNodeState() {
    const r = await fetch(`${BASE_URL}/node_state`);
    return r.json();
  },
  async getPeers() {
    const r = await fetch(`${BASE_URL}/peers`);
    return r.json();
  },
  async addPeer(url) {
    const r = await fetch(`${BASE_URL}/peers/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    return r.json();
  },
  async getChain() {
    const r = await fetch(`${BASE_URL}/chain`);
    return r.json();
  },
  async getBlock(index) {
    const r = await fetch(`${BASE_URL}/chain/block/${index}`);
    return r.json();
  },
  async getAddressBalance(address) {
    const r = await fetch(`${BASE_URL}/wallet/balance?address=${address}`);
    return r.json();
  },
  async getWalletBalance() {
    if (WalletManager._identity?.isNode) {
       const r = await fetch(`${BASE_URL}/wallet/balance`);
       return r.json();
    }
    return this.getAddressBalance(WalletManager.getAddress());
  },
  async getWalletHistory(address) {
    if (WalletManager._identity?.isNode && !address) {
      const r = await fetch(`${BASE_URL}/wallet/history`);
      return r.json();
    }
    const addr = address || WalletManager.getAddress();
    const r = await fetch(`${BASE_URL}/wallet/history?address=${addr}`);
    return r.json();
  },
  async sendTokens(to, amount) {
    // 1. If we are the Local Node Admin, use the server-side signing
    if (WalletManager._identity?.isNode) {
      const r = await fetch(`${BASE_URL}/wallet/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, amount }),
      });
      return r.json();
    }

    // 2. Otherwise, use Browser-Side Signing (Node D)
    const myAddr = WalletManager.getAddress();
    const myPub  = WalletManager.getPublicKey();
    
    const tx = {
      type: "SEND",
      from: myAddr,
      to: to,
      amount: parseFloat(amount),
      timestamp: Date.now() / 1000,
      note: "Web Wallet Transfer",
      tx_id: crypto.randomUUID(),
      sender_pubkey: myPub
    };

    // 2. Sign Transaction in Browser
    tx.signature = WalletManager.sign(tx);

    // 3. Broadcast through the node
    const r = await fetch(`${BASE_URL}/wallet/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tx),
    });
    return r.json();
  },
  async getTasks(nodeId) {
    const url = nodeId ? `${BASE_URL}/task/list?node_id=${nodeId}` : `${BASE_URL}/task/list`;
    const r = await fetch(url);
    return r.json();
  },
  async submitTasks(nodeId, submissions) {
    const r = await fetch(`${BASE_URL}/task/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ node_id: nodeId, submissions }),
    });
    return r.json();
  },
  async getVouchStatus(nodeId) {
    const url = nodeId ? `${BASE_URL}/vouch/status?node_id=${nodeId}` : `${BASE_URL}/vouch/status`;
    const r = await fetch(url);
    return r.json();
  },
  async getEligibleVouchers() {
    const r = await fetch(`${BASE_URL}/vouch/eligible_vouchers`);
    return r.json();
  },
  async submitVouch(targetId) {
    const r = await fetch(`${BASE_URL}/vouch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_id: targetId }),
    });
    return r.json();
  },
};
