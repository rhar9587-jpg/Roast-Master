# Weekly Roast — implementation (shipped)

**Single engine:** `server/lib/weeklyRoastEngine.ts` → `buildWeeklyRoastNarrative()`.

**API:** `POST /api/roast` returns `RoastResponse` with:

- `headline` — week verdict  
- `stats` — `averageScore`, `highestScorer`, `lowestScorer`  
- `cards[]` — `top_dog`, `biggest_embarrassment`, `fraud_watch`, `worst_coaching`, `carry_job`, `group_chat_drop` (real Sleeper data)  
- `groupChatSummary` — paragraph for SMS/Discord + **aligned commissioner email intro** (`weeklyCommissioner.ts` concatenates headline + summary)  
- `signals` — optional debug metrics (median, closest game, blowout margin, etc.)

**Client:** League History → **Weekly** tab uses `RoastCard` with `variant="weekly"` (verdict + chips + group chat copy + stacked cards). **Week** picker is shared with **Weekly Commissioner Email** via `leagueWeek`. Anchor: `#weekly-commissioner-email`.

**Feature flag:** `WEEKLY_ENABLED` in `client/src/pages/LeagueHistory/index.tsx` (currently **on**).

For product QA, re-check: sendable card copy, multiple teams across cards, email intro vs tab headline theme, locked preview bullets vs shipped cards.
