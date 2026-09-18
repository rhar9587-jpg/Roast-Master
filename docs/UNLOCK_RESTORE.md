# Unlock restore (Phase 2)

Purchases still unlock the current browser via `localStorage`, but the Stripe webhook also stores an entitlement keyed by **league + checkout email** (and Stripe session / customer id when present).

## Flow

1. Checkout → Stripe collects email → `checkout.session.completed` webhook calls `recordUnlockEntitlement`.
2. Success return → client unlocks locally and opens **Save your unlock** (optional email confirm / restore lookup).
3. Later / new device → **Restore purchase** → `POST /api/unlock/restore` with `{ email, league_id? }` → rehydrates `fantasy-roast-unlockedLeagues`.

## API

| Endpoint | Purpose |
|----------|---------|
| `POST /api/unlock/save-email` | Bind checkout email to a league after purchase |
| `POST /api/unlock/restore` | Look up unlocks by purchase email |
| `POST /api/stripe/portal` | Stripe Customer Portal (needs stored `stripe_customer_id`) |

## Storage

- Postgres (when `DATABASE_URL` set): `unlock_entitlements` + existing `league_unlocks`
- File fallback: `.data/league-unlocks.json` → `entitlements[]`

## Notes

- No full accounts / Passport.
- Enable Customer Portal in the Stripe Dashboard for `/api/stripe/portal`.
- Rate-limited restore attempts per IP.
