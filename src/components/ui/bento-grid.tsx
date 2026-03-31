import { cn } from "@/lib/utils";

export const BentoGrid = ({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) => {
  return (
    <div
      className={cn(
        "grid md:auto-rows-[18rem] grid-cols-1 md:grid-cols-3 gap-4 max-w-7xl mx-auto",
        className
      )}
    >
      {children}
    </div>
  );
};

export const BentoGridItem = ({
  className,
  title,
  description,
  header,
  icon,
}: {
  className?: string;
  title?: string | React.ReactNode;
  description?: string | React.ReactNode;
  header?: React.ReactNode;
  icon?: React.ReactNode;
}) => {
  return (
    <div
      className={cn(
        "row-span-1 rounded-2xl group/bento transition duration-200 shadow-input dark:shadow-none bg-white/[0.03] border border-white/10 overflow-hidden flex flex-col space-y-4 hover:border-purple-500/30 hover:shadow-[0_8px_32px_-8px_rgba(168,85,247,0.25)] hover:-translate-y-1 relative",
        className
      )}
    >
      {/* 1px Highlight */}
      <div className="absolute inset-0 pointer-events-none rounded-2xl border border-white/[0.05]" style={{ transform: 'scale(0.995)' }} />
      
      {/* Noise */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")', mixBlendMode: 'overlay' }} />

      <div className="relative z-10 w-full h-full flex flex-col p-4">
        <div className="w-full flex-1 rounded-xl overflow-hidden bg-white/[0.02]">
            {header}
        </div>
        <div className="group-hover/bento:translate-x-1 transition duration-200 pt-4">
            <div className="mb-2">{icon}</div>
            <div className="font-bold text-white mb-2 mt-2">
            {title}
            </div>
            <div className="font-normal text-zinc-400 text-xs leading-relaxed">
            {description}
            </div>
        </div>
      </div>
    </div>
  );
};
