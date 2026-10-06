import * as T from "three";
import { scenery } from "./terrain";

/** Five altitude bands, recycled with deterministic world positions on descent. */
export class CloudField {
  readonly group = new T.Group();
  private readonly slots: T.Group[] = [];
  constructor() {
    const material = new T.MeshStandardMaterial({
      color: scenery.cloud,
      roughness: 1,
    });
    const geometry = new T.SphereGeometry(1, 12, 8);
    for (let band = 0; band < 5; band++)
      for (let column = 0; column < 5; column++) {
        const cloud = new T.Group();
        for (let j = 0; j < 7; j++) {
          const puff = new T.Mesh(geometry, material);
          puff.position.set(
            (j - 3) * 0.9,
            Math.sin(j * 2.3 + column) * 0.25,
            Math.cos(j) * 0.15,
          );
          puff.scale.set(1.1, 0.55 + Math.sin(j + 2) * 0.15, 0.6);
          cloud.add(puff);
        }
        cloud.scale.setScalar(0.6 + (column % 3) * 0.25);
        this.slots.push(cloud);
        this.group.add(cloud);
      }
  }
  update(distance: number, cameraCenter: number) {
    const first = Math.max(0, Math.floor((cameraCenter - 20) / 9));
    this.slots.forEach((cloud, i) => {
      const band = first + Math.floor(i / 5),
        column = i % 5,
        z = -12 - (column % 3) * 14;
      const speed = 0.08 + (column % 3) * 0.04;
      const offset = column * 18 + Math.sin(band * 4.17) * 9;
      const x = ((((offset - distance * speed + 45) % 90) + 90) % 90) - 45;
      cloud.position.set(
        x,
        12 + band * 9 + Math.sin(band * 2 + column) * 1.2,
        z,
      );
    });
  }
}
