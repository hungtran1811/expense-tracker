import { formatCurrency } from "./money";

/** Open a print-friendly window so the user can Save as PDF. */
export function openReportPrintWindow(options: {
  title: string;
  subtitle?: string;
  rows: Array<[string, string, string, string]>;
}) {
  const { title, subtitle = "", rows } = options;
  const body = rows
    .map(
      ([a, b, c, d]) =>
        `<tr><td>${escapeHtml(a)}</td><td>${escapeHtml(b)}</td><td>${escapeHtml(c)}</td><td>${escapeHtml(d)}</td></tr>`
    )
    .join("");
  const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title>
  <style>
    body{font-family:Segoe UI,sans-serif;padding:24px;color:#142033}
    h1{font-size:20px;margin:0 0 6px} p{color:#5b6b82;margin:0 0 16px}
    table{width:100%;border-collapse:collapse} th,td{border:1px solid #d7dee8;padding:8px 10px;text-align:left}
    th{background:#f3f6fb;font-size:12px;text-transform:uppercase}
  </style></head><body>
  <h1>${escapeHtml(title)}</h1>
  ${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ""}
  <table><thead><tr><th>Chỉ số</th><th>Tôi</th><th>Mẹ</th><th>Tổng</th></tr></thead>
  <tbody>${body}</tbody></table>
  <script>window.onload=()=>window.print()</script>
  </body></html>`;

  const win = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
  if (!win) throw new Error("Trình duyệt chặn cửa sổ in. Hãy cho phép popup.");
  win.document.write(html);
  win.document.close();
}

export function moneyCell(value: number) {
  return formatCurrency(value);
}

function escapeHtml(value: string) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
