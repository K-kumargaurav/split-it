import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { cachedJson, errorResponse } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// GET /api/v1/users/search?q=term&groupId=xxx
// Returns up to 10 users matching the query by handle or display name.
// Optionally excludes users already in a group (if groupId is provided).

export async function GET(request: Request): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("UNAUTHORIZED", "You must be signed in.", 401);
  }

  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").trim().toLowerCase();
  const groupId = searchParams.get("groupId");

  if (query.length < 2) {
    return cachedJson({ users: [] });
  }

  // Strip leading @ if user typed it
  const cleanQuery = query.replace(/^@/, "");

  // Find existing group member IDs to exclude
  let excludeUserIds: string[] = [];
  if (groupId) {
    const members = await prisma.groupMember.findMany({
      where: { groupId },
      select: { userId: true },
    });
    excludeUserIds = members.map((m) => m.userId);
  }

  const users = await prisma.user.findMany({
    where: {
      deletedAt: null,
      id: { notIn: excludeUserIds.length > 0 ? excludeUserIds : undefined },
      OR: [
        { handle: { contains: cleanQuery, mode: "insensitive" } },
        { displayName: { contains: cleanQuery, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      handle: true,
      displayName: true,
      avatarUrl: true,
    },
    take: 10,
    orderBy: { handle: "asc" },
  });

  return cachedJson({ users });
}
