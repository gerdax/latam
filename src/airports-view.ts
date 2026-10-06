import * as T from "three";
import { airportConfig, getAirport } from "./airports";

/** Fixed-size pool: airports use the same absolute coordinates as terrain and physics. */
export class AirportsView {
  readonly group = new T.Group();
  private socks: T.Group[] = [];
  constructor() {
    const asphalt = new T.MeshStandardMaterial({
      color: 0x777878,
      roughness: 1,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const cream = new T.MeshStandardMaterial({ color: 0xffeed0, roughness: 1 });
    const red = new T.MeshStandardMaterial({ color: 0xbb6150, roughness: 1 });
    for (let i = 0; i < 3; i++) {
      const airport = new T.Group();
      this.group.add(airport);
      const runway = new T.Mesh(
        new T.BoxGeometry(airportConfig.length, 0.06, airportConfig.width),
        asphalt,
      );
      runway.position.set(airportConfig.length / 2, -0.03, 0);
      airport.add(runway);
      for (let x = 4; x < airportConfig.length - 3; x += 6) {
        const dash = new T.Mesh(new T.BoxGeometry(2, 0.015, 0.12), cream);
        dash.position.set(x, 0.025, 0);
        airport.add(dash);
      }
      for (const x of [1, airportConfig.length - 1])
        for (let z = -2.5; z <= 2.5; z += 1) {
          const stripe = new T.Mesh(new T.BoxGeometry(0.9, 0.015, 0.5), cream);
          stripe.position.set(x, 0.025, z);
          airport.add(stripe);
        }
      const hangar = new T.Mesh(new T.BoxGeometry(3, 1.8, 2), cream);
      hangar.position.set(airportConfig.length * 0.55, 0.9, -5);
      airport.add(hangar);
      const roof = new T.Mesh(new T.CylinderGeometry(1.6, 1.6, 3.2, 3), red);
      roof.rotation.z = Math.PI / 2;
      roof.position.set(airportConfig.length * 0.55, 1.7, -5);
      roof.scale.z = 0.8;
      airport.add(roof);
      const door = new T.Mesh(new T.BoxGeometry(2.2, 1.4, 0.02), asphalt);
      door.position.set(airportConfig.length * 0.55, 0.7, -3.99);
      airport.add(door);
      const pole = new T.Mesh(
        new T.CylinderGeometry(0.035, 0.045, 2.5, 6),
        cream,
      );
      pole.position.set(6, 1.25, -4);
      airport.add(pole);
      const sock = new T.Group();
      sock.position.set(6, 2.5, -4);
      airport.add(sock);
      this.socks.push(sock);
      for (let j = 0; j < 5; j++) {
        const tube = new T.Mesh(
          new T.CylinderGeometry(
            0.17 - j * 0.022,
            0.19 - j * 0.022,
            0.24,
            8,
            1,
            true,
          ),
          j % 2 ? cream : red,
        );
        tube.rotation.z = Math.PI / 2;
        tube.position.set(-j * 0.23, -j * 0.04, 0);
        sock.add(tube);
      }
      for (let x = 0; x <= airportConfig.length; x += 8)
        for (const z of [-3.6, 3.6]) {
          const light = new T.Mesh(new T.SphereGeometry(0.065, 6, 4), cream);
          light.position.set(x, 0.12, z);
          airport.add(light);
        }
    }
  }
  update(distance: number, time: number) {
    const current = Math.max(
      0,
      Math.floor((distance - airportConfig.first) / airportConfig.spacing),
    );
    this.group.children.forEach((group, i) => {
      const id = Math.max(0, current - 1) + i,
        airport = getAirport(id);
      group.position.set(airport.start - distance, airport.elevation, 0);
      this.socks[i].rotation.y = Math.sin(time * 0.8 + i) * 0.15;
      this.socks[i].rotation.z = Math.sin(time * 2 + i) * 0.035;
    });
  }
}
