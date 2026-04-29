"""
reputation.py — Proof-of-Reputation engine.
Formula: R(t+1) = λ * R(t) + (1 - λ) * h(t)
h(t) = 1.0 (honest) | 0.0 (malicious)

Raw scores NEVER leave this node. Only eligibility booleans are exposed (ZKP-ready).
"""
import config
from modules import storage

_REP_FILE = "reputation.json"


# ── Init ─────────────────────────────────────────────────────────────────────

async def init() -> None:
    existing = await storage.read(_REP_FILE)
    if existing is None:
        await storage.write(_REP_FILE, {})


# ── Core update ───────────────────────────────────────────────────────────────

async def update(node_id: str, honest: bool) -> float:
    """Apply one reputation event for node_id. Returns new score."""
    scores = await storage.read_or_default(_REP_FILE, {})
    r_t = scores.get(node_id, config.INITIAL_REPUTATION)
    h_t = 1.0 if honest else 0.0
    r_next = config.LAMBDA * r_t + (1 - config.LAMBDA) * h_t
    r_next = max(0.0, min(1.0, r_next))  # clamp to [0,1]
    scores[node_id] = r_next
    await storage.write(_REP_FILE, scores)
    return r_next


async def set_initial(node_id: str, value: float = 0.0) -> None:
    """Set a starting reputation for a newly registered node."""
    scores = await storage.read_or_default(_REP_FILE, {})
    if node_id not in scores:
        scores[node_id] = value
        await storage.write(_REP_FILE, scores)


async def get_score(node_id: str) -> float:
    scores = await storage.read_or_default(_REP_FILE, {})
    return scores.get(node_id, config.INITIAL_REPUTATION)


async def get_all() -> dict:
    return await storage.read_or_default(_REP_FILE, {})


# ── ZKP-ready eligibility checks (no raw score exposed) ──────────────────────

async def is_eligible_to_vouch(node_id: str) -> bool:
    return await get_score(node_id) >= config.VOUCH_ELIGIBILITY_THRESHOLD


async def is_full_node_eligible(node_id: str) -> bool:
    return await get_score(node_id) >= config.FULL_NODE_REP_THRESHOLD


async def eligibility_flags(node_id: str) -> dict:
    """
    ZKP-READY: returns only boolean flags — raw score never included.
    Future: replace with ZKP proof.
    """
    score = await get_score(node_id)
    return {
        "eligible_to_vouch": score >= config.VOUCH_ELIGIBILITY_THRESHOLD,
        "eligible_to_propose": score >= config.FULL_NODE_REP_THRESHOLD,
        "eligible_to_vote": score > 0.0,   # Phase 3+
    }
