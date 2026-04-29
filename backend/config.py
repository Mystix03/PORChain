"""
config.py — Global node configuration
All tunable parameters live here so they can be overridden via env vars.
"""
import os
import pathlib

# ── Network ──────────────────────────────────────────────────────────────────
NODE_PORT: int = int(os.getenv("NODE_PORT", 5000))
PEERS: list[str] = [p.strip() for p in os.getenv("PEERS", "").split(",") if p.strip()]

# ── Reputation ────────────────────────────────────────────────────────────────
LAMBDA: float = float(os.getenv("LAMBDA", 0.9))
FULL_NODE_REP_THRESHOLD: float = 0.7
VOUCH_ELIGIBILITY_THRESHOLD: float = 0.6
INITIAL_REPUTATION: float = 0.0

# ── ColdStart ─────────────────────────────────────────────────────────────────
PHASE1_TASK_COUNT: int = 5
PHASE1_PASS_THRESHOLD: float = 0.8
PHASE3_HONEST_ROUNDS: int = 10
VOUCH_DELTA: float = 0.1
VOUCH_ALPHA: float = 0.5

# ── Consensus ─────────────────────────────────────────────────────────────────
BLOCK_INTERVAL_SECONDS: int = 5
CONSENSUS_THRESHOLD: float = 0.667

# ── Wallet ────────────────────────────────────────────────────────────────────
GENESIS_BALANCE: float = 100.0

# ── Storage — DATA_DIR env var lets multiple nodes share one codebase ─────────
_default_data = pathlib.Path(__file__).parent / "data"
DATA_DIR: pathlib.Path = pathlib.Path(os.getenv("DATA_DIR", str(_default_data)))
DATA_DIR.mkdir(parents=True, exist_ok=True)

