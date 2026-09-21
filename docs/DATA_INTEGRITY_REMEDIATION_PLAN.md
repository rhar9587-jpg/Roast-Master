# Data-Integrity Remediation Plan — Roast-Master

**Status:** Planning only — no implementation in this document.  
**Date:** 2026-09-20  
**Purpose:** Shareable architecture plan for fixing inconsistent sources of truth across weekly roast, commissioner email, league history, hero receipts, and demo data.

---

## Confirmed issues (audit)

1. Historical weekly rankings mix historical scores with current Sleeper standings.
2. Season ranking / playoff / championship concepts are conflated.
3. Unplayed future matchup shells are not consistently filtered.
4. Personal hook “undefeated / ∞ wins” is logically wrong.
5. Demo weekly roast and demo commissioner email use different hard-coded truths.
6. Expected wins relies on array index alignment.
7. Ties can become wins (`>=` winner selection).
8. Ranking trends are stored only in an in-memory Map.
9. Weekly email history narrative joins by display name.
10. Automated numerical coverage is weak.

---

## 1. Root-cause architecture summary

Today there are **four parallel “truth” pipelines**:

| Pipeline | Source of W/L, PF, PA, rank | Consumers |
|---|---|---|
| **A. Live weekly** | `roster.settings` W/L + matchup scores `1..week` as `number[]` | `buildTeamsFromSleeper` → power rankings, commissioner email, preview |
| **B. League history** | Matchups (with 0–0 skip + ties) for grid; **`roster.settings.rank/wins/losses`** for season awards | Dominance grid, hero receipts, storylines, email narratives |
| **C. Season wrapped / autopsy** | `roster.settings` + ad-hoc week walk with `>=` winners | Wrapped cards, league autopsy |
| **D. Demo** | Hard-coded H2H totals + sparse `WEEKLY_MATCHUPS` + **separate** commissioner payload | Demo roast, email, preview, wrapped |

### Underlying causes (not UI bugs)

1. **No week-scoped standings reconstruction.** `buildTeamsFromSleeper` mixes through-week points with current-season `settings.wins/losses` and current `fpts_against` (in `computeSeasonRaces`).
2. **One overloaded `rank`.** Sleeper `settings.rank` is treated as regular-season seed, playoff cutoff input, and often championship/finals finish (`getRankLabel(1) === "Champion"`, bridesmaid/paper-champion).
3. **Matchup status is local and inconsistent.** History already has `isCompletedMatchupPair`; roast/commissioner/autopsy do not share it; several paths use `points >=` as win.
4. **Score history is positional** (`weeklyScores: number[]`), so skipped weeks shift expected-wins joins.
5. **Identity is display-name at the email narrative boundary** (`findCell` by `aName`/`bName`).
6. **Demo duplicates calculations** instead of feeding one fixture into production engines.
7. **Trend store is ephemeral** (orthogonal to correctness of numbers).

### Smallest safe architectural change (one sentence)

Introduce a **shared matchup parser + `TeamStateThroughWeek` reconstruction**, make power rankings / roast / commissioner / wrapped consume it with week-keyed scores and stable IDs, then extend season stats with explicit **regularSeasonRank / playoffQualified / finalFinish**—and drive demo off that same stack—while **deferring ranking persistence** to a follow-up.

---

## 2. Proposed canonical domain models

Put these in something like `server/lib/domain/` (and thin shared types if the client needs the same shapes).

### A. Matchup status (single parser)

```ts
type MatchupStatus =
  | "scheduled"      // unplayed shell (typically 0–0, no meaningful scoring)
  | "in_progress"    // optional: both scored-ish but week not final — only if detectable
  | "completed_win"  // side A beat B
  | "completed_loss"
  | "tie";

type ParsedMatchup = {
  week: number;
  matchupId: number;
  home: { rosterId: number; ownerKey: string; points: number };
  away: { rosterId: number; ownerKey: string; points: number };
  status: MatchupStatus;
  winnerRosterId?: number; // only for completed_win/loss
};
```

**Rules:**

- Prefer existing history heuristic: completed iff `aPoints > 0 || bPoints > 0` (document edge case: rare true 0–0 completed games).
- Winner only when `aPoints !== bPoints` and completed.
- **No** winner-dependent metric on `scheduled` or `tie` unless the feature explicitly handles ties.

### B. Week-aware team state

```ts
type WeeklyScore = {
  week: number;
  points: number;
  opponentRosterId?: number;
  opponentPoints?: number;
  result: "W" | "L" | "T" | "U";
};

type TeamStateThroughWeek = {
  teamId: string;          // roster_id string for single-season; prefer ownerKey when cross-season
  ownerKey: string;        // `owner:${userId}` / stable key
  displayName: string;     // display only
  throughWeek: number;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  weeklyScores: Map<number, number>; // or WeeklyScore[]
};
```

**Reconstruction:** fold only **completed** (and optionally tie) matchups with `week <= throughWeek`. Never read `roster.settings.wins/losses/fpts_against` for historical week views.

### C. Season outcome (disentangled)

```ts
type SeasonOutcome = {
  season: string;
  ownerKey: string;
  regularSeasonRank: number;     // from reconstructed RS standings or Sleeper rank *as seed only*
  playoffQualified: boolean;
  playoffQualifiedSource: "league_settings" | "inferred" | "bracket";
  finalFinish?: number;          // 1 = champion, 2 = runner-up, … only from bracket / explicit finish
  championshipWon: boolean;      // true only when finalFinish === 1 from bracket (or explicit demo field)
};
```

Do **not** infer championship from `settings.rank === 1`.

### D. Demo fixture

One fixture object: managers + full week×matchup matrix (Sleeper-shaped) + optional explicit `SeasonOutcome[]`.

`getDemoWeeklyRoast`, commissioner/preview email, wrapped, autopsy, dominance → all call the same engines with that input.

Fake inputs are fine; duplicate fake calculations are not.

---

## 3. Exact files / functions that should change

### New (core)

| Path | Role |
|---|---|
| `server/lib/domain/matchupStatus.ts` | `parseMatchupPair`, `isPlayableForWinners`, tie handling |
| `server/lib/domain/teamStateThroughWeek.ts` | `buildTeamStatesThroughWeek(matchupsByWeek, rosters, users, throughWeek)` |
| `server/lib/domain/seasonOutcome.ts` | RS rank, playoff qual, bracket → `finalFinish` |
| `server/lib/domain/expectedWins.ts` | Week-keyed expected wins |
| `server/league-history/demoFixture.ts` (or slim `demoLeague.ts`) | Canonical demo inputs only |

### Must rewrite / thin adapters

| File | Functions |
|---|---|
| `server/lib/weeklyCommissioner.ts` | **`buildTeamsFromSleeper`**, `pickVillainFromMatchups`, `buildWeekMatchups`, `computeWeeklySuperlatives`, `computeSeasonRaces` |
| `server/lib/powerRankings.ts` | `PowerRankingsTeamInput.weeklyScores`, **`computeExpectedWins`**, `enrichTeam` (ties in record/winPct) |
| `server/lib/weeklyRoastEngine.ts` | `computeBiggestBlowout`, `computeClosestGame`, `computeFraudWatch`, narrative entry — filter via parser |
| `server/lib/weeklyPreview.ts` | Prefer `teamId` maps over `teamName` for odds/blowout/upset |
| `server/lib/weeklyEmailNarratives.ts` | **`findCell` → join by owner/roster keys**, not names |
| `server/league-history/index.ts` | Replace local `isCompletedMatchupPair` with shared parser; rebuild **`seasonStats`** with `regularSeasonRank` / `finalFinish`; stop using `settings.rank` as championship |
| `server/league-history/sleeper.ts` | Add `getWinnersBracket` / `getLosersBracket` (or equivalent) |
| `server/routes.ts` | `handleWrapped`, league autopsy blowout loop (`>=`), choke/MVP walks — use parser + team state |
| `server/league-history/demoLeague.ts` | Delete duplicated roast/email math; keep fixture + engine calls |
| `client/src/pages/LeagueHistory/computeHeroReceipts.ts` | Bridesmaid / paper champion / `getRankLabel` — use `finalFinish` / `championshipWon`, not `rank === 1` |
| `client/src/pages/LeagueHistory/index.tsx` | **`computePersonalHookCard`** undefeated logic |
| `client/src/pages/LeagueHistory/InsightsDashboard.tsx` | Stop rendering `∞`; show real `W–L` |
| `client/src/pages/LeagueHistory/types.ts` | Extend `SeasonStat` |
| `shared/schema.ts` | Optional: wrapped season fields for `regularSeasonRank` / `finalFinish` |

### Defer (not correctness-critical)

| File | Note |
|---|---|
| `server/lib/weeklyRankingsStore.ts` | Persist later (DB / `weeklyReportStore`); keep in-memory Map OK for now if documented |

---

## 4. Migration sequence (small safe commits)

### Commit 0 — Tests first (failing allowed)

Add golden fixtures + tests listed in §5 against *current* behavior where useful, then assert *desired* behavior for the new helpers (TDD for domain modules).

### Commit 1 — Matchup parser only

Extract shared `parseMatchupPair`. Point history grid + weeklyMatchups builder at it. No behavior change intended for history.

### Commit 2 — `TeamStateThroughWeek` + wire weekly pipeline

Implement reconstruction. Change `buildTeamsFromSleeper` to use it. Update `PowerRankingsTeamInput` to week-keyed scores. Fix expected wins.

This alone fixes issue 1, 6, and most of PA/luck/fraud/email rank drift.

### Commit 3 — Consume parser in roast / villain / autopsy / wrapped week walks

Replace `>=` winner picks; skip scheduled shells. Fixes 3 and 7 in product paths.

### Commit 4 — Season outcome model

Add bracket fetch; populate `regularSeasonRank`, `playoffQualified`, `finalFinish`. Migrate `seasonStats` payload (keep deprecated `rank` alias = `regularSeasonRank` temporarily). Update hero receipts + taglines carefully.

### Commit 5 — Identity end-to-end for email narratives

Pass `teamId`/`ownerKey` on matchup pairs; join dominance cells by key. Fixes 9.

### Commit 6 — Personal hook undefeated

Count completed W/L in scope; require minimum games; render `7–0` (or “Unbeaten in this range”); never `∞`. Fixes 4.

### Commit 7 — Demo single fixture

One Sleeper-shaped week matrix; `getDemoWeeklyEmailPayload` / roast / preview call production engines. Fixes 5 + demo Week 8 invariant.

### Commit 8 (optional / separate PR) — Persist ranking snapshots

Does not block correctness.

**Note:** Keep each commit shippable. Weekly email + history grid should not regress in the same PR as bracket semantics if risk is high—split Commit 4 if needed.

---

## 5. Tests to add (before / refactor / after)

### Required scenarios

- Normal completed week
- Future 0–0 matchup shell
- Partially completed week
- True tie
- Malformed / missing matchup pair
- Missing team row
- Missing whole week
- Undefeated 7–0
- Historical Week 3 generated in Week 10
- Playoff qualification
- Champion and runner-up truth
- Owner/team identity across seasons
- Demo Week 8 consistency
- **Invariant:** same metric + same scope must produce the same value everywhere

### Before / with Commit 0–1 (lock contracts)

- Parser: normal completed week; 0–0 shell; partial week (one game scored, others 0–0); true tie; malformed/missing pair; missing team row.
- Existing `weekFilter.test.ts` stays.

### With Commit 2 (core pipelines)

New files e.g. `teamStateThroughWeek.test.ts`, `powerRankings.test.ts`:

- Historical Week 3 generated as if in Week 10 → W/L/PF/PA match only weeks 1–3.
- Missing whole week in fetch → no index shift; expected wins join by week number.
- Missing score ≠ silent `0` opponent for EW unless week truly present with 0.
- Undefeated 7–0 reconstructed state.
- Invariant helper: `metric(scope)` equal for power-rank input vs commissioner season races vs preview through-week.

### With Commit 3

- Roast blowout/closest/fraud ignore shells and ties.
- Villain picker does not crown a tie or 0–0.

### With Commit 4

- Playoff qualification from `playoff_teams` + RS rank.
- Champion / runner-up only when bracket (or explicit fixture) says so; `rank === 1` alone ≠ champion.
- Owner/team identity across seasons (`owner:` key).

### With Commit 6–7

- Personal hook: sparse losses-absent sample does **not** claim undefeated; true 7–0 does with `7–0` not `∞`.
- Demo Week 8: roast high score, blowout margin, and commissioner superlatives/matchups agree on Landlord 167.4 vs Rebuild 62.1 (and shared averages).

### After

One cross-surface invariant test module that runs the same fixture through roast engine + commissioner builders + team state and asserts equal high/low/blowout/record.

**Current coverage gap:** automated tests exist only for `cardCopy`, `seasonTagline`, and `weekFilter` — none of the calculation cores.

---

## 6. Risks and backwards-compatibility considerations

| Risk | Mitigation |
|---|---|
| API field rename (`rank` → `regularSeasonRank`) breaks client | Keep `rank` as deprecated alias of RS rank for one release; add new fields alongside |
| Bracket API missing/incomplete for old seasons | `finalFinish` optional; hero cards that need titles **skip** rather than invent |
| True 0–0 completed games misclassified as scheduled | Document heuristic; optional override later via starters/points metadata |
| Mid-week “in progress” looks like completed | For recap mode, only treat as completed when you accept live scores; preview mode should use pairings only |
| Demo email copy becomes “less punchy” if engine-driven | Keep fixture scores dramatic; copy still from engines |
| Power scores / luck deltas change after W/L fix | Expected and correct; call out in PR as intentional truth fix |
| Trend arrows still empty after deploy | Separate from correctness; document until persistence |
| Performance: fetching all weeks + brackets | Batch/cache per league+week; reuse one fetch in commissioner path (today double-fetches matchups) |

---

## 7. Findings from repo review that refine the audit

### Confirmed as stated

Issues **1, 3, 4, 5, 6, 7, 8, 9, 10**.

### Refinements / nuances

1. **History already filters 0–0 and handles ties** in `buildDominanceGrid` / weeklyMatchups (`isCompletedMatchupPair`, skip equal scores for W/L feed). The gap is that weekly roast/commissioner/autopsy never reused that logic—not that the whole repo ignores shells.

2. **`playoffQualified` already exists** on `seasonStats` / demo. The remaining bug is using **`rank` for championship/runner-up/paper-champion/bridesmaid** (`computeHeroReceipts`, `getRankLabel`), not missing a playoff flag entirely.

3. **PA issue is narrower than “power input always has current PA”:** `buildTeamsFromSleeper` does not set `pointsAgainst` on teams; the live bug is **`computeSeasonRaces`** dividing **current** `fpts_against` by through-week game counts. W/L mixing is the bigger powerScore/luck corruption.

4. **`buildTeamsFromSleeper` ignores ties** in record strings (`wins-losses` only)—related to issue 7.

5. **Missing-week fetch (`catch { continue }`)** makes issue 6 worse: arrays shorten and weeks realign incorrectly even when later weeks exist.

6. **Demo commissioner payload is worse than “different scores”:** it invents teams (`Cash Cons`, `Underachievers`) not in `MANAGERS`, and Week 8 roast (167.4 blowout) disagrees with email (142.1 vs Waiver Wizard).

7. **Undefeated ∞** is purely client-side (`computePersonalHookCard` + `InsightsDashboard`); demo sparsity (`WEEKLY_MATCHUPS` ≪ H2H grid) makes Landlord look undefeated while grid shows ~87–42.

8. **Sleeper brackets are unused** today—needed for honest `finalFinish`; no contradiction, but it is new API surface.

9. **Issue 8** is correctly non-blocking for numerical integrity; trends default to `flat` when store is cold.

10. **`stoleOne` / `gotRobbed` in commissioner** already skip ties (`aPts === bPts`) and use `>`; villain/blowout/autopsy still use `>=`—so tie handling is partially fixed in one path only.

---

## Appendix A — Issue → required direction (from audit)

### 1. Historical weekly rankings mix scores with current standings

**Problem:** `buildTeamsFromSleeper()` fetches weekly scores only through the requested week, but wins/losses come from current `roster.settings`. Generating Week 3 later in the season combines Week 1–3 scores with current-season W/L. Affects record, winPct, powerScore, luckDelta, fraud logic, previews, and commissioner emails. Points-against has a similar problem because current-season PA can be divided by historical games.

**Direction:** Create canonical week-aware team state reconstructed from matchups (`TeamStateThroughWeek`) and have weekly calculations consume it.

### 2. Season ranking / playoff / championship conflated

**Problem:** League History uses `roster.settings.rank`, then treats it as regular-season rank, playoff qualification, and sometimes championship/final finishing position.

**Direction:** Explicit fields: `regularSeasonRank`, `playoffQualified`, `finalFinish`. Use Sleeper matchup/standings data for regular-season ranking and playoff bracket data for actual playoff/final outcome where available. Do not infer championship from a generic rank field.

### 3. Unplayed future matchup shells inconsistently filtered

**Problem:** Dominance grid already skips 0–0 shells. Weekly roast, commissioner logic, and ranking calculations do not consistently do so. Ties can also be treated as wins due to `>=`.

**Direction:** One canonical matchup status/parser used across all features: scheduled/unplayed, completed win/loss, tie, potentially in-progress. No winner-dependent metric on unplayed or tied matchups unless explicitly designed for ties.

### 4. Personal hook “undefeated / ∞ wins”

**Problem:** Treats “no losses found in supplied weeklyMatchups” as undefeated. UI renders literal `∞` rather than actual wins. In demo data this conflicts with the grid’s hard-coded Landlord record (~87–42).

**Direction:** Count actual completed wins/losses in the relevant scope. Render a real record such as `7–0`. If the dataset is incomplete or too small, avoid an undefeated claim. Use wording such as “Unbeaten in this range” only when justified.

### 5. Demo weekly roast vs demo commissioner email

**Problem:** Weekly roast derives from `WEEKLY_MATCHUPS`. Commissioner email has independent hard-coded matchup scores, rankings, averages, and superlatives → contradictory demo outputs.

**Direction:** One canonical demo fixture; derive all demo surfaces from the same calculation engines used in production wherever practical.

### 6. Expected wins array index alignment

**Problem:** `weeklyScores: number[]`. Missing week/API data can shift weeks and compare unrelated weeks. Missing scores can become zero.

**Direction:** Represent weekly score history with explicit week identity (`Map<number, number>` or `{week, score}[]`). Join expected-wins comparisons by actual week number.

### 7. Ties become wins

**Problem:** Some code uses `a.points >= b.points ? a : b`.

**Direction:** Explicit tie handling everywhere.

### 8. Ranking trends in-memory only

**Problem:** Disappear after process restart/deploy; may only be stored after a send.

**Direction:** Recommend whether to persist ranking snapshots. If persistence is deferred, clearly separate this from the correctness-critical fixes. **Recommendation: defer persistence; do not block correctness work.**

### 9. Weekly email history narrative joins by display name

**Problem:** Duplicate names can map to wrong owners.

**Direction:** Carry stable IDs (owner/roster keys) end-to-end; use names only for display.

### 10. Weak numerical test coverage

**Direction:** Add the test matrix in §5 before/during/after the refactor.

---

## Appendix B — Key code locations (verified)

| Concern | Location |
|---|---|
| W/L from current settings + scores through week | `server/lib/weeklyCommissioner.ts` → `buildTeamsFromSleeper` |
| Expected wins by array index | `server/lib/powerRankings.ts` → `computeExpectedWins` |
| PA from current roster / through-week games | `server/lib/weeklyCommissioner.ts` → `computeSeasonRaces` |
| `>=` villain / blowout | `weeklyCommissioner.pickVillainFromMatchups`, `weeklyRoastEngine.computeBiggestBlowout`, `routes.ts` autopsy |
| 0–0 filter (history only) | `server/league-history/index.ts` → `isCompletedMatchupPair` |
| Season `rank` from Sleeper | `server/league-history/index.ts` seasonStats loop; `routes.ts` `handleWrapped` |
| Rank-as-champion in UI | `client/.../computeHeroReceipts.ts` → `getRankLabel`, bridesmaid, paper champion |
| Undefeated / ∞ | `client/.../index.tsx` → `computePersonalHookCard`; `InsightsDashboard.tsx` |
| Name-based narrative join | `server/lib/weeklyEmailNarratives.ts` → `findCell` |
| In-memory trends | `server/lib/weeklyRankingsStore.ts` |
| Divergent demo email | `server/league-history/demoLeague.ts` → `getDemoWeeklyEmailPayload` vs `getDemoWeeklyRoast` / `WEEKLY_MATCHUPS` |
| Existing tests only | `server/lib/cardCopy.test.ts`, `seasonTagline.test.ts`, `league-history/weekFilter.test.ts` |

---

*End of plan. Implementation should follow the commit sequence in §4; do not patch individual UI symptoms without the shared domain layer.*
