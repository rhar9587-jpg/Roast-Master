import { useState, useEffect } from "react";
import { RoastCard } from "@/components/RoastCard";
import { SeasonWrappedCard } from "@/components/SeasonWrappedCard";
import { LeagueAutopsyCard } from "@/components/LeagueAutopsyCard";
import { FplRoastCard } from "@/components/FplRoastCard";
import type { RoastResponse, WrappedResponse, LeagueAutopsyResponse, FplRoastResponse } from "@shared/schema";
import { ChevronDown, ChevronRight, HelpCircle } from "lucide-react";

type Sport = "nfl" | "fpl";
type TeamOption = { roster_id: number; name: string };
type LeagueOption = { league_id: string; name: string; season: string };
type View = "none" | "roast" | "wrapped" | "autopsy" | "fpl";

export default function Home() {
  const [sport, setSport] = useState<Sport>("fpl");
  
  const [leagueId, setLeagueId] = useState("");
  const [week, setWeek] = useState<number>(1);
  const [season, setSeason] = useState("2025");
  const [username, setUsername] = useState("");
  const [rosterId, setRosterId] = useState<number | null>(null);

  const [leagues, setLeagues] = useState<LeagueOption[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [needsDropdown, setNeedsDropdown] = useState(false);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  const [roastData, setRoastData] = useState<RoastResponse | null>(null);
  const [wrappedData, setWrappedData] = useState<WrappedResponse | null>(null);
  const [autopsyData, setAutopsyData] = useState<LeagueAutopsyResponse | null>(null);
  const [fplData, setFplData] = useState<FplRoastResponse | null>(null);

  const [fplManagerId, setFplManagerId] = useState("");
  const [fplGameweek, setFplGameweek] = useState("");
  const [showFplHelp, setShowFplHelp] = useState(false);

  const [activeView, setActiveView] = useState<View>("none");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      if (data.length === 0) {
        setError(`No leagues found for ${username} in ${season}.`);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadTeams(lId: string) {
    if (!lId) return;
    try {
      const res = await fetch(`/api/league-teams?league_id=${lId}`);
      const data = await res.json();
      setTeams(data.teams || []);
      setNeedsDropdown(true);
    } catch {
      setError("Failed to load league teams.");
    }
  }

  async function handleLeagueSelect(lId: string) {
    setLeagueId(lId);
    setRosterId(null);
    setTeams([]);
    setNeedsDropdown(false);
    if (!lId) return;

    try {
      const res = await fetch(
        `/api/resolve-roster?league_id=${lId}&username=${encodeURIComponent(username)}`
      );
      const data = await res.json();

      if (data?.roster_id) {
        setRosterId(data.roster_id);
      } else {
        await loadTeams(lId);
      }
    } catch {
      await loadTeams(lId);
    }
  }

  async function fetchRoast() {
    setLoading(true);
    setError(null);
    setActiveView("roast");
    setWrappedData(null);
    setAutopsyData(null);

    try {
      const res = await fetch("/api/roast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          league_id: leagueId,
          week,
          roster_id: rosterId ?? undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch roast.");
      setRoastData(data);
    } catch (err: any) {
      setError(err.message);
      setRoastData(null);
    } finally {
      setLoading(false);
    }
  }

  async function fetchWrapped() {
    if (!rosterId) {
      setError("Select your team to generate My Season.");
      return;
    }

    setLoading(true);
    setError(null);
    setActiveView("wrapped");
    setRoastData(null);
    setAutopsyData(null);

    try {
      const res = await fetch("/api/wrapped", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          league_id: leagueId,
          week,
          roster_id: rosterId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch My Season.");
      setWrappedData(data);
    } catch (err: any) {
      setError(err.message);
      setWrappedData(null);
    } finally {
      setLoading(false);
    }
  }

  async function fetchLeagueAutopsy() {
    if (!leagueId) {
      setError("Select a league to generate League Autopsy.");
      return;
    }

    setLoading(true);
    setError(null);
    setActiveView("autopsy");
    setRoastData(null);
    setWrappedData(null);

    try {
      const res = await fetch("/api/league-autopsy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          league_id: leagueId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch League Autopsy.");
      setAutopsyData(data);
    } catch (err: any) {
      setError(err.message);
      setAutopsyData(null);
    } finally {
      setLoading(false);
    }
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
    setRoastData(null);
    setWrappedData(null);
    setAutopsyData(null);

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

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Fantasy Roast 🔥</h1>
        <p className="mt-1 text-gray-600">Roast your league. Roast yourself. Share the burn.</p>
      </div>

      <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
        <button
          onClick={() => { 
            setSport("nfl"); 
            setActiveView("none"); 
            setError(null); 
            setFplData(null);
          }}
          className={`flex-1 py-2 px-4 rounded-lg font-semibold transition-colors ${
            sport === "nfl" 
              ? "bg-white text-black shadow-sm" 
              : "text-gray-500 hover:text-gray-700"
          }`}
          data-testid="tab-nfl"
        >
          NFL (Sleeper)
        </button>
        <button
          onClick={() => { 
            setSport("fpl"); 
            setActiveView("none"); 
            setError(null);
            setRoastData(null);
            setWrappedData(null);
            setAutopsyData(null);
          }}
          className={`flex-1 py-2 px-4 rounded-lg font-semibold transition-colors ${
            sport === "fpl" 
              ? "bg-white text-black shadow-sm" 
              : "text-gray-500 hover:text-gray-700"
          }`}
          data-testid="tab-fpl"
        >
          FPL
        </button>
      </div>

      {sport === "nfl" && (
        <>
          <div className="rounded-2xl border bg-white p-5 shadow-sm space-y-4">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700">Sleeper Username</label>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username..."
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  data-testid="input-sleeper-username"
                />
                <p className="mt-1 text-xs text-gray-500">Use your Sleeper username (same as in the app).</p>
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
                onClick={findLeagues}
                disabled={!username || loading}
                className="w-full rounded-lg bg-black px-4 py-2 text-white font-semibold disabled:opacity-40"
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

              {needsDropdown && teams.length > 0 && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700">Select Your Team</label>
                  <select
                    value={rosterId ?? ""}
                    onChange={(e) => setRosterId(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border px-3 py-2"
                    data-testid="select-team"
                  >
                    <option value="">Choose your roster...</option>
                    {teams.map((t) => (
                      <option key={t.roster_id} value={t.roster_id}>
                        {t.name}
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

            <div className="border-t pt-4">
              <label className="block text-sm font-semibold text-gray-700">Week</label>
              <input
                type="number"
                value={week}
                onChange={(e) => setWeek(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border px-3 py-2"
                data-testid="input-week"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={fetchRoast}
              disabled={!leagueId || loading}
              className="flex-1 rounded-xl bg-pink-600 px-4 py-3 text-white font-extrabold disabled:opacity-40"
              data-testid="button-roast-league"
            >
              Roast My League
            </button>
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm space-y-4">
            <div>
              <h2 className="text-lg font-bold tracking-tight">Season Wrapped</h2>
              <p className="text-sm text-gray-500">End-of-season receipts</p>
            </div>

            {!leagueId ? (
              <p className="text-sm text-gray-400 italic">Select a league to unlock Season Wrapped.</p>
            ) : (
              <div className="flex gap-3 flex-wrap">
                <button
                  onClick={fetchLeagueAutopsy}
                  disabled={!leagueId || loading}
                  className="flex-1 min-w-[140px] rounded-xl bg-blue-600 px-4 py-3 text-white font-extrabold disabled:opacity-40"
                  data-testid="button-league-autopsy"
                >
                  <div className="text-base">League Autopsy</div>
                  <div className="text-xs font-normal opacity-80 mt-0.5">The league, as it happened.</div>
                </button>

                <button
                  onClick={fetchWrapped}
                  disabled={!leagueId || !rosterId || loading}
                  className="flex-1 min-w-[140px] rounded-xl bg-green-600 px-4 py-3 text-white font-extrabold disabled:opacity-40"
                  data-testid="button-my-season"
                >
                  <div className="text-base">My Season</div>
                  <div className="text-xs font-normal opacity-80 mt-0.5">Your receipts.</div>
                </button>
              </div>
            )}

            {!rosterId && leagueId && (
              <p className="text-xs text-gray-400">Select your team to unlock My Season.</p>
            )}
          </div>
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

      {activeView === "roast" && roastData && <RoastCard data={roastData} />}
      {activeView === "wrapped" && wrappedData && <SeasonWrappedCard data={wrappedData} />}
      {activeView === "autopsy" && autopsyData && <LeagueAutopsyCard data={autopsyData} />}
      {activeView === "fpl" && fplData && <FplRoastCard data={fplData} />}
    </div>
  );
}
