import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
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
    <DashboardShell
      user={{
        name: session.user.name ?? null,
        email: session.user.email ?? null,
        handle: session.user.handle,
        image: session.user.image ?? null,
      }}
    >
      <nav className="mb-6 text-sm">
        <Link href={`/groups/${group.id}`} className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
          ← Back to {group.name}
        </Link>
      </nav>

      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            Members
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {members.length} {members.length === 1 ? "member" : "members"} in {group.name}
          </p>
        </div>
        <InviteButton groupId={group.id} />
      </header>

      <section
        aria-labelledby="members-heading"
        className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm sm:p-8"
      >
        <h2 id="members-heading" className="sr-only">
          Members list
        </h2>
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
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
        className="mt-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-6 sm:p-8"
      >
        <h2 id="add-guest-heading" className="text-sm font-semibold text-slate-900 dark:text-white">
          Splitting with someone who doesn&apos;t use SplitEasy?
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
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
    </DashboardShell>
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
        className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-300 text-sm font-semibold text-white"
      >
        {initial}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
          {ghost.displayName}
          <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-700">
            Guest
          </span>
        </p>
        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
          {ghost.email ?? ghost.phone ?? "No contact info"} · added{" "}
          {ghost.createdAt.toLocaleDateString("en-IN")}
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
          className="h-9 w-9 rounded-full object-cover ring-1 ring-slate-200 dark:ring-slate-700"
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
        <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
          {member.displayName}
          {isYou ? <span className="ml-1 text-xs text-slate-400">(you)</span> : null}
        </p>
        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
          @{member.handle} · joined {member.joinedAt.toLocaleDateString("en-IN")}
        </p>
      </div>
      {isOwnerRow ? (
        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
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
