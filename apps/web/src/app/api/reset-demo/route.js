/** Dev-only: long-press logo reset in Ascent UI (no backend state reset yet). */
export async function POST() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
