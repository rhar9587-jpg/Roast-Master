# Weekly Roast — implementation (shipped)

**Single engine:** `server/lib/weeklyRoastEngine.ts` → `buildWeeklyRoastNarrative()`.

**API:** `POST /api/roast` returns `RoastResponse` with:

- `headline` — week verdict  
- `stats` — `averageScore`, `highestScorer`, `lowestScorer`  
- `cards[]` — `top_dog`, `biggest_embarrassment`, `fraud_watch`, `worst_coaching`, `carry_job`, `group_chat_drop` (real Sleeper data)  
- `groupChatSummary` — paragraph for SMS/Discord + **aligned commissioner email intro** (`weeklyCommissioner.ts` concatenates headline + summary)  
- `signals` — optional debug metrics (median, closest game, blowout margin, etc.)

**Client:** League History → **Weekly** tab uses `RoastCard` with `variant="weekly"` (verdict + optional median chip + collapsible “more from this week” from `signals` + group chat copy + copy week one-liner + league cards carousel + optional matchup line copy). After a roast is generated, **`WeeklyEmailBridgeStrip`** links the same week to commissioner email (recap vs preview, bullets, anchor `#weekly-commissioner-email`). **Week** picker is shared with **Weekly Commissioner Email** via `leagueWeek` (section order: roast → bridge → week/generate → email). The commissioner email panel (`WeeklyCommissionerEmailSection`, `id="weekly-commissioner-email"`) only renders on the **Weekly** tab. **History** tab has no commissioner email UI.

**Feature flag:** `WEEKLY_ENABLED` in `client/src/pages/LeagueHistory/index.tsx` (currently **on**).

For product QA, re-check: sendable card copy, multiple teams across cards, email intro vs tab headline theme, locked preview bullets vs shipped cards.
