import * as React from "react";
import { Card } from "@/components/ui/card";

type LegacyStat = { label: string; value: string };
type Badge = "OWNED" | "NEMESIS" | "RIVAL" | "EDGE" | "SMALL SAMPLE";
type Rarity = "COMMON" | "RARE" | "EPIC" | "LEGENDARY";
type StatLine = { label: string; value: string };

type LegacyProps = {
  title: string;
  name: string;
  subtitle?: string;
  avatarUrl?: string | null;
  badge?: Badge;
  stats: LegacyStat[];
  onClick?: () => void;
};

type V2Props = {
  badge: Badge;
  badgeText?: string;
  title: string;
  name: string;
  avatarUrl?: string | null;
  primaryStat: { value: string; label?: string };
  punchline?: string;
  lines?: StatLine[];
  season?: string;
  rarity?: Rarity;
  watermark?: string;

  back?: {
    headline?: string;
    subhead?: string;
    lines?: StatLine[];
    footerLeft?: string;
    footerRight?: string;
  };

  /** Optional: external action button on back face */
  onClick?: () => void;

  /** Optional: start on back */
  defaultFlipped?: boolean;

  /** Optional: if true, flipping also calls onClick */
  callOnClickOnFlip?: boolean;
};

function isLegacyProps(p: LegacyProps | V2Props): p is LegacyProps {
  return "stats" in p;
}

// small deterministic “card number”
function cardNumberFrom(text: string) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return String((h % 999) + 1).padStart(3, "0");
}

export function BaseballCard(props: LegacyProps | V2Props) {
  // ✅ Legacy mode: keep old UI so existing pages don’t crash
  if (isLegacyProps(props)) {
    const { title, name, subtitle, avatarUrl, badge, stats, onClick } = props;

    const badgeTone =
      badge === "OWNED"
        ? "border-emerald-400/60 bg-emerald-50/40 dark:bg-emerald-950/20"
        : badge === "NEMESIS"
        ? "border-rose-400/60 bg-rose-50/40 dark:bg-rose-950/20"
        : badge === "RIVAL"
        ? "border-amber-400/60 bg-amber-50/40 dark:bg-amber-950/20"
        : "border-muted bg-background";

    const clickable = !!onClick;

    return (
      <Card
        className={[
          "relative overflow-hidden border p-4",
          badgeTone,
          clickable ? "cursor-pointer hover:shadow-md transition" : "",
        ].join(" ")}
        onClick={onClick}
        role={clickable ? "button" : undefined}
        tabIndex={clickable ? 0 : undefined}
        onKeyDown={(e) => {
          if (!onClick) return;
          if (e.key === "Enter" || e.key === " ") onClick();
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{title}</div>
            <div className="mt-1 text-xl font-semibold leading-tight">{name}</div>
            {subtitle ? <div className="mt-0.5 text-xs text-muted-foreground">{subtitle}</div> : null}
          </div>

          <div className="shrink-0">
            {avatarUrl ? (
              <img src={avatarUrl} alt={name} className="h-12 w-12 rounded-lg object-cover border" />
            ) : (
              <div className="h-12 w-12 rounded-lg border bg-muted/40 flex items-center justify-center text-xs text-muted-foreground">
                FR
              </div>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {stats.slice(0, 6).map((s) => (
            <div key={s.label} className="rounded-full border bg-background/60 px-2.5 py-1 text-[11px]">
              <span className="text-muted-foreground">{s.label}</span>{" "}
              <span className="font-semibold">{s.value}</span>
            </div>
          ))}
        </div>

        <div className="pointer-events-none absolute inset-0 opacity-[0.06]">
          <div className="absolute -right-24 -top-24 h-60 w-60 rounded-full bg-foreground" />
          <div className="absolute -left-28 -bottom-28 h-72 w-72 rounded-full bg-foreground" />
        </div>
      </Card>
    );
  }

  // ✅ V2 mode: collectible trading-card layout (FLIPPABLE)
  const {
    badge,
    badgeText,
    title,
    name,
    avatarUrl,
    primaryStat,
    punchline,
    lines = [],
    season = "2024–25",
    rarity,
    watermark = "Fantasy Roast",
    back,
    onClick,
    defaultFlipped,
    callOnClickOnFlip,
  } = props;

  const [flipped, setFlipped] = React.useState<boolean>(!!defaultFlipped);

  const tone =
    badge === "OWNED"
      ? {
          frame: "from-emerald-100/50 via-emerald-200/30 to-emerald-300/20",
          border: "border-emerald-400/70",
          chip: "bg-emerald-500/15 text-emerald-950 dark:text-emerald-50 border-emerald-500/30",
          accent: "text-emerald-700 dark:text-emerald-300",
        }
      : badge === "NEMESIS"
      ? {
          frame: "from-rose-100/50 via-rose-200/30 to-rose-300/20",
          border: "border-rose-400/70",
          chip: "bg-rose-500/15 text-rose-950 dark:text-rose-50 border-rose-500/30",
          accent: "text-rose-700 dark:text-rose-300",
        }
      : badge === "RIVAL"
      ? {
          frame: "from-amber-100/50 via-amber-200/30 to-amber-300/20",
          border: "border-amber-400/70",
          chip: "bg-amber-500/15 text-amber-950 dark:text-amber-50 border-amber-500/30",
          accent: "text-amber-700 dark:text-amber-300",
        }
      : badge === "EDGE"
      ? {
          frame: "from-sky-100/50 via-sky-200/30 to-sky-300/20",
          border: "border-sky-400/70",
          chip: "bg-sky-500/15 text-sky-950 dark:text-sky-50 border-sky-500/30",
          accent: "text-sky-700 dark:text-sky-300",
        }
      : {
          frame: "from-violet-100/50 via-violet-200/30 to-violet-300/20",
          border: "border-violet-400/70",
          chip: "bg-violet-500/15 text-violet-950 dark:text-violet-50 border-violet-500/30",
          accent: "text-violet-700 dark:text-violet-300",
        };

  const badgeIcon =
    badge === "OWNED" ? "👑" : badge === "NEMESIS" ? "💀" : badge === "RIVAL" ? "⚔️" : badge === "EDGE" ? "⚡" : "🎲";

  const rarityTone =
    rarity === "LEGENDARY"
      ? "bg-yellow-500/15 text-yellow-950 dark:text-yellow-100 border-yellow-500/40"
      : rarity === "EPIC"
      ? "bg-fuchsia-500/15 text-fuchsia-950 dark:text-fuchsia-100 border-fuchsia-500/40"
      : rarity === "RARE"
      ? "bg-blue-500/15 text-blue-950 dark:text-blue-100 border-blue-500/40"
      : "bg-muted/40 text-muted-foreground border-muted";

  const cardNo = cardNumberFrom(`${title}-${name}-${badge}`);
  const setCode = `FR-${String(season).replace(/[^\d]/g, "").slice(0, 4) || "25"}`;

  const flip = React.useCallback(() => {
    setFlipped((v) => !v);
    if (callOnClickOnFlip && onClick) onClick();
  }, [callOnClickOnFlip, onClick]);

  // IMPORTANT: iOS + Embla can swallow "click" during swipe; pointer-up is more reliable.
  const handlePointerUp = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement | null;
    // Don't flip when pressing actionable elements
    if (target?.closest("button,a,input,textarea,select,[data-no-flip='true']")) return;
    flip();
  };

  const bgLayers = () => (
    <div className="pointer-events-none absolute inset-0">
      <div className={`absolute inset-0 bg-gradient-to-br ${tone.frame}`} />
      <div className="absolute inset-0 opacity-[0.06]">
        <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-foreground" />
        <div className="absolute -left-32 -bottom-32 h-80 w-80 rounded-full bg-foreground" />
      </div>
      <div
        className="absolute inset-0 opacity-[0.045]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(135deg, rgba(0,0,0,0.35), rgba(0,0,0,0.35) 1px, transparent 1px, transparent 6px)",
        }}
      />
    </div>
  );

  const FaceShell = ({ children }: { children: React.ReactNode }) => (
    <div
      className={[
        // Solid backgrounds so you don't see through to the page/other slides
        "relative overflow-hidden rounded-[6px] border border-black/15",
        "bg-background",
        // Fill stage + pin footer using flex
        "h-full flex flex-col",
        // Inner ring for depth
        "ring-1 ring-inset ring-white/20 dark:ring-white/10",
      ].join(" ")}
    >
      {bgLayers()}
      <div className="relative h-full flex flex-col p-3">{children}</div>
    </div>
  );

  const renderFront = () => (
    <FaceShell>
      {/* header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div
            className={[
              "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-wide",
              tone.chip,
              badge === "OWNED" || badge === "NEMESIS" ? "shadow-md" : "shadow-sm",
            ].join(" ")}
          >
            <span aria-hidden>{badgeIcon}</span>
            <span>{badgeText ?? badge}</span>
          </div>

          {rarity ? (
            <div className={`inline-flex items-center rounded-full border px-2 py-1 text-[11px] uppercase tracking-wide ${rarityTone}`}>
              {rarity}
            </div>
          ) : null}
        </div>

        <div className="text-right">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
          <div className="mt-0.5 text-[10px] uppercase tracking-wider opacity-70">{setCode}</div>
        </div>
      </div>

      {/* avatar */}
      <div className="mt-2 flex items-center justify-center">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={name}
            className={[
              "h-[88px] w-[88px] rounded-md object-cover border-[3px] bg-background shadow-md",
              tone.border,
              badge === "OWNED" ? "ring-2 ring-inset ring-emerald-300/40" : badge === "NEMESIS" ? "ring-2 ring-inset ring-rose-300/40" : badge === "RIVAL" ? "ring-2 ring-inset ring-amber-300/40" : "",
            ].join(" ")}
          />
        ) : (
          <div className={[
            "h-[88px] w-[88px] rounded-md border-[3px] bg-background flex items-center justify-center text-sm text-muted-foreground shadow-md",
            tone.border,
            badge === "OWNED" ? "ring-2 ring-inset ring-emerald-300/40" : badge === "NEMESIS" ? "ring-2 ring-inset ring-rose-300/40" : badge === "RIVAL" ? "ring-2 ring-inset ring-amber-300/40" : "",
          ].join(" ")}>
            FR
          </div>
        )}
      </div>

      {/* nameplate */}
      <div className="mt-1.5 text-center">
        <div className="mx-6 rounded-md border border-black/10 bg-black/5 py-1">
          <div className="text-xl font-extrabold tracking-wide uppercase leading-tight line-clamp-2">{name}</div>
        </div>
        {punchline ? <div className="mt-1 text-xs text-muted-foreground">{punchline}</div> : null}
      </div>

      {/* primary stat */}
      <div className="mt-2 text-center">
        <div className="text-5xl font-black leading-none">{primaryStat.value}</div>
        {primaryStat.label ? <div className={`mt-1.5 text-sm font-bold uppercase tracking-wide ${tone.accent}`}>{primaryStat.label}</div> : null}
      </div>

      {/* stat lines */}
      {lines.length ? (
        <div className="mt-2 space-y-1.5">
          {lines.slice(0, 4).map((l) => (
            <div key={l.label} className="flex items-center justify-between gap-3 rounded-md border border-black/10 bg-background/80 px-3 py-1.5">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{l.label}</div>
              <div className="text-sm font-semibold">{l.value}</div>
            </div>
          ))}
        </div>
      ) : null}

      {/* footer pinned */}
      <div className="mt-auto pt-0.5 flex items-center justify-between text-[11px] text-muted-foreground">
        <div>{season}</div>
        <div className="flex items-center gap-2">
          <div className="opacity-80">{watermark}</div>
          <div className="font-mono opacity-60">
            {setCode}-{cardNo}
          </div>
        </div>
      </div>

      {/* hint */}
      <div className="pt-0.5 pb-2 text-[10px] opacity-50">Tap to flip</div>
    </FaceShell>
  );

  const renderBack = () => {
    const backHeadline = back?.headline ?? "ROAST NOTES";
    const backSubhead = back?.subhead ?? "Scouting report (unverified)";
    const backLines = (back?.lines?.length ? back.lines : lines).slice(0, 5);

    return (
      <FaceShell>
        {/* top header */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{backHeadline}</div>
            <div className="mt-0.5 text-[10px] uppercase tracking-wider opacity-70">{backSubhead}</div>
          </div>

          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{setCode}</div>
            <div className="mt-0.5 text-[10px] font-mono opacity-60">
              {setCode}-{cardNo}
            </div>
          </div>
        </div>

        {/* summary */}
        <div className="mt-3 rounded-md border border-black/10 bg-black/5 p-3">
          <div className="text-sm font-semibold">Summary</div>
          <div className="mt-1 text-xs text-muted-foreground">{punchline ?? "Tap to flip back."}</div>
        </div>

        {/* details */}
        {backLines.length ? (
          <div className="mt-3 space-y-2">
            {backLines.map((l) => (
              <div key={l.label} className="flex items-center justify-between gap-3 rounded-md border border-black/10 bg-background/80 px-3 py-2">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{l.label}</div>
                <div className="text-sm font-semibold">{l.value}</div>
              </div>
            ))}
          </div>
        ) : null}

        {/* optional action button (doesn't flip because of data-no-flip + stopPropagation) */}
        {onClick ? (
          <button
            type="button"
            data-no-flip="true"
            className="mt-4 w-full rounded-md border bg-background/90 px-3 py-2 text-sm font-semibold hover:bg-background transition"
            onPointerUp={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
          >
            View matchup
          </button>
        ) : null}

        {/* footer pinned */}
        <div className="mt-auto pt-3 flex items-center justify-between text-[11px] text-muted-foreground">
          <div>{back?.footerLeft ?? "Tap to flip back"}</div>
          <div className="opacity-80">{back?.footerRight ?? watermark}</div>
        </div>
      </FaceShell>
    );
  };

  // ✅ Fixed height (important): prevents “blank card” + weird overlaps because faces are absolute
  const STAGE = "h-[470px]"; // tweak if you want taller cards later

  return (
    <Card
      className={[
        "relative overflow-hidden border-[3px] p-1 rounded-md",
        STAGE,
        tone.border,
        "cursor-pointer select-none",
        "touch-manipulation",
        "shadow-lg",
      ].join(" ")}
      onPointerUp={handlePointerUp}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") flip();
      }}
      role="button"
      tabIndex={0}
      aria-pressed={flipped}
    >
      {/* 3D stage */}
      <div className={`relative ${STAGE} [perspective:1200px]`}>
        {/* flipper */}
        <div
          className={[
            "relative h-full transition-transform duration-500 [transform-style:preserve-3d]",
            flipped ? "[transform:rotateY(180deg)]" : "",
          ].join(" ")}
        >
          {/* FRONT */}
          <div
            className={[
              "absolute inset-0",
              // Safari needs the -webkit variant; Tailwind arbitrary lets us set it
              "[backface-visibility:hidden] [-webkit-backface-visibility:hidden]",
            ].join(" ")}
          >
            {renderFront()}
          </div>

          {/* BACK */}
          <div
            className={[
              "absolute inset-0 [transform:rotateY(180deg)]",
              "[backface-visibility:hidden] [-webkit-backface-visibility:hidden]",
            ].join(" ")}
          >
            {renderBack()}
          </div>
        </div>
      </div>
    </Card>
  );
}