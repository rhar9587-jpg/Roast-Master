const STORAGE_KEY = "fantasy-roast-premium";
const UNLOCKED_LEAGUES_KEY = "fantasy-roast-unlockedLeagues";

export function isPremium(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(STORAGE_KEY) === "true";
}

export function setPremium(value: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, value ? "true" : "false");
}

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

export function addUnlockedLeague(leagueId: string): void {
  if (typeof window === "undefined") return;
  const trimmed = leagueId.trim();
  if (!trimmed) return;
  const existing = getUnlockedLeagues();
  if (existing.includes(trimmed)) return;
  const next = [...existing, trimmed];
  localStorage.setItem(UNLOCKED_LEAGUES_KEY, JSON.stringify(next));
}
