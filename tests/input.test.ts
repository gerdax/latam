import { test } from "node:test";
import assert from "node:assert/strict";
import { FlightInput } from "../src/input";

// Minimal event surfaces exercise the real handlers without a browser dependency.
class Surface {
  listeners = new Map<string, Set<(event: any) => void>>();
  addEventListener(type: string, listener: (event: any) => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
  }
  removeEventListener(type: string, listener: (event: any) => void) {
    this.listeners.get(type)?.delete(listener);
  }
  emit(type: string, fields: Record<string, unknown> = {}) {
    const event = { type, preventDefault() {}, ...fields };
    this.listeners.get(type)?.forEach((listener) => listener(event));
  }
}
class Element {
  isContentEditable = false;
  tagName = "CANVAS";
  inDialog = false;
  closest() { return this.inDialog ? this : null; }
}
class Canvas extends Surface {
  style = { touchAction: "auto" };
  clientHeight = 800;
  captured = new Set<number>();
  setPointerCapture(id: number) { this.captured.add(id); }
  hasPointerCapture(id: number) { return this.captured.has(id); }
  releasePointerCapture(id: number) {
    this.captured.delete(id);
    this.emit("lostpointercapture", { pointerId: id, clientX: 0, clientY: 0 });
  }
}

function fixture() {
  const windowSurface = new Surface();
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const oldElement = Object.getOwnPropertyDescriptor(globalThis, "HTMLElement");
  Object.defineProperty(globalThis, "window", { configurable: true, value: windowSurface });
  Object.defineProperty(globalThis, "HTMLElement", { configurable: true, value: Element });
  const canvas = new Canvas();
  let gestures = 0;
  const input = new FlightInput(canvas as unknown as HTMLCanvasElement, () => gestures++);
  return {
    input, canvas, window: windowSurface, gestures: () => gestures,
    pointer(type: string, time: number, x = 100, y = 100, pointerType = "touch", id = 1) {
      canvas.emit(type, { timeStamp: time, clientX: x, clientY: y, pointerId: id, pointerType, button: 0 });
    },
    key(type: string, key = " ", repeat = false, target = new Element()) {
      windowSurface.emit(type, { key, code: key === " " ? "Space" : key, repeat, target });
    },
    close() {
      input.dispose();
      if (oldWindow) Object.defineProperty(globalThis, "window", oldWindow);
      else Reflect.deleteProperty(globalThis, "window");
      if (oldElement) Object.defineProperty(globalThis, "HTMLElement", oldElement);
      else Reflect.deleteProperty(globalThis, "HTMLElement");
    },
  };
}

test("Space is consumed once; held key and repeat cannot enqueue another roll", () => {
  const f = fixture();
  try {
    f.key("keydown");
    assert.equal(f.input.consumeRollRequest(), true);
    assert.equal(f.input.consumeRollRequest(), false);
    f.key("keydown", " ", true);
    f.key("keydown");
    assert.equal(f.input.consumeRollRequest(), false);
    f.key("keyup");
    f.key("keydown");
    assert.equal(f.input.consumeRollRequest(), true);
    assert.ok(f.gestures() > 0);
  } finally { f.close(); }
});

test("editable fields, picker buttons and dialog contents do not enqueue keyboard controls", () => {
  const f = fixture();
  try {
    for (const tagName of ["INPUT", "TEXTAREA", "SELECT", "BUTTON"]) {
      const target = new Element(); target.tagName = tagName;
      f.key("keydown", " ", false, target);
      f.key("keydown", "ArrowUp", false, target);
    }
    const dialog = new Element(); dialog.inDialog = true;
    f.key("keydown", " ", false, dialog);
    const editable = new Element(); editable.isContentEditable = true;
    f.key("keydown", " ", false, editable);
    assert.equal(f.input.consumeRollRequest(), false);
    assert.equal(f.input.value, 0);
    assert.equal(f.gestures(), 0);
  } finally { f.close(); }
});

test("a single short click or touch tap triggers exactly one half roll", () => {
  for (const type of ['mouse','touch','pen']) {
    const f=fixture();
    try {
      f.pointer('pointerdown',0,100,100,type);
      assert.equal(f.input.consumeRollRequest(),false);
      f.pointer('pointerup',250,100,100,type);
      // Browsers dispatch capture loss after pointerup; it must not clear the
      // already accepted roll or accidentally enqueue another one.
      f.pointer('lostpointercapture',251,0,0,type);
      assert.equal(f.input.consumeRollRequest(),true,type);
      assert.equal(f.input.consumeRollRequest(),false);
    } finally {f.close();}
  }
});

test("drag anchor follows saturation so reversing at either edge remains reachable", () => {
  for (const type of ["mouse", "touch"]) {
    const f = fixture();
    try {
      f.pointer("pointerdown", 0, 100, 600, type);
      f.pointer("pointermove", 20, 100, 0, type);
      assert.equal(f.input.value, 1);
      f.pointer("pointermove", 40, 100, 140, type);
      assert.equal(f.input.value, 0);
      f.pointer("pointermove", 60, 100, 280, type);
      assert.equal(f.input.value, -1);
      f.pointer("pointermove", 80, 100, 800, type);
      assert.equal(f.input.value, -1);
      f.pointer("pointermove", 100, 100, 660, type);
      assert.equal(f.input.value, 0);
      f.pointer("pointermove", 120, 100, 520, type);
      assert.equal(f.input.value, 1);
      f.pointer("pointerup", 140, 100, 520, type);
      assert.equal(f.input.consumeRollRequest(), false);
    } finally { f.close(); }
  }
});
test("holding, dragging, cancellation and multiple pointers do not trigger a roll", () => {
  for (const kind of ['long','drag','cancel','multitouch']) {
    const f=fixture();
    try {
      f.pointer('pointerdown',0);
      if(kind==='drag') {
        f.pointer('pointermove',20,113);
        f.pointer('pointermove',30,100);
      }
      if(kind==='multitouch') f.pointer('pointerdown',20,100,100,'touch',2);
      f.pointer(kind==='cancel'?'pointercancel':'pointerup',kind==='long'?251:80);
      assert.equal(f.input.consumeRollRequest(),false,kind);
    } finally {f.close();}
  }
});

test("reset and blur clear keys, drag and queued roll", () => {
  const f = fixture();
  try {
    f.key("keydown", "ArrowUp"); f.key("keydown");
    f.pointer("pointerdown", 0); f.pointer("pointerup", 40);
    f.window.emit("blur");
    assert.equal(f.input.value, 0);
    assert.equal(f.input.consumeRollRequest(), false);
    f.pointer("pointerdown", 100); f.input.reset(); f.pointer("pointerup", 140);
    assert.equal(f.input.consumeRollRequest(), false);
    f.pointer("pointerdown", 200); f.pointer("pointermove", 220, 100, 40);
    assert.ok(f.input.value > 0);
    f.input.reset();
    assert.equal(f.input.value, 0);
    assert.equal(f.canvas.captured.size, 0);
    f.key("keydown");
    assert.equal(f.input.consumeRollRequest(), true);
  } finally { f.close(); }
});

test('keyboard uses inverted stick while touch and mouse retain drag direction', () => {
  const f = fixture();
  try {
    f.key('keydown', 'ArrowDown');
    assert.equal(f.input.value, 1);
    f.key('keydown', 'ArrowUp');
    assert.equal(f.input.value, 0);
    f.key('keyup', 'ArrowDown');
    assert.equal(f.input.value, -1);
    f.key('keyup', 'ArrowUp');
    for (const type of ['touch', 'mouse']) {
      f.pointer('pointerdown', 0, 100, 200, type);
      f.pointer('pointermove', 20, 100, 60, type);
      assert.equal(f.input.value, 1, type);
      f.pointer('pointermove', 40, 100, 340, type);
      assert.equal(f.input.value, -1, type);
      f.pointer('pointerup', 60, 100, 340, type);
      assert.equal(f.input.value, 0);
    }
  } finally { f.close(); }
});
