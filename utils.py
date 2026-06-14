import math
from typing import List, Dict, Tuple
from data_structures import Hospital, Drone, Task, ProblemData


class PhysicalConstants:
    """物理常数类 - 用于计算气动常数K
    
    根据Cheng/Wu论文定义的气动常数计算公式：
    K = sqrt(g^3 / (2 * rho * sigma * h))
    
    参考论文: Drone routing with energy function: Formulation and exact algorithm
    """
    
    # 默认物理参数值（来自论文）
    DEFAULT_G = 9.81          # 重力加速度 (m/s²)
    DEFAULT_RHO = 1.204       # 海平面空气密度 (kg/m³)
    DEFAULT_SIGMA = 0.0064   # 单旋翼桨盘总面积 (m²)
    DEFAULT_H = 6             # 旋翼桨叶数量（6轴无人机）
    
    def __init__(self, g: float = None, rho: float = None, 
                 sigma: float = None, h: int = None):
        """
        Args:
            g: 重力加速度 (m/s²)，默认9.81
            rho: 空气密度 (kg/m³)，默认1.204
            sigma: 桨盘面积 (m²)，默认0.0064
            h: 桨叶数量，默认6
        """
        self.g = g if g is not None else self.DEFAULT_G
        self.rho = rho if rho is not None else self.DEFAULT_RHO
        self.sigma = sigma if sigma is not None else self.DEFAULT_SIGMA
        self.h = h if h is not None else self.DEFAULT_H
    
    def calculate_K(self) -> float:
        """计算气动常数K
        
        公式: K = sqrt(g^3 / (2 * rho * sigma * h))
        
        Returns:
            气动常数K
        """
        numerator = self.g ** 3
        denominator = 2 * self.rho * self.sigma * self.h
        return math.sqrt(numerator / denominator)
    
    def __repr__(self):
        return f"PhysicalConstants(g={self.g}, rho={self.rho}, sigma={self.sigma}, h={self.h})"


class DistanceMatrix:
    """距离矩阵类 - 对应设计框架5.2.1节
    
    计算并缓存所有医院之间的欧氏距离
    """
    
    def __init__(self, hospitals: List[Hospital]):
        """
        Args:
            hospitals: 医院列表
        """
        self.hospitals = hospitals
        self.hospital_ids = [h.id for h in hospitals]
        self._matrix: Dict[tuple, float] = {}
        self._build_matrix()
    
    def _build_matrix(self):
        """构建距离矩阵"""
        for h1 in self.hospitals:
            for h2 in self.hospitals:
                if h1.id != h2.id:
                    dist = self._euclidean_distance(h1.location, h2.location)
                    self._matrix[(h1.id, h2.id)] = dist
                else:
                    self._matrix[(h1.id, h2.id)] = 0.0
    
    @staticmethod
    def _euclidean_distance(p1: tuple, p2: tuple) -> float:
        """计算两点之间的欧氏距离
        
        Args:
            p1: 点1坐标 (x, y)
            p2: 点2坐标 (x, y)
        
        Returns:
            欧氏距离
        """
        return math.sqrt((p1[0] - p2[0])**2 + (p1[1] - p2[1])**2)
    
    def get_distance(self, p_id: int, q_id: int) -> float:
        """获取医院p到医院q的距离
        
        Args:
            p_id: 医院p的ID
            q_id: 医院q的ID
        
        Returns:
            医院p到q的距离（对应符号 dist(p,q)）
        """
        return self._matrix.get((p_id, q_id), 0.0)
    
    def __repr__(self):
        return f"DistanceMatrix(hospitals={len(self.hospitals)})"


class EnergyCalculator:
    """能耗计算类 - 对应设计框架5.2.2节
    
    基于Cheng/Wu论文的三段能耗公式计算无人机能耗
    
    能耗公式:
    - e1 = K * w_0^1.5 * (d/v)  (空载前飞)
    - e2 = K * (w_0 + w_k)^1.5 * (d/v)  (载重运输)
    - e3 = K * w_0^1.5 * (d/v)  (空载返航)
    
    其中气动常数K由物理常量计算:
    K = sqrt(g^3 / (2 * rho * sigma * h))
    """
    
    def __init__(self, physical_constants: PhysicalConstants = None):
        """
        Args:
            physical_constants: 物理常数对象（用于计算K），如果为None则使用默认值
        """
        if physical_constants is not None:
            self.physical_constants = physical_constants
        else:
            # 使用默认物理常数计算K
            self.physical_constants = PhysicalConstants()
        self.K = self.physical_constants.calculate_K()
    
    def calculate_e1(self, drone: Drone, distance: float) -> float:
        """计算空载前飞能耗
        
        公式: K * w_0^1.5 * (distance / v)
        
        Args:
            drone: 无人机对象
            distance: 飞行距离
        
        Returns:
            空载前飞能耗（对应符号 e1）
        """
        return self.K * (drone.weight ** 1.5) * (distance / drone.speed)
    
    def calculate_e2(self, drone: Drone, task: Task, distance: float) -> float:
        """计算载重运输能耗
        
        公式: K * (w_0 + w_k)^1.5 * (distance / v)
        
        Args:
            drone: 无人机对象
            task: 任务对象
            distance: 飞行距离
        
        Returns:
            载重运输能耗（对应符号 e2）
        """
        total_weight = drone.weight + task.weight
        return self.K * (total_weight ** 1.5) * (distance / drone.speed)
    
    def calculate_e2_coef(self, drone: Drone, task: Task, distance: float) -> float:
        """计算e2的下界系数（用于e2定义约束）
        
        公式: K * (w_0 + w_k)^1.5 * (distance / v)
        
        这个系数用于约束: e2_ijk >= e2_coef * x_ijk
        
        Args:
            drone: 无人机对象
            task: 任务对象
            distance: 飞行距离
        
        Returns:
            e2下界系数
        """
        return self.calculate_e2(drone, task, distance)
    
    def calculate_e3(self, drone: Drone, distance: float) -> float:
        """计算空载返航能耗
        
        公式: K * w_0^1.5 * (distance / v)
        
        Args:
            drone: 无人机对象
            distance: 飞行距离
        
        Returns:
            空载返航能耗（对应符号 e3）
        """
        return self.K * (drone.weight ** 1.5) * (distance / drone.speed)
    
    def calculate_total(self, drone: Drone, task: Task, 
                        origin_dist: float, task_dist: float, dest_dist: float) -> float:
        """计算三段总能耗
        
        Args:
            drone: 无人机对象
            task: 任务对象
            origin_dist: 空载前飞距离（医院i → 任务起点orig(k)）
            task_dist: 载重运输距离（orig(k) → dest(k)）
            dest_dist: 空载返航距离（dest(k) → 医院d）
        
        Returns:
            三段总能耗（对应符号 e_ijk）
        """
        e1 = self.calculate_e1(drone, origin_dist)
        e2 = self.calculate_e2(drone, task, task_dist)
        e3 = self.calculate_e3(drone, dest_dist)
        return e1 + e2 + e3
    
    def __repr__(self):
        return f"EnergyCalculator(K={self.K})"
