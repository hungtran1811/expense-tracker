import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";

const root = resolve(process.cwd());
const required = [
  "src/main.tsx",
  "src/app/App.tsx",
  "src/features/reports/ReportsPage.tsx",
  "src/features/expenses/TransactionForm.tsx",
  "src/features/expenses/ExpensesPage.tsx",
  "src/shared/lib/moneyOwner.ts",
  "src/features/loans/loanCalculations.ts",
  "src/services/firebase/firestore.ts",
  "dist/index.html",
];

for (const file of required) {
  const full = resolve(root, file);
  if (!existsSync(full)) {
    console.error(`Missing required file: ${file}`);
    process.exit(1);
  }
}

const reports = readFileSync(resolve(root, "src/features/reports/ReportsPage.tsx"), "utf8");
const expenses = readFileSync(resolve(root, "src/features/expenses/ExpensesPage.tsx"), "utf8");
const moneyOwner = readFileSync(resolve(root, "src/shared/lib/moneyOwner.ts"), "utf8");
const money = readFileSync(resolve(root, "src/shared/lib/money.ts"), "utf8");
const loansCalc = readFileSync(resolve(root, "src/features/loans/loanCalculations.ts"), "utf8");
const layout = readFileSync(resolve(root, "src/app/AppLayout.tsx"), "utf8");
const modal = readFileSync(resolve(root, "src/shared/ui/Modal.tsx"), "utf8");
const css = readFileSync(resolve(root, "src/styles/app.css"), "utf8");

function walkSrc(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walkSrc(full, files);
    else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) files.push(full);
  }
  return files;
}

const srcFiles = walkSrc(resolve(root, "src"));
const hasNativePrompt = srcFiles.some((file) => {
  const text = readFileSync(file, "utf8");
  return /\bwindow\.confirm\b|\bwindow\.alert\b/.test(text);
});

const checks = [
  [moneyOwner.includes("resolveTransactionMoneyOwner"), "resolve owner helper"],
  [expenses.includes("resolveTransactionMoneyOwner"), "expenses uses resolve owner"],
  [money.includes("maximumFractionDigits") && money.includes("formatCurrency"), "full currency display"],
  [loansCalc.includes("getLoanReceivableAmount"), "loan interest helpers"],
  [layout.includes("/img/brand-mark.svg"), "topbar logo"],
  [reports.includes("Báo cáo của tôi") && reports.includes("Báo cáo của mẹ"), "dual owner report boards"],
  [reports.includes("DonutChart"), "report donut charts"],
  [reports.includes("Phân loại nhanh"), "unassigned classify panel"],
  [reports.includes("Hai dòng tiền") && reports.includes("owner-compare-grid"), "dual stream compare panels"],
  [modal.includes("createPortal"), "modal portal"],
  [css.includes("scrollbar-gutter: stable"), "scrollbar gutter"],
  [css.includes("body.modal-open"), "modal-open lock"],
  [!hasNativePrompt, "no native confirm/alert in src"],
];

for (const [ok, label] of checks) {
  if (!ok) {
    console.error(`Smoke check failed: ${label}`);
    process.exit(1);
  }
}

console.log("Smoke-react passed: React rebuild shell, moneyOwner report, modal portal OK.");
