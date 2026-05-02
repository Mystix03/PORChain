import asyncio
import sys
import os
sys.path.append(os.path.abspath("backend"))
from backend.modules import registry, identity, consensus, networking, reputation, blockchain

async def main():
    await identity.init()
    node = identity.get()
    node_id = node["node_id"]
    
    await blockchain.init()
    await registry.init()
    await reputation.init()
    
    # Register as PHASE_3
    await registry.register(node_id, node["public_key"], phase="PHASE_3")
    await reputation.set_initial(node_id)
    
    print("Initial rep:", await reputation.get_score(node_id))
    
    # Simulate a block proposal
    block = {
        "index": 999,
        "hash": "abc",
        "previous_hash": "000",
        "proposer": "someone",
        "events": [],
    }
    
    # Mock broadcast
    async def mock_broadcast(*args, **kwargs):
        pass
    networking.broadcast = mock_broadcast
    
    await consensus.receive_block_proposal(block, "someone")
    
    print("Rep after 1 round:", await reputation.get_score(node_id))

asyncio.run(main())
