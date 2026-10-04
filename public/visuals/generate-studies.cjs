/* Reproducible architectural specimen from the original ZEN Arcology geometry.
   Fixed composition values determine decorative tower heights; no metrics are encoded. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const scope = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'arcology-core.js'), 'utf8'), scope);
const scene = scope.window.Arcology.build({ ox: 340, oy: 148, tw: 49, values: { USD: 1, USDC: .72, BTC: .54, ETH: .38 }, f: 1, t: .25, hScale: 164, plinth: 19, dusk: true });
const shapes = (entries) => entries.map((item) => `<path d="${item.d}" fill="${item.fill || 'none'}" opacity="${item.op || 1}"${item.stroke ? ` stroke="${item.stroke}" stroke-width="${item.w || 1}"` : ''}/>`).join('');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 520"><defs><filter id="s"><feGaussianBlur stdDeviation="12"/></filter></defs><ellipse cx="340" cy="418" rx="220" ry="35" fill="#23392e" opacity=".13" filter="url(#s)"/>${shapes(scene.ground)}${shapes(scene.shadows.map((item) => ({ ...item, fill: scene.colors.shadow })))}${shapes(scene.items)}${shapes(scene.front)}${scene.lights.map((light) => `<circle cx="${light.x}" cy="${light.y}" r="1.3" fill="${scene.colors.light}"/>`).join('')}</svg>`;
fs.writeFileSync(path.join(__dirname, 'arcology-study.svg'), svg);
console.log('Arcology architectural specimen rendered from original geometry.');
