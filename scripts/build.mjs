import { build } from 'esbuild';
import { mkdir, writeFile, copyFile, readFile } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
await build({ entryPoints: ['src/background.ts', 'src/font-access.ts'], outdir: 'dist', bundle: true, format: 'esm', target: 'chrome120', legalComments: 'eof' });
// Retain SVG shapes with paint-server fills so our paint pass can resolve them.
// Guard the exact pinned converter hook; fail loudly if upstream changes it.
const svgPaintServerPlugin = { name:'svg-paint-server', setup(build) {
  build.onLoad({filter:/dom-to-figma\/dist\/figma\.mjs$/},async args=>{
    const source=await readFile(args.path,'utf8');
    const marker='if (TRANSPARENT_COLOR_VALUES.includes(cssColor)) return null;';
    if(source.split(marker).length!==2)throw new Error('Converter SVG paint hook changed; review integration.');
    return {contents:source.replace(marker,marker+'\n\tif (cssColor.trim().startsWith("url(")) return null;'),loader:'js'};
  });
} };
await build({ entryPoints: ['src/content.ts'], outdir: 'dist', bundle: true, format: 'iife', plugins:[svgPaintServerPlugin], target: 'chrome120', legalComments: 'eof' });
await copyFile('src/font-access.html', 'dist/font-access.html');
await writeFile('dist/manifest.json', JSON.stringify({
  manifest_version: 3, name: 'UI Snipping Tool', version: '0.1.0',
  description: 'Select a webpage component and copy editable layers into Figma.',
  permissions: ['activeTab', 'scripting', 'clipboardWrite'],
  background: { service_worker: 'background.js', type: 'module' },
  options_page: 'font-access.html',
  action: { default_title: 'Select a component to copy to Figma' },
  commands: { 'toggle-picker': { suggested_key: { default: 'Alt+Shift+C', mac: 'Alt+Shift+C' }, description: 'Select a component' } }
}, null, 2));
