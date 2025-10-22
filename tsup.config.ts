import type { Plugin } from 'esbuild'
import { readFile } from 'fs/promises'
import { defineConfig, type Options } from 'tsup'

const jsonToJsPlugin = (): Plugin => ({
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
})

const bufferedWarningsPlugin = (): Plugin => ({
  name: 'buffered-warnings',
  setup(build) {
    build.onEnd(result => {
      const warnings = result.warnings
      if (warnings.length) {
        console.log('⚠️  Build warnings:')
        for (const w of warnings) {
          console.log('')
          if (w.location) {
            const loc = w.location
            // include file path, line, column
            console.log(`  ${loc.file}:${loc.line}:${loc.column} - ${w.text}`)
          }
          else {
            console.log('  ' + w.text)
          }
          // include notes if any
          if (w.notes?.length) {
            for (const note of w.notes) console.log('    note: ' + note.text)
          }
        }
      }
    })
  },
})

const baseConfig: Omit<Options, 'format' | 'outDir'> = {
  entry: ['*.ts', 'bin/*.ts', 'loader/*.ts'],
  bundle: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  dts: true,
  // silent: true,
  esbuildPlugins: [
    jsonToJsPlugin(),
    // bufferedWarningsPlugin(),
  ],
  external: ['esbuild'],
}

export default defineConfig([
  {
    ...baseConfig,
    format: ['esm'],
    outDir: 'dist/esm',
  },
  {
    ...baseConfig,
    format: ['cjs'],
    outDir: 'dist/cjs',
  },
])
