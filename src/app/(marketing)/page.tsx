export default function LandingPage() {
  return (
    <section className="bg-ink">
      <div className="mx-auto max-w-3xl px-8 py-30 text-center">
        <div className="mb-6 font-serif text-lg text-accent italic">
          On-demand hiring, made instant
        </div>
        <h1 className="mb-6 font-serif text-5xl leading-[1.1] font-medium tracking-tight text-cream sm:text-6xl">
          Get hired today.
          <br />
          <span className="italic">Hire in minutes.</span>
        </h1>
        <p className="mx-auto mb-10 max-w-lg text-lg leading-relaxed text-cream/68">
          HanapHire connects gig and hourly workers with businesses that need
          them right now — same-day shifts, verified profiles, and instant
          applications.
        </p>
        <p className="text-sm text-cream/50">
          The full landing page (hero widget, listings, testimonials) lands
          in checkpoint 2 — this placeholder confirms the marketing shell,
          fonts, and nav overlay are wired up correctly.
        </p>
      </div>
    </section>
  );
}
