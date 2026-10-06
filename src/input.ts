export class FlightInput {
  private pointerId: number | null = null;
  private anchorY = 0;
  private dragValue = 0;
  private up = false;
  private down = false;
  private readonly previousTouchAction: string;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly onGesture: () => void,
  ) {
    this.previousTouchAction = canvas.style.touchAction;
    canvas.style.touchAction = "none";
    canvas.addEventListener("pointerdown", this.pointerDown);
    canvas.addEventListener("pointermove", this.pointerMove);
    canvas.addEventListener("pointerup", this.pointerEnd);
    canvas.addEventListener("pointercancel", this.pointerEnd);
    canvas.addEventListener("lostpointercapture", this.pointerEnd);
    window.addEventListener("keydown", this.keyDown);
    window.addEventListener("keyup", this.keyUp);
    window.addEventListener("blur", this.reset);
  }

  get value(): number {
    if (this.up || this.down) return Number(this.up) - Number(this.down);
    return this.dragValue;
  }

  reset = (): void => {
    const pointer = this.pointerId;
    this.pointerId = null;
    this.dragValue = 0;
    this.up = false;
    this.down = false;
    if (pointer !== null && this.canvas.hasPointerCapture(pointer))
      this.canvas.releasePointerCapture(pointer);
  };

  dispose(): void {
    this.reset();
    this.canvas.style.touchAction = this.previousTouchAction;
    this.canvas.removeEventListener("pointerdown", this.pointerDown);
    this.canvas.removeEventListener("pointermove", this.pointerMove);
    this.canvas.removeEventListener("pointerup", this.pointerEnd);
    this.canvas.removeEventListener("pointercancel", this.pointerEnd);
    this.canvas.removeEventListener("lostpointercapture", this.pointerEnd);
    window.removeEventListener("keydown", this.keyDown);
    window.removeEventListener("keyup", this.keyUp);
    window.removeEventListener("blur", this.reset);
  }

  private pointerDown = (event: PointerEvent): void => {
    if (
      this.pointerId !== null ||
      (event.pointerType === "mouse" && event.button !== 0)
    )
      return;
    this.onGesture();
    this.pointerId = event.pointerId;
    this.anchorY = event.clientY;
    this.dragValue = 0;
    this.canvas.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  private pointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.pointerId) return;
    const travel = Math.max(60, Math.min(140, this.canvas.clientHeight * 0.18));
    this.dragValue = Math.max(
      -1,
      Math.min(1, (this.anchorY - event.clientY) / travel),
    );
    event.preventDefault();
  };

  private pointerEnd = (event: PointerEvent): void => {
    if (event.pointerId !== this.pointerId) return;
    this.pointerId = null;
    this.dragValue = 0;
    if (this.canvas.hasPointerCapture(event.pointerId))
      this.canvas.releasePointerCapture(event.pointerId);
  };

  private keyDown = (event: KeyboardEvent): void => {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    const target = event.target;
    if (
      target instanceof HTMLElement &&
      (target.isContentEditable ||
        /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
    )
      return;
    this.onGesture();
    if (event.key === "ArrowUp") this.up = true;
    else this.down = true;
    event.preventDefault();
  };

  private keyUp = (event: KeyboardEvent): void => {
    if (event.key === "ArrowUp") this.up = false;
    else if (event.key === "ArrowDown") this.down = false;
    else return;
    event.preventDefault();
  };
}
