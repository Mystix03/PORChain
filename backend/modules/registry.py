"""
registry.py — Node registry: tracks all known nodes, their phases, and public keys.
"""
from modules import storage

_REG_FILE = "registry.json"

PHASES = ["UNKNOWN", "PHASE_1", "PHASE_2", "PHASE_3", "FULL_NODE", "BANNED"]


async def init() -> None:
    existing = await storage.read(_REG_FILE)
    if existing is None:
        await storage.write(_REG_FILE, {})


async def register(node_id: str, public_key: str, phase: str = "PHASE_1") -> None:
    reg = await storage.read_or_default(_REG_FILE, {})
    if node_id not in reg:
        reg[node_id] = {
            "node_id": node_id,
            "public_key": public_key,
            "phase": phase,
            "honest_rounds": 0,
            "voucher": None,
        }
        await storage.write(_REG_FILE, reg)


async def get_node(node_id: str) -> dict | None:
    reg = await storage.read_or_default(_REG_FILE, {})
    return reg.get(node_id)


async def set_phase(node_id: str, phase: str) -> None:
    reg = await storage.read_or_default(_REG_FILE, {})
    if node_id in reg:
        reg[node_id]["phase"] = phase
        await storage.write(_REG_FILE, reg)


async def get_phase(node_id: str) -> str:
    node = await get_node(node_id)
    return node["phase"] if node else "UNKNOWN"


async def increment_honest_rounds(node_id: str) -> int:
    reg = await storage.read_or_default(_REG_FILE, {})
    if node_id in reg:
        reg[node_id]["honest_rounds"] = reg[node_id].get("honest_rounds", 0) + 1
        await storage.write(_REG_FILE, reg)
        return reg[node_id]["honest_rounds"]
    return 0


async def set_voucher(node_id: str, voucher_id: str) -> None:
    reg = await storage.read_or_default(_REG_FILE, {})
    if node_id in reg:
        reg[node_id]["voucher"] = voucher_id
        await storage.write(_REG_FILE, reg)


async def all_nodes() -> dict:
    return await storage.read_or_default(_REG_FILE, {})


async def full_nodes() -> list:
    reg = await storage.read_or_default(_REG_FILE, {})
    return [n for n in reg.values() if n["phase"] == "FULL_NODE"]
