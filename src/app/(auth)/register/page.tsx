import Link from "next/link";

import { AuthLayout } from "@/components/auth/auth-layout";
import { RegisterForm } from "@/components/forms/register-form";

export default function RegisterPage() {
  return (
    <AuthLayout>
      <div className="space-y-6">
        <header>
          <h1 className="text-[28px] font-bold leading-tight text-text-primary">
            Create your account
          </h1>
          <p className="mt-1.5 text-sm text-text-secondary">
            Already have one?{" "}
            <Link
              href="/login"
              className="font-medium text-accent hover:opacity-80 transition-opacity"
            >
              Sign in
            </Link>
            .
          </p>
        </header>

        <RegisterForm />

        <p className="text-center text-xs text-text-secondary">
          By creating an account you agree to SplitEasy&apos;s{" "}
          <Link href="/terms" className="underline hover:text-text-primary transition-colors">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline hover:text-text-primary transition-colors">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </AuthLayout>
  );
}
