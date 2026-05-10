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

    // Diagonal strikethrough (drawn first, S renders on top)
    ctx.strokeStyle = '#9FFCDF';
    ctx.lineWidth = s * 0.9 / 16;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(s * 2.5 / 16, s * 13.5 / 16);
    ctx.lineTo(s * 13.5 / 16, s * 2.5 / 16);
    ctx.stroke();

    // Backwards (mirrored) "S" in mint — drawn on top of slash
    // Use actualBoundingBox metrics to visually center the glyph
    ctx.save();
    ctx.translate(s, 0);
    ctx.scale(-1, 1);
    ctx.fillStyle = '#9FFCDF';
    ctx.font = `900 ${Math.round(s * 0.92)}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const m = ctx.measureText('S');
    const y = s / 2 + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
    ctx.fillText('S', s / 2, y);
    ctx.restore();

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
