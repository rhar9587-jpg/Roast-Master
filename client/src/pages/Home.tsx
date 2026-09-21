import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FplRoastCard } from "@/components/FplRoastCard";
import type { FplRoastResponse } from "@shared/schema";
import { ChevronDown, ChevronRight, HelpCircle } from "lucide-react";
import { getRecentLeagues, setStoredUsername } from "./LeagueHistory/utils";
import {
  buildLeagueAppPath,
  pickResumeLeague,
  resumeContinueTitle,
  resumeSupportingLine,
} from "./LeagueHistory/leagueAppNav";
import { trackFunnel } from "@/lib/track";
import { OFFER, PRICE_LABEL, unlockCtaLabel } from "@/lib/brand";

type Sport = "nfl" | "fpl";
type LeagueOption = { league_id: string; name: string; season: string };
type View = "none" | "fpl";

export default function Home() {
  const [sport, setSport] = useState<Sport>("nfl");
  
  const [leagueId, setLeagueId] = useState("");
  const [season, setSeason] = useState("2026");
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
  const [nflLatestFinalWeek, setNflLatestFinalWeek] = useState(0);

  const resumeLeague = useMemo(() => pickResumeLeague(getRecentLeagues()), []);

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

  useEffect(() => {
    fetch("/api/nfl/state")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { latestFinalWeek?: number } | null) => {
        if (data) setNflLatestFinalWeek(Math.max(0, Number(data.latestFinalWeek) || 0));
      })
      .catch(() => {
        /* optional for Continue supporting line */
      });
  }, []);

  function openLeagueWeekly(opts: {
    leagueId: string;
    week?: number;
    emailMode?: "recap" | "preview";
    startWeek?: number;
    endWeek?: number;
  }) {
    window.location.href = buildLeagueAppPath({
      leagueId: opts.leagueId,
      tab: "weekly",
      week: opts.week,
      emailMode: opts.emailMode,
      startWeek: opts.startWeek ?? 1,
      endWeek: opts.endWeek ?? 17,
    });
  }

  async function findLeagues() {
    if (!username) {
      setError("Please enter your Sleeper username.");
      return;
    }
    trackFunnel.usernameSubmitted(season);
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
      trackFunnel.leaguesReturned(data.length, season);
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

    trackFunnel.leagueSelected(season);
    openLeagueWeekly({ leagueId: lId });
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
    const mostRecent = pickResumeLeague(recent);
    if (mostRecent?.leagueId) {
      openLeagueWeekly({
        leagueId: mostRecent.leagueId,
        week: mostRecent.lastWeek,
        emailMode: mostRecent.lastEmailMode,
        startWeek: mostRecent.startWeek,
        endWeek: mostRecent.endWeek,
      });
      return;
    }
    if (leagueId) {
      openLeagueWeekly({ leagueId });
      return;
    }
    openLeagueWeekly({ leagueId: EXAMPLE_LEAGUE_ID });
  }

  function handleTryExampleLeague() {
    trackFunnel.exampleClicked();
    openLeagueWeekly({ leagueId: EXAMPLE_LEAGUE_ID });
  }

  function handleContinueLeague() {
    if (!resumeLeague) return;
    openLeagueWeekly({
      leagueId: resumeLeague.leagueId,
      week: resumeLeague.lastWeek,
      emailMode: resumeLeague.lastEmailMode,
      startWeek: resumeLeague.startWeek,
      endWeek: resumeLeague.endWeek,
    });
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 space-y-6 md:space-y-8">
      {/* NFL Only for Super Bowl Launch - FPL hidden */}
      {sport === "nfl" && (
        <>
          {/* Hero Section */}
          <section className="text-center py-6 md:py-8 space-y-4">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              See what happened this week
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              See what happened in your fantasy league this week — then roast it.
            </p>
            <p className="text-sm text-muted-foreground max-w-xl mx-auto">
              Weekly is the main loop. Receipts and season stay one tap away.
              {` ${OFFER.unlockOnce}`}: share without watermarks.
            </p>
            {resumeLeague ? (
              <div className="flex flex-col gap-2 items-center max-w-md mx-auto">
                <Button
                  size="lg"
                  onClick={handleContinueLeague}
                  className="font-semibold interact-cta w-full sm:w-auto"
                  data-testid="button-continue-league"
                >
                  {resumeContinueTitle(resumeLeague.leagueName)}
                </Button>
                <p className="text-sm text-muted-foreground" data-testid="text-continue-supporting">
                  {resumeSupportingLine({
                    lastWeek: resumeLeague.lastWeek,
                    latestFinalWeek: nflLatestFinalWeek,
                  })}
                </p>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() =>
                    document.getElementById("get-started")?.scrollIntoView({ behavior: "smooth" })
                  }
                  className="font-semibold interact-secondary w-full sm:w-auto"
                >
                  Switch league / username
                </Button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-3 justify-center items-stretch sm:items-center">
                <Button size="lg" onClick={handleTryExampleLeague} className="font-semibold interact-cta">
                  Try demo league — free
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() =>
                    document.getElementById("get-started")?.scrollIntoView({ behavior: "smooth" })
                  }
                  className="font-semibold interact-secondary"
                >
                  Use my Sleeper league
                </Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              No login required. Unlock your league later for a one-time {PRICE_LABEL}.
            </p>
          </section>

          {/* Weekly-first product story */}
          <section className="space-y-4" aria-labelledby="product-story-heading">
            <h2 id="product-story-heading" className="sr-only">
              What you get
            </h2>
            <Card className="border-2 border-primary/30 shadow-sm ring-1 ring-primary/10">
              <CardHeader className="pb-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-primary mb-1">
                  The main product
                </p>
                <CardTitle className="text-lg font-bold tracking-tight">Weekly Roast</CardTitle>
                <p className="text-sm text-muted-foreground leading-snug">
                  This week&apos;s chaos cards and commissioner email — open, laugh, send it to the group chat.
                </p>
              </CardHeader>
              <CardContent className="pt-0 text-xs text-muted-foreground">
                Built for the weekly loop, not a once-a-year scroll.
              </CardContent>
            </Card>
            <div className="grid gap-3 sm:grid-cols-2">
              <Card className="border border-muted/60 shadow-sm bg-muted/10">
                <CardHeader className="pb-2 pt-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                    Also included
                  </p>
                  <CardTitle className="text-base font-bold tracking-tight">League Receipts</CardTitle>
                  <p className="text-sm text-muted-foreground leading-snug">
                    Who owns who — all-time dominance, badges, and storylines you can prove.
                  </p>
                </CardHeader>
              </Card>
              <Card className="border border-muted/60 shadow-sm bg-muted/10">
                <CardHeader className="pb-2 pt-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                    Also included
                  </p>
                  <CardTitle className="text-base font-bold tracking-tight">Season Recap</CardTitle>
                  <p className="text-sm text-muted-foreground leading-snug">
                    Your season story and the league finale when the books close.
                  </p>
                </CardHeader>
              </Card>
            </div>
          </section>

          {/* Example Cards */}
          <section className="pt-2 pb-6 space-y-4">
            <p className="text-center text-sm font-medium text-foreground">See the weekly roast</p>
            <p className="text-center text-xs text-muted-foreground">
              Demo tiles — same unlock covers receipts and season too.
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
                      Weekly (included)
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
                      Share moment
                    </span>
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-blue-600 mb-3">
                    Group Chat Ready
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

          {/* What's Inside — weekly leads */}
          <section className="rounded-xl border-2 border-primary/20 bg-gradient-to-br from-background to-primary/5 p-6 md:p-8 space-y-6">
            <h2 className="text-xl md:text-2xl font-bold text-center">
              Unlock weekly + receipts
            </h2>
            <p className="text-center text-sm text-muted-foreground max-w-2xl mx-auto">
              One-time {PRICE_LABEL}. Roast the week. Receipts and season come with it.
            </p>
            <div className="grid gap-6 md:grid-cols-3 md:gap-4 text-left max-w-5xl mx-auto">
              <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-4 ring-1 ring-primary/10 md:col-span-1">
                <h3 className="text-sm font-bold text-foreground">Weekly Roast</h3>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  <li className="flex gap-2"><span className="text-primary font-bold shrink-0">✓</span><span>Week-by-week chaos &amp; matchup narratives</span></li>
                  <li className="flex gap-2"><span className="text-primary font-bold shrink-0">✓</span><span>Screenshot-ready cards for the group chat</span></li>
                  <li className="flex gap-2"><span className="text-primary font-bold shrink-0">✓</span><span>Commissioner email — preview or recap</span></li>
                </ul>
              </div>
              <div className="space-y-2 rounded-lg border border-muted/60 bg-background/80 p-4">
                <h3 className="text-sm font-bold text-foreground">League Receipts</h3>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  <li className="flex gap-2"><span className="text-primary font-bold shrink-0">✓</span><span>All-time dominance grid &amp; head-to-head records</span></li>
                  <li className="flex gap-2"><span className="text-primary font-bold shrink-0">✓</span><span>Hero archetypes: Landlord, Victim, Choker, Heartbreaker…</span></li>
                  <li className="flex gap-2"><span className="text-primary font-bold shrink-0">✓</span><span>Storylines &amp; share/export without watermarks</span></li>
                </ul>
              </div>
              <div className="space-y-2 rounded-lg border border-muted/60 bg-background/80 p-4">
                <h3 className="text-sm font-bold text-foreground">Season (included)</h3>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  <li className="flex gap-2"><span className="text-primary font-bold shrink-0">✓</span><span>Your season — highlights &amp; choke jobs</span></li>
                  <li className="flex gap-2"><span className="text-primary font-bold shrink-0">✓</span><span>League autopsy &amp; season snapshot</span></li>
                  <li className="flex gap-2"><span className="text-primary font-bold shrink-0">✓</span><span>Defining moments &amp; identity cards</span></li>
                </ul>
              </div>
            </div>
            <div className="text-center pt-4 border-t border-primary/10">
              <p className="text-lg font-bold text-primary">
                {unlockCtaLabel()}
              </p>
              <Button 
                size="lg" 
                onClick={handleViewLeagueHistory} 
                className="mt-4 font-semibold interact-cta"
              >
                {unlockCtaLabel()}
              </Button>
              <p className="text-xs text-muted-foreground mt-3">
                {OFFER.unlockOnce} • {OFFER.noSubscription} • Designed for leagues that talk trash.
              </p>
            </div>
          </section>

          {/* Form Section */}
          <section id="get-started" className="rounded-lg border border-muted/50 bg-muted/20 p-6 space-y-4 scroll-mt-24">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Get Started</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Enter your Sleeper username, pick a league, and land on this week&apos;s Weekly roast.
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
                  <option value="2026">2026</option>
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
