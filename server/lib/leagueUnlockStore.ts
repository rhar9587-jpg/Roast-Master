import { promises as fs } from "fs";
import path from "path";

type UnlockStore = {
  unlockedLeagueIds: string[];
};

const STORE_PATH = path.resolve(process.cwd(), ".data", "league-unlocks.json");
let cache: Set<string> | null = null;

async function ensureLoaded(): Promise<Set<string>> {
  if (cache) return cache;
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as UnlockStore;
    cache = new Set((parsed.unlockedLeagueIds || []).filter(Boolean));
    return cache;
  } catch {
    cache = new Set<string>();
    return cache;
  }
}

async function persist(set: Set<string>): Promise<void> {
  const dir = path.dirname(STORE_PATH);
  await fs.mkdir(dir, { recursive: true });
  const payload: UnlockStore = { unlockedLeagueIds: Array.from(set.values()).sort() };
  await fs.writeFile(STORE_PATH, JSON.stringify(payload, null, 2), "utf8");
}

export async function isLeagueUnlocked(leagueId: string): Promise<boolean> {
  const id = leagueId.trim();
  if (!id) return false;
  const set = await ensureLoaded();
  return set.has(id);
}

export async function markLeagueUnlocked(leagueId: string): Promise<void> {
  const id = leagueId.trim();
  if (!id) return;
  const set = await ensureLoaded();
  if (set.has(id)) return;
  set.add(id);
  await persist(set);
}

export async function getAllUnlockedLeagues(): Promise<string[]> {
  const set = await ensureLoaded();
  return Array.from(set.values()).sort();
}
