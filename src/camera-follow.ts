export function viewportWorldHeight(aspect: number): number {
  return aspect < 1 ? 24 : 20;
}

/** Keep the ground composition, then follow altitude without changing camera angle. */
export class AltitudeCamera {
  center = 7;
  readonly response = 6;
  update(altitude: number, dt: number): number {
    if (!Number.isFinite(dt) || dt <= 0) return this.center;
    const target = Math.max(7, altitude - 2);
    this.center += (target - this.center) * (1 - Math.exp(-this.response * dt));
    return this.center;
  }
}
