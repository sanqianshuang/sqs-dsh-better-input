// wsl-page-verify.mjs — drive the live WSL dsh Web UI headlessly and capture
// screenshot + DOM facts. Run inside WSL with node v22.
//   node wsl-page-verify.mjs <outName> [hashRoute]
// Reads the live URL (with token) from /root/.dsh-current-url.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire('/root/.dsh/profiles/web/package.json');
const puppeteer = require('puppeteer-core');

const CHROME = '/opt/google/chrome/chrome';
const OUTDIR = '/mnt/d/project/DeepseekHarness/sanqianshuang-better-input/evidence';
const outName = process.argv[2] || 'wsl-page';
const route = process.argv[3] || '';

const base = readFileSync('/root/.dsh-current-url', 'utf8').trim();
const url = route ? base.split('#')[0] + route : base;

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--hide-scrollbars'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1264, height: 805, deviceScaleFactor: 1 });

const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300)); });
page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + String(e).slice(0, 300)));

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
await new Promise((r) => setTimeout(r, 6000));

const shot = `${OUTDIR}/${outName}.png`;
await page.screenshot({ path: shot, fullPage: false });

const facts = await page.evaluate(() => {
  const txt = (el) => (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60);
  const clickables = [...document.querySelectorAll('button,[role="button"],a[href],[aria-label]')]
    .map((el) => ({
      tag: el.tagName.toLowerCase(),
      label: el.getAttribute('aria-label') || txt(el),
      href: el.getAttribute('href') || '',
      title: el.getAttribute('title') || '',
    }))
    .filter((c) => c.label || c.href)
    .slice(0, 60);
  return {
    title: document.title,
    url: location.href.replace(/token=[^&]+/, 'token=***'),
    hash: location.hash,
    bodyText: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 1200),
    clickables,
  };
});

console.log(JSON.stringify({ shot, url: url.replace(/token=[^&]+/, 'token=***'), consoleErrors, ...facts }, null, 2));
await browser.close();
