"""无人机任务分配问题求解器主程序

对应设计框架5.2.10节 - 主程序模块

功能：
1. 解析命令行参数
2. 加载问题数据
3. 构建并求解模型
4. 输出结果报告
"""

import argparse
import json
import os
import sys
from datetime import datetime

# 添加当前目录到路径
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from data_structures import ProblemData, Hospital, Drone, Task
from solver import DroneRoutingSolver


def load_instance_data(file_path: str) -> ProblemData:
    """加载实例数据文件
    
    Args:
        file_path: 实例数据文件路径（JSON格式）
        
    Returns:
        ProblemData 对象
    """
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # 解析医院数据
    hospitals = []
    for h_data in data['hospitals']:
        hospital = Hospital(
            id=h_data['id'],
            name=h_data['name'],
            capacity=h_data['capacity'],
            initial_empty=h_data['initial_empty'],
            location=(h_data['longitude'], h_data['latitude']),
            berths=h_data.get('berths', list(range(1, h_data['capacity'] + 1)))
        )
        hospitals.append(hospital)
    
    # 解析无人机数据
    drones = []
    for d_data in data['drones']:
        drone = Drone(
            hospital_id=d_data['hospital_id'],
            berth_id=d_data['berth_id'],
            weight=d_data['weight'],
            max_payload=d_data['max_payload'],
            battery_max=d_data['battery_max'],
            speed=d_data['speed']
        )
        drones.append(drone)
    
    # 解析任务数据
    tasks = []
    for t_data in data['tasks']:
        task = Task(
            id=t_data['id'],
            origin=t_data['origin'],
            destination=t_data['destination'],
            weight=t_data['weight']
        )
        tasks.append(task)
    
    # 创建问题数据对象
    problem_data = ProblemData(hospitals, drones, tasks)
    return problem_data


def parse_args():
    """解析命令行参数"""
    parser = argparse.ArgumentParser(
        description='无人机医用物资运输任务分配问题求解器',
        formatter_class=argparse.ArgumentDefaultsHelpFormatter
    )
    
    # 必需参数
    parser.add_argument(
        '--input', '-i',
        required=True,
        help='输入实例数据文件路径（JSON格式）'
    )
    
    # 可选参数
    parser.add_argument(
        '--output', '-o',
        default=None,
        help='输出结果文件路径（JSON格式），默认在输入文件同目录'
    )
    
    parser.add_argument(
        '--solver', '-s',
        default='cbc',
        choices=['cbc', 'glpk', 'gurobi'],
        help='求解器类型'
    )
    
    parser.add_argument(
        '--timeout', '-t',
        type=int,
        default=3600,
        help='求解超时时间（秒），默认3600秒'
    )
    
    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='启用详细输出模式'
    )
    
    parser.add_argument(
        '--tee',
        action='store_true',
        help='显示求解器输出'
    )
    
    parser.add_argument(
        '--algorithm', '-a',
        default='mip',
        choices=['mip', 'single_task_mip', 'branch_and_bound'],
        help='算法类型：mip（原始模型）、single_task_mip（单任务简化MILP）或 branch_and_bound（自定义分支定界）'
    )
    
    return parser.parse_args()


def print_summary(problem_data: ProblemData, solver: DroneRoutingSolver):
    """打印求解结果摘要"""
    print("\n" + "="*60)
    print("无人机任务分配求解结果摘要")
    print("="*60)
    
    # 问题规模
    print("\n问题规模:")
    print("   - 医院数量: {}".format(len(problem_data.hospitals)))
    print("   - 无人机数量: {}".format(len(problem_data.drones)))
    print("   - 任务数量: {}".format(len(problem_data.tasks)))
    
    # 求解状态
    solution = solver.get_solution()
    if solution is None:
        print("\n求解失败")
        return
    
    print("\n求解成功")
    
    # 目标函数值
    obj_val = solution.get('objective_value')
    if obj_val is not None:
        print("目标函数值（总飞行距离）: {:.2f}".format(obj_val))
    
    # 任务分配情况
    x_assignments = solution.get('x_assignments', [])
    print("\n任务分配:")
    print("   - 已分配任务数: {}".format(len(x_assignments)))
    
    # 无人机分配情况
    drone_assignments = solution.get('drone_assignments', {})
    active_drones = sum(1 for v in drone_assignments.values() if v is not None)
    print("   - 执行任务的无人机数: {}".format(active_drones))
    print("   - 原地停留的无人机数: {}".format(len(problem_data.drones) - active_drones))
    
    # 能耗信息
    energy_consumption = solution.get('energy_consumption', {})
    if energy_consumption:
        total_energy = sum(energy_consumption.values())
        avg_energy = total_energy / len(energy_consumption) if energy_consumption else 0
        print("\n能耗统计:")
        print("   - 总能耗: {:.2f}".format(total_energy))
        print("   - 平均能耗: {:.2f}".format(avg_energy))
    
    print("\n" + "="*60)


def export_solution(solution: dict, output_path: str):
    """导出求解结果到文件"""
    result = {
        'timestamp': datetime.now().isoformat(),
        'solution': solution
    }
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    print("\n结果已保存到: {}".format(output_path))


def main():
    """主函数"""
    # 解析命令行参数
    args = parse_args()
    
    # 检查输入文件是否存在
    if not os.path.exists(args.input):
        print("错误：输入文件不存在: {}".format(args.input))
        sys.exit(1)
    
    # 确定输出路径
    if args.output is None:
        input_dir = os.path.dirname(args.input)
        input_name = os.path.basename(args.input).replace('.json', '_result.json')
        output_path = os.path.join(input_dir, input_name)
    else:
        output_path = args.output
    
    try:
        # 加载数据
        print("正在加载实例数据: {}".format(args.input))
        problem_data = load_instance_data(args.input)
        
        # 创建求解器
        print("创建求解器 (类型: {}, 算法: {})".format(args.solver, args.algorithm))
        solver = DroneRoutingSolver(problem_data)
        solver.set_solver(args.solver)
        solver.set_algorithm(args.algorithm)
        
        # 求解
        print("开始求解 (超时: {}秒)...".format(args.timeout))
        start_time = datetime.now()
        success = solver.solve(tee=args.tee, timeout=args.timeout)
        elapsed_time = datetime.now() - start_time
        
        print("求解耗时: {:.2f}秒".format(elapsed_time.total_seconds()))
        
        if success:
            # 打印摘要
            if args.verbose:
                solver.print_solution()
            else:
                print_summary(problem_data, solver)
            
            # 导出结果
            solution = solver.get_solution()
            if solution is not None:
                export_solution(solution, output_path)
            else:
                print("警告：求解结果为空，跳过导出")
            
            print("\n求解完成！")
        else:
            print("\n求解失败或未达到最优解")
            sys.exit(1)
            
    except Exception as e:
        print("\n运行错误: {}".format(str(e)))
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
