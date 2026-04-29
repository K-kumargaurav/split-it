import { equalSplit, exactSplit, percentageSplit } from "@/lib/split";

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

describe("exactSplit", () => {
  it("[500, 300, 200] sums to 1000 → returns the same shares", () => {
    expect(exactSplit(1000, [500, 300, 200])).toEqual([500, 300, 200]);
  });

  it("rejects when amounts sum to less than the total ([500, 300, 100] → 900 ≠ 1000)", () => {
    expect(() => exactSplit(1000, [500, 300, 100])).toThrow();
  });

  it("rejects when amounts sum to more than the total", () => {
    expect(() => exactSplit(1000, [500, 300, 250])).toThrow();
  });

  it("rejects negative amounts", () => {
    expect(() => exactSplit(1000, [1100, -100])).toThrow();
  });

  it("rejects non-integer amounts", () => {
    expect(() => exactSplit(1000, [500.5, 499.5])).toThrow();
  });
});

describe("percentageSplit", () => {
  it("[50, 30, 20] of 1000 paise → [500, 300, 200]", () => {
    expect(percentageSplit(1000, [50, 30, 20])).toEqual([500, 300, 200]);
    expect(percentageSplit(1000, [50, 30, 20]).reduce((s, x) => s + x, 0)).toBe(1000);
  });

  it("[33, 33, 33] of 100 paise → [33, 33, 34] (remainder lands on last)", () => {
    expect(percentageSplit(100, [33, 33, 33])).toEqual([33, 33, 34]);
    expect(percentageSplit(100, [33, 33, 33]).reduce((s, x) => s + x, 0)).toBe(100);
  });

  it("rejects negative percentages", () => {
    expect(() => percentageSplit(1000, [110, -10])).toThrow();
  });

  it("100% to a single participant returns the whole total", () => {
    expect(percentageSplit(1000, [100])).toEqual([1000]);
  });

  it("shares always sum to the total exactly (property check)", () => {
    const cases: { total: number; pcts: number[] }[] = [
      { total: 100, pcts: [33, 34, 33] },
      { total: 999, pcts: [10, 20, 30, 40] },
      { total: 12345, pcts: [25, 25, 25, 25] },
      { total: 1, pcts: [100] },
      { total: 7, pcts: [50, 50] },
    ];
    for (const { total, pcts } of cases) {
      const shares = percentageSplit(total, pcts);
      expect(shares).toHaveLength(pcts.length);
      expect(shares.reduce((s, x) => s + x, 0)).toBe(total);
    }
  });

  it("rejects non-integer total", () => {
    expect(() => percentageSplit(100.5, [50, 50])).toThrow();
  });

  it("rejects empty percentages", () => {
    expect(() => percentageSplit(100, [])).toThrow();
  });
});
