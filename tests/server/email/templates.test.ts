import {
  renderPasswordResetEmail,
  renderVerificationEmail,
} from "@/server/email/templates";

describe("renderVerificationEmail", () => {
  it("includes the URL and display name in both text and html", () => {
    const out = renderVerificationEmail({
      verifyUrl: "https://app.test/verify-email?token=abc",
      displayName: "Asha",
    });
    expect(out.subject).toMatch(/verify/i);
    expect(out.text).toContain("https://app.test/verify-email?token=abc");
    expect(out.text).toContain("Asha");
    expect(out.html).toContain("https://app.test/verify-email?token=abc");
    expect(out.html).toContain("Asha");
  });

  it("escapes html-unsafe characters in the display name", () => {
    const out = renderVerificationEmail({
      verifyUrl: "https://app.test/verify-email?token=abc",
      displayName: '<script>alert("x")</script>',
    });
    expect(out.html).not.toContain("<script>");
    expect(out.html).toContain("&lt;script&gt;");
  });
});

describe("renderPasswordResetEmail", () => {
  it("includes the reset URL and uses a 1-hour expiry copy", () => {
    const out = renderPasswordResetEmail({
      resetUrl: "https://app.test/reset-password?token=xyz",
      displayName: "Asha",
    });
    expect(out.subject).toMatch(/reset/i);
    expect(out.text).toContain("https://app.test/reset-password?token=xyz");
    expect(out.html).toContain("https://app.test/reset-password?token=xyz");
    expect(out.text).toMatch(/1 hour/i);
  });
});
