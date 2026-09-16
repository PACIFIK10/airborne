# Airborne — live flight map

React + Leaflet frontend with a serverless backend, deployed on Vercel.
Aircraft positions come from the OpenSky Network.

## Structure

```
api/flights.js      serverless function — proxies and caches OpenSky
src/                React app
  App.jsx           layout, search, flight strip list
  FlightMap.jsx     map shell
  AircraftLayer.jsx imperative Leaflet layer: interpolation + trails
  useFlights.js     polling and trail history
  deadReckon.js     position projection maths
index.html
vite.config.js
```

There is no Express server any more. Vercel runs `api/flights.js` on demand and
serves the built frontend from its CDN, so both halves live at one origin.

## Local development

```bash
npm install
npm i -g vercel        # once
vercel dev             # runs the frontend AND the api/ function together
```

`vercel dev` is what you want locally — plain `npm run dev` starts Vite only,
and `/api/flights` will 404 because nothing is serving it.

## Deploying

1. Push this folder to a GitHub repository.
2. At vercel.com, import the repo. Vercel detects Vite automatically; accept
   the defaults.
3. Add `OPENSKY_CLIENT_ID` and `OPENSKY_CLIENT_SECRET` under
   Settings → Environment Variables, then redeploy.

Every push to the main branch redeploys automatically.

## Credentials

Anonymous OpenSky access is limited to a few requests per minute, which a
public site will exhaust quickly. Register at opensky-network.org, create an
API client, and set the two environment variables above.

Never commit the real values. `.gitignore` excludes `.env` for this reason.

## How the map works

- `useFlights` polls `/api/flights` every 12 seconds with the map's current
  bounding box, and keeps the last 30 positions per aircraft.
- `AircraftLayer` owns Leaflet markers directly rather than rendering React
  components, so a `requestAnimationFrame` loop can move ~1,200 aircraft
  without triggering re-renders.
- Between polls, each aircraft's position is projected forward from its last
  known heading and speed. When real data arrives, the prediction error is
  decayed to zero over 1.5 seconds so aircraft slide into place instead of
  jumping.

## Next steps

- Log snapshots to Postgres on a schedule, then chart traffic by hour or route.
- Filter by altitude band, airline, or aircraft type.
- Join OpenSky's aircraft metadata to show type and operator.
- Put map bounds and selection in the URL so views are shareable.
