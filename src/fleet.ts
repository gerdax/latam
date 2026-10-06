import * as T from "three";
import { ConvexHull } from "three/addons/math/ConvexHull.js";
import { createCessna, type Aircraft } from "./aircraft";
import { createParkedAircraft } from "./parked-aircraft";

export type AircraftKind = "cessna" | "transport" | "passenger" | "military";

export const aircraftOptions: ReadonlyArray<
  Readonly<{ id: AircraftKind; label: string }>
> = Object.freeze([
  Object.freeze({ id: "cessna", label: "Cessna" }),
  Object.freeze({ id: "transport", label: "Samolot transportowy" }),
  Object.freeze({ id: "passenger", label: "Samolot pasażerski" }),
  Object.freeze({ id: "military", label: "Samolot wojskowy" }),
]);

type Point = Readonly<{ x: number; y: number; z: number }>;
const freezePoints = (points: T.Vector3[]): ReadonlyArray<Point> =>
  Object.freeze(points.map(({ x, y, z }) => Object.freeze({ x, y, z })));

/** Keep the exact support envelope while dropping interior geometry vertices. */
function hullVertices(points: T.Vector3[]): T.Vector3[] {
  const hull = new ConvexHull().setFromPoints(points);
  const boundary = new Set<T.Vector3>();
  for (const face of hull.faces) {
    let edge = face.edge;
    do {
      boundary.add(edge.head().point);
      edge = edge.next;
    } while (edge !== face.edge);
  }
  return [...boundary];
}

/** Reuse the airport silhouettes, centered on the fuselage for flight physics. */
export function createAircraft(kind: AircraftKind): Aircraft {
  if (kind === "cessna") return createCessna();
  const group = new T.Group();
  const model = createParkedAircraft(kind);
  const modelScale = { transport: 0.5, passenger: 0.48, military: 0.65 }[kind];
  model.scale.setScalar(modelScale);
  model.position.y = -(kind === "military" ? 0.55 : 0.9) * modelScale;
  group.add(model);
  group.userData.kind = kind;
  group.updateMatrixWorld(true);

  const wheels: T.Mesh[] = [];
  const propellers: T.Group[] = [];
  const bodyVertices: T.Vector3[] = [];
  const allVertices: T.Vector3[] = [];
  const wheelContacts: T.Vector3[] = [];
  model.traverse((object) => {
    if (object instanceof T.Group && object.userData.part === "propeller") {
      propellers.push(object);
    }
    if (!(object instanceof T.Mesh)) return;
    const vertices: T.Vector3[] = [];
    const positions = object.geometry.getAttribute("position");
    for (let i = 0; i < positions.count; i++) {
      vertices.push(
        new T.Vector3()
          .fromBufferAttribute(positions, i)
          .applyMatrix4(object.matrixWorld),
      );
    }
    allVertices.push(...vertices);
    if (object.userData.part === "wheel") {
      wheels.push(object);
      const bounds = new T.Box3().setFromPoints(vertices);
      // Four support corners per tire; all wheel samples precede body samples.
      for (const x of [bounds.min.x, bounds.max.x]) {
        for (const z of [bounds.min.z, bounds.max.z]) {
          wheelContacts.push(new T.Vector3(x, bounds.min.y, z));
        }
      }
    } else {
      bodyVertices.push(...vertices);
    }
  });
  // Include the blades' full rotation sweep, derived from their visible vertices.
  for (const rotor of propellers) {
    let radius = 0;
    let halfDepth = 0;
    rotor.traverse((object) => {
      if (!(object instanceof T.Mesh)) return;
      const positions = object.geometry.getAttribute("position");
      for (let i = 0; i < positions.count; i++) {
        const vertex = new T.Vector3()
          .fromBufferAttribute(positions, i)
          .applyMatrix4(object.matrix);
        radius = Math.max(radius, Math.hypot(vertex.y, vertex.z));
        halfDepth = Math.max(halfDepth, Math.abs(vertex.x));
      }
    });
    // A circumscribed 32-gon covers angles between its sampled vertices too.
    radius /= Math.cos(Math.PI / 32);
    for (const x of [-halfDepth, halfDepth]) {
      for (let i = 0; i < 32; i++) {
        const angle = (i * Math.PI) / 16;
        const vertex = new T.Vector3(
          x,
          radius * Math.cos(angle),
          radius * Math.sin(angle),
        ).applyMatrix4(rotor.matrixWorld);
        bodyVertices.push(vertex);
        allVertices.push(vertex);
      }
    }
  }
  const propeller = new T.Group();
  group.add(propeller);
  return {
    group,
    propeller,
    propellers,
    wheels,
    scale: 1,
    groundClearance: -Math.min(...wheelContacts.map((point) => point.y)),
    wheelContactCount: wheelContacts.length,
    contactPoints: freezePoints([
      ...wheelContacts,
      ...hullVertices(bodyVertices),
    ]),
    crashContactPoints: freezePoints(hullVertices(allVertices)),
  };
}
