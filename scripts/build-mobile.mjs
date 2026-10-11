import { cp, mkdir, readFile, writeFile, rm, symlink, lstat } from "node:fs/promises";
import { resolve, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const staging = resolve(root, ".mobile-build");
// All deletions are constrained to this generated staging directory.
if (relative(root, staging) !== ".mobile-build") throw new Error("Unsafe staging path");
const demo = process.argv.includes("--demo");
const backend = process.env.NEXT_PUBLIC_API_BASE_URL || "";
if (!demo) {
  if (!backend) throw new Error("Set NEXT_PUBLIC_API_BASE_URL to your deployed HTTPS website, or use --demo for an offline preview build.");
  const url = new URL(backend);
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error("API base must be a plain HTTPS origin without credentials, query or path.");
}
await mkdir(staging, { recursive: true });
for (const name of ["app", "components", "lib", "public"]) {
  const target = resolve(staging, name);
  if (!target.startsWith(staging + sep)) throw new Error("Unsafe copy path");
  await rm(target, { recursive: true, force: true });
  await cp(join(root, name), target, { recursive: true, filter: (source) => relative(root, source).split(sep).slice(0, 2).join("/") !== "app/api" });
}
for (const name of ["package.json", "package-lock.json", "tsconfig.json", "postcss.config.mjs"]) await cp(join(root, name), join(staging, name));
const tsconfig = JSON.parse(await readFile(join(staging, "tsconfig.json"), "utf8"));
tsconfig.exclude = ["node_modules"];
await writeFile(join(staging, "tsconfig.json"), JSON.stringify(tsconfig, null, 2));
const modules = join(staging, "node_modules");
if (!(await lstat(modules).catch(() => null))) await symlink(join(root, "node_modules"), modules, process.platform === "win32" ? "junction" : "dir");
await writeFile(join(staging, "next.config.mjs"), `export default { output: "export", trailingSlash: true, images: { unoptimized: true }, turbopack: { root: ${JSON.stringify(root)} } };\n`);
const result = spawnSync(process.execPath, [join(root, "node_modules/next/dist/bin/next"), "build"], {
  cwd: staging, stdio: "inherit", env: { ...process.env, NEXT_PUBLIC_API_BASE_URL: demo ? "" : backend, NEXT_PUBLIC_MOBILE_BUILD: "true" },
});
if (result.status !== 0) process.exit(result.status ?? 1);
console.log(demo ? "Offline mobile preview built. AI generation needs a deployed backend." : "Mobile frontend built with deployed API origin.");
