#!/usr/bin/env node

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */

import * as archiver from 'archiver'
import * as fs from 'fs'
import * as path from 'path'

import root from '../root'
import version from '../version'

const [, , source, target] = process.argv

const xpi = path.join(root, 'xpi', `${target}-${version}.xpi`)
console.log(`creating ${xpi}`) // eslint-disable-line no-console
if (fs.existsSync(xpi)) fs.unlinkSync(xpi)
if (!fs.existsSync(path.dirname(xpi))) fs.mkdirSync(path.dirname(xpi))

const archive = archiver.create('zip', {})
archive.pipe(fs.createWriteStream(xpi))
archive.directory(`${root}/${source}`, false)
archive.finalize()
