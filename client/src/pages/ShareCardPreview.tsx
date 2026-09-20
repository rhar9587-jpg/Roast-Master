import { WrappedCard } from "@/components/WrappedCard";

/**
 * Dev/manual review page for share-card visuals.
 * Uses the real WrappedCard with Week 8 demo fixture values.
 */
export default function ShareCardPreviewPage() {
  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-8 text-white">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
            Share card preview
          </p>
          <h1 className="text-3xl font-black tracking-tight">Week 8 visual QA</h1>
          <p className="text-sm text-zinc-400">
            Real WrappedCard renders — Top Dog, Murder Scene, Jail, Fraud, Matchup.
          </p>
        </header>

        <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
          <WrappedCard
            kicker="TOP DOG"
            title="THE LANDLORD"
            subtitle="Highest score of Week 8"
            bigValue="167.4"
            statLabel="Points"
            tagline="Unreal scenes."
            accent="green"
            isPremium
          />

          <WrappedCard
            kicker="WEEK 8"
            title="MURDER SCENE"
            isMatchup
            matchupData={{
              teamA: "The Landlord",
              scoreA: 167.4,
              teamB: "Rebuild Forever",
              scoreB: 62.1,
              margin: 105.3,
            }}
            bigValue="+105.3"
            tagline="Not competitive."
            accent="pink"
            isPremium
          />

          <WrappedCard
            kicker="STRAIGHT TO JAIL"
            title="REBUILD FOREVER"
            subtitle="Lowest score of Week 8"
            bigValue="62.1"
            statLabel="Points"
            tagline="Rough night."
            accent="pink"
            isPremium
          />

          <WrappedCard
            kicker="FRAUD WATCH"
            title="WON LIGHT"
            subtitle="Won at 78.2; league median was 112.4."
            tagline="Receipts attached."
            accent="orange"
            isPremium
          />

          <WrappedCard
            kicker="YOUR MATCHUP"
            title="HANDLED BUSINESS"
            isMatchup
            matchupData={{
              teamA: "The Landlord",
              scoreA: 167.4,
              teamB: "Rebuild Forever",
              scoreB: 62.1,
              margin: 105.3,
            }}
            bigValue="+105.3"
            tagline="Receipts attached."
            accent="green"
            isPremium
          />

          <WrappedCard
            kicker="BENCH CRIMES"
            title="MOST POINTS LEFT ON BENCH"
            subtitle="Left 34.2 pts on the bench in Week 8."
            bigValue="34.2 bench pts"
            statLabel="Bench"
            tagline="Start your studs."
            accent="blue"
            isPremium
          />
        </div>
      </div>
    </div>
  );
}
