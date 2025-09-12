#!/usr/bin/env node

/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/restrict-template-expressions, @typescript-eslint/no-unsafe-call */

import * as fs from 'fs'
import * as path from 'path'

import root from '../root'

const pkg = { ...require(path.join(root, 'package.json')) }

if (!pkg.id) pkg.id = `${pkg.name}@${pkg.author.email.replace(/.*@/, '')}`.toLowerCase()
if (pkg.xpi) Object.assign(pkg, pkg.xpi)

const build = path.join(root, 'build')

const zotero = process.argv[2]

if (!zotero) {
  console.log('No directory specified') // eslint-disable-line no-console
  process.exit(1)
}

const extensions = path.join(zotero, 'extensions')
if (!fs.existsSync(extensions)) {
  console.log(`${extensions} does not exist`) // eslint-disable-line no-console
  process.exit(1)
}

const extension = path.join(extensions, pkg.id)

fs.writeFileSync(extension, build)
