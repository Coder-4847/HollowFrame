import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const root = path.resolve('dist');
async function walk(dir) {
  const result = [];
  for (const item of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, item.name);
    if (item.isDirectory()) result.push(...(await walk(p)));
    else if (item.name !== 'release-manifest.json') result.push(p);
  }
  return result;
}
const files = [];
for (const p of (await walk(root)).sort()) {
  const bytes = await fs.readFile(p);
  files.push({
    path: path.relative(root, p).replaceAll('\\', '/'),
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  });
}
const pkg = JSON.parse(await fs.readFile('package.json', 'utf8'));
await fs.writeFile(
  path.join(root, 'release-manifest.json'),
  JSON.stringify(
    {
      name: pkg.name,
      version: pkg.version,
      totalBytes: files.reduce((n, f) => n + f.bytes, 0),
      files,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  `Manifest: ${files.length} assets, ${files.reduce((n, f) => n + f.bytes, 0)} bytes, ${pkg.version}`,
);
