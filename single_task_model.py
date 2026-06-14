from typing import Dict, Tuple

try:
    import pyomo.environ as pyo
except ImportError:
    pyo = None

from data_structures import ProblemData
from utils import DistanceMatrix, EnergyCalculator


RouteKey = Tuple[int, int, int, int]


class SingleTaskMILPModel:
    """Compact MILP for the current single-task-per-drone setting.

    The model uses one route variable:
        z[i, j, k, d] = 1 if drone (i, j) serves task k and parks at hospital d.

    Infeasible routes are filtered before variables are created:
    - task weight exceeds drone payload
    - three-leg route energy exceeds drone battery
    """

    def __init__(self, problem_data: ProblemData):
        self.problem_data = problem_data
        self.model = pyo.ConcreteModel()
        self.distance_matrix = DistanceMatrix(problem_data.hospitals)
        self.energy_calculator = EnergyCalculator()

        self.route_distance: Dict[RouteKey, float] = {}
        self.route_energy: Dict[RouteKey, float] = {}
        self.feasible_routes: list[RouteKey] = []

    def _build_feasible_routes(self) -> None:
        for drone in self.problem_data.drones:
            i, j = drone.hospital_id, drone.berth_id

            for task in self.problem_data.tasks:
                if task.weight > drone.max_payload:
                    continue

                k = task.id
                first_leg = self.distance_matrix.get_distance(i, task.origin)
                task_leg = self.distance_matrix.get_distance(task.origin, task.destination)

                for hospital in self.problem_data.hospitals:
                    d = hospital.id
                    final_leg = self.distance_matrix.get_distance(task.destination, d)

                    total_energy = self.energy_calculator.calculate_total(
                        drone, task, first_leg, task_leg, final_leg
                    )
                    if total_energy > drone.battery_max * (1 + 1e-9):
                        continue

                    key = (i, j, k, d)
                    self.feasible_routes.append(key)
                    self.route_distance[key] = first_leg + task_leg + final_leg
                    self.route_energy[key] = total_energy

    def build(self) -> pyo.ConcreteModel:
        self._build_feasible_routes()

        drone_keys = [(d.hospital_id, d.berth_id) for d in self.problem_data.drones]
        hospital_ids = [h.id for h in self.problem_data.hospitals]
        task_ids = [t.id for t in self.problem_data.tasks]

        self.model.ROUTES = pyo.Set(initialize=self.feasible_routes, dimen=4)
        self.model.DRONES = pyo.Set(initialize=drone_keys, dimen=2)
        self.model.HOSPITALS = pyo.Set(initialize=hospital_ids)
        self.model.TASKS = pyo.Set(initialize=task_ids)

        self.model.z = pyo.Var(self.model.ROUTES, domain=pyo.Binary, doc="z_ijkd")
        self.model.u = pyo.Var(self.model.DRONES, domain=pyo.Binary, doc="u_ij")

        def task_assignment_rule(m, k):
            routes_for_k = [(i, j, kk, d) for (i, j, kk, d) in m.ROUTES if kk == k]
            if not routes_for_k:
                return pyo.Constraint.Infeasible
            return sum(m.z[key] for key in routes_for_k) == 1

        self.model.task_assignment = pyo.Constraint(
            self.model.TASKS, rule=task_assignment_rule
        )

        def drone_state_rule(m, i, j):
            routes_for_drone = [(ii, jj, k, d) for (ii, jj, k, d) in m.ROUTES if ii == i and jj == j]
            assigned = sum(m.z[key] for key in routes_for_drone)
            return assigned + m.u[i, j] == 1

        self.model.drone_state = pyo.Constraint(self.model.DRONES, rule=drone_state_rule)

        initial_empty = {h.id: h.initial_empty for h in self.problem_data.hospitals}

        def storage_rule(m, h):
            inbound_routes = [(i, j, k, d) for (i, j, k, d) in m.ROUTES if d == h]
            outbound_routes = [(i, j, k, d) for (i, j, k, d) in m.ROUTES if i == h]
            if not inbound_routes and not outbound_routes:
                return pyo.Constraint.Skip
            
            inbound = sum(m.z[key] for key in inbound_routes)
            outbound = sum(m.z[key] for key in outbound_routes)
            return inbound <= initial_empty[h] + outbound

        self.model.storage = pyo.Constraint(self.model.HOSPITALS, rule=storage_rule)

        self.model.obj = pyo.Objective(
            expr=sum(self.route_distance[key] * self.model.z[key] for key in self.feasible_routes),
            sense=pyo.minimize,
        )

        return self.model

    def __repr__(self):
        return (
            f"SingleTaskMILPModel(hospitals={self.problem_data.num_hospitals}, "
            f"drones={self.problem_data.num_drones}, tasks={self.problem_data.num_tasks}, "
            f"routes={len(self.feasible_routes)})"
        )
