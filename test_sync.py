import asyncio
import os
import sys

# add backend dir to path
sys.path.append(os.path.abspath("backend"))

from modules import consensus, config, storage

async def main():
    config.NODE_PORT = 5004
    os.environ["DATA_DIR"] = os.path.abspath("backend/data_5004")
    
    # Check the current chain
    from modules import blockchain
    chain_before = await blockchain.get_chain()
    print("Length before:", len(chain_before))

    await consensus.sync_chain_from_peers()

    chain_after = await blockchain.get_chain()
    print("Length after:", len(chain_after))

if __name__ == "__main__":
    asyncio.run(main())
