import { equalSplit } from "@/lib/split";

describe("equalSplit", () => {
  it("100 paise across 3 people → [34, 33, 33]", () => {
    expect(equalSplit(100, 3)).toEqual([34, 33, 33]);
    expect(equalSplit(100, 3).reduce((s, x) => s + x, 0)).toBe(100);
  });

  it("3333 paise across 2 people → [1667, 1666] (remainder lands on first)", () => {
    expect(equalSplit(3333, 2)).toEqual([1667, 1666]);
    expect(equalSplit(3333, 2).reduce((s, x) => s + x, 0)).toBe(3333);
  });

  it("3333 paise across 3 people → [1111, 1111, 1111] (no remainder)", () => {
    expect(equalSplit(3333, 3)).toEqual([1111, 1111, 1111]);
    expect(equalSplit(3333, 3).reduce((s, x) => s + x, 0)).toBe(3333);
  });

  it("10 paise across 3 people → [4, 3, 3]", () => {
    expect(equalSplit(10, 3)).toEqual([4, 3, 3]);
  });

  it("99 paise across 2 people → [50, 49]", () => {
    expect(equalSplit(99, 2)).toEqual([50, 49]);
  });

  it("divides exactly when total is a multiple of count", () => {
    expect(equalSplit(900, 3)).toEqual([300, 300, 300]);
  });

  it("single participant absorbs the whole total", () => {
    expect(equalSplit(7, 1)).toEqual([7]);
  });

  it("shares always sum to the total exactly (property check)", () => {
    const cases: { total: number; n: number }[] = [
      { total: 1, n: 1 },
      { total: 2, n: 3 },
      { total: 100, n: 7 },
      { total: 12345, n: 11 },
      { total: 999_999_999, n: 13 },
    ];
    for (const { total, n } of cases) {
      const shares = equalSplit(total, n);
      expect(shares).toHaveLength(n);
      expect(shares.reduce((s, x) => s + x, 0)).toBe(total);
    }
  });

  it("rejects non-positive totals", () => {
    expect(() => equalSplit(0, 3)).toThrow();
    expect(() => equalSplit(-5, 3)).toThrow();
  });

  it("rejects non-positive participant counts", () => {
    expect(() => equalSplit(100, 0)).toThrow();
    expect(() => equalSplit(100, -1)).toThrow();
  });

  it("rejects non-integer inputs", () => {
    expect(() => equalSplit(10.5, 3)).toThrow();
    expect(() => equalSplit(100, 2.5)).toThrow();
  });
});
