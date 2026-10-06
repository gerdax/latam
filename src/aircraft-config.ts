export const cessnaScale = 2 / 3;
export const cessnaGroundClearance = 0.79 * cessnaScale;

export const cessnaContacts = Object.freeze(
  [
    // Main wheels, nose wheel, fuselage belly and tail cone.
    ...[-0.55, -0.25].flatMap((x) =>
      [-0.56, 0.56].map((z) => ({ x, y: -0.79, z })),
    ),
    ...[0.88, 1.12].flatMap((x) =>
      [-0.065, 0.065].map((z) => ({ x, y: -0.72, z })),
    ),
    ...[-1.15, 0, 1.15].map((x) => ({ x, y: -0.34, z: 0 })),
    { x: -1.92, y: -0.29, z: 0 },
    // Tailplane and wing corners include their full span for uneven ground.
    ...[-1.825, -1.275].flatMap((x) =>
      [-0.725, 0.725].map((z) => ({ x, y: 0.0875, z })),
    ),
    ...[-0.29, 0.375].flatMap((x) =>
      [-1.91, 1.91].map((z) => ({ x, y: 0.6025, z })),
    ),
    // Propeller sweep is part of the rendered nose envelope.
    { x: 1.603, y: -0.68, z: 0 },
    { x: 1.603, y: 0.68, z: 0 },
    { x: 1.603, y: 0, z: -0.68 },
    { x: 1.603, y: 0, z: 0.68 },
  ].map((point) =>
    Object.freeze({
      x: point.x * cessnaScale,
      y: point.y * cessnaScale,
      z: point.z * cessnaScale,
    }),
  ),
);

/** Additional upper surfaces keep the wreck supported when it rolls upside down. */
export const cessnaCrashContacts = Object.freeze([
  ...cessnaContacts,
  ...[
    // Match all vertices of the visible 32-sided propeller sweep under any roll.
    ...Array.from({ length: 32 }, (_, i) => ({
      x: 1.603,
      y: 0.68 * Math.cos((i * Math.PI) / 16),
      z: 0.68 * Math.sin((i * Math.PI) / 16),
    })),
    // The tail cone has eight base vertices, including its diagonal support.
    ...Array.from({ length: 8 }, (_, i) => ({
      x: -1.92,
      y: 0.01 + 0.3 * Math.cos((i * Math.PI) / 4),
      z: 0.3 * Math.sin((i * Math.PI) / 4),
    })),
    ...[-0.29, 0.375].flatMap((x) =>
      [-1.91, 1.91].map((z) => ({ x, y: 0.7, z })),
    ),
    { x: -1.85, y: 0.7, z: 0 },
    { x: -1.35, y: 0.82, z: 0 },
    { x: 0.2, y: 0.65, z: 0 },
    { x: 0.2, y: 0.28, z: 0.36 },
    { x: 0.2, y: 0.28, z: -0.36 },
    { x: -1.4, y: 0.2, z: 0.725 },
    { x: -1.4, y: 0.2, z: -0.725 },
    { x: 0, y: 0.34, z: 0 },
    { x: 0, y: 0, z: 0.34 },
    { x: 0, y: 0, z: -0.34 },
  ].map((point) =>
    Object.freeze({
      x: point.x * cessnaScale,
      y: point.y * cessnaScale,
      z: point.z * cessnaScale,
    }),
  ),
]);
