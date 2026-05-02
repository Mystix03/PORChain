import asyncio
import sys
import os
import time

sys.path.append(os.path.abspath("backend"))

from backend.modules import registry, identity, consensus, networking, reputation, blockchain, storage

async def main():
    await identity.init()
    node = identity.get()
    node_id = node["node_id"]
    
    await blockchain.init()
    await registry.init()
    await reputation.init()
    
    # We are PHASE_3
    await registry.register(node_id, node["public_key"], phase="PHASE_3")
    
    last_b = await blockchain.last_block()
    
    block = {
        "index": last_b["index"] + 1,
        "timestamp": time.time(),
        "events": [],
        "proposer": "5000_node_id_fake",
        "previous_hash": last_b["hash"],
        "nonce": 0,
    }
    block["hash"] = blockchain._hash_block(block)
    
    # Mock broadcast
    async def mock_broadcast(*args, **kwargs):
        pass
    networking.broadcast = mock_broadcast
    
    # Run
    await consensus.receive_block_proposal(block, "5000_node_id_fake")
    
    print("Reputation:", await reputation.get_score(node_id))
    print("Honest rounds:", (await registry.get_node(node_id)).get("honest_rounds"))

asyncio.run(main())
