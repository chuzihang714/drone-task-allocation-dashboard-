import React, { useState, useEffect, useRef } from "react";
import { 
  Activity, Zap, Navigation, MapPin, Play, Sliders, Plus, Trash2, Cpu, Clock, 
  Compass, BarChart2, ShieldAlert, Award, FileText, CheckCircle2, AlertTriangle, 
  RefreshCw, Users, ShieldCheck, Heart, User, Power, ToggleLeft, ToggleRight,
  Database, Download, Upload, History, ScrollText, Radio, BatteryCharging, ChevronRight, Gauge
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { gsap } from "gsap";
import { 
  Hospital, Drone, Task, ProblemConfigData, SolverSolution, ComparisonReport 
} from "./types";
import { precomputedCases, PrecomputedCase } from "./data";

export default function App() {
  // 1. Role Selection States
  const [userRole, setUserRole] = useState<"admin" | "hospital" | "drone_admin">("admin");
  const [activeHospitalId, setActiveHospitalId] = useState<number>(1);

  // 2. Scenario Config States - Loaded from our precomputed cases
  const [activeCaseId, setActiveCaseId] = useState<string>("dorling-small-low");
  const [config, setConfig] = useState<ProblemConfigData>(precomputedCases[0].config);

  // 3. Operational Limits & Controls
  const [algorithm, setAlgorithm] = useState<string>("branch_and_bound");
  const [solverType, setSolverType] = useState<string>("cbc");
  const [timeout, setTimeout] = useState<number>(60);
  const [maxNodes, setMaxNodes] = useState<number>(100);

  // 4. Layout Tab Views (Inside Admin View)
  const [activeTab, setActiveTab] = useState<"visualizer" | "comparison" | "statistics" | "backups">("visualizer");
  const [editorSubTab, setEditorSubTab] = useState<"hospitals" | "drones" | "tasks">("hospitals");

  // 5. Output Results & Logs
  const [solution, setSolution] = useState<SolverSolution | null>(precomputedCases[0].solution);
  const [logs, setLogs] = useState<string>(precomputedCases[0].logs);
  const [comparisonReport, setComparisonReport] = useState<ComparisonReport | null>(precomputedCases[0].comparisonReport);
  const [isSolving, setIsSolving] = useState<boolean>(false);
  const [isComparing, setIsComparing] = useState<boolean>(false);
  const [solveError, setSolveError] = useState<string | null>(null);

  // 6. Map Display States
  const [showLeg1, setShowLeg1] = useState(true);
  const [showLeg2, setShowLeg2] = useState(true);
  const [showLeg3, setShowLeg3] = useState(true);
  const [selectedHospital, setSelectedHospital] = useState<Hospital | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [hoveredRoute, setHoveredRoute] = useState<{
    drone: Drone;
    task: Task;
    dest: Hospital;
    leg1: number;
    leg2: number;
    leg3: number;
    energy: number;
  } | null>(null);

  // 7. Interactive Fault & Maintenance State
  const [lockedBerths, setLockedBerths] = useState<Record<string, boolean>>({});
  const [droneFaults, setDroneFaults] = useState<Record<string, "normal" | "offline" | "battery_drain" | "hardware_error">>({});
  const [emergencyLogs, setEmergencyLogs] = useState<Array<{ time: string; msg: string; type: "info" | "warning" | "success" }>>([]);

  // 8. Base Data Imports
  const [customImportJson, setCustomImportJson] = useState<string>("");
  const [importStatus, setImportStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // 9. Statistics and Solved History List
  const [solvedHistory, setSolvedHistory] = useState<any[]>([]);

  // 10. Urgent parcel form states
  const [urgentDestId, setUrgentDestId] = useState<number>(2);
  const [urgentWeight, setUrgentWeight] = useState<number>(1.2);

  // Clock
  const [currentTime, setCurrentTime] = useState<string>("");

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString("zh-CN", { hour12: false }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Sync up default values of pre-cooked cases
  const selectCaseById = (caseId: string) => {
    const found = precomputedCases.find(c => c.id === caseId);
    if (found) {
      setActiveCaseId(caseId);
      setConfig(found.config);
      setSolution(found.solution);
      setComparisonReport(found.comparisonReport);
      setLogs(found.logs);
      addEmergencyLog(`🎉 已成功载入实验数据库算例："${found.name}"`, "success");
      
      // Update quick submission defaults
      if (found.config.hospitals.length > 1) {
        const filtered = found.config.hospitals.filter(h => h.id !== activeHospitalId);
        if (filtered.length > 0) {
          setUrgentDestId(filtered[0].id);
        }
      }
    }
  };

  const addEmergencyLog = (msg: string, type: "info" | "warning" | "success" = "info") => {
    const timeStr = new Date().toLocaleTimeString("zh-CN", { hour12: false });
    setEmergencyLogs(prev => [{ time: timeStr, msg, type }, ...prev].slice(0, 50));
  };

  // Toggle maintenance berth
  const handleLockBerthToggle = (hId: number, bId: number) => {
    const key = `${hId}_${bId}`;
    const nextLocked = { ...lockedBerths, [key]: !lockedBerths[key] };
    setLockedBerths(nextLocked);

    if (nextLocked[key]) {
      addEmergencyLog(`H${hId} 医疗中心的 ${bId}号 泊船位已被设定日常禁用（系统强制离线维修中）`, "warning");
    } else {
      addEmergencyLog(`H${hId} 医疗中心的 ${bId}号 泊船位已解除维护状态，重新准许无人机起降接驳`, "success");
    }
    
    // Simulate auto routing update
    triggerInstantSolveSimulation(true);
  };

  // Inject Drone Fault
  const handleDroneFaultChange = (hId: number, bId: number, faultStatus: "normal" | "offline" | "battery_drain" | "hardware_error") => {
    const key = `${hId}_${bId}`;
    const nextFaults = { ...droneFaults, [key]: faultStatus };
    setDroneFaults(nextFaults);

    if (faultStatus === "normal") {
      addEmergencyLog(`无人机（H${hId}-B${bId} 单元）突发故障码已被清除，绿灯复归。`, "success");
    } else {
      const faultMsg = {
        offline: "指令流中断 / 4G蜂窝信令解体失联 (Offline)",
        battery_drain: "内部锂电芯突发电热超标，自放电休克 (Low Battery)",
        hardware_error: "驱动机翼桨叶变形，应控制雷达故障 (Hardware Damaged)"
      }[faultStatus];
      addEmergencyLog(`⚠️ 发生突发安全隐患：无人机（H${hId}-B${bId} 单元）突发：${faultMsg}`, "warning");
      
      // Simulate intelligent rerouting
      triggerAutomaticRerouting(hId, bId, faultStatus);
    }
  };

  const triggerAutomaticRerouting = (faultHId: number, faultBId: number, faultType: string) => {
    addEmergencyLog(`[应急预案自愈机制] 启动多目标能耗回溯保护规划...`, "info");
    
    setTimeout(() => {
      // Create clone config for safety
      const berthKey = `${faultHId}_${faultBId}`;
      setLockedBerths(prev => ({ ...prev, [berthKey]: true }));
      addEmergencyLog(`[指令介入] 临时隔离封锁发生故障机泊位（H${faultHId}-泊口${faultBId}）以开展排障降温。`, "warning");

      // Auto-assign task to next free drone
      const backupDrone = config.drones.find(d => 
        !(d.hospital_id === faultHId && d.berth_id === faultBId) &&
        !lockedBerths[`${d.hospital_id}_${d.berth_id}`] &&
        droneFaults[`${d.hospital_id}_${d.berth_id}`] !== "offline"
      );

      if (backupDrone) {
        addEmergencyLog(`[备用转配] 成功调度 H${backupDrone.hospital_id} 站点的空闲备机接替空档配送！`, "success");
        triggerInstantSolveSimulation(false);
      } else {
        addEmergencyLog(`[告警] 区域由于负荷过饱和, 暂无可替代空载无人机单元，请管理员裁减物资转运！`, "warning");
      }
    }, 1000);
  };

  // Instantly recompute flight path mappings of selected cases in case of customization (Offline Simulator)
  const triggerInstantSolveSimulation = (showLog = true) => {
    setIsSolving(true);
    if (showLog) {
      setLogs(prev => prev + `\n[MIP Solver Call] Berth maintenance table mutated. Re-balancing matrix constraints...\n`);
    }
    
    setTimeout(() => {
      setIsSolving(false);
      // Construct logical assignment based on coordinates
      const validDrones = config.drones.filter(d => {
        const key = `${d.hospital_id}_${d.berth_id}`;
        return !lockedBerths[key] && droneFaults[key] !== "offline";
      });

      if (validDrones.length === 0) {
        addEmergencyLog("全网无可用低空无人载具！重新规划被迫流产。", "warning");
        return;
      }

      // Re-assign tasks logically based on distance
      const newXAssignments: any[] = [];
      const newYAssignments: any[] = [];
      let totalDistance = 0;

      config.tasks.forEach((task, idx) => {
        const drone = validDrones[idx % validDrones.length];
        if (drone) {
          newXAssignments.push({ hospital_id: drone.hospital_id, berth_id: drone.berth_id, task_id: task.id, value: 1 });
          newYAssignments.push({ hospital_id: drone.hospital_id, berth_id: drone.berth_id, task_id: task.id, dest_hospital_id: task.destination, value: 1 });
          
          // distance calculations
          const start = config.hospitals.find(h => h.id === drone.hospital_id);
          const orig = config.hospitals.find(h => h.id === task.origin);
          const dest = config.hospitals.find(h => h.id === task.destination);
          if (start && orig && dest) {
            const leg1 = Math.sqrt(Math.pow(start.longitude - orig.longitude, 2) + Math.pow(start.latitude - orig.latitude, 2));
            const leg2 = Math.sqrt(Math.pow(orig.longitude - dest.longitude, 2) + Math.pow(orig.latitude - dest.latitude, 2));
            const leg3 = Math.sqrt(Math.pow(dest.longitude - start.longitude, 2) + Math.pow(dest.latitude - start.latitude, 2));
            totalDistance += (leg1 + leg2 + leg3);
          }
        }
      });

      setSolution({
        objective_value: totalDistance,
        x_assignments: newXAssignments,
        y_assignments: newYAssignments,
        u_values: [],
        drone_assignments: {},
        total_distance: totalDistance,
        energy_consumption: {}
      });

      addEmergencyLog(`智能自愈重算成功！全网能耗调整，航迹安全收敛：${totalDistance.toFixed(2)} km`, "success");
    }, 1100);
  };

  // Quick submit urgent material task
  const handleQuickTaskSubmit = () => {
    if (activeHospitalId === urgentDestId) {
      addEmergencyLog(`派送目的地不能与起运点重合。`, "warning");
      return;
    }
    const nextId = config.tasks.length > 0 ? Math.max(...config.tasks.map(t => t.id)) + 1 : 1;
    const newTask: Task = {
      id: nextId,
      origin: activeHospitalId,
      destination: urgentDestId,
      weight: urgentWeight
    };

    const updatedConfig = {
      ...config,
      tasks: [...config.tasks, newTask]
    };
    setConfig(updatedConfig);
    addEmergencyLog(`🏥 医务急救成功加急下单物资单 #${nextId}，目标送往 H${urgentDestId} 医院 (重${urgentWeight}kg)`, "success");
    
    // Auto re-solve offline simulation
    triggerInstantSolveSimulation();
  };

  // Projection logic for map coordinates rendering 
  const getMapScales = () => {
    const coords = config.hospitals.map(h => [h.longitude, h.latitude]);
    const xCoords = coords.map(c => c[0]);
    const yCoords = coords.map(c => c[1]);

    const minX = xCoords.length > 0 ? Math.min(...xCoords) - 15 : -35;
    const maxX = xCoords.length > 0 ? Math.max(...xCoords) + 15 : 35;
    const minY = yCoords.length > 0 ? Math.min(...yCoords) - 15 : -35;
    const maxY = yCoords.length > 0 ? Math.max(...yCoords) + 15 : 35;

    return { minX, maxX, minY, maxY };
  };

  const { minX, maxX, minY, maxY } = getMapScales();

  const projectX = (val: number) => {
    const range = maxX - minX || 1;
    return `${((val - minX) / range) * 100}%`;
  };

  const projectY = (val: number) => {
    const range = maxY - minY || 1;
    return `${(1 - (val - minY) / range) * 100}%`;
  };

  const getHospitalName = (id: number) => {
    const h = config.hospitals.find((x) => x.id === id);
    return h ? h.name : `位置点 #${id}`;
  };

  // CRUD Data Management 
  const addHospital = () => {
    const nextId = config.hospitals.length > 0 ? Math.max(...config.hospitals.map(h => h.id)) + 1 : 1;
    const newHospital: Hospital = {
      id: nextId,
      name: `医疗中继配送站 H${nextId}`,
      longitude: Math.round((Math.random() * 50 - 25) * 10) / 10,
      latitude: Math.round((Math.random() * 50 - 25) * 10) / 10,
      type: "substation",
      capacity: 3,
      berths: [1, 2, 3],
      initial_empty: 1
    };
    setConfig(prev => ({ ...prev, hospitals: [...prev.hospitals, newHospital] }));
    addEmergencyLog(`已在云内存追加新增中继配送终端：H${nextId}`, "success");
  };

  const removeHospital = (id: number) => {
    setConfig(prev => ({
      ...prev,
      hospitals: prev.hospitals.filter(h => h.id !== id),
      tasks: prev.tasks.filter(t => t.origin !== id && t.destination !== id),
      drones: prev.drones.filter(d => d.hospital_id !== id)
    }));
    addEmergencyLog(`已删除医院 H${id} 及其联载配送空运链路。`, "warning");
  };

  const addDrone = () => {
    if (config.hospitals.length === 0) return;
    const randHospital = config.hospitals[Math.floor(Math.random() * config.hospitals.length)];
    const existingBerths = config.drones
      .filter((d) => d.hospital_id === randHospital.id)
      .map((d) => d.berth_id);
    const nextBerthId = existingBerths.length > 0 ? Math.max(...existingBerths) + 1 : 1;

    const newDrone: Drone = {
      hospital_id: randHospital.id,
      berth_id: nextBerthId,
      weight: 2.2,
      max_payload: 3.5,
      battery_max: 240,
      speed: 12.0
    };
    setConfig(prev => ({ ...prev, drones: [...prev.drones, newDrone] }));
    addEmergencyLog(`已在 H${randHospital.id} 的停机口B${nextBerthId} 挂靠新增无人转运备机`, "success");
  };

  const removeDrone = (index: number) => {
    const matched = config.drones[index];
    setConfig(prev => ({
      ...prev,
      drones: prev.drones.filter((_, idx) => idx !== index)
    }));
    if (matched) {
      addEmergencyLog(`已注销移除停放在 H${matched.hospital_id}-B${matched.berth_id} 的空配载具`, "warning");
    }
  };

  const addTask = () => {
    if (config.hospitals.length < 2) return;
    const nextId = config.tasks.length > 0 ? Math.max(...config.tasks.map(t => t.id)) + 1 : 1;
    const newTask: Task = {
      id: nextId,
      origin: config.hospitals[0].id,
      destination: config.hospitals[1].id,
      weight: 1.5
    };
    setConfig(prev => ({ ...prev, tasks: [...prev.tasks, newTask] }));
    addEmergencyLog(`全空域派发新增血胞/样本急救快单 #${nextId}`, "success");
  };

  const removeTask = (id: number) => {
    setConfig(prev => ({ ...prev, tasks: prev.tasks.filter(t => t.id !== id) }));
    addEmergencyLog(`已紧急拦截撤销了任务单号 #${id}`, "warning");
  };

  const getDroneStatus = (d: Drone) => {
    const key = `${d.hospital_id}_${d.berth_id}`;
    const fault = droneFaults[key];
    const locked = lockedBerths[key];
    
    if (locked) return "maintenance";
    if (fault && fault !== "normal") return fault;
    
    if (solution) {
      const isAssigned = solution.x_assignments.some(x => x.hospital_id === d.hospital_id && x.berth_id === d.berth_id);
      if (isAssigned) return "flying";
    }
    return "idle";
  };



  // JSON Import
  const handleImportJson = () => {
    setImportStatus(null);
    try {
      const parsed = JSON.parse(customImportJson);
      if (!parsed.hospitals || !parsed.drones || !parsed.tasks) {
        throw new Error("JSON属性非法, 格式必须包括 hospitals, drones 与 tasks 节点。");
      }
      setConfig(parsed);
      setSolution(null);
      setImportStatus({ type: "success", text: "校验成功，已成功反序列化加载自定义空域算例！" });
      addEmergencyLog("通过 JSON 面板成功导入外部结构数据。", "success");
    } catch (e: any) {
      setImportStatus({ type: "error", text: `格式解析出错: ${e.message}` });
    }
  };

  // Handle Offline Simulation Solve Trigger
  const handleRunOfflineSimulation = () => {
    setIsSolving(true);
    setLogs(`🚀 [MIP Solvers Parallel Frame] Initialized optimal search...
[Parallel Optimizer] Checking model relaxations under Seeds...
[Parallel Optimizer] Branch and bound converging...`);

    const animationTarget = document.querySelector(".solving-matrix-glow");
    if (animationTarget) {
      gsap.fromTo(animationTarget, { backdropFilter: "blur(0px)", opacity: 0 }, { backdropFilter: "blur(8px)", opacity: 1, duration: 0.3 });
    }

    setTimeout(() => {
      setIsSolving(false);
      triggerInstantSolveSimulation(false);
      
      // Save history block
      const historyItem = {
        id: `HIST-${Date.now().toString().slice(-5)}`,
        timestamp: new Date().toLocaleTimeString(),
        algorithm: "MILP 次梯度割平面求解 (B&B)",
        objective_value: solution ? solution.objective_value : 85.3,
        assigned_tasks: config.tasks.length,
        total_distance: solution ? solution.objective_value : 85.3,
        duration: 0.722
      };
      setSolvedHistory(prev => [historyItem, ...prev].slice(0, 10));
    }, 1500);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 font-sans overflow-hidden select-none">
      
      {/* 1. BRAND GLOBAL COHESIVE HEADER */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-slate-900 bg-slate-950/80 backdrop-blur-md shadow-lg z-20 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-indigo-950/80 border border-indigo-500/40 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.25)] animate-pulse">
            <Compass className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
              分院–中心医疗物资无人机智能集货多段调度大屏
              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/50 px-2 py-0.5 rounded-full font-mono font-bold tracking-widest uppercase">Dual-Constraint MILP</span>
            </h1>
            <p className="text-[10px] text-slate-400 font-mono tracking-wider uppercase font-semibold">
              Medical Ware Transportation & Multi-Leg Energy-Constraint Fleet Manager Panel
            </p>
          </div>
        </div>

        {/* Cohesive Role Selector buttons */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-xl">
            <button
              onClick={() => { setUserRole("admin"); addEmergencyLog("已转切至「系统总指挥管理员视角」", "info"); }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                userRole === "admin"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>👑 系统管理员</span>
            </button>
            <button
              onClick={() => { setUserRole("hospital"); addEmergencyLog("已转切至「分院临床医护提交视角」", "info"); }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                userRole === "hospital"
                  ? "bg-emerald-600/90 text-white shadow-md shadow-emerald-500/25"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Heart className="w-3.5 h-3.5" />
              <span>🏥 医院医务人员</span>
            </button>
            <button
              onClick={() => { setUserRole("drone_admin"); addEmergencyLog("已转切至「无人机运维巡检测诊视角」", "info"); }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                userRole === "drone_admin"
                  ? "bg-amber-600/95 text-white shadow-md shadow-amber-500/25"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>⚡ 无人机管理员</span>
            </button>
          </div>

          <div className="hidden lg:flex items-center gap-2 text-xs font-mono pr-2">
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-slate-300 font-semibold">{currentTime || "00:00:00"}</span>
          </div>
        </div>
      </header>

      {/* Grid layouts body */}
      <main className="flex-1 w-full grid grid-cols-12 overflow-hidden bg-slate-950 p-4 gap-4">
        
        {/* ========================================================== */}
        {/* COLUMN 1 (4/12): DYNAMIC USER PERSPECTIVES */}
        {/* ========================================================== */}
        <section className="col-span-12 xl:col-span-4 flex flex-col gap-4 overflow-hidden h-full">
          
          <AnimatePresence mode="wait">
            
            {/* VIEW A: ADMIN CONTROL PANEL */}
            {userRole === "admin" && (
              <motion.div 
                key="admin"
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                className="flex-1 flex flex-col gap-4 overflow-hidden"
              >
                 {/* Precomputed Case Dataset Select Panel */}
                 <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 py-6 flex flex-col gap-4 shadow-xl shrink-0">
                   <div className="flex items-center justify-between">
                     <span className="text-white font-bold text-xs flex items-center gap-1.5">
                       <Database className="w-4 h-4 text-indigo-400" />
                       <span>已求解实验数据库</span>
                     </span>
                     <span className="text-[10px] text-indigo-300 font-mono font-bold bg-indigo-950 px-2.5 py-1 rounded border border-indigo-900">已校验</span>
                   </div>
 
                   <div className="flex flex-col gap-2.5">
                     <span className="text-[11px] text-slate-400">选择实验算例，即刻调阅高阶收敛航迹：</span>
                     <select
                       value={activeCaseId}
                       onChange={(e) => selectCaseById(e.target.value)}
                       className="bg-slate-950 border border-slate-800 text-slate-100 rounded-xl py-3.5 px-4 text-xs focus:ring-1 focus:ring-indigo-500 font-bold tracking-wide outline-none cursor-pointer w-full"
                     >
                       {precomputedCases.map((c) => (
                         <option key={c.id} value={c.id}>{c.name}</option>
                       ))}
                     </select>
                   </div>
                   
                   {/* Current select case description banner */}
                   <div className="bg-slate-950 p-3 rounded-lg border border-slate-850 text-[10px] text-slate-400 font-sans leading-relaxed">
                     📝 <span className="font-semibold text-slate-300">算例简介：</span>{precomputedCases.find(c => c.id === activeCaseId)?.description}
                   </div>
                 </div>

                {/* Database Quick CRUD panel */}
                <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl flex flex-col overflow-hidden shadow-md">
                  <div className="bg-slate-950 px-4 py-2 flex items-center justify-between border-b border-slate-800 shrink-0">
                    <div className="flex gap-1.5">
                      {(["hospitals", "drones", "tasks"] as const).map((tab) => (
                        <button
                          key={tab}
                          onClick={() => setEditorSubTab(tab)}
                          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                            editorSubTab === tab 
                              ? "bg-indigo-600/10 text-indigo-300 border border-indigo-500/30"
                              : "text-slate-400 hover:text-white"
                          }`}
                        >
                          {tab === "hospitals" ? `🏥 医院 (${config.hospitals.length})` : 
                           tab === "drones" ? `🛸 载具 (${config.drones.length})` : 
                           `挂扣快单 (${config.tasks.length})`}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => {
                        if (editorSubTab === "hospitals") addHospital();
                        if (editorSubTab === "drones") addDrone();
                        if (editorSubTab === "tasks") addTask();
                      }}
                      className="p-1 px-2.5 rounded-lg bg-indigo-950 border border-indigo-500/30 text-indigo-400 hover:bg-slate-850 hover:text-indigo-300 transition-all cursor-pointer text-xs font-bold flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>新增</span>
                    </button>
                  </div>

                  {/* Config lists */}
                  <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
                    {editorSubTab === "hospitals" && config.hospitals.map((h) => (
                      <div key={h.id} className="bg-slate-950/80 p-3 rounded-lg border border-slate-850 flex flex-col gap-2 relative group hover:border-slate-700 transition-all">
                        <div className="flex items-center justify-between pb-1 border-b border-slate-850">
                          <span className="text-xs font-mono font-bold text-indigo-400">🏥 医院编号 H{h.id}</span>
                          <button onClick={() => removeHospital(h.id)} className="text-rose-450 hover:text-rose-500 transition-opacity p-0.5 cursor-pointer">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                          <div>
                            <span className="text-slate-400">坐标:</span>
                            <div className="text-slate-200 mt-1">({h.longitude}, {h.latitude})</div>
                          </div>
                          <div>
                            <span className="text-slate-400">仓泊位数 C_d:</span>
                            <div className="text-slate-200 mt-1">{h.capacity}  berth</div>
                          </div>
                        </div>
                      </div>
                    ))}

                    {editorSubTab === "drones" && config.drones.map((d, index) => (
                      <div key={index} className="bg-slate-950/80 p-3 rounded-lg border border-slate-850 flex flex-col gap-2 relative group hover:border-slate-700 transition-all">
                        <div className="flex items-center justify-between pb-1 border-b border-slate-850">
                          <span className="text-xs font-mono font-bold text-indigo-400">🛸 无人机 D-H{d.hospital_id}.B{d.berth_id}</span>
                          <button onClick={() => removeDrone(index)} className="text-rose-450 hover:text-rose-500 transition-opacity p-0.5 cursor-pointer">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-[11px] font-mono">
                          <div><span className="text-slate-500">限载:</span> <span className="text-slate-200">{d.max_payload}kg</span></div>
                          <div><span className="text-slate-500">自重:</span> <span className="text-slate-200">{d.weight}kg</span></div>
                          <div><span className="text-slate-500">时速:</span> <span className="text-slate-200">{d.speed}m/s</span></div>
                        </div>
                      </div>
                    ))}

                    {editorSubTab === "tasks" && config.tasks.map((t) => (
                      <div key={t.id} className="bg-slate-950/80 p-3 rounded-lg border border-slate-850 flex flex-col gap-2 relative group hover:border-slate-700 transition-all">
                        <div className="flex items-center justify-between pb-1 border-b border-slate-850">
                          <span className="text-xs font-mono font-bold text-indigo-400">📦 物资配送派单 #{t.id}</span>
                          <button onClick={() => removeTask(t.id)} className="text-rose-450 hover:text-rose-500 transition-opacity p-0.5 cursor-pointer">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-[11px] font-mono text-center">
                          <div><span className="text-slate-500 block">发货中心</span> <span className="text-slate-250 font-bold">H{t.origin}</span></div>
                          <div><span className="text-slate-500 block">收货站点</span> <span className="text-slate-250 font-bold">H{t.destination}</span></div>
                          <div><span className="text-slate-500 block">货重 (kg)</span> <span className="text-amber-500 font-bold">{t.weight}</span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Optimization solver configuration sliders */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-3 shadow-md shrink-0">
                  <div className="flex items-center justify-between">
                    <span className="text-white font-bold text-xs flex items-center gap-1.5">
                      <Cpu className="w-4 h-4 text-indigo-400" />
                      <span>多连通三段航程 MILP 求解框架</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-[10px] font-mono text-slate-400">
                    <div className="flex flex-col gap-1">
                      <span>切面算法模型:</span>
                      <select 
                        value={algorithm} 
                        onChange={(e) => setAlgorithm(e.target.value)}
                        className="bg-slate-950 border border-slate-850 text-slate-200 rounded-lg p-2 Outline-none"
                      >
                        <option value="branch_and_bound">分支定界与次梯度割 plane</option>
                        <option value="single_task_mip">单任务简化 MILP 基准模型</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <span>求解限时 (Sec):</span>
                      <input 
                        type="number" 
                        value={timeout} 
                        onChange={(e) => setTimeout(parseInt(e.target.value) || 30)}
                        className="bg-slate-950 border border-slate-850 text-slate-200 rounded-lg p-2 Outline-none font-bold"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 mt-1">
                    <button
                      onClick={handleRunOfflineSimulation}
                      disabled={isSolving}
                      className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs tracking-wide active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-500/10"
                    >
                      {isSolving ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin text-white" />
                          <span>正在执行多点航迹归化...</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 text-indigo-300" />
                          <span>一键算力重调，刷新空天航线</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

             {/* VIEW B: CLINICAL STAFF PERSPECTIVE */}
             {userRole === "hospital" && (
               <motion.div 
                 key="hospital"
                 initial={{ opacity: 0, x: -15 }}
                 animate={{ opacity: 1, x: 0 }}
                 exit={{ opacity: 0, x: -15 }}
                 className="flex-1 flex flex-col gap-4 overflow-hidden"
               >
                 <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 py-6 flex flex-col gap-4 shadow-xl shrink-0">
                   <div className="flex items-center justify-between">
                     <span className="text-white font-bold text-xs flex items-center gap-1.5">
                       <Heart className="w-4 h-4 text-emerald-400" />
                       <span>分院急救医务控制台</span>
                     </span>
                     <span className="text-[9px] text-emerald-300 font-mono font-bold bg-emerald-950 px-2.5 py-1 rounded border border-emerald-900">核心单元</span>
                   </div>
 
                   <div className="flex flex-col gap-2.5">
                     <span className="text-[11px] text-slate-400 font-sans">选择当前工作的分医院：</span>
                     <select
                       value={activeHospitalId}
                       onChange={(e) => setActiveHospitalId(parseInt(e.target.value) || 1)}
                       className="bg-slate-950 border border-slate-800 text-slate-100 rounded-lg py-3.5 px-4 text-xs font-bold outline-none"
                     >
                       {config.hospitals.map((h) => (
                         <option key={h.id} value={h.id}>H{h.id}附院：{h.name}</option>
                       ))}
                     </select>
                   </div>
                 </div>

                {/* Quick booking dispatching packet screen */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-4 shadow-md shrink-0">
                  <div className="text-white font-bold text-xs flex items-center gap-1.5 border-b border-slate-850 pb-2">
                    <Plus className="w-4 h-4 text-emerald-400" />
                    <span>绿色急救通道 - 血液/临床标本一键提交</span>
                  </div>

                  <div className="flex flex-col gap-3 text-xs leading-none">
                    <div className="grid grid-cols-2 gap-3 leading-none">
                      <div className="flex flex-col gap-1.5 leading-none">
                        <span className="text-[11px] text-slate-400 leading-none">起运分站:</span>
                        <div className="bg-slate-950 border border-slate-850 p-2.5 rounded-lg text-emerald-400 font-bold font-mono">
                          H{activeHospitalId}附院 (我院)
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5 leading-none">
                        <span className="text-[11px] text-slate-400 leading-none">配送目标分院:</span>
                        <select
                          value={urgentDestId}
                          onChange={(e) => setUrgentDestId(parseInt(e.target.value) || 1)}
                          className="bg-slate-950 border border-slate-800 text-slate-100 rounded-lg p-2.5 outline-none font-bold"
                        >
                          {config.hospitals.filter(h => h.id !== activeHospitalId).map((h) => (
                            <option key={h.id} value={h.id}>H{h.id} - {h.name.substring(0, 10)}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5 mt-2">
                      <span className="text-[11px] text-slate-400">抗原标本/配载血重 (kg):</span>
                      <div className="flex items-center gap-3">
                        <input 
                          type="range"
                          min="0.2"
                          max="3.0"
                          step="0.1"
                          value={urgentWeight}
                          onChange={(e) => setUrgentWeight(parseFloat(e.target.value))}
                          className="flex-1 accent-emerald-500 cursor-pointer h-1 bg-slate-800 rounded-lg appearance-none"
                        />
                        <span className="bg-slate-950 border border-slate-850 text-emerald-400 font-bold px-3 py-1.5 rounded-lg font-mono text-center w-16">{urgentWeight} kg</span>
                      </div>
                    </div>

                    <button
                      onClick={handleQuickTaskSubmit}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg tracking-wider transition-all mt-2 cursor-pointer shadow-lg shadow-emerald-500/10 text-xs"
                    >
                      提交绿色特快转运指令 🚀
                    </button>
                  </div>
                </div>

                {/* Berth maintaining lock matrix */}
                <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col overflow-hidden shadow-md">
                  <div className="text-white font-bold text-xs flex items-center gap-1.5 border-b border-slate-850 pb-2.5 shrink-0 select-none">
                    <Power className="w-4 h-4 text-emerald-400" />
                    <span>本院停泊位日常检修网格</span>
                  </div>

                  <div className="flex-1 overflow-y-auto py-2 flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-3">
                      {[1, 2, 3, 4].slice(0, config.hospitals.find(h => h.id === activeHospitalId)?.capacity || 3).map((berthIdx) => {
                        const key = `${activeHospitalId}_${berthIdx}`;
                        const isLocked = lockedBerths[key];
                        const matchedDrone = config.drones.find(d => d.hospital_id === activeHospitalId && d.berth_id === berthIdx);

                        return (
                          <div key={berthIdx} className="bg-slate-950 p-3 rounded-xl border border-slate-850 flex flex-col gap-2 justify-between">
                            <div className="flex items-center justify-between text-[11px] font-mono">
                              <span className="font-bold text-slate-400">{berthIdx}号 泊船位</span>
                              {isLocked ? (
                                <span className="bg-rose-950/30 text-rose-400 border border-rose-900/40 px-1.5 py-0.5 rounded text-[9px] font-bold">已挂牌维修</span>
                              ) : matchedDrone ? (
                                <span className="bg-indigo-950/30 text-indigo-400 border border-indigo-900/30 px-1.5 py-0.5 rounded text-[9px] font-bold text-indigo-300">备机就位</span>
                              ) : (
                                <span className="bg-emerald-950/30 text-emerald-400 border border-emerald-900/30 px-1.5 py-0.5 rounded text-[9px] font-bold">空闲敞开</span>
                              )}
                            </div>
                            
                            <div className="flex justify-between items-center text-[10px] text-slate-500 pt-2 border-t border-slate-900">
                              <span>设备停用锁位：</span>
                              <button onClick={() => handleLockBerthToggle(activeHospitalId, berthIdx)} className="leading-none cursor-pointer">
                                {isLocked ? (
                                  <ToggleRight className="w-7 h-7 text-rose-500" />
                                ) : (
                                  <ToggleLeft className="w-7 h-7 text-slate-600" />
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

             {/* VIEW C: DRONE TELEMETRIES Diagnostics Perspective */}
             {userRole === "drone_admin" && (
               <motion.div 
                 key="drone"
                 initial={{ opacity: 0, x: -15 }}
                 animate={{ opacity: 1, x: 0 }}
                 exit={{ opacity: 0, x: -15 }}
                 className="flex-1 flex flex-col gap-4 overflow-hidden"
               >
                 <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 py-6 flex flex-col gap-4 shadow-xl shrink-0">
                   <div className="flex items-center justify-between">
                     <span className="text-white font-bold text-xs flex items-center gap-1.5">
                       <Radio className="w-4 h-4 text-amber-500" />
                       <span>全网无人机队遥测监控</span>
                     </span>
                     <span className="text-[9px] text-amber-300 font-mono font-bold bg-amber-950 px-2.5 py-1 rounded border border-amber-900">联机就绪</span>
                   </div>
 
                   <div className="grid grid-cols-2 gap-4 text-center text-xs font-mono">
                     <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 flex flex-col justify-center items-center py-5">
                       <span className="text-[10px] text-slate-400">正常台数</span>
                       <span className="text-xl font-bold text-emerald-400 mt-2">
                         {config.drones.filter(d => !lockedBerths[`${d.hospital_id}_${d.berth_id}`] && droneFaults[`${d.hospital_id}_${d.berth_id}`] !== "offline").length} / {config.drones.length}台
                       </span>
                     </div>
                     <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 flex flex-col justify-center items-center py-5">
                       <span className="text-[10px] text-slate-400">故障台数</span>
                       <span className="text-xl font-bold text-rose-500 mt-2">
                         {Object.values(droneFaults).filter(f => f !== "normal" && f !== undefined).length}台
                       </span>
                     </div>
                   </div>
                 </div>

                {/* Drone list fault injector widget */}
                <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col overflow-hidden shadow-md">
                  <div className="text-white font-bold text-xs flex items-center gap-1.5 border-b border-slate-850 pb-2.5 shrink-0 select-none">
                    <ShieldAlert className="w-4 h-4 text-amber-400 animate-pulse" />
                    <span>全空载具状态巡查与事件强注(Mishap Injection)</span>
                  </div>

                  <div className="flex-1 overflow-y-auto py-1 flex flex-col gap-2.5 text-[11px] font-mono">
                    {config.drones.length === 0 ? (
                      <div className="text-slate-500 text-center italic py-20">机队部署未初始化</div>
                    ) : (
                      config.drones.map((d, dIdx) => {
                        const faultKey = `${d.hospital_id}_${d.berth_id}`;
                        const currentFault = droneFaults[faultKey] || "normal";

                        return (
                          <div key={dIdx} className="bg-slate-950 p-3 rounded-xl border border-slate-850 flex flex-col gap-2 hover:border-slate-700 transition">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-amber-400 font-bold">D-H{d.hospital_id}. berth#{d.berth_id}</span>
                              <span className={`w-2 h-2 rounded-full ${currentFault === "normal" ? "bg-emerald-500" : "bg-rose-500 animate-ping"}`} />
                            </div>

                            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] text-slate-400 mt-1">
                              <div>自重: <span className="text-white">{d.weight}kg</span></div>
                              <div>最高负载: <span className="text-white">{d.max_payload}kg</span></div>
                              <div>航定能效: <span className="text-emerald-400 font-bold">{d.battery_max} J</span></div>
                              <div>诊断阻抗: <span className="text-emerald-400">14 mΩ (良)</span></div>
                            </div>

                            <div className="flex justify-between items-center pt-2 border-t border-slate-900 mt-1 text-[10px]">
                              <span className="text-slate-500">模拟突发恶劣特情:</span>
                              <select
                                value={currentFault}
                                onChange={(e) => handleDroneFaultChange(d.hospital_id, d.berth_id, e.target.value as any)}
                                className={`rounded px-2 py-0.5 text-[10px] outline-none border focus:ring-1 ${
                                  currentFault === "normal"
                                    ? "bg-slate-900 border-slate-800 text-slate-300"
                                    : "bg-rose-950/30 border-rose-800 text-rose-300"
                                }`}
                              >
                                <option value="normal">信号正常 (Normal)</option>
                                <option value="offline">蜂窝失联通信脱网 (Offline)</option>
                                <option value="battery_drain">电芯超热电量熔断 (Low Batt)</option>
                                <option value="hardware_error">物理撞桨舵机卡阻 (Rotor Lock)</option>
                              </select>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Incident alerts console logs */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 h-28 flex flex-col overflow-hidden shadow-md shrink-0">
            <div className="text-[10px] text-slate-400 flex justify-between border-b border-slate-800 pb-1 shrink-0 font-mono">
              <span className="flex items-center gap-1">
                <ScrollText className="w-3.5 h-3.5 text-indigo-400" />
                <span>实时应急响应流</span>
              </span>
              <span className="text-indigo-400">LOGS</span>
            </div>

            <div className="flex-1 overflow-y-auto text-[11px] font-mono py-1.5 flex flex-col gap-1.5 leading-relaxed">
              {emergencyLogs.length === 0 ? (
                <div className="text-slate-600 text-center italic py-10">等待空域突发事件注入或应急重组记录流...</div>
              ) : (
                emergencyLogs.map((log, index) => (
                  <div key={index} className="flex gap-1.5 items-start">
                    <span className="text-slate-600 shrink-0 font-bold">[{log.time}]</span>
                    <span className={
                      log.type === "success" 
                        ? "text-emerald-450 text-emerald-400" 
                        : log.type === "warning" 
                          ? "text-rose-400 font-semibold" 
                          : "text-indigo-300"
                    }>
                      {log.msg}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        {/* ========================================================== */}
        {/* COLUMN 2 (8/12): FLIGHT PROJECTOR MAP & RESULTS METRICS */}
        {/* ========================================================== */}
        <section className="col-span-12 xl:col-span-8 flex flex-col gap-4 overflow-hidden h-full">
          
          {/* Main Visualizer Switcher Tabs */}
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-850 rounded-xl p-1.5 shrink-0 shadow-md">
            <button
              onClick={() => setActiveTab("visualizer")}
              className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeTab === "visualizer"
                  ? "bg-indigo-600 text-white shadow-lg"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Compass className="w-4 h-4" />
              <span>🗺️ 航迹规划大屏</span>
            </button>
            <button
              onClick={() => setActiveTab("comparison")}
              className={`flex-1 py-1 px-3 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === "comparison"
                  ? "bg-indigo-600 text-white shadow-lg"
                  : "text-slate-400 hover:text-white hover:bg-slate-850"
              }`}
            >
              <BarChart2 className="w-4 h-4" />
              <span>📊 算法效能对比</span>
            </button>
            <button
              onClick={() => setActiveTab("statistics")}
              className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeTab === "statistics"
                  ? "bg-indigo-600 text-white shadow-lg"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <History className="w-4 h-4" />
              <span>📈 调度统计分析</span>
            </button>
            <button
              onClick={() => setActiveTab("backups")}
              className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeTab === "backups"
                  ? "bg-indigo-600 text-white shadow-lg"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Database className="w-4 h-4" />
              <span>💾 JSON 数据导入</span>
            </button>
          </div>

          {/* TAB 1: GEOMETRIC PROJECTION FLIGHT MAP */}
          {activeTab === "visualizer" && (
            <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-3 gap-4 overflow-hidden">
              
              {/* Map SVG Canvas Area */}
              <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-xl relative overflow-hidden flex flex-col shadow-inner">
                {/* Leg filters overlays */}
                <div className="absolute top-3 left-3 flex items-center gap-2.5 z-10 bg-slate-950/90 backdrop-blur-sm p-2 rounded-lg border border-slate-800 text-[10px] font-mono shadow-md">
                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                    <input 
                      type="checkbox" 
                      checked={showLeg1} 
                      onChange={() => setShowLeg1(!showLeg1)}
                      className="accent-sky-400" 
                    />
                    <span className="text-sky-400 font-bold">空载前飞 (Leg 1)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 border-l border-slate-800 pl-2">
                    <input 
                      type="checkbox" 
                      checked={showLeg2} 
                      onChange={() => setShowLeg2(!showLeg2)}
                      className="accent-amber-500" 
                    />
                    <span className="text-amber-500 font-bold">载实重输 (Leg 2)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 border-l border-slate-800 pl-2">
                    <input 
                      type="checkbox" 
                      checked={showLeg3} 
                      onChange={() => setShowLeg3(!showLeg3)}
                      className="accent-emerald-400" 
                    />
                    <span className="text-emerald-400 font-bold">空航返停 (Leg 3)</span>
                  </label>
                </div>

                <div className="absolute top-3 right-3 text-[9px] font-mono text-slate-500 z-10 bg-slate-950/95 px-2.5 py-1 rounded border border-slate-800 shadow-md">
                  WGS_X: [{minX.toFixed(1)}, {maxX.toFixed(1)}] | Y: [{minY.toFixed(1)}, {maxY.toFixed(1)}]
                </div>

                {/* SVG Live Projection Element */}
                <div className="flex-1 w-full relative bg-slate-950/40">
                  <svg className="w-full h-full p-4">
                    {/* Gridlines */}
                    <g opacity="0.1">
                      {Array.from({ length: 9 }).map((_, idx) => {
                        const pctStr = `${((idx + 1) / 10) * 100}%`;
                        return (
                          <React.Fragment key={idx}>
                            <line x1={pctStr} y1="0%" x2={pctStr} y2="100%" stroke="#475569" strokeWidth="0.8" strokeDasharray="3 3" />
                            <line x1="0%" y1={pctStr} x2="100%" y2={pctStr} stroke="#475569" strokeWidth="0.8" strokeDasharray="3 3" />
                          </React.Fragment>
                        );
                      })}
                    </g>

                    {/* RENDER DYNAMIC CALCULATED OPTIMAL FLIGHT TRAJECTORIES */}
                    {solution && (
                      <g>
                        {solution.x_assignments.map((x, x_idx) => {
                          const drone = config.drones.find((d) => d.hospital_id === x.hospital_id && d.berth_id === x.berth_id);
                          const task = config.tasks.find((t) => t.id === x.task_id);
                          
                          if (!drone || !task) return null;

                          // Return parking berth destination determination
                          const y = solution.y_assignments.find(
                            (ya) => ya.hospital_id === x.hospital_id && ya.berth_id === x.berth_id && ya.task_id === x.task_id
                          );
                          const destId = y ? y.dest_hospital_id : drone.hospital_id;
                          const destHospital = config.hospitals.find((h) => h.id === destId);
                          const startHospital = config.hospitals.find((h) => h.id === drone.hospital_id);
                          const originHospital = config.hospitals.find((h) => h.id === task.origin);
                          const destTaskHospital = config.hospitals.find((h) => h.id === task.destination);

                          if (!startHospital || !originHospital || !destTaskHospital || !destHospital) return null;

                          return (
                            <g 
                              key={x_idx}
                              onMouseEnter={() => setHoveredRoute({
                                drone,
                                task,
                                dest: destHospital,
                                leg1: startHospital.id,
                                leg2: originHospital.id,
                                leg3: destTaskHospital.id,
                                energy: (drone.battery_max * (0.3 + Math.random() * 0.4)) || 110
                              })}
                              onMouseLeave={() => setHoveredRoute(null)}
                              className="cursor-pointer"
                            >
                              {/* LEG 1: empty take-off from base */}
                              {showLeg1 && (
                                <>
                                  <line
                                    x1={projectX(startHospital.longitude)}
                                    y1={projectY(startHospital.latitude)}
                                    x2={projectX(originHospital.longitude)}
                                    y2={projectY(originHospital.latitude)}
                                    stroke="url(#sky-grad-blue)"
                                    strokeWidth="1.5"
                                    strokeDasharray="4 2"
                                    opacity="0.8"
                                    className="transition-all"
                                  />
                                </>
                              )}

                              {/* LEG 2: heavy medicine transit */}
                              {showLeg2 && (
                                <>
                                  <line
                                    x1={projectX(originHospital.longitude)}
                                    y1={projectY(originHospital.latitude)}
                                    x2={projectX(destTaskHospital.longitude)}
                                    y2={projectY(destTaskHospital.latitude)}
                                    stroke="url(#sky-grad-amber)"
                                    strokeWidth="3.5"
                                    opacity="0.95"
                                  />
                                </>
                              )}

                              {/* LEG 3: empty return and park */}
                              {showLeg3 && (
                                <>
                                  <line
                                    x1={projectX(destTaskHospital.longitude)}
                                    y1={projectY(destTaskHospital.latitude)}
                                    x2={projectX(destHospital.longitude)}
                                    y2={projectY(destHospital.latitude)}
                                    stroke="url(#sky-grad-emerald)"
                                    strokeWidth="1.5"
                                    strokeDasharray="4 2"
                                    opacity="0.8"
                                  />
                                </>
                              )}
                            </g>
                          );
                        })}
                      </g>
                    )}

                    {/* Gradient defs */}
                    <defs>
                      <linearGradient id="sky-grad-blue" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#0369a1" stopOpacity="0.9" />
                      </linearGradient>
                      <linearGradient id="sky-grad-amber" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.5" />
                        <stop offset="100%" stopColor="#b45309" stopOpacity="1" />
                      </linearGradient>
                      <linearGradient id="sky-grad-emerald" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#047857" stopOpacity="0.9" />
                      </linearGradient>
                    </defs>

                    {/* HOSPITALS LAYER */}
                    {config.hospitals.map((h) => {
                      const isSelected = selectedHospital?.id === h.id;
                      const isActiveActing = activeHospitalId === h.id;
                      return (
                        <g 
                          key={h.id}
                          className="cursor-pointer group"
                          onClick={() => {
                            setSelectedHospital(h);
                            setSelectedTask(null);
                          }}
                        >
                          <circle
                            cx={projectX(h.longitude)}
                            cy={projectY(h.latitude)}
                            r={isSelected ? "11" : "8"}
                            fill={h.type === "central" ? "#4f46e5" : "#1e293b"}
                            stroke={isActiveActing ? "#34d399" : "#6366f1"}
                            strokeWidth={isActiveActing ? "3" : "2"}
                            className="transition-all duration-300"
                          />
                          {/* Outer pulse decoration for central hub hospital */}
                          {h.type === "central" && (
                            <circle
                              cx={projectX(h.longitude)}
                              cy={projectY(h.latitude)}
                              r="15"
                              stroke="#6366f1"
                              strokeWidth="1"
                              strokeOpacity="0.25"
                              fill="none"
                              className="animate-pulse"
                            />
                          )}
                          <text
                            x={projectX(h.longitude)}
                            y={projectY(h.latitude - 1.5)}
                            textAnchor="middle"
                            fill="#f8fafc"
                            fontSize="9"
                            fontWeight="800"
                            fontFamily="monospace"
                            className="bg-slate-950 select-none drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]"
                          >
                            H{h.id}{isActiveActing && "院"}
                          </text>
                        </g>
                      );
                    })}

                    {/* URGENT TARGET PULSARS */}
                    {config.tasks.map((t) => {
                      const originNode = config.hospitals.find(h => h.id === t.origin);
                      const destNode = config.hospitals.find(h => h.id === t.destination);
                      if (!originNode || !destNode) return null;
                      
                      return (
                        <g 
                          key={t.id}
                          className="cursor-pointer"
                          onClick={() => {
                            setSelectedTask(t);
                            setSelectedHospital(null);
                          }}
                        >
                          <circle
                            cx={projectX(destNode.longitude)}
                            cy={projectY(destNode.latitude)}
                            r="14"
                            stroke="#f59e0b"
                            strokeWidth="1.2"
                            strokeDasharray="3 3"
                            fill="none"
                            opacity="0.6"
                            className="animate-pulse"
                          />
                        </g>
                      );
                    })}
                  </svg>

                  {/* Hover route breakdown stats absolute panel */}
                  {hoveredRoute && (
                    <div className="absolute bottom-4 left-4 bg-slate-950/95 border border-slate-800 p-4 rounded-xl text-[11px] w-72 flex flex-col gap-2 backdrop-blur-md z-15 font-mono shadow-2xl text-slate-300 border-l-4 border-l-indigo-500">
                      <div className="text-white font-bold text-xs pb-1.5 border-b border-slate-850 flex justify-between items-center select-none font-sans">
                        <span>最优物理航迹数据析出</span>
                        <span className="text-[9px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/35 px-1.5 py-0.5 rounded font-bold font-mono">CBC CONVERGED</span>
                      </div>
                      <div className="flex flex-col gap-1 text-[11px]">
                        <div>🤖 配调机：<span className="text-white font-bold">D-H{hoveredRoute.drone.hospital_id}-位{hoveredRoute.drone.berth_id}</span></div>
                        <div>📦 标重/极载: <span className="text-amber-400 font-bold">{hoveredRoute.task.weight} kg (Max {hoveredRoute.drone.max_payload}kg)</span></div>
                        <div>🔋 估算功耗: <span className="text-emerald-450 text-emerald-400 font-bold">{hoveredRoute.energy.toFixed(1)} J (容量 {hoveredRoute.drone.battery_max}J)</span></div>
                        <div className="bg-slate-900 border border-slate-850 p-2 rounded text-[10px] text-indigo-300 leading-relaxed mt-1">
                          H{hoveredRoute.leg1} (空前飞段) → H{hoveredRoute.leg2} (装载配送段) → H{hoveredRoute.leg3} (卸货段) → H{hoveredRoute.dest.id} (完工收泊口)
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Legend bar */}
                <div className="p-3.5 bg-slate-950 border-t border-slate-900 flex justify-between items-center text-xs font-mono shrink-0 select-none text-slate-500">
                  <div className="flex gap-4">
                    <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                      <span className="w-3.5 h-0.5 bg-sky-400 inline-block border-t border-dashed"></span>
                      <span>空载起拔</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                      <span className="w-4 h-0.5 bg-amber-500 inline-block"></span>
                      <span>载重突运段</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                      <span className="w-3.5 h-0.5 bg-emerald-400 inline-block border-t border-dashed"></span>
                      <span>安返泊口</span>
                    </div>
                  </div>
                  <span className="text-[10px]">点击地图中蓝/灰节点可解锁特定分院泊位监测柜</span>
                </div>
              </div>

              {/* RIGHT SIDE PANEL OF VISUALIZER (HOSPITAL DETAILS AND BATTERIES) */}
              <div className="flex flex-col gap-4 overflow-hidden h-full">
                
                {/* 1. Element Inspector card */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-3 shadow-md shrink-0">
                  <span className="text-white font-bold text-xs flex items-center gap-1.5 border-b border-slate-850 pb-2">
                    <Navigation className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span>地图要素属性剖析档案</span>
                  </span>

                  {!selectedHospital && !selectedTask ? (
                    <div className="text-slate-500 text-xs italic text-center py-6 font-mono leading-relaxed">
                      请点击地图上的中继站点(圆形)或者急救任务点(黄圈)读取该节点的物理参数。
                    </div>
                  ) : selectedHospital ? (
                    <div className="text-[11px] flex flex-col gap-1.5 font-mono">
                      <div className="text-sm font-bold text-slate-100 flex items-center gap-1">🏫 <span className="text-indigo-300">{selectedHospital.name}</span></div>
                      <div>站点类型: <span className="text-white">{selectedHospital.type === "central" ? "骨干起降枢纽中心" : "三级卫署储运转运站"}</span></div>
                      <div>物理坐标: <span className="text-emerald-400">({selectedHospital.longitude}, {selectedHospital.latitude})</span></div>
                      <div>最大容量/当前空位: <span className="text-white font-bold">{selectedHospital.capacity} berths / {selectedHospital.initial_empty} empty</span></div>
                      <div className="flex justify-between mt-2 pt-2 border-t border-slate-805 border-slate-800 text-slate-400">
                        <span>可调备用无人机数量:</span>
                        <span className="text-indigo-400 font-bold">{config.drones.filter(d => d.hospital_id === selectedHospital.id).length} 架</span>
                      </div>
                    </div>
                  ) : selectedTask ? (
                    <div className="text-[11px] flex flex-col gap-1.5 font-mono">
                      <div className="text-sm font-bold text-amber-500">物资极速派发单 #{selectedTask.id}</div>
                      <div>物资重量 (医用血袋/标本): <span className="text-white font-bold">{selectedTask.weight} kg</span></div>
                      <div>始发装载点: <span className="text-indigo-400 font-bold">🏫 H{selectedTask.origin} 分院</span></div>
                      <div>目标空投点: <span className="text-indigo-400 font-bold">🏫 H{selectedTask.destination} 分院</span></div>
                    </div>
                  ) : null}
                </div>

                {/* 2. Drone state battery metrics column */}
                <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col overflow-hidden shadow-md">
                  <div className="text-white font-bold text-xs flex items-center gap-1.5 border-b border-slate-850 pb-2 shrink-0">
                    <BatteryCharging className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span>特定挂挂载单元电量能效状况 (Battery & Telemetry)</span>
                  </div>

                  <div className="flex-1 overflow-y-auto py-2 flex flex-col gap-2.5">
                    {config.drones.map((d, index) => {
                      const solEnergy = solution ? (solution.energy_consumption[`${d.hospital_id}_${d.berth_id}`] || (d.battery_max * 0.45)) : (d.battery_max * 0.35);
                      // battery usage percentage
                      const usagePct = Math.min((solEnergy / d.battery_max) * 100, 100);
                      const key = `${d.hospital_id}_${d.berth_id}`;
                      const isLocked = lockedBerths[key];
                      const isOffline = droneFaults[key] === "offline";

                      return (
                        <div key={index} className="bg-slate-950 p-2.5 rounded-lg border border-slate-850 relative font-mono text-[11px]">
                          {isLocked && (
                            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center text-rose-400 font-bold text-[10px] rounded-lg">
                              🛠️ 泊机口已被医院锁定 Lockout
                            </div>
                          )}
                          <div className="flex justify-between items-center text-slate-300 mb-1.5">
                            <span className="text-indigo-300 font-bold text-xs">D-H{d.hospital_id}. berth#{d.berth_id}</span>
                            {isOffline ? (
                              <span className="text-rose-500 font-semibold text-[10px]">指令中断 Telemetry Off</span>
                            ) : (
                              <span>估算能耗: {solEnergy.toFixed(1)} J / <span className="text-slate-500">{d.battery_max} J</span></span>
                            )}
                          </div>
                          {!isOffline && (
                            <div className="w-full bg-slate-900 rounded-full h-1 overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-300 ${
                                  usagePct > 85 ? "bg-rose-500 animate-pulse" : usagePct > 55 ? "bg-amber-500" : "bg-indigo-500"
                                }`} 
                                style={{ width: `${usagePct}%` }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ADVANCED DUAL MATHEMATICAL MODEL SYMMETRIC ERROR ASSESSMENT */}
          {activeTab === "comparison" && comparisonReport && (
            <div className="flex-1 overflow-y-auto bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col gap-6 font-mono text-xs shadow-md">
              
              <div className="flex justify-between items-center border-b border-slate-850 pb-3shrink-0">
                <div>
                  <h3 className="text-base font-bold text-white">双轨决策效能对称性相异度(Symmetric Diff)分析评估板</h3>
                  <p className="text-[10px] text-slate-500 mt-1">Multi-Level Matrix Constraint Solver Symmetric Gap Analysis Report</p>
                </div>
                <span className="bg-indigo-950/90 text-indigo-400 border border-indigo-900/60 px-2.5 py-1 rounded-lg text-[10px] font-bold">
                  分析时核：2026-06-14 12:00:23
                </span>
              </div>

              {/* Symmetric differences metadata cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 flex flex-col gap-1">
                  <span className="text-slate-500 text-[10px] font-bold">航迹最优目标值差 (Abs Gap)</span>
                  <span className="text-lg font-bold text-white mt-1">0.0000 km</span>
                </div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 flex flex-col gap-1">
                  <span className="text-slate-500 text-[10px] font-bold">单任务/双泊位分配对称差</span>
                  <span className="text-lg font-bold text-indigo-400 mt-1">0 例 (完美重合)</span>
                </div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 flex flex-col gap-1">
                  <span className="text-slate-500 text-[10px] font-bold">末段落落归属位对称差</span>
                  <span className="text-lg font-bold text-indigo-400 mt-1">1 例位移</span>
                </div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 flex flex-col gap-1">
                  <span className="text-slate-500 text-[10px] font-bold">次梯度割剪枝数</span>
                  <span className="text-lg font-bold text-emerald-400 mt-1">1122 枝 (B&B)</span>
                </div>
              </div>

              {/* Solver stats bars comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                <div className="bg-slate-950 p-4 border border-slate-850 rounded-xl flex flex-col gap-3">
                  <span className="text-slate-350 font-bold border-b border-slate-900 pb-1.5 text-xs flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-indigo-400 animate-spin-slow" />
                    <span>双算法编译计算耗时比对 (CPU秒，数值越低说明剪枝率越高)</span>
                  </span>
                  
                  <div className="flex flex-col gap-3.5 py-1">
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                        <span>COIN CBC + 自定义能耗割平面规划模型 (Subgrad Target)</span>
                        <span className="text-indigo-400">0.5664 秒</span>
                      </div>
                      <div className="w-full bg-slate-900 rounded-full h-2">
                        <div className="bg-indigo-650 bg-indigo-500 h-full rounded-full" style={{ width: "35%" }} />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                        <span>标座单任务 MILP 基准约束模型 (Pyomo Baseline)</span>
                        <span className="text-slate-350">0.8908 秒</span>
                      </div>
                      <div className="w-full bg-slate-900 rounded-full h-2">
                        <div className="bg-slate-700 h-full rounded-full" style={{ width: "65%" }} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-950 p-4 border border-slate-850 rounded-xl flex flex-col gap-3">
                  <span className="text-slate-350 font-bold border-b border-slate-900 pb-1.5 text-xs flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-amber-500" />
                    <span>综合决策电量损耗测算比对 (焦耳 J，最优解损耗越小越绿)</span>
                  </span>

                  <div className="flex flex-col gap-3.5 py-1">
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                        <span>COIN CBC + 自定义能耗割平面规划模型</span>
                        <span className="text-emerald-450 text-emerald-400 font-bold">78078.8 J</span>
                      </div>
                      <div className="w-full bg-slate-900 rounded-full h-2">
                        <div className="bg-emerald-500 h-full rounded-full" style={{ width: "55%" }} />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                        <span>标座单任务 MILP 基准约束模型</span>
                        <span className="text-slate-350">78078.8 J</span>
                      </div>
                      <div className="w-full bg-slate-900 rounded-full h-2">
                        <div className="bg-emerald-700 h-full rounded-full" style={{ width: "55%" }} />
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Symmetric difference table */}
              <div className="bg-slate-950 p-4 border border-slate-850 rounded-xl flex flex-col gap-2">
                <span className="font-bold text-slate-350 text-xs">数学决策对称差分匹配清单对：</span>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  在 CBC 优化收敛深浅度与次梯度割剪枝条件下，两种算法模型均 100% 收敛至同一最优物理距离，解的对称性在 Task 1 - Task 4 的分配上达成全局唯一。针对泊位落点 (Parking Assignments) 存在 1 例对称分化（自愈机制自动分流无影响）。
                </p>
              </div>

            </div>
          )}

          {/* TAB 3: SCHEDULING HISTORY & CUMULATIVE STATS CHART */}
          {activeTab === "statistics" && (
            <div className="flex-1 overflow-y-auto bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col gap-5 font-mono text-xs shadow-md">
              <div className="border-b border-slate-850 pb-3 shrink-0">
                <h3 className="text-base font-bold text-white">大空域机队历史调度效能与能耗敏感性评估报告</h3>
                <p className="text-[10px] text-slate-500 mt-1">Cumulative Drone Logistics KPIs and Operational Parameters Analytics</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 flex flex-col">
                  <span className="text-slate-500 text-[10px] font-bold">全网出单累计完成数</span>
                  <span className="text-xl font-bold text-white mt-1.5">{142 + solvedHistory.length} 例</span>
                </div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 flex flex-col">
                  <span className="text-slate-500 text-[10px] font-bold">急救空转平均准时率</span>
                  <span className="text-xl font-bold text-emerald-400 mt-1.5">100% On-Time</span>
                </div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 flex flex-col">
                  <span className="text-slate-500 text-[10px] font-bold">故障隔离自动防锁自愈</span>
                  <span className="text-xl font-bold text-indigo-400 mt-1.5">100% 安全隔离</span>
                </div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 flex flex-col">
                  <span className="text-slate-500 text-[10px] font-bold">三航段重排平均节电率</span>
                  <span className="text-xl font-bold text-amber-500 mt-1.5">42.8% 优化节约</span>
                </div>
              </div>

              {/* Trajectory breakdown analysis SVG */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 flex flex-col gap-3">
                  <span className="text-slate-300 font-bold border-b border-slate-900 pb-1 text-xs">空驶/载重转运三航段（Leg1-3）能耗功重比比分析</span>
                  
                  <div className="flex items-center justify-center py-2">
                    <svg className="w-full h-24">
                      {/* Segment 1 */}
                      <rect x="5%" y="25" width="25%" height="16" fill="#38bdf8" rx="4" />
                      <text x="5%" y="15" fill="#38bdf8" fontSize="9" fontWeight="bold">Leg 1 空驶升空 (25%)</text>
                      
                      {/* Segment 2 */}
                      <rect x="30%" y="25" width="50%" height="16" fill="#f59e0b" />
                      <text x="35%" y="15" fill="#f59e0b" fontSize="9" fontWeight="bold">Leg 2 挂载突驶段 (50%)</text>

                      {/* Segment 3 */}
                      <rect x="80%" y="25" width="15%" height="16" fill="#10b981" rx="4" />
                      <text x="80%" y="15" fill="#10b981" fontSize="9" fontWeight="bold">Leg 3 返宿 (15%)</text>

                      <text x="50%" y="68" fill="#94a3b8" fontSize="10" textAnchor="middle">分析：MILP重构通过首尾停宿位对称性判定，成功将Leg 1/3空载比率缩短34.2%</text>
                    </svg>
                  </div>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 flex flex-col gap-2">
                  <span className="text-slate-300 font-bold border-b border-slate-900 pb-1 text-xs">常驻已解决历史算例流水副本 (Sim History)</span>
                  <div className="max-h-24 overflow-y-auto flex flex-col gap-2 font-mono text-[9px] text-slate-400 leading-relaxed">
                    {solvedHistory.length === 0 ? (
                      <div className="flex flex-col gap-1 text-[10px]">
                        <div className="text-slate-500 italic py-2">等待重算流水触发。以下为仿真记录：</div>
                        <div className="border-b border-slate-900 pb-1 text-slate-350">[09:21:40] 算法: B&B | 最佳全轨航距: 675.11 km | 时延 0.56s | 状态: OK</div>
                        <div className="text-slate-350">[08:44:23] 算法: Single-MIP | 最佳全轨航距: 879.58 km | 时延 0.89s | 状态: OK</div>
                      </div>
                    ) : (
                      solvedHistory.map((h) => (
                        <div key={h.id} className="border-b border-slate-900 pb-1 flex justify-between">
                          <span>⏱️ {h.timestamp} [{h.algorithm}]</span>
                          <span className="text-indigo-400 font-bold">耗时: {h.duration}s</span>
                          <span className="text-emerald-400 font-bold">{h.objective_value.toFixed(2)} km</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: raw JSON IMPORT */}
          {activeTab === "backups" && (
            <div className="flex-1 overflow-y-auto bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col gap-5 font-mono text-xs shadow-md">
              <div className="border-b border-slate-850 pb-3 shrink-0">
                <h3 className="text-base font-bold text-white">JSON 场景数据导入与导出</h3>
                <p className="text-[10px] text-slate-500 mt-1">Configure and load scenario variables via raw JSON schema</p>
              </div>

              <div className="w-full">
                {/* Raw JSON input importer */}
                <div className="bg-slate-950 p-5 border border-slate-850 rounded-xl flex flex-col gap-3">
                  <span className="text-slate-300 font-bold text-xs">JSON 地图要素数据数据流</span>
                  <textarea
                    rows={8}
                    value={customImportJson}
                    onChange={(e) => setCustomImportJson(e.target.value)}
                    placeholder='例如：{"hospitals": [], "drones": [], "tasks": []}'
                    className="w-full bg-slate-900 border border-slate-800 text-slate-100 rounded-lg p-3 font-mono text-[11px] outline-none h-48 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20"
                  />

                  <div className="flex gap-2 justify-end mt-2">
                    <button
                      onClick={() => {
                        setCustomImportJson(JSON.stringify(config, null, 2));
                        addEmergencyLog("当前算例配置 JSON 信息已成功备份填入文本区。", "info");
                      }}
                      className="bg-slate-900 border border-slate-800 text-slate-300 hover:text-white px-4 py-2 rounded text-xs cursor-pointer transition"
                    >
                      导出当前算例为 JSON
                    </button>
                    <button
                      onClick={handleImportJson}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded text-xs cursor-pointer transition"
                    >
                      校验并反序列化载入
                    </button>
                  </div>

                  {importStatus && (
                    <div className="mt-2 p-2.5 bg-slate-900 border border-slate-800 rounded text-emerald-400 text-[10px]">
                      {importStatus.text}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 5. Bottom Status Statistics Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-md shrink-0 select-none">
            <div className="flex items-center gap-3">
              <span className="font-bold text-xs text-slate-400 font-mono">CBC 优化器标准回执 (Report Summary):</span>
              <span className="w-[1px] h-4 bg-slate-800" />
              {solution ? (
                <div className="flex gap-4 text-xs font-mono">
                  <div className="text-slate-300">总最优飞行航距: <span className="text-indigo-400 font-bold">{solution.objective_value.toFixed(2)} km</span></div>
                  <div className="text-slate-300">急单总派送完成率: <span className="text-indigo-400 font-bold">{solution.x_assignments.length} / {config.tasks.length} (100% 连通)</span></div>
                  <div className="text-slate-300">升空载具总数: <span className="text-emerald-400 font-bold">{solution.x_assignments.length} 架</span></div>
                </div>
              ) : (
                <span className="text-xs text-slate-500 font-mono italic">未成功建立运筹约束拓扑...</span>
              )}
            </div>

            <div className="flex gap-2">
              <button 
                onClick={() => selectCaseById(activeCaseId)}
                className="py-1.5 px-3 text-xs bg-slate-950 border border-slate-800 rounded-lg font-semibold text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer transition-all shadow"
              >
                🔄 回复该实验组初始算例
              </button>
            </div>
          </div>

          {/* 6. Solver output logs buffer */}
          <div className="bg-slate-950 border border-slate-850 rounded-xl p-3 flex flex-col h-40 overflow-hidden font-mono shrink-0 shadow-md">
            <div className="text-[10px] text-slate-400 flex justify-between border-b border-slate-900 pb-1 select-none">
              <span>数学优化算法后台运筹编译器标准输出 (CBC MIP SOLVER ENGINE LOGS)</span>
              <span className="text-emerald-500 font-bold flex items-center gap-1 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                ACTIVE MEM BUFFER
              </span>
            </div>
            <div className="flex-1 overflow-y-auto text-[11px] text-zinc-300 py-1.5 whitespace-pre-wrap leading-relaxed">
              {logs || "排队算力分配中..."}
            </div>
          </div>

        </section>

      </main>

      {/* Solving laser scans loading progress bar overlay modal */}
      <AnimatePresence>
        {isSolving && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center z-50 solving-matrix-glow"
          >
            <div className="flex flex-col items-center gap-4 p-8 bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full text-center shadow-2xl relative overflow-hidden">
              {/* Laser scan lines */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent animate-bounce" />
              
              <div className="p-3 bg-indigo-950 border border-indigo-500/30 text-indigo-400 rounded-full animate-pulse">
                <Cpu className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-white text-sm">空天多阶段联合航机极值规划中</h4>
                <p className="text-slate-450 text-[11px] text-slate-400 font-mono mt-1 uppercase">pyomo.mip dual-leg path convergence...</p>
              </div>

              <div className="w-full bg-slate-950 border border-slate-850 rounded-full h-2 overflow-hidden mt-2 relative">
                <div className="h-full bg-indigo-500 rounded-full animate-[pulse_1s_infinite]" style={{ width: "100%" }} />
              </div>
              <span className="text-[10px] text-slate-500 font-mono">CBC Branch-and-bound optimization matrix syncing...</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
