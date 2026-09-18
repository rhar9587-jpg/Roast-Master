# Wave 4 Hybrid Freemium Gating Notes

## Free vs Premium Matrix

| Feature | Free | Premium |
|---------|------|---------|
| Full grid (view) | ✅ | ✅ |
| Grid exports | ❌ | ✅ |
| Your Roast mini cards | ✅ | ✅ |
| Your Roast export | ✅ | ✅ |
| Headlines (baseball cards beyond landlord + personal hook) | ❌ | ✅ |
| League Storylines | ❌ | ✅ |
| Storylines export | ❌ | ✅ |
| Share links/images (premium cards) | ❌ | ✅ |

## Copy Guidelines

- Use "Unlock the receipts" via `@/lib/brand` `unlockCtaLabel()` (not "unlimited leagues" or "full grid")
- Emphasize "See the truth" (free) vs "Share the truth" (premium)
- Use "reveal" for headlines
- Use "export and share" for premium features
- Keep roast/receipts vibe consistent
- Weekly / Season / Recap tabs are secondary ("Included") — Receipts is primary

## Testing Checklist

- [x] Free user: full grid visible and clickable
- [x] Free user: viewer row highlight works
- [x] Free user: grid exports disabled with tooltip (opens unlock)
- [x] Free user: headlines blurred with overlay (HeroReceipts + Insights mostOwned/rivalry)
- [x] Free user: League Storylines locked with overlay
- [x] Free user: Your Roast visible and exportable
- [ ] Premium user: all sections unlocked *(manual QA)*
- [ ] Premium user: all exports enabled *(manual QA)*
- [ ] Premium user: sharing tools enabled *(manual QA)*
- [x] Unlock modal opens from locked elements
- [x] Unlock modal sets premium state correctly (Stripe + localStorage)
- [x] Dev toggle works
- [x] PostAnalysisToast shows correct copy based on premium

## Phase 1 notes (Sep 2026)

- Removed free-tier grid row truncation (`FREE_ROW_COUNT`) — WAVE4 matrix requires full grid view free.
- Your Roast no longer blurred for free users; league storylines remain gated.
- Auto viewer suggest (`suggestViewerKey`) + scroll to `#personal-aha` / personal receipts on load.
- Mode chrome: Receipts primary; Weekly/Season/Recap labeled "Included".

## Technical Notes

**Premium State:**
- localStorage key: "fantasy-roast-unlockedLeagues" (array of league IDs)
- Premium is tracked **per league** via `isLeagueUnlocked(leagueId)`
- State recomputes when league ID changes via `useEffect(() => { setIsPremiumState(isLeagueUnlocked(leagueId.trim())); }, [leagueId])`
- Stripe checkout unlocks only the specific league purchased
- Dev toggle locks/unlocks current league only (for easy testing)

**Locked Overlays:**
- Consistent pattern: semi-transparent background + blur + lock icon + CTA
- Overlay covers entire section (not individual cards)
- Click anywhere on overlay → unlock modal

**Export Gating:**
- Disabled buttons show tooltip
- Clicking disabled button opens unlock modal
- Your Roast export always enabled (free feature)

**TypeScript:**
- All props properly typed
- No `any` types
- Passes `npx tsc --noEmit`

**Mobile:**
- Overlays responsive
- Modal responsive
- Grid remains usable on small screens
