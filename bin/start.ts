#!/usr/bin/env node
/* eslint-disable no-console, prefer-template, @typescript-eslint/restrict-plus-operands */

import * as fs from 'fs'
import * as path from 'path'
import { execSync } from 'child_process'
import { quote as shellQuote }  from 'shell-quote'
import clp from 'clp'

function quote(args: string[]): string {
  return shellQuote(args) as string // eslint-disable-line @typescript-eslint/no-unsafe-call
}

const argv: Record<string, any> = (clp as () => Record<string, any>)()

import root from '../root'

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const profile: Record<string, any> = require(path.join(root, 'profile.json'))
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const pkg: Record<string, any> = require(path.join(root, 'package.json'))

function exec(cmd) {
  console.log(cmd)
  if (!argv.dryRun) execSync(cmd, {stdio: 'inherit'})
}

if (argv.reset) {
  const settings = {
    replace: {
      'extensions.autoDisableScopes': 0,
      'extensions.enableScopes': 15,
      'extensions.startupScanScopes': 15,
    },
    remove: [
      'extensions.lastAppBuildId',
      'extensions.lastAppVersion',
    ],
  }
  const remove = new RegExp(settings.remove.concat(Object.keys(settings)).map(setting => setting.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'))
  for (const prefs of ['user', 'prefs']) {
    const user_prefs: string[] = []
    for (const user_pref of fs.readFileSync(path.join(profile.dir, `${prefs}.js`), 'utf-8').split('\n')) {
      if (!user_pref.match(remove)) user_prefs.push(user_pref)
    }
    for (const [user_pref, value] of Object.entries(settings.replace)) {
      user_prefs.push(`user_pref("${user_pref}", ${value});`)
    }

    fs.writeFileSync(path.join(profile.dir, `${prefs}.js`), user_prefs.join('\n'))
  }
}

exec('npm run build')

exec(quote(['rm', '-rf', path.join(profile.dir, 'extensions.json')]))
exec(quote(['rm', '-rf', path.join(profile.dir, 'extensions')]) + path.sep + pkg.name + '*.xpi')

let code = path.resolve(path.join(__dirname, 'build'))
if (!code.endsWith(path.sep)) code += path.sep
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
fs.writeFileSync(path.join(profile.dir, 'extensions', pkg.name.replace('zotero-') + pkg.author.email.replace(/.*@/, '@')), code)

let zotero = null
switch (process.platform) {
  case 'darwin':
    zotero = '/Applications/Zotero.app/Contents/MacOS/zotero'
    break

  case 'win32':
    console.log('not implemented on windows')
    process.exit(1)

  default:
    zotero = '/usr/local/bin/zotero/zotero'
    break

}

exec(quote([zotero, '-purgecaches', '-P', profile.name, '-jsconsole', '-ZoteroDebugText']) + ' > ' + quote([profile.log]))
