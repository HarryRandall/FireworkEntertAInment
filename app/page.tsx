import Link from "next/link";

export default function Home() {
  return (
    <>
      {/* Nav */}
      <nav className="bg-background text-sm font-medium fixed top-0 w-full z-50">
        <div className="flex justify-between items-center h-16 px-6 lg:px-12 max-w-[1200px] mx-auto">
          <Link
            href="/"
            className="text-xl font-semibold tracking-tighter text-primary"
          >
            ShowCrafter
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="#"
              className="text-on-surface-variant hover:text-primary transition-colors px-4 py-2 hover:bg-surface-variant/50 rounded-full duration-300"
            >
              Login
            </Link>
            <Link
              href="#"
              className="bg-primary-container text-on-primary-container px-6 py-2 rounded-full font-semibold hover:brightness-110 transition-all active:scale-95 inline-block"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      <main className="pt-16">
        {/* Hero */}
        <section className="relative min-h-[921px] flex flex-col items-center justify-center px-6 text-center bg-surface overflow-hidden">
          <div className="absolute inset-0 z-0 opacity-20">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/20 rounded-full blur-[120px]" />
          </div>
          <div className="relative z-10 max-w-4xl mx-auto space-y-8">
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight text-on-surface">
              Design your own{" "}
              <span className="text-primary">fireworks show.</span>
            </h1>
            <p className="text-lg md:text-xl text-on-surface-variant max-w-2xl mx-auto leading-relaxed">
              Pick a song, set a budget, and let AI choreograph the rest —
              using real products from your local store.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-4">
              <Link
                href="#"
                className="bg-primary-container text-on-primary-container px-10 py-4 rounded-full text-lg font-bold shadow-2xl hover:brightness-110 transition-all active:scale-95 inline-block"
              >
                Create a Show
              </Link>
              <Link
                href="#how-it-works"
                className="text-primary border border-outline/20 px-10 py-4 rounded-full text-lg font-medium hover:bg-surface-container-highest/30 transition-all flex items-center gap-2"
              >
                See how it works
                <span className="material-symbols-outlined">play_circle</span>
              </Link>
            </div>
          </div>

          {/* Decorative hero image */}
          <div className="mt-20 w-full max-w-5xl aspect-video rounded-xl bg-surface-container-low border border-outline-variant/15 overflow-hidden shadow-2xl relative">
            <div className="absolute inset-0 bg-gradient-to-t from-surface to-transparent" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="w-full h-full object-cover opacity-60"
              alt="Cinematic long exposure of colorful fireworks against night sky"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCV3GeixhWhXsweRzZPSZEOF9694HlgBguwnT3bJt5OrabCyX01ONVLqHoae-c3PTmGgYINDD8xRA5D_6nQLaY_fUHwGEEJ6R1nws9gieCjzR12DoG-8xyZISTF6ly7OHt00thNq2s-zNhSsKwnh4bw_kAjxwDx08o9QweFLQ7l0CGvilpy-1ZPP2tQq6L18K_8pTC0QRWeNtJsJH1D97T-PksB6tpuip0p6I05QeZnLE1l9cfZ1s8giePORf5o7--dHNppG1FOa-4"
            />
            <div className="absolute bottom-8 left-8 right-8 flex justify-between items-end">
              <div className="space-y-2">
                <div className="text-xs uppercase tracking-widest text-primary font-bold">
                  Live Preview
                </div>
                <div className="text-2xl font-medium">
                  Midnight Symphony 04
                </div>
              </div>
              <div className="h-12 w-48 bg-surface-container-high/80 backdrop-blur-md rounded-lg border border-outline-variant/10 flex items-center px-4 gap-3">
                <div className="w-full h-1 bg-surface-container-highest rounded-full overflow-hidden">
                  <div className="w-2/3 h-full bg-tertiary" />
                </div>
                <span className="text-[10px] font-mono text-tertiary">
                  02:44
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="py-32 px-6 bg-surface-container-low">
          <div className="max-w-[1200px] mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-4">
              <div className="space-y-4">
                <h2 className="text-3xl md:text-5xl font-bold text-on-surface">
                  How It Works
                </h2>
                <p className="text-on-surface-variant max-w-md">
                  Professional choreography simplified into three precise steps.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                {
                  icon: "music_note",
                  title: "Choose song",
                  desc: "Upload any track or link your Spotify. Our AI analyzes the BPM and frequency for perfect timing.",
                },
                {
                  icon: "tune",
                  title: "Set preferences",
                  desc: "Define your budget and select your preferred firework vendors. We match designs to what you can actually buy.",
                },
                {
                  icon: "auto_awesome",
                  title: "Get show",
                  desc: "Instantly receive a full 3D visual preview, a firing script, and a shopping list for your exact location.",
                },
              ].map((step) => (
                <div
                  key={step.title}
                  className="p-8 rounded-xl bg-surface-container-highest/40 border border-outline-variant/5 hover:border-outline-variant/20 transition-all group"
                >
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-8 group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined">
                      {step.icon}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold mb-4">{step.title}</h3>
                  <p className="text-on-surface-variant leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Feature Highlights */}
        <section className="py-32 px-6 bg-surface">
          <div className="max-w-[1200px] mx-auto space-y-24">
            {/* Rhythm Engine */}
            <div className="flex flex-col md:flex-row items-center gap-12 lg:gap-24">
              <div className="flex-1 space-y-6">
                <div className="text-primary text-sm font-bold tracking-[0.2em] uppercase">
                  Rhythm Engine
                </div>
                <h3 className="text-4xl md:text-5xl font-bold leading-tight">
                  Synced to the beat.
                </h3>
                <p className="text-lg text-on-surface-variant leading-relaxed">
                  Every shell is calculated for its lift-time, ensuring the
                  burst happens exactly on the snare hit. Our engine handles
                  the physics so you can focus on the art.
                </p>
              </div>
              <div className="flex-1 w-full aspect-square rounded-xl bg-surface-container overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="w-full h-full object-cover"
                  alt="Digital waveform overlaying an explosion of golden fireworks"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuAW7ZjHrPAN3sw0aUMjQwcuqC8H5qqwzQEkkjkCrBQPr1mBjWTxv-20sFn4HBbWFU3WH5-BCX48Cj-ZabRzvSxB5outhd0G30NHwudfM9JIqN75xRl2ftJUolKuC3m65oR1-gnp7Xeedd7DI-InsRFXcvrtA7ss7b0tG9s9g4SijDO_3k95S7klc_VTnUnhuS6VPfGq3IZHytzyGRwzA4WLaeDP4k2w04xZ5FgjZkptoPhsYAO0WVHf08GDDzjh1ygAwSJ7MzCOWaY"
                />
              </div>
            </div>

            {/* Inventory Intel */}
            <div className="flex flex-col md:flex-row-reverse items-center gap-12 lg:gap-24">
              <div className="flex-1 space-y-6">
                <div className="text-primary text-sm font-bold tracking-[0.2em] uppercase">
                  Inventory Intel
                </div>
                <h3 className="text-4xl md:text-5xl font-bold leading-tight">
                  Built from real products.
                </h3>
                <p className="text-lg text-on-surface-variant leading-relaxed">
                  Stop designing with generic effects. ShowCrafter knows the
                  inventory of local retailers, building shows around the exact
                  500g cakes and mortars sitting on the shelf near you.
                </p>
              </div>
              <div className="flex-1 w-full aspect-square rounded-xl bg-surface-container overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="w-full h-full object-cover"
                  alt="Close up of retail firework boxes with vibrant labels"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuD7TM600kXue7o-z7bf4iyHeGquNvD4TUv4ElgzHCxjHvLoYAsP2qjOr_4BpcakQCF0OEONNOnSSINWRXmbx8T9GvDy3uLxYdGeyfQ-Y153djA3pS8M1J02q9lB49gZY5UOOUGDAHup9GAxVNKtyll0cGX7LUiB1KlYd-mSH3cue7pA9KrXCgIT8SMVlwavPtUAlSfh36EapgXKvl1LVJEYvYa08HNJThUU8lXc6oGrmsAd42qu68r6AdMWPHeYNwswg2zaza-tVJg"
                />
              </div>
            </div>

            {/* NLP Director */}
            <div className="flex flex-col md:flex-row items-center gap-12 lg:gap-24">
              <div className="flex-1 space-y-6">
                <div className="text-primary text-sm font-bold tracking-[0.2em] uppercase">
                  NLP Director
                </div>
                <h3 className="text-4xl md:text-5xl font-bold leading-tight">
                  Refine with words.
                </h3>
                <p className="text-lg text-on-surface-variant leading-relaxed">
                  Don&apos;t like a segment? Just tell the AI. &ldquo;Make the
                  finale more aggressive&rdquo; or &ldquo;Use only blue and
                  gold during the bridge.&rdquo; It updates the timeline
                  instantly.
                </p>
              </div>
              <div className="flex-1 w-full aspect-square rounded-xl bg-surface-container overflow-hidden p-8 flex items-center justify-center">
                <div className="w-full max-w-sm space-y-4">
                  <div className="p-4 rounded-xl bg-surface-container-high border border-outline-variant/10 text-on-surface-variant">
                    &ldquo;Add more crackle to the drop&rdquo;
                  </div>
                  <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 text-primary text-right italic">
                    Orchestrating 12x Willow Crackle Shells...
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-24 px-6">
          <div className="max-w-[1200px] mx-auto bg-surface-container-high rounded-3xl p-12 md:p-24 text-center space-y-8 relative overflow-hidden">
            <div className="absolute inset-0 opacity-10 pointer-events-none">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="w-full h-full object-cover"
                alt="Abstract bokeh of golden light particles"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCDcrWCiRT9ABdL1Ukd3QscBqyYbeULZI7ZtxaNJajOZEkoXaKs0rv6REjFFtKwtEtwcCvByS4iVzjuQDeVrolF5zs6Jyah5om4MxENwblpKL7dTBBOAur_3C7PkeBj_KevDy7jyaMX8UfoxRMVwK-hv5-krHMNiu9oPBIWxJ2-ZLWxWZu0a2fqdAreKGCig4UFqZ7g5jIlarTfhQAFVZZae9krY6ppag9kFI9Fb0_UL6T0050PpIYOe6pJ8uwtnDd6ePuycrTrQKI"
              />
            </div>
            <h2 className="text-4xl md:text-6xl font-bold text-on-surface relative z-10">
              Ready to light up the sky?
            </h2>
            <p className="text-on-surface-variant max-w-xl mx-auto text-lg relative z-10">
              Start your first choreography today. Free to design, buy only
              the products you need.
            </p>
            <div className="pt-8 relative z-10">
              <Link
                href="#"
                className="bg-primary text-on-primary px-12 py-5 rounded-full text-xl font-bold shadow-xl hover:scale-105 transition-transform inline-block"
              >
                Start Choreographing
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-surface-container-lowest w-full py-8 mt-auto border-t border-outline-variant/15">
        <div className="flex flex-col md:flex-row justify-between items-center px-6 max-w-[1200px] mx-auto gap-4">
          <div className="text-xs uppercase tracking-widest text-on-surface-variant/60">
            &copy; 2026 ShowCrafter AI. All rights reserved.
          </div>
          <div className="flex gap-8">
            <Link
              className="text-xs uppercase tracking-widest text-on-surface-variant/60 hover:text-primary transition-colors"
              href="#"
            >
              About
            </Link>
            <Link
              className="text-xs uppercase tracking-widest text-on-surface-variant/60 hover:text-primary transition-colors"
              href="#"
            >
              Contact
            </Link>
            <Link
              className="text-xs uppercase tracking-widest text-on-surface-variant/60 hover:text-primary transition-colors"
              href="#"
            >
              Privacy
            </Link>
            <Link
              className="text-xs uppercase tracking-widest text-on-surface-variant/60 hover:text-primary transition-colors"
              href="/db-test"
            >
              Supabase data
            </Link>
          </div>
        </div>
      </footer>
    </>
  );
}
