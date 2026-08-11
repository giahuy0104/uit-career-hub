import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const assetsDirectory = resolve("dist/client/assets");
const forbiddenValues = [
  "Student@12345",
  "Admin@12345",
  "Company@12345",
  "admin.career@uit.edu.vn",
  "recruiter@vng.example",
];

const files = await readdir(assetsDirectory, { withFileTypes: true });
const javascriptFiles = files
  .filter((entry) => entry.isFile() && entry.name.endsWith(".js"))
  .map((entry) => resolve(assetsDirectory, entry.name));

for (const file of javascriptFiles) {
  const source = await readFile(file, "utf8");
  const exposed = forbiddenValues.find((value) => source.includes(value));
  if (exposed) {
    throw new Error(`Production bundle còn chứa demo credential/identity trong ${file}.`);
  }
}

console.log(`Production bundle gate passed: ${javascriptFiles.length} JavaScript assets không chứa demo credentials.`);
