"""routes_tasks.py — ColdStart Phase 1 task endpoints."""
from fastapi import APIRouter, HTTPException
from modules import coldstart, registry, identity

router = APIRouter()


@router.get("/task/list")
async def list_tasks(node_id: str | None = None):
    """
    Get the tasks assigned to a node.
    If no node_id given, uses this node's own ID and assigns if needed.
    """
    if not node_id:
        node_id = identity.get()["node_id"]

    phase = await registry.get_phase(node_id)
    if phase not in ("PHASE_1", "UNKNOWN"):
        return {"message": f"Node is in phase {phase}, no tasks to complete"}

    tasks = await coldstart.assign_tasks(node_id)
    return {"node_id": node_id, "tasks": tasks}


@router.post("/task/submit")
async def submit_tasks(body: dict):
    """
    Submit task results for Phase 1 evaluation.
    Body: { node_id, submissions: [{task_id, answer?, signature?, public_key?}] }
    """
    node_id = body.get("node_id")
    submissions = body.get("submissions", [])
    if not node_id or not submissions:
        raise HTTPException(status_code=400, detail="node_id and submissions required")

    result = await coldstart.submit_task_results(node_id, submissions)
    return result
