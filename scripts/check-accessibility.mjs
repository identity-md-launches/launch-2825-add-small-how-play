import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createPreview } from './preview.mjs';

const argument = flag => {
  const i = process.argv.indexOf(flag);
  if (i < 0 || !process.argv[i + 1]) throw new Error(`Pass ${flag} with an absolute module path`);
  return resolve(process.argv[i + 1]);
};
const { chromium } = await import(pathToFileURL(argument('--playwright')).href);
const axe = createRequire(import.meta.url)(argument('--axe'));
const AxeBuilder = axe.default ?? axe;
const server = createPreview();
await new Promise(done => server.listen(0, '127.0.0.1', done));
let browser;
const output = 'test/scratch/accessibility';
await mkdir(output, { recursive: true });
try {
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const initialConsoleErrors = [];
  page.on('console', message => {
    if (message.type() === 'error') initialConsoleErrors.push(message.text());
  });
  await page.route('https://**', route => route.abort());
  await page.goto(`http://127.0.0.1:${server.address().port}/preview/`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState('networkidle');
  const loadConsoleErrors = [...initialConsoleErrors];
  const overlay = await new AxeBuilder({ page }).include('#playHelp').analyze();
  const measured = await page.evaluate(() => {
    const style = selector => getComputedStyle(document.querySelector(selector));
    const rgb = color => color.match(/[\d.]+/g).slice(0, 3).map(Number);
    const luminance = color => rgb(color).map(value => {
      value /= 255;
      return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
    }).reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
    const ratio = (foreground, background) => {
      const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
      return Math.round((values[0] + .05) / (values[1] + .05) * 100) / 100;
    };
    const background = style('#playHelp').backgroundColor;
    const pairs = [
      ['rules', style('#playHelp ol').color, background],
      ['title', style('#playHelp h2').color, background],
      ['numbers', getComputedStyle(document.querySelector('#playHelp li'), '::marker').color, background],
      ['close', style('#closePlayHelp').color, style('#closePlayHelp').backgroundColor],
    ].map(([name, foreground, background]) => ({ name, foreground, background, contrast: ratio(foreground, background) }));
    const fonts = [...document.fonts].filter(font => ['Quicksand', 'Barlow Condensed', 'IBM Plex Mono'].includes(font.family.replaceAll('"', ''))).map(font => ({ family: font.family, weight: font.weight, status: font.status }));
    return { pairs, fonts };
  });
  assert.ok(measured.pairs.every(pair => pair.contrast >= 4.5));
  await page.keyboard.press('Escape');
  const trigger = await new AxeBuilder({ page }).include('#howToPlay').analyze();
  const summarize = result => ({ violations: result.violations.map(item => ({ id: item.id, impact: item.impact, description: item.description, targets: item.nodes.flatMap(node => node.target) })), passes: result.passes.length, incomplete: result.incomplete.map(item => item.id) });
  const report = { overlay: summarize(overlay), trigger: summarize(trigger), ...measured, initialConsoleErrors: loadConsoleErrors, limitation: 'Scoped automated audit and computed opaque text pairs only; not a screen-reader session or a whole-game accessibility certification.' };
  await writeFile(`${output}/results.json`, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  assert.equal(overlay.violations.length + trigger.violations.length, 0);
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise(done => server.close(done));
}
