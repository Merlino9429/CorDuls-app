// Cloudflare Workers reindirizza i percorsi con "@" (es. /assets/node_modules/@expo/...)
// alla forma codificata "%40", e alcuni browser finiscono in un ciclo di redirect:
// il font delle icone non si carica. Qui rinominiamo le cartelle con "@" e
// aggiorniamo i riferimenti nel bundle. Lo esegue `wrangler deploy` (vedi wrangler.jsonc).
import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve('dist');
const assets = path.join(dist, 'assets');
if (!fs.existsSync(assets)) {
  console.error('dist/assets non trovato: esegui prima `npx expo export --platform web`');
  process.exit(1);
}

const renames = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      let target = full;
      if (entry.name.includes('@')) {
        target = path.join(dir, entry.name.replaceAll('@', '_at_'));
        fs.renameSync(full, target);
        renames.push([entry.name, path.basename(target)]);
      }
      walk(target);
    }
  }
}
walk(assets);

if (renames.length) {
  const jsDir = path.join(dist, '_expo');
  const files = [];
  (function collect(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) collect(f);
      else if (f.endsWith('.js') || f.endsWith('.html')) files.push(f);
    }
  })(jsDir);
  files.push(path.join(dist, 'index.html'));
  let changed = 0;
  for (const f of files) {
    if (!fs.existsSync(f)) continue;
    let s = fs.readFileSync(f, 'utf8');
    const before = s;
    for (const [from, to] of renames) s = s.replaceAll(`/assets/node_modules/${from}/`, `/assets/node_modules/${to}/`);
    if (s !== before) { fs.writeFileSync(f, s); changed++; }
  }
  console.log(`Percorsi con "@" rinominati: ${renames.map((r) => r.join(' → ')).join(', ')} (${changed} file aggiornati)`);
} else {
  console.log('Nessun percorso con "@" da sistemare');
}
