/**
 * Public weekly share page: load recap-safe data, SSR HTML with OG tags, OG PNG.
 *
 * Privacy: only league-public roast beats (names, scores, headlines).
 * Never includes commissioner notes, emails, Stripe, or unlock state.
 */

import { Resvg } from "@resvg/resvg-js";
import { BRAND_NAME, SITE_HOST, SITE_URL } from "@shared/site";
import {
  clampShareWeek,
  weeklyLeagueAppUrl,
  weeklyPublicShareOgImageUrl,
  weeklyPublicShareUrl,
} from "@shared/weeklyShareUrl";
import { getNflWeekContext, resolveLeagueWeekFinality } from "../league-history/nflState";
import {
  DEMO_LEAGUE_ID,
  getDemoWeeklyRoast,
} from "../league-history/demoLeague";
import { DEMO_LEAGUE_NAME } from "../league-history/demo/canonicalDemoFixture";
import { fetchJson, type SleeperLeague, type SleeperMatchup, type SleeperRoster, type SleeperUser } from "../league-history/sleeper";
import { buildWeeklyRoastNarrative } from "./weeklyRoastEngine";

export type WeeklyPublicShareBeat = {
  title: string;
  subtitle: string;
  stat?: string;
};

export type WeeklyPublicShareData = {
  leagueId: string;
  leagueName: string;
  week: number;
  mode: "recap";
  headline: string;
  summary: string;
  heroFact: string;
  weekIsFinal: boolean;
  isDemo: boolean;
  beats: WeeklyPublicShareBeat[];
};

export type WeeklyPublicShareErrorCode =
  | "invalid_league"
  | "invalid_week"
  | "not_found"
  | "no_data"
  | "upstream";

export class WeeklyPublicShareError extends Error {
  code: WeeklyPublicShareErrorCode;
  status: number;

  constructor(code: WeeklyPublicShareErrorCode, message: string, status = 404) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function escapeHtml(raw: string): string {
  return String(raw)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeXml(raw: string): string {
  return escapeHtml(raw);
}

function truncate(text: string, max: number): string {
  const t = String(text || "").trim().replace(/\s+/g, " ");
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
}

function buildUserMap(users: SleeperUser[]) {
  const map = new Map<string, SleeperUser>();
  for (const u of users) map.set(u.user_id, u);
  return map;
}

function rosterDisplayName(
  rosters: SleeperRoster[],
  userById: Map<string, SleeperUser>,
  rid: number,
): string {
  const roster = rosters.find((r) => r.roster_id === rid);
  const owner = roster?.owner_id ? userById.get(roster.owner_id) : null;
  return owner?.display_name || owner?.username || `Roster ${rid}`;
}

function pickHeroFact(params: {
  week: number;
  highestName?: string;
  highestScore?: number;
  blowoutSubtitle?: string;
  weekIsFinal: boolean;
}): string {
  if (params.weekIsFinal && params.highestName && Number.isFinite(params.highestScore)) {
    return `Top scorer: ${params.highestName} — ${Number(params.highestScore).toFixed(1)} pts`;
  }
  if (params.weekIsFinal && params.blowoutSubtitle) {
    return truncate(params.blowoutSubtitle, 96);
  }
  return `Week ${params.week} Recap`;
}

function publicBeatsFromCards(
  cards: Array<{ type?: string; title?: string; subtitle?: string; stat?: string }>,
): WeeklyPublicShareBeat[] {
  const allow = new Set([
    "top_dog",
    "biggest_embarrassment",
    "fraud_watch",
    "group_chat_drop",
  ]);
  return cards
    .filter((c) => c.type && allow.has(String(c.type)))
    .slice(0, 3)
    .map((c) => ({
      title: String(c.title || "").trim() || "Recap",
      subtitle: truncate(String(c.subtitle || ""), 140),
      ...(c.stat ? { stat: String(c.stat) } : {}),
    }));
}

async function loadLiveWeeklyPublicShare(
  leagueId: string,
  week: number,
): Promise<WeeklyPublicShareData> {
  let league: SleeperLeague;
  let rosters: SleeperRoster[];
  let users: SleeperUser[];
  let matchups: SleeperMatchup[];
  try {
    [league, rosters, users, matchups] = await Promise.all([
      fetchJson<SleeperLeague>(`https://api.sleeper.app/v1/league/${leagueId}`),
      fetchJson<SleeperRoster[]>(`https://api.sleeper.app/v1/league/${leagueId}/rosters`),
      fetchJson<SleeperUser[]>(`https://api.sleeper.app/v1/league/${leagueId}/users`),
      fetchJson<SleeperMatchup[]>(`https://api.sleeper.app/v1/league/${leagueId}/matchups/${week}`),
    ]);
  } catch (err: any) {
    const msg = String(err?.message || err || "");
    if (msg.includes("404") || /not found/i.test(msg)) {
      throw new WeeklyPublicShareError("not_found", "League or week not found.", 404);
    }
    throw new WeeklyPublicShareError("upstream", "Could not load league data right now.", 502);
  }

  if (!league?.league_id) {
    throw new WeeklyPublicShareError("not_found", "League not found.", 404);
  }
  if (!matchups?.length) {
    throw new WeeklyPublicShareError("no_data", `No matchup data for week ${week}.`, 404);
  }

  const nfl = await getNflWeekContext().catch(() => null);
  const weekIsFinal = resolveLeagueWeekFinality(week, league.season, nfl);
  const userById = buildUserMap(users);
  const rosterName = (rid: number) => rosterDisplayName(rosters, userById, rid);

  const narrative = await buildWeeklyRoastNarrative({
    league: { league_id: league.league_id, name: league.name, season: league.season },
    week,
    matchups,
    rosterName,
    weekIsFinal,
  });

  const blowout = narrative.cards.find((c) => c.type === "biggest_embarrassment");
  const heroFact = pickHeroFact({
    week,
    highestName: narrative.stats.highestScorer?.username,
    highestScore: narrative.stats.highestScorer?.score,
    blowoutSubtitle: blowout?.subtitle,
    weekIsFinal,
  });

  return {
    leagueId: league.league_id,
    leagueName: league.name || "Fantasy League",
    week,
    mode: "recap",
    headline: narrative.headline,
    summary: narrative.groupChatSummary,
    heroFact,
    weekIsFinal,
    isDemo: false,
    beats: publicBeatsFromCards(narrative.cards),
  };
}

export async function loadWeeklyPublicShare(
  leagueIdRaw: string,
  weekRaw: number,
): Promise<WeeklyPublicShareData> {
  const leagueId = String(leagueIdRaw || "").trim();
  if (!leagueId) {
    throw new WeeklyPublicShareError("invalid_league", "Missing league id.", 400);
  }
  const weekNum = Number(weekRaw);
  if (!Number.isFinite(weekNum) || weekNum < 1 || weekNum > 18 || Math.floor(weekNum) !== weekNum) {
    throw new WeeklyPublicShareError("invalid_week", "Week must be a whole number from 1 to 18.", 400);
  }
  const week = clampShareWeek(weekNum);

  if (leagueId === DEMO_LEAGUE_ID) {
    try {
      const demo = await getDemoWeeklyRoast({ week });
      const league = demo.league as { league_id: string; name: string };
      const stats = demo.stats as {
        highestScorer?: { username?: string; score?: number };
      };
      const cards = (demo.cards || []) as Array<{
        type?: string;
        title?: string;
        subtitle?: string;
        stat?: string;
      }>;
      const blowout = cards.find((c) => c.type === "biggest_embarrassment");
      return {
        leagueId: league.league_id || DEMO_LEAGUE_ID,
        leagueName: league.name || DEMO_LEAGUE_NAME,
        week,
        mode: "recap",
        headline: String(demo.headline || `Week ${week} Recap`),
        summary: String(demo.groupChatSummary || ""),
        heroFact: pickHeroFact({
          week,
          highestName: stats.highestScorer?.username,
          highestScore: stats.highestScorer?.score,
          blowoutSubtitle: blowout?.subtitle,
          weekIsFinal: true,
        }),
        weekIsFinal: true,
        isDemo: true,
        beats: publicBeatsFromCards(cards),
      };
    } catch (err: any) {
      const msg = String(err?.message || err || "");
      if (/no matchup data/i.test(msg)) {
        throw new WeeklyPublicShareError("no_data", `No matchup data for week ${week}.`, 404);
      }
      throw new WeeklyPublicShareError("upstream", "Could not load demo recap.", 502);
    }
  }

  return loadLiveWeeklyPublicShare(leagueId, week);
}

export function buildShareOgTitle(data: Pick<WeeklyPublicShareData, "leagueName" | "week">): string {
  return `${BRAND_NAME} — ${data.leagueName} — Week ${data.week}`;
}

export function buildShareOgDescription(
  data: Pick<WeeklyPublicShareData, "week" | "summary" | "heroFact">,
): string {
  const base = `Week ${data.week} recap: top scorer, biggest blowout, fraud watch and league receipts.`;
  const hero = truncate(data.heroFact || "", 80);
  const summary = truncate(data.summary || "", 120);
  if (hero && summary) return truncate(`${hero} ${summary}`, 180);
  if (summary) return truncate(summary, 180);
  if (hero) return truncate(`${hero}. ${base}`, 180);
  return base;
}

export function buildWeeklySharePageHtml(
  data: WeeklyPublicShareData,
  origin: string = SITE_URL,
): string {
  const pageUrl = weeklyPublicShareUrl(data.leagueId, data.week, origin);
  const imageUrl = weeklyPublicShareOgImageUrl(data.leagueId, data.week, origin);
  const appUrl = weeklyLeagueAppUrl(data.leagueId, origin);
  const homeUrl = String(origin || SITE_URL).replace(/\/$/, "") || SITE_URL;
  const title = buildShareOgTitle(data);
  const description = buildShareOgDescription(data);
  const beatsHtml = data.beats
    .map(
      (b) => `
      <article class="beat">
        <h2>${escapeHtml(b.title)}</h2>
        ${b.stat ? `<p class="stat">${escapeHtml(b.stat)}</p>` : ""}
        <p>${escapeHtml(b.subtitle)}</p>
      </article>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <link rel="canonical" href="${escapeHtml(pageUrl)}" />
  <meta property="og:site_name" content="${escapeHtml(BRAND_NAME)}" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${escapeHtml(imageUrl)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:url" content="${escapeHtml(pageUrl)}" />
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(imageUrl)}" />
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", ui-sans-serif, system-ui, -apple-system, sans-serif;
      background: radial-gradient(1200px 600px at 20% -10%, #1a3d2a 0%, transparent 55%),
        radial-gradient(900px 500px at 100% 0%, #122033 0%, transparent 50%),
        #070b10;
      color: #e8eef5;
      min-height: 100vh;
    }
    main { max-width: 720px; margin: 0 auto; padding: 32px 20px 64px; }
    .brand { font-size: 13px; letter-spacing: 0.14em; text-transform: uppercase; color: #86efac; font-weight: 700; }
    h1 { font-size: clamp(1.6rem, 4vw, 2.2rem); line-height: 1.15; margin: 10px 0 8px; }
    .league { color: #cbd5e1; font-size: 1.05rem; margin: 0 0 18px; }
    .hero {
      border: 1px solid rgba(134, 239, 172, 0.25);
      background: linear-gradient(135deg, rgba(15, 42, 24, 0.9), rgba(7, 20, 12, 0.95));
      border-radius: 16px; padding: 18px 18px 16px; margin-bottom: 22px;
    }
    .hero .kicker { color: #86efac; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 700; }
    .hero .fact { font-size: 1.25rem; font-weight: 700; margin: 8px 0 0; }
    .summary { color: #cbd5e1; line-height: 1.5; margin: 0 0 24px; }
    .beats { display: grid; gap: 12px; margin-bottom: 28px; }
    .beat { border: 1px solid rgba(148, 163, 184, 0.2); border-radius: 14px; padding: 14px 16px; background: rgba(15, 23, 42, 0.55); }
    .beat h2 { margin: 0 0 4px; font-size: 0.95rem; }
    .beat .stat { margin: 0 0 6px; color: #a3e635; font-weight: 700; }
    .beat p { margin: 0; color: #94a3b8; font-size: 0.92rem; line-height: 1.4; }
    .cta {
      display: inline-block; background: #34d399; color: #052e16; font-weight: 800;
      text-decoration: none; border-radius: 999px; padding: 12px 18px;
    }
    .cta:hover { filter: brightness(1.05); }
    .sub { margin-top: 14px; font-size: 0.85rem; color: #94a3b8; }
    .sub a { color: #7dd3fc; }
    footer { margin-top: 36px; color: #64748b; font-size: 12px; }
  </style>
</head>
<body>
  <main>
    <div class="brand">${escapeHtml(BRAND_NAME)}</div>
    <h1>Week ${data.week} Recap</h1>
    <p class="league">${escapeHtml(data.leagueName)}</p>
    <section class="hero">
      <div class="kicker">${data.weekIsFinal ? "League receipt" : "Week still in progress"}</div>
      <p class="fact">${escapeHtml(data.heroFact)}</p>
    </section>
    <p class="summary">${escapeHtml(truncate(data.summary || data.headline, 280))}</p>
    <div class="beats">${beatsHtml}</div>
    <a class="cta" href="${escapeHtml(homeUrl)}">See your own league</a>
    <p class="sub">
      Open this league in the app:
      <a href="${escapeHtml(appUrl)}">${escapeHtml(SITE_HOST)}</a>
    </p>
    <footer>Shared via ${escapeHtml(BRAND_NAME)} · ${escapeHtml(SITE_HOST)}</footer>
  </main>
</body>
</html>`;
}

export function buildWeeklyShareErrorHtml(
  message: string,
  origin: string = SITE_URL,
  status = 404,
): string {
  const homeUrl = String(origin || SITE_URL).replace(/\/$/, "") || SITE_URL;
  const title = `${BRAND_NAME} — Recap unavailable`;
  const description = truncate(message || "This weekly recap could not be loaded.", 160);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta name="robots" content="noindex" />
  <style>
    body { margin:0; font-family: ui-sans-serif, system-ui, sans-serif; background:#070b10; color:#e8eef5; }
    main { max-width:560px; margin:0 auto; padding:48px 20px; }
    .brand { color:#86efac; letter-spacing:.12em; text-transform:uppercase; font-size:12px; font-weight:700; }
    h1 { font-size:1.6rem; }
    a { color:#34d399; font-weight:700; text-decoration:none; }
  </style>
</head>
<body>
  <main>
    <div class="brand">${escapeHtml(BRAND_NAME)}</div>
    <h1>${status === 400 ? "Invalid share link" : "Recap not found"}</h1>
    <p>${escapeHtml(description)}</p>
    <p><a href="${escapeHtml(homeUrl)}">See your own league</a></p>
  </main>
</body>
</html>`;
}

/** 1200×630 branded OG SVG (no buttons/controls). */
export function buildWeeklyShareOgSvg(data: WeeklyPublicShareData): string {
  const title = truncate(data.leagueName, 42);
  const hero = truncate(data.heroFact, 64);
  const summary = truncate(data.summary || data.headline, 90);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f2a18"/>
      <stop offset="55%" stop-color="#07140c"/>
      <stop offset="100%" stop-color="#060b16"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="1080" cy="80" r="220" fill="#34d399" fill-opacity="0.12"/>
  <circle cx="80" cy="560" r="180" fill="#38bdf8" fill-opacity="0.10"/>
  <rect x="56" y="56" width="8" height="518" rx="4" fill="#34d399"/>
  <text x="90" y="110" fill="#86efac" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="700" letter-spacing="4">${escapeXml(BRAND_NAME.toUpperCase())}</text>
  <text x="90" y="190" fill="#f8fafc" font-family="Arial, Helvetica, sans-serif" font-size="54" font-weight="800">${escapeXml(title)}</text>
  <text x="90" y="260" fill="#a3e635" font-family="Arial, Helvetica, sans-serif" font-size="40" font-weight="700">Week ${data.week} Recap</text>
  <text x="90" y="360" fill="#e2e8f0" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="700">${escapeXml(hero)}</text>
  <text x="90" y="420" fill="#94a3b8" font-family="Arial, Helvetica, sans-serif" font-size="26">${escapeXml(summary)}</text>
  <text x="90" y="560" fill="#64748b" font-family="Arial, Helvetica, sans-serif" font-size="22">${escapeXml(SITE_HOST)}</text>
</svg>`;
}

export function renderWeeklyShareOgPng(data: WeeklyPublicShareData): Buffer {
  const svg = buildWeeklyShareOgSvg(data);
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: 1200 },
  });
  return Buffer.from(resvg.render().asPng());
}

/** Cache completed weeks longer; keep live/incomplete weeks shorter. */
export function weeklyShareCacheControl(weekIsFinal: boolean): string {
  if (weekIsFinal) {
    return "public, max-age=300, s-maxage=1800, stale-while-revalidate=86400";
  }
  return "public, max-age=60, s-maxage=120, stale-while-revalidate=600";
}
