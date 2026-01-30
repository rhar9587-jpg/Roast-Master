# Fantasy Roast

Fantasy football roast generator for Sleeper leagues.

## Quick Start

```bash
# Install dependencies
npm install

# Start dev server
npm run dev
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

See `.env.example` for all available options.

---

## Analytics & Admin

### Setup

1. **Set ADMIN_KEY** - Generate a secure token:
   ```bash
   openssl rand -hex 32
   ```
   Add to `.env`:
   ```
   ADMIN_KEY=your_generated_token_here
   ```

2. **(Optional) Enable persistent storage** - Set `DATABASE_URL` to a PostgreSQL connection string:
   ```
   DATABASE_URL=postgres://user:pass@host:5432/dbname
   ```
   Without this, analytics use in-memory storage (lost on server restart).

### Endpoints

#### `GET /api/stats?key=ADMIN_KEY`

Basic stats and recent events.

```bash
curl "https://your-app.com/api/stats?key=YOUR_ADMIN_KEY"
```

Response:
```json
{
  "uptime": "2h 30m",
  "totals": { "home_visit": 150, "unlock_clicked": 12 },
  "recentEvents": [...],
  "storageType": "postgresql"
}
```

#### `GET /api/admin/analytics/summary?key=ADMIN_KEY`

Funnel analytics and conversion metrics.

```bash
curl "https://your-app.com/api/admin/analytics/summary?key=YOUR_ADMIN_KEY"
```

Response:
```json
{
  "generated_at": "2026-01-26T12:00:00.000Z",
  "events_24h": 45,
  "events_7d": 320,
  "unique_leagues_24h": 8,
  "unique_leagues_7d": 42,
  "unique_leagues_all": 156,
  "funnel": {
    "unlock_clicked": 50,
    "checkout_session_created": 15,
    "purchase_completed_webhook": 8,
    "purchase_success": 7,
    "purchase_cancel": 5
  },
  "funnel_7d": {
    "unlock_clicked": 12,
    "checkout_session_created": 4,
    "purchase_completed_webhook": 2,
    "purchase_success": 2,
    "purchase_cancel": 1
  },
  "top_events_24h": [
    { "type": "home_visit", "count": 25 },
    { "type": "league_history_loaded", "count": 18 }
  ],
  "conversion_rates": {
    "unlock_to_checkout": "30.0%",
    "checkout_completion_rate": "53.3%",
    "overall": "16.0%",
    "checkout_to_client_success": "46.7%"
  },
  "storage_type": "postgresql"
}
```

### Tracked Events

| Event | Description | Payload |
|-------|-------------|---------|
| `home_visit` | User visits home page | - |
| `username_submitted` | User enters Sleeper username | `username` |
| `leagues_returned` | Leagues fetched for user | `count`, `username` |
| `league_selected` | User selects a league | `league_id`, `league_name` |
| `league_history_loaded` | League history page loads | `league_id` |
| `unlock_clicked` | User clicks unlock/upgrade | `league_id`, `source` |
| `checkout_session_created` | Stripe checkout initiated | `league_id`, `session_id` |
| `purchase_completed_webhook` | **Server-confirmed payment** (Stripe webhook) | `league_id`, `session_id`, `amount_cents` |
| `purchase_success` | Client-side success (user returned) | `league_id` |
| `purchase_cancel` | Payment canceled | `league_id` |
| `share_clicked` | User shares a card | `card_type`, `card_name` |

### Stripe Webhook Setup

For reliable purchase tracking, set up the Stripe webhook:

1. Go to [Stripe Dashboard](https://dashboard.stripe.com) → Developers → Webhooks
2. Click "Add endpoint"
3. Enter your webhook URL: `https://your-domain.com/api/stripe/webhook`
4. Select events: `checkout.session.completed`
5. Click "Add endpoint"
6. Copy the **Signing secret** (starts with `whsec_`)
7. Add to your environment: `STRIPE_WEBHOOK_SECRET=whsec_...`

**Why use webhooks?**
- Client-side `purchase_success` relies on user returning to your site
- If user closes tab after paying, client event is lost
- Webhook is called directly by Stripe → 100% reliable

### Privacy

- **IP addresses are hashed** - Raw IPs are never stored
- **User agents are truncated** - Limited to 256 chars
- **No PII** - Only league IDs and event types are tracked

### Viewing Logs

Server logs are output to stdout. In production:

```bash
# View live logs (Railway, Render, etc.)
railway logs
render logs

# Or check your hosting provider's log viewer

# Local development
npm run dev  # Logs appear in terminal
```

Analytics events are logged as:
```
[Analytics] home_visit POST /api/track {}
[Analytics] unlock_clicked POST /api/track { league_id: "123..." }
```
