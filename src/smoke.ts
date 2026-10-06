import * as T from "three";
import { terrainHeight } from "./terrain";

interface Puff {
  sprite: T.Sprite;
  position: T.Vector3;
  velocity: T.Vector3;
  age: number;
  lifetime: number;
  size: number;
}

/** World-space smoke, pooled so repeated crashes never accumulate GPU resources. */
export class CrashSmoke {
  readonly group = new T.Group();
  private readonly puffs: Puff[] = [];
  private crashed = false;
  private emission = 0;
  private cursor = 0;
  constructor() {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    const context = canvas.getContext("2d")!;
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.4, "rgba(255,255,255,.8)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);
    const texture = new T.CanvasTexture(canvas);
    for (let i = 0; i < 96; i++) {
      const sprite = new T.Sprite(
        new T.SpriteMaterial({
          map: texture,
          color: 0x615b62,
          transparent: true,
          opacity: 0,
          depthWrite: false,
        }),
      );
      sprite.visible = false;
      this.group.add(sprite);
      this.puffs.push({
        sprite,
        position: new T.Vector3(),
        velocity: new T.Vector3(),
        age: Infinity,
        lifetime: 2.8,
        size: 0.2,
      });
    }
  }
  private spawn(source: T.Vector3, burst: boolean) {
    const puff = this.puffs[this.cursor];
    this.cursor = (this.cursor + 1) % this.puffs.length;
    const angle = Math.random() * Math.PI * 2;
    puff.position.copy(source);
    puff.position.y = Math.max(
      source.y,
      terrainHeight(source.x, source.z) + 0.08,
    );
    puff.position.x += (Math.random() - 0.5) * 0.18;
    puff.position.z += (Math.random() - 0.5) * 0.2;
    puff.velocity.set(
      burst ? Math.cos(angle) * 1.6 : -0.35 + (Math.random() - 0.5) * 0.4,
      burst ? 0.8 + Math.random() * 1.2 : 0.7 + Math.random() * 0.5,
      Math.sin(angle) * (burst ? 0.65 : 0.15),
    );
    puff.age = 0;
    puff.lifetime = 2.2 + Math.random() * 0.8;
    puff.size = (burst ? 0.22 : 0.16) + Math.random() * 0.12;
    puff.sprite.material.rotation = Math.random() * Math.PI;
    puff.sprite.visible = true;
  }
  update(dt: number, crashed: boolean, distance: number, source: T.Vector3) {
    if (!crashed) {
      if (this.crashed)
        for (const puff of this.puffs) {
          puff.sprite.visible = false;
          puff.age = Infinity;
        }
      this.crashed = false;
      this.emission = 0;
      return;
    }
    if (!this.crashed) {
      this.crashed = true;
      for (let i = 0; i < 20; i++) this.spawn(source, true);
    }
    this.emission += dt * 22;
    while (this.emission >= 1) {
      this.spawn(source, false);
      this.emission--;
    }
    for (const puff of this.puffs) {
      if (!puff.sprite.visible) continue;
      puff.age += dt;
      if (puff.age >= puff.lifetime) {
        puff.sprite.visible = false;
        continue;
      }
      puff.position.addScaledVector(puff.velocity, dt);
      puff.velocity.x *= Math.exp(-dt * 0.8);
      puff.velocity.y += dt * 0.15;
      puff.sprite.position.copy(puff.position);
      puff.sprite.position.x -= distance;
      const fraction = puff.age / puff.lifetime;
      puff.sprite.scale.setScalar(puff.size + puff.age * 0.62);
      puff.sprite.material.opacity = 0.78 * (1 - fraction) ** 1.5;
      puff.sprite.material.color.setRGB(
        0.055 + fraction * 0.12,
        0.052 + fraction * 0.11,
        0.06 + fraction * 0.13,
      );
    }
  }
}
