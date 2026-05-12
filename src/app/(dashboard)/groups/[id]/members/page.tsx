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
    <div>
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#F5F7FA] sm:text-3xl">
            Members
          </h1>
          <p className="mt-1 text-sm text-[#8B93A7]">
            {members.length} {members.length === 1 ? "member" : "members"} in {group.name}
          </p>
        </div>
        <InviteButton groupId={group.id} />
      </header>

      <section
        aria-labelledby="members-heading"
        className="rounded-2xl border border-white/[0.06] bg-[#161B22] p-6 sm:p-8"
      >
        <h2 id="members-heading" className="sr-only">
          Members list
        </h2>
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
        className="mt-6 rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.02] p-6 sm:p-8"
      >
        <h2 id="add-guest-heading" className="text-sm font-semibold text-[#F5F7FA]">
          Splitting with someone who doesn&apos;t use SplitEasy?
        </h2>
        <p className="mt-1 text-sm text-[#8B93A7]">
          Add them as a guest. They&apos;ll get a private link to see their balance and pay
          you back — no signup needed.
        </p>
        <div className="mt-4">
          <AddGuestForm groupId={group.id} />
        </div>
      </section>

      {!isOwner ? (
        <div className="mt-6 flex justify-end">
          <LeaveGroupButton groupId={group.id} userId={session.user.id} />
        </div>
      ) : null}
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
    <li className="flex items-center gap-3 py-3">
      <span
        aria-hidden="true"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white"
      >
        {initial}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[#F5F7FA]">
          {ghost.displayName}
          <span className="ml-2 rounded-full bg-[#FFB020]/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[#FFB020]">
            Guest
          </span>
        </p>
        <p className="truncate text-xs text-[#8B93A7]">
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
    <li className="flex items-center gap-3 py-3">
      {member.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={member.avatarUrl}
          alt=""
          className="h-9 w-9 rounded-full object-cover ring-1 ring-white/10"
        />
      ) : (
        <span
          aria-hidden="true"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white"
        >
          {initial}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[#F5F7FA]">
          {member.displayName}
          {isYou ? <span className="ml-1 text-xs text-[#8B93A7]">(you)</span> : null}
        </p>
        <p className="truncate text-xs text-[#8B93A7]">
          @{member.handle} · joined {formatDate(member.joinedAt)}
        </p>
      </div>
      {isOwnerRow ? (
        <span className="rounded-full bg-[#00C896]/10 px-2 py-0.5 text-xs font-medium text-[#00C896]">
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
