#!/usr/bin/env bash
# start_node.sh — Launch a POR-Chain node
# Usage:   ./scripts/start_node.sh [PORT] [PEER_URLS_COMMA_SEPARATED]
# Example: ./scripts/start_node.sh 5001 "http://localhost:5000"
# Multi:   ./scripts/start_node.sh 5002 "http://localhost:5000,http://localhost:5001"

set -e

PORT="${1:-5000}"
PEERS="${2:-}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."
BACKEND="$ROOT/backend"
VENV="$ROOT/.venv"

echo "╔══════════════════════════════════════════════╗"
echo "║        POR-Chain Node Starting Up            ║"
echo "╠══════════════════════════════════════════════╣"
echo "║  Port  : $PORT"
echo "║  Peers : ${PEERS:-none}"
echo "╚══════════════════════════════════════════════╝"

# ── Virtual environment ────────────────────────────────────────────────────
if [ ! -f "$VENV/bin/python" ]; then
  echo "📦 Creating virtual environment..."
  python3 -m virtualenv "$VENV"
fi

source "$VENV/bin/activate"

# ── Install dependencies ───────────────────────────────────────────────────
echo "📦 Checking dependencies..."
pip install -q -r "$BACKEND/requirements.txt"

# ── Per-port data directory ────────────────────────────────────────────────
DATA_DIR="$ROOT/backend/data_$PORT"
mkdir -p "$DATA_DIR"

echo "📁 Data dir : $DATA_DIR"
echo "🚀 Starting node on port $PORT..."

# ── Launch ─────────────────────────────────────────────────────────────────
export NODE_PORT="$PORT"
export PEERS="$PEERS"
export DATA_DIR="$DATA_DIR"
export PYTHONPATH="$BACKEND"

cd "$BACKEND"
python main.py
