import { Link } from "react-router-dom";
import { MushInLogo } from "@/components/ui/MushInLogo";

/** Single accent — adjust in one place */
const ACCENT = "#2563eb";

export default function LandingPage() {
  return (
    <div
      className="min-h-screen flex flex-col landing-minimal"
      style={{ background: "#0c0c0c", color: "#e8e8e8" }}
    >
      <header
        className="border-b px-6 py-4 flex items-center justify-between gap-4"
        style={{ borderColor: "rgba(255,255,255,0.08)" }}
      >
        <MushInLogo height={28} />
        <div className="flex items-center gap-3 text-sm">
          <Link
            to="/login"
            className="hover:opacity90 transition-opacity"
            style={{ color: "rgba(255,255,255,0.65)" }}
          >
            Sign in
          </Link>
          <Link
            to="/signup"
            className="px-4 py-2 rounded-md font-medium text-white text-sm"
            style={{ background: ACCENT }}
          >
            Create account
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto px-6 py-14 md:py-20 w-full space-y-14">
        <section className="space-y-5">
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight leading-tight text-white">
            See creator data in one place
          </h1>
          <p className="text-base md:text-lg" style={{ lineHeight: 1.55, color: "rgba(255,255,255,0.72)" }}>
            MUSHIN is a web app for teams who sponsor creators. Search by niche and location, save lists,
            track campaigns, and spend credits when you run live lookups. It is built for people who already
            run partnerships—not for generic “influencer marketing” slideshows.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              to="/signup"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-md text-white text-sm font-medium"
              style={{ background: ACCENT }}
            >
              Create an account
            </Link>
            <Link
              to="/pricing"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-md text-sm font-medium border"
              style={{ borderColor: "rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.85)" }}
            >
              View pricing
            </Link>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-white">What you actually get</h2>
          <ul className="space-y-3 text-base" style={{ lineHeight: 1.55, color: "rgba(255,255,255,0.72)" }}>
            <li>
              <strong className="text-white font-medium">Discover:</strong> query creators with filters;
              live searches use credits so usage matches cost.
            </li>
            <li>
              <strong className="text-white font-medium">Campaigns:</strong> attach creators to a pipeline and
              track spend in one workspace.
            </li>
            <li>
              <strong className="text-white font-medium">Billing:</strong> subscription and credits are handled
              inside the app—check Pricing before you subscribe.
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-white">From the product</h2>
          <p className="text-base" style={{ lineHeight: 1.55, color: "rgba(255,255,255,0.65)" }}>
            Below is a static image from the marketing site (not a fake UI frame). Replace{" "}
            <code className="text-xs px-1 py-0.5 rounded bg-white/10">public/hero-poster.jpg</code> with your
            own screenshot if you want a fresher capture.
          </p>
          <figure
            className="rounded-lg overflow-hidden border"
            style={{ borderColor: "rgba(255,255,255,0.1)" }}
          >
            <img
              src="/hero-poster.jpg"
              alt="MUSHIN product screenshot"
              className="w-full h-auto block"
              width={1200}
              height={675}
              loading="lazy"
            />
            <figcaption
              className="text-xs px-3 py-2"
              style={{ color: "rgba(255,255,255,0.45)", background: "rgba(0,0,0,0.35)" }}
            >
              Example screen from the deployed app (image asset in /public).
            </figcaption>
          </figure>
        </section>

        <section className="space-y-3 pt-4 border-t" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <h2 className="text-lg font-semibold text-white">Who this is for</h2>
          <p className="text-base" style={{ lineHeight: 1.55, color: "rgba(255,255,255,0.72)" }}>
            Brand and agency teams who need structured lists and repeatable research—not a deck of stock photos.
            If you need a different workflow, say so in support after you sign up.
          </p>
        </section>
      </main>

      <footer
        className="border-t px-6 py-8 text-sm flex flex-wrap gap-x-6 gap-y-2 justify-center"
        style={{ borderColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.45)" }}
      >
        <Link to="/privacy" className="hover:text-white/80">
          Privacy
        </Link>
        <Link to="/terms" className="hover:text-white/80">
          Terms
        </Link>
        <Link to="/cookies" className="hover:text-white/80">
          Cookies
        </Link>
        <span>© {new Date().getFullYear()} MUSHIN</span>
      </footer>
    </div>
  );
}
