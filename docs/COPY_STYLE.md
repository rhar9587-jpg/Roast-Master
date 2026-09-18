# Copy Style Checklist

Use this checklist for user-facing copy in pages, modals, banners, and CTA text.

**Source of truth for price/domain/CTAs:** `client/src/lib/brand.ts` — do not hardcode `$2.99` or `fantasyroast.*` in UI.

## Positioning
- Lead with **receipts / who owns who**, not “AI roast generator.”
- Weekly and season are **included** with unlock — not co-equal hero jobs on the homepage.

## Tone
- Write like a commissioner talking to league mates: direct, specific, and playful.
- Prefer plain sentences over slogan stacks.
- Keep confidence without sounding like ad copy.

## Avoid
- Parenthetical placeholders or internal notes in shipped copy (for example: `(highest retention)`).
- Formulaic framing like `one product, three outcomes`.
- Vague claims that are not shown in-product.
- Equal-weight “three jobs” framing that makes Weekly/Season compete with Receipts.

## Prefer
- Concrete league language (`group chat`, `receipts`, `who owns who`, `matchups`, `season recap`).
- One clear idea per sentence.
- Consistent offer language across upgrade surfaces (from `brand.ts` / `OFFER`):
  - `Unlock the receipts`
  - `Unlock once`
  - `No subscription`
  - `30-day money-back guarantee`

## Quick QA Before Merge
- Read each changed line out loud once.
- Check that similar CTA areas use matching wording from `unlockCtaLabel()`.
- Confirm copy still fits on mobile without awkward wrapping.
- Confirm card footers / watermarks use `SITE_HOST` (`fantasyroast.net`), not `.app`.
