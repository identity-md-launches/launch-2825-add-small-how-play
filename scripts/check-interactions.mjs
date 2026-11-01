// Exercises the actual export. Playwright is external tooling, never a site asset.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { createPreview } from './preview.mjs';

const moduleArg = process.argv.indexOf('--playwright');
if (moduleArg < 0 || !process.argv[moduleArg + 1]) {
  throw new Error('Pass --playwright /absolute/path/to/playwright/index.mjs');
}
const { chromium, webkit } = await import(pathToFileURL(resolve(process.argv[moduleArg + 1])).href);
const output = 'test/scratch/interactions';
await mkdir(output, { recursive: true });
const server = createPreview();
await new Promise(done => server.listen(0, '127.0.0.1', done));
const url = `http://127.0.0.1:${server.address().port}/preview/`;
const results = [];
const seenKey = 'wheel-merge:how-to-play:seen';
const expectedRules = [
  'Drop hamsters into the turning wheel.',
  'Two neighbours of the same level merge into the next level.',
  'Merges add time to the timer.',
  'A completed Squeekchain block gives you a joker.',
  'Live mode follows the real Squeekchain wheel speed.',
];

const isOpen = page => page.locator('#playHelp').evaluate(dialog => dialog.open);
const activeId = page => page.evaluate(() => document.activeElement?.id);
const time = page => page.locator('#time').textContent();

async function run(browserType, name) {
  let browser;
  try { browser = await browserType.launch({ headless: true }); }
  catch (error) {
    // A runtime failure is a limitation, never a successful WebKit check.
    const reason = /missing dependencies|cannot open shared object/i.test(error.message)
      ? 'Playwright could not launch this engine because required browser runtime libraries are unavailable.'
      : error.message.split('\n').find(line => line.trim() && line.trim() !== 'browserType.launch:') ?? 'Browser launch failed.';
    results.push({ browser: name, status: 'unavailable', reason });
    if (name === 'Chromium') throw error;
    return;
  }
  const errors = [], missing = [], outsideHosts = new Set();
  async function context(options = {}) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, ...options });
    await ctx.route('**/*', route => {
      const requestUrl = new URL(route.request().url());
      if (requestUrl.origin === new URL(url).origin) return route.continue();
      outsideHosts.add(requestUrl.host);
      return route.abort(); // No invented API/RPC responses and no wallet/signing.
    });
    ctx.on('page', page => {
      page.on('pageerror', error => errors.push(error.message));
      page.on('response', response => {
        if (response.url().startsWith(url) && response.status() >= 400) missing.push(response.url());
      });
    });
    return ctx;
  }
  try {
    const ctx = await context();
    const page = await ctx.newPage();
    await page.goto(url);
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await isOpen(page), true, 'Fresh storage opens the introduction');
    assert.deepEqual(await page.locator('#playHelp li').allTextContents(), expectedRules);
    assert.equal(await activeId(page), 'closePlayHelp', 'Opening focuses Close');
    for (const key of ['Tab', 'Shift+Tab']) {
      await page.keyboard.press(key);
      assert.equal(await activeId(page), 'closePlayHelp', 'Tab stays in the modal');
    }
    await page.locator('#playHelp').evaluate(dialog => dialog.focus());
    for (const key of ['Space', 'ArrowLeft', 'ArrowRight', 'r']) await page.keyboard.press(key);
    assert.equal(await time(page), '30.0', 'Modal keys do not start the game');
    const drop = await page.locator('#drop').boundingBox();
    await page.mouse.click(drop.x + drop.width / 2, drop.y + drop.height / 2);
    assert.equal(await time(page), '30.0', 'Modal blocks background pointer input');
    assert.equal(await isOpen(page), true, 'Backdrop click keeps the help open');
    await page.locator('#closePlayHelp').focus();
    await page.screenshot({ path: `${output}/${name.toLowerCase()}-390-help.png` });
    await page.keyboard.press('Escape');
    assert.equal(await isOpen(page), false);
    assert.equal(await activeId(page), 'howToPlay', 'Escape restores focus to the trigger');
    await page.keyboard.press('Enter');
    assert.equal(await isOpen(page), true, 'Keyboard activation reopens help');
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    assert.equal(await isOpen(page), false);
    assert.equal(await activeId(page), 'howToPlay', 'Close button restores focus');
    await page.reload();
    assert.equal(await isOpen(page), false, 'Reload does not repeat the introduction');
    const secondTab = await ctx.newPage();
    await secondTab.goto(url);
    assert.equal(await isOpen(secondTab), false, 'Another tab shares first-visit memory');
    await secondTab.close();

    const geometry = [];
    for (const width of [320, 390, 860, 1024, 1440]) {
      await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
      await page.evaluate(() => window.scrollTo(0, 0));
      const game = await page.locator('#c').boundingBox();
      const action = await page.locator('#drop').boundingBox();
      const trigger = await page.locator('#howToPlay').boundingBox();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.ok(overflow <= 1, `No page overflow at ${width}`);
      assert.ok(trigger.width >= 44 && trigger.height >= 44);
      if (width === 390) {
        assert.ok(action.y + action.height <= 844, '390px first screen contains Drop');
        assert.ok(game.y < 844, '390px first screen contains the wheel');
        await page.screenshot({ path: `${output}/${name.toLowerCase()}-390-game.png` });
      }
      if (width === 1440) await page.screenshot({ path: `${output}/${name.toLowerCase()}-1440-game.png` });
      if (width === 320) await page.screenshot({ path: `${output}/${name.toLowerCase()}-320-game.png` });
      await page.locator('#howToPlay').click();
      const modal = await page.locator('#playHelp').boundingBox();
      assert.ok(modal.x >= 0 && modal.x + modal.width <= width + 1);
      assert.ok(modal.y >= 0 && modal.y + modal.height <= (width === 1440 ? 900 : 844) + 1);
      if (width === 320 || width === 1440) await page.screenshot({ path: `${output}/${name.toLowerCase()}-${width}-help.png` });
      await page.keyboard.press('Escape');
      geometry.push({ width, dropBottom: Math.round(action.y + action.height), triggerWidth: Math.round(trigger.width), overflow });
    }

    // Primary practice interactions are independent of the deliberately blocked APIs.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#mode').selectOption('idle');
    await page.locator('[data-source="local"]').click();
    await page.locator('#drop').click();
    await page.waitForFunction(() => Number(document.getElementById('time').textContent) < 30);
    await page.locator('#restart').click();
    assert.equal(await time(page), '30.0', 'Restart resets the practice timer');
    await page.locator('#c').click();
    await page.waitForFunction(() => Number(document.getElementById('time').textContent) < 30);
    await page.locator('#restart').click();
    await page.locator('#c').evaluate(canvas => canvas.focus());
    await page.evaluate(() => document.activeElement?.blur());
    await page.keyboard.press('Space');
    await page.waitForFunction(() => Number(document.getElementById('time').textContent) < 30);
    await page.keyboard.press('r');
    await page.waitForFunction(() => document.getElementById('time').textContent === '30.0');
    assert.equal(await time(page), '30.0', 'The original keyboard restart still works');
    await page.locator('#mode').selectOption('spin');
    assert.equal(await time(page), '30.0', 'Changing modes resets the game');
    await page.locator('#mode').selectOption('live');

    // A short landscape viewport must keep the closing control reachable.
    await page.setViewportSize({ width: 568, height: 320 });
    await page.locator('#howToPlay').click();
    await page.locator('#closePlayHelp').click();
    assert.equal(await isOpen(page), false);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#howToPlay').click();
    await page.evaluate(() => {
      document.querySelector('#playHelp ol').style.fontSize = '28px';
      document.querySelector('#playHelp h2').style.fontSize = '52px';
    });
    await page.locator('#closePlayHelp').click();
    assert.equal(await isOpen(page), false, 'Close remains reachable with doubled modal text');
    await ctx.close();

    const reduced = await context({ reducedMotion: 'reduce', forcedColors: 'active' });
    const reducedPage = await reduced.newPage();
    await reducedPage.goto(url);
    await reducedPage.keyboard.press('Tab');
    const focusStyle = await reducedPage.locator('#closePlayHelp').evaluate(button => {
      const style = getComputedStyle(button);
      return { style: style.outlineStyle, width: style.outlineWidth, color: style.outlineColor };
    });
    assert.equal(focusStyle.style, 'solid');
    assert.equal(focusStyle.width, '2px');
    assert.equal(await reducedPage.locator('#playHelp').evaluate(dialog => dialog.getAnimations({ subtree: true }).length), 0);
    await reducedPage.keyboard.press('Escape');
    await reduced.close();

    // A failed localStorage write uses sessionStorage for the same tab/session.
    const fallback = await context();
    await fallback.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked by test', 'SecurityError'); } }));
    const fallbackPage = await fallback.newPage();
    await fallbackPage.goto(url);
    assert.equal(await isOpen(fallbackPage), true);
    await fallbackPage.keyboard.press('Escape');
    await fallbackPage.reload();
    assert.equal(await isOpen(fallbackPage), false);
    await fallbackPage.locator('#howToPlay').click();
    assert.equal(await isOpen(fallbackPage), true);
    await fallback.close();

    const blocked = await context();
    await blocked.addInitScript(() => {
      for (const name of ['localStorage', 'sessionStorage']) Object.defineProperty(window, name, { get() { throw new DOMException('Blocked by test', 'SecurityError'); } });
    });
    const blockedPage = await blocked.newPage();
    await blockedPage.goto(url);
    assert.equal(await isOpen(blockedPage), true);
    await blockedPage.keyboard.press('Escape');
    await blockedPage.locator('#howToPlay').click();
    await blockedPage.locator('#closePlayHelp').click();
    assert.equal(await isOpen(blockedPage), false, 'Storage failures never break help');
    await blocked.close();

    assert.deepEqual(errors, [], 'No uncaught script errors');
    assert.deepEqual(missing, [], 'No failed local export resources');
    assert.deepEqual([...outsideHosts].sort(), ['api.squeekchain.com', 'ethereum-sepolia-rpc.publicnode.com']);
    results.push({ browser: name, status: 'passed', checks: 'first visit, persistence, reopen, close, Escape, focus, keyboard and pointer isolation, responsive geometry, drop, restart, modes, local leaderboard, short viewport, doubled text, reduced motion, forced colors, storage failure, resource integrity', geometry, blockedExistingHosts: [...outsideHosts].sort(), uncaughtErrors: errors.length, missingLocalResources: missing.length });
  } finally { await browser.close(); }
}

try {
  await run(chromium, 'Chromium');
  await run(webkit, 'WebKit');
} catch (error) {
  results.push({ status: 'failed', reason: error.stack });
  process.exitCode = 1;
} finally {
  server.closeAllConnections();
  await new Promise(done => server.close(done));
  await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2) + '\n');
  console.log(JSON.stringify(results, null, 2));
}
