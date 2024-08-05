#!/usr/bin/env node

import * as esbuild from 'esbuild'

let external = [
  'assert',
  'child_process',
  'constants',
  'crypto',
  'events',
  'fs',
  'fs/promises',
  'os',
  'path',
  'stream',
  'string_decoder',
  'url',
  'util',
  'zlib',
]
external = external.concat(external.map(m => `node:${m}`))

for (const bin of ['branches', 'link', 'release', 'zipup']) {
  await esbuild.build({
    entryPoints: [`bin/${bin}.ts`],
    bundle: true,
    outfile: `bin/${bin}.js`,
    external,
  })
}
