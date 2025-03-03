/* eslint-disable no-console, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/restrict-template-expressions, no-magic-numbers */

import * as fs from 'fs'
import { globSync as glob } from 'glob'
import * as path from 'path'
import * as pug from 'pug'

import PropertiesReader from 'properties-reader'
import uriTemplate from 'uri-templates'

import root from './root'
import version from './version'

const pkg = { ...require(path.join(root, 'package.json')) }

if (!pkg.id) (pkg.id as string) = `${pkg.name.replace(/^zotero-/, '')}@${pkg.author.email.replace(/.*@/, '')}`.toLowerCase()
if (pkg.xpi) Object.assign(pkg, pkg.xpi)

pkg.version = version

if (pkg.updateLink) pkg.updateLink = uriTemplate(pkg.updateLink).fill({ version: pkg.version })
pkg.updateURL = `${pkg.xpi.releaseURL}update.rdf`

const translations = glob(path.join(root, 'locale/*/*.properties'))
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

const options_and_vars = { minVersion: '6.0.9', maxVersion: '7.*', ...pkg, pretty: true }
try {
  Object.assign(options_and_vars, JSON.parse(fs.readFileSync(path.join(root, 'schema', 'supported.json'), 'utf8')))
}
catch (err) { // eslint-disable-line @typescript-eslint/no-unused-vars
  // ignore
}

if (options_and_vars.minVersion.match(/^6/)) {
  let template
  console.log('generating install.rdf')
  template = fs.readFileSync(path.join(__dirname, 'install.rdf.pug'), 'utf8')
  template = pug.render(template, options_and_vars)
  fs.writeFileSync(path.join(root, 'build/install.rdf'), template, { encoding: 'utf8' })

  console.log('generating update.rdf')
  template = fs.readFileSync(path.join(__dirname, 'update.rdf.pug'), 'utf8')
  template = pug.render(template, options_and_vars)
  fs.writeFileSync(path.join(root, 'gen/update.rdf'), template, { encoding: 'utf8' })
}

if (options_and_vars.maxVersion.match(/^7/)) {
  console.log('generating updates.json')
  fs.writeFileSync(
    path.join(root, 'gen/updates.json'),
    JSON.stringify(
      {
        addons: {
          [pkg.id]: {
            updates: [
              {
                version: options_and_vars.version,
                update_link: options_and_vars.updateLink,
                applications: {
                  zotero: {
                    strict_min_version: '6.999',
                  },
                },
              },
            ],
          },
        },
      },
      null,
      2,
    ),
  )

  const icons: { 48: string; 96?: string }[] = [
    { 48: pkg.xpi?.iconURL?.replace(/^chrome:\/\/[^/]+\//, '') },
  ].filter(i => i[48])
  const basename = pkg.id.replace(/@.*/, '')
  for (const i of [`content/skin/${basename}.png`, `skin/${basename}.png`, `${basename}.png`, 'icon.png']) {
    icons.push({ 48: i })
    icons.push({ 48: i.replace('/zotero-', '/') })
  }
  for (const i of [...icons]) {
    icons.push({ 48: (i[48] || '').replace(/[.](svg|png)$/, ext => ({ '.svg': '.png', '.png': '.svg' }[ext] || ext)) })
  }
  for (const i of [...icons]) {
    if (i[48].endsWith('.svg')) {
      i[96] = i[48]
    }
    else {
      i[96] = i[48].replace(/([.][^.]+)$/, '@2x$1')
    }
  }
  const icon = icons.find(i => fs.existsSync(path.join(root, ...i[48].split('/'))))
  if (icon) {
    options_and_vars.icons = {
      48: icon[48],
      96: fs.existsSync(path.join(root, ...(icon[96] || '').split('/'))) ? icon[96] : icon[48],
    }
  }
  console.log('generating manifest.json')
  fs.writeFileSync(
    path.join(root, 'build/manifest.json'),
    JSON.stringify(
      {
        manifest_version: 2,
        name: options_and_vars.name,
        version: options_and_vars.version,
        description: options_and_vars.description,
        icons: options_and_vars.icons,
        applications: {
          zotero: {
            id: options_and_vars.id,
            update_url: options_and_vars.updateURL.replace('/update.rdf', '/updates.json'),
            strict_min_version: '6.999',
            strict_max_version: '7.*',
          },
        },
      },
      null,
      2,
    ),
  )
}
