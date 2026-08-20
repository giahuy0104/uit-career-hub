import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const backendRoot = resolve(repositoryRoot, "backend");
const javaExecutable = "java";

function runDatabaseReset() {
  try {
    execFileSync(javaExecutable, ["-Dstdout.encoding=UTF-8", "-Dstderr.encoding=UTF-8", "-jar", "target/career-hub-api-0.0.1-SNAPSHOT.jar", "db:e2e:reset"], {
      cwd: backendRoot,
      env: { ...process.env, NODE_ENV: "test", DATABASE_URL: process.env.DATABASE_URL, DATABASE_URL_DIRECT: process.env.DATABASE_URL_DIRECT },
      encoding: "utf8",
      stdio: "pipe",
    });
  } catch (error) {
    const stdout = error?.stdout?.toString?.() ?? "";
    const stderr = error?.stderr?.toString?.() ?? "";
    throw new Error(`Không thể reset database E2E bằng Java: ${error?.message ?? "lỗi không xác định"}.\n${stdout}\n${stderr}`.trim());
  }
}

export function provisionE2eDatabase() {
  runDatabaseReset();
}

export function resetE2eDatabase() {
  runDatabaseReset();
}
