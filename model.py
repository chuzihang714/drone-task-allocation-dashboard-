from typing import Dict, Tuple, Any
try:
    import pyomo.environ as pyo
except ImportError:
    pyo = None
from data_structures import ProblemData, Hospital, Drone, Task
from utils import DistanceMatrix, EnergyCalculator


class VariableManager:
    """变量管理类 - 对应设计框架5.2.3节
    
    管理所有决策变量 x_ijk, y_ijkd, u_ij
    """
    
    def __init__(self, model: pyo.ConcreteModel, problem_data: ProblemData):
        """
        Args:
            model: Pyomo模型对象
            problem_data: 问题数据
        """
        self.model = model
        self.problem_data = problem_data
        self._variables: Dict[str, pyo.Var] = {}
        self._create_variables()
    
    def _create_variables(self):
        """创建所有决策变量"""
        # 获取索引集合
        hospitals = self.problem_data.hospitals
        drones = self.problem_data.drones
        tasks = self.problem_data.tasks
        
        # 创建变量 x_ijk：第i家医院的第j台无人机是否执行任务k
        # x[(hospital_id, berth_id, task_id)]
        x_indices = [(d.hospital_id, d.berth_id, t.id) 
                     for d in drones 
                     for t in tasks]
        self.model.x = pyo.Var(x_indices, domain=pyo.Binary, doc='x_ijk')
        
        # 创建变量 y_ijkd：无人机ij执行任务k后是否停泊到医院d
        # y[(hospital_id, berth_id, task_id, dest_hospital_id)]
        y_indices = [(d.hospital_id, d.berth_id, t.id, h.id) 
                     for d in drones 
                     for t in tasks 
                     for h in hospitals]
        self.model.y = pyo.Var(y_indices, domain=pyo.Binary, doc='y_ijkd')
        
        # 创建变量 u_ij：无人机ij是否停留在初始医院（辅助变量）
        # u[(hospital_id, berth_id)]
        u_indices = [(d.hospital_id, d.berth_id) for d in drones]
        self.model.u = pyo.Var(u_indices, domain=pyo.Binary, doc='u_ij')
        
        # 创建变量 e2_ijk：无人机ij执行任务k的载重运输段能耗（连续变量）
        # 用于次梯度割的线性化
        # e2[(hospital_id, berth_id, task_id)]
        e2_indices = [(d.hospital_id, d.berth_id, t.id) 
                      for d in drones 
                      for t in tasks]
        self.model.e2 = pyo.Var(e2_indices, domain=pyo.NonNegativeReals, doc='e2_ijk')
    
    def get_x(self, hospital_id: int, berth_id: int, task_id: int) -> pyo.Var:
        """获取x_ijk变量
        
        Args:
            hospital_id: 医院索引 i
            berth_id: 无人机索引 j
            task_id: 任务索引 k
        
        Returns:
            x_ijk变量
        """
        return self.model.x[(hospital_id, berth_id, task_id)]  # type: ignore
    
    def get_y(self, hospital_id: int, berth_id: int, task_id: int, dest_hospital_id: int) -> pyo.Var:
        """获取y_ijkd变量
        
        Args:
            hospital_id: 医院索引 i
            berth_id: 无人机索引 j
            task_id: 任务索引 k
            dest_hospital_id: 停泊医院索引 d
        
        Returns:
            y_ijkd变量
        """
        return self.model.y[(hospital_id, berth_id, task_id, dest_hospital_id)]  # type: ignore
    
    def get_u(self, hospital_id: int, berth_id: int) -> pyo.Var:
        """获取u_ij变量
        
        Args:
            hospital_id: 医院ID
            berth_id: 停泊位ID
            
        Returns:
            u_ij变量
        """
        return self.model.u[(hospital_id, berth_id)]  # type: ignore
    
    def get_e2(self, hospital_id: int, berth_id: int, task_id: int) -> pyo.Var:
        """获取e2_ijk变量
        
        Args:
            hospital_id: 医院ID
            berth_id: 停泊位ID
            task_id: 任务ID
            
        Returns:
            e2_ijk变量
        """
        return self.model.e2[(hospital_id, berth_id, task_id)]  # type: ignore
    
    def __repr__(self):
        x_count = len(self.model.x)  # type: ignore
        y_count = len(self.model.y)  # type: ignore
        u_count = len(self.model.u)  # type: ignore
        return f"VariableManager(x_vars={x_count}, y_vars={y_count}, u_vars={u_count})"


class ConstraintSystem:
    """约束系统类 - 对应设计框架5.2.4节
    
    管理所有约束条件
    """
    
    def __init__(self, model: pyo.ConcreteModel, vm: VariableManager, 
                 dm: DistanceMatrix, ec: EnergyCalculator):
        """
        Args:
            model: Pyomo模型对象
            vm: 变量管理器
            dm: 距离矩阵
            ec: 能耗计算器
        """
        self.model = model
        self.vm = vm
        self.dm = dm
        self.ec = ec
        self._constraints: Dict[str, pyo.Constraint] = {}
    
    def add_storage_constraint(self, hospital: Hospital):
        """添加仓位约束（约束1）
        
        公式: sum_{j,k} x_ijk + m_i >= sum_{i',j,k} y_ijki
        
        Args:
            hospital: 医院对象
        
        Returns:
            添加的约束
        """
        problem_data = self.vm.problem_data
        i = hospital.id
        m_i = hospital.initial_empty
        
        # 左边：从医院i起飞的无人机数量 + 初始空余仓位
        left_expr = sum(self.vm.get_x(i, d.berth_id, t.id)  # type: ignore
                       for d in problem_data.drones if d.hospital_id == i
                       for t in problem_data.tasks) + float(m_i)
        
        # 右边：停泊到医院i的无人机数量
        right_expr = sum(self.vm.get_y(d.hospital_id, d.berth_id, t.id, i)  # type: ignore
                        for d in problem_data.drones
                        for t in problem_data.tasks)
        
        constraint = pyo.Constraint(expr=(left_expr >= right_expr))
        setattr(self.model, f'storage_{i}', constraint)
        self._constraints[f'storage_{i}'] = constraint
        return constraint
    
    def add_task_allocation_constraint(self, task: Task):
        """添加任务唯一分配约束（约束4）
        
        公式: sum_{i,j} x_ijk = 1
        
        Args:
            task: 任务对象
        
        Returns:
            添加的约束
        """
        problem_data = self.vm.problem_data
        k = task.id
        
        expr = sum(self.vm.get_x(d.hospital_id, d.berth_id, k)  # type: ignore
                  for d in problem_data.drones) == 1
        
        constraint = pyo.Constraint(expr=expr)
        setattr(self.model, f'task_allocation_{k}', constraint)
        self._constraints[f'task_allocation_{k}'] = constraint
        return constraint
    
    def add_drone_capacity_constraint(self, drone: Drone):
        """添加无人机容量约束（约束5）
        
        公式: sum_k x_ijk <= 1
        
        Args:
            drone: 无人机对象
        
        Returns:
            添加的约束
        """
        problem_data = self.vm.problem_data
        i, j = drone.hospital_id, drone.berth_id
        
        expr = sum(self.vm.get_x(i, j, t.id)  # type: ignore
                  for t in problem_data.tasks) <= 1
        
        constraint = pyo.Constraint(expr=expr)
        setattr(self.model, f'drone_capacity_{i}_{j}', constraint)
        self._constraints[f'drone_capacity_{i}_{j}'] = constraint
        return constraint
    
    def add_task_parking_link_constraint(self):
        """添加任务-停泊关联约束（约束2）
        
        公式: sum_d y_ijkd = x_ijk
        
        Returns:
            添加的约束列表
        """
        problem_data = self.vm.problem_data
        constraints = []
        
        for d in problem_data.drones:
            for t in problem_data.tasks:
                i, j, k = d.hospital_id, d.berth_id, t.id
                
                # sum_d y_ijkd = x_ijk
                left_expr = sum(self.vm.get_y(i, j, k, h.id)  # type: ignore
                              for h in problem_data.hospitals)
                right_expr = self.vm.get_x(i, j, k)  # type: ignore
                
                constraint = pyo.Constraint(expr=(left_expr == right_expr))
                setattr(self.model, f'task_parking_{i}_{j}_{k}', constraint)
                self._constraints[f'task_parking_{i}_{j}_{k}'] = constraint
                constraints.append(constraint)
        
        return constraints
    
    def add_idle_drone_constraint(self, drone: Drone):
        """添加无任务无人机约束（约束3）
        
        公式: u_ij = 1 - sum_k x_ijk
              sum_{k,d} y_ijkd + u_ij = 1
        
        Args:
            drone: 无人机对象
        
        Returns:
            添加的约束列表
        """
        problem_data = self.vm.problem_data
        i, j = drone.hospital_id, drone.berth_id
        constraints = []
        
        # u_ij = 1 - sum_k x_ijk
        expr1 = self.vm.get_u(i, j) == 1 - sum(self.vm.get_x(i, j, t.id)  # type: ignore
                                               for t in problem_data.tasks)
        constraint1 = pyo.Constraint(expr=expr1)
        setattr(self.model, f'idle_drone_u_{i}_{j}', constraint1)
        self._constraints[f'idle_drone_u_{i}_{j}'] = constraint1
        constraints.append(constraint1)
        
        # sum_{k,d} y_ijkd + u_ij = 1
        expr2 = sum(self.vm.get_y(i, j, t.id, h.id)  # type: ignore
                   for t in problem_data.tasks
                   for h in problem_data.hospitals) + self.vm.get_u(i, j) == 1
        constraint2 = pyo.Constraint(expr=expr2)
        setattr(self.model, f'idle_drone_y_{i}_{j}', constraint2)
        self._constraints[f'idle_drone_y_{i}_{j}'] = constraint2
        constraints.append(constraint2)
        
        return constraints
    
    def add_total_task_constraint(self, N: int):
        """添加总任务数量约束（约束6）
        
        公式: sum_{i,j,k} x_ijk = N
        
        Args:
            N: 任务总数
        
        Returns:
            添加的约束
        """
        problem_data = self.vm.problem_data
        
        expr = sum(self.vm.get_x(d.hospital_id, d.berth_id, t.id)  # type: ignore
                  for d in problem_data.drones
                  for t in problem_data.tasks) == N
        
        constraint = pyo.Constraint(expr=expr)
        setattr(self.model, 'total_task', constraint)
        self._constraints['total_task'] = constraint
        return constraint
    
    def add_e2_definition_constraint(self, drone: Drone, task: Task):
        """添加e2定义约束
        
        公式: e2_ijk >= K * (w0 + wk)^1.5 * (dist_orig_dest / v) * x_ijk
        
        这是e2的下界约束，用于次梯度割的线性化。
        
        Args:
            drone: 无人机对象
            task: 任务对象
        
        Returns:
            添加的约束
        """
        i, j = drone.hospital_id, drone.berth_id
        k = task.id
        
        # 载重运输距离
        task_dist = self.dm.get_distance(task.origin, task.destination)
        
        # 计算e2的下界系数：K * (w0 + wk)^1.5 * (dist / v)
        e2_coef = self.ec.calculate_e2_coef(drone, task, task_dist)
        
        # e2_ijk >= e2_coef * x_ijk
        x_ijk = self.vm.get_x(i, j, k)  # type: ignore
        e2_ijk = self.vm.get_e2(i, j, k)  # type: ignore
        
        constraint = pyo.Constraint(expr=(e2_ijk >= e2_coef * x_ijk))
        setattr(self.model, f'e2_def_{i}_{j}_{k}', constraint)
        self._constraints[f'e2_def_{i}_{j}_{k}'] = constraint
        return constraint
    
    def add_energy_constraint(self, drone: Drone):
        """添加能耗约束（约束7）
        
        公式: sum_{k} (e1_ijk + e2_ijk + e3_ijk) * x_ijk * y_ijkd <= E_max
        
        其中：
        - e1 = K * w0^1.5 * (dist_origin / v)
        - e2 = e2_ijk (使用变量，在e2定义约束中定义下界)
        - e3 = K * w0^1.5 * (dist_dest / v)
        
        Args:
            drone: 无人机对象
        
        Returns:
            添加的约束
        """
        problem_data = self.vm.problem_data
        i, j = drone.hospital_id, drone.berth_id
        E_max = drone.battery_max
        
        # 计算每段能耗并构建约束表达式
        expr = 0
        for t in problem_data.tasks:
            k = t.id
            
            # 获取变量
            x_ijk = self.vm.get_x(i, j, k)  # type: ignore
            e2_ijk = self.vm.get_e2(i, j, k)  # type: ignore
            
            # 计算e1和e3的固定系数（不是变量）
            origin_dist = self.dm.get_distance(i, t.origin)
            e1_coef = self.ec.calculate_e1(drone, origin_dist)
            
            for h in problem_data.hospitals:
                d = h.id
                # 空载返航距离
                dest_dist = self.dm.get_distance(t.destination, d)
                # e3系数
                e3_coef = self.ec.calculate_e3(drone, dest_dist)
                
                # 总能耗 = e1 + e2 + e3，乘以 x_ijk * y_ijkd
                y_ijkd = self.vm.get_y(i, j, k, d)  # type: ignore
                expr += (e1_coef + e2_ijk + e3_coef) * x_ijk * y_ijkd  # type: ignore
        
        constraint = pyo.Constraint(expr=(expr <= E_max))
        setattr(self.model, f'energy_{i}_{j}', constraint)
        self._constraints[f'energy_{i}_{j}'] = constraint
        return constraint
    
    def add_all_constraints(self):
        """添加所有约束"""
        problem_data = self.vm.problem_data
        
        # 添加仓位约束（每个医院一个）
        for h in problem_data.hospitals:
            self.add_storage_constraint(h)
        
        # 添加任务唯一分配约束（每个任务一个）
        for t in problem_data.tasks:
            self.add_task_allocation_constraint(t)
        
        # 添加无人机容量约束（每个无人机一个）
        for d in problem_data.drones:
            self.add_drone_capacity_constraint(d)
        
        # 添加任务-停泊关联约束
        self.add_task_parking_link_constraint()
        
        # 添加无任务无人机约束（每个无人机一个）
        for d in problem_data.drones:
            self.add_idle_drone_constraint(d)
        
        # 添加总任务数量约束
        self.add_total_task_constraint(problem_data.num_tasks)
        
        # 添加e2定义约束（每个无人机-任务组合一个）
        for d in problem_data.drones:
            for t in problem_data.tasks:
                self.add_e2_definition_constraint(d, t)
        
        # 能耗约束通过逻辑割处理（在分支定界算法中动态添加）
        # 不在这里添加显式约束以避免非线性项问题
    
    def __repr__(self):
        return f"ConstraintSystem(constraints={len(self._constraints)})"


class ObjectiveFunction:
    """目标函数类 - 对应设计框架5.2.5节
    
    构建最小化总飞行距离的目标函数
    """
    
    def __init__(self, model: pyo.ConcreteModel, vm: VariableManager, dm: DistanceMatrix):
        """
        Args:
            model: Pyomo模型对象
            vm: 变量管理器
            dm: 距离矩阵
        """
        self.model = model
        self.vm = vm
        self.dm = dm
    
    def build(self):
        """构建目标函数表达式
        
        公式: min Z = sum_{i,j,k} x_ijk * dist(i,orig(k))  // 空载前飞
                   + sum_{i,j,k} x_ijk * dist(orig(k),dest(k))  // 载重运输
                   + sum_{i,j,k,d} y_ijkd * dist(dest(k),d)  // 空载返航
        
        Returns:
            目标函数表达式
        """
        problem_data = self.vm.problem_data
        
        # 空载前飞距离：医院i → 任务起点orig(k)
        e1_expr = sum(self.vm.get_x(d.hospital_id, d.berth_id, t.id) *  # type: ignore
                      self.dm.get_distance(d.hospital_id, t.origin)
                      for d in problem_data.drones
                      for t in problem_data.tasks)
        
        # 载重运输距离：orig(k) → dest(k)
        e2_expr = sum(self.vm.get_x(d.hospital_id, d.berth_id, t.id) *  # type: ignore
                      self.dm.get_distance(t.origin, t.destination)
                      for d in problem_data.drones
                      for t in problem_data.tasks)
        
        # 空载返航距离：dest(k) → 医院d
        e3_expr = sum(self.vm.get_y(d.hospital_id, d.berth_id, t.id, h.id) *  # type: ignore
                      self.dm.get_distance(t.destination, h.id)
                      for d in problem_data.drones
                      for t in problem_data.tasks
                      for h in problem_data.hospitals)
        
        # 总目标函数
        obj_expr = e1_expr + e2_expr + e3_expr
        
        # 设置目标函数
        self.model.obj = pyo.Objective(expr=obj_expr, sense=pyo.minimize)
        
        return obj_expr
    
    def __repr__(self):
        return "ObjectiveFunction(minimize_total_distance)"


class DroneRoutingModel:
    """无人机任务分配模型 - 整合变量、约束、目标函数"""
    
    def __init__(self, problem_data: ProblemData):
        """
        Args:
            problem_data: 问题数据
        """
        self.problem_data = problem_data
        
        # 创建Pyomo模型
        self.model = pyo.ConcreteModel()
        
        # 创建距离矩阵和能耗计算器
        # EnergyCalculator使用物理常量计算K值
        self.distance_matrix = DistanceMatrix(problem_data.hospitals)
        self.energy_calculator = EnergyCalculator()
        
        # 创建变量管理器
        self.variable_manager = VariableManager(self.model, problem_data)
        
        # 创建约束系统
        self.constraint_system = ConstraintSystem(
            self.model, self.variable_manager, 
            self.distance_matrix, self.energy_calculator
        )
        
        # 创建目标函数
        self.objective_function = ObjectiveFunction(
            self.model, self.variable_manager, self.distance_matrix
        )
    
    def build(self):
        """构建完整模型"""
        # 添加所有约束
        self.constraint_system.add_all_constraints()
        
        # 构建目标函数
        self.objective_function.build()
        
        return self.model
    
    def __repr__(self):
        return f"DroneRoutingModel(hospitals={self.problem_data.num_hospitals}, " \
               f"drones={self.problem_data.num_drones}, tasks={self.problem_data.num_tasks})"
