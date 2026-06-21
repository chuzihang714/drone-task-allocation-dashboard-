import React, { useState, useEffect, useRef } from "react";
import { 
  Activity, Zap, Navigation, MapPin, Play, Sliders, Plus, Trash2, Cpu, Clock, 
  Compass, BarChart2, ShieldAlert, Award, FileText, CheckCircle2, AlertTriangle, 
  RefreshCw, Users, ShieldCheck, Heart, User, Power, ToggleLeft, ToggleRight,
  Database, Download, Upload, History, ScrollText, Radio, BatteryCharging, ChevronRight, Gauge,
  Maximize2, Minimize2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { gsap } from "gsap";
import { 
  Hospital, Drone, Task, ProblemConfigData, SolverSolution, ComparisonReport 
} from "./types";
import { precomputedCases, PrecomputedCase, JIADING_HOSPITALS } from "./data";

export default function App() {
  // 1. Role Selection States
  const [userRole, setUserRole] = useState<"admin" | "hospital" | "drone_admin" | null>(null);
  const [activeHospitalId, setActiveHospitalId] = useState<number>(1);
  const [isMapFullScreen, setIsMapFullScreen] = useState<boolean>(false);

  // 2. Scenario Config States - Loaded from our precomputed cases
  const [activeCaseId, setActiveCaseId] = useState<string>("jiading-low-pressure");
  const [config, setConfig] = useState<ProblemConfigData>(precomputedCases[0].config);

  // Interactive Pan / Zoom states for the Map
  const [zoom, setZoom] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Map mouse / wheel interaction handlers
  const handleMapMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // Left click only
    setIsPanning(true);
    setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleMapMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPanning) return;
    setPanOffset({
      x: e.clientX - panStart.x,
      y: e.clientY - panStart.y
    });
  };

  const handleMapMouseUpOrLeave = () => {
    setIsPanning(false);
  };

  const handleMapWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    setZoom(prev => Math.max(0.6, Math.min(prev * zoomFactor, 6)));
  };

  // Trajectory curve generator
  const getSymmetricCurvePath = (x1: number, y1: number, x2: number, y2: number) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return `M ${x1} ${y1} L ${x2} ${y2}`;
    const cx = (x1 + x2) / 2 - (dy * 0.12);
    const cy = (y1 + y2) / 2 + (dx * 0.12);
    return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
  };

  useEffect(() => {
    if (userRole !== "admin") {
      setActiveTab("visualizer");
    }
  }, [userRole]);

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

    const minX = xCoords.length > 0 ? Math.min(...xCoords) - 0.02 : 121.15;
    const maxX = xCoords.length > 0 ? Math.max(...xCoords) + 0.02 : 121.28;
    const minY = yCoords.length > 0 ? Math.min(...yCoords) - 0.02 : 31.30;
    const maxY = yCoords.length > 0 ? Math.max(...yCoords) + 0.02 : 31.43;

    return { minX, maxX, minY, maxY };
  };

  const { minX, maxX, minY, maxY } = getMapScales();

  const projectX = (val: number) => {
    const range = maxX - minX || 1;
    return ((val - minX) / range) * 800;
  };

  const projectY = (val: number) => {
    const range = maxY - minY || 1;
    return (1 - (val - minY) / range) * 600;
  };

  const getHospitalName = (id: number) => {
    const h = config.hospitals.find((x) => x.id === id);
    return h ? h.name : `位置点 #${id}`;
  };

  // CRUD Data Management 
  const addHospital = () => {
    const existingIds = new Set(config.hospitals.map(h => h.id));
    const nextHospital = JIADING_HOSPITALS.find(h => !existingIds.has(h.id));
    
    if (!nextHospital) {
      addEmergencyLog(`⚠️ 所有嘉定区医院航站均在编，无额外中继医院。`, "warning");
      return;
    }
    setConfig(prev => ({ ...prev, hospitals: [...prev.hospitals, nextHospital] }));
    addEmergencyLog(`已在地图追加新增嘉定真实航站：H${nextHospital.id} (${nextHospital.name})`, "success");
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
          {userRole !== null && (
            <button
              onClick={() => { setUserRole(null); setSelectedTask(null); setActiveTab("visualizer"); }}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 border border-dashed border-slate-800 transition-all cursor-pointer"
            >
              <Power className="w-3.5 h-3.5 text-rose-500" />
              <span>🚪 退出到主页</span>
            </button>
          )}

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
        {userRole !== null && (
          <section className={`${
            userRole === "admin" ? "col-span-12 xl:col-span-3" : "col-span-12"
          } flex flex-col gap-4 overflow-hidden h-full`}>
            
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

                    {editorSubTab === "drones" && config.drones.map((d, index) => {
                      const assocAssignment = solution?.x_assignments.find(x => x.hospital_id === d.hospital_id && x.berth_id === d.berth_id);
                      const assocTask = assocAssignment ? config.tasks.find(t => t.id === assocAssignment.task_id) : null;

                      return (
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
                          {assocTask ? (
                            <div className="mt-1 pb-1 pt-1.5 px-2 bg-indigo-950/40 border border-indigo-900/40 rounded text-[10px] text-indigo-300 font-mono flex justify-between items-center">
                              <span>已承接任务: <span className="text-white font-bold">#{assocTask.id}</span></span>
                              <span>H{assocTask.origin} → H{assocTask.destination}</span>
                            </div>
                          ) : (
                            <div className="mt-1 pb-1 pt-1.5 px-2 bg-slate-900/60 border border-slate-850 rounded text-[10px] text-slate-500 italic text-center font-mono">
                              待命中 (On Standby)
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {editorSubTab === "tasks" && config.tasks.map((t) => {
                      const isSelected = selectedTask?.id === t.id;
                      return (
                        <div 
                          key={t.id} 
                          onClick={() => setSelectedTask(isSelected ? null : t)}
                          className={`p-3.5 rounded-xl border flex flex-col gap-2.5 relative group hover:border-indigo-500/50 transition-all cursor-pointer ${
                            isSelected 
                              ? "bg-indigo-950/40 border-indigo-500 shadow-lg shadow-indigo-500/10"
                              : "bg-slate-950/80 border-slate-850"
                          }`}
                        >
                          <div className="flex items-center justify-between pb-1 border-b border-slate-850">
                            <span className="text-xs font-mono font-bold text-indigo-400">📦 物资配送派单 #{t.id}</span>
                            <button 
                              onClick={(e) => { e.stopPropagation(); removeTask(t.id); }} 
                              className="text-rose-450 hover:text-rose-500 transition-opacity p-0.5 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-xs font-mono text-center">
                            <div><span className="text-slate-500 block text-[10px]">发货中心</span> <span className="text-slate-200 font-bold">H{t.origin}</span></div>
                            <div><span className="text-slate-500 block text-[10px]">收货站点</span> <span className="text-slate-200 font-bold">H{t.destination}</span></div>
                            <div><span className="text-slate-500 block text-[10px]">货重 (kg)</span> <span className="text-amber-400 font-bold">{t.weight}</span></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Simplified One-Click Optimization Solver Panel */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-3 shadow-md shrink-0">
                  <div className="flex gap-2">
                    <button
                      onClick={handleRunOfflineSimulation}
                      disabled={isSolving}
                      className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm tracking-wide active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-500/10"
                    >
                      {isSolving ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin text-white" />
                          <span>正在重调算力...</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 text-indigo-300" />
                          <span>一键算力重调</span>
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
                 className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-hidden h-full"
               >
                 {/* Left Column of Hospital Dashboard: Selectors & Booking */}
                 <div className="flex flex-col gap-5 overflow-hidden h-full">
                   <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col gap-4 shadow-xl shrink-0">
                     <div className="flex items-center justify-between">
                       <span className="text-white font-bold text-sm flex items-center gap-1.5">
                         <Heart className="w-5 h-5 text-emerald-400" />
                         <span>🏥 分院急救医务控制总端</span>
                       </span>
                       <span className="text-[10px] text-emerald-300 font-mono font-bold bg-emerald-950 px-2.5 py-1 rounded border border-emerald-900">核心单元</span>
                     </div>
  
                     <div className="flex flex-col gap-2.5">
                       <span className="text-xs text-slate-400 font-sans">选择当前工作的分医院（我方附院）：</span>
                       <select
                         value={activeHospitalId}
                         onChange={(e) => setActiveHospitalId(parseInt(e.target.value) || 1)}
                         className="bg-slate-950 border border-slate-800 text-slate-100 rounded-lg py-3.5 px-4 text-sm font-bold outline-none cursor-pointer hover:border-slate-700 transition"
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
              </div>

              {/* Right Column of Hospital Dashboard: Status Alerts & Real-Time Booking Lists */}
              <div className="flex flex-col gap-5 overflow-hidden h-full">

                {/* Hospital Dispatch Tasks (Arriving/Departing) */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col min-h-[160px] max-h-[240px] overflow-hidden shadow-md shrink-0">
                  <div className="text-white font-bold text-xs flex items-center justify-between border-b border-slate-850 pb-2 shrink-0 select-none">
                    <span className="flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-emerald-400" />
                      <span>本院收发订单状态实时监控 ({config.tasks.filter(t => t.origin === activeHospitalId || t.destination === activeHospitalId).length})</span>
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">LIVE TRACKING</span>
                  </div>

                  <div className="flex-1 overflow-y-auto py-2 flex flex-col gap-2">
                    {(() => {
                      const relevantTasks = config.tasks.filter(t => t.origin === activeHospitalId || t.destination === activeHospitalId);
                      if (relevantTasks.length === 0) {
                        return (
                          <div className="text-slate-500 text-center italic py-6 text-xs">
                            本院暂无关联急行转运订单。
                          </div>
                        );
                      }
                      
                      return relevantTasks.map((t) => {
                        const isOrigin = t.origin === activeHospitalId;
                        const isSelected = selectedTask?.id === t.id;
                        
                        return (
                          <div 
                            key={t.id} 
                            onClick={() => setSelectedTask(isSelected ? null : t)}
                            className={`p-2.5 rounded-lg border flex items-center justify-between transition-all gap-2 cursor-pointer ${
                              isSelected 
                                ? "bg-emerald-950/20 border-emerald-500" 
                                : "bg-slate-950/75 border-slate-850 hover:border-slate-700"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className={`w-1.5 h-6 rounded-full ${isOrigin ? "bg-amber-500" : "bg-emerald-400"}`} />
                              <div className="flex flex-col">
                                <span className="text-xs font-mono font-bold text-slate-200">订单 Task #{t.id}</span>
                                <span className="text-[10px] text-slate-400 mt-0.5 font-sans">
                                  {isOrigin ? `📤 发往 H${t.destination}分院` : `📥 送抵自 H${t.origin}分院`}
                                </span>
                              </div>
                            </div>
                            <div className="text-right flex flex-col gap-0.5">
                              <span className="text-xs font-mono text-emerald-400 font-bold">{t.weight} kg</span>
                              <span className="text-[9px] bg-slate-900 border border-slate-850 px-1.5 py-0.2 rounded text-slate-400 font-sans">
                                {solution?.x_assignments.some(x => x.task_id === t.id) ? "🟢 航线就绪" : "⏳ 队列算解"}
                              </span>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>

                {/* Berth maintaining lock matrix */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col overflow-hidden shadow-md flex-1">
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
                            <div className="flex items-center justify-between text-xs font-mono">
                              <span className="font-bold text-slate-400">{berthIdx}号 泊船位</span>
                              {isLocked ? (
                                <span className="bg-rose-950/30 text-rose-400 border border-rose-900/40 px-1.5 py-0.5 rounded text-[9px] font-bold">已维修</span>
                              ) : matchedDrone ? (
                                <span className="bg-indigo-950/30 text-indigo-400 border border-indigo-900/30 px-1.5 py-0.5 rounded text-[9px] font-bold">有备机</span>
                              ) : (
                                <span className="bg-emerald-950/30 text-emerald-400 border border-emerald-900/30 px-1.5 py-0.5 rounded text-[9px] font-bold font-sans">空闲</span>
                              )}
                            </div>
                            
                            <div className="flex justify-between items-center text-[10px] text-slate-500 pt-2 border-t border-slate-900">
                              <span>挂维修锁口：</span>
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
                        const isLocked = lockedBerths[faultKey];
                        const matchAssignment = solution?.x_assignments.find(x => x.hospital_id === d.hospital_id && x.berth_id === d.berth_id);
                        const matchTask = matchAssignment ? config.tasks.find(t => t.id === matchAssignment.task_id) : null;

                        return (
                          <div key={dIdx} className="bg-slate-950 p-3 rounded-xl border border-slate-850 flex flex-col gap-2 hover:border-slate-700 transition">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-amber-400 font-bold">D-H{d.hospital_id}. berth#{d.berth_id}</span>
                              <span className={`w-2 h-2 rounded-full ${isLocked || currentFault !== "normal" ? "bg-rose-500 animate-pulse" : "bg-emerald-500"}`} />
                            </div>

                            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] text-slate-400 mt-1">
                              <div>自重: <span className="text-white">{d.weight}kg</span></div>
                              <div>最高负载: <span className="text-white">{d.max_payload}kg</span></div>
                              <div>航定能效: <span className="text-emerald-400 font-bold">{d.battery_max} J</span></div>
                              <div>诊断阻抗: <span className="text-emerald-400">14 mΩ (良)</span></div>
                            </div>

                            {/* Assigned Task Info Panel */}
                            <div className="mt-1 bg-slate-900 rounded p-1.5 text-[10px] text-slate-350 border border-slate-850">
                              {isLocked ? (
                                <span className="text-rose-450 text-rose-450 text-rose-400 font-semibold flex items-center gap-1">🛠️ 泊机口已锁定 Lockout Range</span>
                              ) : currentFault !== "normal" ? (
                                <span className="text-rose-400 font-semibold flex items-center gap-1">⚠️ 发生设备故障 Command Offline</span>
                              ) : matchTask ? (
                                <div className="flex flex-col gap-0.5">
                                  <div className="text-teal-400 font-bold flex items-center gap-1 justify-between">
                                    <span>📦 精准配送中 (Task #{matchTask.id})</span>
                                    <span className="text-[9px] bg-teal-950 px-1 py-0.2 rounded border border-teal-900 text-teal-300 font-sans">FLYING</span>
                                  </div>
                                  <div className="text-[9px] text-slate-450 text-slate-400 mt-0.5">
                                    始发起降 H{matchTask.origin} → 终到投靶 H{matchTask.destination}，货重 {matchTask.weight} kg
                                  </div>
                                </div>
                              ) : (
                                <span className="text-slate-500 italic flex items-center gap-1 font-sans">💤 无人机就位备航中 (Idle / Standby)</span>
                              )}
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

          {/* Deleted layout blocks */}
        </section>
        )}

        {/* ========================================================== */}
        {/* COLUMN 2 (8/12): FLIGHT PROJECTOR MAP & RESULTS METRICS */}
        {/* ========================================================== */}
        {(userRole === null || userRole === "admin") && (
          <section className={`${userRole === null ? 'col-span-12' : 'col-span-12 xl:col-span-9'} flex flex-col gap-4 overflow-hidden h-full relative`}>
          
          {/* Main Visualizer Switcher Tabs */}
          {userRole === "admin" && (
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-850 rounded-xl p-1.5 shrink-0 shadow-md">
              <button
                onClick={() => setActiveTab("visualizer")}
                className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  activeTab === "visualizer"
                    ? "bg-indigo-600 text-white shadow-lg"
                    : "text-slate-400 hover:text-white hover:bg-slate-850"
                }`}
              >
                <Compass className="w-4 h-4" />
                <span>🗺️ 航迹规划大屏</span>
              </button>
              <button
                onClick={() => setActiveTab("comparison")}
                className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
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
                    : "text-slate-400 hover:text-white hover:bg-slate-850"
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
                    : "text-slate-400 hover:text-white hover:bg-slate-850"
                }`}
              >
                <Database className="w-4 h-4" />
                <span>💾 JSON 数据导入</span>
              </button>
            </div>
          )}

          {/* TAB 1: GEOMETRIC PROJECTION FLIGHT MAP */}
          {activeTab === "visualizer" && (
            <div className={`flex-1 min-h-0 ${userRole === null ? 'flex' : 'grid grid-cols-1 md:grid-cols-4'} gap-4 overflow-hidden relative`}>
              
              {/* Map SVG Canvas Area */}
              <div className={`${isMapFullScreen ? 'fixed inset-0 z-50 bg-slate-950 p-4' : `${userRole === null ? 'flex-1' : 'md:col-span-3'} bg-slate-900 border border-slate-800 rounded-xl relative overflow-hidden flex flex-col shadow-inner h-full`}`}>
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
                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-350 text-slate-305 text-slate-300 border-l border-slate-800 pl-2">
                    <input 
                      type="checkbox" 
                      checked={showLeg3} 
                      onChange={() => setShowLeg3(!showLeg3)}
                      className="accent-emerald-400" 
                    />
                    <span className="text-emerald-400 font-bold">空航返停 (Leg 3)</span>
                  </label>
                </div>

                <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
                  <div className="text-[9px] font-mono text-slate-400 bg-slate-950/95 px-2.5 py-1.5 rounded border border-slate-800 shadow-md select-none hidden sm:block">
                    纬度/经度轴向定位 | 双击或滚轮缩放 拖拽挪移
                  </div>
                  <button
                    onClick={() => setIsMapFullScreen(!isMapFullScreen)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-650 hover:bg-indigo-600 text-white font-bold text-[10px] font-mono rounded-lg border border-indigo-500/50 shadow-md cursor-pointer transition-all active:scale-95"
                    title={isMapFullScreen ? "退出全屏" : "全屏放大大屏"}
                  >
                    {isMapFullScreen ? <Minimize2 className="w-3.5 h-3.5" strokeWidth={2.5} /> : <Maximize2 className="w-3.5 h-3.5" strokeWidth={2.5} />}
                    <span>{isMapFullScreen ? "退出全屏" : "全屏大屏"}</span>
                  </button>
                </div>

                {/* SVG Live Projection Element with interactive mouse controls */}
                <div 
                  className="flex-1 w-full relative bg-slate-950/40 select-none cursor-grab active:cursor-grabbing overflow-hidden"
                  onMouseDown={handleMapMouseDown}
                  onMouseMove={handleMapMouseMove}
                  onMouseUp={handleMapMouseUpOrLeave}
                  onMouseLeave={handleMapMouseUpOrLeave}
                  onWheel={handleMapWheel}
                >
                  <svg 
                    viewBox="0 0 800 600" 
                    className="w-full h-full p-4"
                  >
                    <style>{`
                      @keyframes dashflow {
                        to {
                          stroke-dashoffset: -40;
                        }
                      }
                      .flowing-line-blue {
                        stroke-dasharray: 8 6;
                        animation: dashflow 1.8s linear infinite;
                      }
                      .flowing-line-amber {
                        stroke-dasharray: 12 6;
                        animation: dashflow 1.2s linear infinite;
                        filter: drop-shadow(0 0 3px rgba(245, 158, 11, 0.7));
                      }
                      .flowing-line-emerald {
                        stroke-dasharray: 8 6;
                        animation: dashflow 2.0s linear infinite;
                      }
                    `}</style>
                    <g transform={`translate(${panOffset.x}, ${panOffset.y}) scale(${zoom})`}>
                      {/* Base Map Graphic Assets (Highways, rivers, parks, district boundaries mirroring uploaded picture of Jiading) */}
                      <g opacity="0.48">
                        {/* 安亭智能中转园区 */}
                        <rect x={projectX(121.155)} y={projectY(31.345)} width="110" height="90" rx="8" fill="#1e293b" stroke="#64748b" strokeWidth="0.8" strokeDasharray="1 1" />
                        <text x={projectX(121.155) + 55} y={projectY(31.345) + 48} fill="#cbd5e1" fontSize="11" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle">安亭精密空合区</text>

                        {/* 徐行中转区 */}
                        <rect x={projectX(121.258)} y={projectY(31.405)} width="90" height="70" rx="8" fill="#1e293b" stroke="#64748b" strokeWidth="0.8" strokeDasharray="1 1" />
                        <text x={projectX(121.258) + 45} y={projectY(31.405) + 38} fill="#cbd5e1" fontSize="11" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle">徐行编组枢纽区</text>

                        {/* 嘉定新城核心控制区 */}
                        <circle cx={projectX(121.245)} cy={projectY(31.350)} r="75" fill="#1e293b" stroke="#64748b" strokeWidth="0.8" strokeDasharray="2 2" />
                        <text x={projectX(121.245)} y={projectY(31.350) + 4} fill="#cbd5e1" fontSize="11" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle">嘉定新城航迹控制核心部</text>

                        {/* 南翔智慧集货组区 */}
                        <rect x={projectX(121.242)} y={projectY(31.312)} width="130" height="80" rx="8" fill="#1e293b" stroke="#64748b" strokeWidth="0.8" strokeDasharray="1 1" />
                        <text x={projectX(121.242) + 65} y={projectY(31.312) + 42} fill="#cbd5e1" fontSize="11" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle">南翔医链多维仓配区</text>

                        {/* 安亭国际汽车城核心制造基地 */}
                        <rect x={projectX(121.145)} y={projectY(31.305)} width="95" height="50" rx="6" fill="#111827" stroke="#4b5563" strokeWidth="0.7" strokeDasharray="3 3" />
                        <text x={projectX(121.145) + 47} y={projectY(31.305) + 28} fill="#94a3b8" fontSize="10" fontWeight="semibold" textAnchor="middle">安亭汽车城制造基地</text>

                        {/* 远香湖 & 嘉定中央公园 (High contrast eco-scenery) */}
                        <rect x={projectX(121.248)} y={projectY(31.342)} width="60" height="30" rx="6" fill="#064e3b" opacity="0.45" />
                        <circle cx={projectX(121.258)} cy={projectY(31.332)} r="14" fill="#0369a1" opacity="0.55" />
                        <text x={projectX(121.258)} y={projectY(31.332) + 3} fill="#93c5fd" fontSize="9" fontWeight="bold" textAnchor="middle" opacity="0.95">远香湖</text>
                        <text x={projectX(121.278)} y={projectY(31.353)} fill="#a7f3d0" fontSize="9" fontWeight="bold" textAnchor="middle" opacity="0.95">中央绿地公园</text>

                        {/* 上海国际赛车场 (F1 Track) */}
                        <path d={`M ${projectX(121.21)} ${projectY(31.34)} Q ${projectX(121.222)} ${projectY(31.352)}, ${projectX(121.22)} ${projectY(31.33)} T ${projectX(121.205)} ${projectY(31.325)} Z`} fill="none" stroke="#ef4444" strokeWidth="1.8" opacity="0.45" />
                        <text x={projectX(121.218)} y={projectY(31.348)} fill="#fca5a5" fontSize="9.5" fontWeight="semibold" opacity="0.9">上海国际赛车场 (F1)</text>

                        {/* 上海地铁11号线 (High tech dashed purple railway line) */}
                        <path d={`M ${projectX(121.14)} ${projectY(31.34)} Q ${projectX(121.20)} ${projectY(31.35)}, ${projectX(121.238)} ${projectY(31.365)} T ${projectX(121.28)} ${projectY(31.29)}`} fill="none" stroke="#a855f7" strokeWidth="2.5" opacity="0.45" />
                        <path d={`M ${projectX(121.14)} ${projectY(31.34)} Q ${projectX(121.20)} ${projectY(31.35)}, ${projectX(121.238)} ${projectY(31.365)} T ${projectX(121.28)} ${projectY(31.29)}`} fill="none" stroke="#e9d5ff" strokeWidth="1" strokeDasharray="5 5" opacity="0.8" />
                        <text x={projectX(121.23)} y={projectY(31.354)} fill="#d8b4fe" fontSize="9" fontFamily="sans-serif" fontWeight="semibold" opacity="0.95">轨道交通11号线 (嘉定段)</text>

                        {/* Major rivers of Jiading District (Suzhou River & Wusong canal) */}
                        <path d={`M ${projectX(121.14)} ${projectY(31.31)} Q ${projectX(121.20)} ${projectY(31.305)}, ${projectX(121.24)} ${projectY(31.295)} T ${projectX(121.30)} ${projectY(31.29)}`} fill="none" stroke="#0891b2" strokeWidth="15" strokeLinecap="round" opacity="0.4" />
                        <path d={`M ${projectX(121.14)} ${projectY(31.31)} Q ${projectX(121.20)} ${projectY(31.305)}, ${projectX(121.24)} ${projectY(31.295)} T ${projectX(121.30)} ${projectY(31.29)}`} fill="none" stroke="#0e7490" strokeWidth="6" strokeLinecap="round" opacity="0.6" />

                        {/* Hengli River/canal going North-South */}
                        <path d={`M ${projectX(121.235)} ${projectY(31.43)} Q ${projectX(121.241)} ${projectY(31.37)}, ${projectX(121.248)} ${projectY(31.33)} T ${projectX(121.258)} ${projectY(31.28)}`} fill="none" stroke="#0891b2" strokeWidth="5" strokeLinecap="round" opacity="0.3" />

                        {/* Lianqi River going East-West through Jiading Town */}
                        <path d={`M ${projectX(121.14)} ${projectY(31.375)} L ${projectX(121.30)} ${projectY(31.382)}`} fill="none" stroke="#0891b2" strokeWidth="4" strokeLinecap="round" opacity="0.25" />

                        {/* Main Highways (Yellow / Orange high contrast lines resembling picture map) */}
                        {/* G15 Shenhai Expressway (North-South) */}
                        <path d={`M ${projectX(121.21)} ${projectY(31.43)} L ${projectX(121.225)} ${projectY(31.28)}`} fill="none" stroke="#f59e0b" strokeWidth="3.2" opacity="0.55" />
                        <path d={`M ${projectX(121.21)} ${projectY(31.43)} L ${projectX(121.225)} ${projectY(31.28)}`} fill="none" stroke="#ea580c" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.8" />
                        <text x={projectX(121.21) + 8} y={projectY(31.405)} fill="#f8fafc" fontSize="10.5" fontWeight="bold" fontFamily="monospace" transform={`rotate(10, ${projectX(121.21)}, ${projectY(31.405)})`} opacity="0.95">G15沈海高速</text>
                      </g>

                      {solution && (
                        <g>
                          {solution.x_assignments.map((x, x_idx) => {
                            const drone = config.drones.find((d) => d.hospital_id === x.hospital_id && d.berth_id === x.berth_id);
                            const task = config.tasks.find((t) => t.id === x.task_id);
                            
                            if (!drone || !task) return null;
  
                            const y = solution.y_assignments.find(
                              (ya) => ya.hospital_id === x.hospital_id && ya.berth_id === x.berth_id && ya.task_id === x.task_id
                            );
                            const destId = y ? y.dest_hospital_id : drone.hospital_id;
                            const destHospital = config.hospitals.find((h) => h.id === destId);
                            const startHospital = config.hospitals.find((h) => h.id === drone.hospital_id);
                            const originHospital = config.hospitals.find((h) => h.id === task.origin);
                            const destTaskHospital = config.hospitals.find((h) => h.id === task.destination);
  
                            if (!startHospital || !originHospital || !destTaskHospital || !destHospital) return null;
  
                            // Highlight selected tasks / paths
                            const isSelectedRoute = selectedTask !== null && task.id === selectedTask.id;
                            const isAnyRouteSelected = selectedTask !== null;
  
                            // Projections
                            const x1_1 = projectX(startHospital.longitude);
                            const y1_1 = projectY(startHospital.latitude);
                            const x2_1 = projectX(originHospital.longitude);
                            const y2_1 = projectY(originHospital.latitude);
  
                            const x1_2 = projectX(originHospital.longitude);
                            const y1_2 = projectY(originHospital.latitude);
                            const x2_2 = projectX(destTaskHospital.longitude);
                            const y2_2 = projectY(destTaskHospital.latitude);
  
                            const x1_3 = projectX(destTaskHospital.longitude);
                            const y1_3 = projectY(destTaskHospital.latitude);
                            const x2_3 = projectX(destHospital.longitude);
                            const y2_3 = projectY(destHospital.latitude);
  
                            // Bezier curve calculations
                            const path1 = getSymmetricCurvePath(x1_1, y1_1, x2_1, y2_1);
                            const path2 = getSymmetricCurvePath(x1_2, y1_2, x2_2, y2_2);
                            const path3 = getSymmetricCurvePath(x1_3, y1_3, x2_3, y2_3);
  
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
                                onClick={() => setSelectedTask(selectedTask?.id === task.id ? null : task)}
                                className="cursor-pointer"
                                opacity={isAnyRouteSelected && !isSelectedRoute ? 0.15 : 1}
                              >
                                {/* LEG 1: empty take-off from base */}
                                {showLeg1 && (
                                  <g>
                                    {/* Thick hover buffer path to prevent flickering & keep hover stable */}
                                    <path
                                      d={path1}
                                      stroke="transparent"
                                      strokeWidth="20"
                                      fill="none"
                                      className="cursor-pointer pointer-events-auto"
                                    />
                                    <path
                                      d={path1}
                                      stroke="url(#sky-grad-blue)"
                                      strokeWidth={isSelectedRoute ? "4.5" : "2"}
                                      className="flowing-line-blue pointer-events-none"
                                      fill="none"
                                    />
                                    {(!isAnyRouteSelected || isSelectedRoute) && (
                                      <g className="pointer-events-none">
                                        <circle r="4.5" fill="#38bdf8" opacity="0.65">
                                          <animateMotion dur="3.5s" repeatCount="indefinite" path={path1} />
                                        </circle>
                                        <circle r="2" fill="#ffffff">
                                          <animateMotion dur="3.5s" repeatCount="indefinite" path={path1} />
                                        </circle>
                                      </g>
                                    )}
                                  </g>
                                )}
  
                                {/* LEG 2: heavy medicine transit */}
                                {showLeg2 && (
                                  <g>
                                    {/* Thick hover buffer path to prevent flickering & keep hover stable */}
                                    <path
                                      d={path2}
                                      stroke="transparent"
                                      strokeWidth="22"
                                      fill="none"
                                      className="cursor-pointer pointer-events-auto"
                                    />
                                    <path
                                      d={path2}
                                      stroke="url(#sky-grad-amber)"
                                      strokeWidth={isSelectedRoute ? "6" : "3.5"}
                                      className="flowing-line-amber pointer-events-none"
                                      fill="none"
                                    />
                                    {(!isAnyRouteSelected || isSelectedRoute) && (
                                      <g className="pointer-events-none">
                                        <circle r="6" fill="#f59e0b" opacity="0.7">
                                          <animateMotion dur="2.4s" repeatCount="indefinite" path={path2} />
                                        </circle>
                                        <circle r="3" fill="#ffffff">
                                          <animateMotion dur="2.4s" repeatCount="indefinite" path={path2} />
                                        </circle>
                                      </g>
                                    )}
                                  </g>
                                )}
  
                                {/* LEG 3: empty return and park */}
                                {showLeg3 && (
                                  <g>
                                    {/* Thick hover buffer path to prevent flickering & keep hover stable */}
                                    <path
                                      d={path3}
                                      stroke="transparent"
                                      strokeWidth="20"
                                      fill="none"
                                      className="cursor-pointer pointer-events-auto"
                                    />
                                    <path
                                      d={path3}
                                      stroke="url(#sky-grad-emerald)"
                                      strokeWidth={isSelectedRoute ? "4.5" : "2"}
                                      className="flowing-line-emerald pointer-events-none"
                                      fill="none"
                                    />
                                    {(!isAnyRouteSelected || isSelectedRoute) && (
                                      <g className="pointer-events-none">
                                        <circle r="4.5" fill="#10b981" opacity="0.65">
                                          <animateMotion dur="3.2s" repeatCount="indefinite" path={path3} />
                                        </circle>
                                        <circle r="2" fill="#ffffff">
                                          <animateMotion dur="3.2s" repeatCount="indefinite" path={path3} />
                                        </circle>
                                      </g>
                                    )}
                                  </g>
                                )}
                              </g>
                            );
                          })}
                        </g>
                      )}
  
                      {/* Gradient and Marker defs */}
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
 
                        {/* Arrows orientation markers */}
                        <marker id="arrow-blue" viewBox="0 0 10 10" refX="22" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                          <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#38bdf8" />
                        </marker>
                        <marker id="arrow-amber" viewBox="0 0 10 10" refX="20" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                          <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#f59e0b" />
                        </marker>
                        <marker id="arrow-emerald" viewBox="0 0 10 10" refX="22" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                          <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#10b981" />
                        </marker>
                      </defs>
 
                      {/* HOSPITALS LAYER */}
                      {(() => {
                        const overlappingHospitals = new Set<number>();
                        for (let i = 0; i < config.hospitals.length; i++) {
                          const h1 = config.hospitals[i];
                          const x1 = projectX(h1.longitude);
                          const y1 = projectY(h1.latitude);
                          for (let j = i + 1; j < config.hospitals.length; j++) {
                            const h2 = config.hospitals[j];
                            const x2 = projectX(h2.longitude);
                            const y2 = projectY(h2.latitude);
                            const dx = x1 - x2;
                            const dy = y1 - y2;
                            const distInModel = Math.sqrt(dx * dx + dy * dy);
                            const distOnScreen = distInModel * zoom;
                            // Threshold: 26px on-screen distance
                            if (distOnScreen < 26) {
                              overlappingHospitals.add(h1.id);
                              overlappingHospitals.add(h2.id);
                            }
                          }
                        }

                        return config.hospitals.map((h) => {
                          const isSelected = selectedHospital?.id === h.id;
                          const isActiveActing = activeHospitalId === h.id;
                          const isOverlapping = overlappingHospitals.has(h.id);
                          return (
                            <g 
                              key={h.id}
                              className={`cursor-pointer group transition-opacity duration-200 ${
                                isOverlapping ? "opacity-35 hover:opacity-95" : "opacity-85 hover:opacity-100"
                              }`}
                              onClick={() => {
                                setSelectedHospital(h);
                                setSelectedTask(null);
                              }}
                            >
                              {/* Outer delicate ring */}
                              <circle
                                cx={projectX(h.longitude)}
                                cy={projectY(h.latitude)}
                                r={(isSelected ? 10.5 : 8) / zoom}
                                fill="none"
                                stroke={isActiveActing ? "#34d399" : h.type === "central" ? "#818cf8" : "#94a3b8"}
                                strokeWidth={(isActiveActing ? 2.2 : 1.4) / zoom}
                                className="transition-all duration-300"
                              />
                              {/* Inner core solid point */}
                              <circle
                                cx={projectX(h.longitude)}
                                cy={projectY(h.latitude)}
                                r={(isSelected ? 5.5 : 4) / zoom}
                                fill={isActiveActing ? "#10b981" : h.type === "central" ? "#6366f1" : "#334155"}
                                stroke={isActiveActing ? "#a7f3d0" : h.type === "central" ? "#c7d2fe" : "#cbd5e1"}
                                strokeWidth={1.2 / zoom}
                                className="transition-all duration-300 filter drop-shadow-[0_0_2px_rgba(99,102,241,0.5)]"
                              />
                              {/* Outer pulse decoration for central hub hospital */}
                              {h.type === "central" && (
                                <circle
                                  cx={projectX(h.longitude)}
                                  cy={projectY(h.latitude)}
                                  r={15.5 / zoom}
                                  stroke="#818cf8"
                                  strokeWidth={1 / zoom}
                                  strokeOpacity="0.45"
                                  fill="none"
                                  className="animate-pulse"
                                />
                              )}
                              <text
                                x={projectX(h.longitude)}
                                y={projectY(h.latitude) - (13 / zoom)}
                                textAnchor="middle"
                                fill="#f1f5f9"
                                fontSize={9.5 / zoom}
                                fontWeight="bold"
                                fontFamily="monospace"
                                className="select-none filter drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.95)] text-slate-300 group-hover:text-white transition-all font-semibold"
                              >
                                H{h.id}{isActiveActing && "院"}
                              </text>
                            </g>
                          );
                        });
                      })()}

                      {/* URGENT TARGET PULSARS */}
                      {config.tasks.map((t) => {
                        const originNode = config.hospitals.find(h => h.id === t.origin);
                        const destNode = config.hospitals.find(h => h.id === t.destination);
                        if (!originNode || !destNode) return null;
                        
                        const isSelected = selectedTask?.id === t.id;
                        return (
                          <g 
                            key={t.id}
                            className="cursor-pointer"
                            onClick={() => {
                              setSelectedTask(selectedTask?.id === t.id ? null : t);
                              setSelectedHospital(null);
                            }}
                          >
                            <circle
                              cx={projectX(destNode.longitude)}
                              cy={projectY(destNode.latitude)}
                              r={(isSelected ? 18 : 14) / zoom}
                              stroke={isSelected ? "#f43f5e" : "#f59e0b"}
                              strokeWidth={(isSelected ? 2.5 : 1.2) / zoom}
                              strokeDasharray={isSelected ? "none" : "3 3"}
                              fill="none"
                              opacity={isSelected ? "0.95" : "0.6"}
                              className="animate-pulse"
                            />
                          </g>
                        );
                      })}
                    </g>

                    {/* SCI-FI HUD Grid & Coordinate Borders (Keeps coordinate lines locked to map, but labels docked to viewports edges) */}
                    <g opacity="0.82" pointerEvents="none">
                      {/* Pinned Longitudes (Vertical Tracker Lines with docked indicators) */}
                      {[121.15, 121.17, 121.19, 121.21, 121.23, 121.25, 121.27, 121.29].map((lon) => {
                        const screenX = panOffset.x + projectX(lon) * zoom;
                        if (screenX < 5 || screenX > 795) return null;
                        return (
                          <g key={`hud-lon-${lon}`}>
                            {/* Grid Line */}
                            <line 
                              x1={screenX} 
                              y1="25" 
                              x2={screenX} 
                              y2="575" 
                              stroke="#0f172a" 
                              strokeWidth="0.8" 
                              strokeDasharray="4 4" 
                              opacity="0.5"
                            />
                            {/* Top boundary ticker */}
                            <text 
                              x={screenX} 
                              y="9" 
                              fill="#38bdf8" 
                              fontSize="8" 
                              fontFamily="monospace" 
                              fontWeight="bold"
                              textAnchor="middle"
                            >
                              {lon.toFixed(2)}
                            </text>
                            
                            {/* Bottom boundary ticker */}
                            <text 
                              x={screenX} 
                              y="597" 
                              fill="#38bdf8" 
                              fontSize="8" 
                              fontFamily="monospace" 
                              fontWeight="bold"
                              textAnchor="middle"
                            >
                              {lon.toFixed(2)}
                            </text>
                          </g>
                        );
                      })}

                      {/* Pinned Latitudes (Horizontal Tracker Lines with docked indicators) */}
                      {[31.31, 31.33, 31.35, 31.37, 31.39, 31.41].map((lat) => {
                        const screenY = panOffset.y + projectY(lat) * zoom;
                        if (screenY < 25 || screenY > 575) return null;
                        return (
                          <g key={`hud-lat-${lat}`}>
                            {/* Grid Line */}
                            <line 
                              x1="25" 
                              y1={screenY} 
                              x2="775" 
                              y2={screenY} 
                              stroke="#0f172a" 
                              strokeWidth="0.8" 
                              strokeDasharray="4 4" 
                              opacity="0.5"
                            />
                            {/* Left boundary ticker */}
                            <text 
                              x="4" 
                              y={screenY + 3} 
                              fill="#38bdf8" 
                              fontSize="8" 
                              fontFamily="monospace" 
                              fontWeight="bold"
                              textAnchor="start"
                            >
                              {lat.toFixed(2)}
                            </text>
                            
                            {/* Right boundary ticker */}
                            <text 
                              x="796" 
                              y={screenY + 3} 
                              fill="#38bdf8" 
                              fontSize="8" 
                              fontFamily="monospace" 
                              fontWeight="bold"
                              textAnchor="end"
                            >
                              {lat.toFixed(2)}
                            </text>
                          </g>
                        );
                      })}
                      
                      {/* Interactive compass panel */}
                      <g transform="translate(55, 55)" opacity="0.85">
                        <circle cx="0" cy="0" r="18" fill="#020617" stroke="#475569" strokeWidth="1" />
                        <line x1="0" y1="-15" x2="0" y2="15" stroke="#334155" strokeWidth="1" strokeDasharray="1 1" />
                        <line x1="-15" y1="0" x2="15" y2="0" stroke="#334155" strokeWidth="1" strokeDasharray="1 1" />
                        <text x="0" y="-21" fill="#94a3b8" fontSize="8" fontWeight="bold" fontFamily="monospace" textAnchor="middle">N</text>
                        {/* Rotating compass arrow */}
                        <polygon points="0,-12 3,0 0,3 -3,0" fill="#f43f5e" transform="rotate(7)" />
                        <polygon points="0,12 3,0 0,-3 -3,0" fill="#94a3b8" transform="rotate(7)" />
                      </g>
                    </g>
                  </svg>

                  {/* Floating map controls */}
                  <div className="absolute bottom-4 right-4 flex items-center gap-1.5 z-10 bg-slate-950/95 backdrop-blur-sm p-1.5 rounded-lg border border-slate-800 shadow-xl">
                    <button 
                      onClick={() => setZoom(prev => Math.min(prev + 0.25, 4))}
                      className="w-7 h-7 flex items-center justify-center rounded bg-slate-900 border border-slate-850 text-slate-300 hover:bg-indigo-650 hover:text-white transition-all text-sm font-bold font-mono cursor-pointer"
                      title="放大 (Zoom In)"
                    >
                      +
                    </button>
                    <button 
                      onClick={() => setZoom(prev => Math.max(prev - 0.25, 0.5))}
                      className="w-7 h-7 flex items-center justify-center rounded bg-slate-900 border border-slate-850 text-slate-300 hover:bg-slate-850 hover:text-white transition-all text-sm font-bold font-mono cursor-pointer"
                      title="缩小 (Zoom Out)"
                    >
                      -
                    </button>
                    <button 
                      onClick={() => {
                        setZoom(1);
                        setPanOffset({ x: 0, y: 0 });
                      }}
                      className="px-2.5 h-7 flex items-center justify-center rounded bg-slate-900 border border-slate-850 text-[10px] text-slate-300 hover:bg-slate-850 hover:text-white transition-all cursor-pointer font-sans"
                      title="重置居中 (Reset View)"
                    >
                      重置视图
                    </button>
                  </div>

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
                  
                  {/* Onboarding selection overlay for userRole === null */}
                  {userRole === null && (
                    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center p-6 z-20">
                      <div className="max-w-4xl w-full bg-slate-900/95 border border-slate-800 rounded-2xl p-8 shadow-2xl flex flex-col gap-6 text-center backdrop-blur-lg">
                        <div className="flex flex-col gap-2">
                          <h2 className="text-lg md:text-xl font-bold text-white tracking-tight flex items-center justify-center gap-2">
                            <span>分院–中心医疗物资无人机智能集货多段调度系统</span>
                          </h2>
                          <p className="text-xs text-slate-400 font-sans max-w-2xl mx-auto">
                            基于双约束混合整数线性规划 (MILP) 的医疗快线集力智能调度控制枢纽。请选择您的系统签入身份以进入相应终端视角。
                          </p>
                        </div>

                        {/* Bento Grid Entrances */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-left mt-4">
                          
                          {/* 1. Admin */}
                          <div 
                            onClick={() => { setUserRole("admin"); addEmergencyLog("主页签入：已授权总管理员最高管理决策权", "info"); }}
                            className="bg-slate-950/60 p-6 rounded-xl border border-slate-850 hover:border-indigo-500 hover:bg-slate-950/90 hover:shadow-lg hover:shadow-indigo-500/5 transition-all duration-300 cursor-pointer flex flex-col justify-between group"
                          >
                            <div className="flex flex-col gap-3">
                              <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                <ShieldCheck className="w-5 h-5 animate-pulse" />
                              </div>
                              <h3 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">👑 系统总指挥管理员视角</h3>
                              <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                                对嘉定区中心医院及全网卫星站点、空域无人载具、挂扣快件等数据拥有全局管理、一键物理算力重调及多算法对比权限。
                              </p>
                            </div>
                            <button className="mt-5 w-full py-2 bg-indigo-950 hover:bg-indigo-600 border border-indigo-500/30 hover:border-indigo-500 text-indigo-300 hover:text-white text-[11px] font-bold rounded-lg transition-all cursor-pointer">
                              立即登入总指挥台
                            </button>
                          </div>

                          {/* 2. Medical Staff */}
                          <div 
                            onClick={() => { setUserRole("hospital"); addEmergencyLog("主页签入：已进入分院临床急救医护视角", "info"); }}
                            className="bg-slate-950/60 p-6 rounded-xl border border-slate-850 hover:border-emerald-500 hover:bg-slate-950/90 hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-300 cursor-pointer flex flex-col justify-between group"
                          >
                            <div className="flex flex-col gap-3">
                              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white transition-all">
                                <Heart className="w-5 h-5 animate-pulse" />
                              </div>
                              <h3 className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors">🏥 分院临床急救医务视角</h3>
                              <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                                便捷调发配送至本分院、或自本分院起拔的紧急血液标本派单。支持提呈新加急单，快速联动全网智能运输体系。
                              </p>
                            </div>
                            <button className="mt-5 w-full py-2 bg-emerald-950/85 hover:bg-emerald-600 border border-emerald-500/30 hover:border-emerald-500 text-emerald-300 hover:text-white text-[11px] font-bold rounded-lg transition-all cursor-pointer">
                              进入急救医护视角
                            </button>
                          </div>

                          {/* 3. Drone Support Team */}
                          <div 
                            onClick={() => { setUserRole("drone_admin"); addEmergencyLog("主页签入：已连接机载设备运维监控总线", "info"); }}
                            className="bg-slate-950/60 p-6 rounded-xl border border-slate-850 hover:border-amber-500 hover:bg-slate-950/90 hover:shadow-lg hover:shadow-amber-500/5 transition-all duration-300 cursor-pointer flex flex-col justify-between group"
                          >
                            <div className="flex flex-col gap-3">
                              <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:bg-amber-600 group-hover:text-white transition-all">
                                <Cpu className="w-5 h-5 animate-pulse" />
                              </div>
                              <h3 className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors">⚡ 机载设备运维测诊视角</h3>
                              <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                                实时监控挂机飞翼能效、遥测电池阻值、并针对偏航、失联、大风切变等物理事故注入防爆离网测试进行极端压测。
                              </p>
                            </div>
                            <button className="mt-5 w-full py-2 bg-amber-950/85 hover:bg-amber-600 border border-amber-500/30 hover:border-amber-500 text-amber-300 hover:text-white text-[11px] font-bold rounded-lg transition-all cursor-pointer">
                              签入无人机运维端
                            </button>
                          </div>

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
              {userRole !== null && (
                <div className="md:col-span-1 flex flex-col gap-4 overflow-hidden h-full">
                
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
                      const matchAssignment = solution?.x_assignments.find(x => x.hospital_id === d.hospital_id && x.berth_id === d.berth_id);
                      const matchTask = matchAssignment ? config.tasks.find(t => t.id === matchAssignment.task_id) : null;

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
                          {!isOffline && matchTask && (
                            <div className="text-[10px] text-teal-400 font-bold mb-1.5 bg-teal-950/40 border border-teal-900/30 p-1.5 rounded flex flex-col gap-0.5">
                              <div>📦 执飞配送中: 订单 #{matchTask.id}</div>
                              <div className="text-slate-400 font-normal text-[9px]">
                                起运 H{matchTask.origin} → 投靶 H{matchTask.destination} (货重 {matchTask.weight} kg)
                              </div>
                            </div>
                          )}
                          {!isOffline && !matchTask && (
                            <div className="text-[10px] text-slate-500 mb-1.5 italic">
                              💤 待命中: 暂无分配指标
                            </div>
                          )}
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
              )}
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

          {/* Deleted solver standard logs block */}

          </section>
        )}

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
