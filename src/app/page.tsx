import Link from "next/link";

import { auth } from "@/lib/auth";

const FEATURES = [
  {
    title: "Track every rupee",
    body: "Add expenses with receipts, categories, and notes. Money is stored in paise — never a rounding error in sight.",
  },
  {
    title: "Split however you want",
    body: "Equal, exact amounts, or percentages. Mix payers and participants freely. Tax and tip get their own split rules.",
  },
  {
    title: "Settle up in one tap",
    body: "See who owes whom at a glance. Record cash, UPI, or card payments and watch balances go to zero instantly.",
  },
  {
    title: "Bring everyone in",
    body: "Invite friends by email or share a guest link — no account required to view a group bill.",
  },
];

const STATS = [
  { value: "0", label: "Hidden fees" },
  { value: "1-tap", label: "Settle up" },
  { value: "INR · USD · ₹", label: "Multi-currency" },
];

export default async function HomePage() {
  const session = await auth();
  const isAuthed = Boolean(session?.user);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold">
          <span
            aria-hidden="true"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white"
          >
            S
          </span>
          SplitEasy
        </Link>

        <nav className="flex items-center gap-3 text-sm font-medium">
          {isAuthed ? (
            <Link
              href="/dashboard"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-white transition hover:bg-indigo-500"
            >
              Go to dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-lg px-3 py-2 text-slate-700 transition hover:bg-slate-100"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-white shadow-sm transition hover:bg-indigo-500"
              >
                Get started
              </Link>
            </>
          )}
        </nav>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl"
          >
            <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-indigo-300 to-fuchsia-300 opacity-30 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]" />
          </div>

          <div className="mx-auto max-w-6xl px-6 pb-20 pt-16 sm:pt-24 lg:pt-32">
            <div className="mx-auto max-w-3xl text-center">
              <span className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-200">
                Made for groups, trips & households
              </span>
              <h1 className="mt-6 text-balance text-4xl font-semibold tracking-tight text-slate-900 sm:text-6xl">
                Split bills with friends, <span className="text-indigo-600">the easy way</span>.
              </h1>
              <p className="mt-6 text-balance text-lg leading-8 text-slate-600">
                Track shared expenses, settle up in one tap, and never argue over who owes whom again. SplitEasy keeps the math
                exact down to the paise — and the receipts safe in one place.
              </p>
              <div className="mt-10 flex items-center justify-center gap-4">
                {isAuthed ? (
                  <Link
                    href="/dashboard"
                    className="rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                  >
                    Open your dashboard
                  </Link>
                ) : (
                  <>
                    <Link
                      href="/login"
                      className="rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                    >
                      Sign in
                    </Link>
                    <Link
                      href="/register"
                      className="rounded-lg bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                    >
                      Create an account
                    </Link>
                  </>
                )}
              </div>
            </div>

            <dl className="mx-auto mt-20 grid max-w-4xl grid-cols-1 gap-px overflow-hidden rounded-2xl bg-slate-200 text-center sm:grid-cols-3">
              {STATS.map((stat) => (
                <div key={stat.label} className="bg-white p-6">
                  <dt className="text-sm font-medium text-slate-500">{stat.label}</dt>
                  <dd className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{stat.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-base font-semibold text-indigo-600">Everything you need</h2>
            <p className="mt-2 text-balance text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              Built for the messy reality of shared money
            </p>
          </div>

          <ul className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-2">
            {FEATURES.map((feature) => (
              <li
                key={feature.title}
                className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 transition hover:shadow-md"
              >
                <h3 className="text-base font-semibold text-slate-900">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{feature.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-24">
          <div className="rounded-3xl bg-slate-900 px-8 py-16 text-center sm:px-16">
            <h2 className="text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Ready to settle up faster?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-balance text-base leading-7 text-slate-300">
              Sign in with Google, email, or phone — your data stays yours, and you can export everything at any time.
            </p>
            <div className="mt-8 flex items-center justify-center gap-4">
              <Link
                href={isAuthed ? "/dashboard" : "/login"}
                className="rounded-lg bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-slate-900"
              >
                {isAuthed ? "Open dashboard" : "Sign in"}
              </Link>
              {!isAuthed ? (
                <Link
                  href="/register"
                  className="text-sm font-semibold text-white transition hover:text-slate-200"
                >
                  Create account <span aria-hidden="true">→</span>
                </Link>
              ) : null}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-6 text-sm text-slate-500 sm:flex-row">
          <p>© {new Date().getFullYear()} SplitEasy. Money math, simplified.</p>
          <p>Built with Next.js, Prisma & Tailwind.</p>
        </div>
      </footer>
    </div>
  );
}
