/** A quiet, continuous propeller tone. Audio starts only after a user gesture. */
export class EngineAudio {
  private context: AudioContext | null = null;
  private engine: OscillatorNode | null = null;
  private propeller: OscillatorNode | null = null;
  private volume: GainNode | null = null;
  private paused = false;
  private crashed = false;
  private input = 0;
  private grounded = false;
  private speed = 7;

  unlock(): void {
    try {
      if (!this.context) {
        const AudioContextClass =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (!AudioContextClass) return;
        const context = new AudioContextClass();
        this.context = context;
        const volume = context.createGain();
        volume.gain.value = 0;
        volume.connect(context.destination);
        this.volume = volume;
        const engine = context.createOscillator();
        engine.type = "triangle";
        engine.frequency.value = 72;
        const engineLevel = context.createGain();
        engineLevel.gain.value = 0.65;
        engine.connect(engineLevel).connect(volume);
        engine.start();
        this.engine = engine;
        const propeller = context.createOscillator();
        propeller.type = "sine";
        propeller.frequency.value = 144;
        const propellerLevel = context.createGain();
        propellerLevel.gain.value = 0.25;
        propeller.connect(propellerLevel).connect(volume);
        propeller.start();
        this.propeller = propeller;
      }
      if (this.context.state === "suspended")
        void this.context.resume().catch(() => {});
      this.apply();
    } catch {
      // Browsers without usable audio still retain all flight controls.
    }
  }

  update(input: number, crashed: boolean, grounded = false, speed = 7): void {
    this.input = Number.isFinite(input) ? Math.max(-1, Math.min(1, input)) : 0;
    this.crashed = crashed;
    this.grounded = grounded;
    this.speed = speed;
    this.apply();
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    this.apply();
  }

  dispose(): void {
    this.engine?.stop();
    this.propeller?.stop();
    if (this.context) void this.context.close().catch(() => {});
    this.context = null;
    this.engine = null;
    this.propeller = null;
    this.volume = null;
  }

  private apply(): void {
    if (!this.context || !this.volume || !this.engine || !this.propeller)
      return;
    const now = this.context.currentTime;
    const frequency = this.grounded
      ? 40 + Math.min(7, this.speed) * 4 + Math.max(0, this.input) * 20
      : 72 + this.input * 18;
    this.engine.frequency.setTargetAtTime(frequency, now, 0.16);
    this.propeller.frequency.setTargetAtTime(frequency * 2.03, now, 0.16);
    const level =
      this.paused || this.crashed ? 0 : 0.045 + Math.max(0, this.input) * 0.012;
    this.volume.gain.setTargetAtTime(level, now, 0.12);
  }
}
