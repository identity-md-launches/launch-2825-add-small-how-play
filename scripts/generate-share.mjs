// Optional regeneration of local share artwork from the real game canvases.
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { createPreview } from './preview.mjs';

const moduleArg = process.argv.indexOf('--playwright');
if (moduleArg < 0 || !process.argv[moduleArg + 1]) throw new Error('Pass --playwright /absolute/path/to/playwright/index.mjs');
const { chromium } = await import(pathToFileURL(resolve(process.argv[moduleArg + 1])).href);
const server = createPreview();
await new Promise(done => server.listen(0, '127.0.0.1', done));
let browser;
try {
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, reducedMotion: 'reduce' });
  await page.route('https://**', route => route.abort());
  await page.goto(`http://127.0.0.1:${server.address().port}/preview/`);
  await page.evaluate(() => document.fonts.ready);
  const image = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 630;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0b0b0d';
    ctx.fillRect(0, 0, 1200, 630);
    ctx.fillStyle = '#26262f';
    for (let x = 12; x < 1200; x += 14) for (let y = 12; y < 630; y += 14) ctx.fillRect(x, y, 1, 1);
    ctx.drawImage(document.getElementById('title'), 64, 112, 420, 68);
    ctx.drawImage(document.getElementById('c'), 620, 40, 550, 550);
    ctx.fillStyle = '#e6e6ec';
    ctx.font = '600 32px Quicksand';
    ctx.fillText('Drop hamsters.', 64, 266);
    ctx.fillText('Merge neighbours.', 64, 316);
    ctx.fillText('Beat the timer.', 64, 366);
    ctx.fillStyle = '#7fd4ff';
    ctx.font = '400 16px "IBM Plex Mono"';
    ctx.fillText('Powered by Squeekchain', 64, 488);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await writeFile('share.png', Buffer.from(image, 'base64'));
  console.log('share.png: 1200×630, existing logo and wheel artwork; no live data claims. Run the production build to copy it to dist/.');
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise(done => server.close(done));
}
