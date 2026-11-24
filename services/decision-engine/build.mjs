import { build } from "esbuild";

await build({
  entryPoints: ["src/index.ts"],
  bundle:      true,
  platform:    "node",
  target:      "node22",
  format:      "esm",
  outfile:     "dist/index.mjs",
  external:    ["prom-client", "pino"],
  sourcemap:   true,
  minify:      false,
});

console.log("✅ decision-engine built");
