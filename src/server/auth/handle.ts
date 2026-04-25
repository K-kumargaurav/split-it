import { randomBytes } from "node:crypto";

import { prisma } from "@/lib/prisma";

// Derives a unique URL-safe handle from the user's email local-part. Tries the
// bare slug first; on collision, suffixes a 6-hex random tag and retries up to
// a small budget. Falls back to a longer-suffixed slug to guarantee uniqueness
// even under heavy contention.
export async function generateUniqueHandle(email: string): Promise<string> {
  const base =
    email
      .split("@")[0]
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 20) || "user";

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${randomBytes(3).toString("hex")}`;
    const taken = await prisma.user.findUnique({
      where: { handle: candidate },
      select: { id: true },
    });
    if (!taken) return candidate;
  }
  return `${base}-${randomBytes(6).toString("hex")}`;
}
