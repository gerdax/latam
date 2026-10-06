import * as T from "three";
import { airportTerrain, nearbyAirport } from "./airports";

export const scenery = {
  sky: 0xdfb8ce,
  cloud: 0xffdbad,
  layers: [
    { z: -30, speed: 0.18, color: 0x97ae8b, base: 1.8, amplitude: 2.2 },
    { z: -16, speed: 0.4, color: 0x82a877, base: 0.4, amplitude: 1.9 },
    { z: 0, speed: 1, color: 0x90ad68, base: -0.2, amplitude: 1.35 },
  ],
};
export function terrainHeight(x: number, z = 0): number {
  return airportTerrain(
    x,
    z,
    -0.2 +
      Math.sin(x * 0.105) * 1.0 +
      Math.sin(x * 0.23 + 0.8) * 0.35 +
      Math.sin(z * 0.24) * 0.45,
  );
}
export function layerHeight(x: number, z: number, layer = 2): number {
  if (layer === 2) return terrainHeight(x, z);
  const l = scenery.layers[layer];
  return (
    l.base +
    Math.sin(x * 0.085 + layer * 2) * l.amplitude +
    Math.sin(x * 0.2 + layer) * 0.45 +
    Math.sin(z * 0.2) * 0.3
  );
}
const WIDTH = 16,
  COUNT = 8,
  NX = 24,
  NZ = 8,
  DEPTH = 15;
export class Landscape {
  readonly group = new T.Group();
  private strips: {
    mesh: T.Mesh<T.BufferGeometry, T.MeshStandardMaterial>;
    index: number;
    layer: number;
    props: T.Group;
    skirt: T.Mesh<T.BufferGeometry, T.MeshStandardMaterial>;
  }[] = [];
  constructor() {
    scenery.layers.forEach((l, layer) => {
      for (let i = 0; i < COUNT; i++) {
        const g = new T.BufferGeometry(),
          positions = new Float32Array((NX + 1) * (NZ + 1) * 3),
          indices: number[] = [];
        for (let a = 0; a < NX; a++)
          for (let b = 0; b < NZ; b++) {
            const k = a * (NZ + 1) + b;
            indices.push(k, k + 1, k + NZ + 1, k + 1, k + NZ + 2, k + NZ + 1);
          }
        g.setAttribute("position", new T.BufferAttribute(positions, 3));
        g.setIndex(indices);
        const mesh = new T.Mesh(
          g,
          new T.MeshStandardMaterial({
            color: l.color,
            roughness: 1,
            flatShading: false,
          }),
        );
        mesh.receiveShadow = true;
        const props = new T.Group();
        mesh.add(props);
        const skirtGeometry = new T.BufferGeometry();
        skirtGeometry.setAttribute(
          "position",
          new T.BufferAttribute(new Float32Array((NX + 1) * 2 * 3), 3),
        );
        const skirtIndices: number[] = [];
        for (let a = 0; a < NX; a++) {
          const k = a * 2;
          skirtIndices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
        }
        skirtGeometry.setIndex(skirtIndices);
        const skirt = new T.Mesh(
          skirtGeometry,
          new T.MeshStandardMaterial({
            color: l.color,
            roughness: 1,
            side: T.DoubleSide,
          }),
        );
        mesh.add(skirt);
        if (layer === 2) {
          for (let t = 0; t < 4; t++) {
            const tree = new T.Group();
            const trunk = new T.Mesh(
              new T.CylinderGeometry(0.06, 0.09, 0.65, 6),
              new T.MeshStandardMaterial({ color: 0x8c7259 }),
            );
            trunk.position.y = 0.3;
            tree.add(trunk);
            const crown = new T.Mesh(
              new T.IcosahedronGeometry(0.48, 1),
              new T.MeshStandardMaterial({
                color: t % 2 ? 0x739454 : 0x608650,
                flatShading: true,
              }),
            );
            crown.position.y = 0.95;
            crown.scale.set(0.8, 1.25, 0.8);
            tree.add(crown);
            props.add(tree);
          }
        }
        this.group.add(mesh);
        this.strips.push({ mesh, index: -999, layer, props, skirt });
      }
    });
  }
  update(distance: number) {
    for (let layer = 0; layer < 3; layer++) {
      const l = scenery.layers[layer],
        offset = distance * l.speed,
        first = Math.floor((offset - (COUNT * WIDTH) / 2) / WIDTH);
      const strips = this.strips.filter((s) => s.layer === layer);
      for (let i = 0; i < COUNT; i++) {
        const s = strips[i],
          index = first + i;
        if (s.index !== index) {
          s.index = index;
          const p = s.mesh.geometry.getAttribute(
            "position",
          ) as T.BufferAttribute;
          for (let a = 0; a <= NX; a++)
            for (let b = 0; b <= NZ; b++) {
              const x = (a / NX) * WIDTH,
                z = (b / NZ) * DEPTH - DEPTH / 2;
              p.setXYZ(
                a * (NZ + 1) + b,
                x,
                layerHeight(index * WIDTH + x, z, layer),
                z,
              );
            }
          const sp = s.skirt.geometry.getAttribute(
            "position",
          ) as T.BufferAttribute;
          for (let a = 0; a <= NX; a++) {
            const x = (a / NX) * WIDTH;
            sp.setXYZ(
              a * 2,
              x,
              layerHeight(index * WIDTH + x, DEPTH / 2, layer),
              DEPTH / 2,
            );
            sp.setXYZ(a * 2 + 1, x, -24, DEPTH / 2);
          }
          sp.needsUpdate = true;
          s.skirt.geometry.computeVertexNormals();
          s.skirt.geometry.computeBoundingSphere();
          s.props.children.forEach((tree, t) => {
            const x = 2 + t * 3.7,
              z = 2 + Math.sin(index * 2 + t) * 2;
            tree.position.set(x, layerHeight(index * WIDTH + x, z, layer), z);
            tree.visible = !nearbyAirport(index * WIDTH + x);
          });
          p.needsUpdate = true;
          s.mesh.geometry.computeVertexNormals();
          const normals = s.mesh.geometry.getAttribute(
            "normal",
          ) as T.BufferAttribute;
          for (let a = 0; a <= NX; a++)
            for (let b = 0; b <= NZ; b++) {
              const x = index * WIDTH + (a / NX) * WIDTH,
                z = (b / NZ) * DEPTH - DEPTH / 2,
                e = 0.05;
              const n = new T.Vector3(
                -(layerHeight(x + e, z, layer) - layerHeight(x - e, z, layer)) /
                  (2 * e),
                1,
                -(layerHeight(x, z + e, layer) - layerHeight(x, z - e, layer)) /
                  (2 * e),
              ).normalize();
              normals.setXYZ(a * (NZ + 1) + b, n.x, n.y, n.z);
            }
          normals.needsUpdate = true;
          s.mesh.geometry.computeBoundingSphere();
        }
        s.mesh.position.set(index * WIDTH - offset, 0, l.z);
      }
    }
  }
}
