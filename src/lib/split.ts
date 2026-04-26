// Equal-split arithmetic, kept dependency-free so both the server module and
// the client preview can call it. All inputs/outputs are paise (integers).
//
// Strategy per SPEC §4.2: floor division for the base share, then dump the
// entire remainder onto the first participant. The remainder is always
// strictly less than `participantCount` (consequence of integer floor), so a
// single +remainder on index 0 is enough to make the shares sum exactly to
// the total — no second pass required.

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
