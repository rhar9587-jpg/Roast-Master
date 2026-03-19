/**
 * Fantasy Roast — Weekly Commissioner Email Generator
 * HTML email for Gmail, Apple Mail, Outlook. Inline CSS, table layout, max 600px.
 */

export interface WeeklyEmailRankingRow {
  rank: number;
  teamName: string;
  record: string;
  powerScore: number;
  trend: "up" | "down" | "flat";
  commentary: string;
}

export interface WeeklyEmailData {
  leagueName: string;
  week: number;
  /** Recap: power rankings table. Omitted for preview. */
  rankings?: WeeklyEmailRankingRow[];
  /** Recap: villain of the week. Omitted for preview. */
  villainOfTheWeek?: { teamName: string; reason: string };
  /** Recap: fraud alert. Omitted for preview. */
  fraudAlert?: { teamName: string; reason: string };
  introSummary: string;
  /** Optional commissioner note rendered above the intro. */
  commissionerNote?: string;
  /** Optional short commissioner sign-off line near footer. */
  commissionerSignoff?: string;
  /** Biggest rank movers from last week (when previous rankings exist). Recap only. */
  biggestMovers?: {
    riser?: { teamName: string; change: number };
    faller?: { teamName: string; change: number };
  };
  /** Base URL for "Want this for your league?" CTA (e.g. CLIENT_URL). */
  appUrl?: string;
  /** Recap: this week's matchups with scores. */
  weekMatchups?: Array<{ teamA: string; scoreA: number; teamB: string; scoreB: number }>;
  /** Preview: upcoming matchups (pairings; optional win %). */
  upcomingMatchups?: Array<{ teamA: string; teamB: string; winPctA?: number; winPctB?: number }>;
  /** Preview: likely blowout call. */
  likelyBlowout?: { teamA: string; teamB: string; narrative: string };
  /** Preview: upset of the week. */
  upsetOfTheWeek?: { underdog: string; favorite: string; narrative: string };
  /** League history: matchup to watch (nemesis/owned/rivalry). Both modes. */
  matchupToWatch?: { teamA: string; teamB: string; narrative: string };
  /** League history: story of the week (e.g. dynasty). Both modes. */
  storyOfTheWeek?: { narrative: string };
  /** Explicit mode; inferred from payload if not set. */
  mode?: "recap" | "preview";
  /** Preview only: short disclaimer (e.g. Week 1). */
  previewDisclaimer?: string;
  /** Recap V2: high/low score and coaching miss callouts. */
  weeklySuperlatives?: {
    highScore: { teamName: string; points: number; keyPerformers?: string[] };
    lowScore: { teamName: string; points: number };
    worstCoach?: { teamName: string; benchPoints: number; sitStartMiss?: string };
  };
  /** Recap V2: scoring context. */
  leagueAverages?: { weekAverage: number; seasonAverage: number };
  /** Recap V2: season races. */
  seasonRaces?: {
    topScoringPace?: { teamName: string; totalPoints: number; pointsPerGame: number };
    lowestScoringPace?: { teamName: string; totalPoints: number; pointsPerGame: number };
    luckiestByPointsAgainst?: { teamName: string; totalPointsAgainst: number; pointsAgainstPerGame: number };
    unluckiestByPointsAgainst?: { teamName: string; totalPointsAgainst: number; pointsAgainstPerGame: number };
  };
  /** Recap V2: best players by position, if available. */
  positionLeaders?: Array<{ position: string; playerName: string; avgPoints: number; teamName: string }>;
}

function escapeHtml(str: string | null | undefined): string {
  if (str == null) return "";
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return String(str).replace(/[&<>"']/g, (c) => map[c] ?? c);
}

export function generateWeeklyEmail(data: WeeklyEmailData): string {
  const accent = "#c9a227";
  const bgDark = "#1a1a1a";
  const bgRow = "#252525";
  const bgRowFirst = "#2a2a2a";
  const textMuted = "#999999";
  const border = "#333333";

  const isPreview =
    data.mode === "preview" ||
    (Array.isArray(data.upcomingMatchups) && data.upcomingMatchups.length > 0 && !(data.rankings?.length));

  const trendSymbol = (trend: string) =>
    trend === "up" ? "&#8593;" : trend === "down" ? "&#8595;" : "&#8212;";

  const rankingsRows = (data.rankings ?? [])
    .map(
      (r) => `
    <tr style="background-color: ${r.rank === 1 ? bgRowFirst : bgRow}; border-bottom: 1px solid ${border};">
      <td style="padding: 12px 10px; font-size: 14px; color: ${r.rank === 1 ? accent : "#ffffff"}; font-weight: ${r.rank === 1 ? "bold" : "normal"}; vertical-align: top; width: 40px;">${r.rank}</td>
      <td style="padding: 12px 10px; font-size: 14px; color: #ffffff; vertical-align: top;">
        <span style="font-weight: 600;">${escapeHtml(r.teamName)}</span>
        <div style="font-size: 12px; color: ${textMuted}; margin-top: 4px; font-style: italic;">${escapeHtml(r.commentary)}</div>
      </td>
      <td style="padding: 12px 10px; font-size: 14px; color: #e0e0e0; vertical-align: top; width: 70px;">${escapeHtml(r.record)}</td>
      <td style="padding: 12px 10px; font-size: 14px; color: ${accent}; font-weight: 600; vertical-align: top; width: 50px;">${r.powerScore}</td>
      <td style="padding: 12px 10px; font-size: 14px; color: ${r.trend === "up" ? "#7cb342" : r.trend === "down" ? "#e57373" : textMuted}; vertical-align: top; width: 36px;">${trendSymbol(r.trend)}</td>
    </tr>`,
    )
    .join("");

  const subtitle = isPreview ? "Matchup Preview" : "Weekly Power Rankings";

  const historyBlock =
    (data.matchupToWatch || data.storyOfTheWeek)
      ? `
          <tr>
            <td style="padding: 0 24px 16px 24px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #2a2a1f; border-left: 4px solid ${accent}; border-radius: 4px;">
                <tr>
                  <td style="padding: 14px 16px;">
                    ${data.matchupToWatch
    ? `<p style="margin: 0 0 6px 0; font-size: 11px; color: ${accent}; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600;">Matchup to watch</p>
                    <p style="margin: 0; font-size: 14px; color: #ffffff; font-weight: 600;">${escapeHtml(data.matchupToWatch.teamA)} vs ${escapeHtml(data.matchupToWatch.teamB)}</p>
                    <p style="margin: 6px 0 0 0; font-size: 13px; color: ${textMuted}; line-height: 1.5;">${escapeHtml(data.matchupToWatch.narrative)}</p>`
    : ""}
                    ${data.matchupToWatch && data.storyOfTheWeek ? "<br>" : ""}
                    ${data.storyOfTheWeek
    ? `<p style="margin: ${data.matchupToWatch ? "10px" : "0"} 0 0 0; font-size: 13px; color: #e0e0e0; line-height: 1.5;">${escapeHtml(data.storyOfTheWeek.narrative)}</p>`
    : ""}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          `
      : "";

  const previewSections = isPreview
    ? `
          ${data.previewDisclaimer ? `
          <tr>
            <td style="padding: 0 24px 16px 24px;">
              <p style="margin: 0; font-size: 12px; color: ${textMuted}; line-height: 1.5;">${escapeHtml(data.previewDisclaimer)}</p>
            </td>
          </tr>
          ` : ""}
          ${data.upcomingMatchups && data.upcomingMatchups.length > 0 ? `
          <tr>
            <td style="padding: 0 24px 20px 24px;">
              <p style="margin: 0 0 10px 0; font-size: 11px; color: ${textMuted}; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600;">This week&apos;s matchups</p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse: collapse; font-size: 13px;">
                ${data.upcomingMatchups
    .map(
      (mu) => `
                <tr style="border-bottom: 1px solid ${border};">
                  <td style="padding: 8px 0; color: #ffffff; font-weight: 600;">${escapeHtml(mu.teamA)}</td>
                  ${mu.winPctA != null ? `<td style="padding: 8px 6px; color: ${accent}; font-size: 12px;">${Math.round(mu.winPctA)}%</td>` : ""}
                  <td style="padding: 8px 6px; color: ${textMuted}; font-size: 12px;">vs</td>
                  ${mu.winPctB != null ? `<td style="padding: 8px 6px; color: ${accent}; font-size: 12px;">${Math.round(mu.winPctB)}%</td>` : ""}
                  <td style="padding: 8px 0; color: #e0e0e0;">${escapeHtml(mu.teamB)}</td>
                </tr>`,
    )
    .join("")}
              </table>
            </td>
          </tr>
          ` : ""}
          ${data.likelyBlowout ? `
          <tr>
            <td style="padding: 0 24px 16px 24px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #2a1f2a; border-left: 4px solid #7b1fa2; border-radius: 4px;">
                <tr>
                  <td style="padding: 14px 16px;">
                    <p style="margin: 0 0 6px 0; font-size: 11px; color: #ce93d8; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600;">Likely blowout</p>
                    <p style="margin: 0; font-size: 14px; color: #ffffff; font-weight: 600;">${escapeHtml(data.likelyBlowout.teamA)} vs ${escapeHtml(data.likelyBlowout.teamB)}</p>
                    <p style="margin: 6px 0 0 0; font-size: 13px; color: ${textMuted}; line-height: 1.5;">${escapeHtml(data.likelyBlowout.narrative)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : ""}
          ${data.upsetOfTheWeek ? `
          <tr>
            <td style="padding: 0 24px 16px 24px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #1f2a2a; border-left: 4px solid #00897b; border-radius: 4px;">
                <tr>
                  <td style="padding: 14px 16px;">
                    <p style="margin: 0 0 6px 0; font-size: 11px; color: #4db6ac; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600;">Upset watch</p>
                    <p style="margin: 0; font-size: 14px; color: #ffffff; font-weight: 600;">${escapeHtml(data.upsetOfTheWeek.underdog)} vs ${escapeHtml(data.upsetOfTheWeek.favorite)}</p>
                    <p style="margin: 6px 0 0 0; font-size: 13px; color: ${textMuted}; line-height: 1.5;">${escapeHtml(data.upsetOfTheWeek.narrative)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : ""}
          ${historyBlock}
          `
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(data.leagueName)} — Week ${data.week}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0d0d0d; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; line-height: 1.5; color: #ffffff;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #0d0d0d;">
    <tr>
      <td align="center" style="padding: 24px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 600px; background-color: ${bgDark}; border-radius: 8px; overflow: hidden; border: 1px solid ${border};">
          <tr>
            <td style="padding: 28px 24px 16px 24px; border-bottom: 1px solid ${border};">
              <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #ffffff; letter-spacing: -0.02em;">${escapeHtml(data.leagueName)}</h1>
              <p style="margin: 6px 0 0 0; font-size: 16px; color: ${accent}; font-weight: 600;">Week ${data.week}</p>
              <p style="margin: 4px 0 0 0; font-size: 13px; color: ${textMuted}; text-transform: uppercase; letter-spacing: 0.05em;">${subtitle}</p>
            </td>
          </tr>
          ${data.commissionerNote ? `
          <tr>
            <td style="padding: 16px 24px 8px 24px; border-bottom: 1px solid ${border};">
              <p style="margin: 0; font-size: 14px; color: ${accent}; font-style: italic; line-height: 1.5;">${escapeHtml(data.commissionerNote)}</p>
            </td>
          </tr>
          ` : ""}
          <tr>
            <td style="padding: 20px 24px; border-bottom: 1px solid ${border};">
              <p style="margin: 0; font-size: 15px; color: #e0e0e0; line-height: 1.6;">${escapeHtml(data.introSummary)}</p>
            </td>
          </tr>
          ${!isPreview && (data.rankings?.length ?? 0) > 0 ? `
          <tr>
            <td style="padding: 16px 24px 20px 24px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse: collapse; border: 1px solid ${border}; border-radius: 6px; overflow: hidden;">
                <thead>
                  <tr style="background-color: #2a2a2a;">
                    <th style="padding: 10px 10px; font-size: 11px; color: ${textMuted}; text-transform: uppercase; letter-spacing: 0.06em; text-align: left; font-weight: 600; border-bottom: 1px solid ${border}; width: 40px;">Rank</th>
                    <th style="padding: 10px 10px; font-size: 11px; color: ${textMuted}; text-transform: uppercase; letter-spacing: 0.06em; text-align: left; font-weight: 600; border-bottom: 1px solid ${border};">Team</th>
                    <th style="padding: 10px 10px; font-size: 11px; color: ${textMuted}; text-transform: uppercase; letter-spacing: 0.06em; text-align: left; font-weight: 600; border-bottom: 1px solid ${border}; width: 70px;">Record</th>
                    <th style="padding: 10px 10px; font-size: 11px; color: ${textMuted}; text-transform: uppercase; letter-spacing: 0.06em; text-align: left; font-weight: 600; border-bottom: 1px solid ${border}; width: 50px;">Power</th>
                    <th style="padding: 10px 10px; font-size: 11px; color: ${textMuted}; text-transform: uppercase; letter-spacing: 0.06em; text-align: left; font-weight: 600; border-bottom: 1px solid ${border}; width: 36px;">Trend</th>
                  </tr>
                </thead>
                <tbody>
${rankingsRows}
                </tbody>
              </table>
            </td>
          </tr>
          ` : ""}
          ${!isPreview && data.biggestMovers && (data.biggestMovers.riser || data.biggestMovers.faller) ? `
          <tr>
            <td style="padding: 0 24px 16px 24px;">
              <p style="margin: 0; font-size: 13px; color: ${textMuted}; line-height: 1.5;">
                ${[
                  data.biggestMovers.riser ? `Biggest riser: ${escapeHtml(data.biggestMovers.riser.teamName)} (+${data.biggestMovers.riser.change}).` : "",
                  data.biggestMovers.faller ? `Biggest faller: ${escapeHtml(data.biggestMovers.faller.teamName)} (-${Math.abs(data.biggestMovers.faller.change)}).` : "",
                ].filter(Boolean).join(" ")}
              </p>
            </td>
          </tr>
          ` : ""}
          ${!isPreview && data.weekMatchups && data.weekMatchups.length > 0 ? `
          <tr>
            <td style="padding: 0 24px 20px 24px;">
              <p style="margin: 0 0 10px 0; font-size: 11px; color: ${textMuted}; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600;">This week's results</p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse: collapse; font-size: 13px;">
                ${data.weekMatchups
                  .map(
                    (mu) => `
                <tr style="border-bottom: 1px solid ${border};">
                  <td style="padding: 8px 0; color: #ffffff; font-weight: 600;">${escapeHtml(mu.teamA)}</td>
                  <td style="padding: 8px 8px; color: ${accent}; font-weight: 600; white-space: nowrap;">${mu.scoreA.toFixed(1)}</td>
                  <td style="padding: 8px 0; color: ${textMuted}; font-size: 12px;">–</td>
                  <td style="padding: 8px 8px; color: #e0e0e0;">${mu.scoreB.toFixed(1)}</td>
                  <td style="padding: 8px 0; color: #e0e0e0;">${escapeHtml(mu.teamB)}</td>
                </tr>`,
                  )
                  .join("")}
              </table>
            </td>
          </tr>
          ` : ""}
          ${!isPreview && data.villainOfTheWeek ? `
          <tr>
            <td style="padding: 0 24px 16px 24px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #2a1f1f; border-left: 4px solid #b71c1c; border-radius: 4px;">
                <tr>
                  <td style="padding: 14px 16px;">
                    <p style="margin: 0 0 6px 0; font-size: 11px; color: #ef5350; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600;">Villain of the Week</p>
                    <p style="margin: 0; font-size: 14px; color: #ffffff; font-weight: 600;">${escapeHtml(data.villainOfTheWeek.teamName)}</p>
                    <p style="margin: 6px 0 0 0; font-size: 13px; color: ${textMuted}; line-height: 1.5;">${escapeHtml(data.villainOfTheWeek.reason)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : ""}
          ${!isPreview && data.fraudAlert ? `
          <tr>
            <td style="padding: 0 24px 20px 24px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #1f2a1f; border-left: 4px solid ${accent}; border-radius: 4px;">
                <tr>
                  <td style="padding: 14px 16px;">
                    <p style="margin: 0 0 6px 0; font-size: 11px; color: ${accent}; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600;">Fraud Alert</p>
                    <p style="margin: 0; font-size: 14px; color: #ffffff; font-weight: 600;">${escapeHtml(data.fraudAlert.teamName)}</p>
                    <p style="margin: 6px 0 0 0; font-size: 13px; color: ${textMuted}; line-height: 1.5;">${escapeHtml(data.fraudAlert.reason)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : ""}
          ${!isPreview && data.weeklySuperlatives ? `
          <tr>
            <td style="padding: 0 24px 16px 24px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #1f2430; border-left: 4px solid #64b5f6; border-radius: 4px;">
                <tr><td style="padding: 14px 16px;">
                  <p style="margin: 0 0 8px 0; font-size: 11px; color: #90caf9; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600;">Weekly Superlatives</p>
                  <p style="margin: 0; font-size: 13px; color: #ffffff;"><strong>High score:</strong> ${escapeHtml(data.weeklySuperlatives.highScore.teamName)} — ${data.weeklySuperlatives.highScore.points.toFixed(1)} pts${data.weeklySuperlatives.highScore.keyPerformers?.length ? `. Key performers: ${escapeHtml(data.weeklySuperlatives.highScore.keyPerformers.join(", "))}.` : "."}</p>
                  <p style="margin: 8px 0 0 0; font-size: 13px; color: #e0e0e0;"><strong>Low score:</strong> ${escapeHtml(data.weeklySuperlatives.lowScore.teamName)} — ${data.weeklySuperlatives.lowScore.points.toFixed(1)} pts.</p>
                  ${data.weeklySuperlatives.worstCoach ? `<p style="margin: 8px 0 0 0; font-size: 13px; color: #e0e0e0;"><strong>Worst coach:</strong> ${escapeHtml(data.weeklySuperlatives.worstCoach.teamName)} left ${data.weeklySuperlatives.worstCoach.benchPoints.toFixed(1)} on the bench.${data.weeklySuperlatives.worstCoach.sitStartMiss ? ` ${escapeHtml(data.weeklySuperlatives.worstCoach.sitStartMiss)}` : ""}</p>` : ""}
                </td></tr>
              </table>
            </td>
          </tr>
          ` : ""}
          ${!isPreview && data.leagueAverages ? `
          <tr>
            <td style="padding: 0 24px 16px 24px;">
              <p style="margin: 0; font-size: 13px; color: ${textMuted}; line-height: 1.5;">
                Scoring average this week: ${data.leagueAverages.weekAverage.toFixed(2)}. Season scoring average: ${data.leagueAverages.seasonAverage.toFixed(2)}.
              </p>
            </td>
          </tr>
          ` : ""}
          ${!isPreview && data.seasonRaces ? `
          <tr>
            <td style="padding: 0 24px 16px 24px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #26211f; border-left: 4px solid ${accent}; border-radius: 4px;">
                <tr><td style="padding: 14px 16px;">
                  <p style="margin: 0 0 8px 0; font-size: 11px; color: ${accent}; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600;">Season Races</p>
                  ${data.seasonRaces.topScoringPace ? `<p style="margin: 0; font-size: 13px; color: #ffffff;"><strong>High score race:</strong> ${escapeHtml(data.seasonRaces.topScoringPace.teamName)} — ${data.seasonRaces.topScoringPace.totalPoints.toFixed(1)} (${data.seasonRaces.topScoringPace.pointsPerGame.toFixed(1)}/game).</p>` : ""}
                  ${data.seasonRaces.lowestScoringPace ? `<p style="margin: 8px 0 0 0; font-size: 13px; color: #e0e0e0;"><strong>Season worst:</strong> ${escapeHtml(data.seasonRaces.lowestScoringPace.teamName)} — ${data.seasonRaces.lowestScoringPace.totalPoints.toFixed(1)} (${data.seasonRaces.lowestScoringPace.pointsPerGame.toFixed(1)}/game).</p>` : ""}
                  ${data.seasonRaces.luckiestByPointsAgainst ? `<p style="margin: 8px 0 0 0; font-size: 13px; color: #e0e0e0;"><strong>Luckiest (PA):</strong> ${escapeHtml(data.seasonRaces.luckiestByPointsAgainst.teamName)} — ${data.seasonRaces.luckiestByPointsAgainst.totalPointsAgainst.toFixed(1)} against (${data.seasonRaces.luckiestByPointsAgainst.pointsAgainstPerGame.toFixed(1)}/game).</p>` : ""}
                  ${data.seasonRaces.unluckiestByPointsAgainst ? `<p style="margin: 8px 0 0 0; font-size: 13px; color: #e0e0e0;"><strong>Unluckiest (PA):</strong> ${escapeHtml(data.seasonRaces.unluckiestByPointsAgainst.teamName)} — ${data.seasonRaces.unluckiestByPointsAgainst.totalPointsAgainst.toFixed(1)} against (${data.seasonRaces.unluckiestByPointsAgainst.pointsAgainstPerGame.toFixed(1)}/game).</p>` : ""}
                </td></tr>
              </table>
            </td>
          </tr>
          ` : ""}
          ${!isPreview && data.positionLeaders && data.positionLeaders.length > 0 ? `
          <tr>
            <td style="padding: 0 24px 16px 24px;">
              <p style="margin: 0 0 8px 0; font-size: 11px; color: ${textMuted}; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600;">Best players by position</p>
              ${data.positionLeaders.map((l) => `<p style="margin: 0 0 4px 0; font-size: 13px; color: #e0e0e0;"><strong>${escapeHtml(l.position)}:</strong> ${escapeHtml(l.playerName)} — ${l.avgPoints.toFixed(1)} avg (${escapeHtml(l.teamName)})</p>`).join("")}
            </td>
          </tr>
          ` : ""}
          ${isPreview ? previewSections : ""}
          ${!isPreview ? historyBlock : ""}
          <tr>
            <td style="padding: 20px 24px 24px 24px; border-top: 1px solid ${border};">
              ${data.commissionerSignoff ? `<p style="margin: 0 0 10px 0; font-size: 13px; color: #e0e0e0; font-style: italic;">${escapeHtml(data.commissionerSignoff)}</p>` : ""}
              <p style="margin: 0; font-size: 12px; color: ${textMuted}; line-height: 1.5;">This report was generated automatically by Fantasy Roast.<br>Automated weekly power rankings for fantasy commissioners.</p>
              <p style="margin: 14px 0 0 0; font-size: 13px; color: #e0e0e0;">Sent by your commissioner with Fantasy Roast. See you in the group chat.</p>
              ${data.appUrl ? `<p style="margin: 10px 0 0 0; font-size: 12px; color: ${accent};"><a href="${escapeHtml(data.appUrl)}" style="color: ${accent}; text-decoration: none;">Want this for your league?</a></p>` : ""}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Plain-text version of the weekly email for fallback / accessibility. */
export function generateWeeklyEmailPlainText(data: WeeklyEmailData): string {
  const isPreview =
    data.mode === "preview" ||
    (Array.isArray(data.upcomingMatchups) && data.upcomingMatchups.length > 0 && !(data.rankings?.length));
  const lines: string[] = [
    `${data.leagueName} — Week ${data.week}`,
    isPreview ? "Matchup Preview" : "Weekly Power Rankings",
    "",
  ];
  if (data.commissionerNote?.trim()) {
    lines.push(data.commissionerNote.trim(), "");
  }
  lines.push(data.introSummary, "");

  if (!isPreview && data.rankings && data.rankings.length > 0) {
    lines.push("POWER RANKINGS", "---");
    for (const r of data.rankings) {
      const trend = r.trend === "up" ? "^" : r.trend === "down" ? "v" : "-";
      lines.push(`${r.rank}. ${r.teamName} (${r.record}) — Power: ${r.powerScore} ${trend}`);
      lines.push(`   ${r.commentary}`);
    }
    if (data.biggestMovers && (data.biggestMovers.riser || data.biggestMovers.faller)) {
      const parts: string[] = [];
      if (data.biggestMovers.riser) parts.push(`Biggest riser: ${data.biggestMovers.riser.teamName} (+${data.biggestMovers.riser.change}).`);
      if (data.biggestMovers.faller) parts.push(`Biggest faller: ${data.biggestMovers.faller.teamName} (-${Math.abs(data.biggestMovers.faller.change)}).`);
      lines.push("", parts.join(" "));
    }
    if (data.weekMatchups && data.weekMatchups.length > 0) {
      lines.push("", `WEEK ${data.week} RESULTS`, "---");
      for (const mu of data.weekMatchups) {
        lines.push(`${mu.teamA} ${mu.scoreA.toFixed(1)} – ${mu.scoreB.toFixed(1)} ${mu.teamB}`);
      }
    }
    if (data.villainOfTheWeek) lines.push("", "VILLAIN OF THE WEEK", "---", `${data.villainOfTheWeek.teamName}: ${data.villainOfTheWeek.reason}`);
    if (data.fraudAlert) lines.push("", "FRAUD ALERT", "---", `${data.fraudAlert.teamName}: ${data.fraudAlert.reason}`);
    if (data.weeklySuperlatives) {
      lines.push("", "WEEKLY SUPERLATIVES", "---");
      lines.push(`High score: ${data.weeklySuperlatives.highScore.teamName} — ${data.weeklySuperlatives.highScore.points.toFixed(1)} pts.`);
      if (data.weeklySuperlatives.highScore.keyPerformers?.length) {
        lines.push(`Key performers: ${data.weeklySuperlatives.highScore.keyPerformers.join(", ")}.`);
      }
      lines.push(`Low score: ${data.weeklySuperlatives.lowScore.teamName} — ${data.weeklySuperlatives.lowScore.points.toFixed(1)} pts.`);
      if (data.weeklySuperlatives.worstCoach) {
        lines.push(`Worst coach: ${data.weeklySuperlatives.worstCoach.teamName} left ${data.weeklySuperlatives.worstCoach.benchPoints.toFixed(1)} points on the bench.${data.weeklySuperlatives.worstCoach.sitStartMiss ? ` ${data.weeklySuperlatives.worstCoach.sitStartMiss}` : ""}`);
      }
    }
    if (data.leagueAverages) {
      lines.push("", "LEAGUE AVERAGES", "---", `Week average: ${data.leagueAverages.weekAverage.toFixed(2)}`, `Season average: ${data.leagueAverages.seasonAverage.toFixed(2)}`);
    }
    if (data.seasonRaces) {
      lines.push("", "SEASON RACES", "---");
      if (data.seasonRaces.topScoringPace) lines.push(`Top scoring pace: ${data.seasonRaces.topScoringPace.teamName} — ${data.seasonRaces.topScoringPace.totalPoints.toFixed(1)} (${data.seasonRaces.topScoringPace.pointsPerGame.toFixed(1)}/game).`);
      if (data.seasonRaces.lowestScoringPace) lines.push(`Lowest scoring pace: ${data.seasonRaces.lowestScoringPace.teamName} — ${data.seasonRaces.lowestScoringPace.totalPoints.toFixed(1)} (${data.seasonRaces.lowestScoringPace.pointsPerGame.toFixed(1)}/game).`);
      if (data.seasonRaces.luckiestByPointsAgainst) lines.push(`Luckiest (points against): ${data.seasonRaces.luckiestByPointsAgainst.teamName} — ${data.seasonRaces.luckiestByPointsAgainst.totalPointsAgainst.toFixed(1)} (${data.seasonRaces.luckiestByPointsAgainst.pointsAgainstPerGame.toFixed(1)}/game).`);
      if (data.seasonRaces.unluckiestByPointsAgainst) lines.push(`Unluckiest (points against): ${data.seasonRaces.unluckiestByPointsAgainst.teamName} — ${data.seasonRaces.unluckiestByPointsAgainst.totalPointsAgainst.toFixed(1)} (${data.seasonRaces.unluckiestByPointsAgainst.pointsAgainstPerGame.toFixed(1)}/game).`);
    }
    if (data.positionLeaders?.length) {
      lines.push("", "BEST PLAYERS BY POSITION", "---");
      for (const l of data.positionLeaders) {
        lines.push(`${l.position}: ${l.playerName} — ${l.avgPoints.toFixed(1)} avg (${l.teamName})`);
      }
    }
  }

  if (isPreview) {
    if (data.previewDisclaimer?.trim()) lines.push(data.previewDisclaimer.trim(), "");
    if (data.upcomingMatchups && data.upcomingMatchups.length > 0) {
      lines.push("THIS WEEK'S MATCHUPS", "---");
      for (const mu of data.upcomingMatchups) {
        const pct = mu.winPctA != null && mu.winPctB != null ? ` (${Math.round(mu.winPctA)}% / ${Math.round(mu.winPctB)}%)` : "";
        lines.push(`${mu.teamA} vs ${mu.teamB}${pct}`);
      }
    }
    if (data.likelyBlowout) lines.push("", "LIKELY BLOWOUT", "---", `${data.likelyBlowout.teamA} vs ${data.likelyBlowout.teamB}: ${data.likelyBlowout.narrative}`);
    if (data.upsetOfTheWeek) lines.push("", "UPSET WATCH", "---", `${data.upsetOfTheWeek.underdog} vs ${data.upsetOfTheWeek.favorite}: ${data.upsetOfTheWeek.narrative}`);
  }

  if (data.matchupToWatch) lines.push("", "MATCHUP TO WATCH", "---", `${data.matchupToWatch.teamA} vs ${data.matchupToWatch.teamB}: ${data.matchupToWatch.narrative}`);
  if (data.storyOfTheWeek) lines.push("", data.storyOfTheWeek.narrative);
  if (data.commissionerSignoff?.trim()) lines.push("", data.commissionerSignoff.trim());

  lines.push("", "---", "This report was generated automatically by Fantasy Roast. Automated weekly power rankings for fantasy commissioners.", "", "Sent by your commissioner with Fantasy Roast. See you in the group chat.");
  if (data.appUrl) lines.push("", `Want this for your league? ${data.appUrl}`);
  return lines.join("\n");
}
