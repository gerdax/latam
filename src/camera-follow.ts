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

/** A small camera lag shows acceleration without changing any world positions. */
export class HorizontalCameraLag {
  readonly maxFrameFraction = 0.04;
  readonly response = 2.5;
  readonly velocityScale = 1.8;
  private previousSpeed: number | null = null;
  private followingSpeed = 0;
  fraction = 0;

  reset(): void {
    this.previousSpeed = null;
    this.followingSpeed = 0;
    this.fraction = 0;
  }

  update(horizontalSpeed: number, dt: number): number {
    if (!Number.isFinite(horizontalSpeed)) return this.fraction;
    if (this.previousSpeed === null) {
      this.previousSpeed = this.followingSpeed = horizontalSpeed;
      return this.fraction;
    }
    if (!Number.isFinite(dt) || dt <= 0) return this.fraction;
    // Exact first-order integration for a velocity changing linearly this frame.
    const slope = (horizontalSpeed - this.previousSpeed) / dt;
    const lag = slope / this.response;
    const decay = Math.exp(-this.response * dt);
    this.followingSpeed = horizontalSpeed - lag +
      (this.followingSpeed - this.previousSpeed + lag) * decay;
    this.previousSpeed = horizontalSpeed;
    this.fraction = this.maxFrameFraction *
      Math.tanh((horizontalSpeed - this.followingSpeed) / this.velocityScale);
    return this.fraction;
  }
}
