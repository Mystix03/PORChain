/**
 * wallet_manager.js — Client-side identity and transaction signing.
 * This allows a browser-only user to have their own keys and address.
 *
 * CRITICAL: The `sign()` function must produce output byte-for-byte identical
 * to Python's: json.dumps(data, sort_keys=True, separators=(",", ":"))
 * This means: keys sorted recursively, NO spaces, NO trailing commas.
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
      
      // Raw hex of public key — consistent across ALL devices and browsers.
      // Must match Python's: pub_bytes.hex()
      const address = Array.from(pubBytes).map(b => b.toString(16).padStart(2, '0')).join('');
      
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

  /**
   * Sign a JSON payload deterministically.
   * MUST match Python: identity.sign(identity.canonical(payload))
   * where canonical = json.dumps(data, sort_keys=True, separators=(",", ":"))
   */
  sign(payload) {
    // Use our custom canonical serializer that exactly matches Python's output.
    const canonical = this._canonicalize(payload);
    const msgBytes = new TextEncoder().encode(canonical);
    const privBytes = this._b64ToBuf(this._identity.privateKey);
    const signature = nacl.sign.detached(msgBytes, privBytes);
    return this._bufToB64(signature);
  },

  /**
   * Produces a JSON string that is byte-for-byte identical to Python's:
   *   json.dumps(obj, sort_keys=True, separators=(",", ":"))
   *
   * Rules:
   *   - All object keys are sorted alphabetically (recursively)
   *   - No spaces after ":" or ","
   *   - Strings are double-quoted
   *   - Numbers: integers stay as integers, floats use JS default repr
   *   - null → "null", true → "true", false → "false"
   */
  _canonicalize(obj) {
    if (obj === null) return 'null';
    if (typeof obj === 'boolean') return obj ? 'true' : 'false';
    if (typeof obj === 'number') {
      // Match Python's float repr: integers are emitted without decimal point
      if (Number.isInteger(obj)) return String(obj);
      return String(obj);
    }
    if (typeof obj === 'string') return JSON.stringify(obj); // handles escaping
    if (Array.isArray(obj)) {
      return '[' + obj.map(v => this._canonicalize(v)).join(',') + ']';
    }
    if (typeof obj === 'object') {
      const sortedKeys = Object.keys(obj).sort();
      const pairs = sortedKeys.map(k => JSON.stringify(k) + ':' + this._canonicalize(obj[k]));
      return '{' + pairs.join(',') + '}';
    }
    return JSON.stringify(obj);
  },

  _bufToB64(buf) {
    return btoa(String.fromCharCode.apply(null, buf));
  },

  _b64ToBuf(b64) {
    return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  }
};

// No auto-init here — app.js handles initialization order explicitly.
if (typeof module !== 'undefined') {
  module.exports = WalletManager;
}
