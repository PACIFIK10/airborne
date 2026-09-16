// OpenSky reports SI units; aviation displays feet and knots.
export const metresToFeet = (m) => (m == null ? null : m * 3.28084);
export const msToKnots = (v) => (v == null ? null : v * 1.94384);
