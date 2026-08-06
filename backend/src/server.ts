import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { databasePool } from "./db/pool.js";

const app = createApp();

const server = app.listen(env.backendPort, () => {
  console.log(`UIT Career Hub API đang chạy tại http://localhost:${env.backendPort}/api`);
});

async function shutdown(signal: string) {
  console.log(`Nhận ${signal}, đang dừng ứng dụng...`);
  server.close(async () => {
    await databasePool.end();
    process.exit(0);
  });
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

