// Pure helper functions for ExpenseFilters — split out to keep the component
// file under the 300-line limit.

export interface FilterState {
  dateFrom: string;
  dateTo: string;
  categoryId: string;
  paidBy: string;
  involves: string;
  minAmount: string;
  maxAmount: string;
  keyword: string;
}

export interface FilterChip {
  key: keyof FilterState;
  label: string;
}

export interface MemberOption {
  id: string;
  displayName: string;
}

export interface CategoryOption {
  id: string;
  name: string;
  emoji: string | null;
}

export const EMPTY_FILTER: FilterState = {
  dateFrom: "", dateTo: "", categoryId: "", paidBy: "",
  involves: "", minAmount: "", maxAmount: "", keyword: "",
};

export const FILTER_KEYS = [
  "dateFrom", "dateTo", "categoryId", "paidBy",
  "involves", "minAmount", "maxAmount", "keyword",
] as const;

const RUPEE_RE = /^\d+(\.\d{1,2})?$/;

export function buildChips(
  draft: FilterState,
  categories: CategoryOption[],
  members: MemberOption[],
): FilterChip[] {
  const chips: FilterChip[] = [];
  const nameOf = (id: string) => members.find((m) => m.id === id)?.displayName ?? "Member";
  const catLabel = (id: string) => {
    const c = categories.find((x) => x.id === id);
    return c ? (c.emoji ? `${c.emoji} ${c.name}` : c.name) : "Category";
  };
  if (draft.dateFrom) chips.push({ key: "dateFrom", label: `From: ${draft.dateFrom}` });
  if (draft.dateTo) chips.push({ key: "dateTo", label: `To: ${draft.dateTo}` });
  if (draft.categoryId) chips.push({ key: "categoryId", label: catLabel(draft.categoryId) });
  if (draft.paidBy) chips.push({ key: "paidBy", label: `Paid by: ${nameOf(draft.paidBy)}` });
  if (draft.involves) chips.push({ key: "involves", label: `Involves: ${nameOf(draft.involves)}` });
  if (draft.minAmount) chips.push({ key: "minAmount", label: `Min: ₹${draft.minAmount}` });
  if (draft.maxAmount) chips.push({ key: "maxAmount", label: `Max: ₹${draft.maxAmount}` });
  return chips;
}

export function fromParams(params: URLSearchParams): FilterState {
  const get = (k: string) => params.get(k) ?? "";
  return {
    dateFrom: get("dateFrom"),
    dateTo: get("dateTo"),
    categoryId: get("categoryId"),
    paidBy: get("paidBy"),
    involves: get("involves"),
    minAmount: paiseToRupees(params.get("minAmount")),
    maxAmount: paiseToRupees(params.get("maxAmount")),
    keyword: get("keyword"),
  };
}

export function paiseToRupees(raw: string | null): string {
  if (!raw || !/^-?\d+$/.test(raw)) return "";
  const paise = BigInt(raw);
  const neg = paise < BigInt(0);
  const abs = neg ? -paise : paise;
  const whole = abs / BigInt(100);
  const frac = (abs % BigInt(100)).toString().padStart(2, "0");
  return (neg ? "-" : "") + (frac === "00" ? `${whole}` : `${whole}.${frac}`);
}

export function rupeesToPaise(rupees: string): string | null {
  const t = rupees.trim();
  if (!t || !RUPEE_RE.test(t)) return null;
  const [whole, fracRaw = ""] = t.split(".");
  const frac = fracRaw.padEnd(2, "0").slice(0, 2);
  return (BigInt(whole ?? "0") * BigInt(100) + BigInt(frac)).toString();
}

export function commitAmount(
  key: "minAmount" | "maxAmount",
  draft: FilterState,
  apply: (next: FilterState) => void,
): void {
  const raw = draft[key].trim();
  if (!raw) { apply({ ...draft, [key]: "" }); return; }
  const paise = rupeesToPaise(raw);
  if (paise === null) return;
  apply({ ...draft, [key]: paiseToRupees(paise) });
}

export function activeCount(s: FilterState): number {
  let n = 0;
  for (const k of FILTER_KEYS) if (s[k].trim()) n++;
  return n;
}

export function sameState(a: FilterState, b: FilterState): boolean {
  for (const k of FILTER_KEYS) if (a[k] !== b[k]) return false;
  return true;
}

export function amountError(s: FilterState): string | null {
  const min = rupeesToPaise(s.minAmount);
  const max = rupeesToPaise(s.maxAmount);
  if (s.minAmount.trim() && min === null)
    return "Min amount must be a number with up to 2 decimal places.";
  if (s.maxAmount.trim() && max === null)
    return "Max amount must be a number with up to 2 decimal places.";
  if (min !== null && max !== null && BigInt(min) > BigInt(max))
    return "Min amount can't exceed max amount.";
  return null;
}
