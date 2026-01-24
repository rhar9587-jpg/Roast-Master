import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export type Accent = "green" | "pink" | "blue" | "orange";

type WrappedSlideProps = {
  kicker?: string;
  title: string;
  subtitle?: string;
  bigValue?: string;
  footer?: string;
  accent?: Accent;
  badgeRight?: string; // e.g. "fantasyroast.app"
  children?: React.ReactNode;
  className?: string;
};

const accentBar: Record<Accent, string> = {
  green: "from-emerald-400 via-lime-300 to-emerald-400",
  pink: "from-fuchsia-500 via-pink-400 to-orange-300",
  blue: "from-cyan-400 via-sky-400 to-indigo-400",
  orange: "from-orange-400 via-amber-300 to-pink-300",
};

export function WrappedSlide({
  kicker,
  title,
  subtitle,
  bigValue,
  footer = "Made with Fantasy Roast",
  accent = "green",
  badgeRight = "fantasyroast.net",
  children,
  className,
}: WrappedSlideProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, type: "spring" }}
      className={cn("w-full", className)}
    >
      <div className="rounded-3xl overflow-hidden shadow-2xl border border-border/50 bg-white">
        <div className={cn("h-3 bg-gradient-to-r", accentBar[accent])} />

        <div className="bg-black text-white p-8 md:p-10">
          <div className="flex items-center justify-between gap-3 mb-8">
            {kicker ? (
              <span className="inline-flex px-4 py-2 rounded-full bg-white/10 text-xs tracking-wider uppercase font-bold">
                {kicker}
              </span>
            ) : (
              <span />
            )}

            {badgeRight ? (
              <span className="inline-flex px-4 py-2 rounded-full bg-white/10 text-xs text-white/70">
                {badgeRight}
              </span>
            ) : null}
          </div>

          <h2 className="text-4xl md:text-6xl font-extrabold leading-[0.95] tracking-tight">
            {title}
          </h2>

          {subtitle ? (
            <p className="mt-4 text-white/70 text-base md:text-lg">{subtitle}</p>
          ) : null}

          {bigValue ? (
            <div className="mt-10 text-6xl md:text-7xl font-black tracking-tight">
              {bigValue}
            </div>
          ) : null}

          {children ? <div className="mt-10">{children}</div> : null}

          <div className="mt-10 text-xs text-white/50">{footer}</div>
        </div>
      </div>
    </motion.div>
  );
}