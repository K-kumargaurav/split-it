import { NextResponse } from "next/server";
import sharp from "sharp";

import { auth } from "@/lib/auth";
import { errorFromThrown, errorResponse } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { getAvatarsBucket, getSupabaseStorageClient } from "@/lib/supabase-storage";
import { consumeRateLimit } from "@/server/auth/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

// Avatar upload pipeline. Mirrors receipt upload (SPEC §4.8) but lighter:
//   - JPEG / PNG / WebP only (no PDFs)
//   - 5MB cap (avatars are tiny)
//   - resized + cropped to 512x512 cover via sharp, stored as WebP
//   - signed URL written to user.avatarUrl

const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
const AVATAR_SIDE_PX = 512;
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 365 * 5; // 5 years — avatars are stable

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("UNAUTHORIZED", "You must be signed in.", 401);
  }

  // 5 uploads per minute per user — prevents DoS on sharp re-encode and
  // Supabase storage egress. Keyed on userId so one user can't exhaust
  // another's quota.
  if (!(await consumeRateLimit(`avatar:${session.user.id}`, { max: 5, windowMs: 60_000 }))) {
    return errorResponse("RATE_LIMITED", "Too many uploads. Please wait a minute.", 429);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse("VALIDATION_ERROR", "Invalid form data.", 400);
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return errorResponse("VALIDATION_ERROR", "Missing 'file' part.", 422);
  }
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return errorResponse(
      "VALIDATION_ERROR",
      "Avatar must be JPEG, PNG, or WebP.",
      422,
    );
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return errorResponse(
      "VALIDATION_ERROR",
      "Avatar exceeds 5MB limit.",
      422,
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const processed = await sharp(buffer)
      .resize(AVATAR_SIDE_PX, AVATAR_SIDE_PX, {
        fit: "cover",
        position: "centre",
      })
      .webp({ quality: 88 })
      .toBuffer();

    const supabase = getSupabaseStorageClient();
    const bucket = getAvatarsBucket();
    const path = `${session.user.id}/${Date.now()}.webp`;

    const upload = await supabase.storage
      .from(bucket)
      .upload(path, processed, {
        contentType: "image/webp",
        upsert: true,
      });
    if (upload.error) {
      console.error("avatar upload failed", upload.error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Failed to upload avatar.",
        500,
      );
    }

    const signed = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    if (signed.error || !signed.data?.signedUrl) {
      console.error("avatar signed URL failed", signed.error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Failed to issue avatar URL.",
        500,
      );
    }

    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: { avatarUrl: signed.data.signedUrl },
      select: { avatarUrl: true },
    });

    return NextResponse.json({ avatarUrl: updated.avatarUrl });
  } catch (err) {
    console.error("POST /users/me/avatar failed", err);
    return errorFromThrown(err);
  }
}
