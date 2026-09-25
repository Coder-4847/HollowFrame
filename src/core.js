export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const damp = (a, b, s, dt) => a + (b - a) * (1 - Math.exp(-s * dt));
export function damageFor(weapon, part, armor, distance = 0) {
  const falloff = 1 - clamp((distance - weapon.range * 0.55) / (weapon.range * 0.7), 0, 0.65);
  const weak = part === 'sensor';
  const reduction = armor > 0 && !weak ? 0.7 * (1 - weapon.penetration) : 0;
  return weapon.damage * falloff * (weak ? weapon.weak : 1) * (1 - reduction);
}
export function overlaps(x, z, r, b) {
  return (
    x + r > b.x - b.w / 2 && x - r < b.x + b.w / 2 && z + r > b.z - b.d / 2 && z - r < b.z + b.d / 2
  );
}
export function moveBody(pos, dx, dz, r, height, boxes, step = 0.45, bounds = 35) {
  const blocks = (x, z) =>
    boxes.some(
      (b) => b.top > pos.y + step && b.bottom < pos.y + height - 0.1 && overlaps(x, z, r, b),
    );
  if (!blocks(pos.x + dx, pos.z)) pos.x += dx;
  if (!blocks(pos.x, pos.z + dz)) pos.z += dz;
  pos.x = clamp(pos.x, -bounds + r, bounds - r);
  pos.z = clamp(pos.z, -bounds + r, bounds - r);
}
export function floorAt(pos, r, boxes, step = 0.45, base = 0) {
  let h = base;
  for (const b of boxes)
    if (b.top <= pos.y + step && overlaps(pos.x, pos.z, r, b)) h = Math.max(h, b.top);
  return h;
}
export function readSave(storage) {
  try {
    storage ??= globalThis.localStorage;
    const s = JSON.parse(storage.getItem('hollowframe-v1') || '{}');
    return s && typeof s === 'object' && !Array.isArray(s) ? s : {};
  } catch {
    return {};
  }
}
export function saveData(value, storage) {
  try {
    storage ??= globalThis.localStorage;
    storage.setItem('hollowframe-v1', JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
