import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
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
        <Link href={`/groups/${group.id}`} className="text-slate-500 hover:text-slate-700">
          ← Back to {group.name}
        </Link>
      </nav>

      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Members
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {members.length} {members.length === 1 ? "member" : "members"} in {group.name}
          </p>
        </div>
        <InviteButton groupId={group.id} />
      </header>

      <section
        aria-labelledby="members-heading"
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
      >
        <h2 id="members-heading" className="sr-only">
          Members list
        </h2>
        <ul className="divide-y divide-slate-100">
          {members.map((m) => (
            <MemberRowItem
              key={m.userId}
              member={m}
              groupId={group.id}
              viewerId={session.user.id}
              viewerIsOwner={isOwner}
            />
          ))}
        </ul>
      </section>

      {!isOwner ? (
        <div className="mt-6 flex justify-end">
          <LeaveGroupButton groupId={group.id} userId={session.user.id} />
        </div>
      ) : null}
    </DashboardShell>
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
          className="h-9 w-9 rounded-full object-cover ring-1 ring-slate-200"
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
        <p className="truncate text-sm font-medium text-slate-900">
          {member.displayName}
          {isYou ? <span className="ml-1 text-xs text-slate-400">(you)</span> : null}
        </p>
        <p className="truncate text-xs text-slate-500">
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
