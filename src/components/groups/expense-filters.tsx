"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/cn";
import { MemberSelector } from "@/components/ui/member-selector";
import { PremiumInput } from "@/components/ui/premium-input";
import { PremiumSelect } from "@/components/ui/premium-select";
import {
  activeCount,
  amountError,
  buildChips,
  commitAmount,
  EMPTY_FILTER,
  FILTER_KEYS,
  fromParams,
  sameState,
  type CategoryOption,
  type FilterChip,
  type FilterState,
  type MemberOption,
} from "./expense-filter-helpers";

export interface ExpenseFiltersProps {
  members: MemberOption[];
  categories: CategoryOption[];
}

const DEBOUNCE_MS = 400;

const AMOUNT_INPUT_CLASS =
  "h-[44px] w-full rounded-2xl border border-white/[0.06] bg-[#0E1116] px-4 text-sm " +
  "text-[#F5F7FA] placeholder:text-[#8B93A7] focus:outline-none focus:ring-2 " +
  "focus:ring-[#00C896]/20 focus:border-[#00C896]/40 transition";

export function ExpenseFilters({ members, categories }: ExpenseFiltersProps) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const params = useSearchParams();
  const initial = useMemo(() => fromParams(params), [params]);
  const [draft, setDraft] = useState<FilterState>(initial);
  const [open, setOpen] = useState(() => activeCount(initial) > 0);

  useEffect(() => {
    const fromUrl = fromParams(params);
    setDraft((p) => (sameState(p, fromUrl) ? p : fromUrl));
  }, [params]);

  const push = useCallback(
    (next: FilterState) => {
      const sp = new URLSearchParams();
      Array.from(params.entries()).forEach(([k, v]) => {
        if (!FILTER_KEYS.includes(k as (typeof FILTER_KEYS)[number])) sp.set(k, v);
      });
      for (const key of FILTER_KEYS) {
        const raw = next[key].trim();
        if (raw) sp.set(key, raw);
      }
      const qs = sp.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  const setField = useCallback(
    <K extends keyof FilterState>(k: K, v: FilterState[K]) =>
      setDraft((p) => ({ ...p, [k]: v })),
    [],
  );

  const apply = useCallback(
    (next: FilterState) => { setDraft(next); push(next); },
    [push],
  );

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (draft.keyword === initial.keyword) return;
    debounceRef.current = setTimeout(() => push(draft), DEBOUNCE_MS);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.keyword]);

  const count = activeCount(draft);
  const chips: FilterChip[] = buildChips(draft, categories, members);
  const amountErr = amountError(draft);

  return (
    <section aria-label="Expense filters">
      {/* ── Filter bar ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-[#8B93A7]">
            <Search size={16} aria-hidden="true" />
          </span>
          <input
            type="search"
            value={draft.keyword}
            onChange={(e) => setField("keyword", e.target.value)}
            placeholder="Search expenses..."
            aria-label="Search expenses"
            className="h-[44px] w-full rounded-2xl border border-white/[0.06] bg-[#161B22] pl-10 pr-4 text-sm text-[#F5F7FA] placeholder:text-[#8B93A7] focus:outline-none focus:ring-2 focus:ring-[#00C896]/20 focus:border-[#00C896]/40 transition"
          />
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="filter-panel"
          className={cn(
            "flex h-[44px] items-center gap-2 rounded-2xl border border-white/[0.06] bg-[#161B22]",
            "px-4 text-sm font-medium text-[#8B93A7] transition",
            "hover:text-[#F5F7FA] focus:outline-none focus:ring-2 focus:ring-[#00C896]/20",
            open && "border-white/10 text-[#F5F7FA]",
          )}
        >
          Filters
          {count > 0 && (
            <span
              aria-label={`${count} active filter${count === 1 ? "" : "s"}`}
              className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#00C896] px-1.5 text-[11px] font-semibold text-[#0E1116]"
            >
              {count}
            </span>
          )}
          <motion.span
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="flex items-center"
          >
            <ChevronDown size={16} aria-hidden="true" />
          </motion.span>
        </button>
      </div>

      {/* ── Active chips ───────────────────────────────────────────── */}
      {chips.length > 0 && (
        <motion.div layout className="mt-3 flex flex-wrap gap-2">
          <AnimatePresence mode="popLayout">
            {chips.map((chip) => (
              <motion.div
                key={chip.key}
                layout
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className="flex items-center gap-1.5 rounded-full border border-[rgba(0,200,150,0.2)] bg-[rgba(0,200,150,0.1)] px-3 py-1 text-xs font-medium text-[#00C896]"
              >
                {chip.label}
                <button
                  type="button"
                  onClick={() => apply({ ...draft, [chip.key]: "" } as FilterState)}
                  aria-label={`Remove ${chip.label} filter`}
                  className="ml-0.5 transition hover:opacity-70 focus:outline-none"
                >
                  <X size={12} aria-hidden="true" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* ── Expanded panel ─────────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="filter-panel"
            id="filter-panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-2 rounded-2xl border border-white/[0.06] bg-[#161B22] p-5">
              <div className="grid grid-cols-2 gap-4">
                {/* Row 1 — dates */}
                <PremiumInput
                  id="filter-date-from" label="From" type="date"
                  value={draft.dateFrom}
                  onChange={(e) => apply({ ...draft, dateFrom: e.target.value })}
                />
                <PremiumInput
                  id="filter-date-to" label="To" type="date"
                  value={draft.dateTo}
                  onChange={(e) => apply({ ...draft, dateTo: e.target.value })}
                />

                {/* Row 2 — category + paid by */}
                <PremiumSelect
                  id="filter-category" label="Category"
                  value={draft.categoryId}
                  onChange={(e) => apply({ ...draft, categoryId: e.target.value })}
                >
                  <option value="">All categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.emoji ? `${c.emoji} ${c.name}` : c.name}
                    </option>
                  ))}
                </PremiumSelect>
                <PremiumSelect
                  id="filter-paid-by" label="Paid by"
                  value={draft.paidBy}
                  onChange={(e) => apply({ ...draft, paidBy: e.target.value })}
                >
                  <option value="">Any payer</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>{m.displayName}</option>
                  ))}
                </PremiumSelect>

                {/* Row 3 — amounts (compact) */}
                <div>
                  <label htmlFor="filter-min" className="mb-1.5 block text-[13px] text-[#8B93A7]">
                    Min amount (₹)
                  </label>
                  <input
                    id="filter-min" type="text" inputMode="decimal"
                    value={draft.minAmount} placeholder="0"
                    onChange={(e) => setField("minAmount", e.target.value)}
                    onBlur={() => commitAmount("minAmount", draft, apply)}
                    className={AMOUNT_INPUT_CLASS}
                  />
                </div>
                <div>
                  <label htmlFor="filter-max" className="mb-1.5 block text-[13px] text-[#8B93A7]">
                    Max amount (₹)
                  </label>
                  <input
                    id="filter-max" type="text" inputMode="decimal"
                    value={draft.maxAmount} placeholder="∞"
                    onChange={(e) => setField("maxAmount", e.target.value)}
                    onBlur={() => commitAmount("maxAmount", draft, apply)}
                    className={AMOUNT_INPUT_CLASS}
                  />
                </div>
              </div>

              {/* Row 4 — involves member */}
              <div className="mt-4">
                <p className="mb-2 text-[13px] text-[#8B93A7]">Involves member</p>
                <MemberSelector
                  members={members}
                  selected={draft.involves}
                  onToggle={(id) =>
                    apply({ ...draft, involves: draft.involves === id ? "" : id })
                  }
                  mode="single"
                />
              </div>

              {amountErr && (
                <p role="alert" className="mt-3 text-[12px] text-[#FF4757]">{amountErr}</p>
              )}

              {count > 0 && (
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => apply(EMPTY_FILTER)}
                    className="text-sm font-medium text-[#FF4757] transition hover:opacity-80 focus:outline-none"
                  >
                    Clear all
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
