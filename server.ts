import express from "express";
import path from "path";
import fs from "fs";
import { exec, spawn } from "child_process";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;

app.use(express.json());

// 默认路径设置
const INSTANCE_PATH = path.join(process.cwd(), "experiment_instance_small.json");
const RESULT_PATH = path.join(process.cwd(), "experiment_instance_small_result.json");
const COMPARISON_PATH = path.join(process.cwd(), "experiment_instance_small_comparison.json");

// API 1: 获取当前实例配置
app.get("/api/config", (req, res) => {
  try {
    if (fs.existsSync(INSTANCE_PATH)) {
      const data = fs.readFileSync(INSTANCE_PATH, "utf-8");
      res.json(JSON.parse(data));
    } else {
      res.status(404).json({ error: "Instance file not found." });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// API 2: 保存实例配置
app.post("/api/config", (req, res) => {
  try {
    const config = req.body;
    fs.writeFileSync(INSTANCE_PATH, JSON.stringify(config, null, 2), "utf-8");
    res.json({ status: "success", message: "Successfully updated instance." });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// API 3: 随机生成器端点
app.post("/api/generate", (req, res) => {
  try {
    const { hospitalCount = 4, droneCount = 3, taskCount = 4 } = req.body;

    const names = ["Center Hospital A", "Medical Hub B", "Clinic C", "Emergency D", "Pharmacy E", "Substation F"];
    const hospitals: any[] = [];
    for (let i = 1; i <= hospitalCount; i++) {
      hospitals.push({
        id: i,
        name: names[(i - 1) % names.length] + ` (H${i})`,
        longitude: Math.round((Math.random() * 40 - 20) * 10) / 10,
        latitude: Math.round((Math.random() * 40 - 20) * 10) / 10,
        type: i === 1 ? "central" : "substation",
        capacity: Math.floor(Math.random() * 3) + 2,
        berths: Array.from({ length: 3 }, (_, k) => k + 1),
        initial_empty: Math.floor(Math.random() * 2) + 1,
      });
    }

    const drones: any[] = [];
    for (let i = 0; i < droneCount; i++) {
      const hospital_id = hospitals[i % hospitals.length].id;
      drones.push({
        hospital_id,
        berth_id: Math.floor(i / hospitals.length) + 1,
        weight: Math.round((Math.random() * 1.5 + 1.5) * 10) / 10, // 1.5 - 3.0 kg
        max_payload: Math.round((Math.random() * 2.0 + 2.0) * 10) / 10, // 2.0 - 4.0 kg
        battery_max: Math.round(Math.random() * 150 + 150), // 150 - 300 J
        speed: Math.round(Math.random() * 6 + 10), // 10 - 16 m/s
      });
    }

    const tasks: any[] = [];
    for (let i = 1; i <= taskCount; i++) {
      // Pick random origins and destinations
      const origin_idx = Math.floor(Math.random() * hospitals.length);
      let dest_idx = Math.floor(Math.random() * hospitals.length);
      if (dest_idx === origin_idx) {
        dest_idx = (origin_idx + 1) % hospitals.length;
      }
      tasks.push({
        id: i,
        origin: hospitals[origin_idx].id,
        destination: hospitals[dest_idx].id,
        weight: Math.round((Math.random() * 1.8 + 0.5) * 10) / 10, // 0.5 - 2.3 kg
      });
    }

    const newConfig = { hospitals, drones, tasks };
    fs.writeFileSync(INSTANCE_PATH, JSON.stringify(newConfig, null, 2), "utf-8");
    res.json(newConfig);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Helper function to execute python with python3/python fallback
function execPython(cmd: string, callback: (error: any, stdout: string, stderr: string) => void) {
  console.log(`Executing target Python command: ${cmd}`);
  exec(cmd, (error, stdout, stderr) => {
    // If there is an error, check if python3 command failed with not found or not recognized
    if (error && cmd.startsWith("python3")) {
      const errorMsg = (error.message || "").toLowerCase();
      const stderrMsg = (stderr || "").toLowerCase();
      const isCmdNotFound = 
        error.code === 127 || 
        String(error.code) === "ENOENT" || 
        errorMsg.includes("not found") || 
        errorMsg.includes("not recognized") || 
        stderrMsg.includes("not found") || 
        stderrMsg.includes("not recognized") ||
        stderrMsg.includes("is not recognized");
      
      if (isCmdNotFound) {
        const fallbackCmd = cmd.replace(/^python3/, "python");
        console.log(`[Compatibility Fallback] 'python3' was not found/recognized. Retrying with 'python': ${fallbackCmd}`);
        exec(fallbackCmd, callback);
        return;
      }
    }
    callback(error, stdout, stderr);
  });
}

// API 4: 模型异步求解调用
app.post("/api/solve", (req, res) => {
  const { algorithm = "single_task_mip", solver = "cbc", timeout = 60 } = req.body;

  let cmd = `python3 main.py --input "${INSTANCE_PATH}" --algorithm ${algorithm} --solver ${solver} --timeout ${timeout}`;

  execPython(cmd, (error, stdout, stderr) => {
    const logOutput = `[Execution stdout]\n${stdout}\n[Execution stderr]\n${stderr}`;
    
    // Attempt to load output result
    const resultFile = INSTANCE_PATH.replace(".json", "_result.json");
    try {
      if (fs.existsSync(resultFile)) {
        const fileContent = fs.readFileSync(resultFile, "utf-8");
        const parsed = JSON.parse(fileContent);
        res.json({
          status: "success",
          logs: logOutput,
          solution: parsed.solution,
        });
      } else {
        // Fallback or read logs if file not created
        res.json({
          status: "error",
          logs: logOutput,
          error: "Result file was not generated.",
        });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message, logs: logOutput });
    }
  });
});

// API 5: 双算法对比实验运行
app.post("/api/compare", (req, res) => {
  const { solver = "cbc", timeout = 60, maxNodes = 100 } = req.body;

  let cmd = `python3 compare_methods.py --input "${INSTANCE_PATH}" --solver ${solver} --timeout ${timeout} --max-nodes ${maxNodes}`;

  execPython(cmd, (error, stdout, stderr) => {
    const logOutput = `[Execution stdout]\n${stdout}\n[Execution stderr]\n${stderr}`;
    
    const comparisonFile = INSTANCE_PATH.replace(".json", "_comparison.json");
    try {
      if (fs.existsSync(comparisonFile)) {
        const fileContent = fs.readFileSync(comparisonFile, "utf-8");
        const parsed = JSON.parse(fileContent);
        res.json({
          status: "success",
          logs: logOutput,
          report: parsed,
        });
      } else {
        res.json({
          status: "error",
          logs: logOutput,
          error: "Comparison report file was not generated.",
        });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message, logs: logOutput });
    }
  });
});

// Serve user attached images dynamically from multiple potential locations
app.get("/input_file_:id.:ext", (req, res) => {
  const { id, ext } = req.params;
  const fileName = `input_file_${id}.${ext}`;
  const possiblePaths = [
    path.join(process.cwd(), fileName),
    path.join(process.cwd(), "public", fileName),
    path.join(process.cwd(), "assets", fileName),
    `/${fileName}`,
    `/app/${fileName}`
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      console.log(`[Static Asset Proxy] Serving matching asset: ${p}`);
      return res.sendFile(p);
    }
  }

  // Debugging info if file not found
  console.warn(`[Static Asset Proxy] Requested asset not found: ${fileName}. Checked: ${JSON.stringify(possiblePaths)}`);
  try {
    const rootFiles = fs.readdirSync(process.cwd());
    const matchedFiles = rootFiles.filter(f => f.includes("input_file"));
    console.log(`[Static Asset Proxy] Current CWD has files containing 'input_file': ${JSON.stringify(matchedFiles)}`);
  } catch (err) {}

  res.status(404).send("File not found");
});

async function startServer() {
  // Vite integration middleware as requested
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
