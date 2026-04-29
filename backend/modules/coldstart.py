"""
coldstart.py — 3-Phase ColdStart onboarding state machine.

Phase 1: Probation  — complete N tasks, score P = valid/total >= threshold
Phase 2: Vouching   — high-rep node stakes tokens to vouch
Phase 3: Graduated  — can vote, cannot propose; after M honest rounds → FULL_NODE
"""
import hashlib
import secrets
import time

import config
from modules import storage, identity, reputation, registry, wallet

_TASKS_FILE = "tasks.json"
_VOUCHES_FILE = "vouches.json"


# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 1 — Probation Tasks
# ═══════════════════════════════════════════════════════════════════════════════

TASK_TYPES = ["HASH_PREIMAGE", "SIGN_CHALLENGE", "VERIFY_HASH"]


def _generate_task(task_type: str) -> dict:
    challenge = secrets.token_hex(16)
    expected = None
    if task_type == "HASH_PREIMAGE":
        expected = hashlib.sha256(challenge.encode()).hexdigest()
    elif task_type == "SIGN_CHALLENGE":
        expected = challenge   # node must sign it (verified by signature check)
    elif task_type == "VERIFY_HASH":
        expected = hashlib.sha256(challenge.encode()).hexdigest()
    return {
        "task_id": secrets.token_hex(8),
        "type": task_type,
        "challenge": challenge,
        "expected": expected,
        "created_at": time.time(),
    }


async def assign_tasks(node_id: str) -> list:
    """Assign Phase 1 tasks to a newly joining node."""
    tasks_store = await storage.read_or_default(_TASKS_FILE, {})
    if node_id in tasks_store:
        return tasks_store[node_id]["tasks"]   # idempotent

    tasks = [_generate_task(TASK_TYPES[i % len(TASK_TYPES)])
             for i in range(config.PHASE1_TASK_COUNT)]
    tasks_store[node_id] = {"tasks": tasks, "results": {}}
    await storage.write(_TASKS_FILE, tasks_store)
    # Remove 'expected' before sending to the node (don't reveal answers)
    return [{k: v for k, v in t.items() if k != "expected"} for t in tasks]


def _verify_task_result(task: dict, submission: dict) -> bool:
    """Verify one task submission. Returns True if correct."""
    t = task["type"]
    if t == "HASH_PREIMAGE":
        return submission.get("answer") == task["expected"]
    elif t == "VERIFY_HASH":
        return submission.get("answer") == task["expected"]
    elif t == "SIGN_CHALLENGE":
        # Node must return a valid Ed25519 signature of the challenge
        sig = submission.get("signature", "")
        pubkey = submission.get("public_key", "")
        return identity.verify(task["challenge"], sig, pubkey)
    return False


async def submit_task_results(node_id: str, submissions: list[dict]) -> dict:
    """
    Evaluate submitted task results.
    Returns: {score, passed, phase}
    """
    tasks_store = await storage.read_or_default(_TASKS_FILE, {})
    if node_id not in tasks_store:
        return {"error": "No tasks assigned for this node"}

    tasks = tasks_store[node_id]["tasks"]
    task_map = {t["task_id"]: t for t in tasks}

    valid = 0
    for sub in submissions:
        task = task_map.get(sub.get("task_id"))
        if task and _verify_task_result(task, sub):
            valid += 1

    score = valid / len(tasks) if tasks else 0.0
    passed = score >= config.PHASE1_PASS_THRESHOLD

    if passed:
        await registry.set_phase(node_id, "PHASE_2")
        await reputation.set_initial(node_id, 0.1)  # small starter rep

    tasks_store[node_id]["results"] = {"score": score, "passed": passed}
    await storage.write(_TASKS_FILE, tasks_store)

    return {"score": score, "passed": passed, "phase": "PHASE_2" if passed else "PHASE_1"}


# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 2 — Vouching
# ═══════════════════════════════════════════════════════════════════════════════

async def vouch(voucher_id: str, target_id: str) -> dict:
    """
    Voucher stakes tokens for target node.
    Returns vouch record or error.
    """
    # Check voucher eligibility
    if not await reputation.is_eligible_to_vouch(voucher_id):
        return {"error": "Voucher reputation too low"}

    # Check target is in Phase 2
    phase = await registry.get_phase(target_id)
    if phase != "PHASE_2":
        return {"error": f"Target node is not in Phase 2 (currently {phase})"}

    # Calculate stake
    voucher_score = await reputation.get_score(voucher_id)
    stake_amount = voucher_score * config.VOUCH_DELTA * 100  # scaled to token units

    # Stake from voucher's wallet
    try:
        stake_tx = await wallet.stake(stake_amount, reason=f"VOUCH:{target_id}")
    except ValueError as e:
        return {"error": str(e)}

    # Give new node initial reputation transfer
    r_new = config.VOUCH_ALPHA * voucher_score * config.VOUCH_DELTA
    await reputation.set_initial(target_id, r_new)

    # Record vouch
    vouches = await storage.read_or_default(_VOUCHES_FILE, {})
    vouch_record = {
        "voucher_id": voucher_id,
        "target_id": target_id,
        "stake_amount": stake_amount,
        "stake_tx": stake_tx["tx_id"],
        "rep_granted": r_new,
        "timestamp": time.time(),
        "status": "ACTIVE",
    }
    vouches[target_id] = vouch_record
    await storage.write(_VOUCHES_FILE, vouches)

    # Advance target to Phase 3
    await registry.set_phase(target_id, "PHASE_3")
    await registry.set_voucher(target_id, voucher_id)

    return vouch_record


async def get_vouch_status(node_id: str) -> dict | None:
    vouches = await storage.read_or_default(_VOUCHES_FILE, {})
    return vouches.get(node_id)


# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 3 — Graduated Participation
# ═══════════════════════════════════════════════════════════════════════════════

async def record_honest_round(node_id: str) -> dict:
    """Called after each honest block round. Graduates to FULL_NODE after M rounds."""
    rounds = await registry.increment_honest_rounds(node_id)
    await reputation.update(node_id, honest=True)

    if rounds >= config.PHASE3_HONEST_ROUNDS:
        await registry.set_phase(node_id, "FULL_NODE")
        # Release voucher stake
        vouches = await storage.read_or_default(_VOUCHES_FILE, {})
        vouch = vouches.get(node_id)
        if vouch and vouch["status"] == "ACTIVE":
            try:
                await wallet.unstake(vouch["stake_amount"], reason=f"GRADUATED:{node_id}")
            except Exception:
                pass
            vouches[node_id]["status"] = "RELEASED"
            await storage.write(_VOUCHES_FILE, vouches)
        return {"phase": "FULL_NODE", "rounds": rounds}

    return {"phase": "PHASE_3", "rounds": rounds, "needed": config.PHASE3_HONEST_ROUNDS}


async def penalize_malicious(node_id: str) -> dict:
    """Ban a malicious node and slash its voucher's stake."""
    await registry.set_phase(node_id, "BANNED")
    await reputation.update(node_id, honest=False)

    vouches = await storage.read_or_default(_VOUCHES_FILE, {})
    vouch = vouches.get(node_id)
    result = {"node_id": node_id, "phase": "BANNED"}

    if vouch and vouch["status"] == "ACTIVE":
        try:
            slash_tx = await wallet.slash(vouch["stake_amount"])
            result["slash_tx"] = slash_tx["tx_id"]
        except Exception:
            pass
        vouches[node_id]["status"] = "SLASHED"
        await storage.write(_VOUCHES_FILE, vouches)

        # Also penalize voucher's reputation
        await reputation.update(vouch["voucher_id"], honest=False)

    return result
