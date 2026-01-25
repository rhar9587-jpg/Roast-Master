import { RoastDeckCarousel } from "@/components/roast/RoastDeckCarousel";
import { BaseballCard } from "@/components/roast/BaseballCard";
import { fmtScore } from "./utils";
import type { LandlordSummary } from "./types";

type MostOwned = {
  victimName: string;
  victimKey: string;
  timesOwned: number;
  totalGames: number;
  worstNemesisName: string;
  worstNemesisRecord: string;
  worstNemesisCellKey: string | null;
  cellKey: string | null;
  ownedBy: Array<{ cellKey: string }>;
};

type BiggestRivalry = {
  aKey: string;
  bKey: string;
  aName: string;
  bName: string;
  record: string;
  games: number;
  score: number;
  badge: string;
  cellKey: string;
};

type Props = {
  landlord: LandlordSummary | null;
  mostOwned: MostOwned | null;
  biggestRivalry: BiggestRivalry | null;
  avatarByKey: Record<string, string | null>;
  onOpenCell: (cellKey: string | null) => void;
};

export function InsightsDashboard({
  landlord,
  mostOwned,
  biggestRivalry,
  avatarByKey,
  onOpenCell,
}: Props) {
  return (
    <RoastDeckCarousel>
      <BaseballCard
        badge="OWNED"
        title="THE LANDLORD 👑"
        name={landlord?.landlordName ?? "—"}
        avatarUrl={
          landlord ? (avatarByKey[landlord.landlordKey] ?? null) : null
        }
        primaryStat={{
          value: landlord ? String(landlord.totalOwnedGames) : "—",
          label: "OWNED GAMES",
        }}
        punchline={
          landlord
            ? `Owns ${landlord.victimCount} managers. Rent is due.`
            : "No landlord yet"
        }
        lines={[
          { label: "Tenants", value: landlord ? String(landlord.victimCount) : "—" },
          {
            label: "Favorite Tenant",
            value: landlord?.bestVictim
              ? `${landlord.bestVictim.victimName} (${landlord.bestVictim.record})`
              : "—",
          },
        ]}
        season="2024–25"
        onClick={() =>
          onOpenCell(landlord?.bestVictim?.cellKey ?? null)
        }
      />

      <BaseballCard
        badge="NEMESIS"
        title="BIGGEST VICTIM 😭"
        name={mostOwned?.victimName ?? "—"}
        avatarUrl={
          mostOwned ? (avatarByKey[mostOwned.victimKey] ?? null) : null
        }
        primaryStat={{
          value: mostOwned ? String(mostOwned.timesOwned) : "—",
          label: "TIMES OWNED",
        }}
        punchline={
          mostOwned
            ? `Owned by ${mostOwned.timesOwned} managers. It's rough.`
            : "No victims yet"
        }
        lines={[
          { label: "Kryptonite", value: mostOwned?.worstNemesisName ?? "—" },
          { label: "Games", value: mostOwned ? String(mostOwned.totalGames) : "—" },
        ]}
        season="2024–25"
        onClick={() => onOpenCell(mostOwned?.cellKey ?? null)}
      />

      <BaseballCard
        badge="RIVAL"
        title="BIGGEST RIVALRY ⚔️"
        name={
          biggestRivalry
            ? `${biggestRivalry.aName} vs ${biggestRivalry.bName}`
            : "—"
        }
        avatarUrl={
          biggestRivalry
            ? (avatarByKey[biggestRivalry.aKey] ?? null)
            : null
        }
        primaryStat={{
          value: biggestRivalry?.record ?? "—",
          label: "RECORD",
        }}
        punchline={
          biggestRivalry
            ? "These two hate each other."
            : "No rivalry yet"
        }
        lines={[
          {
            label: "Games",
            value: biggestRivalry ? String(biggestRivalry.games) : "—",
          },
          {
            label: "Score",
            value: biggestRivalry ? fmtScore(biggestRivalry.score) : "—",
          },
        ]}
        season="2024–25"
        onClick={() =>
          onOpenCell(biggestRivalry?.cellKey ?? null)
        }
      />
    </RoastDeckCarousel>
  );
}
