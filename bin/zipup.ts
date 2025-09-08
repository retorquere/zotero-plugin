#!/usr/bin/env node

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */

import archiver from 'archiver'
import * as fs from 'fs'
import * as path from 'path'

import root from '../root'
import version from '../version'

const [, , source, target] = process.argv

const xpi = path.join(root, 'xpi', `${target}-${version}.xpi`)
console.log(`creating ${xpi}`) // eslint-disable-line no-console
if (fs.existsSync(xpi)) fs.unlinkSync(xpi)
if (!fs.existsSync(path.dirname(xpi))) fs.mkdirSync(path.dirname(xpi))

async function main() {
  await new Promise<void>((resolve, reject) => {
    const xpi = path.join(root, 'xpi', `${target}-${version}.xpi`)
    const output = fs.createWriteStream(xpi)
    const archive = archiver('zip', { zlib: { level: 9 } })

    output.on('close', () => {
      console.log(archive.pointer() + ' total bytes')
      console.log('Archiver has been finalized and the output file descriptor has closed.')
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

    // Add files to the archive
    archive.directory(`${root}/${source}`, false)

    archive.finalize()
  })
}

main().catch(err => {
  console.log(err)
  process.exit(1)
})
