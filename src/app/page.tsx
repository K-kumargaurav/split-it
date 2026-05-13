import { auth } from "@/lib/auth";
import { LandingNavbar } from "@/components/landing/landing-navbar";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingFeatures } from "@/components/landing/landing-features";
import { LandingHow } from "@/components/landing/landing-how";
import { LandingTestimonials } from "@/components/landing/landing-testimonials";
import { LandingCta } from "@/components/landing/landing-cta";
import { LandingFooter } from "@/components/landing/landing-footer";

export default async function HomePage() {
  const session = await auth();
  const isAuthed = Boolean(session?.user);

  return (
    <div className="min-h-screen bg-bg text-text-primary overflow-x-hidden">
      <LandingNavbar isAuthed={isAuthed} />
      <main>
        <LandingHero isAuthed={isAuthed} />
        <LandingFeatures />
        <LandingHow />
        <LandingTestimonials />
        <LandingCta isAuthed={isAuthed} />
      </main>
      <LandingFooter />
    </div>
  );
}
