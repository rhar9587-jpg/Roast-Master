# Fantasy Roast App

## Overview

A fantasy football "roast" application that generates humorous weekly roasts and season-wrapped summaries for Sleeper fantasy football leagues. Users enter their Sleeper username to find their leagues, select a league and week, and receive AI-generated roast content displayed as shareable "Wrapped-style" cards.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state, local React state for UI
- **Styling**: Tailwind CSS with shadcn/ui component library (New York style)
- **Animations**: Framer Motion for card transitions and interactions
- **Build Tool**: Vite with custom plugins for Replit integration

The frontend follows a component-based architecture with:
- Pages in `client/src/pages/`
- Reusable UI components in `client/src/components/ui/` (shadcn)
- Feature components in `client/src/components/`
- Custom hooks in `client/src/hooks/`

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Runtime**: Node.js with tsx for TypeScript execution
- **API Design**: RESTful endpoints under `/api/`
- **External API**: Sleeper API integration for fantasy football data

Key endpoints:
- `GET /api/sleeper/leagues/:username/:season` - Fetches user's leagues from Sleeper
- `POST /api/roast` - Generates weekly roast content (league_id, week, optional roster_id)
- `POST /api/wrapped` - Generates personal season wrapped cards (league_id, roster_id)
- `POST /api/league-autopsy` - Generates league-wide season statistics (league_id only)

### Data Flow
1. User enters Sleeper username → Backend fetches user_id from Sleeper API
2. Backend fetches leagues for that user → Frontend displays league selector
3. User selects league and week → Backend fetches matchup/roster data from Sleeper
4. Backend generates roast content → Frontend displays as "Wrapped" cards

### Season Wrapped Feature
Two packs available under "Season Wrapped" section:
- **League Autopsy**: League-wide season statistics (no roster required). Contains 5 cards:
  - THE BODY (Last Place) - "Someone had to finish here."
  - PEAK DELUSION (Highest Score of Season) - "This broke the league."
  - CRIME SCENE (Lowest Score of Season) - "Authorities were notified."
  - MERCY RULE (Biggest Blowout) - "This game was over at kickoff."
  - FANTASY INJUSTICE (Highest Score in a Loss) - "Did everything right. Still lost."
- **My Season**: Individual team season recap (requires roster selection). Contains cards for MVP, best win, worst loss.

### Data Storage
- **Analytics**: PostgreSQL-backed analytics tracking (with in-memory fallback)
  - Tables: `analytics_counters`, `analytics_events`, `analytics_metadata`
  - Tracks roast counts by type and last 500 events with metadata
  - Survives server restarts
- **Database Config**: Drizzle ORM configured with PostgreSQL (schema in `shared/schema.ts`)
- **Session**: connect-pg-simple available for session storage if needed

The app fetches all roast data from Sleeper/FPL APIs on demand. Analytics are persisted to PostgreSQL via `server/analytics-db.ts`.

### Build System
- Development: `tsx server/index.ts` with Vite dev server middleware
- Production: Custom esbuild script bundles server, Vite builds client to `dist/public`
- Static serving handled by Express in production mode

## External Dependencies

### Sleeper API (Primary Data Source)
- `GET https://api.sleeper.app/v1/user/{username}` - Get user_id from username
- `GET https://api.sleeper.app/v1/user/{user_id}/leagues/nfl/{season}` - Get user's leagues
- League/roster/matchup endpoints for roast data generation
- No authentication required, public API with rate limits

### AI/Content Generation
- Google Generative AI (`@google/generative-ai`) - Available for roast text generation
- OpenAI SDK - Also available as alternative

### Image Export
- `html-to-image` - Converts Wrapped cards to PNG for sharing/download

### Environment Variables
- `DATABASE_URL` - PostgreSQL connection string (required by Drizzle config)
- `DEMO_LEAGUE_ID` - Optional demo league for offseason testing
- `DEMO_WEEK` - Optional demo week number
- `VITE_API_BASE` - Optional API host override for frontend
- `ADMIN_KEY` - Secret key for accessing `/api/stats` analytics endpoint