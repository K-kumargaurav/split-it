import { prisma } from "@/lib/prisma";
import { generateUniqueHandle } from "@/server/auth/handle";

interface OAuthProfile {
  email: string;
  name?: string | null;
  image?: string | null;
}

export interface UpsertedUser {
  id: string;
  handle: string;
  deletedAt: Date | null;
}

// Google guarantees verified emails on its OAuth response. Mark
// emailVerifiedAt on first sign-in (and backfill for accounts that registered
// via password but never verified, since Google's signal supersedes ours).
export async function upsertOAuthUser(profile: OAuthProfile): Promise<UpsertedUser> {
  const email = profile.email.toLowerCase();
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, handle: true, deletedAt: true, emailVerifiedAt: true },
  });
  if (existing) {
    if (!existing.emailVerifiedAt && !existing.deletedAt) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { emailVerifiedAt: new Date() },
      });
    }
    return {
      id: existing.id,
      handle: existing.handle,
      deletedAt: existing.deletedAt,
    };
  }
  return prisma.user.create({
    data: {
      email,
      displayName: profile.name?.trim() || email.split("@")[0],
      avatarUrl: profile.image ?? null,
      handle: await generateUniqueHandle(email),
      emailVerifiedAt: new Date(),
    },
    select: { id: true, handle: true, deletedAt: true },
  });
}
