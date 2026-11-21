// Shot + measure a page in Chrome through the DevTools protocol.
//
//   node tools/shot.mjs --url file://$PWD/index.html --out docs/screenshot.png
//   node tools/shot.mjs --width 1440 --height 900 --dpr 2 --out docs/wide.png
//   node tools/shot.mjs --geometry      # print the page's ?geometry=1 readout as JSON
//   node tools/shot.mjs --scheme dark   # pin the scheme: headless Chrome reports light by default
//
// A headless Chrome with --window-size does not set the layout viewport (measured: it stayed at
// 500x644), so the size is forced through Emulation.setDeviceMetricsOverride instead.
// No dependency: Node 22 ships a WebSocket client.
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { homedir } from "node:os";

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1] ?? true;
};
const flag = (name) => argv.includes(`--${name}`);

const width = Number(arg("width", 390));
const height = Number(arg("height", 844));
const dpr = Number(arg("dpr", 3));
const url = String(arg("url", `file://${process.cwd()}/index.html`));
const out = arg("out", "");
const port = Number(arg("port", 9333));
const chrome =
  arg("chrome", `${homedir()}/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome`);

const child = spawn(
  chrome,
  [
    "--headless",
    "--no-sandbox",
    "--disable-gpu",
    "--hide-scrollbars",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${homedir()}/.hermes/cache/scratch/chrome-cdp-${port}`,
    "about:blank",
  ],
  { stdio: "ignore" }
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function targets() {
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      const list = await res.json();
      const page = list.find((t) => t.type === "page");
      if (page) return page;
    } catch {}
    await sleep(100);
  }
  throw new Error("chrome did not open a debugging port");
}

function session(ws) {
  let id = 0;
  const pending = new Map();
  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { ok, fail } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? fail(new Error(JSON.stringify(msg.error))) : ok(msg.result);
    }
  });
  return (method, params = {}) =>
    new Promise((ok, fail) => {
      const n = ++id;
      pending.set(n, { ok, fail });
      ws.send(JSON.stringify({ id: n, method, params }));
    });
}

const page = await targets();
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((ok, fail) => {
  ws.addEventListener("open", ok, { once: true });
  ws.addEventListener("error", fail, { once: true });
});
const send = session(ws);

await send("Page.enable");
// Headless Chrome reuses the HTTP cache when the profile directory is reused, so a render or an
// audit after an edit measured the previous page: a chart that had just been added was invisible to
// `querySelectorAll('.arc-chart')` while the server was already sending it. Cache off for the session.
await send("Network.enable");
await send("Network.setCacheDisabled", { cacheDisabled: true });
await send("Emulation.setDeviceMetricsOverride", {
  width,
  height,
  deviceScaleFactor: dpr,
  mobile: width < 900,
});
if (flag("media-reduce") || arg("scheme", "")) {
  // Headless Chrome answers `prefers-color-scheme: light`, so an unparameterised render is the light
  // scheme and two screenshots labelled dark and light came out byte-identical. --scheme pins both the
  // media feature and the page's own flag, so one command cannot mean two schemes.
  const features = [];
  if (flag("media-reduce")) features.push({ name: "prefers-reduced-motion", value: "reduce" });
  if (arg("scheme", "")) features.push({ name: "prefers-color-scheme", value: String(arg("scheme", "")) });
  await send("Emulation.setEmulatedMedia", { features });
}
const target = new URL(url);
if (flag("geometry")) target.searchParams.set("geometry", "1");
if (arg("scheme", "")) target.searchParams.set("scheme", String(arg("scheme", "")));
await send("Page.navigate", { url: target.toString() });
await sleep(600);

if (out) {
  // --full captures the whole page, so a long element sheet is one piece of evidence
  const params = { format: "png", captureBeyondViewport: flag("full") };
  let captureDpr = dpr;
  if (flag("full")) {
    const metrics = await send("Page.getLayoutMetrics");
    const width = Math.ceil(metrics.cssContentSize.width);
    let height = Math.ceil(metrics.cssContentSize.height);
    // A captured page taller than the compositor's texture paints a blank band where the seam falls: at
    // DPR 3 a 8003 px page is 24009 device px and the band landed at 5650 px, hiding the bottom of a panel.
    // The capture therefore drops its density until the whole page fits in one texture, and says so.
    const LIMIT = 16000;
    while (height * captureDpr > LIMIT && captureDpr > 1) captureDpr -= 1;
    if (captureDpr !== dpr) {
      await send("Emulation.setDeviceMetricsOverride", {
        width, height: Number(arg("height", 844)), deviceScaleFactor: captureDpr, mobile: width < 900,
      });
      await sleep(200);
      ({ cssContentSize: { height } } = await send("Page.getLayoutMetrics"));
      height = Math.ceil(height);
      console.log(`full page ${height} px at ${dpr}x exceeds one texture — captured at ${captureDpr}x`);
    }
    params.clip = { x: 0, y: 0, width, height, scale: 1 };
  }
  const usedDpr = captureDpr;
  const { data } = await send("Page.captureScreenshot", params);
  const path = resolve(String(out));
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, Buffer.from(data, "base64"));
  console.log(`${path} · ${params.clip ? params.clip.width : width}×${params.clip ? params.clip.height : height} @ ${usedDpr}x`);
}

const { result } = await send("Runtime.evaluate", {
  expression: `JSON.stringify({
    viewport: [innerWidth, innerHeight, devicePixelRatio],
    readout: (document.getElementById("geometry")?.textContent || "").split("\\n")
  })`,
  returnByValue: true,
});
console.log(result.value);

if (arg("eval", null)) {
  const { result: value } = await send("Runtime.evaluate", {
    expression: String(arg("eval", "")),
    returnByValue: true,
  });
  console.log(JSON.stringify(value.value));
}

if (flag("audit")) {
  const { result: audit } = await send("Runtime.evaluate", {
    expression: `(() => {
      const problems = [];
      if (document.documentElement.scrollWidth > innerWidth + 1)
        problems.push("page scrolls horizontally: " + document.documentElement.scrollWidth + " > " + innerWidth);
      for (const el of document.querySelectorAll(".arc-shell *")) {
        if (el.closest("#geometry")) continue;
        const style = getComputedStyle(el);
        if (style.overflow === "visible" && el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0
            && !el.matches("pre, code, input"))
          problems.push("clipped horizontally: " + el.className + " " + el.scrollWidth + " > " + el.clientWidth);
        // a scroll container is legal; only hidden or clip loses content
        if (el.scrollHeight > el.clientHeight + 1 && ["hidden", "clip"].includes(style.overflowY) && el.clientHeight > 0)
          problems.push("clipped vertically: " + el.className + " " + el.scrollHeight + " > " + el.clientHeight);
      }
      for (const el of document.querySelectorAll(".arc-shell *")) {
        if (el.closest("#geometry")) continue;
        const r = el.getBoundingClientRect();
        if (r.width > 0 && (r.right > innerWidth + 1 || r.left < -1))
          problems.push("out of frame: " + (el.className || el.tagName) + " right " + r.right.toFixed(1) + " / " + innerWidth);
      }
      // an external sprite on file:// loads nothing, and nine empty squares look like a clean row.
      // A glyph that is one vertical stroke (letter-i, tally-1) has no width: only an empty box in both
      // axes means nothing was drawn.
      for (const el of document.querySelectorAll(".arc-icon")) {
        if (!el.getBBox) continue;
        // an icon inside a closed dialog has no layout box at all: it is not a defect, it is hidden
        if (!el.getClientRects().length) continue;
        const box = el.getBBox();
        if (box.width === 0 && box.height === 0)
          problems.push("icon drew nothing: " + (el.querySelector("use")?.getAttribute("href") || "inline"));
      }
      // The floor is checked on what a finger meets. An anchor that runs inside a sentence is the
      // documented inline exception (WCAG 2.5.8), so only a display other than inline is a target;
      // .arc-link is inline-flex, which is why the system's own link is measured.
      const targets = [...document.querySelectorAll("button, a[href], input, select, textarea, [role='button'], .arc-input")]
        .filter(el => !(el.matches("a[href]") && getComputedStyle(el).display === "inline"));
      // an element that carries the platform's hidden attribute must not paint: a component's own display rule
      // beats the UA rule, so this is the only way the frame says it out loud
      for (const el of document.querySelectorAll("[hidden]")) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0)
          problems.push("hidden element painted: " + (el.className || el.tagName));
      }
      const small = targets.filter(el => {
        const r = el.getBoundingClientRect();
        return r.height > 0 && (r.height < 44 || r.width < 44);
      }).map(el => (el.className || el.tagName) + " " + el.getBoundingClientRect().height.toFixed(1) + "px");
      // State in the markup and the state on the screen drift apart silently, and no screenshot tells
      // them apart: a toast that carried the hidden attribute sat in every committed frame. aria-expanded
      // names its panel through aria-controls, so the two claims can be compared; a trigger that names no
      // panel is a claim nobody can check, and it is reported as such.
      let expanded = 0;
      for (const el of document.querySelectorAll("[aria-expanded]")) {
        expanded += 1;
        const id = el.getAttribute("aria-controls");
        const panel = id ? document.getElementById(id) : null;
        if (!panel) {
          problems.push("aria-expanded without a panel: " + (el.className || el.tagName) + " aria-controls=" + (id || "none"));
          continue;
        }
        const style = getComputedStyle(panel);
        const painted = panel.getClientRects().length > 0 && style.display !== "none" && style.visibility !== "hidden";
        const says = el.getAttribute("aria-expanded") === "true";
        if (says !== painted)
          problems.push("aria-expanded " + says + ", the panel painted " + painted + ": " + (el.className || el.tagName));
      }
      // A control the screen calls off must not answer its own activation. The browser blocks a native
      // disabled button, so anything counted here is a control that only looks disabled: an anchor with
      // the attribute, a div with role=button and a listener, a wrapper handler around a dead control.
      const probe = (el) => {
        let seen = 0;
        const count = () => { seen += 1; };
        window.addEventListener("click", count, true);
        try { el.click(); } finally { window.removeEventListener("click", count, true); }
        return seen;
      };
      const off = [...document.querySelectorAll("button, input, select, textarea, a[href], [role='button'], [disabled], [aria-disabled='true']")]
        .filter(el => el.disabled === true || el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true");
      for (const el of off) {
        if (probe(el)) problems.push("disabled control answered a click: " + (el.className || el.tagName));
      }
      // One enabled control proves the counter is alive: a predicate that never fires prints exactly what
      // a clean page prints.
      const live = document.createElement("button");
      live.type = "button";
      live.style.cssText = "position:fixed;left:-9999px;top:0";
      document.body.append(live);
      const probeAlive = probe(live) === 1;
      live.remove();
      if (!probeAlive) problems.push("the click probe is dead: an enabled control reported no click");
      return JSON.stringify({
        problems,
        touchTargetsUnder44: small,
        ariaExpandedChecked: expanded,
        disabledControlsChecked: off.length,
        clickProbe: probeAlive ? "enabled answers, disabled silent" : "dead",
      }, null, 1);
    })()`,
    returnByValue: true,
  });
  console.log(audit.value);
}

ws.close();
child.kill();
