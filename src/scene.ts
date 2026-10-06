import * as T from "three";
import { createCessna } from "./aircraft";
import { Landscape, scenery } from "./terrain";
import { AirportsView } from "./airports-view";
import { CrashSmoke } from "./smoke";

export class GameScene {
  readonly renderer: T.WebGLRenderer;
  readonly scene = new T.Scene();
  readonly camera = new T.OrthographicCamera();
  readonly aircraft = createCessna();
  readonly landscape = new Landscape();
  readonly airports = new AirportsView();
  readonly smoke = new CrashSmoke();
  private readonly smokeSource = new T.Vector3();
  private elapsed = 0;
  private clouds: { group: T.Group; x: number; z: number; speed: number }[] =
    [];
  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new T.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.setClearColor(scenery.sky);
    this.scene.fog = new T.Fog(scenery.sky, 65, 140);
    this.camera.position.set(0, 9.5, 32);
    this.camera.lookAt(0, 7, 0);
    this.camera.near = 0.1;
    this.camera.far = 180;
    this.scene.add(new T.HemisphereLight(0xffeddb, 0x6b805a, 2));
    const sun = new T.DirectionalLight(0xffe3bd, 2.3);
    sun.position.set(-12, 25, 20);
    this.scene.add(sun);
    const sky = new T.Mesh(
      new T.PlaneGeometry(300, 150),
      new T.ShaderMaterial({
        depthWrite: false,
        depthTest: false,
        vertexShader:
          "varying float skyY;void main(){skyY=(modelMatrix*vec4(position,1.)).y;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
        fragmentShader:
          "varying float skyY;void main(){vec3 a=vec3(1.,.80,.58);vec3 b=vec3(.80,.61,.76);gl_FragColor=vec4(mix(a,b,smoothstep(-8.,12.,skyY)),1.);}",
        side: T.DoubleSide,
      }),
    );
    sky.renderOrder = -1000;
    sky.position.set(0, 14, -85);
    this.scene.add(sky);
    this.scene.add(
      this.landscape.group,
      this.aircraft.group,
      this.airports.group,
      this.smoke.group,
    );
    const material = new T.MeshStandardMaterial({
      color: scenery.cloud,
      roughness: 1,
    });
    const geometry = new T.SphereGeometry(1, 12, 8);
    for (let i = 0; i < 12; i++) {
      const group = new T.Group(),
        z = -12 - (i % 3) * 14;
      for (let j = 0; j < 7; j++) {
        const puff = new T.Mesh(geometry, material);
        puff.position.set(
          (j - 3) * 0.9,
          Math.sin(j * 2.3 + i) * 0.25,
          Math.cos(j) * 0.15,
        );
        puff.scale.set(1.1, 0.55 + Math.sin(j + 2) * 0.15, 0.6);
        group.add(puff);
      }
      group.position.set(0, 10 + (i % 4) * 1.7, z);
      group.scale.setScalar(0.6 + (i % 3) * 0.25);
      this.scene.add(group);
      this.clouds.push({
        group,
        x: (i / 12) * 110 - 55,
        z,
        speed: 0.08 + (i % 3) * 0.04,
      });
    }
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }
  resize() {
    const w = innerWidth,
      h = innerHeight,
      aspect = w / h;
    const height = aspect < 1 ? 24 : 20;
    this.camera.left = (-height * aspect) / 2;
    this.camera.right = (height * aspect) / 2;
    this.camera.top = height / 2;
    this.camera.bottom = -height / 2;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }
  render(
    distance: number,
    altitude: number,
    pitch: number,
    phase: string,
    crashTime: number,
    dt: number,
    horizontalSpeed = 7,
    orientation?: { x: number; y: number; z: number; w: number },
  ) {
    this.elapsed += dt;
    this.airports.update(distance, this.elapsed);
    this.landscape.update(distance);
    this.aircraft.group.position.set(0, altitude, 0);
    if (phase === "crashed" && orientation)
      this.aircraft.group.quaternion.set(
        orientation.x,
        orientation.y,
        orientation.z,
        orientation.w,
      );
    else this.aircraft.group.rotation.set(0, 0, pitch);
    this.aircraft.group.scale.setScalar(this.aircraft.scale);
    this.smokeSource
      .set(0.9 * this.aircraft.scale, 0.05 * this.aircraft.scale, 0)
      .applyQuaternion(this.aircraft.group.quaternion);
    this.smokeSource.x += distance;
    this.smokeSource.y += altitude;
    this.smoke.update(dt, phase === "crashed", distance, this.smokeSource);
    this.aircraft.propeller.rotation.x +=
      dt *
      (phase === "crashed"
        ? 95 * Math.exp(-crashTime * 3)
        : phase === "flying"
          ? 95
          : 30 + horizontalSpeed * 9);
    if (phase === "rolling" || phase === "takeoff")
      for (const wheel of this.aircraft.wheels)
        wheel.rotateY((-horizontalSpeed * dt) / (0.15 * this.aircraft.scale));
    // Compensate the camera elevation: the aircraft remains at the horizontal centre.
    for (const c of this.clouds)
      c.group.position.x =
        ((((c.x - distance * c.speed + 550) % 110) + 110) % 110) - 55;
    this.renderer.render(this.scene, this.camera);
  }
}
