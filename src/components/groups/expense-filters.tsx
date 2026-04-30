"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/cn";

// Filter UI for SPEC §4.14. Filters live in the URL so the page they sit on
// is shareable and the back button preserves the filtered view. The filter
// panel itself is collapsible — most users hit a group page to scan the
// recent feed, not to dig through history, so the panel stays closed by
// default and announces an active-filter count when the URL has filters.

interface MemberOption {
  id: string;
  displayName: string;
}

interface CategoryOption {
  id: string;
  name: string;
  emoji: string | null;
}

export interface ExpenseFiltersProps {
  members: MemberOption[];
  categories: CategoryOption[];
}

interface FilterState {
  dateFrom: string;
  dateTo: string;
  categoryId: string;
  paidBy: string;
  involves: string;
  minAmount: string;
  maxAmount: string;
  keyword: string;
}

const EMPTY_STATE: FilterState = {
  dateFrom: "",
  dateTo: "",
  categoryId: "",
  paidBy: "",
  involves: "",
  minAmount: "",
  maxAmount: "",
  keyword: "",
};

const FILTER_KEYS = [
  "dateFrom",
  "dateTo",
  "categoryId",
  "paidBy",
  "involves",
  "minAmount",
  "maxAmount",
  "keyword",
] as const;

const KEYWORD_DEBOUNCE_MS = 400;
const RUPEE_PATTERN = /^\d+(\.\d{1,2})?$/;

export function ExpenseFilters({ members, categories }: ExpenseFiltersProps) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const params = useSearchParams();

  const initial = useMemo<FilterState>(() => readFromParams(params), [params]);
  const [draft, setDraft] = useState<FilterState>(initial);
  const [open, setOpen] = useState<boolean>(() => activeCount(initial) > 0);

  // Re-sync local draft when the URL changes from outside the component (e.g.
  // browser back/forward, or another component pushing). We only overwrite
  // when the params actually differ — typing into a field shouldn't get its
  // value yanked away while React batches a router.push.
  useEffect(() => {
    const fromUrl = readFromParams(params);
    setDraft((prev) => (sameState(prev, fromUrl) ? prev : fromUrl));
  }, [params]);

  const pushFilters = useCallback(
    (next: FilterState) => {
      const sp = new URLSearchParams();
      // Preserve unrelated query params (e.g. tab state) by copying anything
      // we don't own back into the new URLSearchParams.
      Array.from(params.entries()).forEach(([k, v]) => {
        if (!FILTER_KEYS.includes(k as (typeof FILTER_KEYS)[number])) {
          sp.set(k, v);
        }
      });
      for (const key of FILTER_KEYS) {
        const raw = next[key].trim();
        if (raw.length > 0) sp.set(key, raw);
      }
      const qs = sp.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  const setField = useCallback(
    <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
      setDraft((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const applyImmediate = useCallback(
    (next: FilterState) => {
      setDraft(next);
      pushFilters(next);
    },
    [pushFilters],
  );

  // Keyword input is debounced — we don't want a re-fetch on every keystroke.
  // Other filters fire immediately because they're discrete (selects, dates).
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (draft.keyword === initial.keyword) return;
    debounceRef.current = setTimeout(() => {
      pushFilters(draft);
    }, KEYWORD_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // We deliberately don't depend on `pushFilters` here — it changes whenever
    // params change, which happens after the push lands. Including it would
    // schedule a redundant push on every URL update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.keyword]);

  const count = activeCount(draft);
  const hasFilters = count > 0;
  const amountError = amountRangeError(draft);

  const onClear = () => {
    applyImmediate(EMPTY_STATE);
  };

  return (
    <section
      aria-label="Expense filters"
      className="mb-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="expense-filters-panel"
          className="inline-flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-medium text-slate-700 dark:text-slate-200 transition hover:bg-slate-50 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            className="h-4 w-4"
            fill="currentColor"
          >
            <path d="M3 5a1 1 0 011-1h12a1 1 0 01.78 1.625l-4.78 6V16a1 1 0 01-1.447.894l-2-1A1 1 0 018 15v-3.375L3.22 5.625A1 1 0 013 5z" />
          </svg>
          Filters
          {count > 0 ? (
            <span
              aria-label={`${count} active filter${count === 1 ? "" : "s"}`}
              className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-600 px-1.5 text-xs font-semibold text-white"
            >
              {count}
            </span>
          ) : null}
        </button>
        {hasFilters ? (
          <button
            type="button"
            onClick={onClear}
            className="text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 rounded"
          >
            Clear all
          </button>
        ) : null}
      </div>

      {open ? (
        <div
          id="expense-filters-panel"
          className="border-t border-slate-100 dark:border-slate-800 px-5 py-4"
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Search title or notes" htmlFor="filter-keyword">
              <input
                id="filter-keyword"
                type="search"
                value={draft.keyword}
                placeholder="e.g. groceries, dinner"
                onChange={(e) => setField("keyword", e.target.value)}
                className={inputClass}
              />
            </Field>

            <Field label="Date from" htmlFor="filter-date-from">
              <input
                id="filter-date-from"
                type="date"
                value={draft.dateFrom}
                onChange={(e) => applyImmediate({ ...draft, dateFrom: e.target.value })}
                className={inputClass}
              />
            </Field>

            <Field label="Date to" htmlFor="filter-date-to">
              <input
                id="filter-date-to"
                type="date"
                value={draft.dateTo}
                onChange={(e) => applyImmediate({ ...draft, dateTo: e.target.value })}
                className={inputClass}
              />
            </Field>

            <Field label="Category" htmlFor="filter-category">
              <select
                id="filter-category"
                value={draft.categoryId}
                onChange={(e) =>
                  applyImmediate({ ...draft, categoryId: e.target.value })
                }
                className={inputClass}
              >
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.emoji ? `${c.emoji} ${c.name}` : c.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Paid by" htmlFor="filter-paid-by">
              <select
                id="filter-paid-by"
                value={draft.paidBy}
                onChange={(e) =>
                  applyImmediate({ ...draft, paidBy: e.target.value })
                }
                className={inputClass}
              >
                <option value="">Any payer</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Involves member" htmlFor="filter-involves">
              <select
                id="filter-involves"
                value={draft.involves}
                onChange={(e) =>
                  applyImmediate({ ...draft, involves: e.target.value })
                }
                className={inputClass}
              >
                <option value="">Anyone</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Min amount (₹)" htmlFor="filter-min-amount">
              <input
                id="filter-min-amount"
                type="text"
                inputMode="decimal"
                value={draft.minAmount}
                placeholder="0"
                onChange={(e) => setField("minAmount", e.target.value)}
                onBlur={() => commitIfValidAmount("minAmount", draft, applyImmediate)}
                className={inputClass}
              />
            </Field>

            <Field label="Max amount (₹)" htmlFor="filter-max-amount">
              <input
                id="filter-max-amount"
                type="text"
                inputMode="decimal"
                value={draft.maxAmount}
                placeholder="∞"
                onChange={(e) => setField("maxAmount", e.target.value)}
                onBlur={() => commitIfValidAmount("maxAmount", draft, applyImmediate)}
                className={inputClass}
              />
            </Field>
          </div>

          {amountError ? (
            <p
              role="alert"
              className="mt-3 text-xs font-medium text-rose-600"
            >
              {amountError}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="flex flex-col gap-1">
      <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{label}</span>
      {children}
    </label>
  );
}

const inputClass = cn(
  "w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900",
  "px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
);

function readFromParams(params: URLSearchParams): FilterState {
  const get = (k: string): string => params.get(k) ?? "";
  return {
    dateFrom: get("dateFrom"),
    dateTo: get("dateTo"),
    categoryId: get("categoryId"),
    paidBy: get("paidBy"),
    involves: get("involves"),
    minAmount: paiseToRupeesField(params.get("minAmount")),
    maxAmount: paiseToRupeesField(params.get("maxAmount")),
    keyword: get("keyword"),
  };
}

// URL carries paise (matches the API), but the field is rupees-facing per
// SPEC §4.2. Convert at the boundary in both directions.
function paiseToRupeesField(raw: string | null): string {
  if (!raw) return "";
  if (!/^-?\d+$/.test(raw)) return "";
  const paise = BigInt(raw);
  const negative = paise < BigInt(0);
  const abs = negative ? -paise : paise;
  const whole = abs / BigInt(100);
  const fraction = (abs % BigInt(100)).toString().padStart(2, "0");
  const trimmed = fraction === "00" ? `${whole}` : `${whole}.${fraction}`;
  return negative ? `-${trimmed}` : trimmed;
}

function rupeesFieldToPaise(rupees: string): string | null {
  const trimmed = rupees.trim();
  if (trimmed.length === 0) return null;
  if (!RUPEE_PATTERN.test(trimmed)) return null;
  const [whole, fractionRaw = ""] = trimmed.split(".");
  const fraction = fractionRaw.padEnd(2, "0").slice(0, 2);
  const paise = BigInt(whole) * BigInt(100) + BigInt(fraction);
  return paise.toString();
}

function commitIfValidAmount(
  key: "minAmount" | "maxAmount",
  draft: FilterState,
  apply: (next: FilterState) => void,
): void {
  const raw = draft[key].trim();
  if (raw.length === 0) {
    apply({ ...draft, [key]: "" });
    return;
  }
  const paise = rupeesFieldToPaise(raw);
  if (paise === null) return;
  // Round-trip through rupees → paise → rupees so the field shows a
  // canonical "10.00" rather than "10" on commit.
  apply({ ...draft, [key]: paiseToRupeesField(paise) });
}

function activeCount(state: FilterState): number {
  let n = 0;
  for (const key of FILTER_KEYS) {
    if (state[key].trim().length > 0) n += 1;
  }
  return n;
}

function sameState(a: FilterState, b: FilterState): boolean {
  for (const key of FILTER_KEYS) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

function amountRangeError(state: FilterState): string | null {
  const min = rupeesFieldToPaise(state.minAmount);
  const max = rupeesFieldToPaise(state.maxAmount);
  if (state.minAmount.trim().length > 0 && min === null) {
    return "Min amount must be a positive number with up to 2 decimal places.";
  }
  if (state.maxAmount.trim().length > 0 && max === null) {
    return "Max amount must be a positive number with up to 2 decimal places.";
  }
  if (min !== null && max !== null && BigInt(min) > BigInt(max)) {
    return "Min amount can't exceed max amount.";
  }
  return null;
}
