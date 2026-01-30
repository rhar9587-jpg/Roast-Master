const UNLOCKED_LEAGUES_KEY = "fantasy-roast-unlockedLeagues";

export function getUnlockedLeagues(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(UNLOCKED_LEAGUES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function isLeagueUnlocked(leagueId: string): boolean {
  if (typeof window === "undefined") return false;
  const trimmed = leagueId.trim();
  if (!trimmed) return false;
  return getUnlockedLeagues().includes(trimmed);
}

export function unlockLeague(leagueId: string): void {
  if (typeof window === "undefined") return;
  const trimmed = leagueId.trim();
  if (!trimmed) return;
  const existing = getUnlockedLeagues();
  if (existing.includes(trimmed)) return;
  const next = [...existing, trimmed];
  localStorage.setItem(UNLOCKED_LEAGUES_KEY, JSON.stringify(next));
}

export function lockLeague(leagueId: string): void {
  if (typeof window === "undefined") return;
  const trimmed = leagueId.trim();
  if (!trimmed) return;
  const existing = getUnlockedLeagues();
  const next = existing.filter((id) => id !== trimmed);
  localStorage.setItem(UNLOCKED_LEAGUES_KEY, JSON.stringify(next));
}
