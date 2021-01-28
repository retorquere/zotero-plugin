/* eslint-disable no-console, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/restrict-template-expressions */

import * as fs from 'fs'
import * as path from 'path'
import * as glob from 'glob'
import * as pug from 'pug'

import PropertiesReader = require('properties-reader')
import uriTemplate = require('uri-templates')

import root from './root'
import version from './version'

const pkg = { ...require(path.join(root, 'package.json')) }

if (!pkg.id) (pkg.id as string) = `${pkg.name.replace(/^zotero-/, '')}@${pkg.author.email.replace(/.*@/, '')}`.toLowerCase()
if (pkg.xpi) Object.assign(pkg, pkg.xpi)

pkg.version = version

if (pkg.updateLink) pkg.updateLink = uriTemplate(pkg.updateLink).fill({version: pkg.version})
pkg.updateURL = `${pkg.xpi.releaseURL}update.rdf`

const translations = glob.sync(path.join(root, 'locale/*/*.properties'))
for (const translation of translations) {
  const locale = path.basename(path.dirname(translation))
  const properties = PropertiesReader(translation)
  const description = properties.get('xpi.description')

  if (!description) continue

  if (locale === 'en-US') {
    pkg.description = description
  }
  else {
    pkg.localizedDescriptions = pkg.localizedDescriptions || {}
    pkg.localizedDescriptions[locale] = description
  }
}

const options_and_vars = { ...pkg, pretty: true }

let template
console.log('generating install.rdf')
template = fs.readFileSync(path.join(__dirname, 'install.rdf.pug'), 'utf8')
template = pug.render(template, options_and_vars)
fs.writeFileSync(path.join(root, 'build/install.rdf'), template, { encoding: 'utf8' })

console.log('generating update.rdf')
template = fs.readFileSync(path.join(__dirname, 'update.rdf.pug'), 'utf8')
template = pug.render(template, options_and_vars)
fs.writeFileSync(path.join(root, 'gen/update.rdf'), template, { encoding: 'utf8' })
