/** Small rigid-body contact solver. Translation stays in the X/Y flight lane. */
export interface Vec3 {
    x: number;
    y: number;
    z: number;
}
export interface Quaternion extends Vec3 {
    w: number;
}
export interface CrashMaterial {
    restitution: number;
    linearDrag: number;
    angularDrag: number;
    gravity: number;
    friction: number;
    restThreshold: number;
}
export const defaultCrashMaterial: Readonly<CrashMaterial> = Object.freeze({
    restitution: 0.5,
    linearDrag: 1.4,
    angularDrag: 2,
    gravity: 9.8,
    friction: 0.55,
    restThreshold: 0.8,
});
export interface CrashBody {
    orientation: Quaternion;
    /** Angular velocity in world axes, radians/second. */
    angularVelocity: Vec3;
    /** Mass-one box moments in body axes, calculated once on entry. */
    inertia: Vec3;
    contacts: ReadonlyArray<Readonly<Vec3>>;
}
export interface CrashMotion {
    distance: number;
    altitude: number;
    horizontalSpeed: number;
    velocity: number;
}
export type CrashTerrain = (x: number, z?: number) => number;
const add = (a: Vec3, b: Vec3): Vec3 => ({
    x: a.x + b.x,
    y: a.y + b.y,
    z: a.z + b.z,
});
const scale = (a: Vec3, s: number): Vec3 => ({
    x: a.x * s,
    y: a.y * s,
    z: a.z * s,
});
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: Vec3, b: Vec3): Vec3 => ({
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
});
export function rotateCrashPoint(q: Quaternion, p: Readonly<Vec3>): Vec3 {
    const u = { x: q.x, y: q.y, z: q.z };
    const t = scale(cross(u, p), 2);
    return add(p, add(scale(t, q.w), cross(u, t)));
}
export function createCrashBody(pitch: number | Quaternion, points: ReadonlyArray<Readonly<Vec3>>, angularVelocity: Vec3 = { x: 0, y: 0, z: 0 }): CrashBody {
    const contacts = points.map((p) => ({ ...p }));
    const extent = (axis: keyof Vec3) => Math.max(0.1, ...contacts.map((p) => Math.abs(p[axis]))) * 2;
    const x = extent("x"), y = extent("y"), z = extent("z");
    return {
        orientation: typeof pitch === "number" ? { x: 0, y: 0, z: Math.sin(pitch / 2), w: Math.cos(pitch / 2) } : { ...pitch },
        angularVelocity: { ...angularVelocity },
        inertia: {
            x: (y * y + z * z) / 12,
            y: (x * x + z * z) / 12,
            z: (x * x + y * y) / 12,
        },
        contacts,
    };
}
function inverseInertia(body: CrashBody, v: Vec3): Vec3 {
    const q = body.orientation;
    const local = rotateCrashPoint({ x: -q.x, y: -q.y, z: -q.z, w: q.w }, v);
    return rotateCrashPoint(q, {
        x: local.x / body.inertia.x,
        y: local.y / body.inertia.y,
        z: local.z / body.inertia.z,
    });
}
function mobility(body: CrashBody, r: Vec3, axis: Vec3): number {
    return (axis.x * axis.x +
        axis.y * axis.y +
        dot(cross(r, axis), inverseInertia(body, cross(r, axis))));
}
function impulse(motion: CrashMotion, body: CrashBody, r: Vec3, j: Vec3): void {
    motion.horizontalSpeed += j.x;
    motion.velocity += j.y;
    body.angularVelocity = add(body.angularVelocity, inverseInertia(body, cross(r, j)));
}
function contactVelocity(motion: CrashMotion, body: CrashBody, r: Vec3): Vec3 {
    return add({ x: motion.horizontalSpeed, y: motion.velocity, z: 0 }, cross(body.angularVelocity, r));
}
/** Resolves impacts immediately; correction changes position, never adds kinetic energy. */
export function resolveCrashContacts(motion: CrashMotion, body: CrashBody, terrain: CrashTerrain, material: Readonly<CrashMaterial> = defaultCrashMaterial): void {
    for (let iteration = 0; iteration < 6; iteration++) {
        for (const point of body.contacts) {
            const r = rotateCrashPoint(body.orientation, point);
            const x = motion.distance + r.x, z = r.z;
            const height = terrain(x, z);
            const gap = motion.altitude + r.y - height;
            if (gap > 0.002)
                continue;
            const delta = 0.025;
            const nRaw = {
                x: -(terrain(x + delta, z) - terrain(x - delta, z)) / (2 * delta),
                y: 1,
                z: -(terrain(x, z + delta) - terrain(x, z - delta)) / (2 * delta),
            };
            const normal = scale(nRaw, 1 / Math.hypot(nRaw.x, nRaw.y, nRaw.z));
            const speed = dot(contactVelocity(motion, body, r), normal);
            if (speed < 0) {
                const restitution = speed < -material.restThreshold ? material.restitution : 0;
                const normalMagnitude = (-(1 + restitution) * speed) / mobility(body, r, normal);
                impulse(motion, body, r, scale(normal, normalMagnitude));
                const v = contactVelocity(motion, body, r);
                const tangent = add(v, scale(normal, -dot(v, normal)));
                const tangentSpeed = Math.hypot(tangent.x, tangent.y, tangent.z);
                if (tangentSpeed > 1e-8) {
                    const axis = scale(tangent, 1 / tangentSpeed);
                    const magnitude = Math.min(material.friction * normalMagnitude, tangentSpeed / mobility(body, r, axis));
                    impulse(motion, body, r, scale(axis, -magnitude));
                }
            }
        }
    }
    // Exact vertical clearance for all current samples, including upside-down
    // contacts. A height-field always permits this correction within the lane.
    for (const point of body.contacts) {
        const r = rotateCrashPoint(body.orientation, point);
        motion.altitude = Math.max(motion.altitude, terrain(motion.distance + r.x, r.z) - r.y);
    }
}
export function stepCrash(motion: CrashMotion, body: CrashBody, dt: number, terrain: CrashTerrain, material: Readonly<CrashMaterial> = defaultCrashMaterial): void {
    if (!Number.isFinite(dt) || dt <= 0)
        return;
    const count = Math.ceil(dt * 120), h = dt / count;
    for (let i = 0; i < count; i++) {
        const decay = Math.exp(-material.linearDrag * h);
        const travelFactor = material.linearDrag === 0 ? h : (1 - decay) / material.linearDrag;
        motion.distance += motion.horizontalSpeed * travelFactor;
        if (material.linearDrag === 0) {
            motion.altitude += motion.velocity * h - (material.gravity * h * h) / 2;
            motion.velocity -= material.gravity * h;
        }
        else {
            const terminal = material.gravity / material.linearDrag;
            motion.altitude +=
                (motion.velocity + terminal) * travelFactor - terminal * h;
            motion.velocity = (motion.velocity + terminal) * decay - terminal;
        }
        motion.horizontalSpeed *= decay;
        const omega = body.angularVelocity;
        const speed = Math.hypot(omega.x, omega.y, omega.z);
        if (speed > 1e-10) {
            const angle = (speed * h) / 2, s = Math.sin(angle) / speed, q = body.orientation;
            const v = { x: omega.x * s, y: omega.y * s, z: omega.z * s }, w = Math.cos(angle);
            const xyz = add(add(scale(q, w), scale(v, q.w)), cross(v, q));
            const qw = w * q.w - dot(v, q), length = Math.hypot(xyz.x, xyz.y, xyz.z, qw);
            body.orientation = { ...scale(xyz, 1 / length), w: qw / length };
        }
        body.angularVelocity = scale(omega, Math.exp(-material.angularDrag * h));
        resolveCrashContacts(motion, body, terrain, material);
    }
}
