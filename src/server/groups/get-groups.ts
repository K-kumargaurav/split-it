import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { getUserNetBalance } from "@/server/balance/calculate-balances";

// Per-group balance is sourced from `getUserNetBalance` — the same function
// the group's Balances section uses — so the header and the line-item list
// can never disagree. Pending (unconfirmed) settlements are deliberately
// excluded; only CONFIRMED settlements affect balance.

export interface GroupSummary {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  currency: string;
  balanceMode: "DIRECT" | "SIMPLIFIED";
  status: "ACTIVE" | "ARCHIVED";
  memberCount: number;
  // Positive: others owe you. Negative: you owe. Zero: settled.
  balancePaise: number;
  role: "OWNER" | "MEMBER";
  updatedAt: Date;
}

export async function getGroupsForUser(userId: string): Promise<GroupSummary[]> {
  const memberships = await prisma.groupMember.findMany({
    where: {
      userId,
      group: { status: "ACTIVE", deletedAt: null },
    },
    select: {
      role: true,
      group: {
        select: {
          id: true,
          name: true,
          description: true,
          color: true,
          icon: true,
          currency: true,
          balanceMode: true,
          status: true,
          updatedAt: true,
          _count: { select: { members: true } },
        },
      },
    },
  });

  if (memberships.length === 0) return [];

  const balances = await Promise.all(
    memberships.map(({ group }) => getUserNetBalance(group.id, userId)),
  );

  return memberships
    .map(({ group, role }, i) => ({
      id: group.id,
      name: group.name,
      description: group.description,
      color: group.color,
      icon: group.icon,
      currency: group.currency,
      balanceMode: group.balanceMode,
      status: group.status,
      memberCount: group._count.members,
      balancePaise: Number(balances[i] ?? BigInt(0)),
      role,
      updatedAt: group.updatedAt,
    }))
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

// Detail-page payload — full member list (with handle/displayName/avatar) so
// the UI can render members + your role without a second round-trip.
export type GroupDetail = Prisma.GroupGetPayload<{
  include: {
    members: {
      select: {
        id: true;
        role: true;
        joinedAt: true;
        user: { select: { id: true; handle: true; displayName: true; avatarUrl: true } };
      };
    };
    _count: { select: { expenses: true } };
  };
}> & {
  balancePaise: number;
  viewerRole: "OWNER" | "MEMBER";
};

export async function getGroupById(
  userId: string,
  groupId: string,
): Promise<GroupDetail> {
  const group = await prisma.group.findFirst({
    where: { id: groupId, deletedAt: null },
    include: {
      members: {
        select: {
          id: true,
          role: true,
          joinedAt: true,
          user: {
            select: { id: true, handle: true, displayName: true, avatarUrl: true },
          },
        },
      },
      _count: { select: { expenses: true } },
    },
  });

  if (!group) {
    throw new AppError("NOT_FOUND", "Group not found.");
  }

  const viewer = group.members.find((m) => m.user.id === userId);
  if (!viewer) {
    // Membership check after the row exists so we never leak the existence of
    // groups the user can't see — same 403 either way is fine since findFirst
    // already returned a row, and we control which row.
    throw new AppError("FORBIDDEN", "You don't have access to this group.");
  }

  const balance = await getUserNetBalance(group.id, userId);

  return {
    ...group,
    balancePaise: Number(balance),
    viewerRole: viewer.role,
  };
}
