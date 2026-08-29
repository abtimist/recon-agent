from typing import Dict, Any

class PlanEntitlement:
    def __init__(self, max_runs: int, can_explain: bool, max_batch_size: int):
        self.max_runs = max_runs
        self.can_explain = can_explain
        self.max_batch_size = max_batch_size

PLANS: Dict[str, PlanEntitlement] = {
    "free": PlanEntitlement(
        max_runs=10,
        can_explain=False,
        max_batch_size=10
    ),
    "pro": PlanEntitlement(
        max_runs=500,
        can_explain=True,
        max_batch_size=100
    ),
    "enterprise": PlanEntitlement(
        max_runs=10000,
        can_explain=True,
        max_batch_size=1000
    )
}

def get_entitlement(plan_name: str) -> PlanEntitlement:
    """Returns the entitlement for the given plan, defaulting to free."""
    if not plan_name:
        plan_name = "free"
    return PLANS.get(plan_name.lower(), PLANS["free"])
