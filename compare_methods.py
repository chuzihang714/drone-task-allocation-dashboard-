import argparse
import json
import os
import time
from datetime import datetime
from typing import Any, Dict

from main import load_instance_data
from solver import DroneRoutingSolver
from utils import DistanceMatrix, EnergyCalculator


DEFAULT_ALGORITHMS = ("single_task_mip", "branch_and_bound")


def _assignment_set(solution: Dict[str, Any], field: str) -> set[tuple]:
    if field == "x_assignments":
        return {
            (a["hospital_id"], a["berth_id"], a["task_id"])
            for a in solution.get(field, [])
        }
    if field == "y_assignments":
        return {
            (a["hospital_id"], a["berth_id"], a["task_id"], a["dest_hospital_id"])
            for a in solution.get(field, [])
        }
    return set()


def _energy_summary(solution: Dict[str, Any]) -> Dict[str, float]:
    values = [float(v) for v in solution.get("energy_consumption", {}).values()]
    positive_values = [v for v in values if v > 1e-9]

    if not values:
        return {
            "total_energy": 0.0,
            "active_total_energy": 0.0,
            "max_energy": 0.0,
            "avg_energy_all_drones": 0.0,
            "avg_energy_active_drones": 0.0,
        }

    return {
        "total_energy": sum(values),
        "active_total_energy": sum(positive_values),
        "max_energy": max(values),
        "avg_energy_all_drones": sum(values) / len(values),
        "avg_energy_active_drones": (
            sum(positive_values) / len(positive_values) if positive_values else 0.0
        ),
    }


def _recalculate_energy_consumption(problem_data, solution: Dict[str, Any]) -> Dict[str, float]:
    dm = DistanceMatrix(problem_data.hospitals)
    ec = EnergyCalculator()
    energy = {
        f"{drone.hospital_id}_{drone.berth_id}": 0.0
        for drone in problem_data.drones
    }

    parking_by_route = {
        (a["hospital_id"], a["berth_id"], a["task_id"]): a["dest_hospital_id"]
        for a in solution.get("y_assignments", [])
    }

    for assignment in solution.get("x_assignments", []):
        i = assignment["hospital_id"]
        j = assignment["berth_id"]
        k = assignment["task_id"]

        drone = problem_data.get_drone(i, j)
        task = problem_data.get_task(k)
        parking_hospital = parking_by_route.get((i, j, k))
        if drone is None or task is None or parking_hospital is None:
            continue

        origin_dist = dm.get_distance(i, task.origin)
        task_dist = dm.get_distance(task.origin, task.destination)
        dest_dist = dm.get_distance(task.destination, parking_hospital)
        energy[f"{i}_{j}"] = ec.calculate_total(drone, task, origin_dist, task_dist, dest_dist)

    return energy


def _task_to_drone_map(solution: Dict[str, Any]) -> Dict[int, tuple[int, int]]:
    return {
        a["task_id"]: (a["hospital_id"], a["berth_id"])
        for a in solution.get("x_assignments", [])
    }


def _task_to_parking_map(solution: Dict[str, Any]) -> Dict[int, tuple[int, int, int]]:
    return {
        a["task_id"]: (a["hospital_id"], a["berth_id"], a["dest_hospital_id"])
        for a in solution.get("y_assignments", [])
    }


def run_algorithm(input_path: str, algorithm: str, solver_name: str, timeout: int, max_nodes: int) -> Dict[str, Any]:
    problem_data = load_instance_data(input_path)
    solver = DroneRoutingSolver(problem_data)
    solver.set_solver(solver_name)
    solver.set_algorithm(algorithm)

    start = time.perf_counter()
    success = solver.solve(tee=False, timeout=timeout, max_nodes=max_nodes)
    elapsed = time.perf_counter() - start

    solution = solver.get_solution() or {}
    solution["energy_consumption"] = _recalculate_energy_consumption(problem_data, solution)
    x_set = _assignment_set(solution, "x_assignments")
    y_set = _assignment_set(solution, "y_assignments")

    return {
        "algorithm": algorithm,
        "success": success,
        "elapsed_seconds": elapsed,
        "objective_value": solution.get("objective_value"),
        "assigned_tasks": len(solution.get("x_assignments", [])),
        "active_drones": len(x_set),
        "parking_assignments": len(solution.get("y_assignments", [])),
        "idle_drones": len(solution.get("u_values", [])),
        "energy_summary": _energy_summary(solution),
        "algorithm_statistics": solver.get_algorithm_statistics(),
        "x_assignment_set": sorted(x_set),
        "y_assignment_set": sorted(y_set),
        "task_to_drone": _task_to_drone_map(solution),
        "task_to_parking": _task_to_parking_map(solution),
    }


def build_comparison(results: list[Dict[str, Any]]) -> Dict[str, Any]:
    comparison: Dict[str, Any] = {
        "objective_gap_abs": None,
        "objective_gap_pct": None,
        "same_task_assignment": None,
        "same_parking_assignment": None,
        "x_symmetric_difference": [],
        "y_symmetric_difference": [],
        "task_drone_differences": {},
        "task_parking_differences": {},
    }

    if len(results) < 2:
        return comparison

    first, second = results[0], results[1]
    first_obj = first.get("objective_value")
    second_obj = second.get("objective_value")
    if first_obj is not None and second_obj is not None:
        gap = float(second_obj) - float(first_obj)
        comparison["objective_gap_abs"] = gap
        comparison["objective_gap_pct"] = gap / float(first_obj) if abs(float(first_obj)) > 1e-12 else None

    first_x = set(tuple(x) for x in first["x_assignment_set"])
    second_x = set(tuple(x) for x in second["x_assignment_set"])
    first_y = set(tuple(y) for y in first["y_assignment_set"])
    second_y = set(tuple(y) for y in second["y_assignment_set"])

    comparison["same_task_assignment"] = first_x == second_x
    comparison["same_parking_assignment"] = first_y == second_y
    comparison["x_symmetric_difference"] = [list(x) for x in sorted(first_x.symmetric_difference(second_x))]
    comparison["y_symmetric_difference"] = [list(y) for y in sorted(first_y.symmetric_difference(second_y))]

    all_task_ids = sorted(set(first["task_to_drone"]) | set(second["task_to_drone"]))
    for task_id in all_task_ids:
        first_value = first["task_to_drone"].get(task_id)
        second_value = second["task_to_drone"].get(task_id)
        if first_value != second_value:
            comparison["task_drone_differences"][str(task_id)] = {
                first["algorithm"]: first_value,
                second["algorithm"]: second_value,
            }

    all_parking_task_ids = sorted(set(first["task_to_parking"]) | set(second["task_to_parking"]))
    for task_id in all_parking_task_ids:
        first_value = first["task_to_parking"].get(task_id)
        second_value = second["task_to_parking"].get(task_id)
        if first_value != second_value:
            comparison["task_parking_differences"][str(task_id)] = {
                first["algorithm"]: first_value,
                second["algorithm"]: second_value,
            }

    return comparison


def print_report(report: Dict[str, Any]) -> None:
    print("=" * 72)
    print("同实例双算法对比")
    print("=" * 72)
    print(f"输入数据: {report['input']}")
    print(f"求解器: {report['solver']}")
    print()

    for result in report["results"]:
        stats = result.get("algorithm_statistics", {})
        energy = result["energy_summary"]
        print(f"[{result['algorithm']}]")
        print(f"  success: {result['success']}")
        print(f"  objective: {result['objective_value']}")
        print(f"  elapsed_seconds: {result['elapsed_seconds']:.4f}")
        print(f"  assigned_tasks: {result['assigned_tasks']}")
        print(f"  active_drones / idle_drones: {result['active_drones']} / {result['idle_drones']}")
        print(f"  total_energy: {energy['total_energy']:.6f}")
        if stats:
            print(
                "  stats: nodes={nodes}, cuts={cuts}, valid_ineq={valid}".format(
                    nodes=stats.get("nodes_explored", 0),
                    cuts=stats.get("cuts_generated", 0),
                    valid=stats.get("valid_inequalities_added", 0),
                )
            )
        print()

    comparison = report["comparison"]
    print("[comparison]")
    print(f"  objective_gap_abs: {comparison['objective_gap_abs']}")
    print(f"  objective_gap_pct: {comparison['objective_gap_pct']}")
    print(f"  same_task_assignment: {comparison['same_task_assignment']}")
    print(f"  same_parking_assignment: {comparison['same_parking_assignment']}")
    print(f"  x_diff_count: {len(comparison['x_symmetric_difference'])}")
    print(f"  y_diff_count: {len(comparison['y_symmetric_difference'])}")
    print(f"  task_drone_diff_count: {len(comparison['task_drone_differences'])}")
    print(f"  task_parking_diff_count: {len(comparison['task_parking_differences'])}")
    print("=" * 72)


def parse_args():
    parser = argparse.ArgumentParser(
        description="Run the same instance with two algorithms and compare results.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument("--input", "-i", required=True, help="Input JSON instance path.")
    parser.add_argument("--solver", "-s", default="cbc", choices=["cbc", "glpk", "gurobi"])
    parser.add_argument("--timeout", "-t", type=int, default=3600)
    parser.add_argument("--max-nodes", type=int, default=10000)
    parser.add_argument("--output", "-o", default=None, help="Comparison JSON output path.")
    parser.add_argument(
        "--algorithms",
        nargs=2,
        default=DEFAULT_ALGORITHMS,
        help="Two algorithms to compare.",
    )
    return parser.parse_args()


def main():
    args = parse_args()

    results = [
        run_algorithm(args.input, algorithm, args.solver, args.timeout, args.max_nodes)
        for algorithm in args.algorithms
    ]

    report = {
        "timestamp": datetime.now().isoformat(),
        "input": args.input,
        "solver": args.solver,
        "timeout": args.timeout,
        "max_nodes": args.max_nodes,
        "results": results,
        "comparison": build_comparison(results),
    }

    print_report(report)

    output_path = args.output
    if output_path is None:
        input_dir = os.path.dirname(args.input)
        input_name = os.path.basename(args.input).replace(".json", "_comparison.json")
        output_path = os.path.join(input_dir, input_name)

    # Convert sets/tuples for JSON output compatibility
    # Ensure nested elements are converted to standard list or objects
    def sanitize(obj):
        if isinstance(obj, set):
            return list(obj)
        if isinstance(obj, tuple):
            return list(obj)
        if isinstance(obj, dict):
            return {k: sanitize(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [sanitize(x) for x in obj]
        return obj

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(sanitize(report), f, ensure_ascii=False, indent=2)

    print(f"对比结果已保存到: {output_path}")


if __name__ == "__main__":
    main()
