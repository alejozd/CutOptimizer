// Smoke test for the built app, run against a real browser.
//
// It exists because the unit suite cannot see layout or wiring defects: a class such as
// `px-4hover:bg-amber-700` compiles, passes every test and still renders wrong. This script serves
// `dist`, drives headless Chrome over the DevTools protocol with no third-party dependency, and
// asserts the handful of behaviours that regressions actually hit.
//
// Usage: node scripts/smoke.mjs
// Env:   CHROME_BIN  explicit browser path (default: common Chrome locations per platform)
//        APP_DIR     directory to serve (default: dist)
//        PORT        port for the static server (default: 4173)
//        DEBUG_PORT  DevTools port (default: 9333)

import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join, normalize, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const APP_DIR = resolve(ROOT, process.env.APP_DIR ?? 'dist');
const PORT = Number(process.env.PORT ?? 4173);
const DEBUG_PORT = Number(process.env.DEBUG_PORT ?? 9333);
const BASE = '/cortes/';
const APP_URL = `http://127.0.0.1:${PORT}${BASE}`;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
};

function findChrome() {
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;
  const candidates = [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  const found = candidates.find((p) => existsSync(p));
  if (!found) throw new Error(`No browser found. Set CHROME_BIN. Looked in:\n  ${candidates.join('\n  ')}`);
  return found;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function serve() {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      let rel = decodeURIComponent(url.pathname);
      if (rel.startsWith(BASE)) rel = rel.slice(BASE.length - 1);
      if (rel === '/' || rel === '') rel = '/index.html';
      const filePath = normalize(join(APP_DIR, rel));
      if (!filePath.startsWith(APP_DIR)) {
        res.writeHead(403).end('forbidden');
        return;
      }
      const body = await readFile(filePath);
      res.writeHead(200, { 'content-type': MIME[extname(filePath)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  return new Promise((ok, fail) => {
    server.once('error', fail);
    server.listen(PORT, '127.0.0.1', () => ok(server));
  });
}

async function browserPage() {
  for (let i = 0; i < 80; i += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json();
      const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      /* browser still starting */
    }
    await sleep(250);
  }
  throw new Error('the browser never exposed a DevTools page target');
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 0;
    this.pending = new Map();
    this.handlers = new Map();
    this.errors = [];
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
        return;
      }
      if (msg.method) for (const fn of this.handlers.get(msg.method) ?? []) fn(msg.params);
    });
  }

  send(method, params = {}) {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  on(method, fn) {
    const list = this.handlers.get(method) ?? [];
    list.push(fn);
    this.handlers.set(method, list);
  }

  async evaluate(expression) {
    const { result, exceptionDetails } = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
      userGesture: true,
    });
    if (exceptionDetails) throw new Error(exceptionDetails.text);
    return result.value;
  }

  async goto(url) {
    await this.send('Page.navigate', { url });
    for (let i = 0; i < 100; i += 1) {
      await sleep(150);
      try {
        const ready = await this.evaluate("document.readyState === 'complete' && !!document.querySelector('#step-tab-pieces')");
        if (ready) break;
      } catch {
        /* mid-navigation */
      }
    }
    await sleep(800); // let React commit and the optimizer memo settle
  }
}

const failures = [];
const notes = [];

function check(name, condition, detail = '') {
  if (condition) {
    console.log(`  ok   ${name}`);
  } else {
    console.log(`  FAIL ${name}${detail ? ` -> ${detail}` : ''}`);
    failures.push(`${name}${detail ? ` -> ${detail}` : ''}`);
  }
}

const workspace = await mkdtemp(join(tmpdir(), 'cutopt-smoke-'));

let server;
let browser;
try {
  if (!existsSync(join(APP_DIR, 'index.html'))) {
    throw new Error(`${APP_DIR}/index.html not found. Run "npm run build" first.`);
  }

  server = await serve();
  const chromeBin = findChrome();
  browser = spawn(
    chromeBin,
    [
      '--headless=new',
      '--disable-gpu',
      '--enable-unsafe-swiftshader',
      '--no-sandbox',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--disable-background-networking',
      `--remote-debugging-port=${DEBUG_PORT}`,
      '--remote-allow-origins=*',
      `--user-data-dir=${join(workspace, 'profile')}`,
      '--window-size=1280,900',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );

  const ws = new WebSocket(await browserPage());
  await new Promise((ok, fail) => {
    ws.addEventListener('open', ok, { once: true });
    ws.addEventListener('error', fail, { once: true });
  });

  const cdp = new Cdp(ws);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Log.enable');
  cdp.on('Runtime.exceptionThrown', (p) => cdp.errors.push(p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text));
  cdp.on('Log.entryAdded', (p) => {
    if (p.entry?.level === 'error') cdp.errors.push(p.entry.text);
  });
  cdp.on('Runtime.consoleAPICalled', (p) => {
    if (p.type === 'error') cdp.errors.push(p.args.map((a) => a.value ?? a.description).join(' '));
  });

  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await cdp.goto(APP_URL);

  console.log('desktop 1280x900');

  const initial = await cdp.evaluate(`(() => {
    const active = document.querySelector('[role="tab"][aria-selected="true"]');
    const summary = document.getElementById('step-tabs-summary');
    const scroller = [...document.querySelectorAll('.overflow-x-auto')].find((e) => e.querySelector('table'));
    const ids = ['draft-piece-group', 'draft-piece-name', 'draft-piece-length', 'draft-piece-width', 'draft-piece-qty', 'draft-piece-rotation'];
    const tops = ids.map((id) => {
      const el = document.getElementById(id);
      return el ? Math.round(el.getBoundingClientRect().top) : null;
    });
    const addBtn = document.getElementById('add-piece-submit-button');
    return {
      activeTab: active ? active.id : null,
      summaryText: summary ? summary.textContent.replace(/\\s+/g, ' ').trim() : '',
      summaryPresent: !!summary,
      rowTops: [...new Set(tops.filter((t) => t !== null))],
      addPadding: addBtn ? getComputedStyle(addBtn).paddingLeft : null,
      addRight: addBtn ? Math.round(addBtn.getBoundingClientRect().right) : null,
      tableOverflow: scroller ? scroller.scrollWidth - scroller.clientWidth : null,
      chunkLoaded: performance.getEntriesByType('resource').filter((e) => /Furniture3DViewer/i.test(e.name)).length,
      canvases: document.querySelectorAll('canvas').length,
    };
  })()`);

  check('opens on the Piezas step', initial.activeTab === 'step-tab-pieces', String(initial.activeTab));
  check('the live summary is rendered', initial.summaryPresent && initial.summaryText.length > 0, initial.summaryText);
  check('the quick-add form is a single row', initial.rowTops.length === 1, `distinct tops: ${initial.rowTops.join(', ')}`);
  check('the add button keeps its own padding (px-4 regression)', initial.addPadding === '16px', String(initial.addPadding));
  check('the add button is inside the viewport', initial.addRight !== null && initial.addRight <= 1280, String(initial.addRight));
  check('the pieces table does not scroll horizontally', initial.tableOverflow === 0, `overflow ${initial.tableOverflow}px`);
  check('the 3D viewer is not fetched on the first step', initial.chunkLoaded === 0, `${initial.chunkLoaded} requests`);
  check('no canvas is mounted on the first step', initial.canvases === 0, `${initial.canvases} canvases`);

  // draft survival across steps
  await cdp.evaluate(`(() => {
    const set = (sel, v) => {
      const el = document.querySelector(sel);
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    set('#draft-piece-name', 'SmokePieza');
    set('#draft-piece-length', '600');
    return true;
  })()`);
  await sleep(200);
  await cdp.evaluate("document.getElementById('step-tab-material').click()");
  await sleep(400);
  await cdp.evaluate("document.getElementById('step-tab-pieces').click()");
  await sleep(400);
  const draft = await cdp.evaluate(`(() => ({
    name: document.getElementById('draft-piece-name')?.value ?? null,
    length: document.getElementById('draft-piece-length')?.value ?? null,
  }))()`);
  check('the draft survives a step change', draft.name === 'SmokePieza' && draft.length === '600', JSON.stringify(draft));

  // lazy 3D
  await cdp.evaluate("document.getElementById('step-tab-result').click()");
  await sleep(2500);
  const result = await cdp.evaluate(`(() => ({
    chunkLoaded: performance.getEntriesByType('resource').filter((e) => /Furniture3DViewer/i.test(e.name)).length,
    viewerMounted: document.body.textContent.includes('Arrastra para rotar'),
    canvases: document.querySelectorAll('canvas').length,
  }))()`);
  check('the 3D chunk loads when Resultado opens', result.chunkLoaded === 1, `${result.chunkLoaded} requests`);
  check('the 3D viewer mounted', result.viewerMounted === true, String(result.viewerMounted));
  notes.push(`3D canvas count after opening Resultado: ${result.canvases}`);

  // mobile
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
  await cdp.goto(APP_URL);
  const mobile = await cdp.evaluate(`(() => {
    const nav = document.querySelector('nav[aria-label="Pasos"]');
    const tablist = document.querySelector('[role="tablist"]');
    const summary = document.getElementById('step-tabs-summary');
    const centre = (el) => {
      const r = el.getBoundingClientRect();
      return Math.round((r.top + r.bottom) / 2);
    };
    return {
      navHeight: nav ? Math.round(nav.getBoundingClientRect().height) : null,
      oneRow: tablist && summary ? Math.abs(centre(tablist) - centre(summary)) < 8 : null,
      stickyShare: nav ? Math.round((nav.getBoundingClientRect().height / window.innerHeight) * 100) : null,
    };
  })()`);
  check('the mobile bar stays compact (<= 60px)', mobile.navHeight !== null && mobile.navHeight <= 60, `${mobile.navHeight}px`);
  check('tabs and summary share one row on mobile', mobile.oneRow === true, String(mobile.oneRow));

  check('the console stays clean', cdp.errors.length === 0, cdp.errors.slice(0, 3).join(' | '));

  ws.close();
} finally {
  if (browser && !browser.killed) browser.kill();
  if (server) server.close();
  await rm(workspace, { recursive: true, force: true }).catch(() => {});
}

if (notes.length) console.log(`\nnotes:\n  ${notes.join('\n  ')}`);

if (failures.length) {
  console.error(`\n${failures.length} smoke check(s) failed:`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('\nall smoke checks passed');
