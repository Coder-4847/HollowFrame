import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
const root = path.resolve('dist');
const requests = [];
const errors = [];
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain',
};
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (!url.pathname.startsWith('/hollowframe/')) {
      res.writeHead(404);
      res.end();
      return;
    }
    const rel = decodeURIComponent(url.pathname.slice('/hollowframe/'.length)) || 'index.html';
    const file = path.resolve(root, rel);
    if (!file.startsWith(root + path.sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    const data = await fs.readFile(file);
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((resolve) => server.listen(4174, '127.0.0.1', resolve));
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => {
    if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
  });
  await page.route('**/*', (route) => {
    requests.push(route.request().url());
    if (route.request().url().startsWith('http://127.0.0.1:4174/')) route.continue();
    else route.abort();
  });
  await page.goto('http://127.0.0.1:4174/hollowframe/');
  await page.getByRole('button', { name: /SELECT OPERATION/ }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.evaluate(() => typeof window.__HOLLOWFRAME__), 'undefined');
  await page.getByRole('button', { name: /SELECT OPERATION/ }).click();
  await page.getByRole('button', { name: /DEPLOY TO ASHWORKS/ }).click();
  await page.waitForFunction(() => !!document.pointerLockElement);
  await page.locator('#weapon-name').waitFor();
  await page.waitForTimeout(300);
  assert.equal(await page.locator('#weapon-name').textContent(), 'RIVET / 31');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /RESUME OPERATION/ }).waitFor();
  assert.equal(errors.length, 0);
  assert.ok(requests.every((u) => u.startsWith('http://127.0.0.1:4174/')));
  await fs.mkdir('artifacts', { recursive: true });
  await fs.writeFile(
    'artifacts/production.json',
    JSON.stringify(
      {
        passed: true,
        subdirectory: '/hollowframe/',
        debugHandle: false,
        externalRequests: 0,
        requests: requests.length,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    'PASS production subdirectory mount, fonts, deployment, pause, no debug handle, no external requests, no errors',
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
