# League History Receipts Cards Expansion - Implementation Summary

## Final Card Classifications

### HERO Cards (6 must-add, in Hero Receipts carousel)
1. **Wooden Spoon Merchant** - Most last-place finishes across league history
2. **Missed It By That Much** - Highest totalPF who didn't make playoffs
3. **Biggest Blowout** - Largest single-game margin of defeat
4. **Stole One** - Lowest points scored in a win (moved from MINI to HERO)
5. **Biggest Fall Off** - Biggest season-to-season rank drop
6. **All Gas, No Playoffs** - Highest totalPF in a season who missed playoffs

### MINI Cards (3 additional, in League Lore grid)
1. **Heartbreaker** - Most losses by <5 points
2. **Blowout Artist** - Most wins by 30+ points
3. **Giant Slayer** - Most wins vs #1 seed

**Note:** Bench Criminal and Serial Choker were skipped as they require additional data (bench points, playoff-specific matchup data) not available in the current payload.

## Backend Fields Added

### New Types in `client/src/pages/LeagueHistory/types.ts`:
- `SeasonStat`: `{ season, managerKey, rank, wins, losses, totalPF, playoffQualified, playoffTeams, playoffQualifiedInferred? }`
- `WeeklyMatchupDetail`: `{ season, week, managerKey, opponentKey, points, opponentPoints, margin, won }`
- `HeroReceiptCard`: Compatible with BaseballCard component

### Extended `DominanceApiResponse`:
- `seasonStats?: SeasonStat[]` - Per-season stats for each manager
- `weeklyMatchups?: WeeklyMatchupDetail[]` - Detailed matchup data with margins and win/loss flags

### Backend Changes in `server/league-history/index.ts`:
- Computes `seasonStats` by iterating through each season in the chain
- Fetches league settings to get `playoff_teams` for each season
- Computes `totalPF` per manager per season from weekly matchups
- Computes `weeklyMatchups` by pairing matchups by `matchup_id` to get opponent details
- Returns both arrays in the API response

### Updated `server/league-history/sleeper.ts`:
- Extended `SleeperLeague.settings` to include `playoff_teams?: number`
- Extended `SleeperRoster` to include `settings?: { wins?, losses?, ties?, rank? }`

## Playoff Qualification Logic

### Source:
- **Primary:** `league.settings.playoff_teams` from Sleeper API (per season)
- **Fallback:** If `playoff_teams` is missing/undefined, uses heuristic

### Computation:
```typescript
if (playoffTeams !== undefined) {
  playoffQualified = rank <= playoffTeams;
} else {
  // Heuristic: top 50% or top 6, whichever is smaller
  const leagueSize = rosters.length;
  const top50Percent = Math.ceil(leagueSize / 2);
  const top6 = 6;
  playoffQualified = rank <= Math.min(top50Percent, top6);
  playoffQualifiedInferred = true; // Flag to indicate heuristic was used
}
```

### Fields in SeasonStat:
- `playoffTeams`: Number of playoff teams for that season (0 if not available)
- `playoffQualified`: Boolean indicating if manager qualified
- `playoffQualifiedInferred?`: Optional flag set to `true` when heuristic is used

## Files Created/Modified

### New Files:
- `client/src/pages/LeagueHistory/heroReceipts.ts` - HERO card computation functions
- `client/src/pages/LeagueHistory/HeroReceipts.tsx` - HERO cards carousel component

### Modified Files:
- `server/league-history/index.ts` - Added seasonStats and weeklyMatchups computation
- `server/league-history/sleeper.ts` - Extended types for playoff_teams and roster settings
- `client/src/pages/LeagueHistory/types.ts` - Added SeasonStat, WeeklyMatchupDetail, HeroReceiptCard types
- `client/src/pages/LeagueHistory/index.tsx` - Integrated HeroReceipts section and additional mini cards
- `client/src/pages/LeagueHistory/storylines.ts` - Added computeAdditionalMiniCards function

## Implementation Notes

- **Tie-breaking:** Uses deterministic tie-breakers: more extreme stat first, then more recent season, then stable managerKey sort
- **Edge cases:** Single-season leagues gracefully skip multi-season cards (Wooden Spoon, Biggest Fall Off)
- **Premium gating:** HeroReceipts component supports premium gating with blur overlay (same pattern as InsightsDashboard)
- **UI placement:** HeroReceipts section appears after InsightsDashboard, before Dominance Grid
- **MINI cards:** Additional mini cards are merged into existing StorylinesMiniCards grid
