# League History — Mini Cards & Page Structure

## 1. RECOMMENDATION: Page Layout & Structure

### Final page layout (ordered sections)

1. **Hero** (no data) / **Header** (data): "League History", league name, Viewer selector
2. **League selector** (collapsible)
3. **The Headlines** — Baseball cards (Landlord, Biggest Victim, Biggest Rivalry) — **share artifact**
4. "Found your nemesis? Send this roast." (helper line)
5. **The Scoreboard** — Dominance grid + toolbar + Legend (Storylines filter) — **analysis + share**
6. **Trust signals** (Powered by Sleeper, Last updated)
7. **League Storylines** — 5 mini cards (league-wide) — **share artifact**
8. **Your Roast** — 3 mini cards (personalized to viewer) — **share artifact**

### Share vs analysis

- **Share artifacts:** Baseball cards, grid (screenshot/export), League Storylines, Your Roast. Dense, punchy, screenshot-ready.
- **Analysis:** Grid + legend (filter, explore), League selector, Viewer selector. Interactive, exploratory.

### Viewer selector

- **Yes.** "Your Roast" is personalized; we need a "View as: [Manager]" choice.
- **Placement:** In the header row when data exists, next to "League History" / league name. Compact Select.
- **Default:** First manager in list (best W–L, i.e. `managers[0]`). No "most recent" — we don’t persist that.
- **Behavior:** Changing viewer updates only "Your Roast" mini cards; no refetch.

### Mini cards vs baseball cards

- **Baseball cards:** 3 hero collectibles. Large, carousel, avatar, "ROAST NOTES" flip. Landlord / Most Owned / Biggest Rivalry. High-impact share moment.
- **Mini cards:** 8 small tiles. Denser, more numerous, grid layout. New angles (point diff, punching bag, rival central, etc.). Scannable, screenshot-friendly. No flip, no avatar.

---

## 2. MINI CARD SET (8 types)

### League Storylines (5)

| # | Title | Primary stat | Supporting line | Computation | Share value |
|---|-------|--------------|-----------------|-------------|-------------|
| 1 | Everybody's Victim | N (count) | "The whole league has receipts." | Manager who is NEMESIS for the most *distinct* other managers. Count distinct `a` where `b = manager` and `badge = NEMESIS`. | "Everyone owns them" — peak roast target |
| 2 | Point Differential King | +X pts | "Biggest flex in the league." | Manager with max `totalPF - totalPA` from `totalsByManager`. | Bragging rights |
| 3 | Punching Bag | L (losses) | "Took more L's than anyone." | Manager with max `l` from `rowTotals`. | Sympathy / dunk |
| 4 | Untouchable | N (count) | "Never lost to them." | Manager with most OWNED cells where record has 0 losses (e.g. 3–0). Parse `record`, count. | Dominance flex |
| 5 | Rival Central | N games | "They still can't settle it." | Among RIVAL cells, max `games` for a single matchup. "Longest rivalry." | "Chaos" vibe |

### Your Roast (3) — depend on `viewerKey`

| # | Title | Primary stat | Supporting line | Computation | Share value |
|---|-------|--------------|-----------------|-------------|-------------|
| 1 | Your Favorite Victim | record or score | "You own them." | Viewer’s best OWNED matchup (max score, min 3 games). `a = viewerKey`, `badge = OWNED`. | Personal flex |
| 2 | Your Kryptonite | record or score | "They own you." | Viewer’s worst NEMESIS (min score, min 3 games). `a = viewerKey`, `badge = NEMESIS`. | Self-roast / nemesis callout |
| 3 | Your Unfinished Business | N games | "Can't settle it." | Viewer’s RIVAL matchup with most games. `(a = viewer OR b = viewer)`, `badge = RIVAL`, max games. | Rivalry tease |

All derivable from `allCells`, `managers`, `rowTotals`, `totalsByManager`, `cellMap`. **No new API.**

---

## 3. IMPLEMENTATION PLAN (phases)

### Phase 1 (this PR)

- **`storylines.ts`** — Pure functions: `computeLeagueStorylines(...)`, `computeYourRoast(...)`. Inputs: `allCells`, `managers`, `rowTotals`, `totalsByManager`, `viewerKey`.
- **`StorylinesMiniCards.tsx`** — Two sections: "League Storylines" (5), "Your Roast" (3). Responsive grid: 2 cols mobile, 3–4 desktop. Mini card: title, big stat, supporting line. Use `Card` with `rounded-2xl`, subtle shadow.
- **Viewer selector** — Select dropdown in header when `hasData`. State `viewerKey`; default `managers[0]?.key`.
- **Wire into `LeagueHistory/index`** — Add Viewer selector; render `StorylinesMiniCards` below grid (below trust signals), only when `hasData && hasEnoughData`. Pass `viewerKey`, `allCells`, `managers`, `rowTotals`, `totalsByManager`, etc.
- **Export:** Mini cards are **not** in `gridExportRef`; no `forExport` handling. Export unchanged.

### Phase 2 (optional follow-ups)

- Optional API: precomputed storyline aggregates if we ever want to move logic server-side.
- "Share this section" (e.g. League Storylines only) as image — optional.
- A/B test order: Storylines above vs below grid.

---

## 4. FILE-LEVEL CHANGES (Phase 1)

| File | Changes |
|------|---------|
| `client/src/pages/LeagueHistory/storylines.ts` | **New.** `computeLeagueStorylines`, `computeYourRoast`, types for each card. |
| `client/src/pages/LeagueHistory/StorylinesMiniCards.tsx` | **New.** League Storylines + Your Roast grids, `MiniCard` sub-component. |
| `client/src/pages/LeagueHistory/index.tsx` | Add `viewerKey` state, Viewer selector, `StorylinesMiniCards` section; pass `totalsByManager` (from `data`). |

No changes to `InsightsDashboard`, `DominanceGrid`, `GridTable`, export flow, or API.
