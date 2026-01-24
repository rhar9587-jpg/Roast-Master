export type Badge =
  | "OWNED"
  | "NEMESIS"
  | "RIVAL"
  | "EDGE"
  | "SMALL SAMPLE";

export type DominanceCellDTO = {
  a: string;
  b: string;
  aName: string;
  bName: string;
  games: number;
  score: number;
  badge: Badge;
  record: string;
  pf: number;
  pa: number;
};

export type DominanceApiResponse = {
  league: { league_id: string; name: string; season: string };
  grid: Array<{
    key: string;
    name: string;
    opponents: Array<{
      opponent_key: string;
      opponent_name: string;
      record: {
        wins: number;
        losses: number;
        ties: number;
        pointsFor: number;
        pointsAgainst: number;
        games: number;
        score: number;
        badge: Badge;
      };
      display?: { record: string; score: string };
    }>;
    totalWins: number;
    totalLosses: number;
    totalTies: number;
  }>;
  totalsByManager?: Array<{
    key: string;
    name: string;
    avatarUrl?: string | null;
    totalWins: number;
    totalLosses: number;
    totalTies: number;
    totalGames: number;
    totalPF: number;
    totalPA: number;
    totalScore: number;
  }>;
  cells?: DominanceCellDTO[];
};

export type VictimRow = {
  cellKey: string;
  victimKey: string;
  victimName: string;
  record: string;
  games: number;
  score: number;
};

export type LandlordSummary = {
  landlordKey: string;
  landlordName: string;
  victimCount: number;
  victims: VictimRow[];
  totalOwnedGames: number;
  bestVictim?: VictimRow | null;
};

export type ManagerRow = { key: string; name: string };

export type RowTotal = { w: number; l: number; t: number; games: number; score: number };
export type GrandTotal = { w: number; l: number; t: number; games: number; score: number };
