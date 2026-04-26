"use server";

import { prisma } from "@/lib/prisma";
import { emailSchema } from "@/lib/validations/auth";

export interface CheckEmailResult {
  exists: boolean;
}

// Email-availability lookup used by the register form on blur. Per the spec:
//   • Returns { exists: false } for malformed input — we do NOT query the DB
//     in that case (cheap rejection, no info leak through query timing).
//   • Soft-deleted accounts (deletedAt set) are treated as "doesn't exist" so
//     a recycled email can be reclaimed.
//
// The route handler in src/app/api/v1/auth/check-email owns the per-IP rate
// limit (10/min, separate bucket from handle-check); keeping it there means
// this function can be called in tests / server actions without setting up
// request headers.
export async function checkEmailExists(email: string): Promise<CheckEmailResult> {
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) return { exists: false };

  const user = await prisma.user.findUnique({
    where: { email: parsed.data },
    select: { id: true, deletedAt: true },
  });
  return { exists: Boolean(user && !user.deletedAt) };
}
