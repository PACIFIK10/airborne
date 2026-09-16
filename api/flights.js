// Vercel runs this file as a serverless function at /api/flights.
// Same logic as the old Express route, minus the server: Vercel supplies the
// HTTP layer, so there is no app.listen and no CORS config — the function is
// served from the same origin as the frontend.

const OPENSKY_URL = "https://opensky-network.org/api/states/all";
const TOKEN_URL =
  "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token";

// Module scope persists while a serverless instance stays warm, so these caches
// survive between requests that land on the same instance. They are NOT shared
// across instances, and a cold start begins with empty ones. That is fine here:
// the cache is an optimisation, not a correctness requirement.
let cachedToken = null;
const cache = new Map();
const CACHE_MS = 10_000;

async function getAccessToken() {
  const id = process.env.OPENSKY_CLIENT_ID;
  const secret = process.env.OPENSKY_CLIENT_SECRET;
  if (!id || !secret) return null;

  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.value;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: id,
      client_secret: secret,
    }),
  });
  if (!res.ok) throw new Error(`Token request failed (${res.status})`);

  const json = await res.json();
  cachedToken = {
    value: json.access_token,
    expiresAt: Date.now() + (json.expires_in - 60) * 1000,
  };
  return cachedToken.value;
}

function toFlight(s) {
  return {
    id: s[0],
    callsign: (s[1] || "").trim() || null,
    country: s[2],
    lastContact: s[4],
    lon: s[5],
    lat: s[6],
    baroAltitude: s[7],
    onGround: s[8],
    velocity: s[9],
    heading: s[10],
    verticalRate: s[11],
    geoAltitude: s[13],
    squawk: s[14],
  };
}

export default async function handler(req, res) {
  const { lamin, lomin, lamax, lomax } = req.query;
  const key = `${lamin}|${lomin}|${lamax}|${lomax}`;

  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) {
    return res.status(200).json({ ...hit.payload, cached: true });
  }

  try {
    const url = new URL(OPENSKY_URL);
    if (lamin && lomin && lamax && lomax) {
      url.searchParams.set("lamin", lamin);
      url.searchParams.set("lomin", lomin);
      url.searchParams.set("lamax", lamax);
      url.searchParams.set("lomax", lomax);
    }

    const token = await getAccessToken();
    const upstream = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (upstream.status === 429) {
      return res.status(429).json({
        error: "Rate limited by OpenSky. Add API credentials or slow the polling.",
      });
    }
    if (!upstream.ok) {
      return res.status(502).json({ error: `OpenSky returned ${upstream.status}` });
    }

    const data = await upstream.json();
    const payload = {
      time: data.time,
      flights: (data.states || [])
        .map(toFlight)
        .filter((f) => f.lat != null && f.lon != null && !f.onGround),
    };

    cache.set(key, { at: Date.now(), payload });

    // Let Vercel's CDN serve the same bounding box to other visitors for 10s.
    res.setHeader("Cache-Control", "s-maxage=10, stale-while-revalidate=30");
    res.status(200).json({ ...payload, cached: false });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not reach the flight data service." });
  }
}
