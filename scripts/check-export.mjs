import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = join(root, 'dist');
const preservation = JSON.parse(await readFile(join(root, 'artifacts/preservation.json'), 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const originalFiles = Object.keys(preservation.unchangedFiles);
for (const file of originalFiles) {
  assert.equal(hash(await readFile(join(root, file))), preservation.unchangedFiles[file].sha256, `${file} must preserve the supplied source`);
}
const html = await readFile(join(dist, 'index.html'), 'utf8');
assert.equal(html.match(/<meta http-equiv="Content-Security-Policy"[^>]+>/)?.[0], preservation.contentSecurityPolicy);
for (const meta of ['description', 'og:title', 'og:image']) assert.ok(html.includes(`="${meta}"`));
assert.ok(/<title>Wheel Merge<\/title>/.test(html));
assert.ok(html.includes('rel="icon"'));

const resources = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(match => match[1]);
resources.push(html.match(/property="og:image" content="([^"]+)"/)[1]);
for (const file of resources) {
  assert.ok(!file.startsWith('/') && !file.includes(':'), `Asset must be relative: ${file}`);
  assert.ok((await readFile(join(dist, file))).length > 0, `Missing runtime asset ${file}`);
}
const css = await readFile(join(dist, 'app.css'), 'utf8');
for (const match of css.matchAll(/url\("([^"]+)"\)/g)) assert.ok((await readFile(join(dist, match[1]))).length > 0);

async function tree(path) {
  const files = [];
  for (const entry of await readdir(path, { withFileTypes: true })) {
    // Inputs, scratch evidence and forbidden/configuration directories are never read.
    if (entry.name.startsWith('.') || ['node_modules', 'test'].includes(entry.name)) continue;
    const file = join(path, entry.name);
    if (entry.isDirectory()) files.push(...await tree(file));
    else if (entry.isFile()) files.push(file);
    else throw new Error('The delivery must contain ordinary files, not symlinks.');
  }
  return files;
}
const exported = await tree(dist);
assert.equal(exported.length, 16, 'Export contains only the 16 required runtime/license files');
for (const file of exported) {
  const source = file.replace(dist, root.replace(/\/$/, ''));
  assert.equal(hash(await readFile(file)), hash(await readFile(source)), `Export differs from source: ${file.slice(dist.length + 1)}`);
}
const png = await readFile(join(dist, 'share.png'));
assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
assert.equal(png.readUInt32BE(16), 1200);
assert.equal(png.readUInt32BE(20), 630);
assert.ok((await readFile(join(dist, 'favicon.svg'), 'utf8')).startsWith('<svg'));
const totalBytes = (await Promise.all((await tree(root)).map(file => readFile(file)))).reduce((sum, bytes) => sum + bytes.length, 0);
assert.ok(totalBytes <= 8388608, 'Delivery exceeds 8 MiB');
console.log(`Export integrity passed: ${exported.length} files, source/export identical, relative assets resolve, CSP and original runtime preserved. Delivery: ${totalBytes} bytes (limit 8388608).`);
