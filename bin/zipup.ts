#!/usr/bin/env node

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */

import archiver from 'archiver'
import * as fs from 'fs'
import * as path from 'path'

import { glob } from 'glob'
import { root } from './find-root'
import { version } from './version'

const [, , source, target] = process.argv

const xpi = path.join(root, 'xpi', `${target}-${version()}.xpi`)
console.log(`creating ${xpi}`) // eslint-disable-line no-console
if (fs.existsSync(xpi)) fs.unlinkSync(xpi)
if (!fs.existsSync(path.dirname(xpi))) fs.mkdirSync(path.dirname(xpi))

async function main() {
  const build = path.join(root, source)
  let files = await glob('**/*', {
    nodir: true,
    cwd: build,
  })
  files = files.filter(file => !file.endsWith('.js.map'))

  await new Promise<void>((resolve, reject) => {
    const xpi = path.join(root, 'xpi', `${target}-${version()}.xpi`)
    const output = fs.createWriteStream(xpi)
    const archive = archiver('zip', { zlib: { level: 9 } })

    output.on('close', () => {
      console.log(archive.pointer() + ' total bytes')
      resolve()
    })

    archive.on('warning', err => {
      if (err.code === 'ENOENT') {
        console.warn(err.message)
      }
      else {
        console.error(err)
      }
    })

    archive.on('error', err => {
      reject(err)
    })

    archive.pipe(output)

    for (const file of files) {
      archive.file(path.join(build, file), { name: file })
    }

    archive.finalize()
  })
}

main().catch(err => {
  console.log(err)
  process.exit(1)
})
