import asyncio
import json
import os
import sys

# add backend dir to path
sys.path.append(os.path.abspath("backend"))

from modules import blockchain

async def main():
    with open("backend/data_5000/chain.json") as f:
        peer_chain = json.load(f)
    print("Loaded peer chain length:", len(peer_chain))
    valid = await blockchain.is_valid_chain(peer_chain)
    print("Is valid chain?", valid)

if __name__ == "__main__":
    asyncio.run(main())
