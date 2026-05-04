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
INITIAL_REPUTATION: float = 0.05

# ── ColdStart ─────────────────────────────────────────────────────────────────
PHASE1_TASK_COUNT: int = 5
PHASE1_PASS_THRESHOLD: float = 0.8
PHASE3_ROUNDS: int = 20           # 20 rounds to finish Phase 3
OBSERVATION_ROUNDS: int = 25      # 25 rounds in Under Observation
PHASE3_HONEST_ROUNDS: int = 45    # Total (20 + 25)
VOUCHES_REQUIRED: int = 2
VOUCH_DELTA: float = 0.1
VOUCH_ALPHA: float = 0.5

# ── Consensus ─────────────────────────────────────────────────────────────────
BLOCK_INTERVAL_SECONDS: int = 5
CONSENSUS_THRESHOLD: float = 0.667

# ── Wallet ────────────────────────────────────────────────────────────────────
GENESIS_BALANCE: float = 100.0

# ── Storage — Unified Absolute Paths ──────────────────────────────────────────
# Find the absolute path to the 'backend' directory
_BACKEND_DIR = pathlib.Path(__file__).parent.resolve()
_DEFAULT_DATA = _BACKEND_DIR / "data"

# Ensure we use an absolute path for DATA_DIR
_env_data = os.getenv("DATA_DIR")
if _env_data:
    DATA_DIR = pathlib.Path(_env_data).resolve()
else:
    DATA_DIR = _DEFAULT_DATA

DATA_DIR.mkdir(parents=True, exist_ok=True)

