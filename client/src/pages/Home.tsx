import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FplRoastCard } from "@/components/FplRoastCard";
import type { FplRoastResponse } from "@shared/schema";
import { ChevronDown, ChevronRight, HelpCircle } from "lucide-react";
import { getRecentLeagues, setStoredUsername } from "./LeagueHistory/utils";
import { trackFunnel } from "@/lib/track";

type Sport = "nfl" | "fpl";
type LeagueOption = { league_id: string; name: string; season: string };
type View = "none" | "fpl";

export default function Home() {
  const [sport, setSport] = useState<Sport>("nfl");
  
  const [leagueId, setLeagueId] = useState("");
  const [season, setSeason] = useState("2025");
  const [username, setUsername] = useState("");

  const [leagues, setLeagues] = useState<LeagueOption[]>([]);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  const [fplData, setFplData] = useState<FplRoastResponse | null>(null);

  const [fplManagerId, setFplManagerId] = useState("");
  const [fplGameweek, setFplGameweek] = useState("");
  const [showFplHelp, setShowFplHelp] = useState(false);

  const [activeView, setActiveView] = useState<View>("none");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const EXAMPLE_LEAGUE_ID = "demo-group-chat-dynasty";

  // Track home visit once on mount
  const hasTrackedVisit = useRef(false);
  useEffect(() => {
    if (!hasTrackedVisit.current) {
      hasTrackedVisit.current = true;
      trackFunnel.homeVisit();
    }
  }, []);

  // Deep link from league page sticky CTA: /#get-started
  useEffect(() => {
    if (window.location.hash !== "#get-started") return;
    const id = window.setTimeout(() => {
      document.getElementById("get-started")?.scrollIntoView({ behavior: "smooth" });
    }, 150);
    return () => clearTimeout(id);
  }, []);

  // Fetch current FPL gameweek on mount
  useEffect(() => {
    fetch("/api/fpl/current-gameweek")
      .then(res => res.json())
      .then(data => {
        if (data.gameweek) {
          setFplGameweek(String(data.gameweek));
        }
      })
      .catch(() => {
        // Silently fail, user can enter manually
      });
  }, []);

  async function findLeagues() {
    if (!username) {
      setError("Please enter your Sleeper username.");
      return;
    }
    trackFunnel.usernameSubmitted(username);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sleeper/leagues/${username}/${season}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to fetch leagues");
      }
      const data = await res.json();
      setLeagues(data);
      trackFunnel.leaguesReturned(data.length, username);
      if (data.length === 0) {
        setError(`No leagues found for ${username} in ${season}.`);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleLeagueSelect(lId: string) {
    setLeagueId(lId);
    if (!lId) return;

    // Track league selection
    const selectedLeague = leagues.find(l => l.league_id === lId);
    trackFunnel.leagueSelected(lId, selectedLeague?.name || "Unknown");

    const params = new URLSearchParams({
      league_id: lId,
      start_week: String(1),
      end_week: String(17),
    });
    window.location.href = `/league-history/dominance?${params.toString()}`;
  }

  async function fetchFplRoast() {
    if (!fplManagerId) {
      setError("Please enter your Manager ID.");
      return;
    }

    const entryId = parseInt(fplManagerId, 10);
    if (isNaN(entryId) || entryId <= 0) {
      setError("Manager ID must be a valid number.");
      return;
    }

    setLoading(true);
    setError(null);
    setActiveView("fpl");

    try {
      const res = await fetch("/api/fpl/roast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryId,
          eventId: Math.max(1, Math.min(38, parseInt(fplGameweek, 10) || 1)),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch FPL roast.");
      setFplData(data);
    } catch (err: any) {
      setError(err.message);
      setFplData(null);
    } finally {
      setLoading(false);
    }
  }


  function handleViewLeagueHistory() {
    const recent = typeof window !== "undefined" ? getRecentLeagues() : [];
    const mostRecent = recent[0];
    if (mostRecent?.leagueId) {
      const params = new URLSearchParams({
        league_id: mostRecent.leagueId,
        start_week: String(mostRecent.startWeek ?? 1),
        end_week: String(mostRecent.endWeek ?? 17),
      });
      window.location.href = `/league-history/dominance?${params.toString()}`;
      return;
    }
    if (leagueId) {
      const params = new URLSearchParams({
        league_id: leagueId,
        start_week: String(1),
        end_week: String(17),
      });
      window.location.href = `/league-history/dominance?${params.toString()}`;
      return;
    }
    const exampleLeagueId = "demo-group-chat-dynasty";
    window.location.href = `/league-history/dominance?league_id=${exampleLeagueId}&start_week=1&end_week=17`;
  }

  function handleTryExampleLeague() {
    trackFunnel.exampleClicked();
    const params = new URLSearchParams({
      league_id: EXAMPLE_LEAGUE_ID,
      start_week: String(1),
      end_week: String(17),
    });
    window.location.href = `/league-history/dominance?${params.toString()}`;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 space-y-6 md:space-y-8">
      {/* NFL Only for Super Bowl Launch - FPL hidden */}
      {sport === "nfl" && (
        <>
          {/* Hero Section */}
          <section className="text-center py-6 md:py-8 space-y-4">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              Who owns your league?
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              See who owns who. Roast accordingly.
            </p>
            <p className="text-sm text-muted-foreground max-w-xl mx-auto">
              One product, three outcomes: <strong className="text-foreground font-semibold">league receipts</strong>,{" "}
              <strong className="text-foreground font-semibold">weekly roast</strong>, and{" "}
              <strong className="text-foreground font-semibold">season recap</strong> — one unlock.
            </p>
            <p className="text-base text-foreground/90 max-w-lg mx-auto font-medium leading-snug italic border-l-4 border-primary/40 pl-4 py-1 text-left">
              &ldquo;The Landlord owns half the league. Rent is due.&rdquo;
              <span className="block text-xs font-normal not-italic text-muted-foreground mt-1">
                Example roast — see the real grid and cards in 1 click.
              </span>
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-stretch sm:items-center">
              <Button size="lg" onClick={handleTryExampleLeague} className="font-semibold interact-cta">
                Try demo league — free
              </Button>
              <Button size="lg" variant="outline" onClick={() => document.getElementById("get-started")?.scrollIntoView({ behavior: "smooth" })} className="font-semibold interact-secondary">
                Use my Sleeper league
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              No login for demo • Unlock your league later for $2.99 (one-time)
            </p>
          </section>

          {/* Three jobs — IA core */}
          <section className="space-y-4" aria-labelledby="three-jobs-heading">
            <h2 id="three-jobs-heading" className="sr-only">
              What you get
            </h2>
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="border-2 border-muted/60 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-bold tracking-tight">League Receipts</CardTitle>
                  <p className="text-sm text-muted-foreground leading-snug">
                    Who actually runs your league — all-time dominance, grids, records, and archetypes.
                  </p>
                </CardHeader>
                <CardContent className="pt-0 text-xs text-muted-foreground">
                  Explore mode: receipts-first, built for arguments you can prove.
                </CardContent>
              </Card>
              <Card className="border-2 border-primary/25 shadow-sm ring-1 ring-primary/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-bold tracking-tight">Weekly Roast</CardTitle>
                  <p className="text-sm text-muted-foreground leading-snug">
                    What just happened this week — league narrative, roast cards, shareables, and commissioner email.
                  </p>
                </CardHeader>
                <CardContent className="pt-0 text-xs text-muted-foreground space-y-1">
                  <p>Roast / share mode: built for the group chat (highest retention).</p>
                  <p className="text-foreground/90 font-medium">
                    5–6 league cards every week + commissioner email (same narrative).
                  </p>
                </CardContent>
              </Card>
              <Card className="border-2 border-muted/60 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-bold tracking-tight">Season Recap</CardTitle>
                  <p className="text-sm text-muted-foreground leading-snug">
                    How your season really went — personal story, identity, and defining moments (plus the league finale).
                  </p>
                </CardHeader>
                <CardContent className="pt-0 text-xs text-muted-foreground">
                  Story mode: yours vs the league&apos;s last word.
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Example Cards */}
          <section className="pt-2 pb-6 space-y-4">
            <p className="text-center text-sm font-medium text-foreground">See it in action</p>
            <p className="text-center text-xs text-muted-foreground">
              Demo tiles tagged by outcome — same unlock covers all three.
            </p>

            <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory md:grid md:grid-cols-4 md:overflow-visible md:pb-0 -mx-4 px-4 md:mx-0 md:px-0">
              {/* Tile 1: Hero Card mock */}
              <div className="flex-none w-[240px] md:w-auto snap-center">
                <div className="rounded-xl border-2 border-amber-400/60 bg-gradient-to-br from-amber-50 via-white to-amber-100/50 p-4 shadow-lg h-full min-h-[280px] flex flex-col">
                  <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground bg-muted px-2 py-0.5 rounded">
                      League receipts
                    </span>
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                      OWNED
                    </span>
                  </div>
                  <div className="text-center space-y-2 flex-1 flex flex-col justify-center">
                    <div className="w-12 h-12 mx-auto rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white text-lg font-bold shadow-md">
                      👑
                    </div>
                    <h3 className="text-lg font-bold tracking-tight">THE LANDLORD</h3>
                    <p className="text-sm font-medium text-muted-foreground">RobOwnsYou</p>
                    <div className="pt-2 border-t">
                      <p className="text-2xl font-extrabold">4</p>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Managers Owned</p>
                    </div>
                    <p className="text-sm italic text-muted-foreground pt-2">"Rent is due."</p>
                  </div>
                </div>
              </div>

              {/* Tile 2: Dominance Grid Thumbnail mock */}
              <div className="flex-none w-[240px] md:w-auto snap-center">
                <div className="rounded-xl border bg-white p-4 shadow-lg h-full min-h-[280px] flex flex-col">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground bg-muted px-2 py-0.5 rounded">
                      League receipts
                    </span>
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Who Owns Who
                  </p>
                  <div className="grid grid-cols-4 gap-1 text-[10px] flex-1">
                    <div className="bg-transparent"></div>
                    <div className="bg-muted/50 rounded p-1.5 text-center font-medium truncate">Rob</div>
                    <div className="bg-muted/50 rounded p-1.5 text-center font-medium truncate">Mike</div>
                    <div className="bg-muted/50 rounded p-1.5 text-center font-medium truncate">Jake</div>

                    <div className="bg-muted/50 rounded p-1.5 text-center font-medium truncate">Rob</div>
                    <div className="bg-muted/30 rounded p-1.5 text-center">—</div>
                    <div className="bg-green-100 rounded p-1.5 text-center font-bold text-green-700">4-1</div>
                    <div className="bg-green-200 rounded p-1.5 text-center font-bold text-green-800">5-0</div>

                    <div className="bg-muted/50 rounded p-1.5 text-center font-medium truncate">Mike</div>
                    <div className="bg-red-100 rounded p-1.5 text-center font-bold text-red-700">1-4</div>
                    <div className="bg-muted/30 rounded p-1.5 text-center">—</div>
                    <div className="bg-yellow-100 rounded p-1.5 text-center font-medium text-yellow-700">2-2</div>

                    <div className="bg-muted/50 rounded p-1.5 text-center font-medium truncate">Jake</div>
                    <div className="bg-red-200 rounded p-1.5 text-center font-bold text-red-800">0-5</div>
                    <div className="bg-yellow-100 rounded p-1.5 text-center font-medium text-yellow-700">2-2</div>
                    <div className="bg-muted/30 rounded p-1.5 text-center">—</div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3 text-center">All-time head-to-head</p>
                </div>
              </div>

              {/* Tile 3: Storyline Mini Card mock */}
              <div className="flex-none w-[240px] md:w-auto snap-center">
                <div className="rounded-xl border-2 border-red-400/60 bg-gradient-to-br from-red-50 via-white to-red-100/50 p-4 shadow-lg h-full min-h-[280px] flex flex-col">
                  <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground bg-muted px-2 py-0.5 rounded">
                      Weekly roast
                    </span>
                    <span className="text-xs font-bold uppercase tracking-wider text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
                      BLOWOUT
                    </span>
                  </div>
                  <div className="text-center space-y-2 flex-1 flex flex-col justify-center">
                    <h3 className="text-base font-bold tracking-tight">Biggest Embarrassment</h3>
                    <p className="text-sm font-medium text-muted-foreground">MikeGotCooked</p>
                    <p className="text-xs text-muted-foreground italic px-1">
                      Week verdict: The Landlord feasted. Rebuild Forever filed a missing score report.
                    </p>
                    <div className="pt-2 border-t">
                      <p className="text-2xl font-extrabold text-red-600">62.4</p>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Margin of Victory</p>
                    </div>
                    <p className="text-sm italic text-muted-foreground pt-2">"Not competitive."</p>
                  </div>
                </div>
              </div>

              {/* Tile 4: Share Moment mock */}
              <div className="flex-none w-[240px] md:w-auto snap-center">
                <div className="rounded-xl border bg-gradient-to-br from-blue-50 to-blue-100/50 p-4 shadow-lg h-full min-h-[280px] flex flex-col">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground bg-white/80 px-2 py-0.5 rounded border">
                      Weekly roast
                    </span>
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-blue-600 mb-3">
                    💬 Group Chat Ready
                  </p>
                  <div className="bg-white rounded-2xl rounded-bl-sm p-3 shadow-sm border flex-1">
                    <p className="text-sm font-medium">
                      <span className="font-bold">THE LANDLORD 👑</span>
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      @RobOwnsYou owns 4 managers.
                    </p>
                    <p className="text-sm font-semibold mt-2">Rent is due.</p>
                  </div>
                  <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                    <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Copy</span>
                    <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Share</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-center">
              <Button variant="outline" onClick={handleTryExampleLeague} className="font-semibold interact-secondary">
                Try an example league →
              </Button>
              <p className="text-xs text-muted-foreground mt-1">No login. 1 click.</p>
            </div>
          </section>

          {/* What's Inside — grouped by the three jobs */}
          <section className="rounded-xl border-2 border-primary/20 bg-gradient-to-br from-background to-primary/5 p-6 md:p-8 space-y-6">
            <h2 className="text-xl md:text-2xl font-bold text-center">
              Everything in one unlock
            </h2>
            <p className="text-center text-sm text-muted-foreground max-w-2xl mx-auto">
              Same $2.99 — explore receipts, run weekly roasts, and close the season with your story.
            </p>
            <div className="grid gap-6 md:grid-cols-3 md:gap-4 text-left max-w-5xl mx-auto">
              <div className="space-y-2 rounded-lg border border-muted/60 bg-background/80 p-4">
                <h3 className="text-sm font-bold text-foreground">League Receipts</h3>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  <li className="flex gap-2"><span className="text-primary font-bold shrink-0">✓</span><span>All-time dominance grid &amp; head-to-head records</span></li>
                  <li className="flex gap-2"><span className="text-primary font-bold shrink-0">✓</span><span>Hero archetypes: Landlord, Victim, Choker, Heartbreaker…</span></li>
                  <li className="flex gap-2"><span className="text-primary font-bold shrink-0">✓</span><span>Storylines &amp; receipts across seasons</span></li>
                </ul>
              </div>
              <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-4 ring-1 ring-primary/10">
                <h3 className="text-sm font-bold text-foreground">Weekly Roast</h3>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  <li className="flex gap-2"><span className="text-primary font-bold shrink-0">✓</span><span>Week-by-week chaos &amp; matchup narratives</span></li>
                  <li className="flex gap-2"><span className="text-primary font-bold shrink-0">✓</span><span>Screenshot-ready cards for the group chat</span></li>
                  <li className="flex gap-2"><span className="text-primary font-bold shrink-0">✓</span><span>Commissioner email — preview or recap</span></li>
                </ul>
              </div>
              <div className="space-y-2 rounded-lg border border-muted/60 bg-background/80 p-4">
                <h3 className="text-sm font-bold text-foreground">Season Recap</h3>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  <li className="flex gap-2"><span className="text-primary font-bold shrink-0">✓</span><span>Your season — highlights &amp; choke jobs</span></li>
                  <li className="flex gap-2"><span className="text-primary font-bold shrink-0">✓</span><span>League autopsy &amp; final verdict</span></li>
                  <li className="flex gap-2"><span className="text-primary font-bold shrink-0">✓</span><span>Defining moments &amp; identity cards</span></li>
                </ul>
              </div>
            </div>
            <div className="text-center pt-4 border-t border-primary/10">
              <p className="text-lg font-bold">
                Unlock the full league for you — <span className="text-primary">$2.99</span>
              </p>
              <Button 
                size="lg" 
                onClick={handleViewLeagueHistory} 
                className="mt-4 font-semibold interact-cta"
              >
                Unlock for you — $2.99
              </Button>
              <p className="text-xs text-muted-foreground mt-3">
                Designed for fantasy leagues that talk trash.
              </p>
            </div>
          </section>

          {/* Form Section */}
          <section id="get-started" className="rounded-lg border border-muted/50 bg-muted/20 p-6 space-y-4 scroll-mt-24">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Get Started</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Enter your Sleeper league — then explore receipts, weekly roast, and your season story.
              </p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700">Sleeper Username</label>
                <input
                  id="username-input"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (e.target.value.trim()) {
                      setStoredUsername(e.target.value);
                    }
                  }}
                  placeholder="Enter your username..."
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  data-testid="input-sleeper-username"
                />
                <p className="mt-1 text-xs text-gray-500">Use your Sleeper username (same as in the app).</p>
                <p className="text-xs text-gray-500">Takes ~10 seconds.</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700">Season</label>
                <select
                  value={season}
                  onChange={(e) => setSeason(e.target.value)}
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  data-testid="select-season"
                >
                  <option value="2024">2024</option>
                  <option value="2025">2025</option>
                </select>
              </div>

              <button
                id="button-find-leagues"
                onClick={findLeagues}
                disabled={!username || loading}
                className="w-full rounded-lg bg-black px-4 py-2 text-white font-semibold transition-opacity disabled:opacity-70 disabled:cursor-not-allowed"
                data-testid="button-find-leagues"
              >
                Find my leagues
              </button>

              {leagues.length > 0 && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700">Select League</label>
                  <select
                    value={leagueId}
                    onChange={(e) => handleLeagueSelect(e.target.value)}
                    className="mt-1 w-full rounded-lg border px-3 py-2"
                    data-testid="select-league"
                  >
                    <option value="">Choose a league...</option>
                    {leagues.map((l) => (
                      <option key={l.league_id} value={l.league_id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="border-t pt-2">
                <button
                  onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                  className="flex items-center text-sm font-medium text-gray-500 hover:text-gray-700"
                  data-testid="button-advanced-toggle"
                >
                  {isAdvancedOpen ? <ChevronDown className="mr-1 h-4 w-4" /> : <ChevronRight className="mr-1 h-4 w-4" />}
                  Advanced: enter League ID manually
                </button>
                {isAdvancedOpen && (
                  <div className="mt-2 space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700">Sleeper League ID</label>
                      <input
                        value={leagueId}
                        onChange={(e) => setLeagueId(e.target.value.trim())}
                        placeholder="e.g. 104938485739..."
                        className="mt-1 w-full rounded-lg border px-3 py-2"
                        data-testid="input-league-id"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

          </section>
        </>
      )}

      {sport === "fpl" && (
        <>
          <div className="rounded-2xl border bg-white p-5 shadow-sm space-y-4">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700">Manager ID</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={fplManagerId}
                  onChange={(e) => setFplManagerId(e.target.value.replace(/\D/g, ""))}
                  placeholder="e.g. 1234567"
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  data-testid="input-fpl-manager-id"
                />
                <button
                  onClick={() => setShowFplHelp(!showFplHelp)}
                  className="mt-1 inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                  data-testid="button-fpl-help"
                >
                  <HelpCircle className="w-3 h-3" />
                  Where do I find my Manager ID?
                </button>
                {showFplHelp && (
                  <p className="mt-2 text-xs text-gray-600 bg-gray-50 p-3 rounded-lg">
                    Open your FPL team page in a browser. The number in the URL after /entry/ is your Manager ID.
                    <br />
                    <span className="text-gray-400">Example: fantasy.premierleague.com/entry/<strong>1234567</strong>/event/1</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700">Gameweek</label>
                <input
                  type="number"
                  min={1}
                  max={38}
                  value={fplGameweek}
                  onChange={(e) => setFplGameweek(e.target.value)}
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  data-testid="input-fpl-gameweek"
                />
                <p className="mt-1 text-xs text-gray-500">Enter a gameweek from 1-38</p>
              </div>
            </div>

            <button
              onClick={fetchFplRoast}
              disabled={!fplManagerId || loading}
              className="w-full rounded-xl bg-purple-600 px-4 py-3 text-white font-extrabold disabled:opacity-40"
              data-testid="button-fpl-roast"
            >
              Generate FPL Roast
            </button>
          </div>
        </>
      )}

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-red-800">
          {error}
        </div>
      )}

      {loading && <div className="text-gray-500">Loading…</div>}

      {activeView === "fpl" && fplData && <FplRoastCard data={fplData} />}
    </div>
  );
}
