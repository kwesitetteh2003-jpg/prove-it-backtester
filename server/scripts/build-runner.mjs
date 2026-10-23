import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
await build({
  entryPoints: [join(root, "src/sandbox/runner.ts")],
  outfile: join(root, "dist/runner.cjs"),
  bundle: true, platform: "node", format: "cjs", target: "node20", minify: false, logLevel: "warning",
});
console.log("sandbox runner built -> dist/runner.cjs");
