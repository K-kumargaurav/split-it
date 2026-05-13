"use client";

import { FadeIn, StaggerChildren } from "@/components/ui/motion";

interface Testimonial {
  initials: string;
  name: string;
  tag: string;
  quote: string;
}

const TESTIMONIALS: Testimonial[] = [
  {
    initials: "PS",
    name: "Priya S.",
    tag: "IIT Delhi",
    quote: "Finally an app that gets UPI right. No more WhatsApp math fights.",
  },
  {
    initials: "RM",
    name: "Rahul M.",
    tag: "Bangalore",
    quote: "Split our Goa trip expenses with zero drama. Everyone knew exactly what they owed.",
  },
  {
    initials: "AK",
    name: "Aditya K.",
    tag: "Mumbai",
    quote: "Even my non-techie friends could use the guest link. That's the real flex.",
  },
];

function Avatar({ initials }: { initials: string }) {
  return (
    <div
      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-accent/10 border border-accent/20"
      aria-hidden="true"
    >
      <span className="text-[12px] font-semibold text-accent">{initials}</span>
    </div>
  );
}

function TestimonialCard({ initials, name, tag, quote }: Testimonial) {
  return (
    <figure
      className="rounded-2xl bg-card border border-white/5 p-6 flex flex-col gap-4"
      role="article"
    >
      <blockquote>
        <p className="text-[14px] text-text-primary leading-relaxed">&ldquo;{quote}&rdquo;</p>
      </blockquote>
      <figcaption className="flex items-center gap-3 mt-auto">
        <Avatar initials={initials} />
        <div>
          <p className="text-[13px] font-semibold text-text-primary">{name}</p>
          <p className="text-[12px] text-text-secondary">{tag}</p>
        </div>
      </figcaption>
    </figure>
  );
}

export function LandingTestimonials() {
  return (
    <section className="bg-bg px-6 py-24 sm:py-32" aria-labelledby="testimonials-heading">
      <div className="mx-auto max-w-5xl">
        <FadeIn className="text-center mb-16">
          <p className="text-[12px] font-semibold text-accent uppercase tracking-widest mb-3">
            Loved by users
          </p>
          <h2
            id="testimonials-heading"
            className="text-[32px] sm:text-[36px] font-bold text-text-primary tracking-[-0.02em]"
          >
            Join students, flatmates, and
            <br className="hidden sm:block" /> travelers across India
          </h2>
        </FadeIn>

        <StaggerChildren className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {TESTIMONIALS.map((t) => (
            <TestimonialCard key={t.name} {...t} />
          ))}
        </StaggerChildren>
      </div>
    </section>
  );
}
