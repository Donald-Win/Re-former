/**
 * nztm.js — WGS84 latitude/longitude → NZTM2000 (New Zealand Transverse
 * Mercator 2000) easting/northing conversion.
 *
 * The "GPS North" / "GPS East" fields on the Pole Record form are NZTM2000
 * projected co-ordinates (metres), not raw latitude/longitude — a device's
 * GPS chip reports WGS84 lat/lon, so that reading needs to be converted
 * before it can be dropped into those fields.
 *
 * Implements the standard Transverse Mercator forward projection (Snyder,
 * 1987, "Map Projections — A Working Manual") using the projection
 * parameters LINZ defines for NZTM2000:
 *   Ellipsoid:                     GRS80 (a = 6378137 m, f = 1/298.257222101)
 *   Central meridian:              173° E
 *   Latitude of origin:            0°
 *   False easting:                 1,600,000 m
 *   False northing:                10,000,000 m
 *   Central meridian scale factor: 0.9996
 *
 * A device's WGS84 fix is treated as equivalent to NZGD2000 for this
 * purpose — the practical difference between the two datums is a few
 * centimetres, well within the precision needed for as-built field records.
 *
 * Reference: LINZS25002 "NZGD2000 map projections" (Land Information
 * New Zealand).
 */

const A_AXIS = 6378137.0            // GRS80 semi-major axis (m)
const F      = 1 / 298.257222101    // GRS80 flattening
const K0     = 0.9996               // central meridian scale factor
const LAMBDA0 = 173 * Math.PI / 180 // central meridian (radians)
const N0     = 10000000             // false northing (m)
const E0     = 1600000              // false easting (m)

const E2  = F * (2 - F)             // eccentricity squared
const E4  = E2 * E2
const E6  = E4 * E2
const EP2 = E2 / (1 - E2)           // second eccentricity squared

/**
 * Convert a WGS84 lat/lon pair (decimal degrees) to NZTM2000 northing/easting.
 *
 * @param {number} latDeg - Latitude in decimal degrees (negative = south)
 * @param {number} lonDeg - Longitude in decimal degrees (positive = east)
 * @returns {{ northing: number, easting: number }} Rounded to the nearest metre
 */
export function latLonToNztm(latDeg, lonDeg) {
  const phi    = latDeg * Math.PI / 180
  const lambda = lonDeg * Math.PI / 180

  const sinPhi = Math.sin(phi)
  const cosPhi = Math.cos(phi)
  const tanPhi = Math.tan(phi)

  const N = A_AXIS / Math.sqrt(1 - E2 * sinPhi * sinPhi)
  const T = tanPhi * tanPhi
  const C = EP2 * cosPhi * cosPhi
  const A = (lambda - LAMBDA0) * cosPhi

  // Meridian arc distance from the equator to latitude phi
  const M = A_AXIS * (
    (1 - E2 / 4 - 3 * E4 / 64 - 5 * E6 / 256) * phi
    - (3 * E2 / 8 + 3 * E4 / 32 + 45 * E6 / 1024) * Math.sin(2 * phi)
    + (15 * E4 / 256 + 45 * E6 / 1024) * Math.sin(4 * phi)
    - (35 * E6 / 3072) * Math.sin(6 * phi)
  )

  const easting = E0 + K0 * N * (
    A
    + (1 - T + C) * Math.pow(A, 3) / 6
    + (5 - 18 * T + T * T + 72 * C - 58 * EP2) * Math.pow(A, 5) / 120
  )

  const northing = N0 + K0 * (
    M
    + N * tanPhi * (
      A * A / 2
      + (5 - T + 9 * C + 4 * C * C) * Math.pow(A, 4) / 24
      + (61 - 58 * T + T * T + 600 * C - 330 * EP2) * Math.pow(A, 6) / 720
    )
  )

  return {
    northing: Math.round(northing),
    easting:  Math.round(easting),
  }
}
