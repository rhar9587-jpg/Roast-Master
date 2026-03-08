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
  rankings: WeeklyEmailRankingRow[];
  villainOfTheWeek: { teamName: string; reason: string };
  fraudAlert: { teamName: string; reason: string };
  introSummary: string;
  /** Optional commissioner note rendered above the intro. */
  commissionerNote?: string;
  /** Biggest rank movers from last week (when previous rankings exist). */
  biggestMovers?: {
    riser?: { teamName: string; change: number };
    faller?: { teamName: string; change: number };
  };
  /** Base URL for "Want this for your league?" CTA (e.g. CLIENT_URL). */
  appUrl?: string;
  /** This week's matchups (team A/B and scores) for roundup section. */
  weekMatchups?: Array<{ teamA: string; scoreA: number; teamB: string; scoreB: number }>;
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

  const trendSymbol = (trend: string) =>
    trend === "up" ? "&#8593;" : trend === "down" ? "&#8595;" : "&#8212;";

  const rankingsRows = data.rankings
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
              <p style="margin: 4px 0 0 0; font-size: 13px; color: ${textMuted}; text-transform: uppercase; letter-spacing: 0.05em;">Weekly Power Rankings</p>
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
          ${data.biggestMovers && (data.biggestMovers.riser || data.biggestMovers.faller) ? `
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
          ${data.weekMatchups && data.weekMatchups.length > 0 ? `
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
          <tr>
            <td style="padding: 20px 24px 24px 24px; border-top: 1px solid ${border};">
              <p style="margin: 0; font-size: 12px; color: ${textMuted}; line-height: 1.5;">This report was generated automatically by Fantasy Roast.<br>Automated weekly power rankings for fantasy commissioners.</p>
              <p style="margin: 14px 0 0 0; font-size: 13px; color: #e0e0e0;">See you in the group chat. — Fantasy Roast</p>
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
  const lines: string[] = [
    `${data.leagueName} — Week ${data.week}`,
    "Weekly Power Rankings",
    "",
  ];
  if (data.commissionerNote?.trim()) {
    lines.push(data.commissionerNote.trim(), "");
  }
  lines.push(
    data.introSummary,
    "",
    "POWER RANKINGS",
    "---",
  );
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
  lines.push("", "VILLAIN OF THE WEEK", "---", `${data.villainOfTheWeek.teamName}: ${data.villainOfTheWeek.reason}`);
  lines.push("", "FRAUD ALERT", "---", `${data.fraudAlert.teamName}: ${data.fraudAlert.reason}`);
  lines.push("", "---", "This report was generated automatically by Fantasy Roast. Automated weekly power rankings for fantasy commissioners.", "", "See you in the group chat. — Fantasy Roast");
  if (data.appUrl) lines.push("", `Want this for your league? ${data.appUrl}`);
  return lines.join("\n");
}
