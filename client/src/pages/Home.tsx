import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
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
  const EXAMPLE_LEAGUE_ID = "1204010682635255808";

  // Track home visit once on mount
  const hasTrackedVisit = useRef(false);
  useEffect(() => {
    if (!hasTrackedVisit.current) {
      hasTrackedVisit.current = true;
      trackFunnel.homeVisit();
    }
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
    const exampleLeagueId = "1204010682635255808";
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
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" onClick={handleViewLeagueHistory} className="font-semibold">
                Get Your League's Receipts
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              <span className="line-through">$29</span>{" "}
              <span className="font-bold text-foreground">$19</span>{" "}
              — Super Bowl price ends Feb 10
            </p>
          </section>

          {/* Example Cards */}
          <section className="pt-2 pb-6 space-y-4">
            <p className="text-center text-sm text-muted-foreground">See the roast</p>
            <p className="text-center text-xs text-muted-foreground">
              This is what you'll drop in the group chat.
            </p>

            <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory md:grid md:grid-cols-4 md:overflow-visible md:pb-0 -mx-4 px-4 md:mx-0 md:px-0">
              {/* Tile 1: Hero Card mock */}
              <div className="flex-none w-[240px] md:w-auto snap-center">
                <div className="rounded-xl border-2 border-amber-400/60 bg-gradient-to-br from-amber-50 via-white to-amber-100/50 p-4 shadow-lg h-full min-h-[280px] flex flex-col">
                  <div className="flex items-center gap-2 mb-3">
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
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
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
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
                      BLOWOUT
                    </span>
                  </div>
                  <div className="text-center space-y-2 flex-1 flex flex-col justify-center">
                    <h3 className="text-base font-bold tracking-tight">Biggest Blowout</h3>
                    <p className="text-sm font-medium text-muted-foreground">MikeGotCooked</p>
                    <div className="pt-2 border-t">
                      <p className="text-2xl font-extrabold text-red-600">62.4</p>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Margin of Victory</p>
                    </div>
                    <p className="text-sm italic text-muted-foreground pt-2">"Absolute embarrassment."</p>
                  </div>
                </div>
              </div>

              {/* Tile 4: Share Moment mock */}
              <div className="flex-none w-[240px] md:w-auto snap-center">
                <div className="rounded-xl border bg-gradient-to-br from-blue-50 to-blue-100/50 p-4 shadow-lg h-full min-h-[280px] flex flex-col">
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
              <Button variant="outline" onClick={handleTryExampleLeague} className="font-semibold">
                Try an example league →
              </Button>
              <p className="text-xs text-muted-foreground mt-1">No login. 1 click.</p>
            </div>
          </section>

          {/* What's Inside Section */}
          <section className="rounded-xl border-2 border-primary/20 bg-gradient-to-br from-background to-primary/5 p-6 md:p-8 space-y-4">
            <h2 className="text-xl md:text-2xl font-bold text-center">
              What's Inside Your League's Roast
            </h2>
            <ul className="max-w-xl mx-auto space-y-2 text-sm md:text-base">
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">✓</span>
                <span><strong>All-time dominance grid</strong> — who owns who, every season</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">✓</span>
                <span><strong>THE LANDLORD</strong> — the manager who runs the league</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">✓</span>
                <span><strong>BIGGEST VICTIM</strong> — the one who gets owned</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">✓</span>
                <span><strong>PLAYOFF CHOKER</strong> — great record, no trophy</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">✓</span>
                <span><strong>HEARTBREAKER</strong> — lost by inches, repeatedly</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">✓</span>
                <span><strong>Personal storylines</strong> — your nemesis, your choke jobs</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">✓</span>
                <span><strong>Season-by-season receipts</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">✓</span>
                <span><strong>Screenshot-ready cards</strong> for the group chat</span>
              </li>
            </ul>
            <div className="text-center pt-4 border-t border-primary/10">
              <p className="text-lg font-bold">
                <span className="line-through text-muted-foreground font-normal">$29</span>{" "}
                <span className="text-primary">$19</span> for your league
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Super Bowl price ends Feb 10
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Designed for fantasy leagues that talk trash.
              </p>
            </div>
          </section>

          {/* Form Section */}
          <section className="rounded-lg border border-muted/50 bg-muted/20 p-6 space-y-4">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Get Started</h2>
              <p className="text-sm text-muted-foreground mt-1">Enter your league to generate your roasts</p>
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
