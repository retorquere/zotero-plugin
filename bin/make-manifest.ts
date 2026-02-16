/* eslint-disable no-console, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/restrict-template-expressions, no-magic-numbers */

import * as FTL from '@fluent/syntax'
import * as fs from 'fs'
import { globSync as glob } from 'glob'
import * as path from 'path'
import { parseTemplate } from 'url-template'

import { pkg, root } from './find-root'
import { version } from './version'

if (!pkg.id) (pkg.id as string) = `${pkg.name}@${pkg.author.email.replace(/.*@/, '')}`.toLowerCase()
if (pkg.xpi) Object.assign(pkg, pkg.xpi)

pkg.version = version()

if (pkg.updateLink) pkg.updateLink = parseTemplate(pkg.updateLink).expand({ version: pkg.version })
pkg.updateURL = `${pkg.xpi.releaseURL}update.rdf`

const translations = glob(path.join(root, 'locale/*/*.ftl'))
for (const translation of translations) {
  const locale = path.basename(path.dirname(translation))

  const ftl: FTL.Resource = FTL.parse(fs.readFileSync(translation, 'utf-8'), {})
  const body: FTL.Entry[] = ftl.body || []
  const msg: FTL.Message = body.find((msg: FTL.Entry) => msg.type === 'Message' && msg.id.type === 'Identifier' && msg.id.name === 'xpi') as FTL.Message
  if (!msg) continue
  const attr: FTL.Attribute = msg.attributes.find((attr: FTL.Attribute) => attr.id.type === 'Identifier' && attr.id.name === 'description')
  if (!attr) continue
  const description = attr.value.elements.filter((e: FTL.PatternElement) => e.type === 'TextElement').map((e: FTL.PatternElement) => e.value as string).join('')
  if (!description) continue

  if (locale === 'en-US') {
    pkg.description = description
  }
  else {
    pkg.localizedDescriptions = pkg.localizedDescriptions || {}
    pkg.localizedDescriptions[locale] = description
  }
}

const options_and_vars = { minVersion: '7.0.32', maxVersion: '9.*', ...pkg, pretty: true }
try {
  Object.assign(options_and_vars, JSON.parse(fs.readFileSync(path.join(root, 'schema', 'supported.json'), 'utf8')))
}
catch {
  // ignore
}

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
                  strict_min_version: options_and_vars.minVersion,
                  strict_max_version: options_and_vars.maxVersion,
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

let icons: { small: string; big?: string }[] = []
if (typeof pkg.xpi?.iconURL === 'string') icons.push({ small: pkg.xpi.iconURL.replace(/^chrome:\/\/[^/]+\//, '') })

const basename = pkg.id.replace(/@.*/, '')
for (const icon of [`content/skin/${basename}.png`, `skin/${basename}.png`, `${basename}.png`, 'icon.png']) {
  icons.push({ small: icon })
  icons.push({ small: icon.replace('/zotero-', '/') })
}
icons.push(...icons.map(icon => ({ small: icon.small.replace(/[.](svg|png)$/, ext => ({ '.svg': '.png', '.png': '.svg' }[ext] || ext)) })))
icons = icons.filter(icon => fs.existsSync(path.join(root, ...icon.small.split('/'))))
icons = icons.map(icon => ({ ...icon, big: icon.small.endsWith('.svg') ? icon.small : icon.small.replace(/([.][^.]+)$/, '@2x$1') }))
if (icons.length) {
  const { small, big } = icons[0]
  options_and_vars.icons = {
    48: small,
    96: fs.existsSync(path.join(root, ...big!.split('/'))) ? big : small,
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
          strict_min_version: options_and_vars.minVersion,
          strict_max_version: options_and_vars.maxVersion,
        },
      },
    },
    null,
    2,
  ),
)
