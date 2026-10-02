/** Offline native-input replay and Canvas proof for the two workshop rooms.
 * node --import tsx scripts/prove_guaira_workshop_art.mjs OUTPUT CANVAS_MODULE [BASELINE_REPORT]
 * Canvas backend is external QA tooling, never a runtime dependency.
 * Compares all native simulation states when given a previous report. Browser,
 * device, audio and frame-rate verification are outside this offline proof.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const { createCanvas } = createRequire(import.meta.url)(
  resolve(process.argv[3]),
);
import { Canvas } from "../tests/helpers/guairaLabHarness.ts";
import { guairaGalleryBrowser } from "../tests/helpers/guairaGalleryHarness.ts";
import { guairaReliefBrowser } from "../tests/helpers/guairaReliefHarness.ts";
const output = process.argv[2];
mkdirSync(output, { recursive: true });
const surfaces = new WeakMap(),
  contexts = new WeakMap();
Canvas.prototype.getContext = function () {
  if (contexts.has(this)) return contexts.get(this);
  const surface = createCanvas(this.width, this.height);
  surfaces.set(this, surface);
  for (const key of ["width", "height"])
    Object.defineProperty(this, key, {
      configurable: true,
      get: () => surface[key],
      set: (v) => {
        surface[key] = v;
      },
    });
  const c = surface.getContext("2d"),
    proxy = new Proxy(c, {
      get: (t, k) =>
        k === "drawImage"
          ? (s, ...args) => t.drawImage(surfaces.get(s) ?? s, ...args)
          : typeof t[k] === "function"
            ? t[k].bind(t)
            : t[k],
      set: (t, k, v) => {
        t[k] = v;
        return true;
      },
    });
  contexts.set(this, proxy);
  return proxy;
};
const hash = (v) => createHash("sha256").update(v).digest("hex");
const report = [];
for (const [name, factory, file, route, samples] of [
  [
    "gallery",
    guairaGalleryBrowser,
    "guairaGalleryReplay",
    "runs",
    [0, 61, 139, 249, 357, 425, 507, 617],
  ],
  [
    "maintenance",
    guairaReliefBrowser,
    "guairaReliefReplay",
    "maintenance",
    [0, 69, 141, 197, 246, 324, 410, 504],
  ],
  [
    "interval",
    guairaReliefBrowser,
    "guairaReliefReplay",
    "interval",
    [0, 154, 174, 234, 280, 364],
  ],
]) {
  const cleanups = [],
    h = factory({ after: (f) => cleanups.push(f) }),
    g = h.create();
  const frames = [],
    images = [],
    sheet = createCanvas(1280, Math.ceil(samples.length / 2) * 380),
    c = sheet.getContext("2d");
  c.fillStyle = "#283d40";
  c.fillRect(0, 0, sheet.width, sheet.height);
  c.imageSmoothingEnabled = false;
  const state = () =>
    JSON.stringify({
      player: g.player.data,
      camera: g.camera,
      tiles: g.level.data.tiles,
      objects: g.objects,
      elapsed: g.elapsed,
      time: g.time,
      finished: g.finished,
      save: g.store.save,
    });
  function capture(frame) {
    frames.push(hash(state()));
    if (!samples.includes(frame)) return;
    const before = state();
    g.render();
    assert.equal(state(), before);
    const image = surfaces.get(h.canvas),
      path = `${name}-${frame}.png`;
    writeFileSync(`${output}/${path}`, image.toBuffer("image/png"));
    const i = images.length;
    c.fillStyle = "#f3ddb1";
    c.font = "14px monospace";
    c.fillText(
      `${name} / native frame ${frame}`,
      (i % 2) * 640 + 8,
      Math.floor(i / 2) * 380 + 15,
    );
    c.drawImage(image, (i % 2) * 640, Math.floor(i / 2) * 380 + 20);
    images.push({
      frame,
      path,
      x: g.player.data.position.x,
      camera: { ...g.camera },
      imageHash: hash(image.toBuffer("image/png")),
    });
  }
  let frame = 0;
  capture(frame);
  for (const [count, keys] of JSON.parse(
    readFileSync(`tests/helpers/${file}.json`, "utf8"),
  )[route]) {
    h.keys(keys);
    for (let i = 0; i < count; i++) {
      g.update(1000 / 60);
      capture(++frame);
    }
  }
  assert.equal(g.finished, true);
  assert.equal(g.player.data.isDead, false);
  assert.equal(g.player.data.hasHelmet, true);
  writeFileSync(`${output}/${name}-sheet.png`, sheet.toBuffer("image/png"));
  report.push({
    name,
    frames: frame,
    stateHash: hash(JSON.stringify(frames)),
    images,
  });
  // The minimal harness restores synthetic browser globals after each case.
  // It does not implement removeEventListener; lifecycle is tested separately.
  for (const f of cleanups.reverse()) f();
}
if (process.argv[4]) {
  const baseline = JSON.parse(readFileSync(process.argv[4], "utf8"));
  assert.deepEqual(
    report.map(({ name, frames, stateHash }) => ({ name, frames, stateHash })),
    baseline.map(({ name, frames, stateHash }) => ({
      name,
      frames,
      stateHash,
    })),
    "native replay changed from baseline",
  );
}
writeFileSync(`${output}/report.json`, JSON.stringify(report, null, 2));
console.log(
  report.map(({ name, frames, stateHash }) => ({ name, frames, stateHash })),
);
