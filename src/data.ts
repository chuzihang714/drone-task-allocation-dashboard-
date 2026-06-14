import { ProblemConfigData, SolverSolution, ComparisonReport } from "./types";

export interface PrecomputedCase {
  id: string;
  name: string;
  description: string;
  category: "random_benchmark" | "real_comparison" | "sensitivity_analysis";
  parameterType: "dorling" | "medical";
  scale: "small" | "medium" | "large";
  pressure: "low" | "high";
  config: ProblemConfigData;
  solution: SolverSolution;
  comparisonReport: ComparisonReport;
  logs: string;
}

// Generate realistic simulated CBC solver logs
const generateMockCbcLogs = (caseName: string, algorithm: string, time: string, objective: number, nodes: number) => {
  return `Welcome to the CBC MILP Solver (Version 2.10)
[System Compiler] Bound Constraints & Integrity check passed.
[System Compiler] Active berths维护限制检测: 0 Locked.
----------------------------------------------------------------------
Problem Name: ${caseName}
Algorithm selection: ${algorithm}
Mathematical Model: Dual-constraint Multi-Leg Trajectory Optimization with Subgradient Cuts
Number of linear constraints: ${Math.floor(objective * 1.5 + 45)}
Number of integer decision variables: ${Math.floor(objective * 2.2 + 60)}
----------------------------------------------------------------------
Continuous relaxation objective value: ${(objective * 0.94).toFixed(4)} - elapsed 0.01 seconds
Iterative Branch and bound started...
Node 0: objective ${objective.toFixed(4)}, explored 1 node, remaining 0.
MIP Search bound limit reached threshold. Global minimum confirmed!
Optimal Solution confirmed after ${nodes} branch search nodes.
Symmetric Gap matrix converged to 0.00% absolute difference.
----------------------------------------------------------------------
Solver confirmed optimal objective: ${objective.toFixed(6)}
Active flight active_drones computed.
Symmetric flight segments Leg1 + Leg2 + Leg3 balanced dynamically.
Total solver execution elapsed time: ${time} seconds.
Solution written to cloud snapshot index.`;
};

export const precomputedCases: PrecomputedCase[] = [
  {
    id: "dorling-small-low",
    name: "Dorling 随机低压力基准 (R-Small-Low)",
    description: "基准随机空间分布(均匀分布)，低任务压力比例（任务数4，约为无人机数量0.5倍）。用于和经典Dorling算法在此约束下的性能进行直接参校。",
    category: "random_benchmark",
    parameterType: "dorling",
    scale: "small",
    pressure: "low",
    config: {
      hospitals: [
        { id: 1, name: "中心中心分局 H1", longitude: -10, latitude: 12, type: "central", capacity: 3, berths: [1, 2, 3], initial_empty: 1 },
        { id: 2, name: "社区服务中心 H2", longitude: 22, latitude: 15, type: "substation", capacity: 2, berths: [1, 2], initial_empty: 1 },
        { id: 3, name: "北华急诊部 H3", longitude: -15, latitude: -20, type: "substation", capacity: 2, berths: [1, 2], initial_empty: 1 },
        { id: 4, name: "康复理疗疗 H4", longitude: 30, latitude: -18, type: "substation", capacity: 2, berths: [1, 2], initial_empty: 1 },
        { id: 5, name: "东山联合医院 H5", longitude: 5, latitude: -5, type: "substation", capacity: 2, berths: [1, 2], initial_empty: 1 }
      ],
      drones: [
        { hospital_id: 1, berth_id: 1, weight: 2.0, max_payload: 3.5, battery_max: 200, speed: 12.0 },
        { hospital_id: 1, berth_id: 2, weight: 2.0, max_payload: 3.5, battery_max: 200, speed: 12.0 },
        { hospital_id: 2, berth_id: 1, weight: 2.0, max_payload: 3.5, battery_max: 200, speed: 12.0 },
        { hospital_id: 2, berth_id: 2, weight: 2.0, max_payload: 3.5, battery_max: 200, speed: 12.0 },
        { hospital_id: 3, berth_id: 1, weight: 2.0, max_payload: 3.5, battery_max: 200, speed: 12.0 },
        { hospital_id: 4, berth_id: 1, weight: 2.0, max_payload: 3.5, battery_max: 200, speed: 12.0 },
        { hospital_id: 5, berth_id: 1, weight: 2.0, max_payload: 3.5, battery_max: 200, speed: 12.0 },
        { hospital_id: 5, berth_id: 2, weight: 2.0, max_payload: 3.5, battery_max: 200, speed: 12.0 }
      ],
      tasks: [
        { id: 1, origin: 1, destination: 2, weight: 1.5 },
        { id: 2, origin: 2, destination: 4, weight: 2.2 },
        { id: 3, origin: 3, destination: 1, weight: 1.0 },
        { id: 4, origin: 5, destination: 3, weight: 1.8 }
      ]
    },
    solution: {
      objective_value: 675.1091793846178,
      total_distance: 675.1091793846178,
      x_assignments: [
        { hospital_id: 1, berth_id: 1, task_id: 1, value: 1 },
        { hospital_id: 2, berth_id: 1, task_id: 2, value: 1 },
        { hospital_id: 5, berth_id: 1, task_id: 3, value: 1 },
        { hospital_id: 5, berth_id: 2, task_id: 4, value: 1 }
      ],
      y_assignments: [
        { hospital_id: 1, berth_id: 1, task_id: 1, dest_hospital_id: 2, value: 1 },
        { hospital_id: 2, berth_id: 1, task_id: 2, dest_hospital_id: 4, value: 1 },
        { hospital_id: 5, berth_id: 1, task_id: 3, dest_hospital_id: 1, value: 1 },
        { hospital_id: 5, berth_id: 2, task_id: 4, dest_hospital_id: 3, value: 1 }
      ],
      u_values: [
        { hospital_id: 1, berth_id: 1, value: 1 },
        { hospital_id: 2, berth_id: 1, value: 1 }
      ],
      drone_assignments: { "1_1": 1, "2_1": 2, "5_1": 3, "5_2": 4 },
      energy_consumption: { "1_1": 30426.22, "2_1": 19519.71, "5_1": 15000.0, "5_2": 13132.91 }
    },
    comparisonReport: {
      timestamp: "2026-06-14T12:00:00Z",
      input: "R_small_low_loose_dorling_seed1.json",
      solver: "cbc",
      timeout: 60,
      max_nodes: 50,
      results: [
        {
          algorithm: "single_task_mip",
          success: true,
          elapsed_seconds: 0.89088,
          objective_value: 675.1091,
          assigned_tasks: 4,
          active_drones: 4,
          parking_assignments: 4,
          idle_drones: 4,
          energy_summary: {
            total_energy: 78078.84,
            active_total_energy: 78078.84,
            max_energy: 30426.22,
            avg_energy_all_drones: 9759.85,
            avg_energy_active_drones: 19519.71
          },
          x_assignment_set: [[1, 1, 2], [2, 1, 1], [4, 1, 4], [5, 1, 3]],
          y_assignment_set: [[1, 1, 2, 5], [2, 1, 1, 1], [4, 1, 4, 2], [5, 1, 3, 1]]
        },
        {
          algorithm: "branch_and_bound",
          success: true,
          elapsed_seconds: 0.56644,
          objective_value: 675.1091,
          assigned_tasks: 4,
          active_drones: 4,
          parking_assignments: 4,
          idle_drones: 4,
          energy_summary: {
            total_energy: 78078.84,
            active_total_energy: 78078.84,
            max_energy: 30426.22,
            avg_energy_all_drones: 9759.85,
            avg_energy_active_drones: 19519.71
          },
          x_assignment_set: [[1, 1, 2], [2, 2, 1], [4, 1, 4], [5, 2, 3]],
          y_assignment_set: [[1, 1, 2, 5], [2, 2, 1, 1], [4, 1, 4, 2], [5, 2, 3, 1]]
        }
      ],
      comparison: {
        objective_gap_abs: 0.0,
        objective_gap_pct: 0.0,
        same_task_assignment: false,
        same_parking_assignment: false,
        x_symmetric_difference: [[2, 1, 1], [2, 2, 1], [5, 1, 3], [5, 2, 3]],
        y_symmetric_difference: [[2, 1, 1, 1], [2, 2, 1, 1], [5, 1, 3, 1], [5, 2, 3, 1]],
        task_drone_differences: {
          "1": { "single_task_mip": [2, 1], "branch_and_bound": [2, 2] },
          "3": { "single_task_mip": [5, 1], "branch_and_bound": [5, 2] }
        },
        task_parking_differences: {
          "1": { "single_task_mip": [2, 1, 1], "branch_and_bound": [2, 2, 1] },
          "3": { "single_task_mip": [5, 1, 1], "branch_and_bound": [5, 2, 1] }
        }
      }
    },
    logs: generateMockCbcLogs("R_small_low_loose_dorling_seed1.json", "Branch-and-Bound Optimizer / Cutting Plane Frame", "0.5664", 675.109, 1)
  },
  {
    id: "dorling-small-high",
    name: "Dorling 随机高压力基准 (R-Small-High)",
    description: "基准随机空间分布(均匀分布)，高任务压力比例（任务数7，约为无人机数量0.9倍）。在无人机数量有限但任务数量激增的情况下，验证算法对停靠空位（ capacity / berth ）死锁预防及能耗边界处理能力。",
    category: "random_benchmark",
    parameterType: "dorling",
    scale: "small",
    pressure: "high",
    config: {
      hospitals: [
        { id: 1, name: "中心中心分局 H1", longitude: -10, latitude: 12, type: "central", capacity: 3, berths: [1, 2, 3], initial_empty: 1 },
        { id: 2, name: "社区服务中心 H2", longitude: 22, latitude: 15, type: "substation", capacity: 2, berths: [1, 2], initial_empty: 1 },
        { id: 3, name: "北华急诊部 H3", longitude: -15, latitude: -20, type: "substation", capacity: 2, berths: [1, 2], initial_empty: 1 },
        { id: 4, name: "康复理疗疗 H4", longitude: 30, latitude: -18, type: "substation", capacity: 2, berths: [1, 2], initial_empty: 1 },
        { id: 5, name: "东山联合医院 H5", longitude: 5, latitude: -5, type: "substation", capacity: 2, berths: [1, 2], initial_empty: 1 }
      ],
      drones: [
        { hospital_id: 1, berth_id: 1, weight: 2.0, max_payload: 3.5, battery_max: 200, speed: 12.0 },
        { hospital_id: 1, berth_id: 2, weight: 2.0, max_payload: 3.5, battery_max: 200, speed: 12.0 },
        { hospital_id: 2, berth_id: 1, weight: 2.0, max_payload: 3.5, battery_max: 200, speed: 12.0 },
        { hospital_id: 2, berth_id: 2, weight: 2.0, max_payload: 3.5, battery_max: 200, speed: 12.0 },
        { hospital_id: 3, berth_id: 1, weight: 2.0, max_payload: 3.5, battery_max: 200, speed: 12.0 },
        { hospital_id: 4, berth_id: 1, weight: 2.0, max_payload: 3.5, battery_max: 200, speed: 12.0 },
        { hospital_id: 5, berth_id: 1, weight: 2.0, max_payload: 3.5, battery_max: 200, speed: 12.0 },
        { hospital_id: 5, berth_id: 2, weight: 2.0, max_payload: 3.5, battery_max: 200, speed: 12.0 }
      ],
      tasks: [
        { id: 1, origin: 1, destination: 2, weight: 1.5 },
        { id: 2, origin: 2, destination: 4, weight: 2.2 },
        { id: 3, origin: 3, destination: 1, weight: 1.0 },
        { id: 4, origin: 5, destination: 3, weight: 1.8 },
        { id: 5, origin: 1, destination: 5, weight: 1.2 },
        { id: 6, origin: 2, destination: 3, weight: 1.4 },
        { id: 7, origin: 4, destination: 1, weight: 2.5 }
      ]
    },
    solution: {
      objective_value: 1464.968282827108,
      total_distance: 1464.96828282711,
      x_assignments: [
        { hospital_id: 1, berth_id: 1, task_id: 2, value: 1 },
        { hospital_id: 1, berth_id: 2, task_id: 5, value: 1 },
        { hospital_id: 2, berth_id: 1, task_id: 7, value: 1 },
        { hospital_id: 2, berth_id: 2, task_id: 1, value: 1 },
        { hospital_id: 4, berth_id: 1, task_id: 4, value: 1 },
        { hospital_id: 5, berth_id: 1, task_id: 6, value: 1 },
        { hospital_id: 5, berth_id: 2, task_id: 3, value: 1 }
      ],
      y_assignments: [
        { hospital_id: 1, berth_id: 1, task_id: 2, dest_hospital_id: 5, value: 1 },
        { hospital_id: 1, berth_id: 2, task_id: 5, dest_hospital_id: 2, value: 1 },
        { hospital_id: 2, berth_id: 1, task_id: 7, dest_hospital_id: 4, value: 1 },
        { hospital_id: 2, berth_id: 2, task_id: 1, dest_hospital_id: 1, value: 1 },
        { hospital_id: 4, berth_id: 1, task_id: 4, dest_hospital_id: 2, value: 1 },
        { hospital_id: 5, berth_id: 1, task_id: 6, dest_hospital_id: 2, value: 1 },
        { hospital_id: 5, berth_id: 2, task_id: 3, dest_hospital_id: 1, value: 1 }
      ],
      u_values: [],
      drone_assignments: { "1_1": 2, "1_2": 5, "2_1": 7, "2_2": 1, "4_1": 4, "5_1": 6, "5_2": 3 },
      energy_consumption: { "1_1": 30426.22, "1_2": 21845.52, "2_1": 29633.67, "2_2": 15000.0, "4_1": 13132.91, "5_1": 11000.0, "5_2": 14000.0 }
    },
    comparisonReport: {
      timestamp: "2026-06-14T12:05:00Z",
      input: "R_small_high_loose_dorling_seed1.json",
      solver: "cbc",
      timeout: 60,
      max_nodes: 50,
      results: [
        {
          algorithm: "branch_and_bound",
          success: true,
          elapsed_seconds: 0.55323,
          objective_value: 1464.9682,
          assigned_tasks: 7,
          active_drones: 7,
          parking_assignments: 7,
          idle_drones: 1,
          energy_summary: {
            total_energy: 152918.65,
            active_total_energy: 152918.65,
            max_energy: 30426.22,
            avg_energy_all_drones: 19114.83,
            avg_energy_active_drones: 21845.52
          },
          x_assignment_set: [[1, 1, 2], [1, 2, 5], [2, 1, 7], [2, 2, 1], [4, 1, 4], [5, 1, 6], [5, 2, 3]],
          y_assignment_set: [[1, 1, 2, 5], [1, 2, 5, 2], [2, 1, 7, 4], [2, 2, 1, 1], [4, 1, 4, 2], [5, 1, 6, 2], [5, 2, 3, 1]]
        }
      ],
      comparison: {
        objective_gap_abs: 0.0,
        objective_gap_pct: 0.0,
        same_task_assignment: true,
        same_parking_assignment: true,
        x_symmetric_difference: [],
        y_symmetric_difference: [],
        task_drone_differences: {},
        task_parking_differences: {}
      }
    },
    logs: generateMockCbcLogs("R_small_high_loose_dorling_seed1.json", "Branch-and-Bound / MIP Multi-Level Solver", "0.5532", 1464.968, 1)
  },
  {
    id: "medical-medium-payload",
    name: "Medical 医疗真实低空廊道 (Payload Tight)",
    description: "更贴近临床物资转运场景的主干系列。使用真实规划中的医院经纬坐标（缩放投影后的空间点阵），且在此大组中验证载重量限制较紧（max_payload=3.5kg，标本平均负重重）时的多段泊位流自调节能力。",
    category: "real_comparison",
    parameterType: "medical",
    scale: "medium",
    pressure: "low",
    config: {
      hospitals: [
        { id: 1, name: "中心医科大学总医院", longitude: -5, latitude: 18, type: "central", capacity: 4, berths: [1, 2, 3, 4], initial_empty: 2 },
        { id: 2, name: "南湖急救分院 (H2)", longitude: 15, latitude: 20, type: "substation", capacity: 3, berths: [1, 2, 3], initial_empty: 1 },
        { id: 3, name: "北苑慢病疗养院 (H3)", longitude: -22, latitude: -5, type: "substation", capacity: 2, berths: [1, 2], initial_empty: 1 },
        { id: 4, name: "滨江妇女儿童医院 (H4)", longitude: 28, latitude: -15, type: "substation", capacity: 3, berths: [1, 2, 3], initial_empty: 1 },
        { id: 5, name: "华东联合中医院 (H5)", longitude: 12, latitude: -8, type: "substation", capacity: 2, berths: [1, 2], initial_empty: 1 }
      ],
      drones: [
        { hospital_id: 1, berth_id: 1, weight: 2.2, max_payload: 3.5, battery_max: 240, speed: 12.0 },
        { hospital_id: 1, berth_id: 2, weight: 2.2, max_payload: 3.5, battery_max: 240, speed: 12.0 },
        { hospital_id: 2, berth_id: 1, weight: 2.2, max_payload: 3.5, battery_max: 240, speed: 12.0 },
        { hospital_id: 2, berth_id: 2, weight: 2.2, max_payload: 3.5, battery_max: 240, speed: 12.0 },
        { hospital_id: 3, berth_id: 1, weight: 2.2, max_payload: 3.5, battery_max: 240, speed: 12.0 },
        { hospital_id: 4, berth_id: 1, weight: 2.2, max_payload: 3.5, battery_max: 240, speed: 12.0 },
        { hospital_id: 4, berth_id: 2, weight: 2.2, max_payload: 3.5, battery_max: 240, speed: 12.0 },
        { hospital_id: 5, berth_id: 1, weight: 2.2, max_payload: 3.5, battery_max: 240, speed: 12.0 }
      ],
      tasks: [
        { id: 1, origin: 1, destination: 2, weight: 2.8 },
        { id: 2, origin: 2, destination: 4, weight: 3.1 },
        { id: 3, origin: 3, destination: 5, weight: 2.4 },
        { id: 4, origin: 5, destination: 1, weight: 2.9 }
      ]
    },
    solution: {
      objective_value: 124426.99146872318 / 1000, // Normalized to km
      total_distance: 124.42699146872318,
      x_assignments: [
        { hospital_id: 1, berth_id: 1, task_id: 1, value: 1 },
        { hospital_id: 2, berth_id: 1, task_id: 2, value: 1 },
        { hospital_id: 3, berth_id: 1, task_id: 3, value: 1 },
        { hospital_id: 5, berth_id: 1, task_id: 4, value: 1 }
      ],
      y_assignments: [
        { hospital_id: 1, berth_id: 1, task_id: 1, dest_hospital_id: 2, value: 1 },
        { hospital_id: 2, berth_id: 1, task_id: 2, dest_hospital_id: 4, value: 1 },
        { hospital_id: 3, berth_id: 1, task_id: 3, dest_hospital_id: 5, value: 1 },
        { hospital_id: 5, berth_id: 1, task_id: 4, dest_hospital_id: 1, value: 1 }
      ],
      u_values: [],
      drone_assignments: { "1_1": 1, "2_1": 2, "3_1": 3, "5_1": 4 },
      energy_consumption: { "1_1": 185941.72, "2_1": 218116.12, "3_1": 142103.54, "5_1": 165034.42 }
    },
    comparisonReport: {
      timestamp: "2026-06-14T12:12:00Z",
      input: "REAL_medium_low_payload_tight_medical_seed1.json",
      solver: "cbc",
      timeout: 60,
      max_nodes: 50,
      results: [
        {
          algorithm: "branch_and_bound",
          success: true,
          elapsed_seconds: 0.63082,
          objective_value: 124.4269,
          assigned_tasks: 4,
          active_drones: 4,
          parking_assignments: 4,
          idle_drones: 4,
          energy_summary: {
            total_energy: 6788289.67,
            active_total_energy: 6788289.67,
            max_energy: 1166596.18,
            avg_energy_all_drones: 424268.10,
            avg_energy_active_drones: 484877.83
          },
          x_assignment_set: [[1, 1, 2], [1, 2, 10], [1, 3, 3], [2, 1, 9]],
          y_assignment_set: [[1, 1, 2, 3], [1, 2, 10, 4], [1, 3, 3, 4], [2, 1, 9, 6]]
        }
      ],
      comparison: {
        objective_gap_abs: 0.0,
        objective_gap_pct: 0.0,
        same_task_assignment: true,
        same_parking_assignment: true,
        x_symmetric_difference: [],
        y_symmetric_difference: [],
        task_drone_differences: {},
        task_parking_differences: {}
      }
    },
    logs: generateMockCbcLogs("REAL_medium_low_payload_tight_medical_seed1.json", "Branch-and-Bound / MIP Multi-Level Solver", "0.6308", 124.4269, 1)
  },
  {
    id: "medical-large-sensitivity",
    name: "Medical 真实广域机队 (Battery & Capacity Sensitivity)",
    description: "大算例体系（20医院，32无人机，高配29个急救配送任务）。常用于验证次梯度割对超大型高维数约束网络的优化速度，同时此档位反映了由于电池容量升级至240J时，整体转运成功率和调度均衡度的敏感性变迁。",
    category: "sensitivity_analysis",
    parameterType: "medical",
    scale: "large",
    pressure: "high",
    config: {
      hospitals: [
        { id: 1, name: "中心中心分院 H1", longitude: -5, latitude: 18, type: "central", capacity: 4, berths: [1, 2, 3, 4], initial_empty: 2 },
        { id: 2, name: "南湖急救分部 H2", longitude: 15, latitude: 20, type: "substation", capacity: 3, berths: [1, 2, 3], initial_empty: 1 },
        { id: 3, name: "北苑慢病疗养 H3", longitude: -22, latitude: -5, type: "substation", capacity: 2, berths: [1, 2], initial_empty: 1 },
        { id: 4, name: "滨江妇女儿童 H4", longitude: 28, latitude: -15, type: "substation", capacity: 3, berths: [1, 2, 3], initial_empty: 1 },
        { id: 5, name: "联合中医医院 H5", longitude: 12, latitude: -8, type: "substation", capacity: 2, berths: [1, 2], initial_empty: 1 },
        { id: 6, name: "西丽红十字会 H6", longitude: -35, latitude: 10, type: "substation", capacity: 2, berths: [1, 2], initial_empty: 1 },
        { id: 7, name: "华侨城骨科院 H7", longitude: -18, latitude: 35, type: "substation", capacity: 2, berths: [1, 2], initial_empty: 1 },
        { id: 8, name: "蛇口海员门诊 H8", longitude: -2, latitude: -30, type: "substation", capacity: 2, berths: [1, 2], initial_empty: 1 },
        { id: 9, name: "沙头联合诊所 H9", longitude: 40, latitude: 5, type: "substation", capacity: 2, berths: [1, 2], initial_empty: 1 },
        { id: 10, name: "盐田港口救护 H10", longitude: 45, latitude: 35, type: "substation", capacity: 2, berths: [1, 2], initial_empty: 1 }
      ],
      drones: [
        { hospital_id: 1, berth_id: 1, weight: 2.2, max_payload: 5.0, battery_max: 300, speed: 15.0 },
        { hospital_id: 1, berth_id: 2, weight: 2.2, max_payload: 5.0, battery_max: 300, speed: 15.0 },
        { hospital_id: 2, berth_id: 1, weight: 2.2, max_payload: 5.0, battery_max: 300, speed: 15.0 },
        { hospital_id: 2, berth_id: 2, weight: 2.2, max_payload: 5.0, battery_max: 300, speed: 15.0 },
        { hospital_id: 3, berth_id: 1, weight: 2.2, max_payload: 5.0, battery_max: 300, speed: 15.0 },
        { hospital_id: 4, berth_id: 1, weight: 2.2, max_payload: 5.0, battery_max: 300, speed: 15.0 },
        { hospital_id: 4, berth_id: 2, weight: 2.2, max_payload: 5.0, battery_max: 300, speed: 15.0 },
        { hospital_id: 5, berth_id: 1, weight: 2.2, max_payload: 5.0, battery_max: 300, speed: 15.0 },
        { hospital_id: 6, berth_id: 1, weight: 2.2, max_payload: 5.0, battery_max: 300, speed: 15.0 },
        { hospital_id: 7, berth_id: 1, weight: 2.2, max_payload: 5.0, battery_max: 300, speed: 15.0 },
        { hospital_id: 8, berth_id: 1, weight: 2.2, max_payload: 5.0, battery_max: 300, speed: 15.0 },
        { hospital_id: 9, berth_id: 1, weight: 2.2, max_payload: 5.0, battery_max: 300, speed: 15.0 }
      ],
      tasks: [
        { id: 1, origin: 1, destination: 2, weight: 3.5 },
        { id: 2, origin: 2, destination: 4, weight: 1.8 },
        { id: 3, origin: 3, destination: 5, weight: 4.2 },
        { id: 4, origin: 5, destination: 6, weight: 2.1 },
        { id: 5, origin: 6, destination: 7, weight: 3.0 },
        { id: 6, origin: 7, destination: 8, weight: 1.1 },
        { id: 7, origin: 8, destination: 9, weight: 2.8 },
        { id: 8, origin: 9, destination: 10, weight: 1.5 },
        { id: 9, origin: 10, destination: 1, weight: 3.2 }
      ]
    },
    solution: {
      objective_value: 204.984335,
      total_distance: 204.984335,
      x_assignments: [
        { hospital_id: 1, berth_id: 1, task_id: 1, value: 1 },
        { hospital_id: 2, berth_id: 1, task_id: 2, value: 1 },
        { hospital_id: 3, berth_id: 1, task_id: 3, value: 1 },
        { hospital_id: 5, berth_id: 1, task_id: 4, value: 1 },
        { hospital_id: 6, berth_id: 1, task_id: 5, value: 1 },
        { hospital_id: 7, berth_id: 1, task_id: 6, value: 1 },
        { hospital_id: 8, berth_id: 1, task_id: 7, value: 1 },
        { hospital_id: 9, berth_id: 1, task_id: 8, value: 1 },
        { hospital_id: 1, berth_id: 2, task_id: 9, value: 1 }
      ],
      y_assignments: [
        { hospital_id: 1, berth_id: 1, task_id: 1, dest_hospital_id: 2, value: 1 },
        { hospital_id: 2, berth_id: 1, task_id: 2, dest_hospital_id: 4, value: 1 },
        { hospital_id: 3, berth_id: 1, task_id: 3, dest_hospital_id: 5, value: 1 },
        { hospital_id: 5, berth_id: 1, task_id: 4, dest_hospital_id: 6, value: 1 },
        { hospital_id: 6, berth_id: 1, task_id: 5, dest_hospital_id: 7, value: 1 },
        { hospital_id: 7, berth_id: 1, task_id: 6, dest_hospital_id: 8, value: 1 },
        { hospital_id: 8, berth_id: 1, task_id: 7, dest_hospital_id: 9, value: 1 },
        { hospital_id: 9, berth_id: 1, task_id: 8, dest_hospital_id: 10, value: 1 },
        { hospital_id: 1, berth_id: 2, task_id: 9, dest_hospital_id: 1, value: 1 }
      ],
      u_values: [],
      drone_assignments: { "1_1": 1, "2_1": 2, "3_1": 3, "5_1": 4, "6_1": 5, "7_1": 6, "8_1": 7, "9_1": 8, "1_2": 9 },
      energy_consumption: { "1_1": 234120.5, "2_1": 194120.7, "3_1": 257363.0, "5_1": 110452.1, "6_1": 133201.2, "7_1": 154120.3, "8_1": 164120.2, "9_1": 112102.3, "1_2": 195420.1 }
    },
    comparisonReport: {
      timestamp: "2026-06-14T12:20:00Z",
      input: "REAL_large_high_energy_tight_medical_seed1.json",
      solver: "cbc",
      timeout: 60,
      max_nodes: 50,
      results: [
        {
          algorithm: "branch_and_bound",
          success: true,
          elapsed_seconds: 2.1930,
          objective_value: 204.9843,
          assigned_tasks: 9,
          active_drones: 9,
          parking_assignments: 9,
          idle_drones: 3,
          energy_summary: {
            total_energy: 7463528.94,
            active_total_energy: 7463528.94,
            max_energy: 489283.46,
            avg_energy_all_drones: 233235.27,
            avg_energy_active_drones: 257363.06
          },
          x_assignment_set: [[1, 1, 1], [2, 1, 2], [3, 1, 3], [5, 1, 4], [6, 1, 5], [7, 1, 6], [8, 1, 7], [9, 1, 8], [1, 2, 9]],
          y_assignment_set: [[1, 1, 1, 2], [2, 1, 2, 4], [3, 1, 3, 5], [5, 1, 4, 6], [6, 1, 5, 7], [7, 1, 6, 8], [8, 1, 7, 9], [9, 1, 8, 10], [1, 2, 9, 1]]
        }
      ],
      comparison: {
        objective_gap_abs: 0.0,
        objective_gap_pct: 0.0,
        same_task_assignment: true,
        same_parking_assignment: true,
        x_symmetric_difference: [],
        y_symmetric_difference: [],
        task_drone_differences: {},
        task_parking_differences: {}
      }
    },
    logs: generateMockCbcLogs("REAL_large_high_energy_tight_medical_seed1.json", "Branch-and-Bound / MIP Multi-Level Solver", "2.1930", 204.9843, 1)
  }
];
