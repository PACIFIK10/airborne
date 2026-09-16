import { useMemo, useState } from "react";
import FlightMap from "./FlightMap.jsx";
import { useFlights } from "./useFlights.js";
import { metresToFeet, msToKnots } from "./units.js";

export default function App() {
  const [bounds, setBounds] = useState(null);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const { flights, trailsRef, status, error, updatedAt, refresh } = useFlights(bounds);

  const visible = useMemo(() => {
    const q = query.trim().toUpperCase();
    const list = q
      ? flights.filter(
          (f) => (f.callsign || "").includes(q) || f.id.toUpperCase().includes(q)
        )
      : flights;
    return [...list].sort((a, b) => (b.baroAltitude ?? 0) - (a.baroAltitude ?? 0));
  }, [flights, query]);

  return (
    <div className="app">
      <aside className="panel">
        <header className="panel__head">
          <h1 className="wordmark">Airborne</h1>
          <p className="panel__sub">
            Aircraft transmitting from the area you're looking at. Pan the map to
            change the area.
          </p>
        </header>

        <div className="panel__controls">
          <label className="search">
            <span className="search__label">Find a callsign</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="UAL1234"
              spellCheck="false"
            />
          </label>
          <button className="refresh" onClick={refresh}>
            Refresh now
          </button>
        </div>

        <div className="status" role="status">
          {status === "error" ? (
            <span className="status--bad">{error} Try refreshing.</span>
          ) : (
            <>
              <strong>{visible.length}</strong> in view
              {updatedAt && (
                <span className="status__time">
                  updated {updatedAt.toLocaleTimeString()}
                </span>
              )}
            </>
          )}
        </div>

        <ol className="strips">
          {visible.map((f) => (
            <li key={f.id}>
              <button
                className={`strip ${selectedId === f.id ? "strip--on" : ""}`}
                onClick={() => setSelectedId(f.id)}
              >
                <span className="strip__call">{f.callsign || f.id.toUpperCase()}</span>
                <span className="strip__alt">{num(metresToFeet(f.baroAltitude))}</span>
                <span className="strip__spd">{num(msToKnots(f.velocity))}</span>
                <span className="strip__hdg">{num(f.heading)}</span>
              </button>
            </li>
          ))}
        </ol>

        {status === "ready" && visible.length === 0 && (
          <p className="empty">
            Nothing airborne here right now. Zoom out or pan toward a busier
            corridor.
          </p>
        )}
      </aside>

      <main className="stage">
        <FlightMap
          flights={flights}
          trailsRef={trailsRef}
          onBoundsChange={setBounds}
          onSelect={setSelectedId}
          selectedId={selectedId}
        />
      </main>
    </div>
  );
}

function num(value) {
  return value == null ? "\u2014" : Math.round(value).toLocaleString();
}
