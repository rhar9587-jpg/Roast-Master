// shared/schema.ts
import { z } from "zod";

// -------------------
// Request
// -------------------
export const roastRequestSchema = z.object({
  league_id: z.string().min(1),
  week: z.number().int().positive(),
  roster_id: z.number().int().positive().optional(),
});

export type RoastRequest = z.infer<typeof roastRequestSchema>;

// -------------------
// Shared types
// -------------------
export const cardSchema = z.object({
  type: z.string(),
  title: z.string(),
  subtitle: z.string().optional(),
  tagline: z.string().optional(),
  stat: z.string().optional(),
  // optional extra metadata if you want later
  meta: z.record(z.any()).optional(),
});

export type Card = z.infer<typeof cardSchema>;

// -------------------
// Roast response (weekly league roast)
// -------------------
export const roastResponseSchema = z.object({
  league: z.object({
    league_id: z.string(),
    name: z.string(),
    season: z.string().optional(),
  }),
  week: z.number(),
  headline: z.string(),
  stats: z.object({
    averageScore: z.number(),
    highestScorer: z.object({
      roster_id: z.number(),
      username: z.string(),
      score: z.number(),
    }),
    lowestScorer: z.object({
      roster_id: z.number(),
      username: z.string(),
      score: z.number(),
    }),
  }),

  // new: league-wide cards for the week
  cards: z.array(cardSchema).default([]),

  // optional matchup roast if roster_id provided
  matchup: z
    .object({
      roster_id: z.number(),
      opponent_roster_id: z.number(),
      you: z.object({ username: z.string(), score: z.number() }),
      opponent: z.object({ username: z.string(), score: z.number() }),
      result: z.enum(["WIN", "LOSS", "TIE"]),
      cards: z.array(cardSchema).optional(), // for later “roast my matchup”
    })
    .optional(),
});

export type RoastResponse = z.infer<typeof roastResponseSchema>;

// -------------------
// Season Wrapped response
// -------------------
export const wrappedResponseSchema = z.object({
  league_id: z.string(),
  roster_id: z.number(),
  league: z
    .object({
      league_id: z.string(),
      name: z.string(),
      season: z.string().optional(),
    })
    .optional(),
  wrapped: z.object({
    season: z.object({
      record: z.string(),
      rank: z.number().optional(),
      points_for: z.number(),
      points_against: z.number(),
    }),
    cards: z.array(cardSchema),
  }),
  mode: z.enum(["LIVE", "DEMO"]).optional(),
  fallback_reason: z.string().nullable().optional(),
});

export type WrappedResponse = z.infer<typeof wrappedResponseSchema>;

// -------------------
// League Autopsy request/response (Season-wide league stats)
// -------------------
export const leagueAutopsyRequestSchema = z.object({
  league_id: z.string().min(1),
  season: z.string().optional(),
});

export type LeagueAutopsyRequest = z.infer<typeof leagueAutopsyRequestSchema>;

export const leagueAutopsyResponseSchema = z.object({
  league_id: z.string(),
  league: z.object({
    league_id: z.string(),
    name: z.string(),
    season: z.string().optional(),
  }),
  cards: z.array(cardSchema),
  mode: z.enum(["LIVE", "DEMO"]).optional(),
});

export type LeagueAutopsyResponse = z.infer<typeof leagueAutopsyResponseSchema>;

// -------------------
// FPL (Fantasy Premier League) types
// -------------------
export const fplCardSchema = z.object({
  id: z.string(),
  title: z.string(),
  subtitle: z.string().optional(),
  tagline: z.string().optional(),
  bigValue: z.string().optional(),
  footer: z.string().optional(),
  accent: z.enum(["green", "pink", "blue", "orange", "slate"]).optional(),
  meta: z.record(z.any()).optional(),
});

export type FplCard = z.infer<typeof fplCardSchema>;

export const fplRoastRequestSchema = z.object({
  entryId: z.number().int().positive(),
  eventId: z.number().int().min(1).max(38),
});

export type FplRoastRequest = z.infer<typeof fplRoastRequestSchema>;

export const fplRoastResponseSchema = z.object({
  entry: z.object({
    id: z.number(),
    name: z.string(),
    player_first_name: z.string().optional(),
    player_last_name: z.string().optional(),
  }),
  eventId: z.number(),
  cards: z.array(fplCardSchema),
});

export type FplRoastResponse = z.infer<typeof fplRoastResponseSchema>;
