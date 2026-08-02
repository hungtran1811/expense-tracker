export type BankBrand = {
  key: string;
  shortLabel: string;
  accent: string;
  soft: string;
  ink: string;
};

const DEFAULT_BRAND: BankBrand = {
  key: "default",
  shortLabel: "Ví",
  accent: "#5b6b82",
  soft: "#eef1f5",
  ink: "#142033",
};

const BRANDS: Array<{ key: string; shortLabel: string; accent: string; soft: string; ink?: string; match: RegExp }> = [
  { key: "vpbank", shortLabel: "VPBank", accent: "#00A651", soft: "#e6f7ee", match: /\bvp\s*bank\b|\bvpbank\b|\bvp\b/ },
  { key: "vietcombank", shortLabel: "Vietcombank", accent: "#007A33", soft: "#e6f3eb", match: /\bvietcom\b|\bvcb\b|\bvietcombank\b/ },
  { key: "techcombank", shortLabel: "Techcombank", accent: "#E31837", soft: "#fde8eb", match: /\btechcom\b|\btcb\b|\btechcombank\b/ },
  { key: "mbbank", shortLabel: "MB", accent: "#6C2C8A", soft: "#f3e9f7", match: /\bmb\s*bank\b|\bmbbank\b|\bmb\b/ },
  { key: "bidv", shortLabel: "BIDV", accent: "#0066B3", soft: "#e6f0f8", match: /\bbidv\b/ },
  { key: "vietinbank", shortLabel: "VietinBank", accent: "#0055A5", soft: "#e6eef7", match: /\bvietin\b|\bctg\b|\bvietinbank\b/ },
  { key: "acb", shortLabel: "ACB", accent: "#003B70", soft: "#e6ecf2", match: /\bacb\b/ },
  { key: "tpbank", shortLabel: "TPBank", accent: "#6B2D8B", soft: "#f2e9f6", match: /\btp\s*bank\b|\btpbank\b/ },
  { key: "sacombank", shortLabel: "Sacombank", accent: "#003DA5", soft: "#e6ecf7", match: /\bsacom\b|\bsacombank\b|\bstb\b/ },
  { key: "vib", shortLabel: "VIB", accent: "#E85D04", soft: "#fdf0e6", match: /\bvib\b/ },
  { key: "shb", shortLabel: "SHB", accent: "#F36C00", soft: "#fff1e6", match: /\bshb\b/ },
  { key: "msb", shortLabel: "MSB", accent: "#C8102E", soft: "#f9e7eb", match: /\bmsb\b/ },
  { key: "agribank", shortLabel: "Agribank", accent: "#C8102E", soft: "#f9e7eb", match: /\bagri\b|\bagribank\b/ },
  { key: "hdbank", shortLabel: "HDBank", accent: "#F36C00", soft: "#fff1e6", match: /\bhd\s*bank\b|\bhdbank\b/ },
  { key: "seabank", shortLabel: "SeABank", accent: "#00838F", soft: "#e6f4f5", match: /\bsea\s*bank\b|\bseabank\b/ },
  { key: "ocb", shortLabel: "OCB", accent: "#00A651", soft: "#e6f7ee", match: /\bocb\b/ },
  { key: "lpbank", shortLabel: "LPBank", accent: "#E31837", soft: "#fde8eb", match: /\blp\s*bank\b|\blpbank\b|\blien\s*viet\b/ },
  { key: "eximbank", shortLabel: "Eximbank", accent: "#003DA5", soft: "#e6ecf7", match: /\bexim\b|\beximbank\b/ },
  { key: "momo", shortLabel: "MoMo", accent: "#A50064", soft: "#f7e6f0", match: /\bmomo\b/ },
  { key: "zalopay", shortLabel: "ZaloPay", accent: "#0068FF", soft: "#e6f0ff", match: /\bzalo\s*pay\b|\bzalopay\b/ },
  { key: "shopeepay", shortLabel: "ShopeePay", accent: "#EE4D2D", soft: "#fdeee9", match: /\bshopee\b|\bshopeepay\b/ },
  { key: "viettel", shortLabel: "Viettel Money", accent: "#EE0033", soft: "#fde6eb", match: /\bviettel\b/ },
  { key: "cash", shortLabel: "Tiền mặt", accent: "#5b6b82", soft: "#eef1f5", match: /\btien\s*mat\b|\bcash\b|\btm\b/ },
  { key: "savings", shortLabel: "Tiết kiệm", accent: "#C47D0E", soft: "#fff8e8", match: /\btiet\s*kiem\b|\bsavings\b|\bgui\s*tiet\s*kiem\b/ },
];

function normalizeName(value: unknown): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function resolveBankBrand(name: unknown, type: unknown = ""): BankBrand {
  const text = normalizeName(name);
  const accountType = String(type || "").trim().toLowerCase();

  for (const brand of BRANDS) {
    if (brand.match.test(text)) {
      return {
        key: brand.key,
        shortLabel: brand.shortLabel,
        accent: brand.accent,
        soft: brand.soft,
        ink: brand.ink || DEFAULT_BRAND.ink,
      };
    }
  }

  if (accountType === "cash") {
    return { key: "cash", shortLabel: "Tiền mặt", accent: "#5b6b82", soft: "#eef1f5", ink: DEFAULT_BRAND.ink };
  }
  if (accountType === "savings") {
    return { key: "savings", shortLabel: "Tiết kiệm", accent: "#C47D0E", soft: "#fff8e8", ink: DEFAULT_BRAND.ink };
  }
  if (accountType === "wallet") {
    return { key: "wallet", shortLabel: "Ví điện tử", accent: "#3558d4", soft: "#eef2ff", ink: DEFAULT_BRAND.ink };
  }
  if (accountType === "bank") {
    return { key: "bank", shortLabel: "Ngân hàng", accent: "#2744b0", soft: "#eef2ff", ink: DEFAULT_BRAND.ink };
  }

  return { ...DEFAULT_BRAND, shortLabel: text ? "Ví" : DEFAULT_BRAND.shortLabel };
}
