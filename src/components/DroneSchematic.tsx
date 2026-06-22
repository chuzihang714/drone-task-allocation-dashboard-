import React, { useState } from "react";
import { 
  Activity, Upload, RotateCcw, FileImage
} from "lucide-react";
import { ProblemConfigData, SolverSolution, Task, Drone } from "../types";

interface DroneSchematicProps {
  selectedDroneKey: string | null;
  setSelectedDroneKey: (key: string | null) => void;
  config: ProblemConfigData;
  solution: SolverSolution | null;
}

export default function DroneSchematic({ 
  selectedDroneKey, 
  setSelectedDroneKey, 
  config, 
  solution 
}: DroneSchematicProps) {
  const [imageError, setImageError] = useState<{ [key: number]: boolean }>({});

  // Load custom image overrides from localStorage on mount
  const [customImages, setCustomImages] = useState<{ [key: number]: string }>(() => {
    const loaded: { [key: number]: string } = {};
    for (let i = 0; i < 3; i++) {
      const data = localStorage.getItem("drone_custom_image_" + i);
      if (data) {
        loaded[i] = data;
      }
    }
    return loaded;
  });

  // High quality images provided by user - representing Front, Side, and Back views
  const droneImages = [
    {
      src: "/input_file_0.png",
      title: "无人机正面 (Front View)",
      desc: "配备前置三合一多光谱相机、超高强抗风雷达避障整流罩，以及主飞行高分辨率红外吊舱定位模块。",
      hotspots: []
    },
    {
      src: "/input_file_1.png",
      title: "无人机侧面 (Side View)",
      desc: "流线式气动低风阻外层防护蒙皮，搭载可插拔高能量固态电池模组，极智保障整机重心均衡分布。",
      hotspots: []
    },
    {
      src: "/input_file_2.png",
      title: "无人机背面 (Back View)",
      desc: "集成差分双RTK高精度定位天线、高亮航行情报双色尾灯，以及无尾动力反转方向辅助控制配重舱。",
      hotspots: []
    }
  ];

  // Resolve active selected drone data
  let activeDrone: Drone | null = null;
  let activeHospitalId = 1;
  let activeBerthId = 1;
  let assignedTask: Task | null = null;

  if (selectedDroneKey) {
    const [hIdStr, bIdStr] = selectedDroneKey.split("_");
    const hId = parseInt(hIdStr);
    const bId = parseInt(bIdStr);
    activeHospitalId = hId;
    activeBerthId = bId;
    activeDrone = config.drones.find(d => d.hospital_id === hId && d.berth_id === bId) || null;
    
    // Check if there is an active task assigned to this drone
    const matchedAssignment = solution?.x_assignments.find(
      x => x.hospital_id === hId && x.berth_id === bId
    );
    if (matchedAssignment) {
      assignedTask = config.tasks.find(t => t.id === matchedAssignment.task_id) || null;
    }
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl flex flex-col h-full overflow-hidden shadow-xl" id="drone-telemetry-panel-card">
      {/* 1. Header with custom aerospace tabs */}
      <div className="p-4 bg-slate-950/40 border-b border-slate-850 flex flex-col gap-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Activity className="w-5 h-5 text-amber-500 animate-pulse" />
            <div className="flex flex-col">
              <span className="text-white font-bold text-xs tracking-wide">
                HIGHTOPO 急救无人机中继监测终端
              </span>
              <span className="text-[9px] text-slate-500 font-mono">
                D-X2 COURIER REAL-TIME INSIGHT GCS
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 font-mono text-[9.5px] text-amber-500 bg-amber-950/20 border border-amber-900/30 px-2.5 py-1 rounded-md">
            <Activity className="w-3.5 h-3.5 animate-pulse" />
            <span className="font-bold">整机测绘 / 姿态详情 (Profile)</span>
          </div>
        </div>

        {/* Selected Drone telemetry summary badge */}
        <div className="bg-slate-950 border border-slate-850 rounded-lg p-2 flex items-center justify-between font-mono text-[10px]">
          {selectedDroneKey ? (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-amber-400 font-bold">D-H{activeHospitalId}.B{activeBerthId}</span>
                <span className="text-slate-500">|</span>
                <span className="text-teal-400 font-semibold">{assignedTask ? `加急运输 (Task #${assignedTask.id})` : "驻场巡逻中 (Standby)"}</span>
              </div>
              <button 
                onClick={() => setSelectedDroneKey(null)}
                className="text-[9px] text-rose-450 text-rose-400 hover:underline cursor-pointer"
              >
                解绑无人机
              </button>
            </div>
          ) : (
            <div className="text-slate-450 text-[10px] w-full text-center">
              💡 提示：在左侧列表中 <span className="text-slate-200 font-bold">点击任意在役无人机</span>，以锁定显示特定飞翼结构与状态信息
            </div>
          )}
        </div>
      </div>

      {/* 2. Main Windows Panel */}
      <div className="flex-1 p-5 overflow-hidden flex flex-col h-full min-h-[350px]">
        <div className="flex-1 flex flex-col gap-4 overflow-y-auto h-full pr-1">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full min-h-[350px]">
              {droneImages.map((img, idx) => {
                const imgSrc = customImages[idx] || img.src;
                const isCustom = !!customImages[idx];
                return (
                  <div 
                    key={idx} 
                    className="flex flex-col bg-slate-950/40 border border-slate-850 hover:border-slate-800 rounded-xl overflow-hidden shadow-xl transition-all duration-300 group select-none hover:shadow-amber-500/5 hover:-translate-y-0.5"
                  >
                    {/* View Header with absolute position controls */}
                    <div className="p-2.5 bg-slate-950/60 border-b border-slate-850/70 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-mono text-[10px] text-slate-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        <span className="font-bold tracking-wide">{img.title}</span>
                      </div>
                      
                      {/* Image Control Overlay */}
                      <div className="flex items-center gap-1 shrink-0">
                        <label 
                          htmlFor={`upload-view-${idx}`}
                          className="flex items-center gap-1 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-[8px] text-amber-500 hover:text-amber-400 font-mono px-2 py-0.5 rounded cursor-pointer transition select-none shadow"
                        >
                          <Upload className="w-2.5 h-2.5" />
                          <span>{isCustom ? "更换" : "上传"}</span>
                        </label>
                        <input 
                          type="file" 
                          accept="image/*" 
                          id={`upload-view-${idx}`}
                          className="hidden" 
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = () => {
                                const resultSrc = reader.result as string;
                                setCustomImages(prev => {
                                  const updated = { ...prev, [idx]: resultSrc };
                                  localStorage.setItem("drone_custom_image_" + idx, resultSrc);
                                  return updated;
                                });
                              };
                              reader.readAsDataURL(file);
                            }
                          }} 
                        />
                        {isCustom && (
                          <button
                            onClick={() => {
                              setCustomImages(prev => {
                                const updated = { ...prev };
                                delete updated[idx];
                                localStorage.removeItem("drone_custom_image_" + idx);
                                return updated;
                              });
                              setImageError(prev => ({ ...prev, [idx]: false }));
                            }}
                            className="flex items-center bg-slate-900 border border-slate-800 hover:bg-slate-800 text-[8px] text-rose-450 text-rose-400 font-mono px-1 py-0.5 rounded cursor-pointer transition select-none shadow"
                            title="恢复默认自带航空图"
                          >
                            <RotateCcw className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Image Area */}
                    <div className="flex-1 bg-slate-950/20 flex items-center justify-center p-4 relative min-h-[180px] group-hover:bg-slate-950/30 transition-colors">
                      {imageError[idx] ? (
                        <div className="flex flex-col items-center justify-center text-center gap-2 p-4 text-slate-500 font-mono text-[9px]">
                          <FileImage className="w-8 h-8 text-slate-600 animate-pulse" />
                          <span>未加载到视角图</span>
                          <span className="text-[8px] text-slate-600">支持 png/jpg 格式图片</span>
                        </div>
                      ) : (
                        <div className="relative w-full h-full flex items-center justify-center max-h-[182px] overflow-hidden">
                          <img 
                            src={imgSrc} 
                            alt={img.title}
                            onError={() => {
                              console.warn(`Failed to load drone image: ${imgSrc}`);
                              setImageError(prev => ({ ...prev, [idx]: true }));
                            }}
                            className="max-w-full max-h-[170px] object-contain rounded transition-transform duration-500 group-hover:scale-[1.03]"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      )}
                    </div>

                    {/* Image Spec / Desc Footer */}
                    <div className="p-3 bg-slate-950/30 border-t border-slate-850/50 flex flex-col gap-1.5 font-mono">
                      <p className="text-slate-400 font-sans text-[10px] leading-relaxed line-clamp-2 select-text">
                        {img.desc}
                      </p>
                      
                      {/* Specs tags */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-900 text-[8.5px] text-slate-500">
                        {idx === 0 && (
                          <>
                            <span className="px-1.5 py-0.5 rounded bg-amber-950/20 border border-amber-900/30 text-amber-500">双可见/红外</span>
                            <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">4.5kW RPM</span>
                          </>
                        )}
                        {idx === 1 && (
                          <>
                            <span className="px-1.5 py-0.5 rounded bg-emerald-950/20 border border-emerald-900/35 text-emerald-400 font-bold">IP66 无损防震</span>
                            <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">C2 智能恒温</span>
                          </>
                        )}
                        {idx === 2 && (
                          <>
                            <span className="px-1.5 py-0.5 rounded bg-cyan-950/20 border border-cyan-900/35 text-cyan-400">差分 RTK 锁</span>
                            <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">TRICOLOR LOB</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
  );
}
