// 部署脚本：启动 Express 服务 + 健康检查轮询，通过即视为部署成功
// 用法：npm run deploy
const { spawn } = require("child_process");
const http = require("http");
const path = require("path");

const PORT = process.env.PORT || 3000;
const HEALTH_URL = `http://localhost:${PORT}/api/health`;
const MAX_RETRIES = 30;
const RETRY_INTERVAL = 1000; // 1秒

function checkHealth() {
  return new Promise((resolve) => {
    const req = http.get(HEALTH_URL, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        if (res.statusCode === 200) {
          resolve({ ok: true, body });
        } else {
          resolve({ ok: false, status: res.statusCode });
        }
      });
    });
    req.on("error", (err) => resolve({ ok: false, error: err.message }));
    req.setTimeout(3000, () => {
      req.destroy();
      resolve({ ok: false, error: "timeout" });
    });
  });
}

async function waitForHealth() {
  for (let i = 1; i <= MAX_RETRIES; i++) {
    const result = await checkHealth();
    if (result.ok) {
      console.log(`[deploy] 健康检查通过 (第 ${i} 次尝试) ✓`);
      console.log(`[deploy] 响应: ${result.body}`);
      return true;
    }
    console.log(`[deploy] 等待服务就绪... (${i}/${MAX_RETRIES})`);
    await new Promise((r) => setTimeout(r, RETRY_INTERVAL));
  }
  return false;
}

async function main() {
  console.log("========================================");
  console.log("  商机管理模块 - 部署上线");
  console.log("========================================");
  console.log(`[deploy] 启动 Express 服务 (端口 ${PORT})...`);

  // 以子进程启动服务（继承 stdio，日志直接输出）
  const server = spawn(process.execPath, [path.join(__dirname, "index.js")], {
    stdio: "inherit",
    env: { ...process.env, PORT: String(PORT) },
  });

  server.on("error", (err) => {
    console.error("[deploy] 服务启动失败:", err.message);
    process.exit(1);
  });

  // 等待健康检查通过
  const healthy = await waitForHealth();
  if (!healthy) {
    console.error("[deploy] ✗ 健康检查未通过，部署失败");
    server.kill("SIGTERM");
    process.exit(1);
  }

  console.log("");
  console.log("[deploy] ========================================");
  console.log("[deploy]  ✓ 部署成功！");
  console.log(`[deploy]  服务地址: http://localhost:${PORT}`);
  console.log(`[deploy]  商机管理: http://localhost:${PORT}/opportunities.html`);
  console.log("[deploy]  服务持续运行中，按 Ctrl+C 停止");
  console.log("[deploy] ========================================");

  // 保持进程运行，转发退出信号给子进程
  process.on("SIGINT", () => {
    console.log("\n[deploy] 收到中断信号，停止服务...");
    server.kill("SIGTERM");
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    server.kill("SIGTERM");
    process.exit(0);
  });
}

main();
