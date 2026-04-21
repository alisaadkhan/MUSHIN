"use client"
import React, { useEffect, useState, memo } from 'react';
import { Search, Shield, TrendingUp, Zap, MapPin, Users } from 'lucide-react';

import { MushInIcon } from '@/components/ui/MushInLogo';

// --- Type Definitions ---
type IconType = 'search' | 'shield' | 'trending' | 'zap' | 'map' | 'users';
type GlowColor = 'cyan' | 'purple';

interface SkillIconProps {
  type: IconType;
}

interface SkillConfig {
  id: string;
  orbitRadius: number;
  size: number;
  speed: number;
  iconType: IconType;
  phaseShift: number;
  glowColor: GlowColor;
  label: string;
}

interface OrbitingSkillProps {
  config: SkillConfig;
  angle: number;
}

interface GlowingOrbitPathProps {
  radius: number;
  glowColor?: GlowColor;
  animationDelay?: number;
}

// --- Improved SVG Icon Components ---
const iconComponents: Record<IconType, { component: () => React.JSX.Element; color: string }> = {
  search: { component: () => <Search strokeWidth={2.5} className="w-full h-full" color="#a855f7"/>, color: '#a855f7' },
  shield: { component: () => <Shield strokeWidth={2.5} className="w-full h-full" color="#60a5fa"/>, color: '#60a5fa' },
  trending: { component: () => <TrendingUp strokeWidth={2.5} className="w-full h-full" color="#4ade80"/>, color: '#4ade80' },
  zap: { component: () => <Zap strokeWidth={2.5} className="w-full h-full" color="#facc15"/>, color: '#facc15' },
  map: { component: () => <MapPin strokeWidth={2.5} className="w-full h-full" color="#fb923c"/>, color: '#fb923c' },
  users: { component: () => <Users strokeWidth={2.5} className="w-full h-full" color="#f472b6"/>, color: '#f472b6' }
};

// --- Memoized Icon Component ---
const SkillIcon = memo(({ type }: SkillIconProps) => {
  const IconComponent = iconComponents[type]?.component;
  return IconComponent ? <IconComponent /> : null;
});
SkillIcon.displayName = 'SkillIcon';

// --- Configuration for the Orbiting Skills ---
const skillsConfig: SkillConfig[] = [
  // Inner Orbit
  { 
    id: 'search',
    orbitRadius: 100, 
    size: 44, 
    speed: 1.0, 
    iconType: 'search', 
    phaseShift: 0, 
    glowColor: 'purple',
    label: 'AI Search'
  },
  { 
    id: 'shield',
    orbitRadius: 100, 
    size: 44, 
    speed: 1.0, 
    iconType: 'shield', 
    phaseShift: (2 * Math.PI) / 3, 
    glowColor: 'purple',
    label: 'Fraud Check'
  },
  { 
    id: 'trending',
    orbitRadius: 100, 
    size: 44, 
    speed: 1.0, 
    iconType: 'trending', 
    phaseShift: (4 * Math.PI) / 3, 
    glowColor: 'purple',
    label: 'ROAS Engine'
  },
  // Outer Orbit
  { 
    id: 'zap',
    orbitRadius: 180, 
    size: 48, 
    speed: -0.6, 
    iconType: 'zap', 
    phaseShift: 0, 
    glowColor: 'purple',
    label: 'Live Data'
  },
  { 
    id: 'map',
    orbitRadius: 180, 
    size: 48, 
    speed: -0.6, 
    iconType: 'map', 
    phaseShift: (2 * Math.PI) / 3, 
    glowColor: 'purple',
    label: 'Multi-City'
  },
  { 
    id: 'users',
    orbitRadius: 180, 
    size: 48, 
    speed: -0.6, 
    iconType: 'users', 
    phaseShift: (4 * Math.PI) / 3, 
    glowColor: 'purple',
    label: 'Team Board'
  },
];

// --- Memoized Orbiting Skill Component ---
const OrbitingSkill = memo(({ config, angle }: OrbitingSkillProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const { orbitRadius, size, iconType, label } = config;

  const x = Math.cos(angle) * orbitRadius;
  const y = Math.sin(angle) * orbitRadius;

  return (
    <div
      className="absolute top-1/2 left-1/2 transition-all duration-300 ease-out"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        transform: `translate(calc(${x}px - 50%), calc(${y}px - 50%))`,
        zIndex: isHovered ? 20 : 10,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`
          relative w-full h-full p-2.5 bg-[#0a0514]/90 backdrop-blur-md
          rounded-full flex items-center justify-center border border-white/10
          transition-all duration-300 cursor-pointer
          ${isHovered ? 'scale-125 shadow-2xl z-50' : 'shadow-lg hover:shadow-xl'}
        `}
        style={{
          boxShadow: isHovered
            ? `0 0 30px ${iconComponents[iconType]?.color}50, 0 0 60px ${iconComponents[iconType]?.color}30, inset 0 0 15px ${iconComponents[iconType]?.color}20`
            : `inset 0 0 10px ${iconComponents[iconType]?.color}10`
        }}
      >
        <SkillIcon type={iconType} />
        {isHovered && (
          <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-[#150a2a]/95 backdrop-blur-sm rounded-md border border-purple-500/30 text-[10px] font-bold tracking-widest uppercase text-white whitespace-nowrap pointer-events-none shadow-xl">
            {label}
          </div>
        )}
      </div>
    </div>
  );
});
OrbitingSkill.displayName = 'OrbitingSkill';

// --- Optimized Orbit Path Component ---
const GlowingOrbitPath = memo(({ radius, glowColor = 'purple', animationDelay = 0 }: GlowingOrbitPathProps) => {
  const glowColors = {
    cyan: {
      primary: 'rgba(6, 182, 212, 0.3)',
      secondary: 'rgba(6, 182, 212, 0.1)',
      border: 'rgba(6, 182, 212, 0.2)'
    },
    purple: {
      primary: 'rgba(147, 51, 234, 0.25)',
      secondary: 'rgba(147, 51, 234, 0.1)',
      border: 'rgba(168, 85, 247, 0.2)'
    }
  };

  const colors = glowColors[glowColor] || glowColors.purple;

  return (
    <div
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
      style={{
        width: `${radius * 2}px`,
        height: `${radius * 2}px`,
        animationDelay: `${animationDelay}s`,
      }}
    >
      {/* Glowing background */}
      <div
        className="absolute inset-0 rounded-full animate-pulse"
        style={{
          background: `radial-gradient(circle, transparent 40%, ${colors.secondary} 80%, ${colors.primary} 100%)`,
          boxShadow: `0 0 40px ${colors.primary}, inset 0 0 40px ${colors.secondary}`,
          animation: 'pulse 4s ease-in-out infinite',
          animationDelay: `${animationDelay}s`,
        }}
      />

      {/* Static ring for depth */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          border: `1px dashed ${colors.border}`,
        }}
      />
    </div>
  );
});
GlowingOrbitPath.displayName = 'GlowingOrbitPath';

// --- Main App Component ---
export default function OrbitingSkills() {
  const [time, setTime] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return;

    let animationFrameId: number;
    let lastTime = performance.now();

    const animate = (currentTime: number) => {
      const deltaTime = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      setTime(prevTime => prevTime + deltaTime);
      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPaused]);

  const orbitConfigs: Array<{ radius: number; glowColor: GlowColor; delay: number }> = [
    { radius: 100, glowColor: 'purple', delay: 0 },
    { radius: 180, glowColor: 'purple', delay: 1.5 }
  ];

  return (
    <div className="w-full flex items-center justify-center overflow-hidden py-4 scale-90 sm:scale-100">
      <div 
        className="relative w-[calc(100vw-40px)] h-[calc(100vw-40px)] md:w-[450px] md:h-[450px] flex items-center justify-center"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        
        {/* Central Logo */}
        <div className="w-[88px] h-[88px] bg-[radial-gradient(circle,rgba(88,28,135,0.6)_0%,rgba(4,4,8,0.9)_70%)] rounded-full flex items-center justify-center z-10 relative shadow-2xl border-2 border-purple-500/50">
          <div className="absolute inset-0 rounded-full bg-purple-500/30 blur-2xl animate-pulse"></div>
          <div className="absolute inset-0 rounded-full bg-fuchsia-500/20 blur-3xl animate-pulse" style={{ animationDelay: '1.5s' }}></div>
          <div className="relative z-10">
            <MushInIcon size={52} className="drop-shadow-[0_0_15px_rgba(168,85,247,0.8)]" />
          </div>
        </div>

        {/* Render glowing orbit paths */}
        {orbitConfigs.map((config) => (
          <GlowingOrbitPath
            key={`path-${config.radius}`}
            radius={config.radius}
            glowColor={config.glowColor}
            animationDelay={config.delay}
          />
        ))}

        {/* Render orbiting skill icons */}
        {skillsConfig.map((config) => {
          const angle = time * config.speed + (config.phaseShift || 0);
          return (
            <OrbitingSkill
              key={config.id}
              config={config}
              angle={angle}
            />
          );
        })}
      </div>
    </div>
  );
}