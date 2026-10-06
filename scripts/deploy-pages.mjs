import { spawnSync } from "node:child_process";
import { mkdtempSync, cpSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const project = resolve(fileURLToPath(new URL("..", import.meta.url)));
const run = (binary, args, cwd = project) => {
  const result = spawnSync(binary, args, { cwd, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`Command failed: ${binary} ${args.join(" ")}`);
};
if (!process.env.npm_execpath)
  throw new Error("Run this script with pnpm deploy:pages.");
run(process.execPath, [process.env.npm_execpath, "run", "build:pages"]);
const staging = mkdtempSync(join(tmpdir(), "latam-pages-"));
run("git", [
  "clone",
  "--depth",
  "1",
  "https://github.com/gerdax/latam-play.git",
  staging,
]);
// Only generated site assets are replaced. Other repository files are preserved.
rmSync(join(staging, "assets"), { recursive: true, force: true });
cpSync(join(project, "dist"), staging, { recursive: true });
writeFileSync(join(staging, ".nojekyll"), "");
run("git", ["add", "assets", "index.html", ".nojekyll"], staging);
const diff = spawnSync("git", ["diff", "--cached", "--quiet"], {
  cwd: staging,
});
if (diff.status === 1) {
  run(
    "git",
    [
      "-c",
      "user.name=Codex",
      "-c",
      "user.email=codex@local",
      "commit",
      "-m",
      "Deploy latest Latam game",
    ],
    staging,
  );
  run("git", ["push", "origin", "HEAD:main"], staging);
} else if (diff.status !== 0)
  throw new Error("Unable to inspect deployment changes.");
console.log("Deployment pushed: https://gerdax.github.io/latam-play/");
