#!/usr/bin/env python3
"""
Snapshot live metrics from a running POR-Chain node (for FYP evaluation / plots).

Usage:
  python scripts/collect_metrics.py
  python scripts/collect_metrics.py --url http://127.0.0.1:5001 --json
"""
from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.request


def _get_json(url: str, timeout: float = 10.0) -> dict:
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode())


def main() -> int:
    parser = argparse.ArgumentParser(description="Collect POR-Chain node metrics")
    parser.add_argument("--url", default="http://127.0.0.1:5000", help="Node base URL")
    parser.add_argument("--json", action="store_true", help="Print single JSON object")
    args = parser.parse_args()
    base = args.url.rstrip("/")

    try:
        t0 = time.perf_counter()
        state = _get_json(f"{base}/node_state")
        latency_ms = (time.perf_counter() - t0) * 1000.0
        chain = _get_json(f"{base}/chain")
    except urllib.error.URLError as e:
        print(f"error: cannot reach {base}: {e}", file=sys.stderr)
        return 1

    row = {
        "latency_node_state_ms": round(latency_ms, 2),
        "chain_height": chain.get("height"),
        "phase": state.get("phase"),
        "reputation_score": state.get("reputation_score"),
        "honest_rounds": state.get("rounds"),
        "peers_count": state.get("peers_count"),
        "eligible_to_propose": state.get("eligible_to_propose"),
        "eligible_to_vouch": state.get("eligible_to_vouch"),
    }

    if args.json:
        print(json.dumps(row, indent=2))
    else:
        for k, v in row.items():
            print(f"{k}: {v}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
