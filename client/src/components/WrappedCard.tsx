import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Download, Share2 } from "lucide-react";
import { exportCardPng, dataUrlToFile, downloadDataUrl } from "@/lib/exportCardImage";
import { WatermarkOverlay } from "@/components/ui/WatermarkOverlay";
import { BRAND_NAME, PRICE_LABEL, SHARE_FOOTER, SITE_HOST } from "@/lib/brand";
import {
  clampPosterText,
  formatMargin,
  formatPosterName,
  formatScore,
  getAccentTheme,
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
      style={{
        background: `radial-gradient(120% 80% at 10% 0%, ${theme.bgAlt} 0%, ${theme.bg} 55%, #050505 100%)`,
      }}
    >
      {/* Accent shapes — export-safe, no animation */}
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
          className="pointer-events-none absolute -right-4 top-24 select-none font-black leading-none opacity-[0.07]"
          style={{
            fontFamily: "var(--font-display), Impact, sans-serif",
            fontSize: "11rem",
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

function BrandFooter({ left }: { left?: string }) {
  return (
    <div className="mt-auto flex items-end justify-between gap-3 pt-6">
      <div className="min-w-0 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
        <span className="block truncate">{left || BRAND_NAME}</span>
      </div>
      <div className="shrink-0 text-right text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
        <span className="block">{SHARE_FOOTER || SITE_HOST}</span>
      </div>
    </div>
  );
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
  const name = formatPosterName(title, 32);
  const support = clampPosterText(subtitle, 72);
  const punch = clampPosterText(tagline, 64);
  const value = clampPosterText(bigValue, 18);
  const ghost = value?.replace(/[^\d.+-]/g, "").slice(0, 6) || undefined;

  return (
    <PosterShell accent={accent} ghost={ghost}>
      <div className="relative z-[1] flex h-full flex-col px-8 pb-7 pt-8">
        {kicker ? (
          <p
            className="text-[11px] font-bold uppercase tracking-[0.28em]"
            style={{ color: theme.kicker }}
          >
            {kicker}
          </p>
        ) : null}

        <h3
          className="mt-5 break-words font-black uppercase leading-[0.88] tracking-tight"
          style={{
            fontFamily: "var(--font-display), Impact, sans-serif",
            fontSize: name.length > 18 ? "2.35rem" : "3.1rem",
          }}
        >
          {name}
        </h3>

        <div className="mt-8">
          {statLabel ? (
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/40">
              {statLabel}
            </p>
          ) : null}
          <p
            className="mt-1 font-black tabular-nums leading-none tracking-tight"
            style={{
              color: theme.highlight,
              fontSize: "5.5rem",
              letterSpacing: "-0.04em",
            }}
          >
            {value}
          </p>
        </div>

        {support ? (
          <p className="mt-6 max-w-[18rem] text-[15px] font-medium leading-snug text-white/65">
            {support}
          </p>
        ) : null}

        {extraLine ? (
          <p className="mt-3 text-xs font-medium text-white/45">
            {clampPosterText(extraLine, 80)}
          </p>
        ) : null}

        {punch ? (
          <p
            className="mt-8 text-lg font-semibold italic leading-snug text-white/80"
            style={{ fontFamily: "var(--font-sans), system-ui, sans-serif" }}
          >
            “{punch}”
          </p>
        ) : null}

        <BrandFooter left={footer} />
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
  const teamA = formatPosterName(matchupData.teamA, 22);
  const teamB = formatPosterName(matchupData.teamB, 22);
  const margin = bigValue?.trim() || formatMargin(matchupData);
  const punch = clampPosterText(tagline, 56);
  const ghost = margin.replace(/[^\d.+-]/g, "").slice(0, 6);

  return (
    <PosterShell accent={accent} ghost={ghost}>
      <div className="relative z-[1] flex h-full flex-col px-7 pb-7 pt-8">
        {kicker ? (
          <p
            className="text-[11px] font-bold uppercase tracking-[0.28em]"
            style={{ color: theme.kicker }}
          >
            {kicker}
          </p>
        ) : null}

        <h3
          className="mt-4 whitespace-pre-line font-black uppercase leading-[0.85] tracking-tight"
          style={{
            fontFamily: "var(--font-display), Impact, sans-serif",
            fontSize: headline.length > 14 ? "2.6rem" : "3.4rem",
          }}
        >
          {headline.includes(" ") && headline.length <= 16
            ? headline.replace(" ", "\n")
            : headline}
        </h3>

        <div className="mt-8 space-y-5">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold uppercase tracking-wide text-white/70">
                {teamA}
              </p>
              <p
                className="mt-1 font-black tabular-nums leading-none"
                style={{ fontSize: "2.75rem", color: theme.highlight }}
              >
                {formatScore(matchupData.scoreA)}
              </p>
            </div>
            <p className="pb-2 text-[11px] font-black uppercase tracking-[0.3em] text-white/35">
              vs
            </p>
            <div className="min-w-0 flex-1 text-right">
              <p className="truncate text-[13px] font-semibold uppercase tracking-wide text-white/70">
                {teamB}
              </p>
              <p className="mt-1 font-black tabular-nums leading-none text-white/85" style={{ fontSize: "2.75rem" }}>
                {formatScore(matchupData.scoreB)}
              </p>
            </div>
          </div>

          <div
            className="rounded-2xl px-4 py-3"
            style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${theme.glow}33` }}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/40">
              Margin
            </p>
            <p
              className="mt-1 font-black tabular-nums leading-none tracking-tight"
              style={{ color: theme.highlight, fontSize: "4.25rem", letterSpacing: "-0.04em" }}
            >
              {margin}
            </p>
          </div>
        </div>

        {punch ? (
          <p className="mt-7 text-lg font-semibold italic leading-snug text-white/80">
            “{punch}”
          </p>
        ) : null}

        <BrandFooter left={footer} />
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
  const headline = formatPosterName(title, 36);
  const support = clampPosterText(subtitle, 90);
  const punch = clampPosterText(tagline, 70);

  return (
    <PosterShell accent={accent}>
      <div className="relative z-[1] flex h-full flex-col px-8 pb-7 pt-8">
        {kicker ? (
          <p
            className="text-[11px] font-bold uppercase tracking-[0.28em]"
            style={{ color: theme.kicker }}
          >
            {kicker}
          </p>
        ) : null}

        <h3
          className="mt-8 break-words font-black uppercase leading-[0.9] tracking-tight"
          style={{
            fontFamily: "var(--font-display), Impact, sans-serif",
            fontSize: headline.length > 22 ? "2.2rem" : "3rem",
          }}
        >
          {headline}
        </h3>

        {bigValue && bigValue !== "—" && bigValue !== "-" ? (
          <p className="mt-6 text-4xl font-black tabular-nums" style={{ color: theme.highlight }}>
            {clampPosterText(bigValue, 24)}
          </p>
        ) : null}

        {support ? (
          <p className="mt-6 max-w-[20rem] text-base font-medium leading-snug text-white/65">
            {support}
          </p>
        ) : null}

        {punch ? (
          <p className="mt-8 text-lg font-semibold italic leading-snug text-white/80">
            “{punch}”
          </p>
        ) : null}

        <BrandFooter left={footer} />
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
  const ref = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const variant = resolveWrappedVariant({ isMatchup, matchupData, bigValue });

  const filename = useMemo(() => {
    const safe = (title || "roast-wrapped")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    return `${safe}.png`;
  }, [title]);

  const downloadPng = async () => {
    if (!ref.current) return;
    setIsExporting(true);
    try {
      const { dataUrl } = await exportCardPng({
        element: ref.current,
        filename,
        isPremium,
      });
      downloadDataUrl(dataUrl, filename);
    } finally {
      setIsExporting(false);
    }
  };

  const smartShare = async () => {
    if (!ref.current) return;
    setIsExporting(true);

    try {
      const shareText = "My Fantasy Wrapped";
      const shareUrl = window.location.href;

      const { dataUrl } = await exportCardPng({
        element: ref.current,
        filename,
        caption: shareText,
        isPremium,
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
    <div className="mx-auto w-full max-w-[540px]">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="overflow-hidden rounded-2xl shadow-2xl"
      >
        {/* Fixed share canvas — export target */}
        <div
          ref={ref}
          className="relative mx-auto w-full overflow-hidden"
          style={{
            width: "100%",
            maxWidth: SHARE_CARD_WIDTH,
            aspectRatio: SHARE_CARD_ASPECT,
            minHeight: SHARE_CARD_HEIGHT * 0.55,
          }}
          data-variant={variant}
          data-accent={accent}
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

        {/* Share controls (not exported) */}
        <div className="flex flex-col gap-2 bg-white p-4">
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => void downloadPng()}
              disabled={isExporting}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 font-semibold text-primary-foreground disabled:opacity-60"
            >
              <Download className="h-4 w-4" />
              {isExporting ? "Preparing…" : "Download PNG"}
            </button>

            <div className="group relative">
              <button
                type="button"
                onClick={() => void smartShare()}
                disabled={isExporting}
                className="inline-flex items-center gap-2 rounded-xl bg-muted px-4 py-2 font-semibold text-foreground disabled:opacity-60"
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
