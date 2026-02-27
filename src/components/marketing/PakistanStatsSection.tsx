import { motion, type Variants } from "framer-motion";

const fadeUp: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};
const stagger: Variants = { visible: { transition: { staggerChildren: 0.1 } } };

const STATS = [
    { value: "10,000+", label: "Pakistani Creators Indexed" },
    { value: "12", label: "Major Cities Covered" },
    { value: "₨4.2×", label: "Average Campaign ROI" },
    { value: "80%", label: "Top PK Brands Use InfluenceIQ" },
];

// Pakistani creators shown on the map
const FEATURED_CREATORS = [
    { name: "Zara Khalid", city: "Karachi", niche: "Fashion", followers: "1.2M", x: "28%", y: "73%" },
    { name: "Hassan Ali", city: "Lahore", niche: "Food", followers: "890K", x: "54%", y: "42%" },
    { name: "Ayesha Noor", city: "Islamabad", niche: "Lifestyle", followers: "2.1M", x: "60%", y: "27%" },
    { name: "Bilal Chaudhry", city: "Faisalabad", niche: "Cricket", followers: "540K", x: "47%", y: "43%" },
    { name: "Sana Javed", city: "Multan", niche: "Drama", followers: "320K", x: "41%", y: "55%" },
];

// Approximate Pakistan SVG path (simplified geographic outline)
const PAKISTAN_PATH = `
  M 200 20
  L 230 18 L 260 22 L 285 30 L 300 45 L 310 55
  L 330 52 L 345 60 L 355 75 L 350 90
  L 360 100 L 370 115 L 365 130 L 375 145
  L 385 155 L 390 170 L 380 185 L 370 195
  L 360 210 L 355 225 L 345 240 L 330 255
  L 315 265 L 300 275 L 280 282 L 265 290
  L 245 295 L 225 290 L 205 285 L 185 278
  L 165 270 L 148 258 L 135 242 L 125 225
  L 118 208 L 112 190 L 108 172 L 110 155
  L 115 138 L 122 122 L 118 105 L 110 90
  L 105 75 L 112 60 L 122 48 L 138 38
  L 155 28 L 175 22 L 200 20 Z
`;

// City coordinates in the SVG viewport (0-0 to 400-320)
const CITY_NODES = [
    { city: "Karachi", x: 185, y: 255, primary: true, label_dx: 8, label_dy: -5 },
    { city: "Lahore", x: 270, y: 145, primary: true, label_dx: 8, label_dy: -5 },
    { city: "Islamabad", x: 295, y: 92, primary: true, label_dx: 8, label_dy: -5 },
    { city: "Faisalabad", x: 248, y: 150, primary: false, label_dx: -60, label_dy: 12 },
    { city: "Peshawar", x: 265, y: 72, primary: false, label_dx: -55, label_dy: 12 },
    { city: "Multan", x: 228, y: 185, primary: false, label_dx: -50, label_dy: 12 },
    { city: "Quetta", x: 152, y: 195, primary: false, label_dx: 8, label_dy: -5 },
    { city: "Sialkot", x: 283, y: 118, primary: false, label_dx: 8, label_dy: -5 },
];

export function PakistanStatsSection() {
    return (
        <section className="relative py-24 px-6 md:px-12 lg:px-24">
            <motion.div
                initial="hidden" whileInView="visible" viewport={{ once: true }}
                variants={stagger}
                className="max-w-6xl mx-auto space-y-16"
            >
                {/* Header */}
                <div className="text-center space-y-4">
                    <motion.p variants={fadeUp} className="text-sm font-semibold uppercase tracking-widest text-primary">
                        🇵🇰 Market Coverage
                    </motion.p>
                    <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold tracking-tight">
                        Built for <span className="aurora-text">Pakistan's Creator Economy</span>
                    </motion.h2>
                    <motion.p variants={fadeUp} className="text-muted-foreground max-w-xl mx-auto">
                        We index creators from every major Pakistani city — find the right voice in the right region.
                    </motion.p>
                </div>

                <div className="grid md:grid-cols-2 gap-12 items-start">
                    {/* Pakistan Map — SVG outline with city dots */}
                    <motion.div variants={fadeUp}
                        className="glass-card rounded-2xl p-6 relative overflow-hidden"
                    >
                        <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-4">
                            🗺️ Pakistan City Coverage
                        </p>

                        <svg
                            viewBox="80 10 310 300"
                            className="w-full max-h-72"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            {/* Glow filter */}
                            <defs>
                                <filter id="glow">
                                    <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                                    <feMerge>
                                        <feMergeNode in="coloredBlur" />
                                        <feMergeNode in="SourceGraphic" />
                                    </feMerge>
                                </filter>
                                <radialGradient id="pkGrad" cx="50%" cy="50%" r="50%">
                                    <stop offset="0%" stopColor="hsl(263, 70%, 60%)" stopOpacity="0.18" />
                                    <stop offset="100%" stopColor="hsl(263, 70%, 60%)" stopOpacity="0.04" />
                                </radialGradient>
                            </defs>

                            {/* Pakistan body fill */}
                            <path
                                d={PAKISTAN_PATH}
                                fill="url(#pkGrad)"
                                stroke="hsl(263, 70%, 65%)"
                                strokeWidth="1.5"
                                strokeLinejoin="round"
                                opacity="0.8"
                            />

                            {/* City connection lines */}
                            <g opacity="0.2" stroke="hsl(263, 70%, 65%)" strokeWidth="0.8">
                                <line x1="295" y1="92" x2="265" y2="72" />
                                <line x1="295" y1="92" x2="283" y2="118" />
                                <line x1="283" y1="118" x2="270" y2="145" />
                                <line x1="270" y1="145" x2="248" y2="150" />
                                <line x1="248" y1="150" x2="228" y2="185" />
                                <line x1="228" y1="185" x2="185" y2="255" />
                                <line x1="152" y1="195" x2="228" y2="185" />
                            </g>

                            {/* City nodes */}
                            {CITY_NODES.map((node, i) => (
                                <g key={node.city}>
                                    {/* Pulse ring for primary cities */}
                                    {node.primary && (
                                        <circle
                                            cx={node.x} cy={node.y} r="10"
                                            fill="hsl(263, 70%, 65%)"
                                            opacity="0.15"
                                            style={{ animation: `ping ${1.5 + i * 0.3}s cubic-bezier(0, 0, 0.2, 1) infinite` }}
                                        />
                                    )}
                                    {/* Dot */}
                                    <circle
                                        cx={node.x} cy={node.y}
                                        r={node.primary ? 5 : 3.5}
                                        fill={node.primary ? "hsl(263, 70%, 65%)" : "hsl(263, 70%, 75%)"}
                                        filter="url(#glow)"
                                        opacity={node.primary ? 1 : 0.7}
                                    />
                                    {/* Label */}
                                    <text
                                        x={node.x + node.label_dx}
                                        y={node.y + node.label_dy}
                                        fontSize="9"
                                        fill="hsl(263, 70%, 70%)"
                                        fontFamily="Inter, sans-serif"
                                        fontWeight={node.primary ? "600" : "400"}
                                    >
                                        {node.city}
                                    </text>
                                </g>
                            ))}
                        </svg>

                        {/* Legend */}
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ background: "hsl(263, 70%, 65%)" }} />
                                Primary Hub
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full" style={{ background: "hsl(263, 70%, 75%)", opacity: 0.7 }} />
                                City
                            </div>
                        </div>
                    </motion.div>

                    {/* Right side: stats + featured Pakistani creators */}
                    <div className="space-y-6">
                        {/* Stats grid */}
                        <div className="grid grid-cols-2 gap-4">
                            {STATS.map((s) => (
                                <motion.div
                                    key={s.label}
                                    variants={fadeUp}
                                    className="glass-card rounded-xl p-5 text-center space-y-1"
                                >
                                    <p
                                        className="data-mono text-2xl font-extrabold"
                                        style={{ color: "hsl(var(--aurora-violet))" }}
                                    >
                                        {s.value}
                                    </p>
                                    <p className="text-xs text-muted-foreground">{s.label}</p>
                                </motion.div>
                            ))}
                        </div>

                        {/* Featured Pakistani creators */}
                        <motion.div variants={fadeUp} className="glass-card rounded-xl overflow-hidden">
                            <div className="px-4 py-3 border-b" style={{ borderColor: "hsl(var(--glass-border))" }}>
                                <p className="text-xs font-semibold uppercase tracking-wider text-primary">Featured Pakistani Creators</p>
                            </div>
                            <div className="divide-y" style={{ borderColor: "hsl(var(--glass-border))" }}>
                                {FEATURED_CREATORS.map((c) => (
                                    <div key={c.name} className="flex items-center justify-between px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary">
                                                {c.name.split(" ").map(n => n[0]).join("")}
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-foreground">{c.name}</p>
                                                <p className="text-xs text-muted-foreground">{c.city} · {c.niche}</p>
                                            </div>
                                        </div>
                                        <span className="data-mono text-xs font-semibold text-primary">{c.followers}</span>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </div>
                </div>
            </motion.div>
        </section>
    );
}
