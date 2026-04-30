import { paiseToRupees, rupeesToPaise } from "@/lib/format";

describe("rupeesToPaise", () => {
  it("handles whole-rupee strings", () => {
    expect(rupeesToPaise("7999")).toBe(BigInt(799900));
  });

  it("handles two-decimal strings", () => {
    expect(rupeesToPaise("7999.50")).toBe(BigInt(799950));
  });

  it("preserves a single paisa", () => {
    expect(rupeesToPaise("0.01")).toBe(BigInt(1));
  });

  it("treats one decimal place as tenths-of-rupees, not hundredths", () => {
    expect(rupeesToPaise("100.9")).toBe(BigInt(10090));
  });

  it("survives values floating-point would corrupt", () => {
    // 0.1 + 0.2 territory — `7999.5 * 100` in IEEE-754 ≠ 799950 reliably.
    expect(rupeesToPaise("7999.50")).toBe(BigInt(799950));
    expect(rupeesToPaise("0.1")).toBe(BigInt(10));
    expect(rupeesToPaise("0.2")).toBe(BigInt(20));
    expect(rupeesToPaise("0.3")).toBe(BigInt(30));
  });

  it("handles a leading zero on the whole part", () => {
    expect(rupeesToPaise("0.99")).toBe(BigInt(99));
    expect(rupeesToPaise("0")).toBe(BigInt(0));
    expect(rupeesToPaise("0.00")).toBe(BigInt(0));
  });

  it("trims surrounding whitespace", () => {
    expect(rupeesToPaise("  1234.56  ")).toBe(BigInt(123456));
  });

  it("supports negative amounts", () => {
    expect(rupeesToPaise("-25.50")).toBe(BigInt(-2550));
  });

  it("rejects non-string inputs", () => {
    // @ts-expect-error — guarding against accidental number callers.
    expect(() => rupeesToPaise(7999.5)).toThrow();
  });

  it("rejects malformed strings", () => {
    expect(() => rupeesToPaise("abc")).toThrow();
    expect(() => rupeesToPaise("1.2.3")).toThrow();
    expect(() => rupeesToPaise("")).toThrow();
    expect(() => rupeesToPaise(".5")).toThrow();
  });
});

describe("paiseToRupees", () => {
  it("inverts rupeesToPaise for representable values", () => {
    expect(paiseToRupees(rupeesToPaise("1234.56"))).toBeCloseTo(1234.56, 2);
  });
});
