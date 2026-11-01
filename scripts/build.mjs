// Dependency-free production export. Only these runtime files are published.
import { cp, mkdir, readFile, readdir, rm, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const out = join(root, 'dist');
const files = [
  'index.html', 'app.css', 'main.js', 'decor.js',
  'how-to-play.js', 'how-to-play.css', 'favicon.svg', 'share.png',
  'LICENSE', 'LICENSES.txt', 'THIRD_PARTY_NOTICES.md',
];

// Validate every input before replacing the previous export.
for (const file of files) await readFile(join(root, file));
const fonts = (await readdir(join(root, 'fonts'))).filter(name => name.endsWith('.woff2'));
if (fonts.length !== 5) throw new Error('The five original local fonts are required.');
await rm(out, { recursive: true, force: true });
await mkdir(join(out, 'fonts'), { recursive: true });
for (const file of files) await cp(join(root, file), join(out, file));
for (const font of fonts) await cp(join(root, 'fonts', font), join(out, 'fonts', font));

const paths = [...files, ...fonts.map(font => `fonts/${font}`)];
const bytes = (await Promise.all(paths.map(path => stat(join(out, path))))).reduce((sum, file) => sum + file.size, 0);
console.log(`Production export: ${paths.length} files, ${bytes} bytes in dist/.`);
