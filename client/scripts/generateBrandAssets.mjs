// Renders favicon.ico, apple-touch-icon.png and og.png from the brand mark. Run once: `node scripts/generateBrandAssets.mjs`.
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const MARK = `<rect width="24" height="24" rx="6" fill="#138b3c"/>
<g stroke="#f3fff6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none">
  <path d="M6.5 17.5V7l5.5 6.5"/><path d="M12 13.5 17.5 7v10.5"/></g>`;
const svg = (size) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">${MARK}</svg>`;

const BRAND_FONT = readFileSync(
  'node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2',
).toString('base64');
const FONT_FACE = `<style>@font-face{font-family:'Inter';font-weight:100 900;src:url(data:font/woff2;base64,${BRAND_FONT}) format('woff2')}</style>`;

const browser = await chromium.launch();
const page = await browser.newPage();

async function renderPng(html, width, height) {
  await page.setViewportSize({ width, height });
  await page.setContent(`${FONT_FACE}<body style="margin:0">${html}</body>`);
  await page.evaluate(() => document.fonts.ready);
  return page.screenshot({ omitBackground: false });
}

const apple = await renderPng(
  `<div style="width:180px;height:180px;background:#138b3c;display:grid;place-items:center">${svg(120).replace('<rect width="24" height="24" rx="6" fill="#138b3c"/>', '')}</div>`,
  180,
  180,
);
writeFileSync('public/apple-touch-icon.png', apple);

const icon32 = await renderPng(svg(32), 32, 32);
// An ICO file may embed a PNG: 6-byte header + one 16-byte entry + the PNG data.
const header = Buffer.alloc(22);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);
header[6] = 32;
header[7] = 32;
header.writeUInt16LE(1, 12);
header.writeUInt16LE(32, 14);
header.writeUInt32LE(icon32.length, 14 + 2);
header.writeUInt32LE(22, 18);
writeFileSync('public/favicon.ico', Buffer.concat([header, icon32]));

const og = await renderPng(
  `<div style="width:1200px;height:630px;background:#f7fbf8;display:flex;flex-direction:column;justify-content:center;gap:28px;padding:0 96px;box-sizing:border-box">
     <div style="display:flex;align-items:center;gap:24px">${svg(96)}<span style="font:800 88px 'Inter',sans-serif;letter-spacing:-0.03em;color:#10231a">Margin</span></div>
     <div style="font:500 40px 'Inter',sans-serif;color:#4d6357">Premium tech, made simple.</div>
   </div>`,
  1200,
  630,
);
writeFileSync('public/og.png', og);
await browser.close();
console.log('Brand assets written to public/');
