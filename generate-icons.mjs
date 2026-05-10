import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent('<html><body></body></html>');

async function renderIcon(size) {
  const dataUrl = await page.evaluate((s) => {
    const canvas = document.createElement('canvas');
    canvas.width = s;
    canvas.height = s;
    const ctx = canvas.getContext('2d');

    // Purple rounded-rect background
    const r = s * 3 / 16;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(s - r, 0); ctx.quadraticCurveTo(s, 0, s, r);
    ctx.lineTo(s, s - r); ctx.quadraticCurveTo(s, s, s - r, s);
    ctx.lineTo(r, s);     ctx.quadraticCurveTo(0, s, 0, s - r);
    ctx.lineTo(0, r);     ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath();
    ctx.fillStyle = '#540D6E';
    ctx.fill();

    // Mint text-line rectangles
    ctx.fillStyle = '#9FFCDF';
    ctx.globalAlpha = 0.75;
    const lx = s * 3 / 16;
    const lh = s * 2 / 16;
    const lr = lh / 2;

    function roundRect(x, y, w, h, radius) {
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + w - radius, y); ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
      ctx.lineTo(x + w, y + h - radius); ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
      ctx.lineTo(x + radius, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
      ctx.lineTo(x, y + radius); ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
      ctx.fill();
    }

    roundRect(lx, s * 4.5 / 16, s * 10 / 16, lh, lr); // top line
    roundRect(lx, s * 9.5 / 16, s * 7 / 16,  lh, lr); // bottom line (shorter)

    // Diagonal slash
    ctx.globalAlpha = 1.0;
    ctx.strokeStyle = '#9FFCDF';
    ctx.lineWidth = s * 1.8 / 16;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(s * 2.5 / 16, s * 13.5 / 16);
    ctx.lineTo(s * 13.5 / 16, s * 2.5 / 16);
    ctx.stroke();

    return canvas.toDataURL('image/png');
  }, size);

  const base64 = dataUrl.replace('data:image/png;base64,', '');
  const buffer = Buffer.from(base64, 'base64');
  const outPath = path.join(__dirname, 'public', `icon-${size}.png`);
  writeFileSync(outPath, buffer);
  console.log(`✓ public/icon-${size}.png (${buffer.length} bytes)`);
}

for (const size of [16, 48, 128]) {
  await renderIcon(size);
}

await browser.close();
