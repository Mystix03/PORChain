/**
 * Browser SHA-256 (hex) for ColdStart Phase-1 HASH_PREIMAGE / VERIFY_HASH tasks.
 */
export async function sha256HexUtf8(text) {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
