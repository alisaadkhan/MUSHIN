/* ============================================================
   CreatorCardSkeleton.tsx
   Pixel-perfect shimmer loader that mirrors CreatorCard's
   exact layout — header, metrics bar, platform module,
   enrichment strip, and footer row.
   ============================================================ */

/* ── Shimmer keyframes + base class ──────────────────────── */
const SHIMMER_CSS = `
@keyframes mushin-shimmer {
  0%   { background-position: -600px 0; }
  100% { background-position:  600px 0; }
}
.ms-shimmer {
  background: linear-gradient(
    90deg,
    rgba(255,255,255,0.03) 0%,
    rgba(255,255,255,0.07) 40%,
    rgba(255,255,255,0.03) 80%
  );
  background-size: 600px 100%;
  animation: mushin-shimmer 1.6s ease-in-out infinite;
  border-radius: 4px;
}
`;

/* ── Inject styles once ───────────────────────────────────── */
let stylesInjected = false;
function injectStyles() {
  if (stylesInjected || typeof document === "undefined") return;
  const el = document.createElement("style");
  el.textContent = SHIMMER_CSS;
  document.head.appendChild(el);
  stylesInjected = true;
}

/* ── Atom: shimmer block ─────────────────────────────────── */
function S({
  w, h, className = "", style = {},
}: {
  w: string | number;
  h: string | number;
  className?: string;
  style?: React.CSSProperties;
}) {
  injectStyles();
  return (
    <div
      className={`ms-shimmer ${className}`}
      style={{
        width:  typeof w === "number" ? `${w}px` : w,
        height: typeof h === "number" ? `${h}px` : h,
        ...style,
      }}
      aria-hidden
    />
  );
}

/* ── Circular shimmer ─────────────────────────────────────── */
function SC({ size }: { size: number }) {
  injectStyles();
  return (
    <div
      className="ms-shimmer"
      style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0 }}
      aria-hidden
    />
  );
}

/* ── Platform-module skeletons ───────────────────────────── */
function InstagramModuleSkeleton() {
  return (
    <div className="space-y-3">
      {/* 3 thumbnail placeholders */}
      <div className="grid grid-cols-3 gap-1.5">
        {[0, 1, 2].map((i) => (
          <S key={i} w="100%" h={80} style={{ borderRadius: 6 }} />
        ))}
      </div>
      {/* Reel views row */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <S w="50%" h={9} />
          <S w="70%" h={14} />
        </div>
        <div className="space-y-1.5">
          <S w="50%" h={9} />
          <S w="70%" h={14} />
        </div>
      </div>
      {/* Fake follower gauge */}
      <div className="space-y-1.5">
        <div className="flex justify-between">
          <S w="35%" h={9} />
          <S w="20%" h={9} />
        </div>
        <S w="100%" h={3} style={{ borderRadius: 2 }} />
        <S w="25%" h={9} />
      </div>
    </div>
  );
}

function TikTokModuleSkeleton() {
  return (
    <div className="space-y-3">
      {/* Viral Velocity hero block */}
      <div
        className="rounded-lg p-3 flex items-center justify-between"
        style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}
      >
        <div className="space-y-2">
          <S w={80} h={9} />
          <S w={50} h={30} />
          <S w={90} h={9} />
        </div>
        <div className="space-y-2 items-end flex flex-col">
          <S w={55} h={18} style={{ borderRadius: 9 }} />
          <S w={55} h={9} />
          <S w={40} h={16} />
        </div>
      </div>
      {/* Bar histogram */}
      <div>
        <div className="flex justify-between mb-1.5">
          <S w="30%" h={9} />
          <S w="20%" h={9} />
        </div>
        <div className="flex items-end gap-1 h-7">
          {[14, 20, 16, 28, 18, 24].map((h, i) => (
            <S
              key={i}
              w="100%"
              h={h}
              style={{ flex: 1, borderRadius: 2 }}
            />
          ))}
        </div>
      </div>
      {/* Fake follower */}
      <div className="space-y-1.5">
        <div className="flex justify-between">
          <S w="35%" h={9} />
          <S w="20%" h={9} />
        </div>
        <S w="100%" h={3} style={{ borderRadius: 2 }} />
        <S w="25%" h={9} />
      </div>
    </div>
  );
}

function YouTubeModuleSkeleton() {
  return (
    <div className="space-y-3">
      {/* Arc + stats side by side */}
      <div className="flex items-center gap-4">
        <SC size={60} />
        <div className="flex-1 space-y-3">
          <div className="space-y-1.5">
            <S w="50%" h={9} />
            <S w="40%" h={11} />
          </div>
          <div className="space-y-1.5">
            <S w="50%" h={9} />
            <S w="45%" h={15} />
          </div>
        </div>
      </div>
      {/* Sparkline */}
      <div>
        <div className="flex justify-between mb-1.5">
          <S w="30%" h={9} />
          <S w="20%" h={9} />
        </div>
        <S w="100%" h={28} style={{ borderRadius: 4 }} />
      </div>
      {/* Fake follower */}
      <div className="space-y-1.5">
        <div className="flex justify-between">
          <S w="35%" h={9} />
          <S w="20%" h={9} />
        </div>
        <S w="100%" h={3} style={{ borderRadius: 2 }} />
        <S w="25%" h={9} />
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   MUSHIN Score skeleton — mirrors the SVG arc gauge
   ════════════════════════════════════════════════════════════ */
function MUSHINScoreSkeleton() {
  injectStyles();
  return (
    <div className="flex flex-col items-center gap-1">
      {/* Circle approximating the arc gauge */}
      <div
        className="ms-shimmer"
        style={{ width: 64, height: 64, borderRadius: "50%", flexShrink: 0 }}
        aria-hidden
      />
      <S w={48} h={9} />
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   FULL CREATOR CARD SKELETON
   Prop: platform → renders matching platform module skeleton
   ════════════════════════════════════════════════════════════ */
interface CreatorCardSkeletonProps {
  platform?: "instagram" | "tiktok" | "youtube";
  animationDelay?: number;
}

export function CreatorCardSkeleton({
  platform = "instagram",
  animationDelay = 0,
}: CreatorCardSkeletonProps) {
  injectStyles();

  return (
    <div
      className="rounded-xl overflow-hidden flex flex-col"
      style={{
        background: "#09090d",
        border: "1px solid rgba(255,255,255,0.06)",
        animationDelay: `${animationDelay}ms`,
      }}
      aria-busy
      aria-label="Loading creator..."
      role="status"
    >
      {/* Top accent line placeholder */}
      <div
        className="ms-shimmer"
        style={{ height: 1, borderRadius: 0 }}
        aria-hidden
      />

      {/* ── Header ── */}
      <div className="flex items-start justify-between px-4 pt-4 pb-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <SC size={40} />
          <div className="flex-1 space-y-2 mt-1">
            {/* Name */}
            <S w="55%" h={14} />
            {/* Handle */}
            <S w="40%" h={11} />
            {/* Platform + city badges */}
            <div className="flex items-center gap-1.5 mt-0.5">
              <S w={65} h={18} style={{ borderRadius: 4 }} />
              <S w={55} h={14} />
            </div>
          </div>
        </div>
        {/* MUSHIN Score */}
        <div className="flex-shrink-0 ml-2">
          <MUSHINScoreSkeleton />
        </div>
      </div>

      {/* ── Metrics bar ── */}
      <div
        className="grid grid-cols-3"
        style={{ borderTop: "1px solid rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="px-3 py-2.5 text-center space-y-1.5 flex flex-col items-center"
            style={{ borderRight: i < 2 ? "1px solid rgba(255,255,255,0.05)" : "none" }}
          >
            <S w="60%" h={14} />
            <S w="50%" h={9} />
            <S w="40%" h={9} />
          </div>
        ))}
      </div>

      {/* ── Platform module ── */}
      <div className="px-4 pt-3 pb-2 flex-1">
        {platform === "instagram" && <InstagramModuleSkeleton />}
        {platform === "tiktok"    && <TikTokModuleSkeleton />}
        {platform === "youtube"   && <YouTubeModuleSkeleton />}
      </div>

      {/* ── Niche tags ── */}
      <div className="px-4 pb-2 flex gap-1.5 flex-wrap">
        <S w={60} h={18} style={{ borderRadius: 4 }} />
        <S w={80} h={18} style={{ borderRadius: 4 }} />
        <S w={50} h={18} style={{ borderRadius: 4 }} />
      </div>

      {/* ── Enrichment strip ── */}
      <div
        className="px-4 py-2 flex items-center gap-2"
        style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
      >
        <S w={36} h={9} />
        <S w={70} h={22} style={{ borderRadius: 4 }} />
        <S w={80} h={22} style={{ borderRadius: 4 }} />
      </div>

      {/* ── Footer ── */}
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
      >
        <S w={90} h={9} />
        <div className="flex items-center gap-2">
          <S w={28} h={28} style={{ borderRadius: 6 }} />
          <S w={80} h={28} style={{ borderRadius: 6 }} />
        </div>
      </div>
    </div>
  );
}

/* ── Grid of skeletons ────────────────────────────────────── */
export function CreatorCardSkeletonGrid({ count = 6 }: { count?: number }) {
  // Vary the platform to make the skeleton grid feel intentional,
  // not like every card is loading the same thing.
  const platforms: ("instagram" | "tiktok" | "youtube")[] = [
    "instagram", "tiktok", "youtube",
    "instagram", "tiktok", "youtube",
    "instagram", "tiktok",
  ];
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <CreatorCardSkeleton
          key={i}
          platform={platforms[i % platforms.length]}
          animationDelay={i * 60}
        />
      ))}
    </>
  );
}
