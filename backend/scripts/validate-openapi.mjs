import SwaggerParser from "@apidevtools/swagger-parser";
import { resolve } from "node:path";

const specificationPath = resolve(process.cwd(), "../docs/api/openapi.yaml");

try {
  const api = await SwaggerParser.validate(specificationPath);
  console.log(`OpenAPI ${api.openapi} hợp lệ: ${Object.keys(api.paths ?? {}).length} paths.`);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
