# Wave 4 Hybrid Freemium Gating Notes

## Free vs Premium Matrix

| Feature | Free | Premium |
|---------|------|---------|
| Full grid (view) | ✅ | ✅ |
| Grid exports | ❌ | ✅ |
| Your Roast mini cards | ✅ | ✅ |
| Your Roast export | ✅ | ✅ |
| Headlines (baseball cards) | ❌ | ✅ |
| League Storylines | ❌ | ✅ |
| Storylines export | ❌ | ✅ |
| Share links/images | ❌ | ✅ |

## Copy Guidelines

- Use "Unlock the receipts" (not "unlimited leagues" or "full grid")
- Emphasize "See the truth" (free) vs "Share the truth" (premium)
- Use "reveal" for headlines
- Use "export and share" for premium features
- Keep roast/receipts vibe consistent

## Testing Checklist

- [ ] Free user: full grid visible and clickable
- [ ] Free user: viewer row highlight works
- [ ] Free user: grid exports disabled with tooltip
- [ ] Free user: headlines blurred with overlay
- [ ] Free user: League Storylines locked with overlay
- [ ] Free user: Your Roast visible and exportable
- [ ] Premium user: all sections unlocked
- [ ] Premium user: all exports enabled
- [ ] Premium user: sharing tools enabled
- [ ] Unlock modal opens from locked elements
- [ ] Unlock modal sets premium state correctly
- [ ] Dev toggle works
- [ ] PostAnalysisToast shows correct copy based on premium

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
