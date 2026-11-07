import * as THREE from 'three';

/** World layout (1 unit ≈ 1 m). Water surface at y = 0. */
export const WATER_RADIUS = 9;
export const DECK_INNER = 8.7;
export const DECK_OUTER = 12.9;
export const DECK_Y = 0.42;
export const SEAT_RADIUS = 11.0;
export const STOOL_HEIGHT = 0.36;
export const RAIL_RADIUS = 12.6;
/** Entrance walkways (radians). Avoids the front/back center. */
export const ENTRANCE_ANGLES = [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75];

/** Seat 0 is front-center (+Z, toward the camera); seats go counter-clockwise seen from above. */
export function seatAngle(seat: number, maxSeats: number): number {
  return Math.PI / 2 + (seat / Math.max(1, maxSeats)) * Math.PI * 2;
}

export function seatPosition(seat: number, maxSeats: number, radius = SEAT_RADIUS, out = new THREE.Vector3()): THREE.Vector3 {
  const a = seatAngle(seat, maxSeats);
  return out.set(Math.cos(a) * radius, DECK_Y, Math.sin(a) * radius);
}

export function angleDistance(a: number, b: number): number {
  const d = Math.abs(((a - b) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  return Math.min(d, Math.PI * 2 - d);
}
