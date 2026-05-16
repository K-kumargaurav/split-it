import Image from "next/image";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { AddGuestForm } from "@/components/groups/add-guest-form";
import {
  InviteButton,
  LeaveGroupButton,
  RemoveMemberButton,
} from "@/components/groups/members-page-actions";
import { getGroupById, type GroupDetail } from "@/server/groups/get-groups";
import { getGroupMembers, type MemberRow } from "@/server/groups/manage-members";

interface MembersPageProps {
  params: { id: string };
}

export default async function MembersPage({ params }: MembersPageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  let group: GroupDetail;
  try {
    group = await getGroupById(session.user.id, params.id);
  } catch (err) {
    if (err instanceof AppError && (err.code === "NOT_FOUND" || err.code === "FORBIDDEN")) {
      notFound();
    }
    throw err;
  }

  const { members, viewerRole } = await getGroupMembers(session.user.id, params.id);
  const ghosts = await prisma.ghostMember.findMany({
    where: { groupId: params.id, status: "ACTIVE" },
    select: {
      id: true,
      displayName: true,
      email: true,
      phone: true,
      guestToken: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });
  const isOwner = viewerRole === "OWNER";

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[24px] font-bold tracking-[-0.02em] text-text-primary">
              Members
            </h1>
            <p className="mt-1.5 text-[14px] text-text-secondary">
              {members.length} {members.length === 1 ? "member" : "members"} in {group.name}
            </p>
          </div>
          <InviteButton groupId={group.id} />
        </div>
      </header>

      <div className="space-y-4">
        <section
          aria-labelledby="members-heading"
          className="rounded-3xl border border-white/5 bg-card p-6 shadow-card sm:p-8"
        >
          <header className="mb-5 border-b border-white/[0.05] pb-4">
            <h2
              id="members-heading"
              className="text-[16px] font-semibold tracking-[-0.01em] text-text-primary"
            >
              Group members
            </h2>
            <p className="mt-1 text-[13px] text-text-secondary">
              People who can view and add expenses.
            </p>
          </header>
          <ul className="divide-y divide-white/[0.04]">
            {members.map((m) => (
              <MemberRowItem
                key={m.userId}
                member={m}
                groupId={group.id}
                viewerId={session.user.id}
                viewerIsOwner={isOwner}
              />
            ))}
            {ghosts.map((g) => (
              <GhostMemberRow key={g.id} ghost={g} />
            ))}
          </ul>
        </section>

        <section
          aria-labelledby="add-guest-heading"
          className="rounded-3xl border border-dashed border-white/[0.08] bg-card p-6 shadow-card sm:p-8"
        >
          <header className="mb-5 border-b border-white/[0.05] pb-4">
            <h2
              id="add-guest-heading"
              className="text-[16px] font-semibold tracking-[-0.01em] text-text-primary"
            >
              Add a guest
            </h2>
            <p className="mt-1 text-[13px] text-text-secondary">
              Splitting with someone who doesn&apos;t use SplitEasy? Add them as a guest
              — they&apos;ll get a private link to see their balance.
            </p>
          </header>
          <AddGuestForm groupId={group.id} />
        </section>

        {!isOwner ? (
          <section className="rounded-3xl border border-error/20 bg-error/5 p-6 shadow-card sm:p-8">
            <header className="mb-4">
              <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-error">
                Leave group
              </h2>
              <p className="mt-1 text-[13px] text-error/60">
                You&apos;ll lose access until someone re-invites you.
              </p>
            </header>
            <LeaveGroupButton groupId={group.id} userId={session.user.id} />
          </section>
        ) : null}
      </div>
    </div>
  );
}

function GhostMemberRow({
  ghost,
}: {
  ghost: { id: string; displayName: string; email: string | null; phone: string | null; guestToken: string; createdAt: Date };
}): React.ReactElement {
  const initial = (ghost.displayName[0] ?? "?").toUpperCase();
  return (
    <li className="group flex items-center gap-3.5 rounded-2xl px-2 py-3 transition hover:bg-surface-hover">
      <span
        aria-hidden="true"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warning/10 text-sm font-bold text-warning"
      >
        {initial}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 truncate text-[14px] font-medium text-text-primary">
          {ghost.displayName}
          <span className="inline-flex items-center rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-warning">
            Guest
          </span>
        </p>
        <p className="mt-0.5 truncate text-[13px] text-text-secondary">
          {ghost.email ?? ghost.phone ?? "No contact info"} · added{" "}
          {formatDate(ghost.createdAt)}
        </p>
      </div>
    </li>
  );
}

function MemberRowItem({
  member,
  groupId,
  viewerId,
  viewerIsOwner,
}: {
  member: MemberRow;
  groupId: string;
  viewerId: string;
  viewerIsOwner: boolean;
}): React.ReactElement {
  const initial = (
    member.displayName[0] ??
    member.handle[0] ??
    "?"
  ).toUpperCase();
  const isYou = member.userId === viewerId;
  const isOwnerRow = member.role === "OWNER";

  return (
    <li className="group flex items-center gap-3.5 rounded-2xl px-2 py-3 transition hover:bg-surface-hover">
      {member.avatarUrl ? (
        <Image
          src={member.avatarUrl}
          alt=""
          width={40}
          height={40}
          className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-white/10"
        />
      ) : (
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-sm font-bold text-accent"
        >
          {initial}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-[14px] font-medium text-text-primary">
          {member.displayName}
          {isYou ? (
            <span className="text-[12px] font-normal text-text-secondary">(you)</span>
          ) : null}
        </p>
        <p className="mt-0.5 truncate text-[13px] text-text-secondary">
          @{member.handle} · joined {formatDate(member.joinedAt)}
        </p>
      </div>
      {isOwnerRow ? (
        <span className="rounded-full bg-accent/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-accent">
          Owner
        </span>
      ) : null}
      {viewerIsOwner && !isOwnerRow && !isYou ? (
        <RemoveMemberButton
          groupId={groupId}
          userId={member.userId}
          displayName={member.displayName}
        />
      ) : null}
    </li>
  );
}
