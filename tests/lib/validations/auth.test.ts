import {
  emailSchema,
  forgotPasswordSchema,
  loginSchema,
  passwordSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from "@/lib/validations/auth";

describe("passwordSchema", () => {
  it("accepts a strong password", () => {
    expect(passwordSchema.safeParse("Hunter22!").success).toBe(true);
  });

  it("rejects passwords shorter than 8 chars", () => {
    expect(passwordSchema.safeParse("Sh0rt!").success).toBe(false);
  });

  it("rejects passwords without an uppercase letter", () => {
    expect(passwordSchema.safeParse("hunter22!").success).toBe(false);
  });

  it("rejects passwords without a number", () => {
    expect(passwordSchema.safeParse("HunterTwo!").success).toBe(false);
  });

  it("rejects passwords longer than 128 chars (bcrypt DoS guard)", () => {
    expect(passwordSchema.safeParse(`A1${"x".repeat(127)}`).success).toBe(false);
  });
});

describe("emailSchema", () => {
  it("lowercases and trims", () => {
    const parsed = emailSchema.parse("  USER@Example.COM  ");
    expect(parsed).toBe("user@example.com");
  });

  it("rejects malformed addresses", () => {
    expect(emailSchema.safeParse("not-an-email").success).toBe(false);
  });

  it("rejects emails over 254 chars", () => {
    const local = "a".repeat(244);
    expect(emailSchema.safeParse(`${local}@example.com`).success).toBe(false);
  });
});

describe("registerSchema", () => {
  it("accepts a valid registration payload", () => {
    const result = registerSchema.safeParse({
      email: "user@example.com",
      password: "Hunter22!",
      displayName: "Asha",
    });
    expect(result.success).toBe(true);
  });

  it("rejects when displayName is empty after trim", () => {
    const result = registerSchema.safeParse({
      email: "user@example.com",
      password: "Hunter22!",
      displayName: "   ",
    });
    expect(result.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("does not enforce password complexity (only registration does)", () => {
    expect(
      loginSchema.safeParse({ email: "user@example.com", password: "weak" }).success,
    ).toBe(true);
  });
});

describe("forgotPasswordSchema / resetPasswordSchema / verifyEmailSchema", () => {
  it("forgotPasswordSchema requires a valid email", () => {
    expect(forgotPasswordSchema.safeParse({ email: "user@example.com" }).success).toBe(true);
    expect(forgotPasswordSchema.safeParse({ email: "nope" }).success).toBe(false);
  });

  it("resetPasswordSchema requires both fields and enforces password complexity", () => {
    expect(
      resetPasswordSchema.safeParse({ token: "t", password: "Hunter22!" }).success,
    ).toBe(true);
    expect(
      resetPasswordSchema.safeParse({ token: "t", password: "weak" }).success,
    ).toBe(false);
    expect(resetPasswordSchema.safeParse({ token: "", password: "Hunter22!" }).success).toBe(
      false,
    );
  });

  it("verifyEmailSchema requires a non-empty token", () => {
    expect(verifyEmailSchema.safeParse({ token: "abc" }).success).toBe(true);
    expect(verifyEmailSchema.safeParse({ token: "" }).success).toBe(false);
  });
});
