import * as T from "three";
import { aircraftOptions, createAircraft, type AircraftKind } from "./fleet";

export function disposeAircraft(group: T.Group) {
  const geometries = new Set<T.BufferGeometry>(),
    materials = new Set<T.Material>();
  group.traverse((object) => {
    const mesh = object as T.Mesh;
    if (mesh.geometry) geometries.add(mesh.geometry);
    if (mesh.material)
      for (const material of Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material])
        materials.add(material);
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
}

export class AircraftPicker {
  readonly dialog = document.createElement("dialog");
  constructor(onSelect: (kind: AircraftKind) => void) {
    this.dialog.className = "aircraft-picker";
    this.dialog.setAttribute("aria-label", "Wybór samolotu");
    this.dialog.addEventListener("cancel", (event) => event.preventDefault());
    const logo = document.createElement("img");
    logo.className = "aircraft-logo";
    logo.src = new URL("./assets/latam-logo.png", import.meta.url).href;
    logo.alt = "Latam!";
    logo.draggable = false;
    const panel = document.createElement("div");
    panel.className = "aircraft-panel";
    const copyright = document.createElement("small");
    copyright.className = "aircraft-copyright";
    copyright.textContent = "(c) 2026 Karlos";
    this.dialog.append(logo, panel, copyright);
    const grid = document.createElement("div");
    grid.className = "aircraft-grid";
    panel.append(grid);
    const renderer = new T.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(320, 180);
    renderer.setPixelRatio(1);
    const camera = new T.OrthographicCamera(-2.4, 2.4, 1.35, -1.35, 0.1, 50);
    camera.position.set(3, 2.1, 9);
    camera.lookAt(0, 0.05, 0);
    const scene = new T.Scene();
    scene.add(new T.HemisphereLight(0xfff2dc, 0x78918a, 2));
    const sun = new T.DirectionalLight(0xffecd6, 2.4);
    sun.position.set(-3, 6, 8);
    scene.add(sun);
    for (const option of aircraftOptions) {
      const plane = createAircraft(option.id);
      scene.add(plane.group);
      renderer.render(scene, camera);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "aircraft-option";
      button.setAttribute("aria-label", option.label);
      button.dataset.aircraft = option.id;
      const image = document.createElement("img");
      image.src = renderer.domElement.toDataURL("image/png");
      image.alt = option.label;
      image.draggable = false;
      const label = document.createElement("span");
      label.textContent = option.label;
      button.append(image, label);
      button.addEventListener("click", () => {
        this.dialog.close();
        onSelect(option.id);
      });
      grid.append(button);
      scene.remove(plane.group);
      disposeAircraft(plane.group);
    }
    renderer.dispose();
    document.body.append(this.dialog);
  }
  get isOpen() {
    return this.dialog.open;
  }
  show(selected: AircraftKind) {
    this.dialog
      .querySelectorAll<HTMLButtonElement>("button")
      .forEach((button) =>
        button.classList.toggle(
          "previous-aircraft",
          button.dataset.aircraft === selected,
        ),
      );
    if (!this.dialog.open) this.dialog.showModal();
    this.dialog
      .querySelector<HTMLButtonElement>(`[data-aircraft="${selected}"]`)
      ?.focus();
  }
}
