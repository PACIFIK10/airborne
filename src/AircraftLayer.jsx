import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import { project, lerp, easeOut } from "./deadReckon.js";
import { metresToFeet, msToKnots } from "./units.js";

// Animating ~1,200 markers through React state would mean 1,200 re-renders per
// frame. Instead this component owns its Leaflet markers imperatively: React
// hands it data, and it mutates marker positions directly in an animation loop.
const FRAME_MS = 33; // ~30fps; plenty smooth, half the work of 60
const BLEND_MS = 1500; // how long to ease from predicted to freshly reported

function altitudeBand(metres) {
  const ft = metresToFeet(metres);
  if (ft == null) return "unknown";
  if (ft < 10000) return "low";
  if (ft < 28000) return "mid";
  return "high";
}

function makeIcon(band) {
  return L.divIcon({
    html: `<div class="ac ac--${band}"></div>`,
    className: "ac-wrap",
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

function popupHtml(f) {
  const row = (label, value, unit) =>
    `<dt>${label}</dt><dd>${
      value == null ? "\u2014" : Math.round(value).toLocaleString() + " " + unit
    }</dd>`;

  return `<div class="popup">
    <div class="popup__call">${f.callsign || f.id.toUpperCase()}</div>
    <dl class="popup__grid">
      ${row("Altitude", metresToFeet(f.baroAltitude), "ft")}
      ${row("Speed", msToKnots(f.velocity), "kt")}
      ${row("Heading", f.heading, "\u00b0")}
      <dt>Registered</dt><dd>${f.country}</dd>
    </dl>
  </div>`;
}

export default function AircraftLayer({ flights, trailsRef, selectedId, onSelect }) {
  const map = useMap();

  // id -> { marker, anchor, heading, velocity, offset, updatedAt }
  const statesRef = useRef(new Map());
  const layerRef = useRef(null);
  const trailRef = useRef(null);

  // --- Create the layer group once ----------------------------------------
  useEffect(() => {
    layerRef.current = L.layerGroup().addTo(map);
    return () => {
      layerRef.current.remove();
      statesRef.current.clear();
    };
  }, [map]);

  // --- Sync markers whenever new data arrives ------------------------------
  useEffect(() => {
    const states = statesRef.current;
    const layer = layerRef.current;
    if (!layer) return;

    const now = performance.now();
    const seen = new Set();

    for (const f of flights) {
      seen.add(f.id);
      const existing = states.get(f.id);

      if (!existing) {
        const marker = L.marker([f.lat, f.lon], {
          icon: makeIcon(altitudeBand(f.baroAltitude)),
          // Leaflet's own transition would fight our animation loop.
          interactive: true,
        });
        marker.bindPopup(popupHtml(f));
        marker.on("click", () => onSelect(f.id));
        marker.addTo(layer);

        states.set(f.id, {
          marker,
          anchor: [f.lat, f.lon],
          heading: f.heading,
          velocity: f.velocity,
          band: altitudeBand(f.baroAltitude),
          offset: [0, 0],
          updatedAt: now,
        });
      } else {
        // The marker is currently drawn somewhere we predicted. Record how far
        // that guess was from the truth, then let the loop decay it to zero —
        // the aircraft slides into its real position instead of teleporting.
        const drawn = existing.marker.getLatLng();
        existing.offset = [drawn.lat - f.lat, drawn.lng - f.lon];
        existing.anchor = [f.lat, f.lon];
        existing.heading = f.heading;
        existing.velocity = f.velocity;
        existing.updatedAt = now;

        const band = altitudeBand(f.baroAltitude);
        if (band !== existing.band) {
          existing.marker.setIcon(makeIcon(band));
          existing.band = band;
        }
        existing.marker.setPopupContent(popupHtml(f));
      }
    }

    for (const [id, state] of states) {
      if (!seen.has(id)) {
        state.marker.remove();
        states.delete(id);
      }
    }
  }, [flights, onSelect]);

  // --- Animation loop ------------------------------------------------------
  useEffect(() => {
    let raf;
    let lastFrame = 0;

    const tick = (now) => {
      raf = requestAnimationFrame(tick);
      if (now - lastFrame < FRAME_MS) return;
      lastFrame = now;

      for (const state of statesRef.current.values()) {
        const elapsed = (now - state.updatedAt) / 1000;
        const [lat, lon] = project(
          state.anchor[0],
          state.anchor[1],
          state.heading,
          state.velocity,
          elapsed
        );

        // Decay the correction offset over BLEND_MS.
        const t = Math.min(1, (now - state.updatedAt) / BLEND_MS);
        const fade = 1 - easeOut(t);

        state.marker.setLatLng([
          lerp(lat, lat + state.offset[0], fade),
          lerp(lon, lon + state.offset[1], fade),
        ]);

        // Rotation lives on the inner div so Leaflet's own positioning
        // transform on the wrapper isn't clobbered.
        const el = state.marker.getElement()?.firstChild;
        if (el) el.style.transform = `rotate(${state.heading || 0}deg)`;
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // --- Trail for the selected aircraft -------------------------------------
  useEffect(() => {
    if (trailRef.current) {
      trailRef.current.remove();
      trailRef.current = null;
    }
    if (!selectedId) return;

    const points = trailsRef.current.get(selectedId);
    if (!points || points.length < 2) return;

    trailRef.current = L.polyline(points, {
      color: "#c2542f",
      weight: 2,
      opacity: 0.75,
      dashArray: "4 4",
    }).addTo(map);

    return () => {
      if (trailRef.current) trailRef.current.remove();
    };
  }, [selectedId, flights, map, trailsRef]);

  // --- Highlight the selected marker ---------------------------------------
  useEffect(() => {
    for (const [id, state] of statesRef.current) {
      const el = state.marker.getElement()?.firstChild;
      if (el) el.classList.toggle("ac--selected", id === selectedId);
    }
  }, [selectedId, flights]);

  return null;
}
