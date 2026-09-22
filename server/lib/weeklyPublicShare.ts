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
  roastMyLeagueUrl,
  weeklyLeagueAppUrl,
  weeklyPublicShareOgImageUrl,
  weeklyPublicShareUrl,
} from "@shared/weeklyShareUrl";
import { weekSlateHeadline } from "@shared/weekSlateLabels";
import { formatRankMovementLabel } from "@shared/rankMovement";
import { getWeeklyShareOgFallbackPngBytes } from "../assets/weeklyShareOgFallbackPng";
import { getNflWeekContext, resolveLeagueWeekFinality } from "../league-history/nflState";
import {
  DEMO_LEAGUE_ID,
  getDemoPowerRankingInputs,
  getDemoWeeklyRoast,
} from "../league-history/demoLeague";
import {
  DEMO_ICONIC_SEASON,
  DEMO_LEAGUE_NAME,
  DEMO_MANAGER_BY_ROSTER,
  getSleeperMatchupsForDemoWeek,
} from "../league-history/demo/canonicalDemoFixture";
import {
  fetchJson,
  type SleeperLeague,
  type SleeperMatchup,
  type SleeperRoster,
  type SleeperUser,
} from "../league-history/sleeper";
import { completedWinnerPairs, classifyWeekMatchupPairs } from "./domain/classifyWeekMatchups";
import {
  selectPublicRecapHero,
  selectPublicRecapSupportingMoments,
  type PublicRecapHeroMoment,
} from "./publicRecapHero";
import { generatePowerRankings, type PowerRankingRow } from "./powerRankings";
import {
  buildTeamsFromSleeper,
} from "./weeklyCommissioner";
import { getStoredPreviousRankings } from "./weeklyRankingsStore";
import { buildWeeklyRoastNarrative } from "./weeklyRoastEngine";

/** Official OG image size for weekly share cards. */
export const WEEKLY_SHARE_OG_WIDTH = 1200;
export const WEEKLY_SHARE_OG_HEIGHT = 630;

export type WeeklyPublicShareBeat = {
  title: string;
  subtitle: string;
  stat?: string;
  type?: string;
};

export type WeeklyPublicShareHero = {
  title: string;
  subtitle: string;
  stat?: string;
  type: string;
};

export type WeeklyPublicShareMatchup = {
  winnerName: string;
  winnerScore: number;
  loserName: string;
  loserScore: number;
  margin: number;
};

export type WeeklyPublicShareRanking = {
  rank: number;
  teamName: string;
  record: string;
  /** Present only when prior-week history exists; never fabricate movement. */
  trend?: "up" | "down" | "flat";
  placesMoved?: number | null;
  showMovement: boolean;
  /** Shared display label: "↑ 2" | "↓ 2" | "Same" | "". */
  movementLabel?: string;
};

export type WeeklyPublicShareData = {
  leagueId: string;
  leagueName: string;
  week: number;
  mode: "recap";
  headline: string;
  summary: string;
  /** Compact one-liner for OG / fallback when no roast hero exists. */
  heroFact: string;
  /** Strongest roast moment for the public page lead (final weeks only). */
  hero: WeeklyPublicShareHero | null;
  weekIsFinal: boolean;
  /** Canonical slate readiness — completed claims only when recapReady. */
  recapReady: boolean;
  slateStatus: "final" | "live" | "upcoming" | "unavailable";
  isDemo: boolean;
  /** Completed matchup results — empty when not recapReady. */
  matchups: WeeklyPublicShareMatchup[];
  /**
   * Compact Power Rankings from the same weekly ranking source as commissioner email.
   * null = omit section (unavailable / failed load).
   */
  powerRankings: WeeklyPublicShareRanking[] | null;
  /** 2–3 supporting roast moments (excludes hero). */
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
  hero?: WeeklyPublicShareHero | null;
  recapReady: boolean;
  slateStatus: "final" | "live" | "upcoming" | "unavailable";
}): string {
  if (params.recapReady && params.hero) {
    const parts = [params.hero.title, params.hero.stat, params.hero.subtitle].filter(Boolean);
    return truncate(parts.join(" — "), 120);
  }
  if (
    params.recapReady &&
    params.highestName &&
    Number.isFinite(params.highestScore) &&
    Number(params.highestScore) > 0
  ) {
    return `Top scorer: ${params.highestName} — ${Number(params.highestScore).toFixed(1)} pts`;
  }
  if (params.recapReady && params.blowoutSubtitle) {
    return truncate(params.blowoutSubtitle, 96);
  }
  if (params.slateStatus === "live") return `Week ${params.week} is live`;
  if (params.slateStatus === "upcoming") return `Week ${params.week} Upcoming`;
  if (params.slateStatus === "unavailable") return `Week ${params.week} scores unavailable`;
  return `Week ${params.week}`;
}

function momentToBeat(m: PublicRecapHeroMoment): WeeklyPublicShareBeat {
  return {
    title: m.title,
    subtitle: truncate(m.subtitle, 140),
    type: m.type,
    ...(m.stat ? { stat: m.stat } : {}),
  };
}

function buildCompletedMatchups(
  matchups: SleeperMatchup[],
  rosterName: (rid: number) => string,
  recapReady: boolean,
): WeeklyPublicShareMatchup[] {
  if (!recapReady || !matchups?.length) return [];
  const pairs = classifyWeekMatchupPairs(matchups, { weekIsFinal: true });
  const completed = completedWinnerPairs(pairs);
  return completed
    .map((g) => ({
      winnerName: rosterName(g.winner.rosterId),
      winnerScore: g.winner.points,
      loserName: rosterName(g.loser.rosterId),
      loserScore: g.loser.points,
      margin: g.margin,
    }))
    .sort((a, b) => b.margin - a.margin);
}

/**
 * Map engine rankings → public-safe compact rows.
 * Movement indicators only when prior-week history was supplied to the engine.
 * Uses the same placesMoved / showMovement values as email + Weekly.
 */
export function toPublicShareRankings(
  rankings: PowerRankingRow[],
  options?: { hasPriorWeekHistory?: boolean },
): WeeklyPublicShareRanking[] {
  const leagueHasPrior = options?.hasPriorWeekHistory === true;
  return rankings.map((r) => {
    const show = leagueHasPrior && r.showMovement === true;
    const state = !show
      ? ("none" as const)
      : r.trend === "up"
        ? ("up" as const)
        : r.trend === "down"
          ? ("down" as const)
          : ("same" as const);
    const places = show ? r.placesMoved : null;
    const movementLabel = formatRankMovementLabel({
      state,
      places: places ?? (state === "same" ? 0 : null),
    });
    return {
      rank: r.rank,
      teamName: r.teamName,
      record: r.record,
      showMovement: show,
      movementLabel,
      ...(show
        ? { trend: r.trend, placesMoved: r.placesMoved }
        : {}),
    };
  });
}

/** Shared ranking pipeline used by commissioner email + public recap (demo). */
export function buildDemoPublicPowerRankings(week: number): WeeklyPublicShareRanking[] | null {
  try {
    const { teams } = getDemoPowerRankingInputs(DEMO_ICONIC_SEASON, week);
    if (!teams.length) return null;
    // Demo email uses generatePowerRankings(teams) with no prior — no fabricated movement.
    const rankings = generatePowerRankings(teams, []);
    return toPublicShareRankings(rankings, { hasPriorWeekHistory: false });
  } catch {
    return null;
  }
}

async function buildLivePublicPowerRankings(
  leagueId: string,
  week: number,
  season: string,
  recapReady: boolean,
): Promise<WeeklyPublicShareRanking[] | null> {
  if (!recapReady) return null;
  try {
    const { teams, season: resolvedSeason } = await buildTeamsFromSleeper(leagueId, week, {
      finalThroughWeek: week,
    });
    if (!teams.length) return null;
    const seasonKey = String(resolvedSeason || season || "").trim() || "unknown";
    const prior = await getStoredPreviousRankings(leagueId, week, seasonKey).catch(() => []);
    const hasPrior = Array.isArray(prior) && prior.length > 0;
    const rankings = generatePowerRankings(teams, hasPrior ? prior : []);
    return toPublicShareRankings(rankings, { hasPriorWeekHistory: hasPrior });
  } catch (err) {
    console.error(
      JSON.stringify({
        event: "weekly_public_share_rankings_omit",
        leagueId,
        week,
        err: String(err),
      }),
    );
    return null;
  }
}

function assemblePresentation(params: {
  week: number;
  cards: Array<{ type?: string; title?: string; subtitle?: string; stat?: string; tagline?: string }>;
  closestGame?: {
    teamA?: string;
    teamB?: string;
    scoreA?: number;
    scoreB?: number;
  };
  closestMargin?: number | null;
  recapReady: boolean;
  slateStatus: "final" | "live" | "upcoming" | "unavailable";
  highestName?: string;
  highestScore?: number;
  blowoutSubtitle?: string;
}): {
  hero: WeeklyPublicShareHero | null;
  beats: WeeklyPublicShareBeat[];
  heroFact: string;
} {
  if (!params.recapReady) {
    return {
      hero: null,
      beats: [],
      heroFact: pickHeroFact({
        week: params.week,
        recapReady: false,
        slateStatus: params.slateStatus,
      }),
    };
  }

  const closestOpts = params.closestGame
    ? {
        closestGame: {
          ...params.closestGame,
          margin: params.closestMargin ?? null,
        },
      }
    : undefined;

  const heroMoment = selectPublicRecapHero(params.cards, closestOpts);
  const supporting = selectPublicRecapSupportingMoments(params.cards, heroMoment, 3, closestOpts);
  const hero: WeeklyPublicShareHero | null = heroMoment
    ? {
        type: heroMoment.type,
        title: heroMoment.title,
        subtitle: heroMoment.subtitle,
        ...(heroMoment.stat ? { stat: heroMoment.stat } : {}),
      }
    : null;

  return {
    hero,
    beats: supporting.map(momentToBeat),
    heroFact: pickHeroFact({
      week: params.week,
      highestName: params.highestName,
      highestScore: params.highestScore,
      blowoutSubtitle: params.blowoutSubtitle,
      hero,
      recapReady: true,
      slateStatus: params.slateStatus,
    }),
  };
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
  const recapReady = narrative.signals?.recapReady === true;
  const slateStatus = narrative.signals?.slateStatus ?? (weekIsFinal ? "unavailable" : "upcoming");

  const presentation = assemblePresentation({
    week,
    cards: narrative.cards,
    closestGame: narrative.signals?.closestGame,
    closestMargin: narrative.signals?.closestMargin,
    recapReady,
    slateStatus,
    highestName: narrative.stats.highestScorer?.username,
    highestScore: narrative.stats.highestScorer?.score,
    blowoutSubtitle: blowout?.subtitle,
  });

  const powerRankings = await buildLivePublicPowerRankings(
    league.league_id,
    week,
    String(league.season || ""),
    recapReady,
  );

  return {
    leagueId: league.league_id,
    leagueName: league.name || "Fantasy League",
    week,
    mode: "recap",
    headline: narrative.headline,
    summary: narrative.groupChatSummary,
    heroFact: presentation.heroFact,
    hero: presentation.hero,
    weekIsFinal,
    recapReady,
    slateStatus,
    isDemo: false,
    matchups: buildCompletedMatchups(matchups, rosterName, recapReady),
    powerRankings,
    beats: presentation.beats,
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
        closestGame?: {
          teamA?: string;
          teamB?: string;
          scoreA?: number;
          scoreB?: number;
        };
        closestMargin?: number | null;
      };
      const cards = (demo.cards || []) as Array<{
        type?: string;
        title?: string;
        subtitle?: string;
        stat?: string;
        tagline?: string;
      }>;
      const blowout = cards.find((c) => c.type === "biggest_embarrassment");
      const signals = (demo.signals || {}) as {
        recapReady?: boolean;
        slateStatus?: "final" | "live" | "upcoming" | "unavailable";
        closestGame?: {
          teamA?: string;
          teamB?: string;
          scoreA?: number;
          scoreB?: number;
        };
        closestMargin?: number | null;
      };
      const recapReady = signals.recapReady !== false;
      const slateStatus = signals.slateStatus ?? "final";
      const closestGame = signals.closestGame ?? stats.closestGame;
      const closestMargin =
        signals.closestMargin ?? stats.closestMargin ?? null;

      const presentation = assemblePresentation({
        week,
        cards,
        closestGame,
        closestMargin,
        recapReady,
        slateStatus,
        highestName: stats.highestScorer?.username,
        highestScore: stats.highestScorer?.score,
        blowoutSubtitle: blowout?.subtitle,
      });

      const demoMatchups = getSleeperMatchupsForDemoWeek(
        DEMO_ICONIC_SEASON,
        week,
      ) as SleeperMatchup[];
      const rosterName = (rid: number) =>
        DEMO_MANAGER_BY_ROSTER.get(rid)?.name ?? `Team ${rid}`;

      return {
        leagueId: league.league_id || DEMO_LEAGUE_ID,
        leagueName: league.name || DEMO_LEAGUE_NAME,
        week,
        mode: "recap",
        headline: String(demo.headline || `Week ${week}`),
        summary: String(demo.groupChatSummary || ""),
        heroFact: presentation.heroFact,
        hero: presentation.hero,
        weekIsFinal: true,
        recapReady,
        slateStatus,
        isDemo: true,
        matchups: buildCompletedMatchups(demoMatchups, rosterName, recapReady),
        powerRankings: recapReady ? buildDemoPublicPowerRankings(week) : null,
        beats: presentation.beats,
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

export function buildShareOgTitle(
  data: Pick<WeeklyPublicShareData, "leagueName" | "week" | "slateStatus" | "recapReady">,
): string {
  const state = weekSlateHeadline(data.week, data.slateStatus ?? (data.recapReady ? "final" : "unavailable"), "public");
  return `${BRAND_NAME} — ${data.leagueName} — ${state}`;
}

export function buildShareOgDescription(
  data: Pick<
    WeeklyPublicShareData,
    "week" | "summary" | "heroFact" | "hero" | "recapReady" | "slateStatus"
  >,
): string {
  if (data.recapReady === false) {
    const status = data.slateStatus ?? "unavailable";
    if (status === "upcoming") {
      return truncate(
        data.summary || data.heroFact || `Week ${data.week} hasn't kicked off yet.`,
        180,
      );
    }
    if (status === "live") {
      return truncate(
        data.summary || data.heroFact || `Week ${data.week} is live — scores are still moving.`,
        180,
      );
    }
    return truncate(data.summary || data.heroFact || `Week ${data.week} is not a completed recap.`, 180);
  }
  if (data.hero) {
    const punch = [data.hero.title, data.hero.stat, data.hero.subtitle].filter(Boolean).join(" — ");
    return truncate(punch || data.heroFact || data.summary || "", 180);
  }
  const base = `Week ${data.week} recap: top scorer, biggest blowout, fraud watch and league receipts.`;
  const hero = truncate(data.heroFact || "", 80);
  const summary = truncate(data.summary || "", 120);
  if (hero && summary) return truncate(`${hero} ${summary}`, 180);
  if (summary) return truncate(summary, 180);
  if (hero) return truncate(`${hero}. ${base}`, 180);
  return base;
}

function rankingMoveHtml(r: WeeklyPublicShareRanking): string {
  if (!r.showMovement) return "";
  const label = (r.movementLabel || "").trim();
  if (!label) return "";
  const cls = r.trend === "up" || r.trend === "down" ? r.trend : "flat";
  return `<span class="rank-move ${cls}" aria-label="${escapeHtml(label)}">${escapeHtml(label)}</span>`;
}

export function buildWeeklySharePageHtml(
  data: WeeklyPublicShareData,
  origin: string = SITE_URL,
): string {
  const pageUrl = weeklyPublicShareUrl(data.leagueId, data.week, origin);
  const imageUrl = weeklyPublicShareOgImageUrl(data.leagueId, data.week, origin);
  const fullRecapUrl = weeklyLeagueAppUrl(data.leagueId, origin, { week: data.week });
  const roastCtaUrl = roastMyLeagueUrl(origin);
  const title = buildShareOgTitle(data);
  const description = buildShareOgDescription(data);

  const isFinalRecap = data.recapReady === true;

  const heroHtml = isFinalRecap && data.hero
    ? `
    <section class="hero roast-hero" data-hero-type="${escapeHtml(data.hero.type)}">
      <div class="kicker">Roast of the week</div>
      <h2 class="hero-title">${escapeHtml(data.hero.title)}</h2>
      ${data.hero.stat ? `<p class="hero-stat">${escapeHtml(data.hero.stat)}</p>` : ""}
      <p class="hero-punch">${escapeHtml(data.hero.subtitle)}</p>
    </section>`
    : `
    <section class="hero">
      <div class="kicker">${
        data.slateStatus === "live"
          ? "Week still in progress"
          : data.slateStatus === "upcoming"
            ? "Upcoming week"
            : data.slateStatus === "unavailable"
              ? "Scores unavailable"
              : "League receipt"
      }</div>
      <p class="fact">${escapeHtml(data.heroFact)}</p>
    </section>`;

  const matchupsHtml =
    isFinalRecap && data.matchups.length
      ? `
    <section class="section matchups" aria-label="Matchup results">
      <h2 class="section-title">Week ${data.week} results</h2>
      <ul class="matchup-list">
        ${data.matchups
          .map(
            (m) => `
        <li class="matchup-row">
          <span class="mu-winner">${escapeHtml(m.winnerName)}</span>
          <span class="mu-score">${m.winnerScore.toFixed(1)}–${m.loserScore.toFixed(1)}</span>
          <span class="mu-loser">${escapeHtml(m.loserName)}</span>
        </li>`,
          )
          .join("")}
      </ul>
    </section>`
      : "";

  const rankingsHtml =
    isFinalRecap && data.powerRankings && data.powerRankings.length
      ? `
    <section class="section rankings" aria-label="Power Rankings">
      <h2 class="section-title">Power Rankings</h2>
      <ol class="rank-list">
        ${data.powerRankings
          .map((r) => {
            const move = rankingMoveHtml(r);
            return `
        <li class="rank-row">
          <span class="rank-num">${r.rank}</span>
          <span class="rank-name">${escapeHtml(r.teamName)}${move}</span>
          <span class="rank-record">${escapeHtml(r.record)}</span>
        </li>`;
          })
          .join("")}
      </ol>
    </section>`
      : "";

  const beatsHtml =
    isFinalRecap && data.beats.length
      ? `
    <section class="section beats" aria-label="More roast moments">
      <h2 class="section-title">Also this week</h2>
      <div class="beats-grid">
        ${data.beats
          .map(
            (b) => `
        <article class="beat"${b.type ? ` data-beat-type="${escapeHtml(b.type)}"` : ""}>
          <h3>${escapeHtml(b.title)}</h3>
          ${b.stat ? `<p class="stat">${escapeHtml(b.stat)}</p>` : ""}
          <p>${escapeHtml(b.subtitle)}</p>
        </article>`,
          )
          .join("")}
      </div>
    </section>`
      : !isFinalRecap && data.summary
        ? `<p class="summary">${escapeHtml(truncate(data.summary, 280))}</p>`
        : "";

  const secondaryCta = isFinalRecap
    ? `<a class="cta-secondary" href="${escapeHtml(fullRecapUrl)}">View full Week ${data.week} recap</a>`
    : `<a class="cta-secondary" href="${escapeHtml(fullRecapUrl)}">Open Week ${data.week} in Weekly</a>`;

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
  <meta property="og:image:secure_url" content="${escapeHtml(imageUrl)}" />
  <meta property="og:image:type" content="image/png" />
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
    main { max-width: 720px; margin: 0 auto; padding: 28px 18px 64px; }
    .brand { font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; color: #86efac; font-weight: 700; }
    .context { margin: 8px 0 18px; color: #94a3b8; font-size: 0.92rem; }
    .context strong { color: #cbd5e1; font-weight: 600; }
    h1 { font-size: clamp(1.35rem, 3.6vw, 1.75rem); line-height: 1.2; margin: 0 0 4px; color: #cbd5e1; font-weight: 650; }
    .hero {
      border: 1px solid rgba(134, 239, 172, 0.28);
      background: linear-gradient(135deg, rgba(15, 42, 24, 0.95), rgba(7, 20, 12, 0.98));
      border-radius: 16px; padding: 20px 18px 18px; margin-bottom: 22px;
    }
    .hero .kicker { color: #86efac; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; font-weight: 700; }
    .hero .fact { font-size: 1.2rem; font-weight: 700; margin: 8px 0 0; }
    .hero-title { margin: 8px 0 0; font-size: clamp(1.7rem, 5vw, 2.35rem); line-height: 1.1; color: #f8fafc; }
    .hero-stat { margin: 10px 0 0; color: #a3e635; font-size: 1.35rem; font-weight: 800; letter-spacing: -0.02em; }
    .hero-punch { margin: 10px 0 0; color: #cbd5e1; font-size: 1.05rem; line-height: 1.45; }
    .section { margin-bottom: 24px; }
    .section-title { margin: 0 0 10px; font-size: 0.78rem; letter-spacing: 0.12em; text-transform: uppercase; color: #86efac; }
    .matchup-list, .rank-list { list-style: none; margin: 0; padding: 0; }
    .matchup-row, .rank-row {
      display: grid; gap: 8px; align-items: baseline;
      padding: 10px 0; border-bottom: 1px solid rgba(148, 163, 184, 0.14);
      font-size: 0.95rem;
    }
    .matchup-row { grid-template-columns: 1fr auto 1fr; }
    .mu-winner { font-weight: 700; color: #e2e8f0; text-align: left; }
    .mu-loser { color: #94a3b8; text-align: right; }
    .mu-score { color: #a3e635; font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .rank-row { grid-template-columns: 28px 1fr auto; }
    .rank-num { color: #64748b; font-weight: 700; font-variant-numeric: tabular-nums; }
    .rank-name { font-weight: 600; color: #e2e8f0; }
    .rank-record { color: #94a3b8; font-variant-numeric: tabular-nums; font-size: 0.9rem; }
    .rank-move { margin-left: 6px; font-size: 0.85rem; }
    .rank-move.up { color: #86efac; }
    .rank-move.down { color: #fb7185; }
    .beats-grid { display: grid; gap: 10px; }
    .beat { border: 1px solid rgba(148, 163, 184, 0.18); border-radius: 12px; padding: 12px 14px; background: rgba(15, 23, 42, 0.45); }
    .beat h3 { margin: 0 0 4px; font-size: 0.95rem; }
    .beat .stat { margin: 0 0 6px; color: #a3e635; font-weight: 700; }
    .beat p { margin: 0; color: #94a3b8; font-size: 0.9rem; line-height: 1.4; }
    .summary { color: #cbd5e1; line-height: 1.5; margin: 0 0 22px; }
    .cta-row { display: flex; flex-direction: column; gap: 10px; margin-top: 8px; }
    .cta {
      display: inline-block; text-align: center; background: #34d399; color: #052e16; font-weight: 800;
      text-decoration: none; border-radius: 999px; padding: 13px 18px;
    }
    .cta:hover { filter: brightness(1.05); }
    .cta-secondary {
      display: inline-block; text-align: center; color: #7dd3fc; font-weight: 650;
      text-decoration: none; font-size: 0.95rem; padding: 6px 4px;
    }
    footer { margin-top: 36px; color: #64748b; font-size: 12px; }
    @media (min-width: 560px) {
      .cta-row { flex-direction: row; align-items: center; flex-wrap: wrap; gap: 14px; }
    }
  </style>
</head>
<body>
  <main>
    <div class="brand">${escapeHtml(BRAND_NAME)}</div>
    ${heroHtml}
    <h1>${escapeHtml(weekSlateHeadline(data.week, data.slateStatus, "public"))}</h1>
    <p class="context"><strong>${escapeHtml(data.leagueName)}</strong> · Week ${data.week}</p>
    ${matchupsHtml}
    ${rankingsHtml}
    ${beatsHtml}
    <div class="cta-row">
      <a class="cta" href="${escapeHtml(roastCtaUrl)}">Roast my league</a>
      ${secondaryCta}
    </div>
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
  const homeUrl = roastMyLeagueUrl(origin);
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
    <p><a href="${escapeHtml(homeUrl)}">Roast my league</a></p>
  </main>
</body>
</html>`;
}

/** 1200×630 branded OG SVG (no buttons/controls). */
export function buildWeeklyShareOgSvg(data: WeeklyPublicShareData): string {
  const title = truncate(data.leagueName, 42);
  const hero = truncate(
    data.hero
      ? [data.hero.title, data.hero.stat].filter(Boolean).join(" · ")
      : data.heroFact,
    64,
  );
  const summary = truncate(
    data.hero?.subtitle || data.summary || data.headline,
    90,
  );
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
  <text x="90" y="260" fill="#a3e635" font-family="Arial, Helvetica, sans-serif" font-size="40" font-weight="700">${escapeXml(weekSlateHeadline(data.week, data.slateStatus, "public"))}</text>
  <text x="90" y="360" fill="#e2e8f0" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="700">${escapeXml(hero)}</text>
  <text x="90" y="420" fill="#94a3b8" font-family="Arial, Helvetica, sans-serif" font-size="26">${escapeXml(summary)}</text>
  <text x="90" y="560" fill="#64748b" font-family="Arial, Helvetica, sans-serif" font-size="22">${escapeXml(SITE_HOST)}</text>
</svg>`;
}

export function renderWeeklyShareOgPng(data: WeeklyPublicShareData): Buffer {
  const svg = buildWeeklyShareOgSvg(data);
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: WEEKLY_SHARE_OG_WIDTH },
  });
  const png = Buffer.from(resvg.render().asPng());
  assertPngSignature(png);
  return png;
}

/** Static branded 1200×630 PNG — no native deps, always available in the bundle. */
export function getFallbackWeeklyShareOgPng(): Buffer {
  const png = getWeeklyShareOgFallbackPngBytes();
  assertPngSignature(png);
  return png;
}

/**
 * Always returns a valid PNG buffer.
 * Prefers dynamic league recap art; on any failure serves the branded fallback.
 */
export function renderWeeklyShareOgPngSafe(
  data: WeeklyPublicShareData | null | undefined,
  options?: { forceFallback?: boolean },
): { png: Buffer; usedFallback: boolean } {
  if (options?.forceFallback || !data) {
    return { png: getFallbackWeeklyShareOgPng(), usedFallback: true };
  }
  try {
    return { png: renderWeeklyShareOgPng(data), usedFallback: false };
  } catch (err) {
    console.error(
      JSON.stringify({
        event: "weekly_share_og_png_fallback",
        leagueId: data.leagueId,
        week: data.week,
        err: String(err),
      }),
    );
    return { png: getFallbackWeeklyShareOgPng(), usedFallback: true };
  }
}

/** Read PNG IHDR width/height (no deps). */
export function readPngDimensions(png: Buffer): { width: number; height: number } {
  if (!Buffer.isBuffer(png) || png.length < 24 || !isPngBuffer(png)) {
    throw new Error("Not a PNG buffer");
  }
  return {
    width: png.readUInt32BE(16),
    height: png.readUInt32BE(20),
  };
}

export function isPngBuffer(buf: Buffer): boolean {
  return (
    Buffer.isBuffer(buf) &&
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  );
}

function assertPngSignature(png: Buffer): void {
  if (!isPngBuffer(png)) {
    throw new Error("Renderer produced non-PNG output");
  }
}

/** Cache completed weeks longer; keep live/incomplete weeks shorter. */
export function weeklyShareCacheControl(weekIsFinal: boolean): string {
  if (weekIsFinal) {
    return "public, max-age=300, s-maxage=1800, stale-while-revalidate=86400";
  }
  return "public, max-age=60, s-maxage=120, stale-while-revalidate=600";
}

/**
 * Build the OG PNG response payload for a share URL.
 * Never throws for crawler-facing output — always returns image bytes.
 */
export async function buildWeeklyShareOgPngResponse(
  leagueId: string,
  week: number,
): Promise<{ png: Buffer; weekIsFinal: boolean; usedFallback: boolean }> {
  try {
    const data = await loadWeeklyPublicShare(leagueId, week);
    const rendered = renderWeeklyShareOgPngSafe(data);
    return {
      png: rendered.png,
      weekIsFinal: data.weekIsFinal,
      usedFallback: rendered.usedFallback,
    };
  } catch {
    return {
      png: getFallbackWeeklyShareOgPng(),
      weekIsFinal: true,
      usedFallback: true,
    };
  }
}
