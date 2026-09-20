/**
 * Personal hook card for League History insights.
 * Undefeated claims require a concrete record and must not invent ∞ wins
 * or all-time undefeated from incomplete weekly fixtures.
 */

export type WeeklyMatchupDetail = {
  season: string;
  week: number;
  managerKey: string;
  opponentKey: string;
  points: number;
  opponentPoints: number;
  margin?: number;
  won: boolean;
};

export type PersonalHookCard =
  | {
      type: "second_most_points_loss" | "worst_loss";
      title: string;
      subtitle: string;
      body: string;
      teaser: string;
      pointsFor: string;
      week: number;
      season?: string;
    }
  | {
      type: "undefeated";
      title: string;
      body: string;
      record: string;
      wins: number;
      losses: number;
      scope: "all_time" | "partial";
      pointsFor?: string;
      week?: number;
      season?: string;
      teaser?: string;
      subtitle?: string;
    };

function formatPoints(value: number) {
  return Number.isFinite(value) ? value.toFixed(1) : "—";
}

export function computePersonalHookCard(
  viewerKey: string,
  weeklyMatchups: WeeklyMatchupDetail[],
  _managers: unknown[],
  leagueSeason?: string,
  expectedGames?: number | null,
): PersonalHookCard | null {
  const viewerRows = weeklyMatchups.filter((m) => m.managerKey === viewerKey);
  if (!viewerRows.length) return null;

  const seen = new Set<string>();
  let wins = 0;
  let losses = 0;
  let ties = 0;
  for (const m of viewerRows) {
    const id = `${m.season}|${m.week}|${[m.managerKey, m.opponentKey].sort().join("|")}`;
    if (seen.has(id)) continue;
    seen.add(id);
    if (m.won) wins++;
    else if (Number(m.points) === Number(m.opponentPoints)) ties++;
    else losses++;
  }
  const gamesPlayed = wins + losses + ties;

  const lossRows = weeklyMatchups.filter(
    (m) =>
      m.managerKey === viewerKey &&
      !m.won &&
      Number.isFinite(m.points) &&
      Number.isFinite(m.opponentPoints) &&
      Number(m.points) !== Number(m.opponentPoints),
  );

  if (!lossRows.length && losses === 0 && wins > 0) {
    const record = ties > 0 ? `${wins}-${losses}-${ties}` : `${wins}-${losses}`;
    const isPartial =
      expectedGames != null &&
      Number.isFinite(expectedGames) &&
      expectedGames > 0 &&
      gamesPlayed < expectedGames;

    if (isPartial) {
      return {
        type: "undefeated",
        title: "Unbeaten In This Range",
        body: `${record} in the games loaded for this view — not a full all-time claim.`,
        record,
        wins,
        losses,
        scope: "partial",
        season: leagueSeason,
      };
    }

    return {
      type: "undefeated",
      title: "UNDEFEATED 🏆",
      body: `No losses found. You're ${record} in this league history.`,
      record,
      wins,
      losses,
      scope: "all_time",
      season: leagueSeason,
    };
  }

  if (!lossRows.length) return null;

  const weekPointsMap = new Map<string, Array<{ managerKey: string; points: number }>>();
  for (const m of weeklyMatchups) {
    if (!Number.isFinite(m.points)) continue;
    const key = `${m.season}-${m.week}`;
    const list = weekPointsMap.get(key) || [];
    list.push({ managerKey: m.managerKey, points: m.points });
    weekPointsMap.set(key, list);
  }

  const qualifiedSecondMost = lossRows.filter((loss) => {
    const key = `${loss.season}-${loss.week}`;
    const list = weekPointsMap.get(key) || [];
    const higherCount = list.filter((p) => p.points > loss.points).length;
    return higherCount === 1;
  });

  if (qualifiedSecondMost.length > 0) {
    const best = [...qualifiedSecondMost].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const aMargin = Math.abs(a.margin ?? (a.opponentPoints - a.points));
      const bMargin = Math.abs(b.margin ?? (b.opponentPoints - b.points));
      return aMargin - bMargin;
    })[0]!;

    const pointsFor = formatPoints(best.points);
    return {
      type: "second_most_points_loss",
      title: "This Should Have Been a Win.",
      subtitle: "You scored the 2nd-most points in the league.",
      body: `You put up ${pointsFor} points in Week ${best.week}. Only one team scored more — and you still lost.`,
      teaser: "🔒 See who beat you — and why this one hurt so much",
      pointsFor,
      week: best.week,
      season: best.season || leagueSeason,
    };
  }

  const worst = [...lossRows].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const aMargin = Math.abs(a.margin ?? (a.opponentPoints - a.points));
    const bMargin = Math.abs(b.margin ?? (b.opponentPoints - b.points));
    return aMargin - bMargin;
  })[0]!;

  const pointsFor = formatPoints(worst.points);
  return {
    type: "worst_loss",
    title: "You Did Enough.",
    subtitle: "And still took the L.",
    body: `You scored ${pointsFor} in Week ${worst.week} and still lost. That’s fantasy football for you.`,
    teaser: "🔒 See who beat you — and why this one hurt so much",
    pointsFor,
    week: worst.week,
    season: worst.season || leagueSeason,
  };
}
