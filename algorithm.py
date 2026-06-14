"""算法层模块 - 对应设计框架第4章、第5.2.6-5.2.7节

包含分支定界算法和割平面生成器的实现
"""

import math
from typing import Dict, List, Tuple, Optional, Any
try:
    import pyomo.environ as pyo
except ImportError:
    pyo = None
from data_structures import ProblemData, Drone, Task, Hospital
from model import DroneRoutingModel, VariableManager
from utils import EnergyCalculator, DistanceMatrix


class ValidInequalityGenerator:
    """有效不等式生成器 - 对应设计框架4.4节
    
    负责生成有效不等式，用于收紧松弛解的下界
    """
    
    def __init__(self, model: DroneRoutingModel):
        """
        Args:
            model: 无人机路径模型
        """
        self.model = model
        self.problem_data = model.problem_data
        self.variable_manager = model.variable_manager
        self.energy_calculator = model.energy_calculator
        self.distance_matrix = model.distance_matrix
        self.pyomo_model = model.model
        self.payload_cut_keys = set()
        self.route_cut_keys = set()
    
    def add_min_drone_inequality(self) -> Optional[pyo.Constraint]:
        """添加最小无人机数量不等式（设计框架4.4节）
        
        公式: sum_{i,j,k} x_ijk >= ceil(sum_k w_k / Q)
        
        Returns:
            生成的约束（如果生成成功）
        """
        if not self.problem_data.drones or not self.problem_data.tasks:
            return None
        
        # 计算所有任务的总重量
        total_weight = sum(task.weight for task in self.problem_data.tasks)
        
        # 获取无人机最大载重（假设所有无人机载重相同）
        Q = self.problem_data.drones[0].max_payload
        
        # 计算最小需要的无人机数量
        min_drones = math.ceil(total_weight / Q)
        
        # 构建约束表达式：sum(x_ijk) >= min_drones
        # 使用变量管理器获取变量
        x_sum_expr = pyo.quicksum(
            self.variable_manager.get_x(drone.hospital_id, drone.berth_id, task.id)  # type: ignore
            for drone in self.problem_data.drones
            for task in self.problem_data.tasks
        )
        
        constraint_expr = x_sum_expr >= min_drones  # type: ignore
        constraint = pyo.Constraint(expr=constraint_expr)
        constraint_name = 'valid_inequality_min_drones'
        setattr(self.pyomo_model, constraint_name, constraint)
        
        return constraint
    
    def add_energy_lower_bound_inequalities(self) -> List[pyo.Constraint]:
        """添加能耗下界不等式（设计框架4.4节）
        
        公式: e2_ijk >= K * (w0 + w_k)^1.5 * dist / v * x_ijk
        
        Returns:
            生成的约束列表
        """
        constraints = []
        
        for drone in self.problem_data.drones:
            i, j = drone.hospital_id, drone.berth_id
            
            for task in self.problem_data.tasks:
                k = task.id
                
                # 获取x_ijk变量
                x_ijk = self.variable_manager.get_x(i, j, k)  # type: ignore
                
                # 获取e2_ijk变量
                e2_ijk = self.variable_manager.get_e2(i, j, k)  # type: ignore
                
                # 计算任务运输距离
                task_dist = self.distance_matrix.get_distance(task.origin, task.destination)
                
                # 计算e2下界系数: K * (w0 + w_k)^1.5 * dist / v
                e2_coef = self.energy_calculator.calculate_e2_coef(drone, task, task_dist)
                
                # 构建正确的约束: e2_ijk >= e2_coef * x_ijk
                constraint_expr = e2_ijk >= e2_coef * x_ijk  # type: ignore
                constraint = pyo.Constraint(expr=constraint_expr)
                constraint_name = f'valid_inequality_energy_{i}_{j}_{k}'
                setattr(self.pyomo_model, constraint_name, constraint)
                constraints.append(constraint)
        
        return constraints

    def add_payload_feasibility_cuts(self) -> List[pyo.Constraint]:
        """Forbid assigning tasks that exceed a drone's payload."""
        constraints = []

        for drone in self.problem_data.drones:
            i, j = drone.hospital_id, drone.berth_id

            for task in self.problem_data.tasks:
                k = task.id
                if task.weight <= drone.max_payload:
                    continue

                cut_key = (i, j, k)
                if cut_key in self.payload_cut_keys:
                    continue

                x_ijk = self.variable_manager.get_x(i, j, k)
                constraint = pyo.Constraint(expr=(x_ijk == 0))
                constraint_name = f'payload_infeasible_{i}_{j}_{k}'
                setattr(self.pyomo_model, constraint_name, constraint)
                self.payload_cut_keys.add(cut_key)
                constraints.append(constraint)

        return constraints

    def add_infeasible_route_cuts(self) -> List[pyo.Constraint]:
        """Forbid single-task routes that cannot satisfy the battery limit."""
        constraints = []

        for drone in self.problem_data.drones:
            i, j = drone.hospital_id, drone.berth_id
            E_max = drone.battery_max

            for task in self.problem_data.tasks:
                if task.weight > drone.max_payload:
                    continue

                k = task.id
                origin_dist = self.distance_matrix.get_distance(i, task.origin)
                task_dist = self.distance_matrix.get_distance(task.origin, task.destination)

                for hospital in self.problem_data.hospitals:
                    d = hospital.id
                    cut_key = (i, j, k, d)
                    if cut_key in self.route_cut_keys:
                        continue

                    dest_dist = self.distance_matrix.get_distance(task.destination, d)
                    total_energy = self.energy_calculator.calculate_total(
                        drone, task, origin_dist, task_dist, dest_dist
                    )
                    if total_energy <= E_max * (1 + 1e-6):
                        continue

                    x_ijk = self.variable_manager.get_x(i, j, k)
                    y_ijkd = self.variable_manager.get_y(i, j, k, d)
                    constraint = pyo.Constraint(expr=(x_ijk + y_ijkd <= 1))  # type: ignore
                    constraint_name = f'route_energy_infeasible_{i}_{j}_{k}_{d}'
                    setattr(self.pyomo_model, constraint_name, constraint)
                    self.route_cut_keys.add(cut_key)
                    constraints.append(constraint)

        return constraints
    
    def add_all_valid_inequalities(self) -> List[pyo.Constraint]:
        """添加所有有效不等式
        
        Returns:
            生成的所有约束列表
        """
        constraints = []
        
        # 添加最小无人机数量不等式
        min_drone_constraint = self.add_min_drone_inequality()
        if min_drone_constraint:
            constraints.append(min_drone_constraint)
            print("Added minimum drone inequality")
        
        # e2下界已在基础模型中由 e2_def_* 约束加入，这里不重复添加。
        payload_constraints = self.add_payload_feasibility_cuts()
        constraints.extend(payload_constraints)
        print("Added {} payload feasibility cuts".format(len(payload_constraints)))

        route_constraints = self.add_infeasible_route_cuts()
        constraints.extend(route_constraints)
        print("Added {} infeasible route cuts".format(len(route_constraints)))
        
        return constraints


class CuttingPlaneGenerator:
    """割平面生成器 - 对应设计框架5.2.6节
    
    负责生成次梯度割和逻辑割，用于收紧线性松弛解
    """
    
    def __init__(self, model: DroneRoutingModel):
        """
        Args:
            model: 无人机路径模型
        """
        self.model = model
        self.problem_data = model.problem_data
        self.variable_manager = model.variable_manager
        self.energy_calculator = model.energy_calculator
        self.distance_matrix = model.distance_matrix
        self.pyomo_model = model.model
        self.subgradient_cut_keys = set()
        self.logic_cut_keys = set()
        self.enable_fixed_weight_subgradient = False
        
    def generate_subgradient_cuts(self, solution: Dict[Tuple[int, int, int], float]) -> List[pyo.Constraint]:
        """生成次梯度割（设计框架4.2节步骤三）
        
        用于收紧e2（载重运输能耗）的非线性约束
        公式: e2_ijk >= P(w_k_bar) + beta_ijk * (w_k - w_k_bar)
        
        Args:
            solution: 当前松弛解，键为变量索引，值为松弛值
            
        Returns:
            生成的次梯度割约束列表
        """
        if not self.enable_fixed_weight_subgradient:
            return []

        cuts = []
        
        for drone in self.problem_data.drones:
            i, j = drone.hospital_id, drone.berth_id
            
            for task in self.problem_data.tasks:
                k = task.id
                
                # 获取当前松弛解中的x_ijk值
                x_val = solution.get((i, j, k), 0.0)
                if x_val < 1e-6:
                    continue  # x_ijk接近0，无需加割
                
                # 获取e2变量
                e2_ijk = self.variable_manager.get_e2(i, j, k)
                cut_key = (i, j, k)
                if cut_key in self.subgradient_cut_keys:
                    continue
                
                # 计算载重运输距离
                task_dist = self.distance_matrix.get_distance(task.origin, task.destination)
                
                # 计算线性化点 w_k_bar（使用当前任务载重）
                w_k_bar = task.weight
                
                # 计算 P(w_k_bar) = K * (w0 + w_k_bar)^1.5 * (dist / v)
                P_w_bar = self.energy_calculator.calculate_e2(drone, task, task_dist)
                
                # 计算次梯度 beta_ijk (e2对w_k的导数在w_k_bar处的值)
                # e2 = K * (w0 + w_k)^1.5 * dist / v
                # de2/dw_k = K * 1.5 * (w0 + w_k)^0.5 * dist / v
                beta_ijk = self.energy_calculator.K * 1.5 * math.sqrt(drone.weight + w_k_bar) * (task_dist / drone.speed)
                
                # 构建次梯度割约束（设计框架6.3节）：
                # e2_ijk >= P(w_k_bar) + beta_ijk * (w_k - w_k_bar)
                #
                # 由于 w_k = w_k_bar（任务载重是固定的），
                # 右边简化为 P(w_k_bar)
                # 所以割变为: e2_ijk >= P_w_bar
                #
                # 这个割的作用：当 x_ijk > 0 时，强制 e2 >= P_w_bar
                # 但由于我们已经有 e2 >= e2_coef * x_ijk，这个割只是验证作用
                
                # 次梯度割: e2_ijk >= P(w_k_bar) + beta_ijk * (w_k - w_k_bar)
                # 当前 w_k = w_k_bar（任务载重固定），所以右边简化为 P_w_bar
                # 保留 beta_ijk 计算，方便未来拓展（当 w_k 变为变量时使用）
                constraint = pyo.Constraint(expr=(e2_ijk >= P_w_bar))
                cut_name = f'subgradient_{i}_{j}_{k}'
                setattr(self.pyomo_model, cut_name, constraint)
                self.subgradient_cut_keys.add(cut_key)
                cuts.append(constraint)
        
        return cuts
    
    def generate_logic_cuts(self, solution: Dict[Tuple[int, int, int], float]) -> List[pyo.Constraint]:
        """生成逻辑割（设计框架4.2节步骤四）
        
        如果某无人机-任务-停泊医院组合的能耗超过电池容量，则禁止该路径
        公式: x_ijk + y_ijkd <= l - 1
        
        其中 l 是该路径包含的变量个数（l=2，即 x_ijk 和 y_ijkd）
        所以约束等价于: x_ijk + y_ijkd <= 1
        即：如果选择了该无人机执行该任务，则不能停泊到医院d
        
        Args:
            solution: 当前松弛解
            
        Returns:
            生成的逻辑割约束列表
        """
        cuts = []
        
        for drone in self.problem_data.drones:
            i, j = drone.hospital_id, drone.berth_id
            E_max = drone.battery_max
            
            for task in self.problem_data.tasks:
                k = task.id
                
                # 获取当前松弛解中的x_ijk值
                x_val = solution.get((i, j, k), 0.0)
                if x_val < 1e-6:
                    continue
                
                # 计算三段距离
                origin_dist = self.distance_matrix.get_distance(i, task.origin)
                task_dist = self.distance_matrix.get_distance(task.origin, task.destination)
                
                # 对每个可能的停泊医院检查能耗
                for hospital in self.problem_data.hospitals:
                    d = hospital.id
                    
                    # 计算返航到停泊医院的距离
                    dest_dist = self.distance_matrix.get_distance(task.destination, d)
                    
                    # 计算总能耗
                    total_energy = self.energy_calculator.calculate_total(
                        drone, task, origin_dist, task_dist, dest_dist
                    )
                    
                    # 如果该路径能耗超过电池容量，添加逻辑割
                    if total_energy > E_max * (1 + 1e-6):  # 考虑数值精度
                        cut_key = (i, j, k, d)
                        if cut_key in self.logic_cut_keys:
                            continue
                        x_ijk = self.variable_manager.get_x(i, j, k)
                        y_ijkd = self.variable_manager.get_y(i, j, k, d)
                        
                        # 逻辑割: x_ijk + y_ijkd <= l - 1 = 2 - 1 = 1
                        # 即: x_ijk + y_ijkd <= 1
                        constraint = pyo.Constraint(expr=(x_ijk + y_ijkd <= 1))  # type: ignore
                        cut_name = f'logic_{i}_{j}_{k}_{d}'
                        setattr(self.pyomo_model, cut_name, constraint)
                        self.logic_cut_keys.add(cut_key)
                        cuts.append(constraint)
        
        return cuts
    
    def generate_all_cuts(self, solution: Dict[Tuple[int, int, int], float]) -> List[pyo.Constraint]:
        """生成所有类型的割
        
        Args:
            solution: 当前松弛解
            
        Returns:
            所有生成的割约束列表
        """
        subgradient_cuts = self.generate_subgradient_cuts(solution)
        logic_cuts = self.generate_logic_cuts(solution)
        return subgradient_cuts + logic_cuts


class BranchAndBound:
    """分支定界算法 - 对应设计框架5.2.7节
    
    实现分支定界求解框架，外层对整数变量x_ijk, y_ijkd分支
    """
    
    def __init__(self, model: DroneRoutingModel, cutting_plane_generator: CuttingPlaneGenerator,
                 valid_inequality_generator: Optional[ValidInequalityGenerator] = None):
        """
        Args:
            model: 无人机路径模型
            cutting_plane_generator: 割平面生成器
            valid_inequality_generator: 有效不等式生成器（可选）
        """
        self.model = model
        self.cutting_plane_generator = cutting_plane_generator
        self.valid_inequality_generator = valid_inequality_generator
        self.problem_data = model.problem_data
        self.pyomo_model = model.model
        
        # 算法状态
        self.best_objective = float('inf')
        self.best_solution: Optional[Dict[str, Any]] = None
        self.node_count = 0
        self.cut_count = 0
        self.valid_inequality_count = 0
        self._domains_relaxed = False

    def _relax_binary_domains(self):
        """Relax binary variables to [0, 1] for the custom B&B LP nodes."""
        if self._domains_relaxed:
            return

        for component_name in ('x', 'y', 'u'):
            if hasattr(self.pyomo_model, component_name):
                component = getattr(self.pyomo_model, component_name)
                for var in component.values():
                    var.domain = pyo.UnitInterval

        self._domains_relaxed = True
        
    def _solve_relaxation(self) -> Tuple[Optional[float], Dict[Tuple[int, ...], float]]:
        """求解线性松弛问题（设计框架4.2节步骤二）
        
        Returns:
            (目标函数值, 松弛解)
        """
        try:
            self._relax_binary_domains()

            # 使用CBC求解器或者GLPK
            solver = pyo.SolverFactory('cbc')
            if not solver.available():
                solver = pyo.SolverFactory('glpk')
            
            result = solver.solve(self.pyomo_model, tee=False)
            
            if result.solver.status == pyo.SolverStatus.ok:
                objective_value = pyo.value(self.pyomo_model.obj)  # type: ignore
                
                # 提取松弛解
                solution = {}
                for (i, j, k), var in self.pyomo_model.x.items():  # type: ignore
                    val = pyo.value(var)
                    val = val if val is not None else 0.0
                    solution[(i, j, k)] = val

                for (i, j, k, d), var in self.pyomo_model.y.items():  # type: ignore
                    val = pyo.value(var)
                    val = val if val is not None else 0.0
                    solution[(i, j, k, d)] = val
                
                return objective_value, solution
            else:
                return None, {}
        except Exception as e:
            print(f"求解松弛问题失败: {e}")
            return None, {}

    def _solve_node_with_cuts(
        self, max_cut_rounds: int = 20
    ) -> Tuple[Optional[float], Dict[Tuple[int, ...], float]]:
        """Solve the current node LP and add violated cuts until stable."""
        objective_value, solution = self._solve_relaxation()

        if objective_value is None:
            return None, {}

        for _ in range(max_cut_rounds):
            cuts = self.cutting_plane_generator.generate_all_cuts(solution)
            if not cuts:
                break

            self.cut_count += len(cuts)
            objective_value, solution = self._solve_relaxation()
            if objective_value is None:
                return None, {}

        return objective_value, solution
    
    def _branch(self, solution: Dict[Tuple[int, int, int], float]) -> Optional[Tuple[Tuple[int, int, int], float]]:
        """生成分支（选择一个分数变量进行分支）
        
        Args:
            solution: 当前松弛解
            
        Returns:
            选中的分支变量和其分数值，若无分数变量则返回None
        """
        best_var = None
        best_fraction = 0.0
        
        for key, val in solution.items():
            # 检查是否为分数（不在0或1附近）
            if 0.01 < val < 0.99:
                fraction = min(val, 1 - val)
                if fraction > best_fraction:
                    best_fraction = fraction
                    best_var = key
        
        if best_var is not None:
            return (best_var, solution[best_var])
        return None
    
    def _add_branch_constraint(self, var_key: Tuple[int, int, int], value: int):
        """添加分支约束
        
        Args:
            var_key: 变量索引 (i, j, k) 或 (i, j, k, d)
            value: 分支值 (0 或 1)
        """
        if len(var_key) == 3:
            # x_ijk变量
            i, j, k = var_key
            x_ijk = self.pyomo_model.x[(i, j, k)]  # type: ignore
            constraint_expr = x_ijk == value  # type: ignore
            constraint_name = f'branch_x_{i}_{j}_{k}_{value}'
        else:
            # y_ijkd变量
            i, j, k, d = var_key
            y_ijkd = self.pyomo_model.y[(i, j, k, d)]  # type: ignore
            constraint_expr = y_ijkd == value  # type: ignore
            constraint_name = f'branch_y_{i}_{j}_{k}_{d}_{value}'
        
        if hasattr(self.pyomo_model, constraint_name):
            return

        constraint = pyo.Constraint(expr=constraint_expr)
        setattr(self.pyomo_model, constraint_name, constraint)
    
    def _remove_branch_constraint(self, var_key: Tuple[int, int, int], value: int):
        """移除分支约束
        
        Args:
            var_key: 变量索引
            value: 分支值
        """
        if len(var_key) == 3:
            constraint_name = f'branch_x_{var_key[0]}_{var_key[1]}_{var_key[2]}_{value}'
        else:
            constraint_name = f'branch_y_{var_key[0]}_{var_key[1]}_{var_key[2]}_{var_key[3]}_{value}'
        
        if hasattr(self.pyomo_model, constraint_name):
            delattr(self.pyomo_model, constraint_name)
    
    def _is_integer_solution(self, solution: Dict[Tuple[int, int, int], float], tolerance: float = 1e-6) -> bool:
        """检查是否为整数解
        
        Args:
            solution: 当前解
            tolerance: 数值容差
            
        Returns:
            是否为整数解
        """
        for val in solution.values():
            if not (abs(val) < tolerance or abs(val - 1) < tolerance):
                return False
        return True
    
    def _check_energy_feasibility(self, solution: Dict[Tuple[int, int, int], float]) -> bool:
        """检查能耗可行性（设计框架4.2节步骤四）
        
        Args:
            solution: 当前解
            
        Returns:
            是否满足能耗约束
        """
        for drone in self.problem_data.drones:
            i, j = drone.hospital_id, drone.berth_id
            E_max = drone.battery_max
            
            total_energy = 0.0
            
            for task in self.problem_data.tasks:
                k = task.id
                x_val = solution.get((i, j, k), 0.0)
                
                if abs(x_val - 1) < 1e-6:
                    # 该无人机执行此任务，计算能耗
                    for hospital in self.problem_data.hospitals:
                        d = hospital.id
                        # 检查y_ijkd值
                        y_val = pyo.value(self.pyomo_model.y[(i, j, k, d)]) if hasattr(self.pyomo_model, 'y') else 0  # type: ignore
                        y_val = y_val if y_val is not None else 0
                        
                        if abs(y_val - 1) < 1e-6:
                            # 计算三段距离
                            origin_dist = self.cutting_plane_generator.distance_matrix.get_distance(i, task.origin)
                            task_dist = self.cutting_plane_generator.distance_matrix.get_distance(task.origin, task.destination)
                            dest_dist = self.cutting_plane_generator.distance_matrix.get_distance(task.destination, d)
                            
                            # 计算总能耗
                            total_energy = self.cutting_plane_generator.energy_calculator.calculate_total(
                                drone, task, origin_dist, task_dist, dest_dist
                            )
                            break
            
            if total_energy > E_max * (1 + 1e-6):
                return False
        
        return True
    
    def _update_best_solution(self, solution: Dict[Tuple[int, int, int], float], objective_value: float):
        """更新最优解
        
        Args:
            solution: 当前解
            objective_value: 当前目标函数值
        """
        if objective_value < self.best_objective:
            self.best_objective = objective_value
            
            # 提取完整解信息
            full_solution = {
                'objective_value': objective_value,
                'x_assignments': [],
                'y_assignments': [],
                'u_values': [],
                'drone_assignments': {},
                'total_distance': objective_value,
                'energy_consumption': {}
            }
            
            # 提取x_ijk
            for key, val in solution.items():
                if len(key) != 3:
                    continue
                i, j, k = key
                if abs(val - 1) < 1e-6:
                    full_solution['x_assignments'].append({
                        'hospital_id': i,
                        'berth_id': j,
                        'task_id': k,
                        'value': val
                    })
                    full_solution['drone_assignments'][f'{i}_{j}'] = k
            
            # 提取y_ijkd
            if hasattr(self.pyomo_model, 'y'):
                for (i, j, k, d), var in self.pyomo_model.y.items():  # type: ignore
                    val = pyo.value(var)
                    val = val if val is not None else 0.0
                    if abs(val - 1) < 1e-6:
                        full_solution['y_assignments'].append({
                            'hospital_id': i,
                            'berth_id': j,
                            'task_id': k,
                            'dest_hospital_id': d,
                            'value': val
                        })
            
            # 提取u_ij
            if hasattr(self.pyomo_model, 'u'):
                for (i, j), var in self.pyomo_model.u.items():  # type: ignore
                    val = pyo.value(var)
                    val = val if val is not None else 0.0
                    if abs(val - 1) < 1e-6:
                        full_solution['u_values'].append({
                            'hospital_id': i,
                            'berth_id': j,
                            'value': val
                        })
            
            self.best_solution = full_solution
    
    def solve(self, max_nodes: int = 10000, tolerance: float = 1e-6) -> Optional[Dict[str, Any]]:
        """执行分支定界求解（设计框架4.2节算法流程）
        
        Args:
            max_nodes: 最大搜索节点数
            tolerance: 最优性容差
            
        Returns:
            最优解（如果找到）
        """
        print("开始分支定界求解...")
        
        # 步骤一：构建原始模型（已在初始化时完成）
        
        # 添加有效不等式（设计框架4.4节）
        if self.valid_inequality_generator:
            inequalities = self.valid_inequality_generator.add_all_valid_inequalities()
            self.valid_inequality_count += len(inequalities)
            self.cutting_plane_generator.logic_cut_keys.update(
                self.valid_inequality_generator.route_cut_keys
            )
            print(f"添加 {len(inequalities)} 个有效不等式")
        
        # 步骤五：分支定界迭代
        return self._branch_and_bound_recursive(max_nodes, tolerance)
    
    def _branch_and_bound_recursive(self, max_nodes: int, tolerance: float) -> Optional[Dict[str, Any]]:
        """分支定界递归求解
        
        Args:
            max_nodes: 剩余最大搜索节点数
            tolerance: 最优性容差
            
        Returns:
            最优解
        """
        if self.node_count >= max_nodes:
            print(f"达到最大节点数限制 ({max_nodes})")
            return self.best_solution
        
        # 求解当前节点的松弛问题，并循环生成割
        objective_value, solution = self._solve_node_with_cuts()
        
        if objective_value is None:
            return self.best_solution
        
        self.node_count += 1
        
        # 剪枝：如果松弛解的目标值 >= 当前最优解，则剪枝
        if objective_value >= self.best_objective - tolerance:
            return self.best_solution
        
        # 检查是否为整数解
        if self._is_integer_solution(solution):
            # 检查能耗可行性
            if self._check_energy_feasibility(solution):
                print(f"找到可行整数解，目标值: {objective_value:.4f}")
                self._update_best_solution(solution, objective_value)
            return self.best_solution
        
        # 选择分支变量
        branch_info = self._branch(solution)
        
        if branch_info is None:
            # 没有可分支的变量，当前解已是整数解
            if self._check_energy_feasibility(solution):
                self._update_best_solution(solution, objective_value)
            return self.best_solution
        
        var_key, var_value = branch_info
        var_name = 'x' if len(var_key) == 3 else 'y'
        print(f"节点 {self.node_count}: 分支变量 {var_name}_{var_key}, 值={var_value:.4f}")
        
        # 分支1：设置变量为0
        self._add_branch_constraint(var_key, 0)
        self._branch_and_bound_recursive(max_nodes, tolerance)
        self._remove_branch_constraint(var_key, 0)
        
        # 剪枝检查
        if objective_value >= self.best_objective - tolerance:
            return self.best_solution
        
        # 分支2：设置变量为1
        self._add_branch_constraint(var_key, 1)
        self._branch_and_bound_recursive(max_nodes, tolerance)
        self._remove_branch_constraint(var_key, 1)
        
        return self.best_solution
    
    def get_statistics(self) -> Dict[str, int | float]:
        """获取求解统计信息
        
        Returns:
            统计信息字典
        """
        return {
            'nodes_explored': self.node_count,
            'cuts_generated': self.cut_count,
            'valid_inequalities_added': self.valid_inequality_count,
            'best_objective': self.best_objective
        }
