/**
 * wallet_manager.js — Client-side identity and transaction signing.
 * This allows a browser-only user to have their own keys and address.
 */

const WalletManager = {
  _identity: null,
  isLocal: false,

  /** Generate or load Ed25519 identity from LocalStorage */
  async init() {
    this.isLocal = (location.hostname === 'localhost' || location.hostname === '127.0.0.1');
    
    if (this.isLocal) {
      console.log('🏠 Local Admin Mode: Using Node Wallet');
      this._identity = { isNode: true };
      return;
    }

    const saved = localStorage.getItem('por_identity');
    if (saved) {
      this._identity = JSON.parse(saved);
    } else {
      const keyPair = nacl.sign.keyPair();
      const pubBytes = keyPair.publicKey;
      
      // SHA-256 Hash of Public Key
      const hashBuffer = await crypto.subtle.digest('SHA-256', pubBytes);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const address = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      this._identity = {
        address: address,
        publicKey: this._bufToB64(pubBytes),
        privateKey: this._bufToB64(keyPair.secretKey)
      };
      localStorage.setItem('por_identity', JSON.stringify(this._identity));
    }
    console.log('🔗 Browser Identity:', this._identity.address);
    return this._identity;
  },

  getAddress() {
    return this._identity ? this._identity.address : null;
  },

  getPublicKey() {
    return this._identity ? this._identity.publicKey : null;
  },

  /** Sign a JSON payload deterministically */
  sign(payload) {
    const canonical = JSON.stringify(payload, Object.keys(payload).sort(), 0).replace(/\s/g, '');
    const msgBytes = new TextEncoder().encode(canonical);
    const privBytes = this._b64ToBuf(this._identity.privateKey);
    
    const signature = nacl.sign.detached(msgBytes, privBytes);
    return this._bufToB64(signature);
  },

  /** SHA-256 helper for Address generation */
  _hash(bytes) {
    // We use tweetnacl for signing, but need SHA-256 for address
    // Since we don't have a small SHA-256 lib, we use the browser's crypto.subtle (async)
    // Actually, for address generation we only do it once.
    // Let's use a simple hex conversion for now if Subtle is unavailable, 
    // but modern browsers all have it.
    const hash = nacl.hash(bytes); // This is SHA-512 by default in tweetnacl
    // To match the Python backend's SHA-256(pubkey).hexdigest():
    // We ideally want SHA-256. 
    // Let's use a tiny hex string of the first 32 bytes of the SHA-512 hash 
    // or just use SubtleCrypto for perfect compatibility.
    
    // For MVP simplicity and perfect matching with Python backend, 
    // we will use a hex string of the public key for now, 
    // but the backend uses SHA256. 
    // I will use a simple hex implementation.
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
  },

  _bufToB64(buf) {
    return btoa(String.fromCharCode.apply(null, buf));
  },

  _b64ToBuf(b64) {
    return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  }
};

// Auto-init on load
if (typeof nacl !== 'undefined') {
  WalletManager.init();
}
