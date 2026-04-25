import {
  __testing,
  clearRateLimit,
  consumeRateLimit,
  getClientIp,
} from "@/server/auth/rate-limit";

beforeEach(() => {
  __testing.reset();
});

describe("consumeRateLimit", () => {
  it("allows up to MAX_ATTEMPTS within the window then blocks further attempts", () => {
    const key = "login:user@example.com:1.2.3.4";
    for (let i = 0; i < __testing.MAX_ATTEMPTS; i += 1) {
      expect(consumeRateLimit(key)).toBe(true);
    }
    expect(consumeRateLimit(key)).toBe(false);
    expect(consumeRateLimit(key)).toBe(false);
  });

  it("treats different keys independently", () => {
    const a = "login:a@example.com:1.2.3.4";
    const b = "login:b@example.com:1.2.3.4";
    for (let i = 0; i < __testing.MAX_ATTEMPTS; i += 1) consumeRateLimit(a);
    expect(consumeRateLimit(a)).toBe(false);
    expect(consumeRateLimit(b)).toBe(true);
  });

  it("resets after the window elapses", () => {
    jest.useFakeTimers();
    try {
      const key = "login:user@example.com:1.2.3.4";
      for (let i = 0; i < __testing.MAX_ATTEMPTS; i += 1) consumeRateLimit(key);
      expect(consumeRateLimit(key)).toBe(false);
      jest.advanceTimersByTime(__testing.WINDOW_MS + 1);
      expect(consumeRateLimit(key)).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe("clearRateLimit", () => {
  it("frees the bucket so the next attempt is fresh", () => {
    const key = "login:user@example.com:1.2.3.4";
    for (let i = 0; i < __testing.MAX_ATTEMPTS; i += 1) consumeRateLimit(key);
    expect(consumeRateLimit(key)).toBe(false);
    clearRateLimit(key);
    expect(consumeRateLimit(key)).toBe(true);
  });
});

describe("getClientIp", () => {
  function makeRequest(headers: Record<string, string>): Request {
    return new Request("https://example.com/", { headers });
  }

  it("returns the first hop from x-forwarded-for", () => {
    const req = makeRequest({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" });
    expect(getClientIp(req)).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    const req = makeRequest({ "x-real-ip": "203.0.113.7" });
    expect(getClientIp(req)).toBe("203.0.113.7");
  });

  it("returns 'unknown' when no proxy headers are set", () => {
    expect(getClientIp(makeRequest({}))).toBe("unknown");
  });

  it("returns 'unknown' when request is undefined", () => {
    expect(getClientIp(undefined)).toBe("unknown");
  });
});
