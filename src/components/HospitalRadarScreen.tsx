import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Radio, ShieldCheck, Play, Navigation, AlertCircle, Compass, RefreshCw } from "lucide-react";
import { ProblemConfigData, SolverSolution, Task, Hospital } from "../types";

interface HospitalRadarScreenProps {
  config: ProblemConfigData;
  solution: SolverSolution | null;
  activeHospitalId: number;
  onSelectTask: (task: Task | null) => void;
  selectedTaskId: number | null;
}

export default function HospitalRadarScreen({
  config,
  solution,
  activeHospitalId,
  onSelectTask,
  selectedTaskId
}: HospitalRadarScreenProps) {
  const [currentDegree, setCurrentDegree] = useState(0);

  // Animate the radar sweeping sweep
  useEffect(() => {
    const handle = setInterval(() => {
      setCurrentDegree((prev) => (prev + 3) % 360);
    }, 40);
    return () => clearInterval(handle);
  }, []);

  const activeHospital = config.hospitals.find((h) => h.id === activeHospitalId);
  
  if (!activeHospital) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-center justify-center text-slate-500 italic text-xs h-full min-h-[400px]">
        请选择正常注册的医院站点调阅终端大屏。
      </div>
    );
  }

  // Find all tasks associated with this hospital (either departing or arriving)
  const connectedTasks = config.tasks.filter(
    (t) => t.origin === activeHospitalId || t.destination === activeHospitalId
  );

  const incomingTasks = connectedTasks.filter((t) => t.destination === activeHospitalId);
  const outgoingTasks = connectedTasks.filter((t) => t.origin === activeHospitalId);

  // Gather unique connected remote hospitals
  const remoteHospitalIds = Array.from(
    new Set(
      connectedTasks.map((t) => (t.origin === activeHospitalId ? t.destination : t.origin))
    )
  );

  const remoteHospitals = config.hospitals.filter((h) => remoteHospitalIds.includes(h.id));

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col h-full overflow-hidden shadow-xl" id="hospital-large-radar-screen">
      {/* 1. Header and System Telemetry Indicators */}
      <div className="flex items-center justify-between border-b border-slate-850 pb-3.5 shrink-0">
        <div className="flex items-center gap-2">
          <div className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </div>
          <div className="flex flex-col">
            <span className="text-white font-bold text-xs tracking-wide">
              H{activeHospital.id} 附属临床航空调度大屏 (总控台)
            </span>
            <span className="text-[9px] text-slate-500 font-mono">
              REAL-TIME DIGITIZED LOCAL AIRSPACE SITUATION MONITOR
            </span>
          </div>
        </div>
        <div className="text-[10px] text-emerald-400 font-mono bg-emerald-950/40 px-2.5 py-1 rounded border border-emerald-900/60 font-bold flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>空域安全：优 (Secure)</span>
        </div>
      </div>

      {/* 2. Panoramic local radar display grid */}
      <div className="relative mt-4 bg-slate-950 border border-slate-850 rounded-xl p-4 flex flex-col items-center justify-center min-h-[260px] max-h-[300px] overflow-hidden group select-none flex-1">
        {/* Radar grids backings */}
        <div className="absolute inset-x-0 inset-y-0 flex items-center justify-center pointer-events-none opacity-30">
          <div className="border border-emerald-500/10 w-[230px] h-[230px] rounded-full absolute" />
          <div className="border border-emerald-500/20 w-[170px] h-[170px] rounded-full absolute" />
          <div className="border border-emerald-500/30 w-[100px] h-[100px] rounded-full absolute" />
          <div className="border border-emerald-500/40 w-[40px] h-[40px] rounded-full absolute" />
          
          {/* Compass layout ticks */}
          <span className="absolute top-1 text-[8px] text-emerald-600/60 font-mono font-bold">N 0°</span>
          <span className="absolute right-1 text-[8px] text-emerald-600/60 font-mono font-bold">E 90°</span>
          <span className="absolute bottom-1 text-[8px] text-emerald-600/60 font-mono font-bold">S 180°</span>
          <span className="absolute left-1 text-[8px] text-emerald-600/60 font-mono font-bold">W 270°</span>

          {/* Cross lines */}
          <div className="w-[245px] h-[0.5px] bg-emerald-500/10 absolute rotate-0" />
          <div className="w-[245px] h-[0.5px] bg-emerald-500/10 absolute rotate-90" />
          <div className="w-[245px] h-[0.5px] bg-emerald-500/10 absolute rotate-45" />
          <div className="w-[245px] h-[0.5px] bg-emerald-500/10 absolute -rotate-45" />
        </div>

        {/* Dynamic Sweeping line beam */}
        <div 
          className="absolute w-[115px] h-[115px] origin-bottom-right pointer-events-none"
          style={{
            top: "calc(50% - 115px)",
            left: "calc(50% - 115px)",
            transform: `rotate(${currentDegree}deg)`,
            transformOrigin: "bottom right",
            background: "conic-gradient(from 0deg at 100% 100%, transparent 60%, rgba(16, 185, 129, 0.15) 100%)",
            borderRadius: "100% 0 0 0"
          }}
        />

        {/* Localized Telemetry Radar Core SVG (Repositioning relative to center) */}
        <svg viewBox="0 0 300 250" className="w-full h-full min-h-[220px] max-h-[230px] relative pointer-events-none">
          {/* Radial Lines to connected nodes */}
          {remoteHospitals.map((h, hIdx) => {
            // Compute static local screen position using offset vectors based on actual coordinates difference
            const dx = (h.longitude - activeHospital.longitude) * 1100;
            const dy = (activeHospital.latitude - h.latitude) * 1100; // Invert latitude
            
            // Constrain positions to be beautifully within radar radius
            const distance = Math.sqrt(dx * dx + dy * dy);
            const scale = distance > 95 ? 95 / distance : 1;
            const xPos = 150 + dx * scale;
            const yPos = 125 + dy * scale;

            const isOutgoing = outgoingTasks.some((t) => t.destination === h.id);
            const isIncoming = incomingTasks.some((t) => t.origin === h.id);

            return (
              <g key={h.id}>
                {/* Connector Bezier/Direct line with color encoding */}
                <line 
                  x1="150" 
                  y1="125" 
                  x2={xPos} 
                  y2={yPos} 
                  stroke={isOutgoing ? "#f59e0b" : "#34d399"} 
                  strokeWidth="1.2" 
                  strokeDasharray="4 3" 
                  opacity="0.8" 
                />

                {/* Animated Flight Carrier dots */}
                <circle cx={150 + (xPos - 150) * 0.4} cy={125 + (yPos - 125) * 0.4} r="3" fill="#f59e0b" className="animate-pulse">
                  <animate 
                    attributeName="cx" 
                    from={isOutgoing ? "150" : xPos.toString()} 
                    to={isOutgoing ? xPos.toString() : "150"} 
                    dur="3.5s" 
                    repeatCount="indefinite" 
                  />
                  <animate 
                    attributeName="cy" 
                    from={isOutgoing ? "125" : yPos.toString()} 
                    to={isOutgoing ? yPos.toString() : "125"} 
                    dur="3.5s" 
                    repeatCount="indefinite" 
                  />
                </circle>

                {/* Satellite Remote Hospital Node */}
                <g className="pointer-events-auto cursor-pointer">
                  <circle 
                    cx={xPos} 
                    cy={yPos} 
                    r="8.5" 
                    fill="#020617" 
                    stroke={isOutgoing ? "#f59e0b" : "#34d399"} 
                    strokeWidth="1.8" 
                  />
                  <circle 
                    cx={xPos} 
                    cy={yPos} 
                    r="3.5" 
                    fill={isOutgoing ? "#d97706" : "#10b981"} 
                  />
                  <text 
                    x={xPos} 
                    y={yPos - 12} 
                    fill="#94a3b8" 
                    fontSize="7.5" 
                    fontWeight="bold" 
                    fontFamily="monospace" 
                    textAnchor="middle"
                  >
                    H{h.id} ({h.name.substring(0, 3)})
                  </text>
                </g>
              </g>
            );
          })}

          {/* Central Active Hospital representation */}
          <circle cx="150" cy="125" r="14" fill="#020617" stroke="#10b981" strokeWidth="2.5" className="animate-pulse" />
          <circle cx="150" cy="125" r="5" fill="#10b981" />
          <text x="150" y="145" fill="#10b981" fontSize="9.5" fontWeight="extrabold" fontFamily="monospace" textAnchor="middle">
            我院 (H{activeHospital.id})
          </text>
        </svg>

        {/* Legend block overlay within the radar screen */}
        <div className="absolute bottom-2 left-2 flex gap-3 text-[8.5px] font-mono text-slate-500 bg-slate-950/90 border border-slate-850 p-1.5 rounded pr-2">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 bg-amber-500 rounded-full inline-block" />
            <span>出港航径</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 bg-emerald-400 rounded-full inline-block" />
            <span>进港航径</span>
          </div>
        </div>
      </div>

      {/* 3. Arrivals & Departures Telemetry Columns */}
      <div className="grid grid-cols-2 gap-3 mt-4 h-[120px] max-h-[140px] select-none shrink-0 font-mono text-[10.5px]">
        
        {/* Departure flight tasks */}
        <div className="bg-slate-950 border border-slate-850 rounded-xl p-3 flex flex-col overflow-hidden">
          <div className="text-amber-400 font-bold border-b border-slate-900 pb-1.5 flex items-center justify-between">
            <span>🚀 始发起航航迹 ({outgoingTasks.length})</span>
            <span className="text-[8px] bg-amber-950/50 text-amber-300 border border-amber-900/60 px-1 rounded">OUTBOUND</span>
          </div>

          <div className="flex-1 overflow-y-auto mt-1.5 flex flex-col gap-1.5">
            {outgoingTasks.length === 0 ? (
              <span className="text-slate-600 text-[9px] italic block text-center py-4">无出航配送中任务</span>
            ) : (
              outgoingTasks.map((t) => {
                const isSelected = selectedTaskId === t.id;
                return (
                  <div 
                    key={t.id} 
                    onClick={() => onSelectTask(t)}
                    className={`flex items-center justify-between p-1 rounded cursor-pointer transition ${
                      isSelected ? "bg-amber-950/40 text-amber-300" : "hover:bg-slate-900 text-slate-400"
                    }`}
                  >
                    <span>#单{t.id} ➔ H{t.destination}</span>
                    <span className="font-bold text-[9px] text-amber-400 animate-pulse">航测中</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Incoming flight tasks */}
        <div className="bg-slate-950 border border-slate-850 rounded-xl p-3 flex flex-col overflow-hidden">
          <div className="text-emerald-400 font-bold border-b border-slate-900 pb-1.5 flex items-center justify-between">
            <span>🛬 终到安返航迹 ({incomingTasks.length})</span>
            <span className="text-[8px] bg-emerald-950/50 text-emerald-300 border border-emerald-900/60 px-1 rounded">INBOUND</span>
          </div>

          <div className="flex-1 overflow-y-auto mt-1.5 flex flex-col gap-1.5">
            {incomingTasks.length === 0 ? (
              <span className="text-slate-600 text-[9px] italic block text-center py-4">无回站收料任务</span>
            ) : (
              incomingTasks.map((t) => {
                const isSelected = selectedTaskId === t.id;
                return (
                  <div 
                    key={t.id} 
                    onClick={() => onSelectTask(t)}
                    className={`flex items-center justify-between p-1 rounded cursor-pointer transition ${
                      isSelected ? "bg-emerald-950/40 text-emerald-300" : "hover:bg-slate-900 text-slate-400"
                    }`}
                  >
                    <span>#单{t.id} ➔ 自 H{t.origin}</span>
                    <span className="text-emerald-400 font-bold text-[9px]">降落标定</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
