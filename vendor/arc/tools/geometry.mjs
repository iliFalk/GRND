// Measure the geometry a layout claims: insets, rhythm, columns, equal rows.
//
//   node tools/geometry.mjs --url http://127.0.0.1:8099/index.html --scheme dark
//   node tools/geometry.mjs --url http://127.0.0.1:3122/?page=workout \
//        --space-vars --arc-space-1 --arc-space-2 ... --allow 112
//   node tools/geometry.mjs --url ... --json            # machine-readable findings
//
// The frame audit answers "does anything leave the frame, is a target too small". It says nothing about
// whether the parts sit on their places: a 20 px inset beside a 16 px one, a 112 px foot, a table row
// whose fourth cell wrapped. This tool answers exactly that, and every finding names the number and the
// token it should have been.
//
// It is system-agnostic on purpose: give it the custom properties that hold the scale (--arc-space-* by
// default) and it judges any page by the same four predicate classes:
//
//   inset    block-level siblings share one left and one right edge
//   rhythm   every padding, margin and gap is 0 or a declared step
//   columns  rows of one grid agree on their column edges
//   rows     siblings with the same classes have the same height
//
// Exit code 1 when a predicate fails, so it can stand in a gate.
import { spawn } from 'node:child_process';
import { homedir } from 'node:os';

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1] ?? true;
};
const flag = (name) => argv.includes(`--${name}`);
const list = (name) => {
  const out = [];
  argv.forEach((item, i) => {
    if (item === `--${name}`) out.push(argv[i + 1]);
  });
  return out;
};

const url = String(arg('url', ''));
if (!url) {
  console.error('geometry: --url is required');
  process.exit(2);
}
const width = Number(arg('width', 390));
const height = Number(arg('height', 844));
const dpr = Number(arg('dpr', 2));
const scheme = arg('scheme', '');
const port = Number(arg('port', 9334));
const chrome = arg('chrome', `${homedir()}/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome`);
const spaceVars = list('space-var');
const allow = list('allow').map(Number);
const tolerance = Number(arg('tolerance', 0.6));
const contractPath = arg('contract', '');
const contractJSON = contractPath
  ? JSON.stringify(JSON.parse((await import('node:fs')).readFileSync(String(contractPath), 'utf8')))
  : 'null';

const child = spawn(
  chrome,
  [
    '--headless',
    '--no-sandbox',
    '--disable-gpu',
    '--hide-scrollbars',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${homedir()}/.hermes/cache/scratch/chrome-geometry-${port}`,
    'about:blank',
  ],
  { stdio: 'ignore' }
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function page() {
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      const found = (await res.json()).find((t) => t.type === 'page');
      if (found) return found;
    } catch {}
    await sleep(100);
  }
  throw new Error('chrome did not open a debugging port');
}

function session(ws) {
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (event) => {
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

const target = await page();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((ok, fail) => {
  ws.addEventListener('open', ok, { once: true });
  ws.addEventListener('error', fail, { once: true });
});
const send = session(ws);

await send('Page.enable');
await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Emulation.setDeviceMetricsOverride', {
  width,
  height,
  deviceScaleFactor: dpr,
  mobile: width < 900,
});
if (scheme) {
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: String(scheme) }] });
}
const targetURL = new URL(url);
if (scheme) targetURL.searchParams.set('scheme', String(scheme));
await send('Page.navigate', { url: targetURL.toString() });
await sleep(700);

const probe = `(() => {
  const TOKENS = ${JSON.stringify(spaceVars)};
  const ALLOW = ${JSON.stringify(allow)};
  const TOL = ${tolerance};
  const CONTRACT = ${contractJSON};
  const findings = [];
  const name = (el) => {
    const raw = (el.className || '').toString();
    const cls = typeof raw === 'string' ? raw.trim().split(/\s+/).filter(Boolean).slice(0, 2).join('.') : '';
    return el.tagName.toLowerCase() + (cls ? '.' + cls : '');
  };
  const resolve = (prop) => {
    const el = document.createElement('span');
    el.style.cssText = 'position:absolute;left:-9999px;top:0;height:0;width:var(' + prop + ')';
    document.body.append(el);
    const px = el.getBoundingClientRect().width;
    el.remove();
    return +px.toFixed(2);
  };
  const vars = TOKENS.length ? TOKENS : (CONTRACT && CONTRACT.steps) || ['--arc-space-1','--arc-space-2','--arc-space-3','--arc-space-4','--arc-space-5','--arc-space-6','--arc-space-7','--arc-space-8'];
  const steps = new Set([0, 1, 2, ...ALLOW]);
  for (const v of vars) {
    const px = resolve(v);
    if (px > 0) steps.add(+px.toFixed(2));
  }
  const pairs = new Set();
  for (const a of steps) for (const b of steps) if (a && b) pairs.add(+(a + b).toFixed(2));
  const near = (value) => {
    for (const step of steps) if (Math.abs(step - value) <= TOL) return true;
    for (const step of pairs) if (Math.abs(step - value) <= TOL) return true;
    return false;
  };
  const RHYTHM = ['paddingTop','paddingRight','paddingBottom','paddingLeft','rowGap','columnGap'];
  const painted = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
  };
  const isSystem = (el) => [...el.classList].some((c) => c.startsWith('arc-'));

  const rhythm = (el) => {
    const s = getComputedStyle(el);
    for (const prop of RHYTHM) {
      const value = parseFloat(s[prop]);
      if (Number.isNaN(value) || value === 0) continue;
      if (!near(value)) return prop + ' ' + value.toFixed(2) + 'px is not a step';
    }
    return null;
  };

  const insetRule = (rule) => {
    for (const container of document.querySelectorAll(rule.container)) {
      const box = container.getBoundingClientRect();
      const content = box.width - parseFloat(getComputedStyle(container).paddingLeft) - parseFloat(getComputedStyle(container).paddingRight);
      const kids = [...container.querySelectorAll(rule.child)].filter((el) => {
        if (!painted(el)) return false;
        if (rule.fill === false) return true;
        return el.getBoundingClientRect().width >= content * 0.9;
      });
      if (kids.length < 2) continue;
      const lefts = new Set(kids.map((el) => +el.getBoundingClientRect().left.toFixed(1)));
      const rights = new Set(kids.map((el) => +el.getBoundingClientRect().right.toFixed(1)));
      if (lefts.size > 1) findings.push({ rule: 'inset', at: name(container), detail: 'left edges differ: ' + [...lefts].sort((a, b) => a - b).join(' / ') });
      if (rights.size > 1) findings.push({ rule: 'inset', at: name(container), detail: 'right edges differ: ' + [...rights].sort((a, b) => a - b).join(' / ') });
    }
  };

  const paddingRule = (rule) => {
    const min = resolve(rule.min);
    for (const el of document.querySelectorAll(rule.selector)) {
      if (!painted(el)) continue;
      const box = el.getBoundingClientRect();
      if (box.width < 60) continue;
      const style = getComputedStyle(el);
      for (const side of rule.sides || ['top', 'left']) {
        const value = parseFloat(style['padding' + side[0].toUpperCase() + side.slice(1)]);
        if (Number.isFinite(value) && value + TOL < min) {
          findings.push({ rule: 'padding', at: name(el), detail: side + ' ' + value.toFixed(2) + 'px is under ' + rule.min + ' (' + min.toFixed(2) + 'px)' });
        }
      }
    }
  };

  const centreRule = (rule) => {
    for (const container of document.querySelectorAll(rule.container)) {
      const kids = [...container.querySelectorAll(rule.child)].filter(painted);
      if (kids.length < 2) continue;
      const centres = new Set(kids.map((el) => {
        const b = el.getBoundingClientRect();
        return +(b.left + b.width / 2).toFixed(1);
      }));
      if (centres.size > 1) findings.push({ rule: 'centre', at: name(container), detail: 'centres differ: ' + [...centres].join(' / ') });
    }
  };

  const columnsRule = (rule) => {
    for (const grid of document.querySelectorAll(rule.grid)) {
      const rows = [...grid.querySelectorAll(rule.row)];
      if (rows.length < 2) continue;
      const signature = (row) => [...row.children].map((c) => +c.getBoundingClientRect().right.toFixed(1)).join(',');
      const seen = new Map();
      for (const row of rows) seen.set(signature(row), (seen.get(signature(row)) || 0) + 1);
      if (seen.size > 1) findings.push({ rule: 'columns', at: name(grid), detail: 'row column edges differ: ' + [...seen.entries()].map(([sig, n]) => sig + ' ×' + n).join(' | ') });
    }
  };

  const rowsRule = (rule) => {
    for (const container of document.querySelectorAll(rule.container)) {
      const group = [...container.querySelectorAll(rule.child)].filter(painted);
      if (group.length < 3) continue;
      const heights = group.map((el) => +el.getBoundingClientRect().height.toFixed(1));
      if (Math.max(...heights) - Math.min(...heights) > 1.1) {
        findings.push({ rule: 'rows', at: name(group[0]), detail: 'heights differ by ' + (Math.max(...heights) - Math.min(...heights)).toFixed(1) + 'px: ' + heights.join(' / ') });
      }
    }
  };

  if (CONTRACT) {
    // Declared relations only: the page says which blocks must line up, and the tool checks exactly that.
    for (const el of document.querySelectorAll(CONTRACT.rhythm.scope)) {
      if (!painted(el) || el.closest('#geometry')) continue;
      const bad = rhythm(el);
      if (bad) findings.push({ rule: 'rhythm', at: name(el), detail: bad });
    }
    for (const rule of CONTRACT.inset || []) insetRule(rule);
    for (const rule of CONTRACT.padding || []) paddingRule(rule);
    for (const rule of CONTRACT.centre || []) centreRule(rule);
    for (const rule of CONTRACT.columns || []) columnsRule(rule);
    for (const rule of CONTRACT.rows || []) rowsRule(rule);
  } else {
    const all = [...document.querySelectorAll('*')].filter((el) => painted(el) && !el.closest('#geometry') && isSystem(el));
    for (const el of all) {
      const bad = rhythm(el);
      if (bad) findings.push({ rule: 'rhythm', at: name(el), detail: bad });
    }
  }

  return JSON.stringify({ viewport: [innerWidth, innerHeight], mode: CONTRACT ? 'contract' : 'sweep', steps: [...steps].filter((v) => v > 0).sort((a, b) => a - b), findings }, null, 1);
})()`;

const { result } = await send('Runtime.evaluate', { expression: probe, returnByValue: true });
const report = JSON.parse(result.value);
if (flag('json')) {
  console.log(JSON.stringify(report, null, 1));
} else {
  console.log(`geometry — ${width}×${height} · ${report.findings.length} finding(s)`);
  console.log(`steps: ${report.steps.join(' / ')}`);
  for (const f of report.findings) console.log(`  ${f.rule.padEnd(8)} ${f.at.padEnd(34)} ${f.detail}`);
}
ws.close();
child.kill();
process.exit(report.findings.length ? 1 : 0);
