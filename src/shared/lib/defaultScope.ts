import type { ExpenseScope } from "../types/finance";

function normalizeScopeName(value: unknown): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Prefer nhóm chi "Hưng Trần"; fallback first scope. */
export function resolveDefaultScopeId(scopes: ExpenseScope[] = []): string {
  if (!scopes.length) return "";
  const preferred = scopes.find((scope) => {
    const name = normalizeScopeName(scope.name);
    return name.includes("hung tran") || name === "hungtran" || name.includes("hungtran");
  });
  return preferred?.id || scopes[0]?.id || "";
}
