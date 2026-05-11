#!/usr/bin/env python3
"""
Automated two-node ColdStart-PoR demo recorder.

Starts:
 - voucher node on :5100
 - candidate node on :5101

Then executes:
 1) candidate completes Phase 1 tasks
 2) voucher vouches candidate (Phase 2 -> Phase 3)
 3) candidate casts 3 manual votes

Artifacts:
 - demos/two-node-demo-report.md
 - demos/two-node-demo-report.json
"""

from __future__ import annotations

import hashlib
import json
import os
import shutil
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import URLError
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
DEMO_DIR = ROOT / "demos"
DATA_ROOT = ROOT / "backend" / "demo-data"
VOUCHER_PORT = 5100
CANDIDATE_PORT = 5101
VOUCHER_URL = f"http://127.0.0.1:{VOUCHER_PORT}"
CANDIDATE_URL = f"http://127.0.0.1:{CANDIDATE_PORT}"


def http_json(method: str, url: str, payload: dict | None = None, timeout: float = 10.0):
    body = None
    headers = {"Accept": "application/json"}
    if payload is not None:
        body = json.dumps(payload).encode()
        headers["Content-Type"] = "application/json"
    req = Request(url=url, data=body, headers=headers, method=method)
    with urlopen(req, timeout=timeout) as resp:
        raw = resp.read().decode()
        return json.loads(raw) if raw else {}


def wait_ready(base_url: str, max_seconds: int = 40):
    start = time.time()
    while time.time() - start < max_seconds:
        try:
            http_json("GET", f"{base_url}/node_state", timeout=2.5)
            return True
        except Exception:
            time.sleep(0.5)
    return False


def wait_for_phase(base_url: str, phase: str, max_seconds: int = 45):
    start = time.time()
    while time.time() - start < max_seconds:
        try:
            st = http_json("GET", f"{base_url}/node_state", timeout=3.0)
            if st.get("phase") == phase:
                return st
        except Exception:
            pass
        time.sleep(1.0)
    return None


def mk_submission(task: dict):
    t = task.get("type")
    challenge = str(task.get("challenge", ""))
    if t in ("HASH_PREIMAGE", "VERIFY_HASH"):
        answer = hashlib.sha256(challenge.encode()).hexdigest()
        return {"task_id": task["task_id"], "answer": answer}
    if t == "SIGN_CHALLENGE":
        return {"task_id": task["task_id"], "signature": "AUTO_SIGN", "public_key": "AUTO_SIGN"}
    raise ValueError(f"Unknown task type {t}")


def main() -> int:
    DEMO_DIR.mkdir(parents=True, exist_ok=True)
    if DATA_ROOT.exists():
        shutil.rmtree(DATA_ROOT)
    (DATA_ROOT / "voucher").mkdir(parents=True, exist_ok=True)
    (DATA_ROOT / "candidate").mkdir(parents=True, exist_ok=True)

    py = sys.executable
    env_base = os.environ.copy()

    env_v = env_base.copy()
    env_v["NODE_PORT"] = str(VOUCHER_PORT)
    env_v["PEERS"] = CANDIDATE_URL
    env_v["DATA_DIR"] = str((DATA_ROOT / "voucher").resolve())

    env_c = env_base.copy()
    env_c["NODE_PORT"] = str(CANDIDATE_PORT)
    env_c["PEERS"] = VOUCHER_URL
    env_c["DATA_DIR"] = str((DATA_ROOT / "candidate").resolve())

    voucher = subprocess.Popen(
        [py, "-m", "uvicorn", "backend.main:app", "--host", "127.0.0.1", "--port", str(VOUCHER_PORT)],
        cwd=str(ROOT),
        env=env_v,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    candidate = subprocess.Popen(
        [py, "-m", "uvicorn", "backend.main:app", "--host", "127.0.0.1", "--port", str(CANDIDATE_PORT)],
        cwd=str(ROOT),
        env=env_c,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    report: dict = {
        "started_at_utc": datetime.now(timezone.utc).isoformat(),
        "nodes": {"voucher": VOUCHER_URL, "candidate": CANDIDATE_URL},
        "steps": [],
    }

    try:
        if not wait_ready(VOUCHER_URL) or not wait_ready(CANDIDATE_URL):
            raise RuntimeError("Node startup timeout")

        v0 = http_json("GET", f"{VOUCHER_URL}/node_state")
        c0 = http_json("GET", f"{CANDIDATE_URL}/node_state")
        report["steps"].append({"name": "startup", "voucher": v0, "candidate": c0})

        # Phase 1
        task_data = http_json("GET", f"{CANDIDATE_URL}/task/list")
        tasks = task_data.get("tasks", [])
        for t in tasks:
            sub = mk_submission(t)
            http_json("POST", f"{CANDIDATE_URL}/task/submit", {"node_id": c0["node_id"], "submissions": [sub]})

        c1 = wait_for_phase(CANDIDATE_URL, "PHASE_2", max_seconds=35)
        report["steps"].append({"name": "phase1_complete", "candidate": c1})
        if not c1:
            raise RuntimeError("Candidate did not reach PHASE_2")

        # Vouch
        http_json("POST", f"{VOUCHER_URL}/vouch", {"target_id": c0["node_id"]})
        c2 = wait_for_phase(CANDIDATE_URL, "PHASE_3", max_seconds=40)
        report["steps"].append({"name": "vouch_complete", "candidate": c2})
        if not c2:
            raise RuntimeError("Candidate did not reach PHASE_3")

        # Votes
        vote_states = []
        for _ in range(3):
            vr = http_json("POST", f"{CANDIDATE_URL}/simulate/vote", {})
            st = http_json("GET", f"{CANDIDATE_URL}/node_state")
            vote_states.append({"vote_result": vr, "node_state": st})
            time.sleep(0.5)
        report["steps"].append({"name": "votes_cast", "states": vote_states})

        vf = http_json("GET", f"{VOUCHER_URL}/node_state")
        cf = http_json("GET", f"{CANDIDATE_URL}/node_state")
        report["final"] = {"voucher": vf, "candidate": cf}
        report["status"] = "ok"
    except Exception as e:
        report["status"] = "error"
        report["error"] = str(e)
    finally:
        for p in (candidate, voucher):
            if p.poll() is None:
                p.terminate()
                try:
                    p.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    p.kill()

    report["ended_at_utc"] = datetime.now(timezone.utc).isoformat()

    json_path = DEMO_DIR / "two-node-demo-report.json"
    md_path = DEMO_DIR / "two-node-demo-report.md"
    json_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    lines = [
        "# Two-Node Demo Report",
        "",
        f"- Status: **{report.get('status','unknown')}**",
        f"- Started: `{report.get('started_at_utc','')}`",
        f"- Ended: `{report.get('ended_at_utc','')}`",
        "",
        "## Final Snapshot",
        "",
        "```json",
        json.dumps(report.get("final", {}), indent=2),
        "```",
        "",
        "## Steps",
        "",
        "```json",
        json.dumps(report.get("steps", []), indent=2),
        "```",
    ]
    md_path.write_text("\n".join(lines), encoding="utf-8")

    return 0 if report.get("status") == "ok" else 1


if __name__ == "__main__":
    raise SystemExit(main())

