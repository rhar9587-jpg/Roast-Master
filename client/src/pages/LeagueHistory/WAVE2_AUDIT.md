# Wave 2 — Mini Cards + Storylines: Audit & Changes

## A) Audit table: inputs, thresholds, failure case

| Card | Inputs | Thresholds | Failure case |
|------|--------|------------|--------------|
| **Everybody's Victim** | `allCells`, `managers` | `games >= MIN_GAMES_FOR_STORYLINE` (5), `score <= SEVERE_NEMESIS_SCORE` (-0.40) | No NEMESIS cells meeting both → card omitted |
| **Point Differential King** | `totalsByManager` | None | No `totalsByManager` or empty → card omitted |
| **Punching Bag** | `managers`, `rowTotals`, `totalLeagueGames` | `totalLeagueGames >= MIN_LEAGUE_GAMES_FOR_PUNCHING_BAG` (20) | League games < 20 → card omitted; else max `l` from `rowTotals` |
| **Untouchable** | `allCells`, `managers` | `badge === OWNED`, `losses === 0`, `wins >= MIN_WINS_FOR_UNTOUCHABLE` (3), `games >= MIN_GAMES_FOR_STORYLINE` (5) | No qualifying cells → card omitted |
| **Rival Central** | `allCells` | `badge === RIVAL`, `games >= MIN_GAMES_FOR_STORYLINE` (5) | No RIVAL with 5+ games → card omitted |
| **Your Favorite Victim** | `viewerKey`, `allCells`, `managers` | `a === viewerKey`, `OWNED`, `games >= MIN_GAMES_FOR_PERSONAL` (5), `score >= SEVERE_OWNED_SCORE` (0.40) | No viewer / none qualify → card omitted; empty state if viewer chosen but no cards |
| **Your Kryptonite** | Same | `a === viewerKey`, `NEMESIS`, `games >= 5`, `score <= SEVERE_NEMESIS_SCORE` (-0.40) | Same |
| **Your Unfinished Business** | Same | `a === viewerKey OR b === viewerKey`, `RIVAL`, `games >= 5` | Same |

**Constants (storylines.ts):**
- `MIN_GAMES_FOR_STORYLINE = 5`
- `MIN_GAMES_FOR_PERSONAL = 5`
- `MIN_WINS_FOR_UNTOUCHABLE = 3`
- `SEVERE_OWNED_SCORE = 0.40`
- `SEVERE_NEMESIS_SCORE = -0.40`
- `MIN_LEAGUE_GAMES_FOR_PUNCHING_BAG = 20`

---

## B) Files and functions changed

| File | Changes |
|------|---------|
| **`utils.ts`** | Added `VIEWER_STORAGE_KEY`, `getViewerByLeague(leagueId)`, `setViewerByLeague(leagueId, viewerKey)`. Persist shape: `{ [leagueId]: viewerKey }`. |
| **`storylines.ts`** | Added constants; `MiniCard` now has `statPrimary`, `statSecondary?`, `meta?` (replaced `stat`). `computeLeagueStorylines`: credibility rules, `totalLeagueGames` arg, copy updates, `cellKey` for Everybody's Victim / Untouchable / Rival Central. `computeYourRoast`: only when `viewerKey`, `MIN_GAMES_FOR_PERSONAL` / `SEVERE_*` filters, record-first + score secondary + meta (games), copy updates. |
| **`StorylinesMiniCards.tsx`** | Layout uses `statPrimary` (big), `statSecondary`, `meta`. `viewerChosen` prop; Your Roast empty state: "Pick a wider range to find real receipts." League Storylines and Your Roast both use `onOpenCell` for click-through where `cellKey` exists. |
| **`index.tsx`** | Viewer: no auto-pick; placeholder "Pick your manager"; sentinel `__none__` in Select; persist/clear via `getViewerByLeague` / `setViewerByLeague`. Restore on load when `data.league.league_id === leagueId`; clear on invalid. Clear `viewerKey` on `leagueId` change. `computeLeagueStorylines` gets `grandTotals.games`. Section visibility: Storylines when `leagueStorylines.length > 0` or `viewerKey`; pass `viewerChosen`, `onOpenCell`. |

---

## C) Copy alignment (Wave 2)

- Everybody's Victim: "Everyone has receipts."
- Punching Bag: "Took more L's than anyone."
- Untouchable: "Never lost. Rent is due."
- Rival Central: "Still can't settle it."
- Favorite Victim: "You own them."
- Kryptonite: "They cook you."
- Unfinished Business: "This one's personal."
- Your Roast empty: "Pick a wider range to find real receipts."
- Titles: UPPERCASE (e.g. EVERYBODY'S VICTIM, YOUR KRYPTONITE).

---

## D) TypeScript and UI

- **TypeScript:** `npx tsc --noEmit` passes.
- **Lint:** No reported issues.
- **Mobile:** Mini cards use `grid-cols-2` on small screens, `md:grid-cols-3` / `lg:grid-cols-4` on larger; statPrimary `text-xl md:text-2xl`; layout remains screenshot-tight.
- **Export:** Unchanged; mini cards are not in `gridExportRef`.
