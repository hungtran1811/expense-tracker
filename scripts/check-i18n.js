const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const TARGET_DIRS = ["src"];
const TARGET_FILES = ["index.html"];
const TARGET_EXT = new Set([".js", ".css", ".html"]);

const BAD_PATTERNS = [
  { label: "replacement-char", regex: /\uFFFD/g },
  { label: "mojibake-c3", regex: /Ã/g },
  { label: "mojibake-c2", regex: /Â/g },
  { label: "mojibake-c4", regex: /Ä/g },
  { label: "mojibake-c6", regex: /Æ/g },
  { label: "mojibake-latin", regex: /áº|á»|â€/g },
  { label: "broken-word", regex: /T�m|th�ng|cÃ¡|mc tiu|ng lc|cha c d liu/gi },
  { label: "mojibake-html", regex: /ï¿½/g },
];

function walk(dir, output = []) {
  if (!fs.existsSync(dir)) return output;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, output);
      continue;
    }
    if (TARGET_EXT.has(path.extname(entry.name))) {
      output.push(full);
    }
  }
  return output;
}

function checkFile(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const findings = [];
  for (const pattern of BAD_PATTERNS) {
    const matches = text.match(pattern.regex);
    if (matches?.length) {
      findings.push({ label: pattern.label, count: matches.length });
    }
  }
  return findings;
}

const filesFromDirs = TARGET_DIRS.flatMap((dir) => walk(path.join(ROOT, dir)));
const filesFromRoot = TARGET_FILES.map((file) => path.join(ROOT, file)).filter((file) =>
  fs.existsSync(file)
);
const files = [...filesFromDirs, ...filesFromRoot];
const failures = [];

for (const file of files) {
  const findings = checkFile(file);
  if (findings.length) {
    failures.push({
      file: path.relative(ROOT, file),
      findings,
    });
  }
}

if (!failures.length) {
  console.log("i18n check passed: no mojibake markers found in src/ and index.html.");
  process.exit(0);
}

console.error("i18n check failed. Found suspicious encoding markers:");
for (const item of failures) {
  const detail = item.findings.map((x) => `${x.label}=${x.count}`).join(", ");
  console.error(`- ${item.file}: ${detail}`);
}
process.exit(1);
