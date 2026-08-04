import { parseAmountInput } from "./parseAmount";
import { normalizeAccountMoneyOwner } from "./moneyOwner";
import { resolveBankBrand } from "./bankBrand";
import type { Account } from "../types/finance";

export type QuickEntryParsed = {
  type: "expense" | "income";
  amount: number;
  note: string;
  accountId: string;
  moneyOwner: "personal" | "mother";
  /** Amount-only or missing account → open full form instead of instant save */
  needsForm: boolean;
};

export type QuickEntryParseError = {
  error: string;
};

function normalizeText(value: string): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Amount tokens: 45k, 1.5tr, 500.000, 1200000 */
const AMOUNT_RE = /([+-]?)(\d+(?:[.,]\d+)?(?:\s*(?:tr|m|k))?|\d{1,3}(?:[.,]\d{3})+)/i;

function stripTypeKeywords(text: string): { type: "expense" | "income" | null; rest: string } {
  let rest = text.trim();
  const lower = rest.toLowerCase();

  if (/^(thu\s*nhập|thu\s*nhap|thu nhập|khoản\s*thu|khoan\s*thu)\b/i.test(lower)) {
    rest = rest.replace(/^(thu\s*nhập|thu\s*nhap|thu nhập|khoản\s*thu|khoan\s*thu)\b/i, "").trim();
    return { type: "income", rest };
  }
  if (/^thu\b/i.test(lower)) {
    rest = rest.replace(/^thu\b/i, "").trim();
    return { type: "income", rest };
  }
  if (/^(khoản\s*chi|khoan\s*chi|chi\s*tiêu|chi tieu)\b/i.test(lower)) {
    rest = rest.replace(/^(khoản\s*chi|khoan\s*chi|chi\s*tiêu|chi tieu)\b/i, "").trim();
    return { type: "expense", rest };
  }
  if (/^chi\b/i.test(lower)) {
    rest = rest.replace(/^chi\b/i, "").trim();
    return { type: "expense", rest };
  }

  return { type: null, rest };
}

export function matchAccountFromText(
  text: string,
  accounts: Account[]
): { accountId: string; cleanedNote: string } | null {
  const active = accounts.filter((item) => String(item.status || "active") !== "archived");
  if (!active.length || !text.trim()) return null;

  const normalizedNote = normalizeText(text);
  const ranked = active
    .map((account) => {
      const nameNorm = normalizeText(account.name);
      const brand = resolveBankBrand(account.name, account.type);
      const brandKey = normalizeText(brand.key);
      const brandLabel = normalizeText(brand.shortLabel);
      let score = 0;
      let matchedToken = "";
      if (nameNorm && normalizedNote.includes(nameNorm)) {
        score = 100 + nameNorm.length;
        matchedToken = nameNorm;
      } else if (
        brandLabel &&
        brandLabel.length > 1 &&
        brandLabel !== "vi" &&
        normalizedNote.includes(brandLabel)
      ) {
        score = 80 + brandLabel.length;
        matchedToken = brandLabel;
      } else if (brandKey && brandKey !== "default" && normalizedNote.includes(brandKey)) {
        score = 70 + brandKey.length;
        matchedToken = brandKey;
      }
      return { account, score, matchedToken };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  if (!best) return null;

  const tokens = text.split(/\s+/).filter(Boolean);
  const cleanedTokens = tokens.filter((token) => {
    const norm = normalizeText(token);
    if (!norm) return false;
    if (best.matchedToken && (norm === best.matchedToken || best.matchedToken.includes(norm))) {
      return false;
    }
    return true;
  });

  return { accountId: best.account.id, cleanedNote: cleanedTokens.join(" ").trim() };
}

function defaultAccountId(accounts: Account[]): string {
  const active = accounts.filter((item) => String(item.status || "active") !== "archived");
  return (
    active.find((item) => item.isDefault)?.id ||
    active[0]?.id ||
    ""
  );
}

/**
 * Parse a single-line quick entry string into a transaction draft skeleton.
 */
export function parseQuickEntry(
  raw: string,
  accounts: Account[] = []
): QuickEntryParsed | QuickEntryParseError {
  const original = String(raw || "").trim();
  if (!original) return { error: "Nhập số tiền, ví dụ: chi 45k cafe" };

  const { type: typed, rest: afterType } = stripTypeKeywords(original);
  let working = afterType || original;
  let type: "expense" | "income" = typed || "expense";

  const amountMatch = working.match(AMOUNT_RE);
  if (!amountMatch) return { error: "Không đọc được số tiền. Thử: 45k, 1.5tr, 500000" };

  const sign = amountMatch[1] || "";
  const amountToken = `${amountMatch[2]}`;
  const amount = parseAmountInput(amountToken);
  if (amount == null) return { error: "Số tiền không hợp lệ." };

  if (!typed) {
    if (sign === "+") type = "income";
    else type = "expense"; // includes "-" or no sign
  }

  let note = (working.slice(0, amountMatch.index) + working.slice((amountMatch.index || 0) + amountMatch[0].length))
    .replace(/\s{2,}/g, " ")
    .trim();

  // Leading/trailing punctuation cleanup
  note = note.replace(/^[\s,.-]+|[\s,.-]+$/g, "").trim();

  let accountId = "";
  const matched = matchAccountFromText(note, accounts);
  if (matched) {
    accountId = matched.accountId;
    note = matched.cleanedNote.replace(/^[\s,.-]+|[\s,.-]+$/g, "").trim();
  }
  if (!accountId) accountId = defaultAccountId(accounts);

  const account = accounts.find((item) => item.id === accountId);
  const moneyOwner = account
    ? normalizeAccountMoneyOwner(account.moneyOwner)
    : "personal";

  // Chỉ mở form khi thiếu ví — số tiền đơn (45k) vẫn lưu chi ngay.
  const needsForm = !accountId;

  return {
    type,
    amount,
    note,
    accountId,
    moneyOwner,
    needsForm,
  };
}
