// Measure the geometry a layout claims: insets, rhythm, columns, rows, centring, truncation, overlap,
// and whether anything moved since a baseline.
//
//   node geometry.mjs --url http://127.0.0.1:8099/index.html --scheme dark --contract tokens/geometry.json
//   node geometry.mjs --url ... --widths 320,390,430,768 --click "#tab-2"
//   node geometry.mjs --url ... --save base.json          # record boxes and findings
//   node geometry.mjs --url ... --compare base.json       # what moved since then
//   node geometry.mjs --url ... --explain                 # how many elements each rule reached
//   node geometry.mjs --url ... --dir rtl                 # the same contract, right to left
//   node geometry.mjs --url ... --state density=compact   # a root attribute, before measuring
//   node geometry.mjs --url ... --box ".panel=280"        # one container narrower than the viewport
//   node geometry.mjs --url ... --stress                  # WCAG 1.4.12 text spacing
//
// The frame audit answers "does anything leave the frame, is a target too small". It says nothing about
// whether the parts sit on their places: a 20 px inset beside a 16 px one, a 112 px foot, a table row whose
// fourth cell wrapped. This tool answers that, and every finding names the number and the token it should
// have been.
//
// It is system-agnostic: name the custom properties that hold the scale and declare the relations the page
// must keep. A sweep without a contract is advisory only — measured on one showcase it printed 45 findings,
// 39 of them legal relations.
//
// Exit codes: 0 clean, 1 findings (or drift in --compare), 2 usage error.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
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
    if (item === `--${name}` && argv[i + 1] && !String(argv[i + 1]).startsWith('--')) out.push(argv[i + 1]);
  });
  return out;
};

const url = String(arg('url', ''));
if (!url) {
  console.error('geometry: --url is required');
  process.exit(2);
}

const widthList = String(arg('widths', ''))
  .split(',')
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isFinite(value) && value > 0);
const sizes = widthList.length ? widthList : [Number(arg('width', 390))];
const height = Number(arg('height', 844));
const dpr = Number(arg('dpr', 2));
const scheme = arg('scheme', '');
const port = Number(arg('port', 9334));
const chrome = arg('chrome', `${homedir()}/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome`);
const spaceVars = list('space-var');
const allow = list('allow').map(Number);
const clicks = list('click');
const tolerance = Number(arg('tolerance', 0.6));
const explain = flag('explain');
const asJson = flag('json');
const savePath = arg('save', '');
const comparePath = arg('compare', '');
const settle = Number(arg('settle', 700));
const dir = String(arg('dir', '')).toLowerCase();
const stress = flag('stress');
const states = list('state')
  .map((pair) => {
    const at = pair.indexOf('=');
    return at === -1 ? [pair, ''] : [pair.slice(0, at), pair.slice(at + 1)];
  })
  .filter(([key]) => key);
const boxes = list('box')
  .map((pair) => {
    const at = pair.lastIndexOf('=');
    if (at === -1) return null;
    const px = Number(pair.slice(at + 1));
    return Number.isFinite(px) && px > 0 ? [pair.slice(0, at), px] : null;
  })
  .filter(Boolean);

const contractPath = arg('contract', '');
const contract = contractPath ? JSON.parse(readFileSync(String(contractPath), 'utf8')) : null;

const KNOWN_RULES = ['inset', 'centre', 'padding', 'columns', 'rows', 'rhythm', 'truncate', 'overlap', 'snapshot', 'radius', 'gaps', 'align', 'baseline', 'square', 'measure', 'structure', 'centre-in', 'concentric', 'loss', 'hierarchy', 'control-height'];
if (contract) {
  for (const key of Object.keys(contract)) {
    if (key.startsWith('_') || key === 'steps' || key === 'allow') continue;
    if (!KNOWN_RULES.includes(key)) {
      console.error(`geometry: the contract declares an unknown rule "${key}" — known: ${KNOWN_RULES.join(', ')}`);
      process.exit(2);
    }
  }
}

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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
if (scheme) {
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: String(scheme) }] });
}

const probe = `(() => {
  const TOKENS = ${JSON.stringify(spaceVars)};
  const ALLOW = ${JSON.stringify(allow)};
  const TOL = ${tolerance};
  const CONTRACT = ${JSON.stringify(contract)};
  const EXPLAIN = ${explain};
  const findings = [];
  const notes = [];
  const reached = {};
  const name = (el) => {
    const raw = (el.className || '').toString();
    const cls = typeof raw === 'string' ? raw.trim().split(/\\s+/).filter(Boolean).slice(0, 2).join('.') : '';
    return el.tagName.toLowerCase() + (cls ? '.' + cls : '');
  };
  const path = (el) => {
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && parts.length < 8) {
      const parent = node.parentElement;
      const index = parent ? [...parent.children].indexOf(node) : 0;
      const cls = (node.className || '').toString().trim().split(/\\s+/).filter(Boolean)[0] || '';
      parts.unshift(node.tagName.toLowerCase() + (cls ? '.' + cls : '') + '[' + index + ']');
      node = parent;
    }
    return parts.join('>');
  };
  const resolve = (prop) => {
    const el = document.createElement('span');
    el.style.cssText = 'position:absolute;left:-9999px;top:0;height:0;width:var(' + prop + ')';
    document.body.append(el);
    const px = el.getBoundingClientRect().width;
    el.remove();
    return +px.toFixed(2);
  };
  const vars = TOKENS.length ? TOKENS : (CONTRACT && CONTRACT.steps) || ['--arc-space-1','--arc-space-2','--arc-space-3','--arc-space-4','--arc-space-5','--arc-space-6','--arc-space-8','--arc-space-10','--arc-space-12','--arc-control-height-m','--arc-control-height-l'];
  const steps = new Set([0, 1, 2, ...ALLOW]);
  for (const v of vars) {
    const px = resolve(v);
    if (px > 0) steps.add(+px.toFixed(2));
  }
  // A field reserves its leading mark as space + glyph + space: a sum of three steps is legal too.
  const sums = new Set();
  const values = [...steps].filter((v) => v > 0);
  for (const a of values) for (const b of values) {
    sums.add(+(a + b).toFixed(2));
    for (const c of values) sums.add(+(a + b + c).toFixed(2));
  }
  const near = (value) => {
    for (const step of steps) if (Math.abs(step - value) <= TOL) return true;
    for (const step of sums) if (Math.abs(step - value) <= TOL) return true;
    return false;
  };
  const RHYTHM = ['paddingTop','paddingRight','paddingBottom','paddingLeft','rowGap','columnGap'];
  const painted = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
  };
  const isSystem = (el) => [...el.classList].some((c) => c.startsWith('arc-'));
  const mark = (rule, n) => { reached[rule] = (reached[rule] || 0) + (n || 0); };

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
      mark('inset', 1);
      const style = getComputedStyle(container);
      const box = container.getBoundingClientRect();
      const content = box.width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
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

  const SIDE_KEY = {
    top: 'paddingTop',
    right: 'paddingRight',
    bottom: 'paddingBottom',
    left: 'paddingLeft',
    'block-start': 'paddingTop',
    'block-end': 'paddingBottom',
  };
  const sideKey = (side, rtl) => {
    if (SIDE_KEY[side]) return SIDE_KEY[side];
    if (side === 'start') return rtl ? 'paddingRight' : 'paddingLeft';
    if (side === 'end') return rtl ? 'paddingLeft' : 'paddingRight';
    return null;
  };

  const paddingRule = (rule) => {
    const min = resolve(rule.min);
    for (const el of document.querySelectorAll(rule.selector)) {
      mark('padding', 1);
      if (!painted(el)) continue;
      if (el.getBoundingClientRect().width < 60) continue;
      const style = getComputedStyle(el);
      const rtl = style.direction === 'rtl';
      for (const side of rule.sides || ['top', 'left']) {
        const key = sideKey(side, rtl);
        if (!key) {
          notes.push('padding: unknown side "' + side + '" on ' + name(el));
          continue;
        }
        const value = parseFloat(style[key]);
        if (Number.isFinite(value) && value + TOL < min) {
          findings.push({ rule: 'padding', at: name(el), detail: side + ' ' + value.toFixed(2) + 'px is under ' + rule.min + ' (' + min.toFixed(2) + 'px)' });
        }
      }
    }
  };

  const centreRule = (rule) => {
    for (const container of document.querySelectorAll(rule.container)) {
      mark('centre', 1);
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
      mark('columns', 1);
      const rows = [...grid.querySelectorAll(rule.row)].filter(painted);
      if (rows.length < 2) continue;
      const counts = new Set(rows.map((row) => row.children.length));
      if (counts.size > 1) {
        notes.push('columns: ' + name(grid) + ' holds rows of ' + [...counts].join(' / ') + ' cells — compared per count');
      }
      const byCount = new Map();
      for (const row of rows) {
        const n = row.children.length;
        byCount.set(n, [...(byCount.get(n) || []), row]);
      }
      for (const [n, group] of byCount) {
        if (group.length < 2) continue;
        const signature = (row) => [...row.children].map((c) => +c.getBoundingClientRect().right.toFixed(1)).join(',');
        const seen = new Map();
        for (const row of group) seen.set(signature(row), (seen.get(signature(row)) || 0) + 1);
        if (seen.size > 1) {
          findings.push({ rule: 'columns', at: name(grid), detail: 'rows of ' + n + ' cells disagree: ' + [...seen.entries()].map(([sig, k]) => sig + ' x' + k).join(' | ') });
        }
      }
    }
  };

  // A list's rows share a height. With by: text-lines the comparison is per line count, because a row whose
  // label wraps is legitimately taller: a reader who raises text spacing must not lose the label to keep the
  // list level.
  const rowsRule = (rule) => {
    for (const container of document.querySelectorAll(rule.container)) {
      mark('rows', 1);
      const group = [...container.querySelectorAll(rule.child)].filter(painted);
      if (group.length < 3) continue;
      let buckets = [group];
      if (rule.by === 'text-lines') {
        const lines = (el) => {
          const leaves = [...el.querySelectorAll('*')].filter((node) => node.children.length === 0 && (node.textContent || '').trim().length > 2);
          const leaf = leaves.sort((a, b) => (b.textContent || '').length - (a.textContent || '').length)[0];
          if (!leaf) return '1';
          const style = getComputedStyle(leaf);
          const line = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2;
          if (!line) return '1';
          return String(Math.max(1, Math.round(leaf.getBoundingClientRect().height / line)));
        };
        const map = new Map();
        for (const row of group) {
          const key = lines(row);
          map.set(key, [...(map.get(key) || []), row]);
        }
        buckets = [...map.values()];
      }
      for (const bucket of buckets) {
        if (bucket.length < 2) continue;
        const heights = bucket.map((el) => +el.getBoundingClientRect().height.toFixed(1));
        const spread = Math.max(...heights) - Math.min(...heights);
        if (spread > 1.1) {
          findings.push({ rule: 'rows', at: name(bucket[0]), detail: 'heights differ by ' + spread.toFixed(1) + 'px: ' + heights.join(' / ') });
        }
      }
    }
  };

  const truncateRule = (rule) => {
    for (const el of document.querySelectorAll(rule.scope)) {
      mark('truncate', 1);
      if (!painted(el)) continue;
      if (el.children.length > 0) continue;
      const text = (el.textContent || '').trim();
      if (text.length < 4) continue;
      const style = getComputedStyle(el);
      if (style.overflow !== 'hidden' && style.overflowX !== 'hidden' && style.textOverflow !== 'ellipsis') continue;
      if (el.scrollWidth > el.clientWidth + 1) {
        findings.push({ rule: 'truncate', at: name(el), detail: 'text cut: ' + el.scrollWidth + ' > ' + el.clientWidth + ' px — "' + text.slice(0, 40) + '"' });
      }
    }
  };

  const radiusRule = (rule) => {
    const allow = (rule.allow || ['0px']).map(String);
    for (const el of document.querySelectorAll(rule.scope)) {
      mark('radius', 1);
      if (!painted(el)) continue;
      const style = getComputedStyle(el);
      const corners = [style.borderTopLeftRadius, style.borderTopRightRadius, style.borderBottomRightRadius, style.borderBottomLeftRadius];
      for (const value of corners) {
        const simple = value.split(' ')[0];
        if (allow.includes(simple)) continue;
        if (rule.circle && value.includes('%')) continue;
        findings.push({ rule: 'radius', at: name(el), detail: 'corner ' + simple + ' is not one of ' + allow.join(' / ') });
        break;
      }
    }
  };

  // A nested corner is concentric when outer radius minus the distance from the outer edge equals the
  // inner radius. Two boxes with the same radius inside padding look wrong, and nothing else reports it.
  const corners = (style) => ({
    'top-left': style.borderTopLeftRadius,
    'top-right': style.borderTopRightRadius,
    'bottom-right': style.borderBottomRightRadius,
    'bottom-left': style.borderBottomLeftRadius,
  });

  // A control is a declared height: a button, a field, a row. One pixel of drift in a border or a leading
  // makes a row of controls look broken, and every rule above reads relations, not absolute heights.
  const controlHeightRule = (rule) => {
    const heights = (rule.heights || []).map((token) => resolve(token)).filter((value) => value > 0);
    if (!heights.length) {
      notes.push('control-height: no height resolved for ' + (rule.selector || '?'));
      return;
    }
    const tol = rule.tolerance || TOL;
    for (const el of document.querySelectorAll(rule.selector)) {
      mark('control-height', 1);
      if (!painted(el)) continue;
      const height = +el.getBoundingClientRect().height.toFixed(1);
      if (rule.mode === 'min') {
        const low = Math.min(...heights);
        if (height + tol < low) {
          findings.push({ rule: 'control-height', at: name(el), detail: 'height ' + height.toFixed(1) + 'px is under ' + low.toFixed(1) + 'px' });
        }
        continue;
      }
      if (!heights.some((value) => Math.abs(value - height) <= tol)) {
        findings.push({ rule: 'control-height', at: name(el), detail: 'height ' + height.toFixed(1) + 'px is not ' + heights.map((value) => value.toFixed(1) + 'px').join(' or ') });
      }
    }
  };

  const concentricRule = (rule) => {
    for (const parent of document.querySelectorAll(rule.parent)) {
      if (!painted(parent)) continue;
      const kids = [...parent.querySelectorAll(rule.child || ':scope > *')].filter(painted);
      if (!kids.length) continue;
      mark('concentric', kids.length);
      const outerStyle = getComputedStyle(parent);
      const outer = corners(outerStyle);
      const pb = parent.getBoundingClientRect();
      for (const kid of kids) {
        const inner = corners(getComputedStyle(kid));
        const kb = kid.getBoundingClientRect();
        const inset = {
          'top-left': Math.min(kb.left - pb.left, kb.top - pb.top),
          'top-right': Math.min(pb.right - kb.right, kb.top - pb.top),
          'bottom-right': Math.min(pb.right - kb.right, pb.bottom - kb.bottom),
          'bottom-left': Math.min(kb.left - pb.left, pb.bottom - kb.bottom),
        };
        for (const corner of Object.keys(outer)) {
          const out = outer[corner].split(' ')[0];
          const inside = inner[corner].split(' ')[0];
          // a percentage corner is a pill or a circle: it has no numeric answer to compare
          if (out.includes('%') || inside.includes('%')) continue;
          const outerPx = parseFloat(out) || 0;
          const innerPx = parseFloat(inside) || 0;
          if (outerPx === 0 && innerPx === 0) continue;
          const gap = +Math.max(0, inset[corner]).toFixed(1);
          const expected = +Math.max(0, outerPx - gap).toFixed(1);
          if (Math.abs(innerPx - expected) > (rule.tolerance || 1)) {
            findings.push({
              rule: 'concentric',
              at: name(parent) + ' > ' + name(kid),
              detail: corner + ': inner ' + innerPx.toFixed(1) + 'px, outer ' + outerPx.toFixed(1) + 'px minus ' + gap.toFixed(1) + 'px inset = ' + expected.toFixed(1) + 'px',
            });
            break;
          }
        }
      }
    }
  };

  // Content lost, not merely shortened: a text leaf clipped by its own box in the block direction.
  // An intentional line clamp is not a loss, so a declared clamp is skipped.
  const lossRule = (rule) => {
    for (const el of document.querySelectorAll(rule.scope || rule.selector)) {
      mark('loss', 1);
      if (!painted(el)) continue;
      if (el.children.length > 0) continue;
      const text = (el.textContent || '').trim();
      if (text.length < 4) continue;
      const style = getComputedStyle(el);
      const clamp = style.webkitLineClamp || style.lineClamp;
      if (clamp && clamp !== 'none') continue;
      const clipped = style.overflow === 'hidden' || style.overflow === 'clip' || style.overflowY === 'hidden' || style.overflowY === 'clip';
      if (!clipped) continue;
      if (el.scrollHeight > el.clientHeight + 1) {
        findings.push({ rule: 'loss', at: name(el), detail: 'text cut vertically: ' + el.scrollHeight + ' > ' + el.clientHeight + ' px — "' + text.slice(0, 40) + '"' });
      }
    }
  };

  // 2. a stack keeps one gap: every step between block siblings is the same number
  const gapsRule = (rule) => {
    for (const container of document.querySelectorAll(rule.container)) {
      mark('gaps', 1);
      const kids = [...container.children].filter(painted);
      if (kids.length < 3) continue;
      const gaps = [];
      for (let i = 1; i < kids.length; i += 1) {
        const previous = kids[i - 1].getBoundingClientRect();
        const current = kids[i].getBoundingClientRect();
        gaps.push(+(current.top - previous.bottom).toFixed(1));
      }
      const distinct = [...new Set(gaps)];
      if (distinct.length > 1) {
        findings.push({ rule: 'gaps', at: name(container), detail: 'one stack, ' + distinct.length + ' gaps: ' + gaps.join(' / ') });
      }
    }
  };

  // Proximity is meaning: a block inside a group sits closer than two groups. A declared stack is judged
  // by the widest inner gap against the narrowest outer one, so one legal inner gap does not hide a defect.
  // The inner gaps must run along the same axis as the outer ones: the free space in a row between a label
  // and a trailing mark is a layout, not a step.
  const gapOf = (a, b) => {
    const verticalOverlap = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    const horizontalOverlap = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    if (verticalOverlap >= Math.min(a.height, b.height) * 0.5) {
      return { gap: +Math.max(a.left - b.right, b.left - a.right, 0).toFixed(1), axis: 'x' };
    }
    if (horizontalOverlap >= Math.min(a.width, b.width) * 0.5) {
      return { gap: +Math.max(a.top - b.bottom, b.top - a.bottom, 0).toFixed(1), axis: 'y' };
    }
    return null;
  };

  const hierarchyRule = (rule) => {
    const inner = rule.group ? ':scope > ' + rule.group : ':scope > *';
    for (const outer of document.querySelectorAll(rule.parent)) {
      if (!painted(outer)) continue;
      const groups = [...outer.querySelectorAll(inner)].filter(painted);
      if (groups.length < 2) continue;
      mark('hierarchy', groups.length);
      const outerPairs = [];
      for (let i = 1; i < groups.length; i += 1) {
        const pair = gapOf(groups[i - 1].getBoundingClientRect(), groups[i].getBoundingClientRect());
        if (pair) outerPairs.push(pair);
      }
      if (!outerPairs.length) continue;
      const axis = outerPairs.filter((p) => p.axis === 'y').length >= outerPairs.filter((p) => p.axis === 'x').length ? 'y' : 'x';
      const between = outerPairs.filter((p) => p.axis === axis).map((p) => p.gap);
      if (!between.length) continue;
      const inside = [];
      for (const group of groups) {
        const kids = [...group.children].filter(painted);
        for (let i = 1; i < kids.length; i += 1) {
          const pair = gapOf(kids[i - 1].getBoundingClientRect(), kids[i].getBoundingClientRect());
          if (pair && pair.axis === axis && pair.gap > 0) inside.push(pair.gap);
        }
      }
      if (!inside.length) continue;
      const wide = Math.max(...inside);
      const narrow = Math.min(...between);
      if (wide >= narrow - TOL) {
        findings.push({ rule: 'hierarchy', at: name(outer), detail: 'a gap inside a group (' + wide.toFixed(1) + 'px) is not narrower than the gap between groups (' + narrow.toFixed(1) + 'px)' });
        continue;
      }
      if (rule.ratio) {
        const want = +(wide * rule.ratio).toFixed(1);
        if (narrow + TOL < want) {
          findings.push({ rule: 'hierarchy', at: name(outer), detail: 'groups sit ' + narrow.toFixed(1) + 'px apart, ratio ' + rule.ratio + ' asks ' + want.toFixed(1) + 'px for a ' + wide.toFixed(1) + 'px gap inside' });
        }
      }
    }
  };

  // 3. a declared column shares one text alignment
  const alignRule = (rule) => {
    for (const cell of document.querySelectorAll(rule.selector)) {
      mark('align', 1);
      if (!painted(cell)) continue;
      const align = getComputedStyle(cell).textAlign;
      if (!rule.allow.includes(align)) {
        findings.push({ rule: 'align', at: name(cell), detail: 'text-align ' + align + ', expected ' + rule.allow.join(' or ') });
      }
    }
  };

  // The baseline itself: a zero-size inline-block with vertical-align baseline sits on it, so its bottom
  // edge is the line the reader means. A line box bottom is not the baseline when two sizes meet.
  const baselineOf = (el) => {
    const probe = document.createElement('span');
    probe.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
    el.append(probe);
    const bottom = probe.getBoundingClientRect().bottom;
    probe.remove();
    return +bottom.toFixed(1);
  };

  const baselineRule = (rule) => {
    for (const container of document.querySelectorAll(rule.container)) {
      mark('baseline', 1);
      const kids = [...container.querySelectorAll(rule.selector || ':scope > *')].filter(painted);
      if (kids.length < 2) continue;
      const bottoms = [...new Set(kids.map(baselineOf))];
      if (bottoms.length > 1 && Math.max(...bottoms) - Math.min(...bottoms) > 1) {
        findings.push({ rule: 'baseline', at: name(container), detail: 'baselines at ' + bottoms.join(' / ') });
      }
    }
  };

  const squareRule = (rule) => {
    for (const el of document.querySelectorAll(rule.selector)) {
      mark('square', 1);
      if (!painted(el)) continue;
      const b = el.getBoundingClientRect();
      const delta = Math.abs(b.width - b.height);
      if (delta > (rule.tolerance || 1)) {
        findings.push({ rule: 'square', at: name(el), detail: 'box ' + b.width.toFixed(1) + ' x ' + b.height.toFixed(1) + ' px' });
      }
    }
  };

  const measureRule = (rule) => {
    for (const el of document.querySelectorAll(rule.selector)) {
      mark('measure', 1);
      if (!painted(el)) continue;
      const text = (el.textContent || '').trim();
      if (!text) continue;
      const style = getComputedStyle(el);
      const line = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2;
      const lines = Math.max(1, Math.round(el.getBoundingClientRect().height / line));
      const perLine = Math.round(text.length / lines);
      if (perLine > rule.max) {
        findings.push({ rule: 'measure', at: name(el), detail: perLine + ' characters a line, the limit is ' + rule.max });
      }
    }
  };

  const centreInRule = (rule) => {
    for (const el of document.querySelectorAll(rule.selector)) {
      mark('centre-in', 1);
      if (!painted(el)) continue;
      const box = el.closest(rule.within);
      if (!box) continue;
      const a = el.getBoundingClientRect();
      const b = box.getBoundingClientRect();
      const dx = +((a.left + a.width / 2) - (b.left + b.width / 2)).toFixed(1);
      const dy = +((a.top + a.height / 2) - (b.top + b.height / 2)).toFixed(1);
      const tolerance = rule.tolerance || 1;
      if (Math.abs(dx) > tolerance || Math.abs(dy) > tolerance) {
        findings.push({ rule: 'centre-in', at: name(el), detail: 'off centre by x ' + dx + ' y ' + dy + ' px' });
      }
    }
  };

  const overlapRule = (rule) => {
    const a = [...document.querySelectorAll(rule.a)].filter(painted);
    const b = [...document.querySelectorAll(rule.b)].filter(painted);
    mark('overlap', a.length * b.length);
    for (const one of a) {
      const r1 = one.getBoundingClientRect();
      for (const two of b) {
        if (one.contains(two) || two.contains(one)) continue;
        const r2 = two.getBoundingClientRect();
        const dx = Math.min(r1.right, r2.right) - Math.max(r1.left, r2.left);
        const dy = Math.min(r1.bottom, r2.bottom) - Math.max(r1.top, r2.top);
        if (dx > 1 && dy > 1) {
          findings.push({ rule: 'overlap', at: name(one) + ' x ' + name(two), detail: 'boxes overlap by ' + dx.toFixed(1) + ' x ' + dy.toFixed(1) + ' px' });
        }
      }
    }
  };

  const snapshotScope = (CONTRACT && CONTRACT.snapshot && CONTRACT.snapshot.scope) || null;
  const snapshot = () => {
    const map = {};
    if (!snapshotScope) return map;
    for (const el of document.querySelectorAll(snapshotScope)) {
      if (!painted(el)) continue;
      const b = el.getBoundingClientRect();
      map[path(el)] = { x: +b.left.toFixed(1), y: +(b.top + scrollY).toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1) };
    }
    return map;
  };

  if (CONTRACT) {
    const scope = (CONTRACT.rhythm && CONTRACT.rhythm.scope) || '.arc-shell *';
    for (const el of document.querySelectorAll(scope)) {
      if (!painted(el) || el.closest('#geometry')) continue;
      mark('rhythm', 1);
      const bad = rhythm(el);
      if (bad) findings.push({ rule: 'rhythm', at: name(el), detail: bad });
    }
    for (const rule of CONTRACT.padding || []) paddingRule(rule);
    for (const rule of CONTRACT.inset || []) insetRule(rule);
    for (const rule of CONTRACT.centre || []) centreRule(rule);
    for (const rule of CONTRACT.columns || []) columnsRule(rule);
    for (const rule of CONTRACT.rows || []) rowsRule(rule);
    for (const rule of CONTRACT.truncate || []) truncateRule(rule);
    for (const rule of CONTRACT.radius || []) radiusRule(rule);
    for (const rule of CONTRACT.gaps || []) gapsRule(rule);
    for (const rule of CONTRACT.align || []) alignRule(rule);
    for (const rule of CONTRACT.baseline || []) baselineRule(rule);
    for (const rule of CONTRACT.square || []) squareRule(rule);
    for (const rule of CONTRACT.measure || []) measureRule(rule);
    for (const rule of CONTRACT['centre-in'] || []) centreInRule(rule);
    for (const rule of CONTRACT.overlap || []) overlapRule(rule);
    for (const rule of CONTRACT.concentric || []) concentricRule(rule);
    for (const rule of CONTRACT.loss || []) lossRule(rule);
    for (const rule of CONTRACT.hierarchy || []) hierarchyRule(rule);
    for (const rule of CONTRACT['control-height'] || []) controlHeightRule(rule);
  } else {
    notes.push('sweep mode: no contract, so only rhythm and truncation are judged — advisory');
    for (const el of [...document.querySelectorAll('*')].filter((el) => painted(el) && !el.closest('#geometry') && isSystem(el))) {
      const bad = rhythm(el);
      if (bad) findings.push({ rule: 'rhythm', at: name(el), detail: bad });
      if (el.children.length === 0 && el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1) {
        findings.push({ rule: 'truncate', at: name(el), detail: 'text cut: ' + el.scrollWidth + ' > ' + el.clientWidth + ' px' });
      }
    }
  }

  const inset = document.createElement('div');
  inset.style.cssText = 'position:fixed;left:0;bottom:0;height:env(safe-area-inset-bottom)';
  document.body.append(inset);
  const safe = inset.getBoundingClientRect().height;
  inset.remove();
  if (safe === 0) notes.push('safe-area-inset-bottom resolves to 0 here — a device check is not replaced by this run');

  return JSON.stringify({
    viewport: [innerWidth, innerHeight],
    mode: CONTRACT ? 'contract' : 'sweep',
    steps: [...steps].filter((v) => v > 0).sort((a, b) => a - b),
    findings,
    notes,
    reached: EXPLAIN ? reached : undefined,
    snapshot: snapshotScope ? snapshot() : undefined,
    structure: (CONTRACT && CONTRACT.structure) ? Object.fromEntries(
      CONTRACT.structure.selectors.map((sel) => [sel, document.querySelectorAll(sel).length])
    ) : undefined,
  });
})()`;

const setup = `(() => {
  const DIR = ${JSON.stringify(dir)};
  const STATES = ${JSON.stringify(states)};
  const BOXES = ${JSON.stringify(boxes)};
  const STRESS = ${stress};
  const missing = [];
  if (DIR) document.documentElement.dir = DIR;
  for (const pair of STATES) document.documentElement.setAttribute(pair[0], pair[1]);
  for (const pair of BOXES) {
    const el = document.querySelector(pair[0]);
    if (!el) { missing.push(pair[0]); continue; }
    el.style.width = pair[1] + 'px';
    el.style.maxWidth = pair[1] + 'px';
    el.style.flexBasis = pair[1] + 'px';
  }
  if (STRESS) {
    const style = document.createElement('style');
    style.textContent = '*{line-height:1.5 !important;letter-spacing:0.12em !important;word-spacing:0.16em !important} p,li,dd,blockquote{margin-block-end:2em !important}';
    document.head.append(style);
  }
  return JSON.stringify({ dir: document.dir || document.documentElement.dir, direction: getComputedStyle(document.documentElement).direction, states: STATES.length, boxes: BOXES.length, stress: STRESS, missing });
})()`;

async function measure(width) {
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: dpr,
    mobile: width < 900,
  });
  const targetURL = new URL(url);
  if (scheme) targetURL.searchParams.set('scheme', String(scheme));
  await send('Page.navigate', { url: targetURL.toString() });
  await sleep(settle);
  const applied = await send('Runtime.evaluate', { expression: setup, returnByValue: true });
  const render = applied.result.value ? JSON.parse(applied.result.value) : {};
  for (const selector of render.missing || []) console.error(`geometry: --box ${selector} found nothing`);
  if (dir || states.length || boxes.length || stress) await sleep(300);
  for (const selector of clicks) {
    const click = `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return 'missing'; el.click(); return 'clicked'; })()`;
    const { result } = await send('Runtime.evaluate', { expression: click, returnByValue: true });
    if (result.value === 'missing') console.error(`geometry: --click ${selector} found nothing`);
    await sleep(250);
  }
  const { result } = await send('Runtime.evaluate', { expression: probe, returnByValue: true });
  const run = JSON.parse(result.value);
  run.render = render;
  if (run.viewport && Math.abs(run.viewport[0] - width) > 1) {
    run.notes.push('page rendered ' + run.viewport[0] + ' CSS px wide, not ' + width + ' — the document declares no viewport');
  }
  return run;
}

const report = { url, scheme: scheme || null, widths: {} };
for (const width of sizes) {
  report.widths[width] = await measure(width);
}

let failed = false;
const log = asJson ? () => {} : (...args) => console.log(...args);
for (const width of sizes) {
  const run = report.widths[width];
  log(`geometry — ${width}×${height} · ${run.findings.length} finding(s) · ${run.notes.length} note(s) · ${run.mode}`);
  if (width === sizes[0]) log(`steps: ${run.steps.join(' / ')}`);
  if (width === sizes[0] && run.render && (run.render.dir || run.render.states || run.render.boxes || run.render.stress)) {
    const bits = [];
    if (run.render.dir) bits.push('dir ' + run.render.dir + ' (computed ' + run.render.direction + ')');
    if (run.render.states) bits.push(run.render.states + ' state attribute(s)');
    if (run.render.boxes) bits.push(run.render.boxes + ' box width(s) forced');
    if (run.render.stress) bits.push('WCAG 1.4.12 text spacing');
    log('render: ' + bits.join(' · '));
  }
  for (const finding of run.findings) {
    log(`  ${finding.rule.padEnd(8)} ${String(finding.at).padEnd(34)} ${finding.detail}`);
  }
  for (const note of run.notes) log(`  note     ${note}`);
  if (explain && run.reached) {
    log('  reached: ' + Object.entries(run.reached).map(([rule, n]) => rule + ' ' + n).join(' · '));
  }
  if (run.findings.length) failed = true;
}

if (contract && contract.structure && sizes.length > 1) {
  const base = report.widths[sizes[0]].structure || {};
  let drift = 0;
  for (const width of sizes.slice(1)) {
    const now = report.widths[width].structure || {};
    for (const selector of Object.keys(base)) {
      if (base[selector] !== now[selector]) {
        log(`  structure ${selector} ${base[selector]} at ${sizes[0]} vs ${now[selector]} at ${width}`);
        drift += 1;
      }
    }
  }
  log(`structure: ${drift} selector(s) change the count across ${sizes.length} widths`);
  if (drift) failed = true;
}

if (savePath) {
  writeFileSync(String(savePath), JSON.stringify(report, null, 1));
  log(`geometry: baseline written to ${savePath}`);
}

if (comparePath) {
  const base = JSON.parse(readFileSync(String(comparePath), 'utf8'));
  let drift = 0;
  for (const width of sizes) {
    const now = report.widths[width];
    const then = base.widths?.[width];
    if (!then) {
      log(`compare ${width}: no baseline at this width`);
      continue;
    }
    const moved = [];
    for (const [key, box] of Object.entries(now.snapshot || {})) {
      const was = then.snapshot?.[key];
      if (!was) {
        moved.push(`${key}: appeared`);
        continue;
      }
      const dx = +(box.x - was.x).toFixed(1);
      const dy = +(box.y - was.y).toFixed(1);
      const dw = +(box.w - was.w).toFixed(1);
      const dh = +(box.h - was.h).toFixed(1);
      if (Math.abs(dx) > 0.6 || Math.abs(dy) > 0.6 || Math.abs(dw) > 0.6 || Math.abs(dh) > 0.6) {
        moved.push(`${key}: x ${dx} y ${dy} w ${dw} h ${dh}`);
      }
    }
    for (const key of Object.keys(then.snapshot || {})) {
      if (!(now.snapshot || {})[key]) moved.push(`${key}: gone`);
    }
    const wasFindings = new Set((then.findings || []).map((f) => f.rule + '|' + f.at + '|' + f.detail));
    const isFindings = new Set((now.findings || []).map((f) => f.rule + '|' + f.at + '|' + f.detail));
    const fresh = [...isFindings].filter((f) => !wasFindings.has(f));
    const gone = [...wasFindings].filter((f) => !isFindings.has(f));
    log(`compare ${width}: ${moved.length} element(s) moved · ${fresh.length} new finding(s) · ${gone.length} gone`);
    for (const line of moved) log('  moved    ' + line);
    for (const line of fresh) log('  new      ' + line);
    for (const line of gone) log('  gone     ' + line);
    drift += moved.length + fresh.length;
  }
  if (drift) failed = true;
}

if (asJson) console.log(JSON.stringify(report, null, 1));

ws.close();
child.kill();
process.exit(failed ? 1 : 0);
