#!/usr/bin/env node

import { build } from 'esbuild'
import { platform } from 'os'
import { chmod, readFile } from 'fs/promises'

const pkg = JSON.parse(await readFile('package.json', 'utf-8'))
const external = [ ...Object.keys(pkg.dependencies), ...Object.keys(pkg.devDependencies) ]
  .map(dep => dep.replace(/^node:/, ''))
  .map(dep => [ dep, `node:${dep}` ])
  .flat()

for (const bin of ['start', 'fetch-log', 'keypair', 'branches', 'link', 'release', 'zipup']) {
  const outfile = `bin/${bin}.mjs`
  await build({
    entryPoints: [`bin/${bin}.ts`],
    bundle: true,
    outfile,
    external,
    platform: 'node',
    format: 'esm'
  })

  switch (platform()) {
    case 'darwin':
    case 'linux':
      await chmod(outfile, 0o755);
  }
}
