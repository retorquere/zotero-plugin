#!/usr/bin/env node

// tslint:disable:no-console

import * as fs from 'fs-extra'
import * as path from 'path'

import root from '../root'

const pkg = { ...require(path.join(root, 'package.json')) }

if (!pkg.id) pkg.id = `${pkg.name.replace(/^zotero-/, '')}@${pkg.author.email.replace(/.*@/, '')}`.toLowerCase()
if (pkg.xpi) Object.assign(pkg, pkg.xpi)

const build = path.join(root, 'build')

const zotero = process.argv[2]

if (!zotero) {
  console.log('No directory specified')
  process.exit(1)
}

const extensions = path.join(zotero, 'extensions')
if (!fs.existsSync(extensions)) {
  console.log(`${extensions} does not exist`)
  process.exit(1)
}

const extension = path.join(extensions, pkg.id)

fs.writeFileSync(extension, build)
