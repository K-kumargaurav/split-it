import { dummyVerifyPassword, hashPassword, verifyPassword } from "@/server/auth/password";

describe("hashPassword", () => {
  it("returns a bcrypt hash with salt rounds 12", async () => {
    const hash = await hashPassword("Sup3rSecret!");
    expect(hash).toMatch(/^\$2[aby]\$12\$/);
    expect(hash).not.toBe("Sup3rSecret!");
  });

  it("produces different hashes for the same input on repeated calls", async () => {
    const a = await hashPassword("same-input");
    const b = await hashPassword("same-input");
    expect(a).not.toBe(b);
  });
});

describe("verifyPassword", () => {
  it("returns true when the plaintext matches the hash", async () => {
    const hash = await hashPassword("hunter2");
    await expect(verifyPassword("hunter2", hash)).resolves.toBe(true);
  });

  it("returns false when the plaintext does not match the hash", async () => {
    const hash = await hashPassword("hunter2");
    await expect(verifyPassword("hunter3", hash)).resolves.toBe(false);
  });

  it("returns false against an unrelated hash", async () => {
    const otherHash = await hashPassword("other-password");
    await expect(verifyPassword("hunter2", otherHash)).resolves.toBe(false);
  });
});

describe("dummyVerifyPassword", () => {
  it("resolves without throwing — used to keep auth timing constant when user is missing", async () => {
    await expect(dummyVerifyPassword("anything")).resolves.toBeUndefined();
  });

  it("takes a similar amount of time as a real verifyPassword (within an order of magnitude)", async () => {
    const realHash = await hashPassword("calibration");
    const t0 = Date.now();
    await verifyPassword("calibration", realHash);
    const realMs = Date.now() - t0;

    const t1 = Date.now();
    await dummyVerifyPassword("anything");
    const dummyMs = Date.now() - t1;

    // Both should run a full bcrypt compare at cost 12. Allow generous slack
    // for CI noise; the goal is just to confirm the dummy path isn't a no-op.
    expect(dummyMs).toBeGreaterThan(realMs / 10);
  });
});
