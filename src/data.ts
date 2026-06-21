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

// Sparkle simulated CBC solver logs
const generateMockCbcLogs = (caseName: string, algorithm: string, time: string, objective: number, nodes: number) => {
  return `CBC MIP SOLVER ENGINE (v2.10.5)
----------------------------------------------------------------------
[Compiler Node] Verification of dual constraints succeeded.
[Compiler Node] active_berths maintenance verification: 0 locks.
[Optimization Target] Minimize global multi-segment transport distance
Number of continuous rows (constraints): ${Math.floor(objective * 1.5 + 40)}
Number of columns (decision vars): ${Math.floor(objective * 2.1 + 55)}
----------------------------------------------------------------------
Leg 1 segment (Empty dispatch link): 0.5 coef weight
Leg 2 segment (Heavy cargo flying link): 1.0 coef weight
Leg 3 segment (Return recovery parking link): 0.3 coef weight
----------------------------------------------------------------------
Relaxed objective value: ${(objective * 0.95).toFixed(4)} - elapsed 0.012 sec
Node 0: objective ${objective.toFixed(4)}, explored 1 node, remaining 0.
MIP search threshold convergence achieved (Gap = 0.00%).
----------------------------------------------------------------------
Solver confirmed global optimal objective: ${objective.toFixed(6)}
Active delivery drones: ${Math.floor(objective / 10) || 6} units.
Symmetric segments balanced successfully.
Optimization total elapsed time: ${time} seconds.
Solution written to memory bank buffers.`;
};

// Main Static List of 42 real hospitals from Jiading District, Shanghai
export const JIADING_HOSPITALS = [
  { id: 1, name: "上海交通大学医学院附属瑞金医院(嘉定院区)", address: "希望路999号", longitude: 121.258919, latitude: 31.335468, type: "central", capacity: 4, berths: [1, 2, 3, 4], initial_empty: 2 },
  { id: 2, name: "上海嘉定妇幼保健院", address: "高台路1216号", longitude: 121.246742, latitude: 31.349836, type: "substation", capacity: 3, berths: [1, 2, 3], initial_empty: 1 },
  { id: 3, name: "嘉定区中医医院", address: "博乐路222号", longitude: 121.250802, latitude: 31.387566, type: "central", capacity: 3, berths: [1, 2, 3], initial_empty: 1 },
  { id: 4, name: "嘉定区中心医院", address: "城北路1号", longitude: 121.239427, latitude: 31.387563, type: "central", capacity: 4, berths: [1, 2, 3, 4], initial_empty: 2 },
  { id: 5, name: "上海协爱泽安中医医院", address: "城中路2号三幢", longitude: 121.252358, latitude: 31.373656, type: "substation", capacity: 2, berths: [1, 2], initial_empty: 1 },
  { id: 6, name: "上海中医药大学协爱泽安中医医院", address: "城中路2号", longitude: 121.252386, latitude: 31.373637, type: "substation", capacity: 2, berths: [1, 2], initial_empty: 1 },
  { id: 7, name: "海军军医大学第三附属医院(嘉定院区)", address: "墨玉北路700号", longitude: 121.162369, latitude: 31.322368, type: "central", capacity: 4, berths: [1, 2, 3, 4], initial_empty: 2 },
  { id: 8, name: "上海嘉华医院", address: "清河路450号", longitude: 121.234083, latitude: 31.37692, type: "substation", capacity: 2, berths: [1, 2], initial_empty: 1 },
  { id: 9, name: "上海欣安医院", address: "宝安公路4539号", longitude: 121.216343, latitude: 31.315601, type: "substation", capacity: 3, berths: [1, 2, 3], initial_empty: 1 },
  { id: 10, name: "上海交通大学医学院附属瑞金医院(北部院区)2期", address: "希望路与永盛路交叉口", longitude: 121.259699, latitude: 31.335738, type: "central", capacity: 3, berths: [1, 2, 3], initial_empty: 1 },
  { id: 11, name: "嘉定镇街道社区卫生服务中心", address: "北大街128号", longitude: 121.24848, latitude: 31.387404, type: "substation", capacity: 2, berths: [1, 2], initial_empty: 1 },
  { id: 12, name: "安亭社区卫生服务中心方泰分中心", address: "嘉松北路4008号", longitude: 121.21237, latitude: 31.323438, type: "substation", capacity: 2, berths: [1, 2], initial_empty: 1 },
  { id: 13, name: "菊园新区社区卫生服务中心", address: "平城路785号", longitude: 121.249951, latitude: 31.397804, type: "substation", capacity: 2, berths: [1, 2], initial_empty: 1 },
  { id: 14, name: "菊园新区社区卫生服务中心城北分中心", address: "红石路336号", longitude: 121.230036, latitude: 31.379595, type: "substation", capacity: 2, berths: [1, 2], initial_empty: 1 },
  { id: 15, name: "嘉定区中医医院新院区", address: "永新路800号", longitude: 121.263028, latitude: 31.407972, type: "central", capacity: 3, berths: [1, 2, 3], initial_empty: 1 },
  { id: 16, name: "嘉定区外冈镇社区卫生服务中心", address: "祁昌路355号", longitude: 121.170585, latitude: 31.364658, type: "substation", capacity: 2, berths: [1, 2], initial_empty: 1 },
  { id: 17, name: "嘉定工业区社区卫生服务中心朱桥", address: "嘉朱公路1650号", longitude: 121.196491, latitude: 31.408061, type: "substation", capacity: 2, berths: [1, 2], initial_empty: 1 },
  { id: 18, name: "上海嘉华医院•结石科", address: "清河路450号", longitude: 121.234377, latitude: 31.376955, type: "substation", capacity: 2, berths: [1, 2], initial_empty: 1 },
  { id: 19, name: "工业区社区卫生服务中心南中心", address: "富蕴路", longitude: 121.248836, latitude: 31.367894, type: "substation", capacity: 2, berths: [1, 2], initial_empty: 1 },
  { id: 20, name: "嘉定工业区社区卫生服务中心", address: "嘉安公路与胜辛路交叉口", longitude: 121.233812, latitude: 31.36803, type: "substation", capacity: 2, berths: [1, 2], initial_empty: 1 },
  { id: 21, name: "嘉定工业区社区卫生服务中心娄塘分中心", address: "娄朱公路", longitude: 121.214069, latitude: 31.425886, type: "substation", capacity: 2, berths: [1, 2], initial_empty: 1 },
  { id: 22, name: "马陆镇社区卫生服务中心白银社区卫生服务站", address: "崇信路1531号", longitude: 121.239797, latitude: 31.345971, type: "substation", capacity: 2, berths: [1, 2], initial_empty: 1 },
  { id: 23, name: "马陆镇社区卫生服务中心远香舫社区卫生服务站", address: "洪德路158号", longitude: 121.262487, latitude: 31.358679, type: "substation", capacity: 2, berths: [1, 2], initial_empty: 1 },
  { id: 24, name: "嘉定区中医医院急诊", address: "博乐路222号", longitude: 121.2511, latitude: 31.387178, type: "substation", capacity: 2, berths: [1, 2], initial_empty: 1 },
  { id: 25, name: "桃园社区卫生服务站", address: "方南路401弄121号", longitude: 121.218483, latitude: 31.309465, type: "substation", capacity: 2, berths: [1, 2], initial_empty: 1 },
  { id: 26, name: "嘉定区中医医院中医师承基地", address: "嘉定南大街3-1号", longitude: 121.254839, latitude: 31.376203, type: "substation", capacity: 2, berths: [1, 2], initial_empty: 1 },
  { id: 27, name: "葛隆社区卫生服务站", address: "葛隆村690号", longitude: 121.154723, latitude: 31.391509, type: "substation", capacity: 2, berths: [1, 2], initial_empty: 1 },
  { id: 28, name: "嘉定区中医医院杏林楼", address: "博乐路222号", longitude: 121.250252, latitude: 31.38721, type: "substation", capacity: 2, berths: [1, 2], initial_empty: 1 },
  { id: 29, name: "外冈社区卫生服务站", address: "春及路86号", longitude: 121.177417, latitude: 31.360889, type: "substation", capacity: 2, berths: [1, 2], initial_empty: 1 },
  { id: 30, name: "新区社区卫生服务中心", address: "胜悦嘉苑东苑", longitude: 121.226158, latitude: 31.371986, type: "substation", capacity: 2, berths: [1, 2], initial_empty: 1 },
  { id: 31, name: "大陆社区卫生服务站", address: "大陆村村委会", longitude: 121.190296, latitude: 31.371488, type: "substation", capacity: 2, berths: [1, 2], initial_empty: 1 },
  { id: 32, name: "嘉定区中医医院住院部", address: "博乐路222号", longitude: 121.25078, latitude: 31.387856, type: "substation", capacity: 2, berths: [1, 2], initial_empty: 1 },
  { id: 33, name: "小囡桥社区卫生服务站", address: "塔城路432号", longitude: 121.247154, latitude: 31.379289, type: "substation", capacity: 2, berths: [1, 2], initial_empty: 1 },
  { id: 34, name: "嘉定镇街道社区卫生服务中心分中心", address: "东大小区西1门", longitude: 121.254956, latitude: 31.388616, type: "substation", capacity: 2, berths: [1, 2], initial_empty: 1 },
  { id: 35, name: "上海市嘉定区嘉定镇街道医院", address: "嘉定北大街", longitude: 121.248889, latitude: 31.387501, type: "substation", capacity: 2, berths: [1, 2], initial_empty: 1 },
  { id: 36, name: "六里新家园卫生服务站", address: "嘉安公路1735弄558号", longitude: 121.214897, latitude: 31.34796, type: "substation", capacity: 2, berths: [1, 2], initial_empty: 1 },
  { id: 37, name: "胜辛社区卫生服务站", address: "嘉安公路与普惠路交叉口", longitude: 121.233723, latitude: 31.368163, type: "substation", capacity: 2, berths: [1, 2], initial_empty: 1 },
  { id: 38, name: "霍城路社区卫生服务站", address: "霍城路1777弄1827号", longitude: 121.213711, latitude: 31.385189, type: "substation", capacity: 2, berths: [1, 2], initial_empty: 1 },
  { id: 39, name: "天华社区卫生服务站", address: "汇善路海伦小区", longitude: 121.203219, latitude: 31.406329, type: "substation", capacity: 2, berths: [1, 2], initial_empty: 1 },
  { id: 40, name: "铁桥社区卫生服务站", address: "嘉定梅园路与清河路交叉口", longitude: 121.242275, latitude: 31.382675, type: "substation", capacity: 2, berths: [1, 2], initial_empty: 1 },
  { id: 41, name: "六里村邻里中心卫生服务点", address: "嘉安公路1735弄558号", longitude: 121.214897, latitude: 31.34796, type: "substation", capacity: 2, berths: [1, 2], initial_empty: 1 },
  { id: 42, name: "人民社区卫生服务站", address: "菊园新区管委会", longitude: 121.205117, latitude: 31.379712, type: "substation", capacity: 2, berths: [1, 2], initial_empty: 1 }
];

export const precomputedCases: PrecomputedCase[] = [
  {
    id: "jiading-low-pressure",
    name: "上海嘉定区急救网常态低空廊道 (Jiading Low-Pressure Model)",
    description: "上海市嘉定区常态化临床物资空运廊道模型。基于本区的瑞金医院院区、妇幼保健院、中医医院、中心医院等8个骨干中继航站点进行多段泊位的流式自平衡和次梯度规划求解。任务负荷处于日常低压态势，航线抗干扰性好。",
    category: "real_comparison",
    parameterType: "medical",
    scale: "small",
    pressure: "low",
    config: {
      hospitals: [
        JIADING_HOSPITALS[0], // H1:瑞金
        JIADING_HOSPITALS[1], // H2:妇幼
        JIADING_HOSPITALS[2], // H3:中医
        JIADING_HOSPITALS[3], // H4:中心
        JIADING_HOSPITALS[4], // H5:协爱泽安
        JIADING_HOSPITALS[6], // H7:海医三附院
        JIADING_HOSPITALS[7], // H8:嘉华
        JIADING_HOSPITALS[9]  // H10:瑞金北2期
      ],
      drones: [
        { hospital_id: 1, berth_id: 1, weight: 2.2, max_payload: 3.5, battery_max: 240, speed: 12.0 },
        { hospital_id: 1, berth_id: 2, weight: 2.2, max_payload: 3.5, battery_max: 240, speed: 12.0 },
        { hospital_id: 3, berth_id: 1, weight: 2.2, max_payload: 3.5, battery_max: 240, speed: 15.0 },
        { hospital_id: 4, berth_id: 1, weight: 2.2, max_payload: 3.5, battery_max: 240, speed: 12.0 },
        { hospital_id: 7, berth_id: 1, weight: 2.2, max_payload: 3.5, battery_max: 240, speed: 12.0 },
        { hospital_id: 10, berth_id: 1, weight: 2.2, max_payload: 3.5, battery_max: 240, speed: 12.0 }
      ],
      tasks: [
        { id: 1, origin: 1, destination: 2, weight: 1.5 },
        { id: 2, origin: 3, destination: 4, weight: 2.1 },
        { id: 3, origin: 7, destination: 10, weight: 1.8 },
        { id: 4, origin: 4, destination: 8, weight: 2.5 }
      ]
    },
    solution: {
      objective_value: 45.328,
      total_distance: 45.328,
      x_assignments: [
        { hospital_id: 1, berth_id: 1, task_id: 1, value: 1 },
        { hospital_id: 3, berth_id: 1, task_id: 2, value: 1 },
        { hospital_id: 7, berth_id: 1, task_id: 3, value: 1 },
        { hospital_id: 4, berth_id: 1, task_id: 4, value: 1 }
      ],
      y_assignments: [
        { hospital_id: 1, berth_id: 1, task_id: 1, dest_hospital_id: 2, value: 1 },
        { hospital_id: 3, berth_id: 1, task_id: 2, dest_hospital_id: 4, value: 1 },
        { hospital_id: 7, berth_id: 1, task_id: 3, dest_hospital_id: 10, value: 1 },
        { hospital_id: 4, berth_id: 1, task_id: 4, dest_hospital_id: 8, value: 1 }
      ],
      u_values: [],
      drone_assignments: { "1_1": 1, "3_1": 2, "7_1": 3, "4_1": 4 },
      energy_consumption: { "1_1": 12400.0, "3_1": 15400.0, "7_1": 11800.0, "4_1": 16100.0 }
    },
    comparisonReport: {
      timestamp: "2026-06-21T08:00:00Z",
      input: "JIADING_LOW_PRESSURE.json",
      solver: "cbc",
      timeout: 60,
      max_nodes: 50,
      results: [
        {
          algorithm: "branch_and_bound",
          success: true,
          elapsed_seconds: 0.125,
          objective_value: 45.328,
          assigned_tasks: 4,
          active_drones: 4,
          parking_assignments: 4,
          idle_drones: 2,
          energy_summary: {
            total_energy: 55700.0,
            active_total_energy: 55700.0,
            max_energy: 16100.0,
            avg_energy_all_drones: 9283.3,
            avg_energy_active_drones: 13925.0
          },
          x_assignment_set: [[1, 1, 1], [3, 1, 2], [7, 1, 3], [4, 1, 4]],
          y_assignment_set: [[1, 1, 1, 2], [3, 1, 2, 4], [7, 1, 3, 10], [4, 1, 4, 8]]
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
    logs: generateMockCbcLogs("JIADING_LOW_PRESSURE.json", "Branch-and-Bound / MIP Multi-Level Solver", "0.125", 45.328, 1)
  },
  {
    id: "jiading-peak-emergency",
    name: "上海嘉定区多点广域高峰应急重调 (Jiading Peak Emergency Model)",
    description: "上海市嘉定区在面对多处急危重症特情或极端天气时的算力重调模型。高密度覆盖15家主要转运及配送站点（首批12台长续航无人机备飞，以及8单呼吸器、高加急冷链血胞包等临床特快任务），能耗和信道匹配逼近极限饱和状态，用于验证次梯度割的压差平衡能效。",
    category: "real_comparison",
    parameterType: "medical",
    scale: "large",
    pressure: "high",
    config: {
      hospitals: [
        JIADING_HOSPITALS[0], // H1: 瑞金
        JIADING_HOSPITALS[1], // H2: 妇幼
        JIADING_HOSPITALS[2], // H3: 中医
        JIADING_HOSPITALS[3], // H4: 中心
        JIADING_HOSPITALS[4], // H5: 协爱泽安
        JIADING_HOSPITALS[6], // H7: 海医三附院
        JIADING_HOSPITALS[7], // H8: 嘉华
        JIADING_HOSPITALS[8], // H9: 欣安
        JIADING_HOSPITALS[9], // H10: 瑞金北2期
        JIADING_HOSPITALS[10], // H11: 嘉定镇中心
        JIADING_HOSPITALS[11], // H12: 安亭方泰
        JIADING_HOSPITALS[12], // H13: 菊园
        JIADING_HOSPITALS[13], // H14: 城北分
        JIADING_HOSPITALS[14], // H15: 中医新院区
        JIADING_HOSPITALS[15]  // H16: 外冈
      ],
      drones: [
        { hospital_id: 1, berth_id: 1, weight: 2.2, max_payload: 4.0, battery_max: 300, speed: 12.0 },
        { hospital_id: 1, berth_id: 2, weight: 2.2, max_payload: 4.0, battery_max: 300, speed: 12.0 },
        { hospital_id: 3, berth_id: 1, weight: 2.2, max_payload: 4.0, battery_max: 300, speed: 15.0 },
        { hospital_id: 4, berth_id: 1, weight: 2.2, max_payload: 4.0, battery_max: 300, speed: 12.0 },
        { hospital_id: 4, berth_id: 2, weight: 2.2, max_payload: 4.0, battery_max: 300, speed: 12.0 },
        { hospital_id: 7, berth_id: 1, weight: 2.2, max_payload: 4.0, battery_max: 300, speed: 12.0 },
        { hospital_id: 9, berth_id: 1, weight: 2.2, max_payload: 4.0, battery_max: 300, speed: 12.0 },
        { hospital_id: 10, berth_id: 1, weight: 2.2, max_payload: 4.0, battery_max: 300, speed: 12.0 },
        { hospital_id: 12, berth_id: 1, weight: 2.2, max_payload: 4.0, battery_max: 300, speed: 12.0 },
        { hospital_id: 13, berth_id: 1, weight: 2.2, max_payload: 4.0, battery_max: 300, speed: 12.0 },
        { hospital_id: 15, berth_id: 1, weight: 2.2, max_payload: 4.0, battery_max: 300, speed: 12.0 },
        { hospital_id: 16, berth_id: 1, weight: 2.2, max_payload: 4.0, battery_max: 300, speed: 12.0 }
      ],
      tasks: [
        { id: 1, origin: 1, destination: 2, weight: 1.5 },
        { id: 2, origin: 4, destination: 3, weight: 2.1 },
        { id: 3, origin: 7, destination: 10, weight: 1.8 },
        { id: 4, origin: 4, destination: 8, weight: 2.5 },
        { id: 5, origin: 9, destination: 12, weight: 1.2 },
        { id: 6, origin: 13, destination: 14, weight: 1.6 },
        { id: 7, origin: 15, destination: 11, weight: 2.0 },
        { id: 8, origin: 16, destination: 5, weight: 2.4 }
      ]
    },
    solution: {
      objective_value: 124.5,
      total_distance: 124.5,
      x_assignments: [
        { hospital_id: 1, berth_id: 1, task_id: 1, value: 1 },
        { hospital_id: 3, berth_id: 1, task_id: 2, value: 1 },
        { hospital_id: 7, berth_id: 1, task_id: 3, value: 1 },
        { hospital_id: 4, berth_id: 1, task_id: 4, value: 1 },
        { hospital_id: 9, berth_id: 1, task_id: 5, value: 1 },
        { hospital_id: 13, berth_id: 1, task_id: 6, value: 1 },
        { hospital_id: 15, berth_id: 1, task_id: 7, value: 1 },
        { hospital_id: 16, berth_id: 1, task_id: 8, value: 1 }
      ],
      y_assignments: [
        { hospital_id: 1, berth_id: 1, task_id: 1, dest_hospital_id: 2, value: 1 },
        { hospital_id: 3, berth_id: 1, task_id: 2, dest_hospital_id: 4, value: 1 },
        { hospital_id: 7, berth_id: 1, task_id: 3, dest_hospital_id: 10, value: 1 },
        { hospital_id: 4, berth_id: 1, task_id: 4, dest_hospital_id: 8, value: 1 },
        { hospital_id: 9, berth_id: 1, task_id: 5, dest_hospital_id: 12, value: 1 },
        { hospital_id: 13, berth_id: 1, task_id: 6, dest_hospital_id: 14, value: 1 },
        { hospital_id: 15, berth_id: 1, task_id: 7, dest_hospital_id: 11, value: 1 },
        { hospital_id: 16, berth_id: 1, task_id: 8, dest_hospital_id: 5, value: 1 }
      ],
      u_values: [],
      drone_assignments: { "1_1": 1, "3_1": 2, "7_1": 3, "4_1": 4, "9_1": 5, "13_1": 6, "15_1": 7, "16_1": 8 },
      energy_consumption: { "1_1": 24000.0, "3_1": 18200.0, "7_1": 25100.0, "4_1": 20400.0, "9_1": 14100.0, "13_1": 15800.0, "15_1": 19400.0, "16_1": 21300.0 }
    },
    comparisonReport: {
      timestamp: "2026-06-21T11:00:00Z",
      input: "JIADING_PEAK_EMERGENCY.json",
      solver: "cbc",
      timeout: 60,
      max_nodes: 100,
      results: [
        {
          algorithm: "branch_and_bound",
          success: true,
          elapsed_seconds: 0.436,
          objective_value: 124.5,
          assigned_tasks: 8,
          active_drones: 8,
          parking_assignments: 8,
          idle_drones: 4,
          energy_summary: {
            total_energy: 158300.0,
            active_total_energy: 158300.0,
            max_energy: 25100.0,
            avg_energy_all_drones: 13191.6,
            avg_energy_active_drones: 19787.5
          },
          x_assignment_set: [[1, 1, 1], [3, 1, 2], [7, 1, 3], [4, 1, 4], [9, 1, 5], [13, 1, 6], [15, 1, 7], [16, 1, 8]],
          y_assignment_set: [[1, 1, 1, 2], [3, 1, 2, 4], [7, 1, 3, 10], [4, 1, 4, 8], [9, 1, 5, 12], [13, 1, 6, 14], [15, 1, 7, 11], [16, 1, 8, 5]]
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
    logs: generateMockCbcLogs("JIADING_PEAK_EMERGENCY.json", "Branch-and-Bound / MIP Multi-Level Solver", "0.436", 124.5, 1)
  }
];
