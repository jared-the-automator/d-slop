import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const browser = await chromium.launch();
const page = await browser.newPage();

async function renderIcon(size) {
  const r = size * 3 / 16;
  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:transparent">
<canvas id="c" width="${size}" height="${size}"></canvas>
<script>
const c = document.getElementById('c');
const ctx = c.getContext('2d');
const s = ${size};

// Purple background with rounded corners
ctx.beginPath();
const r = ${r};
ctx.moveTo(r, 0);
ctx.lineTo(s-r, 0); ctx.quadraticCurveTo(s,0,s,r);
ctx.lineTo(s, s-r); ctx.quadraticCurveTo(s,s,s-r,s);
ctx.lineTo(r, s); ctx.quadraticCurveTo(0,s,0,s-r);
ctx.lineTo(0, r); ctx.quadraticCurveTo(0,0,r,0);
ctx.closePath();
ctx.fillStyle = '#540D6E';
ctx.fill();

// Two mint text-line rects
ctx.globalAlpha = 0.75;
ctx.fillStyle = '#9FFCDF';
// Line 1
const rx = s*3/16, ry1 = s*4.5/16, rw = s*10/16, rh = s*2/16, rr = rh/2;
ctx.beginPath();
ctx.moveTo(rx+rr, ry1);
ctx.lineTo(rx+rw-rr, ry1); ctx.quadraticCurveTo(rx+rw,ry1,rx+rw,ry1+rr);
ctx.lineTo(rx+rw, ry1+rh-rr); ctx.quadraticCurveTo(rx+rw,ry1+rh,rx+rw-rr,ry1+rh);
ctx.lineTo(rx+rr, ry1+rh); ctx.quadraticCurveTo(rx,ry1+rh,rx,ry1+rh-rr);
ctx.lineTo(rx, ry1+rr); ctx.quadraticCurveTo(rx,ry1,rx+rr,ry1);
ctx.closePath();
ctx.fill();
// Line 2
const ry2 = s*9.5/16, rw2 = s*7/16;
ctx.beginPath();
ctx.moveTo(rx+rr, ry2);
ctx.lineTo(rx+rw2-rr, ry2); ctx.quadraticCurveTo(rx+rw2,ry2,rx+rw2,ry2+rr);
ctx.lineTo(rx+rw2, ry2+rh-rr); ctx.quadraticCurveTo(rx+rw2,ry2+rh,rx+rw2-rr,ry2+rh);
ctx.lineTo(rx+rr, ry2+rh); ctx.quadraticCurveTo(rx,ry2+rh,rx,ry2+rh-rr);
ctx.lineTo(rx, ry2+rr); ctx.quadraticCurveTo(rx,ry2,rx+rr,ry2);
ctx.closePath();
ctx.fill();

// Diagonal slash
ctx.globalAlpha = 1.0;
ctx.strokeStyle = '#9FFCDF';
ctx.lineWidth = s * 1.8 / 16;
ctx.lineCap = 'round';
ctx.beginPath();
ctx.moveTo(s*2.5/16, s*13.5/16);
ctx.lineTo(s*13.5/16, s*2.5/16);
ctx.stroke();
</script></body></html>`;

  await page.setContent(html);
  await page.waitForFunction(() => !!document.getElementById('c'));
  await page.setViewportSize({ width: size, height: size });

  const dataUrl = await page.evaluate(() => {
    return document.getElementById('c').toDataURL('image/png');
  });

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
