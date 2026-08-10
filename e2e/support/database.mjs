import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const pnpmExecutable = process.platform === "win32" ? process.env.ComSpec : "pnpm";

function runDatabaseScript(script) {
  try {
    const argumentsList = process.platform === "win32"
      ? ["/d", "/s", "/c", `pnpm ${script}`]
      : [script];
    execFileSync(pnpmExecutable, argumentsList, {
      cwd: repositoryRoot,
      env: { ...process.env, NODE_ENV: "test" },
      encoding: "utf8",
      stdio: "pipe",
    });
  } catch (error) {
    const stdout = error?.stdout?.toString?.() ?? "";
    const stderr = error?.stderr?.toString?.() ?? "";
    throw new Error(`Không thể chạy ${script}: ${error?.message ?? "lỗi không xác định"}.\n${stdout}\n${stderr}`.trim());
  }
}

export function provisionE2eDatabase() {
  runDatabaseScript("db:e2e:provision");
}

export function resetE2eDatabase() {
  runDatabaseScript("db:e2e:reset");
}
