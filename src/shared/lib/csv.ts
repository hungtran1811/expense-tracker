export function toCsvCell(value: unknown): string {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function buildCsv(rows: Array<Array<unknown>>): string {
  return rows.map((row) => row.map(toCsvCell).join(",")).join("\r\n");
}

export function downloadCsv(filename: string, rows: Array<Array<unknown>>) {
  const blob = new Blob(["\uFEFF" + buildCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
