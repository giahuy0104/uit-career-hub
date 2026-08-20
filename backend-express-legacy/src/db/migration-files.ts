import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type MigrationFile = {
  version: string;
  name: string;
  fileName: string;
  checksum: string;
  sql: string;
};

const migrationFilePattern = /^(\d{4})_([a-z0-9_]+)\.sql$/;

export function getDatabaseDirectory(child: "migrations" | "seeds") {
  const currentDirectory = dirname(fileURLToPath(import.meta.url));
  return resolve(currentDirectory, `../../../database/${child}`);
}

export async function loadMigrationFiles(directory = getDatabaseDirectory("migrations")) {
  const entries = await readdir(directory, { withFileTypes: true });
  const migrationEntries = entries
    .filter((entry) => entry.isFile() && migrationFilePattern.test(entry.name))
    .sort((left, right) => left.name.localeCompare(right.name));

  const seenVersions = new Set<string>();
  const migrations: MigrationFile[] = [];

  for (const entry of migrationEntries) {
    const match = migrationFilePattern.exec(entry.name);
    if (!match) {
      continue;
    }

    const [, version, name] = match;
    if (seenVersions.has(version)) {
      throw new Error(`Trùng version migration ${version}.`);
    }
    seenVersions.add(version);

    const sql = await readFile(resolve(directory, entry.name), "utf8");
    migrations.push({
      version,
      name,
      fileName: entry.name,
      checksum: createHash("sha256").update(sql).digest("hex"),
      sql,
    });
  }

  if (migrations.length === 0) {
    throw new Error(`Không tìm thấy migration SQL trong ${directory}.`);
  }

  return migrations;
}
