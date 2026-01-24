import { WrappedSlide } from "./WrappedSlide";
import type { RoastResponse } from "@shared/schema";

const pct = (n: number) => `${Math.round(n * 100)}%`;

export function SlideCover({ leagueName, week }: { leagueName: string; week: number }) {
  return (
    <WrappedSlide
      kicker="Roast Wrapped"
      title="ROAST YOUR LEAGUE"
      subtitle={`${leagueName} • Week ${week}`}
      accent="green"
    />
  );
}

export function SlideCarryJob({ data }: { data: RoastResponse }) {
  // If you don’t have this stat yet, fake it for now:
  const carryPct = 0.42;

  return (
    <WrappedSlide
      kicker="Biggest Carry Job"
      title="ONE GUY DID EVERYTHING"
      subtitle={`${pct(carryPct)} of total team points came from a single player.`}
      bigValue={pct(carryPct)}
      accent="pink"
    >
      <p className="text-white/75 text-base">
        {data.stats.highestScorer.username} didn’t draft a team — they drafted a single character arc.
      </p>
    </WrappedSlide>
  );
}

export function SlideBenchCrime({ data }: { data: RoastResponse }) {
  // Placeholder until you compute bench vs starters
  const benchGap = 28.6;

  return (
    <WrappedSlide
      kicker="Bench War Crime"
      title="JUSTICE FOR THE BENCH"
      subtitle={`You left ~${benchGap.toFixed(1)} points on the bench.`}
      bigValue={`+${benchGap.toFixed(1)}`}
      accent="blue"
    >
      <p className="text-white/75 text-base">
        Your bench is producing. Your decision making isn’t.
      </p>
    </WrappedSlide>
  );
}

export function SlideSackoForecast({ data }: { data: RoastResponse }) {
  const low = data.stats.lowestScorer.score;
  const avg = data.stats.averageScore;
  const ratio = avg === 0 ? 0 : Math.min(1, Math.max(0, low / avg));

  return (
    <WrappedSlide
      kicker="Sacko Forecast"
      title="THE SACKO IS CALLING"
      subtitle={`${data.stats.lowestScorer.username} is trending toward chaos.`}
      accent="orange"
    >
      <div className="space-y-4">
        <div className="text-white/80 text-sm">
          Low score vs league average: <span className="font-bold">{(ratio * 100).toFixed(0)}%</span>
        </div>

        <div className="h-3 w-full rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full bg-white/60"
            style={{ width: `${(ratio * 100).toFixed(0)}%` }}
          />
        </div>

        <p className="text-white/75 text-base">
          If you keep this up, the group chat will start sending welfare checks.
        </p>
      </div>
    </WrappedSlide>
  );
}