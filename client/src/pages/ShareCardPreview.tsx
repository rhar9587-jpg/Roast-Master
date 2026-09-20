import { WrappedCard } from "@/components/WrappedCard";

/**
 * Dev/manual review page for share-card visuals.
 * Uses the real WrappedCard with Week 8 demo fixture values.
 */
export default function ShareCardPreviewPage() {
  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
            Share card preview
          </p>
          <h1 className="text-3xl font-black tracking-tight">Week 8 visual QA</h1>
          <p className="text-sm text-zinc-400">
            Polish pass — hierarchy, footer, Murder Scene, long names, mobile.
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
            title="COMMISSIONER CHAOS"
            subtitle="Won below the league median."
            bigValue="78.2"
            statLabel="WON LIGHT"
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
            title="FOURTHANDTWENTYDYNASTY"
            subtitle="Points left on the bench · Week 8"
            bigValue="84.2"
            statLabel="Points left on bench"
            tagline="Roster management was optional."
            accent="blue"
            isPremium
          />

          <WrappedCard
            kicker="TOP DOG"
            title="THE UNNECESSARILY LONG FANTASY TEAM NAME"
            subtitle="Highest score of Week 8"
            bigValue="167.4"
            statLabel="Points"
            tagline="Still readable."
            accent="green"
            isPremium
          />
        </div>
      </div>
    </div>
  );
}
