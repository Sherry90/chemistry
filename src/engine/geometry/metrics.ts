import type { Atom } from '@/chemistry/compounds/types';

export function bondLength(a: Atom, b: Atom): number {
  const dx = b.position.x - a.position.x;
  const dy = b.position.y - a.position.y;
  const dz = b.position.z - a.position.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function bondAngle(a: Atom, b: Atom, c: Atom): number {
  const bax = a.position.x - b.position.x;
  const bay = a.position.y - b.position.y;
  const baz = a.position.z - b.position.z;
  const bcx = c.position.x - b.position.x;
  const bcy = c.position.y - b.position.y;
  const bcz = c.position.z - b.position.z;

  const dot = bax * bcx + bay * bcy + baz * bcz;
  const magA = Math.sqrt(bax * bax + bay * bay + baz * baz);
  const magC = Math.sqrt(bcx * bcx + bcy * bcy + bcz * bcz);

  if (magA === 0 || magC === 0) return 0;
  return Math.acos(Math.max(-1, Math.min(1, dot / (magA * magC))));
}

export function dihedral(a: Atom, b: Atom, c: Atom, d: Atom): number {
  const b1x = b.position.x - a.position.x;
  const b1y = b.position.y - a.position.y;
  const b1z = b.position.z - a.position.z;

  const b2x = c.position.x - b.position.x;
  const b2y = c.position.y - b.position.y;
  const b2z = c.position.z - b.position.z;

  const b3x = d.position.x - c.position.x;
  const b3y = d.position.y - c.position.y;
  const b3z = d.position.z - c.position.z;

  const n1x = b1y * b2z - b1z * b2y;
  const n1y = b1z * b2x - b1x * b2z;
  const n1z = b1x * b2y - b1y * b2x;

  const n2x = b2y * b3z - b2z * b3y;
  const n2y = b2z * b3x - b2x * b3z;
  const n2z = b2x * b3y - b2y * b3x;

  const mx = n1y * b2z - n1z * b2y;
  const my = n1z * b2x - n1x * b2z;
  const mz = n1x * b2y - n1y * b2x;

  const n1Mag = Math.sqrt(n1x * n1x + n1y * n1y + n1z * n1z);
  const n2Mag = Math.sqrt(n2x * n2x + n2y * n2y + n2z * n2z);
  const b2Mag = Math.sqrt(b2x * b2x + b2y * b2y + b2z * b2z);

  if (n1Mag === 0 || n2Mag === 0 || b2Mag === 0) return 0;

  const x = (n1x * n2x + n1y * n2y + n1z * n2z) / (n1Mag * n2Mag);
  const y = (mx * n2x + my * n2y + mz * n2z) / (n1Mag * n2Mag * b2Mag);

  return Math.atan2(y, x);
}
