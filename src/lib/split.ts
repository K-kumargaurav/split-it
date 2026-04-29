// Split arithmetic, kept dependency-free so both server and client previews
// can call it. All inputs/outputs are paise (integers).
//
// Per SPEC §4.2 there are three split types:
//   • EQUAL — total divided evenly; remainder lands on the FIRST participant.
//   • EXACT — caller supplies each share; we just verify sum.
//   • PERCENTAGE — each pct gets floor(total*pct/100); remainder paise are
//     distributed to the LAST participants going backward, one paise each,
//     so the shares sum exactly to `totalPaise`.

export function equalSplit(totalPaise: number, participantCount: number): number[] {
  if (!Number.isInteger(totalPaise) || totalPaise < 1) {
    throw new Error("totalPaise must be a positive integer.");
  }
  if (!Number.isInteger(participantCount) || participantCount < 1) {
    throw new Error("participantCount must be a positive integer.");
  }
  const base = Math.floor(totalPaise / participantCount);
  const remainder = totalPaise - base * participantCount;
  const shares = new Array<number>(participantCount).fill(base);
  shares[0] += remainder;
  return shares;
}

// Computes per-participant shares from percentages. Pure arithmetic — the
// "must sum to 100" rule is enforced upstream (Zod schema + server) so this
// function stays usable for live form previews where the user may have only
// partially allocated.
//
// Rounding policy: floor each `total * pct / 100`, then distribute the
// leftover paise one-by-one to the LAST participants (working backward from
// the end). If percentages sum to > 100, the algorithm clamps from the end
// instead. Either way, `shares.reduce(sum)` always equals `totalPaise`.
export function percentageSplit(
  totalPaise: number,
  percentages: number[],
): number[] {
  if (!Number.isInteger(totalPaise) || totalPaise < 1) {
    throw new Error("totalPaise must be a positive integer.");
  }
  if (!Array.isArray(percentages) || percentages.length < 1) {
    throw new Error("percentages must be a non-empty array.");
  }
  for (const pct of percentages) {
    if (typeof pct !== "number" || !Number.isFinite(pct) || pct < 0) {
      throw new Error("Each percentage must be a non-negative finite number.");
    }
  }

  const shares = percentages.map((pct) => Math.floor((totalPaise * pct) / 100));
  let remainder = totalPaise - shares.reduce((s, x) => s + x, 0);
  let i = shares.length - 1;
  while (remainder > 0) {
    shares[i] = (shares[i] ?? 0) + 1;
    remainder -= 1;
    i = i === 0 ? shares.length - 1 : i - 1;
  }
  // Negative remainder: percentages summed to > 100. Shave paise off the
  // tail until shares sum to total. Skips zero-shares so we don't go
  // negative.
  while (remainder < 0) {
    const cur = shares[i] ?? 0;
    if (cur > 0) {
      shares[i] = cur - 1;
      remainder += 1;
    }
    i = i === 0 ? shares.length - 1 : i - 1;
  }
  return shares;
}

// Asserts that an EXACT split's per-participant amounts sum to the total.
// Returns the validated shares (in input order) for symmetry with the other
// split helpers, so callers can write `const shares = exactSplit(...)`.
export function exactSplit(totalPaise: number, amounts: number[]): number[] {
  if (!Number.isInteger(totalPaise) || totalPaise < 1) {
    throw new Error("totalPaise must be a positive integer.");
  }
  if (!Array.isArray(amounts) || amounts.length < 1) {
    throw new Error("amounts must be a non-empty array.");
  }
  for (const a of amounts) {
    if (!Number.isInteger(a) || a < 0) {
      throw new Error("Each exact amount must be a non-negative integer (paise).");
    }
  }
  const sum = amounts.reduce((s, x) => s + x, 0);
  if (sum !== totalPaise) {
    throw new Error(
      `Split amounts sum to ${sum} but expense total is ${totalPaise}.`,
    );
  }
  return [...amounts];
}
