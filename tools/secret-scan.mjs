import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const ignoredDirectories = new Set([".git", ".runtime", ".vinext", ".wrangler", "artifacts", "dist", "node_modules", "output", "release"]);
const textExtensions = new Set([".cjs", ".css", ".env", ".example", ".html", ".js", ".json", ".md", ".mjs", ".prisma", ".ps1", ".sh", ".sql", ".ts", ".tsx", ".yaml", ".yml"]);
const rules = [
  ["private-key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["aws-access-key", /\bAKIA[0-9A-Z]{16}\b/],
  ["github-token", /\bgh[pousr]_[A-Za-z0-9]{30,}\b/],
  ["stripe-live-key", /\b(?:sk|rk)_live_[A-Za-z0-9]{16,}\b/],
  ["openai-key", /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}\b/],
  ["database-password", /postgres(?:ql)?:\/\/[^:\s/]+:(?!change-me|generated-on-server)[^@\s]{12,}@/i],
];

async function* files(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) yield* files(path.join(directory, entry.name));
      continue;
    }
    const fullPath = path.join(directory, entry.name);
    if (textExtensions.has(path.extname(entry.name).toLowerCase()) || entry.name === ".env.example") yield fullPath;
  }
}

const findings = [];
for await (const file of files(root)) {
  const lines = (await readFile(file, "utf8")).split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    for (const [rule, pattern] of rules) {
      if (pattern.test(lines[index])) findings.push(`${path.relative(root, file)}:${index + 1} ${rule}`);
    }
  }
}

if (findings.length) {
  console.error("Potential secrets detected:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log("Secret scan passed.");
