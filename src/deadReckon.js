const EARTH_R = 6_371_000; // metres
const DEG = Math.PI / 180;

/**
 * Where will this aircraft be `seconds` from the moment its position was
 * reported, assuming it holds its current heading and speed?
 *
 * This is straight-line dead reckoning on a flat-earth approximation. Over the
 * 12 seconds between polls an airliner covers roughly 3 km, and the error from
 * ignoring great-circle curvature at that distance is centimetres — far below
 * one screen pixel.
 */
export function project(lat, lon, headingDeg, speedMs, seconds) {
  if (speedMs == null || headingDeg == null) return [lat, lon];

  const distance = speedMs * seconds;
  const theta = headingDeg * DEG;

  const dLat = (distance * Math.cos(theta)) / EARTH_R / DEG;
  const dLon =
    (distance * Math.sin(theta)) / (EARTH_R * Math.cos(lat * DEG)) / DEG;

  return [lat + dLat, lon + dLon];
}

/** Linear interpolation, used to decay the correction offset smoothly. */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Ease-out curve. Applied to the correction blend so a jump toward the true
 * position starts quickly and settles gently, instead of moving at a constant
 * rate and stopping abruptly.
 */
export function easeOut(t) {
  return 1 - Math.pow(1 - t, 3);
}
