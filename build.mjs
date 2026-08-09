import { build } from 'esbuild'
import { globSync } from 'glob'
import { cp, mkdir, mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'

const entryPoints = globSync(['*.ts', 'bin/*.ts', 'loader/*.ts'], {
  ignore: ['tsup.config.ts'],
}).sort()

const pkg = JSON.parse(await readFile(new URL('./package.json', import.meta.url), 'utf8'))
const external = Object.keys(pkg.dependencies || {})

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = await Promise.all(entries.map(async entry => {
    const path = join(dir, entry.name)
    return entry.isDirectory() ? walk(path) : [path]
  }))
  return files.flat()
}

async function emitDeclarations() {
  const tempDir = await mkdtemp(join(tmpdir(), 'zotero-plugin-types-'))

  try {
    const result = spawnSync('npx', [
      'tsc',
      '--emitDeclarationOnly',
      '--declaration',
      '--outDir', tempDir,
    ], { stdio: 'inherit' })

    if (result.error) throw result.error
    if (result.status && result.status !== 0) {
      throw new Error(`declaration build failed with exit code ${result.status}`)
    }

    const files = (await walk(tempDir)).filter(file => file.endsWith('.d.ts'))
    if (!files.length) {
      throw new Error('declaration build did not produce any .d.ts files')
    }

    await Promise.all(files.flatMap(file => {
      const rel = relative(tempDir, file)
      const esmTarget = join('dist/esm', rel)
      const cjsTarget = join('dist/cjs', rel.replace(/\.d\.ts$/, '.d.cts'))

      return [
        mkdir(join(esmTarget, '..'), { recursive: true }).then(() => cp(file, esmTarget)),
        mkdir(join(cjsTarget, '..'), { recursive: true }).then(() => cp(file, cjsTarget)),
      ]
    }))

  }
  finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

const jsonToJsPlugin = {
  name: 'json-to-js',
  setup(build) {
    build.onLoad({ filter: /\.json$/ }, async args => {
      const json = await readFile(args.path, 'utf8')
      return {
        contents: `export default ${json}`,
        loader: 'js',
      }
    })
  },
}

const shared = {
  entryPoints,
  outbase: '.',
  bundle: true,
  external,
  platform: 'node',
  sourcemap: true,
  splitting: false,
  target: 'es2022',
  tsconfig: 'tsconfig.json',
  plugins: [jsonToJsPlugin],
  logLevel: 'info',
}

await Promise.all([
  build({
    ...shared,
    format: 'esm',
    outdir: 'dist/esm',
  }),
  build({
    ...shared,
    format: 'cjs',
    outdir: 'dist/cjs',
    outExtension: { '.js': '.cjs' },
  }),
])

await emitDeclarations()