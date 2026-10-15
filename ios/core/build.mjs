// Construit la logique partagée de l'appli iPhone : node ios/core/build.mjs
// (src/lib de la version web, avec store.js et supa.js remplacés) → ios/Alipto/Resources/Core/alipto-core.js
import { build } from 'esbuild';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const out = path.join(root, 'ios/Alipto/Resources/Core');
const swap = {
  [path.join(root, 'src/lib/store.js')]: path.join(here, 'store-shim.js'),
  [path.join(root, 'src/lib/supa.js')]: path.join(here, 'supa-shim.js')
};
const shims = {
  name: 'shims',
  setup(b) {
    b.onResolve({ filter: /^\.{1,2}\// }, args => {
      const p = path.resolve(args.resolveDir, args.path);
      if (swap[p]) return { path: swap[p] };
      if (/push\.js$|restpush\.js$|audio\.js$|account\.js$|mock\.js$|config\.js$|theme\.js$|update\.js$/.test(p)) return { path: p, namespace: 'empty' };
      return null;
    });
    b.onLoad({ filter: /.*/, namespace: 'empty' }, () => ({ contents: 'export default {};', loader: 'js' }));
  }
};
fs.mkdirSync(out, { recursive: true });
await build({
  entryPoints: [path.join(here, 'entry.js')],
  bundle: true, format: 'iife', target: 'es2020', minify: false, legalComments: 'none',
  outfile: path.join(out, 'alipto-core.js'),
  plugins: [shims],
  define: { 'import.meta.env': '{"BASE_URL":"/"}' },
  logLevel: 'warning'
});
fs.copyFileSync(path.join(root, 'public/aliments.json'), path.join(out, 'aliments.json'));
const kb = Math.round(fs.statSync(path.join(out, 'alipto-core.js')).size / 1024);
console.log('alipto-core.js : ' + kb + ' Ko');
