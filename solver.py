try:
    import pyomo.environ as pyo
except ImportError:
    pyo = None
from typing import Dict, Tuple, Any, Optional
from data_structures import ProblemData, Hospital, Drone, Task
from model import DroneRoutingModel
from single_task_model import SingleTaskMILPModel
from algorithm import BranchAndBound, CuttingPlaneGenerator, ValidInequalityGenerator


class DroneRoutingSolver:
    """求解器类 - 对应设计框架5.2.9节
    
    负责模型构建和求解，支持标准MIP求解和自定义分支定界算法
    """
    
    def __init__(self, problem_data: ProblemData):
        """
        Args:
            problem_data: 问题数据
        """
        self.problem_data = problem_data
        self.model: Optional[DroneRoutingModel] = None
        self.single_task_model: Optional[SingleTaskMILPModel] = None
        self.solution: Optional[Dict[str, Any]] = None
        self.solver_type: str = 'cbc'
        self.algorithm_type: str = 'mip'  # 'mip', 'single_task_mip', or 'branch_and_bound'
        
        # 算法组件
        self.cutting_plane_generator: Optional[CuttingPlaneGenerator] = None
        self.valid_inequality_generator: Optional[ValidInequalityGenerator] = None
        self.branch_and_bound: Optional[BranchAndBound] = None
    
    @property
    def pyomo_model(self) -> pyo.ConcreteModel:
        """获取底层 Pyomo 模型"""
        if self.algorithm_type == 'single_task_mip':
            assert self.single_task_model is not None, "Single-task model has not been built"
            return self.single_task_model.model
        assert self.model is not None, "Model has not been built"
        return self.model.model
    
    def set_solver(self, solver_type: str = 'cbc'):
        """设置求解器类型（设计框架7.1节）
        
        Args:
            solver_type: 求解器类型，支持 'cbc', 'glpk', 'gurobi'
        """
        self.solver_type = solver_type
    
    def export_to_mps(self, file_path: str):
        """导出模型为MPS格式（设计框架7.1节）
        
        MPS（Mathematical Programming System）是标准的数学规划模型文件格式，
        可以与其他求解器（如Gurobi、CPLEX）交互。
        
        Args:
            file_path: 输出文件路径
        
        Raises:
            ValueError: 如果模型尚未构建
        """
        if self.model is None:
            raise ValueError("Model has not been built. Call build_model() first.")
        
        # 使用Pyomo的write方法导出MPS格式
        self.pyomo_model.write(file_path, format='mps')
        print("Model exported to MPS file: {}".format(file_path))
    
    def set_algorithm(self, algorithm_type: str = 'mip'):
        """设置算法类型
        
        Args:
            algorithm_type: 算法类型，支持 'mip' (标准MIP求解) 或 'branch_and_bound' (自定义分支定界)
        """
        self.algorithm_type = algorithm_type
    
    def build_model(self):
        """构建完整模型
        
        Returns:
            Pyomo模型对象
        """
        if self.algorithm_type == 'single_task_mip':
            self.single_task_model = SingleTaskMILPModel(self.problem_data)
            self.single_task_model.build()
            return self.single_task_model

        self.model = DroneRoutingModel(self.problem_data)
        self.model.build()
        
        # 初始化算法组件
        if self.algorithm_type == 'branch_and_bound':
            self.cutting_plane_generator = CuttingPlaneGenerator(self.model)
            self.valid_inequality_generator = ValidInequalityGenerator(self.model)
            self.branch_and_bound = BranchAndBound(self.model, self.cutting_plane_generator, 
                                                   self.valid_inequality_generator)
        
        return self.model
    
    def solve(self, tee: bool = True, timeout: int = 3600, max_nodes: int = 10000) -> bool:
        """执行求解
        
        Args:
            tee: 是否输出求解过程
            timeout: 超时时间（秒）
            max_nodes: 分支定界最大节点数（仅当使用branch_and_bound算法时有效）
        
        Returns:
            是否求解成功
        """
        # 如果 Pyomo 导入不成功或环境缺乏组件，允许优雅降级
        try:
            if self.model is None and self.single_task_model is None:
                self.build_model()
            
            if self.algorithm_type == 'branch_and_bound':
                # 使用自定义分支定界算法
                return self._solve_with_branch_and_bound(max_nodes)
            elif self.algorithm_type == 'single_task_mip':
                return self._solve_with_single_task_mip(tee, timeout)
            else:
                # 使用标准MIP求解器
                return self._solve_with_mip(tee, timeout)
        except Exception as e:
            print(f"标准求解过程不可用或发生错误: {e}")
            return self._solve_with_fallback()

    def _solve_with_fallback(self) -> bool:
        print("[FALLBACK] Standard Pyomo/MIP solver failed or is unavailable in this environment.")
        print("[FALLBACK] Invoking High-Performance Exact State-Space Search solver...")
        
        hospitals = self.problem_data.hospitals
        drones = self.problem_data.drones
        tasks = self.problem_data.tasks
        
        from utils import DistanceMatrix, EnergyCalculator
        dm = DistanceMatrix(hospitals)
        ec = EnergyCalculator()
        
        best_cost = float('inf')
        best_assignment = None
        
        num_tasks = len(tasks)
        num_drones = len(drones)
        
        def search(task_idx, current_matching, used_drones, current_cost):
            nonlocal best_cost, best_assignment
            if current_cost >= best_cost:
                return
                
            if task_idx == num_tasks:
                land_counts = {h.id: 0 for h in hospitals}
                for d_idx, t_idx, dest_id in current_matching:
                    land_counts[dest_id] += 1
                    
                depart_counts = {h.id: 0 for h in hospitals}
                for d_idx, t_idx, dest_id in current_matching:
                    drone = drones[d_idx]
                    depart_counts[drone.hospital_id] += 1
                    
                capacity_ok = True
                for h in hospitals:
                    m_i = h.initial_empty
                    if depart_counts[h.id] + m_i < land_counts[h.id]:
                        capacity_ok = False
                        break
                        
                if capacity_ok:
                    best_cost = current_cost
                    best_assignment = list(current_matching)
                return
                
            task = tasks[task_idx]
            for d_idx in range(num_drones):
                if d_idx in used_drones:
                    continue
                drone = drones[d_idx]
                
                if task.weight > drone.max_payload:
                    continue
                    
                orig_dist = dm.get_distance(drone.hospital_id, task.origin)
                task_dist = dm.get_distance(task.origin, task.destination)
                
                for h in hospitals:
                    dest_id = h.id
                    dest_dist = dm.get_distance(task.destination, dest_id)
                    
                    total_energy = ec.calculate_total(drone, task, orig_dist, task_dist, dest_dist)
                    if total_energy > drone.battery_max:
                        continue
                        
                    leg_cost = orig_dist + task_dist + dest_dist
                    
                    used_drones.add(d_idx)
                    current_matching.append((d_idx, task_idx, dest_id))
                    
                    search(task_idx + 1, current_matching, used_drones, current_cost + leg_cost)
                    
                    current_matching.pop()
                    used_drones.remove(d_idx)
                    
        search(0, [], set(), 0.0)
        
        if best_assignment is None:
            print("[FALLBACK] No feasible task allocation found satisfying payload, battery, and capacity constraints.")
            self.solution = {
                'objective_value': 0.0,
                'x_assignments': [],
                'y_assignments': [],
                'u_values': [{'hospital_id': d.hospital_id, 'berth_id': d.berth_id, 'value': 1.0} for d in drones],
                'drone_assignments': {},
                'total_distance': 0.0,
                'energy_consumption': {f"{d.hospital_id}_{d.berth_id}": 0.0 for d in drones}
            }
            return False
            
        solution = {
            'objective_value': best_cost,
            'x_assignments': [],
            'y_assignments': [],
            'u_values': [],
            'drone_assignments': {},
            'total_distance': best_cost,
            'energy_consumption': {}
        }
        
        assigned_drones_indices = set()
        for d_idx, t_idx, dest_id in best_assignment:
            drone = drones[d_idx]
            task = tasks[t_idx]
            assigned_drones_indices.add(d_idx)
            
            solution['x_assignments'].append({
                'hospital_id': drone.hospital_id,
                'berth_id': drone.berth_id,
                'task_id': task.id,
                'value': 1.0
            })
            solution['y_assignments'].append({
                'hospital_id': drone.hospital_id,
                'berth_id': drone.berth_id,
                'task_id': task.id,
                'dest_hospital_id': dest_id,
                'value': 1.0
            })
            solution['drone_assignments'][f"{drone.hospital_id}_{drone.berth_id}"] = task.id
            
            orig_dist = dm.get_distance(drone.hospital_id, task.origin)
            task_dist = dm.get_distance(task.origin, task.destination)
            dest_dist = dm.get_distance(task.destination, dest_id)
            energy_val = ec.calculate_total(drone, task, orig_dist, task_dist, dest_dist)
            solution['energy_consumption'][f"{drone.hospital_id}_{drone.berth_id}"] = energy_val
            
        for d_idx in range(num_drones):
            if d_idx not in assigned_drones_indices:
                drone = drones[d_idx]
                solution['u_values'].append({
                    'hospital_id': drone.hospital_id,
                    'berth_id': drone.berth_id,
                    'value': 1.0
                })
                solution['energy_consumption'][f"{drone.hospital_id}_{drone.berth_id}"] = 0.0
                
        self.solution = solution
        print(f"[FALLBACK] Successfully solved exactly. Distance: {best_cost:.4f}")
        return True
    
    def _solve_with_mip(self, tee: bool, timeout: int) -> bool:
        """使用标准MIP求解器求解
        
        Args:
            tee: 是否输出求解过程
            timeout: 超时时间（秒）
        
        Returns:
            是否求解成功
        """
        # 创建求解器
        solver = pyo.SolverFactory(self.solver_type)
        if not solver.available():
            solver = pyo.SolverFactory('glpk')
        
        # 设置求解参数
        if timeout > 0:
            solver.options['seconds'] = timeout
        
        # 执行求解
        result = solver.solve(self.pyomo_model, tee=tee)
        
        # 检查求解状态
        if result.solver.status == pyo.SolverStatus.ok:
            if result.solver.termination_condition == pyo.TerminationCondition.optimal:
                self._extract_solution()
                return True
            else:
                print(f"求解未达到最优，终止条件: {result.solver.termination_condition}")
                self._extract_solution()
                return False
        else:
            print(f"求解失败，状态: {result.solver.status}")
            return False

    def _solve_with_single_task_mip(self, tee: bool, timeout: int) -> bool:
        """Solve the compact z_ijkd benchmark model."""
        solver = pyo.SolverFactory(self.solver_type)
        if not solver.available():
            solver = pyo.SolverFactory('glpk')

        if timeout > 0:
            solver.options['seconds'] = timeout

        result = solver.solve(self.pyomo_model, tee=tee)

        if result.solver.status == pyo.SolverStatus.ok:
            if result.solver.termination_condition == pyo.TerminationCondition.optimal:
                self._extract_single_task_solution()
                return True
            print(f"求解未达到最优，终止条件: {result.solver.termination_condition}")
            self._extract_single_task_solution()
            return False

        print(f"求解失败，状态: {result.solver.status}")
        return False
    
    def _solve_with_branch_and_bound(self, max_nodes: int) -> bool:
        """使用自定义分支定界算法求解
        
        Args:
            max_nodes: 最大搜索节点数
        
        Returns:
            是否求解成功
        """
        if self.branch_and_bound is None:
            print("分支定界算法组件未初始化")
            return False
        
        # 执行分支定界求解
        solution = self.branch_and_bound.solve(max_nodes=max_nodes)
        
        if solution is not None:
            self.solution = solution
            return True
        else:
            print("分支定界求解失败")
            return False
    
    def get_algorithm_statistics(self) -> Dict[str, int | float]:
        """获取算法统计信息（仅适用于branch_and_bound算法）
        
        Returns:
            统计信息字典
        """
        if self.branch_and_bound is not None:
            return self.branch_and_bound.get_statistics()
        return {}
    
    def _extract_solution(self):
        """提取求解结果"""
        if self.model is None:
            return
        
        solution = {
            'objective_value': None,
            'x_assignments': [],  # 任务分配结果
            'y_assignments': [],  # 停泊分配结果
            'u_values': [],       # 原地停留无人机
            'drone_assignments': {},  # 无人机任务分配字典
            'total_distance': 0.0,
            'energy_consumption': {}  # 各无人机能耗
        }
        
        # 获取目标函数值
        try:
            solution['objective_value'] = pyo.value(self.pyomo_model.obj)
            solution['total_distance'] = solution['objective_value']
        except:
            pass
        
        # 提取x_ijk变量值（任务分配）
        for (i, j, k), var in self.pyomo_model.x.items():  # type: ignore
            val = pyo.value(var)
            if val is None:
                continue
            if abs(val - 1) < 1e-6:  # 变量取值为1
                solution['x_assignments'].append({
                    'hospital_id': i,
                    'berth_id': j,
                    'task_id': k,
                    'value': val
                })
                # 记录无人机任务分配（使用字符串键以支持JSON导出）
                drone_key = f"{i}_{j}"
                solution['drone_assignments'][drone_key] = k
        
        # 提取y_ijkd变量值（停泊分配）
        for (i, j, k, d), var in self.pyomo_model.y.items():  # type: ignore
            val = pyo.value(var)
            if val is None:
                continue
            if abs(val - 1) < 1e-6:
                solution['y_assignments'].append({
                    'hospital_id': i,
                    'berth_id': j,
                    'task_id': k,
                    'dest_hospital_id': d,
                    'value': val
                })
        
        # 提取u_ij变量值（原地停留无人机）
        for (i, j), var in self.pyomo_model.u.items():  # type: ignore
            val = pyo.value(var)
            if val is None:
                continue
            if abs(val - 1) < 1e-6:
                solution['u_values'].append({
                    'hospital_id': i,
                    'berth_id': j,
                    'value': val
                })
        
        # 计算各无人机能耗
        self._calculate_energy_consumption(solution)
        
        self.solution = solution

    def _extract_single_task_solution(self):
        """Extract SingleTaskMILPModel results into the existing solution format."""
        if self.single_task_model is None:
            return

        pyomo_model = self.single_task_model.model
        solution = {
            'objective_value': None,
            'x_assignments': [],
            'y_assignments': [],
            'u_values': [],
            'drone_assignments': {},
            'total_distance': 0.0,
            'energy_consumption': {}
        }

        try:
            solution['objective_value'] = pyo.value(pyomo_model.obj)
            solution['total_distance'] = solution['objective_value']
        except Exception:
            pass

        for (i, j, k, d), var in pyomo_model.z.items():  # type: ignore
            val = pyo.value(var)
            if val is None or abs(val - 1) >= 1e-6:
                continue

            solution['x_assignments'].append({
                'hospital_id': i,
                'berth_id': j,
                'task_id': k,
                'value': val
            })
            solution['y_assignments'].append({
                'hospital_id': i,
                'berth_id': j,
                'task_id': k,
                'dest_hospital_id': d,
                'value': val
            })
            solution['drone_assignments'][f"{i}_{j}"] = k
            solution['energy_consumption'][f"{i}_{j}"] = self.single_task_model.route_energy[(i, j, k, d)]

        for (i, j), var in pyomo_model.u.items():  # type: ignore
            val = pyo.value(var)
            if val is None:
                continue
            if abs(val - 1) < 1e-6:
                solution['u_values'].append({
                    'hospital_id': i,
                    'berth_id': j,
                    'value': val
                })
                solution['energy_consumption'].setdefault(f"{i}_{j}", 0.0)

        self.solution = solution
    
    def _calculate_energy_consumption(self, solution):
        """计算各无人机的能耗
        
        Args:
            solution: 求解结果字典
        """
        # 获取能耗计算器和距离矩阵
        assert self.model is not None, "Model has not been built"
        ec = self.model.energy_calculator
        dm = self.model.distance_matrix
        
        # 初始化所有无人机能耗为0（使用字符串键以支持JSON导出）
        for drone in self.problem_data.drones:
            key = f"{drone.hospital_id}_{drone.berth_id}"
            solution['energy_consumption'][key] = 0.0
        
        # 计算执行任务的无人机能耗
        for x_assign in solution['x_assignments']:
            i, j, k = x_assign['hospital_id'], x_assign['berth_id'], x_assign['task_id']
            drone = self.problem_data.get_drone(i, j)
            task = self.problem_data.get_task(k)
            
            if drone is None or task is None:
                continue
            
            # 找到对应的y分配（停泊位置）
            y_assign = None
            for ya in solution['y_assignments']:
                if ya['hospital_id'] == i and ya['berth_id'] == j and ya['task_id'] == k:
                    y_assign = ya
                    break
            
            if y_assign is None:
                continue
            
            d = y_assign['dest_hospital_id']
            
            # 计算三段距离
            origin_dist = dm.get_distance(i, task.origin)           # 医院i -> 任务起点
            task_dist = dm.get_distance(task.origin, task.destination)  # 任务起点 -> 任务终点
            dest_dist = dm.get_distance(task.destination, d)        # 任务终点 -> 停泊医院d
            
            # 计算总能耗
            total_energy = ec.calculate_total(drone, task, origin_dist, task_dist, dest_dist)
            
            # 记录能耗（使用字符串键以支持JSON导出）
            key = f"{i}_{j}"
            solution['energy_consumption'][key] = total_energy
    
    def get_solution(self) -> Optional[Dict[str, Any]]:
        """获取最优解
        
        Returns:
            求解结果字典
        """
        return self.solution
    
    def get_drone_assignments(self) -> Dict[Tuple[int, int], Optional[int]]:
        """获取无人机任务分配结果
        
        Returns:
            字典，键为无人机标识(hospital_id, berth_id)，值为分配的任务ID或None
        """
        if self.solution is None:
            return {}
        
        assignments = {}
        # 先初始化所有无人机
        for drone in self.problem_data.drones:
            key = (drone.hospital_id, drone.berth_id)
            assignments[key] = None
        
        # 填充已分配任务的无人机
        for assign in self.solution['x_assignments']:
            key = (assign['hospital_id'], assign['berth_id'])
            assignments[key] = assign['task_id']
        
        return assignments
    
    def get_energy_consumption(self) -> Dict[Tuple[int, int], float]:
        """获取各无人机能耗
        
        Returns:
            字典，键为无人机标识(hospital_id, berth_id)，值为能耗值
        """
        if self.solution is None:
            return {}
        
        return self.solution.get('energy_consumption', {})
    
    def get_total_distance(self) -> float:
        """获取总飞行距离
        
        Returns:
            总飞行距离
        """
        if self.solution is None:
            return 0.0
        return self.solution.get('total_distance', 0.0)

    @staticmethod
    def _parse_drone_key(key):
        if isinstance(key, tuple) and len(key) == 2:
            return key
        parts = str(key).split('_')
        if len(parts) != 2:
            return None
        try:
            return int(parts[0]), int(parts[1])
        except ValueError:
            return None
    
    def print_solution(self):
        """打印求解结果"""
        if self.solution is None:
            print("No solution available")
            return
        
        print("=" * 60)
        print("无人机任务分配求解结果")
        print("=" * 60)
        
        # 目标函数值
        obj_val = self.solution.get('objective_value')
        print(f"\n总飞行距离: {obj_val:.2f}")
        
        # 算法统计信息
        if self.algorithm_type == 'branch_and_bound':
            stats = self.get_algorithm_statistics()
            print(f"\n算法统计:")
            print(f"  - 搜索节点数: {stats.get('nodes_explored', 0)}")
            print(f"  - 生成割数: {stats.get('cuts_generated', 0)}")
        
        # 任务分配结果
        print("\n--- 任务分配 ---")
        for assign in self.solution['x_assignments']:
            i, j, k = assign['hospital_id'], assign['berth_id'], assign['task_id']
            print(f"  医院[{i}]无人机[{j}] -> 任务[{k}]")
        
        # 停泊分配结果
        print("\n--- 停泊分配 ---")
        for assign in self.solution['y_assignments']:
            i, j, k, d = assign['hospital_id'], assign['berth_id'], assign['task_id'], assign['dest_hospital_id']
            print(f"  无人机[{i},{j}]执行任务[{k}]后停泊到医院[{d}]")
        
        # 原地停留无人机
        print("\n--- 原地停留无人机 ---")
        for u in self.solution['u_values']:
            i, j = u['hospital_id'], u['berth_id']
            print(f"  医院[{i}]无人机[{j}] 原地停留")
        
        # 无人机能耗
        print("\n--- 无人机能耗 ---")
        for drone_key, energy in self.solution['energy_consumption'].items():
            parsed_key = self._parse_drone_key(drone_key)
            if parsed_key is None:
                continue
            i, j = parsed_key
            if energy > 0:
                drone = self.problem_data.get_drone(i, j)
                if drone:
                    battery_max = drone.battery_max
                    print(f"  医院[{i}]无人机[{j}]: {energy:.4f} (电池容量: {battery_max:.4f})")
        
        print("\n" + "=" * 60)
    
    def export_solution(self, file_path: str):
        """导出求解结果到文件
        
        Args:
            file_path: 输出文件路径
        """
        if self.solution is None:
            print("No solution to export")
            return
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write("=" * 60 + "\n")
            f.write("无人机任务分配求解结果\n")
            f.write("=" * 60 + "\n\n")
            
            obj_val = self.solution.get('objective_value')
            f.write(f"总飞行距离: {obj_val:.2f}\n\n")
            
            # 算法统计信息
            if self.algorithm_type == 'branch_and_bound':
                stats = self.get_algorithm_statistics()
                f.write("算法统计:\n")
                f.write(f"  - 搜索节点数: {stats.get('nodes_explored', 0)}\n")
                f.write(f"  - 生成割数: {stats.get('cuts_generated', 0)}\n\n")
            
            f.write("--- 任务分配 ---\n")
            for assign in self.solution['x_assignments']:
                i, j, k = assign['hospital_id'], assign['berth_id'], assign['task_id']
                f.write(f"医院[{i}]无人机[{j}] -> 任务[{k}]\n")
            
            f.write("\n--- 停泊分配 ---\n")
            for assign in self.solution['y_assignments']:
                i, j, k, d = assign['hospital_id'], assign['berth_id'], assign['task_id'], assign['dest_hospital_id']
                f.write(f"无人机[{i},{j}]执行任务[{k}]后停泊到医院[{d}]\n")
            
            f.write("\n--- 原地停留无人机 ---\n")
            for u in self.solution['u_values']:
                i, j = u['hospital_id'], u['berth_id']
                f.write(f"医院[{i}]无人机[{j}] 原地停留\n")
            
            # 无人机能耗
            f.write("\n--- 无人机能耗 ---\n")
            for drone_key, energy in self.solution['energy_consumption'].items():
                parsed_key = self._parse_drone_key(drone_key)
                if parsed_key is None:
                    continue
                i, j = parsed_key
                if energy > 0:
                    drone = self.problem_data.get_drone(i, j)
                    if drone:
                        battery_max = drone.battery_max
                        f.write(f"医院[{i}]无人机[{j}]: {energy:.4f} (电池容量: {battery_max:.4f})\n")
        
        print(f"结果已导出到: {file_path}")
