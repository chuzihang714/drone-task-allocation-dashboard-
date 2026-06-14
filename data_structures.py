from typing import List, Optional, Tuple


class Hospital:
    """医院类 - 对应设计框架2.1节"""
    
    def __init__(self, id: int, name: str, capacity: int, initial_empty: int, 
                 location: Tuple[float, float], berths: List[int]):
        """
        Args:
            id: 医院唯一标识
            name: 医院名称
            capacity: 泊位总数量（对应符号 C_d）
            initial_empty: 初始空余仓位数量（对应符号 m_i）
            location: 地理坐标 (x, y)
            berths: 仓位编号列表
        """
        self.id = id
        self.name = name
        self.capacity = capacity
        self.initial_empty = initial_empty
        self.location = location
        self.berths = berths
    
    def __repr__(self):
        return f"Hospital(id={self.id}, name='{self.name}', capacity={self.capacity})"


class Drone:
    """无人机类 - 对应设计框架2.2节
    
    无人机采用双索引标识 (hospital_id, berth_id)：
    - hospital_id (i): 医院索引
    - berth_id (j): 无人机索引（医院内的仓位编号）
    """
    
    def __init__(self, hospital_id: int, berth_id: int, weight: float, 
                 max_payload: float, battery_max: float, speed: float):
        """
        Args:
            hospital_id: 所属医院ID（对应符号 i）
            berth_id: 初始停泊仓位编号（对应符号 j）
            weight: 机身重量（对应符号 w_0）
            max_payload: 最大载重（对应符号 Q）
            battery_max: 最大电池能量（对应符号 E_max）
            speed: 飞行速度（对应符号 v）
        """
        self.hospital_id = hospital_id
        self.berth_id = berth_id
        self.weight = weight
        self.max_payload = max_payload
        self.battery_max = battery_max
        self.speed = speed
    
    @property
    def identifier(self) -> Tuple[int, int]:
        """返回无人机的双索引标识"""
        return (self.hospital_id, self.berth_id)
    
    def __repr__(self):
        return f"Drone(hospital_id={self.hospital_id}, berth_id={self.berth_id})"
    
    def __eq__(self, other):
        if isinstance(other, Drone):
            return self.identifier == other.identifier
        return False
    
    def __hash__(self):
        return hash(self.identifier)


class Task:
    """任务类 - 对应设计框架2.3节"""
    
    def __init__(self, id: int, origin: int, destination: int, weight: float):
        """
        Args:
            id: 任务唯一标识（对应符号 k）
            origin: 起点医院ID（对应符号 Orig(k)）
            destination: 终点医院ID（对应符号 dest(k)）
            weight: 任务载重（对应符号 w_k）
        """
        self.id = id
        self.origin = origin
        self.destination = destination
        self.weight = weight
    
    def __repr__(self):
        return f"Task(id={self.id}, origin={self.origin}, dest={self.destination}, weight={self.weight})"


class ProblemData:
    """问题数据容器 - 包含所有医院、无人机、任务数据"""
    
    def __init__(self, hospitals: List[Hospital], drones: List[Drone], tasks: List[Task], K: float = 0.001):
        """
        Args:
            hospitals: 医院列表
            drones: 无人机列表
            tasks: 任务列表
            K: 气动常数（来自Cheng/Wu论文，默认值0.001）
        """
        self.hospitals = hospitals
        self.drones = drones
        self.tasks = tasks
        self.K = K
        
        # 建立索引映射
        self.hospital_map = {h.id: h for h in hospitals}
        self.drone_map = {d.identifier: d for d in drones}
        self.task_map = {t.id: t for t in tasks}
    
    def get_hospital(self, hospital_id: int) -> Optional[Hospital]:
        return self.hospital_map.get(hospital_id)
    
    def get_drone(self, hospital_id: int, berth_id: int) -> Optional[Drone]:
        return self.drone_map.get((hospital_id, berth_id))
    
    def get_task(self, task_id: int) -> Optional[Task]:
        return self.task_map.get(task_id)
    
    @property
    def num_hospitals(self) -> int:
        return len(self.hospitals)
    
    @property
    def num_drones(self) -> int:
        return len(self.drones)
    
    @property
    def num_tasks(self) -> int:
        return len(self.tasks)
