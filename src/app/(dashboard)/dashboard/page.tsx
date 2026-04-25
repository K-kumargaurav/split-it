import { auth, signOut } from "@/lib/auth";

export default async function DashboardPage() {
  const session = await auth();

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="mt-2 text-sm text-slate-500">
          You&apos;re signed in. This is a placeholder dashboard for testing the auth flow.
        </p>

        <dl className="mt-6 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-medium text-slate-700">User ID</dt>
            <dd className="mt-1 break-all font-mono text-xs text-slate-500">{session?.user?.id ?? "—"}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-700">Handle</dt>
            <dd className="mt-1 text-slate-500">@{session?.user?.handle ?? "—"}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-700">Name</dt>
            <dd className="mt-1 text-slate-500">{session?.user?.name ?? "—"}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-700">Email</dt>
            <dd className="mt-1 text-slate-500">{session?.user?.email ?? "—"}</dd>
          </div>
        </dl>

        <form
          className="mt-8"
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button
            type="submit"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
