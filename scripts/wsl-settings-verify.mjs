// wsl-settings-verify.mjs — open the dsh Settings dialog headlessly, optionally
// click one nav entry, and capture screenshot + visible text.
//   node wsl-settings-verify.mjs <outName> [navLabelToClick]
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire('/root/.dsh/profiles/web/package.json');
const puppeteer = require('puppeteer-core');

const CHROME = '/opt/google/chrome/chrome';
const OUTDIR = '/mnt/d/project/DeepseekHarness/sanqianshuang-better-input/evidence';
const outName = process.argv[2] || 'wsl-settings';
const navLabel = process.argv[3] || '';

const url = readFileSync('/root/.dsh-current-url', 'utf8').trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--hide-scrollbars'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1264, height: 805, deviceScaleFactor: 1 });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 300)));

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
await sleep(6000);

// open Settings
const opened = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')];
  const b = btns.find((el) => /^(Settings|设置)$/i.test((el.getAttribute('aria-label') || el.innerText || '').trim()));
  if (!b) return false;
  b.click();
  return true;
});
if (!opened) { console.log(JSON.stringify({ error: 'Settings button not found' })); await browser.close(); process.exit(2); }
await sleep(3500);

const navItems = await page.evaluate(() =>
  [...document.querySelectorAll('[role="dialog"] button,[role="dialog"] a,[role="dialog"] [role="tab"],[role="dialog"] [role="button"]')]
    .map((el) => (el.getAttribute('aria-label') || el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 50))
    .filter(Boolean)
    .slice(0, 60)
);

let clicked = '';
if (navLabel) {
  clicked = await page.evaluate((want) => {
    const els = [...document.querySelectorAll('[role="dialog"] button,[role="dialog"] a,[role="dialog"] [role="tab"],[role="dialog"] [role="button"]')];
    const el = els.find((e) => (e.getAttribute('aria-label') || e.innerText || '').replace(/\s+/g, ' ').trim().includes(want));
    if (!el) return 'NOT_FOUND';
    el.click();
    return (el.getAttribute('aria-label') || el.innerText || '').trim().slice(0, 50);
  }, navLabel);
  await sleep(3500);
}

const shot = `${OUTDIR}/${outName}.png`;
await page.screenshot({ path: shot });
const dialogText = await page.evaluate(() => {
  const d = document.querySelector('[role="dialog"]');
  return d ? (d.innerText || '').replace(/\s+/g, ' ').slice(0, 2500) : '(no dialog)';
});

console.log(JSON.stringify({ shot, navItems, clicked, errs, dialogText }, null, 2));
await browser.close();
