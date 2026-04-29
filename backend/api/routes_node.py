"""routes_node.py — /node_state and /peers endpoints."""
from fastapi import APIRouter
from modules import identity, registry, reputation, blockchain, networking, wallet

router = APIRouter()


@router.get("/node_state")
async def node_state():
    node = identity.get()
    node_id = node["node_id"]
    phase = await registry.get_phase(node_id)
    flags = await reputation.eligibility_flags(node_id)
    chain = await blockchain.get_chain()
    peers = await networking.load_peers()
    bal = await wallet.balance()

    return {
        "node_id": node_id,
        "public_key": node["public_key"],
        "phase": phase,
        **flags,
        "peers_count": len(peers),
        "chain_height": len(chain),
        "wallet": bal,
    }


@router.get("/peers")
async def get_peers():
    peers = await networking.load_peers()
    status = await networking.check_peers()
    return {
        "peers": [{"url": p, "status": status.get(p, "unknown")} for p in peers]
    }


@router.post("/peers/add")
async def add_peer(body: dict):
    url = body.get("url")
    if not url:
        return {"error": "url required"}
    await networking.add_peer(url)
    return {"added": url}
