// server/league-history/sleeper.ts
const SLEEPER_BASE = "https://api.sleeper.app/v1";

export async function fetchJson<T>(url: string, timeoutMs = 15000): Promise<T> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Sleeper API ${res.status}: ${text || url}`);
    }
    return (await res.json()) as T;
  } catch (e: any) {
    if (e?.name === "AbortError") throw new Error(`Sleeper API timeout after ${timeoutMs}ms: ${url}`);
    throw e;
  } finally {
    clearTimeout(t);
  }
}

// server/league-history/sleeper.ts
export type SleeperLeague = {
  league_id: string;
  name: string;
  season?: string;
  previous_league_id?: string | null; // ✅ add this
  settings?: { playoff_week_end?: number; playoff_teams?: number };
};

export type SleeperRoster = {
  roster_id: number;
  owner_id: string | null;
  settings?: {
    wins?: number;
    losses?: number;
    ties?: number;
    rank?: number;
  };
};

export type SleeperUser = {
  user_id: string;
  username: string;
  display_name?: string;
  avatar?: string | null; // ✅ add this
};

export type SleeperMatchup = {
  matchup_id: number;
  roster_id: number;
  points: number;
};

export async function getLeague(league_id: string) {
  return fetchJson<SleeperLeague>(`${SLEEPER_BASE}/league/${league_id}`);
}

export async function getUsers(league_id: string) {
  return fetchJson<SleeperUser[]>(`${SLEEPER_BASE}/league/${league_id}/users`);
}

export async function getRosters(league_id: string) {
  return fetchJson<SleeperRoster[]>(`${SLEEPER_BASE}/league/${league_id}/rosters`);
}

export async function getMatchups(league_id: string, week: number) {
  return fetchJson<SleeperMatchup[]>(`${SLEEPER_BASE}/league/${league_id}/matchups/${week}`);
}
