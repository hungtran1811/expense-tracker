const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const TARGET_DIRS = ["src", "netlify/functions", "netlify/utils", "docs/qa", "docs/releases"];
const TARGET_FILES = ["index.html", "README.md", ".env.example"];
const TARGET_EXT = new Set([".js", ".css", ".html", ".md"]);

const BAD_PATTERNS = [
  { label: "replacement-char", regex: /\uFFFD/g },
  { label: "mojibake-c3", regex: /Ãƒ/g },
  { label: "mojibake-c2", regex: /Ã‚/g },
  { label: "mojibake-c4", regex: /Ã„/g },
  { label: "mojibake-c6", regex: /Ã†/g },
  { label: "mojibake-generic", regex: /[ÃÂâ][\u0080-\u00BF]/g },
  { label: "mojibake-latin", regex: /Ã¡Âº|Ã¡Â»|Ã¢â‚¬/g },
  { label: "broken-word", regex: /Tï¿½m|thï¿½ng|cÃƒÂ¡|mc tiu|ng lc|cha c d liu/gi },
  { label: "mojibake-html", regex: /Ã¯Â¿Â½/g },
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
const files = [...new Set([...filesFromDirs, ...filesFromRoot])];
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
  console.log("i18n check passed: no mojibake markers found in target files.");
  process.exit(0);
}

console.error("i18n check failed. Found suspicious encoding markers:");
for (const item of failures) {
  const detail = item.findings.map((x) => `${x.label}=${x.count}`).join(", ");
  console.error(`- ${item.file}: ${detail}`);
}
process.exit(1);
