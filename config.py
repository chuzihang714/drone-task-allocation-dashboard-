# -*- coding: utf-8 -*-
"""问题配置模块 - 对应设计框架5.2.8节

提供API方式配置问题数据，支持从文件加载和程序化配置
"""

from typing import List, Tuple, Optional, Any
from data_structures import Hospital, Drone, Task, ProblemData
from utils import PhysicalConstants


class ProblemConfig:
    """问题配置类 - 对应设计框架5.2.8节
    
    提供API方式配置问题数据，支持：
    1. 程序化添加医院、无人机、任务
    2. 从JSON文件加载配置
    3. 构建ProblemData对象供求解器使用
    """
    
    def __init__(self):
        self._hospitals: List[Hospital] = []
        self._drones: List[Drone] = []
        self._tasks: List[Task] = []
        # 默认使用物理常数计算K值
        self._physical_constants: PhysicalConstants = PhysicalConstants()
        self._K: float = self._physical_constants.calculate_K()  # 使用公式计算K值
    
    @property
    def hospitals(self) -> List[Hospital]:
        """获取已配置的医院列表"""
        return self._hospitals
    
    @property
    def drones(self) -> List[Drone]:
        """获取已配置的无人机列表"""
        return self._drones
    
    @property
    def tasks(self) -> List[Task]:
        """获取已配置的任务列表"""
        return self._tasks
    
    @property
    def K(self) -> float:
        """获取气动常数"""
        return self._K
    
    @property
    def physical_constants(self) -> PhysicalConstants:
        """获取物理常数对象"""
        return self._physical_constants
    
    def add_hospital(self, id: int, name: str, capacity: int, 
                     initial_empty: int, location: Tuple[float, float], 
                     berths: List[int]) -> Hospital:
        """添加医院（设计框架5.2.8节）
        
        Args:
            id: 医院唯一标识
            name: 医院名称
            capacity: 泊位总数量（对应符号 C_d）
            initial_empty: 初始空余仓位数量（对应符号 m_i）
            location: 地理坐标 (x, y)
            berths: 仓位编号列表
        
        Returns:
            创建的 Hospital 对象
        
        Raises:
            ValueError: 如果医院ID已存在
        """
        # 检查ID是否重复
        if any(h.id == id for h in self._hospitals):
            raise ValueError(f"医院ID {id} 已存在")
        
        hospital = Hospital(id, name, capacity, initial_empty, location, berths)
        self._hospitals.append(hospital)
        return hospital
    
    def add_drone(self, hospital_id: int, berth_id: int, 
                  weight: float, max_payload: float, 
                  battery_max: float, speed: float) -> Drone:
        """添加无人机（设计框架5.2.8节）
        
        Args:
            hospital_id: 所属医院ID（对应符号 i）
            berth_id: 初始停泊仓位编号（对应符号 j）
            weight: 机身重量（kg）（对应符号 w_0）
            max_payload: 最大载重（kg）（对应符号 Q）
            battery_max: 最大电池能量（J/kWh）（对应符号 E_max）
            speed: 飞行速度（m/s）（对应符号 v）
        
        Returns:
            创建 of Drone 对象
        
        Raises:
            ValueError: 如果医院不存在或仓位已被占用
        """
        # 检查医院是否存在
        if not any(h.id == hospital_id for h in self._hospitals):
            raise ValueError(f"医院ID {hospital_id} 不存在")
        
        # 检查无人机标识是否重复
        if any(d.hospital_id == hospital_id and d.berth_id == berth_id for d in self._drones):
            raise ValueError(f"无人机 ({hospital_id}, {berth_id}) 已存在")
        
        drone = Drone(hospital_id, berth_id, weight, max_payload, battery_max, speed)
        self._drones.append(drone)
        return drone
    
    def add_task(self, id: int, origin: int, destination: int, weight: float) -> Task:
        """添加任务（设计框架5.2.8节）
        
        Args:
            id: 任务唯一标识
            origin: 起点医院ID（对应符号 Orig(k)）
            destination: 终点医院ID（对应符号 dest(k)）
            weight: 任务载重（kg）（对应符号 w_k）
        
        Returns:
            创建的 Task 对象
        
        Raises:
            ValueError: 如果任务ID已存在或起点/终点医院不存在
        """
        # 检查任务ID是否重复
        if any(t.id == id for t in self._tasks):
            raise ValueError(f"任务ID {id} 已存在")
        
        # 检查起点医院是否存在
        if not any(h.id == origin for h in self._hospitals):
            raise ValueError(f"起点医院ID {origin} 不存在")
        
        # 检查终点医院是否存在
        if not any(h.id == destination for h in self._hospitals):
            raise ValueError(f"终点医院ID {destination} 不存在")
        
        task = Task(id, origin, destination, weight)
        self._tasks.append(task)
        return task
    
    def set_physical_constants(self, g: float = None, rho: float = None, 
                               sigma: float = None, h: int = None):
        """设置物理常数并自动计算K值（设计框架2.5-2.6节）
        
        公式: K = sqrt(g^3 / (2 * rho * sigma * h))
        
        Args:
            g: 重力加速度 (m/s²)，默认9.81
            rho: 空气密度 (kg/m³)，默认1.204
            sigma: 桨盘面积 (m²)，默认0.0064
            h: 桨叶数量，默认6
        """
        self._physical_constants = PhysicalConstants(g, rho, sigma, h)
        self._K = self._physical_constants.calculate_K()
    
    def build_problem_data(self) -> ProblemData:
        """构建问题数据对象（设计框架5.2.8节）
        
        Returns:
            ProblemData 对象，可直接传递给求解器
        """
        # 验证配置完整性
        if not self._hospitals:
            raise ValueError("至少需要配置一家医院")
        if not self._drones:
            raise ValueError("至少需要配置一架无人机")
        
        return ProblemData(self._hospitals, self._drones, self._tasks, self._K)
    
    def load_from_json(self, file_path: str):
        """从JSON文件加载配置
        
        Args:
            file_path: JSON文件路径
        
        JSON文件格式：
        {
            "physical_constants": {
                "g": 9.81,
                "rho": 1.204,
                "sigma": 0.0064,
                "h": 6
            },
            "hospitals": [...],
            "drones": [...],
            "tasks": [...]
        }
        
        注意：如果不提供physical_constants，将使用默认值计算K
        """
        import json
        
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # 加载物理常数（如果提供）
        if 'physical_constants' in data:
            pc = data['physical_constants']
            self.set_physical_constants(
                g=pc.get('g'),
                rho=pc.get('rho'),
                sigma=pc.get('sigma'),
                h=pc.get('h')
            )
        else:
            # 使用默认物理常数计算K
            self._physical_constants = PhysicalConstants()
            self._K = self._physical_constants.calculate_K()
        
        # 加载医院
        for h in data.get('hospitals', []):
            self.add_hospital(
                id=h['id'],
                name=h['name'],
                capacity=h['capacity'],
                initial_empty=h['initial_empty'],
                location=tuple(h['location']),
                berths=h['berths']
            )
        
        # 加载无人机
        for d in data.get('drones', []):
            self.add_drone(
                hospital_id=d['hospital_id'],
                berth_id=d['berth_id'],
                weight=d['weight'],
                max_payload=d['max_payload'],
                battery_max=d['battery_max'],
                speed=d['speed']
            )
        
        # 加载任务
        for t in data.get('tasks', []):
            self.add_task(
                id=t['id'],
                origin=t['origin'],
                destination=t['destination'],
                weight=t['weight']
            )
    
    def clear(self):
        """清空所有配置"""
        self._hospitals = []
        self._drones = []
        self._tasks = []
        # 重置为默认物理常数（K值将自动计算）
        self._physical_constants = PhysicalConstants()
        self._K = self._physical_constants.calculate_K()
    
    def __repr__(self):
        return f"ProblemConfig(hospitals={len(self._hospitals)}, drones={len(self._drones)}, tasks={len(self._tasks)}, K={self._K:.4f})"
