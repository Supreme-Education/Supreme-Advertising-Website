/**
 * Writes a deployable static site to dist/ (no node_modules or dev files).
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const dist = path.join(root, "dist");

function rimraf(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

rimraf(dist);
fs.mkdirSync(dist, { recursive: true });

fs.copyFileSync(path.join(root, "index.html"), path.join(dist, "index.html"));
copyDir(path.join(root, "css"), path.join(dist, "css"));
copyDir(path.join(root, "js"), path.join(dist, "js"));
copyDir(path.join(root, "assets"), path.join(dist, "assets"));
copyDir(path.join(root, "blog"), path.join(dist, "blog"));

const dataSrc = path.join(root, "data");
const dataDest = path.join(dist, "data");
fs.mkdirSync(dataDest, { recursive: true });
if (fs.existsSync(dataSrc)) {
  for (const name of fs.readdirSync(dataSrc)) {
    if (name.endsWith(".json")) {
      fs.copyFileSync(path.join(dataSrc, name), path.join(dataDest, name));
    }
  }
}

fs.writeFileSync(
  path.join(dist, "_redirects"),
  "/blog /blog/index.html 200\n",
  "utf8"
);

console.log("Static site written to dist/");
