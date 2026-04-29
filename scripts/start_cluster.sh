#!/usr/bin/env bash
# start_cluster.sh — Start a 3-node cluster automatically

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."

echo "🚀 Starting 3-node POR-Chain Cluster..."

# Ensure any previously running nodes are stopped
pkill -f "python main.py" || true
sleep 1

# Wipe old databases so nodes start perfectly synced from genesis
echo "🧹 Cleaning up old blockchain data..."
rm -rf "$ROOT/backend/data_5000" "$ROOT/backend/data_5001" "$ROOT/backend/data_5002"

# Start Node A (5000)
echo "Starting Node A (Port 5000)..."
gnome-terminal --title="Node A (5000)" -- bash -c "$SCRIPT_DIR/start_node.sh 5000; exec bash"

sleep 2

# Start Node B (5001)
echo "Starting Node B (Port 5001)..."
gnome-terminal --title="Node B (5001)" -- bash -c "$SCRIPT_DIR/start_node.sh 5001 http://127.0.0.1:5000; exec bash"

sleep 2

# Start Node C (5002)
echo "Starting Node C (Port 5002)..."
gnome-terminal --title="Node C (5002)" -- bash -c "$SCRIPT_DIR/start_node.sh 5002 http://127.0.0.1:5000,http://127.0.0.1:5001; exec bash"

echo "✅ Cluster started! All 3 terminals are open."
echo "🌍 Open your browser to:"
echo " - http://127.0.0.1:5000"
echo " - http://127.0.0.1:5001"
echo " - http://127.0.0.1:5002"
