import { useCallback, useEffect, useRef, useState } from "react";

const POLL_MS = 12_000;
const TRAIL_MAX = 30; // ~6 minutes of history at the current poll rate

/**
 * Polls the backend for aircraft inside `bounds`.
 *
 * Also accumulates a short position history per aircraft. That history lives in
 * a ref rather than state: it changes on every poll, but nothing re-renders
 * because of it directly — the map layer reads it when it redraws.
 */
export function useFlights(bounds) {
  const [flights, setFlights] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | loading | ready | error
  const [error, setError] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);

  const trailsRef = useRef(new Map()); // icao24 -> [[lat, lon], ...]

  // Keep bounds in a ref so changing the viewport doesn't restart the timer.
  const boundsRef = useRef(bounds);
  boundsRef.current = bounds;

  const load = useCallback(async () => {
    const b = boundsRef.current;
    if (!b) return;

    setStatus((s) => (s === "ready" ? "ready" : "loading"));
    const params = new URLSearchParams({
      lamin: b.getSouth().toFixed(4),
      lomin: b.getWest().toFixed(4),
      lamax: b.getNorth().toFixed(4),
      lomax: b.getEast().toFixed(4),
    });

    try {
      const res = await fetch(`/api/flights?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");

      recordTrails(trailsRef.current, data.flights);

      setFlights(data.flights);
      setUpdatedAt(new Date());
      setStatus("ready");
      setError(null);
    } catch (err) {
      setError(err.message);
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  return { flights, trailsRef, status, error, updatedAt, refresh: load };
}

/**
 * Appends the current position of each aircraft to its trail, and forgets
 * aircraft we no longer see so the map doesn't grow without bound as the user
 * pans around.
 */
function recordTrails(trails, flights) {
  const seen = new Set();

  for (const f of flights) {
    seen.add(f.id);
    const points = trails.get(f.id) || [];
    const last = points[points.length - 1];

    // Skip duplicates: a cached server response returns identical positions.
    if (last && last[0] === f.lat && last[1] === f.lon) continue;

    points.push([f.lat, f.lon]);
    if (points.length > TRAIL_MAX) points.shift();
    trails.set(f.id, points);
  }

  for (const id of trails.keys()) {
    if (!seen.has(id)) trails.delete(id);
  }
}
