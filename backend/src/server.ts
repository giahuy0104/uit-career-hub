import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { databasePool } from "./db/pool.js";
import { appLogger } from "./observability/structured-logger.js";

const app = createApp();

const server = app.listen(env.backendPort, () => {
  appLogger.info("api_started", { port: env.backendPort, environment: env.nodeEnv });
});

async function shutdown(signal: string) {
  appLogger.info("api_shutdown_started", { signal });
  server.close(async () => {
    await databasePool.end();
    process.exit(0);
  });
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
