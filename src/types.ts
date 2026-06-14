export interface Hospital {
  id: number;
  name: string;
  longitude: number;
  latitude: number;
  type: string;
  capacity: number;
  berths: number[];
  initial_empty: number;
}

export interface Drone {
  hospital_id: number;
  berth_id: number;
  weight: number;
  max_payload: number;
  battery_max: number;
  speed: number;
}

export interface Task {
  id: number;
  origin: number;
  destination: number;
  weight: number;
}

export interface ProblemConfigData {
  hospitals: Hospital[];
  drones: Drone[];
  tasks: Task[];
}

export interface AssignmentX {
  hospital_id: number;
  berth_id: number;
  task_id: number;
  value: number;
}

export interface AssignmentY {
  hospital_id: number;
  berth_id: number;
  task_id: number;
  dest_hospital_id: number;
  value: number;
}

export interface ValueU {
  hospital_id: number;
  berth_id: number;
  value: number;
}

export interface SolverSolution {
  objective_value: number;
  x_assignments: AssignmentX[];
  y_assignments: AssignmentY[];
  u_values: ValueU[];
  drone_assignments: Record<string, number>;
  total_distance: number;
  energy_consumption: Record<string, number>;
}

export interface AlgorithmStatistics {
  nodes_explored?: number;
  cuts_generated?: number;
  valid_inequalities_added?: number;
  best_objective?: number;
}

export interface SingleResult {
  algorithm: string;
  success: boolean;
  elapsed_seconds: number;
  objective_value: number | null;
  assigned_tasks: number;
  active_drones: number;
  parking_assignments: number;
  idle_drones: number;
  energy_summary: {
    total_energy: number;
    active_total_energy: number;
    max_energy: number;
    avg_energy_all_drones: number;
    avg_energy_active_drones: number;
  };
  algorithm_statistics?: AlgorithmStatistics;
  x_assignment_set: Array<[number, number, number]>;
  y_assignment_set: Array<[number, number, number, number]>;
}

export interface ComparisonReport {
  timestamp: string;
  input: string;
  solver: string;
  timeout: number;
  max_nodes: number;
  results: SingleResult[];
  comparison: {
    objective_gap_abs: number | null;
    objective_gap_pct: number | null;
    same_task_assignment: boolean | null;
    same_parking_assignment: boolean | null;
    x_symmetric_difference: Array<[number, number, number]>;
    y_symmetric_difference: Array<[number, number, number, number]>;
    task_drone_differences: Record<string, Record<string, [number, number]>>;
    task_parking_differences: Record<string, Record<string, [number, number, number]>>;
  };
}
