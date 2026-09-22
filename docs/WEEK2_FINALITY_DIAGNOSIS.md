# Diagnosis: NFL Week 2 stuck on LIVE (22 Sep 2026)

**Status:** Investigation only — no code changes in this note.  
**App:** https://fantasyroast.net  
**League:** NFL Downunder (`1389437091309432832`)  
**Observed:** Week 2 still shown as LIVE / not RECAP after the final Week 2 game finished.

---

## 1. Root cause

Calendar finality prefers Sleeper’s lagging **`display_week`** over **`week` / `leg`**.

In `server/league-history/nflState.ts` (`nflWeekContextFromState`):

```ts
const previewWeekRaw = Number(state.display_week ?? state.week ?? state.leg ?? 0);
const previewWeek = Math.min(18, Math.max(1, previewWeekRaw || 1));
const latestFinalWeek = Math.max(0, previewWeek - 1);
```

### Live Sleeper `/state/nfl` (at investigation time)

| Field | Value |
|--------|--------|
| `week` | **3** |
| `leg` | **3** |
| `display_week` | **2** |
| `season` | 2026 |
| `season_type` | regular |

### What Fantasy Roast derived

| Derived field | Value |
|---------------|--------|
| `previewWeek` | **2** (from `display_week`) |
| `latestFinalWeek` | **1** |
| `recapWeek` | **1** |

Production `/api/nfl/state` matched that (`latestFinalWeek: 1`).

League corroboration: `settings.last_scored_leg: 2` (Week 2 has been scored).

**Conclusion:** Week 2 is treated as the *current in-progress* week, so it never becomes calendar-final.

---

## 2. Exact code path (NFL Downunder Week 2)

1. `getNflWeekContext()` → `latestFinalWeek = 1`
2. `resolveLeagueWeekFinality(2, "2026", nfl)` → `2 <= 1` → **`weekIsFinal = false`**
3. Roast / commissioner / public share pass that into `buildWeeklyRoastNarrative`
4. `resolveWeekSlateStatus({ weekIsFinal: false, matchups })`:
   - All 6 pairs have real nonzero scores
   - With `weekIsFinal: false`, classifier marks them **`in_progress`** (by design — scores alone must not crown winners)
   - Slate → **`live`**, `recapReady: false`

### Production roast (observed)

```json
"headline": "Week 2 is live — scores are still moving.",
"signals": {
  "weekIsFinal": false,
  "slateStatus": "live",
  "recapReady": false
}
```

**Counterfactual:** same matchups with `weekIsFinal: true` → slate **`final`** / `recapReady: true`.  
Matchup data is enough; the calendar gate is what blocks it.

---

## 3. Sleeper matchup data (Week 2)

- 12 roster rows, 6 H2H pairs
- No null points, no 0–0 shells
- Score range ~60.12–140.56

Week 3 matchups exist as all-`0.0` shells (upcoming), consistent with NFL `week: 3`.

**Interpretation of scores is fine.** Nothing in player/starter fields forces LIVE — LIVE comes from `weekIsFinal: false` + nonzero scores → `in_progress`.

---

## 4. Sleeper NFL state vs our interpretation

| Source | Says |
|--------|------|
| Sleeper `week` / `leg` | Season advanced to **3** |
| Sleeper `display_week` | Still **2** |
| Our code | Trusts **`display_week` first** → still in Week 2 |
| League `last_scored_leg` | **2** |

Upstream fields disagree with each other; **our choice of which field drives finality is wrong for this transition window.**  
Not “Sleeper has no idea Week 2 ended” — `week`/`leg` and `last_scored_leg` already reflect that.

---

## 5. Caching

**Not the cause.** Fresh `/api/nfl/state` and `/api/roast` return the wrong finality live. Share uses short TTL for non-final weeks. Client loads `/api/nfl/state` on entry (no long React Query cache for NFL state).

---

## 6. Timezone / calendar

**Not involved.** Finality here is not Sydney vs UTC Monday-night wall-clock. It is purely:

`display_week ?? week ?? leg` → `latestFinalWeek = preview - 1`.

---

## 7. Cross-surface impact

Canonical **backend** issue — all surfaces affected via the same `latestFinalWeek`:

| Surface | Week 2 status |
|---------|----------------|
| Weekly roast | LIVE / not recapReady |
| Public share | “Week 2 Live” |
| Commissioner email preview | “Week 2 is live — scores are still moving.” |
| Power Rankings through-week | Capped by `latestFinalWeek = 1` |
| Share clipboard | Non-final path |

---

## 8. Fit with PR15/16 model

PR15/16 intentionally split:

1. **Calendar finality** (`resolveLeagueWeekFinality` / `latestFinalWeek`) — “may this week crown winners?”
2. **Slate classification** (`resolveWeekSlateStatus`) — given that, are matchups final / live / upcoming / unavailable?

That split is still correct. The bug is **step 1’s input**: preferring lagging `display_week` for `latestFinalWeek`.

A pure “all matchups have scores ⇒ FINAL” rule would **bypass** calendar finality and regress live Monday-night weeks (nonzero scores while games continue). That is **not** the intended architecture and should not be the sole fix.

---

## 9. Regression risks (for any future fix)

- Live MNF / late windows: must not finalize from scores alone
- Stat corrections after `last_scored_leg`
- 0–0 shells after calendar final → `unavailable` (already handled)
- Postponements / partial slates
- Playoffs / offseason (`season_type`)
- Periods where `display_week` intentionally differs from `week`

---

## Recommended minimal fix (not implemented here)

Prefer **`week` / `leg`** (or `max(week, leg, display_week)`) when deriving **`latestFinalWeek`**, while optionally keeping `display_week` for preview/UI labeling if needed.

Concrete direction:

- `latestFinalWeek = max(0, authoritativeWeek - 1)` where `authoritativeWeek` is based on `week`/`leg` (or max of those and `display_week`)
- Do **not** invent finality from matchup points alone
- League `last_scored_leg` could be a later corroborating signal; NFL-state fix alone would unblock Downunder Week 2

### Files that would change

- `server/league-history/nflState.ts`
- `server/league-history/nflState.test.ts`
- Possibly integrity / slate tests if they assume `display_week`-first behavior

### Tests required

1. Fixture `{ week: 3, display_week: 2, leg: 3 }` → `latestFinalWeek === 2`
2. Week 1 in progress `{ week: 1, display_week: 1 }` → `latestFinalWeek === 0`
3. Aligned fields `{ week: 5, display_week: 5 }` → `latestFinalWeek === 4`
4. Downunder Week 2 roast with that NFL context → `slateStatus: "final"`, `recapReady: true`
5. Live mid-week: nonzero scores + `weekIsFinal: false` still → `live` (no regression)

---

## Bottom line

| Question | Answer |
|----------|--------|
| Bug type | **Our finality interpretation** of Sleeper NFL state |
| Sleeper data stale? | Matchups complete; `week`/`leg` at 3; **`display_week` lags at 2** |
| Caching? | No |
| Timezone? | No |
| UI-only? | No — roast, share, email all wrong via same `latestFinalWeek` |
| Matchups alone enough? | Yes **if** calendar finality were true; PR15/16 correctly refuses to finalize from scores alone while calendar says non-final |
