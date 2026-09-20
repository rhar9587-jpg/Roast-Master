import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Download, Share2 } from "lucide-react";
import { exportCardPng, dataUrlToFile, downloadDataUrl } from "@/lib/exportCardImage";
import { WatermarkOverlay } from "@/components/ui/WatermarkOverlay";
import { BRAND_NAME, PRICE_LABEL, SITE_HOST } from "@/lib/brand";
import {
  clampPosterText,
  extractHeroNumber,
  formatMargin,
  formatPosterName,
  formatScore,
  getAccentTheme,
  isBrandFooterText,
  posterNameSizeTier,
  resolveWrappedVariant,
  SHARE_CARD_ASPECT,
  SHARE_CARD_HEIGHT,
  SHARE_CARD_WIDTH,
  type MatchupData,
  type WrappedAccent,
} from "@/components/wrappedCardModel";

export type WrappedCardProps = {
  kicker?: string;
  kickerIcon?: React.ReactNode;
  title: string;
  subtitle?: string;
  bigValue?: string;
  statLabel?: string;
  extraLine?: string;
  tagline?: string;
  footer?: string;
  accent?: WrappedAccent;
  isMatchup?: boolean;
  matchupData?: MatchupData;
  showScoreBug?: boolean;
  onToggleScoreBug?: () => void;
  isPremium?: boolean;
};

function PosterShell({
  children,
  accent,
  ghost,
}: {
  children: React.ReactNode;
  accent: WrappedAccent;
  ghost?: string;
}) {
  const theme = getAccentTheme(accent);
  return (
    <div
      className="relative h-full w-full overflow-hidden text-white"
      data-share-artwork="true"
      style={{
        background: `radial-gradient(120% 80% at 10% 0%, ${theme.bgAlt} 0%, ${theme.bg} 55%, #050505 100%)`,
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full blur-3xl"
        style={{ background: theme.shape }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -left-16 h-80 w-80 rounded-full blur-3xl"
        style={{ background: theme.shape }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 h-1.5 w-full"
        style={{
          background: `linear-gradient(90deg, transparent, ${theme.glow}, transparent)`,
        }}
      />
      {ghost ? (
        <div
          aria-hidden
          className="pointer-events-none absolute -right-2 top-28 select-none font-black leading-none opacity-[0.06]"
          style={{
            fontFamily: "var(--font-sans), system-ui, sans-serif",
            fontSize: "10rem",
            letterSpacing: "-0.06em",
          }}
        >
          {ghost}
        </div>
      ) : null}
      {children}
    </div>
  );
}

/** Subtle brand line: wordmark + URL only — never duplicate. */
function BrandFooter({ context }: { context?: string }) {
  const showContext = Boolean(context && !isBrandFooterText(context));
  return (
    <div className="mt-auto pt-5">
      {showContext ? (
        <p className="mb-2 truncate text-[10px] font-medium uppercase tracking-[0.14em] text-white/30">
          {context}
        </p>
      ) : null}
      <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-3">
        <span className="text-[10px] font-semibold tracking-[0.12em] text-white/40">
          {BRAND_NAME}
        </span>
        <span className="text-[10px] font-medium tracking-[0.08em] text-white/35">
          {SITE_HOST}
        </span>
      </div>
    </div>
  );
}

function supportingNameStyle(name: string): React.CSSProperties {
  const tier = posterNameSizeTier(name);
  if (tier === "short") {
    return {
      fontFamily: "var(--font-sans), system-ui, sans-serif",
      fontSize: "1.35rem",
      lineHeight: 1.15,
      letterSpacing: "0.02em",
    };
  }
  if (tier === "medium") {
    return {
      fontFamily: "var(--font-sans), system-ui, sans-serif",
      fontSize: "1.15rem",
      lineHeight: 1.2,
      letterSpacing: "0.01em",
    };
  }
  return {
    fontFamily: "var(--font-sans), system-ui, sans-serif",
    fontSize: "1rem",
    lineHeight: 1.25,
    letterSpacing: "0",
  };
}

function HeroPoster({
  kicker,
  title,
  subtitle,
  bigValue,
  statLabel,
  extraLine,
  tagline,
  footer,
  accent,
}: {
  kicker?: string;
  title: string;
  subtitle?: string;
  bigValue?: string;
  statLabel?: string;
  extraLine?: string;
  tagline?: string;
  footer?: string;
  accent: WrappedAccent;
}) {
  const theme = getAccentTheme(accent);
  const name = formatPosterName(title, 36);
  const support = clampPosterText(subtitle, 64);
  const punch = clampPosterText(tagline, 56);
  const rawValue = clampPosterText(bigValue, 18);
  const numericHero = extractHeroNumber(rawValue);
  // Prefer clean number as the focal point when the stat is mixed ("34.2 bench pts").
  const value = numericHero ?? rawValue;
  const ghost = value?.replace(/[^\d.+-]/g, "").slice(0, 6) || undefined;
  const valueLen = value.length;

  return (
    <PosterShell accent={accent} ghost={ghost}>
      <div className="relative z-[1] flex h-full flex-col px-7 pb-6 pt-7 sm:px-8 sm:pb-7 sm:pt-8">
        {kicker ? (
          <p
            className="text-[11px] font-bold uppercase tracking-[0.28em]"
            style={{ color: theme.kicker }}
          >
            {kicker}
          </p>
        ) : null}

        {/* Supporting name — never rivals the score */}
        <p
          className="mt-5 max-w-full break-words font-bold uppercase text-white/85"
          style={supportingNameStyle(name)}
        >
          {name}
        </p>

        <div className="mt-6">
          <p
            className="font-black tabular-nums leading-none tracking-tight"
            style={{
              fontFamily: "var(--font-sans), system-ui, sans-serif",
              color: theme.highlight,
              fontSize: valueLen > 8 ? "3.75rem" : valueLen > 5 ? "5rem" : "6rem",
              letterSpacing: "-0.045em",
            }}
          >
            {value}
          </p>
          {statLabel ? (
            <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.24em] text-white/45">
              {statLabel}
            </p>
          ) : null}
        </div>

        {support ? (
          <p className="mt-5 max-w-[17rem] text-[14px] font-medium leading-snug text-white/55">
            {support}
          </p>
        ) : null}

        {extraLine ? (
          <p className="mt-2 text-xs font-medium text-white/40">
            {clampPosterText(extraLine, 72)}
          </p>
        ) : null}

        {punch ? (
          <p
            className="mt-6 text-[1.05rem] font-medium italic leading-snug text-white/75"
            style={{ fontFamily: "var(--font-sans), system-ui, sans-serif" }}
          >
            “{punch}”
          </p>
        ) : null}

        <BrandFooter context={footer} />
      </div>
    </PosterShell>
  );
}

function MatchupPoster({
  kicker,
  title,
  matchupData,
  tagline,
  footer,
  accent,
  bigValue,
}: {
  kicker?: string;
  title: string;
  matchupData: MatchupData;
  tagline?: string;
  footer?: string;
  accent: WrappedAccent;
  bigValue?: string;
}) {
  const theme = getAccentTheme(accent);
  const headline = formatPosterName(title, 24);
  const teamA = formatPosterName(matchupData.teamA, 24);
  const teamB = formatPosterName(matchupData.teamB, 24);
  const margin = bigValue?.trim() || formatMargin(matchupData);
  const punch = clampPosterText(tagline, 52);
  const ghost = margin.replace(/[^\d.+-]/g, "").slice(0, 6);

  return (
    <PosterShell accent={accent} ghost={ghost}>
      <div className="relative z-[1] flex h-full flex-col px-7 pb-6 pt-7 sm:px-8 sm:pb-7 sm:pt-8">
        {kicker ? (
          <p
            className="text-[11px] font-bold uppercase tracking-[0.28em]"
            style={{ color: theme.kicker }}
          >
            {kicker}
          </p>
        ) : null}

        <h3
          className="mt-4 whitespace-pre-line font-black uppercase leading-[0.88] tracking-tight text-white"
          style={{
            fontFamily: "var(--font-display), Impact, sans-serif",
            fontSize: headline.length > 14 ? "2.45rem" : "3.1rem",
          }}
        >
          {headline.includes(" ") && headline.length <= 16
            ? headline.replace(" ", "\n")
            : headline}
        </h3>

        {/* Margin is the primary hero */}
        <div className="mt-7">
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/40">
            Margin
          </p>
          <p
            className="mt-1 font-black tabular-nums leading-none tracking-tight"
            style={{
              fontFamily: "var(--font-sans), system-ui, sans-serif",
              color: theme.highlight,
              fontSize: "5.75rem",
              letterSpacing: "-0.05em",
            }}
          >
            {margin}
          </p>
        </div>

        {/* Matchup scores — supporting, not competing */}
        <div className="mt-7 grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-t border-white/10 pt-5">
          <div className="min-w-0">
            <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-white/55">
              {teamA}
            </p>
            <p
              className="mt-1 font-bold tabular-nums leading-none text-white/90"
              style={{
                fontFamily: "var(--font-sans), system-ui, sans-serif",
                fontSize: "1.65rem",
              }}
            >
              {formatScore(matchupData.scoreA)}
            </p>
          </div>
          <p className="px-1 text-[10px] font-black uppercase tracking-[0.28em] text-white/30">
            vs
          </p>
          <div className="min-w-0 text-right">
            <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-white/55">
              {teamB}
            </p>
            <p
              className="mt-1 font-bold tabular-nums leading-none text-white/70"
              style={{
                fontFamily: "var(--font-sans), system-ui, sans-serif",
                fontSize: "1.65rem",
              }}
            >
              {formatScore(matchupData.scoreB)}
            </p>
          </div>
        </div>

        {punch ? (
          <p
            className="mt-6 text-[1.05rem] font-medium italic leading-snug text-white/75"
            style={{ fontFamily: "var(--font-sans), system-ui, sans-serif" }}
          >
            “{punch}”
          </p>
        ) : null}

        <BrandFooter context={footer} />
      </div>
    </PosterShell>
  );
}

function VerdictPoster({
  kicker,
  title,
  subtitle,
  tagline,
  footer,
  accent,
  bigValue,
}: {
  kicker?: string;
  title: string;
  subtitle?: string;
  tagline?: string;
  footer?: string;
  accent: WrappedAccent;
  bigValue?: string;
}) {
  const theme = getAccentTheme(accent);
  const headline = formatPosterName(title, 28);
  const support = clampPosterText(subtitle, 64);
  const punch = clampPosterText(tagline, 52);
  const hero = clampPosterText(bigValue, 16);

  return (
    <PosterShell accent={accent} ghost={hero?.replace(/[^\dA-Z+-]/gi, "").slice(0, 8)}>
      <div className="relative z-[1] flex h-full flex-col px-7 pb-6 pt-7 sm:px-8 sm:pb-7 sm:pt-8">
        {kicker ? (
          <p
            className="text-[11px] font-bold uppercase tracking-[0.28em]"
            style={{ color: theme.kicker }}
          >
            {kicker}
          </p>
        ) : null}

        <h3
          className="mt-6 break-words font-black uppercase leading-[0.9] tracking-tight"
          style={{
            fontFamily: "var(--font-display), Impact, sans-serif",
            fontSize: headline.length > 18 ? "2.4rem" : "3.2rem",
            color: theme.highlight,
          }}
        >
          {headline}
        </h3>

        {hero && hero !== "—" && hero !== "-" ? (
          <p
            className="mt-5 text-3xl font-black tabular-nums text-white/90"
            style={{ fontFamily: "var(--font-sans), system-ui, sans-serif" }}
          >
            {hero}
          </p>
        ) : null}

        {support ? (
          <p className="mt-5 max-w-[17rem] text-[14px] font-medium leading-snug text-white/55">
            {support}
          </p>
        ) : null}

        {punch ? (
          <p
            className="mt-6 text-[1.05rem] font-medium italic leading-snug text-white/75"
            style={{ fontFamily: "var(--font-sans), system-ui, sans-serif" }}
          >
            “{punch}”
          </p>
        ) : null}

        <BrandFooter context={footer} />
      </div>
    </PosterShell>
  );
}

export function WrappedCard({
  kicker,
  kickerIcon: _kickerIcon,
  title,
  subtitle,
  bigValue,
  statLabel = "Points",
  extraLine,
  tagline,
  footer,
  accent = "green",
  isMatchup,
  matchupData,
  isPremium = false,
}: WrappedCardProps) {
  const artworkRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const theme = getAccentTheme(accent);

  const variant = resolveWrappedVariant({ isMatchup, matchupData, bigValue });

  const filename = useMemo(() => {
    const safe = (title || "roast-wrapped")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    return `${safe}.png`;
  }, [title]);

  const downloadPng = async () => {
    if (!artworkRef.current) return;
    setIsExporting(true);
    try {
      const { dataUrl } = await exportCardPng({
        element: artworkRef.current,
        filename,
        isPremium,
        backgroundColor: theme.bg,
      });
      downloadDataUrl(dataUrl, filename);
    } finally {
      setIsExporting(false);
    }
  };

  const smartShare = async () => {
    if (!artworkRef.current) return;
    setIsExporting(true);

    try {
      const shareText = "My Fantasy Wrapped";
      const shareUrl = window.location.href;

      const { dataUrl } = await exportCardPng({
        element: artworkRef.current,
        filename,
        caption: shareText,
        isPremium,
        backgroundColor: theme.bg,
      });

      const file = await dataUrlToFile(dataUrl, filename);

      if ("share" in navigator && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: "Fantasy Roast",
          text: shareText,
          files: [file],
          url: shareUrl,
        });
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        alert(isPremium ? "Link copied ✅" : "Link copied ✅. Unlock for clean exports.");
        return;
      }

      downloadDataUrl(dataUrl, filename);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[min(100%,540px)] px-1 sm:px-0">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="overflow-hidden rounded-2xl shadow-xl ring-1 ring-white/5"
      >
        {/* Export target: artwork only — buttons live outside this ref */}
        <div
          ref={artworkRef}
          className="relative mx-auto w-full overflow-hidden"
          style={{
            width: "100%",
            maxWidth: SHARE_CARD_WIDTH,
            aspectRatio: SHARE_CARD_ASPECT,
            minHeight: SHARE_CARD_HEIGHT * 0.5,
          }}
          data-variant={variant}
          data-accent={accent}
          data-export-root="share-card"
        >
          <WatermarkOverlay show={!isPremium} theme="dark" />

          {variant === "matchup" && matchupData ? (
            <MatchupPoster
              kicker={kicker}
              title={title}
              matchupData={matchupData}
              tagline={tagline}
              footer={footer}
              accent={accent}
              bigValue={bigValue}
            />
          ) : variant === "hero" ? (
            <HeroPoster
              kicker={kicker}
              title={title}
              subtitle={subtitle}
              bigValue={bigValue}
              statLabel={statLabel}
              extraLine={extraLine}
              tagline={tagline}
              footer={footer}
              accent={accent}
            />
          ) : (
            <VerdictPoster
              kicker={kicker}
              title={title}
              subtitle={subtitle}
              tagline={tagline}
              footer={footer}
              accent={accent}
              bigValue={bigValue}
            />
          )}
        </div>

        {/* Share controls — never inside export ref */}
        <div className="flex flex-col gap-2 border-t border-border/60 bg-white px-3 py-3 sm:px-4 sm:py-4">
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => void downloadPng()}
              disabled={isExporting}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60 sm:px-4"
            >
              <Download className="h-4 w-4" />
              {isExporting ? "Preparing…" : "Download PNG"}
            </button>

            <div className="group relative">
              <button
                type="button"
                onClick={() => void smartShare()}
                disabled={isExporting}
                className="inline-flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-sm font-semibold text-foreground disabled:opacity-60 sm:px-4"
              >
                <Share2 className="h-4 w-4" />
                Post the Roast
              </button>
              <div
                role="tooltip"
                className="pointer-events-none absolute -top-11 right-0 z-50 whitespace-nowrap rounded-lg bg-black/90 px-3 py-2 text-xs font-semibold text-white opacity-0 shadow-lg transition group-hover:translate-y-0 group-hover:opacity-100"
              >
                Let the league witness this.
              </div>
            </div>
          </div>
          {!isPremium && (
            <p className="text-right text-xs text-gray-500">
              Watermark removed when you unlock ({PRICE_LABEL})
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
