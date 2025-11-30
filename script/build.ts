import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile } from "fs/promises";

// Mark all dependencies as external to prevent bundling issues with dynamic requires in ESM
// Node.js will load everything from node_modules at runtime
const nodeBuiltins = [
  "path", "fs", "http", "https", "url", "util", "stream", "events",
  "crypto", "os", "buffer", "querystring", "zlib", "assert", "cluster",
  "child_process", "process", "net", "tls", "dgram", "dns", "domain"
];

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();

  console.log("building server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  
  // Mark all packages + Node.js builtins as external to avoid dynamic require issues
  const allExternals = [...new Set([...allDeps, ...nodeBuiltins])];

  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "esm",
    outfile: "dist/index.js",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: allExternals,
    logLevel: "info",
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
