/**
 * End-to-end tests for C2PA media detection.
 *
 * Uses Playwright's bundled Chromium (not system Chrome — system Chrome blocks
 * --load-extension via policy). Must run with DISPLAY set (headless:false required
 * for extension support).
 *
 * Test 1: Starts a local HTTP server serving bytes with the C2PA JUMBF UUID
 *         embedded, loads the extension, navigates to the page, and asserts
 *         the orange badge appears.
 *
 * Test 2: Loads the popup HTML and asserts Text/Media sections are present
 *         and "D-slop+" text is absent.
 */

import { test, expect, chromium } from 'playwright/test';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_PATH = path.resolve(__dirname, '../../.output/chrome-mv3');

const C2PA_UUID = Buffer.from([
  0xca, 0x7a, 0x7a, 0x7a, 0x00, 0x00, 0x11, 0x00,
  0x80, 0x00, 0x00, 0xaa, 0x00, 0x38, 0x9b, 0x71,
]);

function makeC2PABytes(): Buffer {
  const prefix = Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...new Array(64).fill(0x00)]);
  return Buffer.concat([prefix, C2PA_UUID, Buffer.alloc(64, 0xff)]);
}

function startServer(): Promise<{ port: number; close: () => void }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (req.url === '/c2pa.jpg') {
        const bytes = makeC2PABytes();
        res.writeHead(200, {
          'Content-Type': 'image/jpeg',
          'Content-Length': bytes.length,
          'Access-Control-Allow-Origin': '*',
        });
        res.end(bytes);
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<!doctype html>
<html><body>
  <img src="/c2pa.jpg" id="test-image" style="width:200px;height:200px" />
</body></html>`);
    });
    server.listen(0, '127.0.0.1', () => {
      resolve({ port: (server.address() as { port: number }).port, close: () => server.close() });
    });
    server.on('error', reject);
  });
}

const LAUNCH_OPTS = {
  headless: false,
  args: [
    `--disable-extensions-except=${EXTENSION_PATH}`,
    `--load-extension=${EXTENSION_PATH}`,
    '--no-sandbox',
    '--disable-dev-shm-usage',
  ],
};

async function getExtensionId(context: Awaited<ReturnType<typeof chromium.launchPersistentContext>>): Promise<string> {
  const existing = context.serviceWorkers();
  if (existing.length > 0) return existing[0].url().split('/')[2];
  const sw = await context.waitForEvent('serviceworker', { timeout: 10_000 });
  return sw.url().split('/')[2];
}

test('C2PA image is flagged with orange badge in highlight mode', async () => {
  const { port, close } = await startServer();
  const context = await chromium.launchPersistentContext('', LAUNCH_OPTS);

  try {
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${port}/`);

    await page.waitForSelector('#test-image[data-dslop-media-scanned]', { timeout: 12_000 });

    const badge = page.locator('.dslop-media-badge').first();
    await expect(badge).toBeVisible({ timeout: 5_000 });
    await expect(badge).toContainText('C2PA');

    // Orange outline applied via inline style
    const outline = await page.locator('#test-image').evaluate(
      el => (el as HTMLElement).style.outline
    );
    expect(outline).toMatch(/255.*140.*0/);
  } finally {
    await context.close();
    close();
  }
});

test('popup renders Text and Media sections without D-slop+ text', async () => {
  const context = await chromium.launchPersistentContext('', LAUNCH_OPTS);

  try {
    const extensionId = await getExtensionId(context);
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    await expect(page.locator('text=Text')).toBeVisible();
    await expect(page.locator('text=Media')).toBeVisible();
    await expect(page.locator('text=C2PA scanning active')).toBeVisible();
    await expect(page.locator('text=D-slop+')).not.toBeVisible();
  } finally {
    await context.close();
  }
});
