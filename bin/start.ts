#!/usr/bin/env node

import { exec as childProcessExec } from 'child_process'
import { program } from 'commander'
import fs from 'fs'
import { globSync } from 'glob'
import ini from 'ini'
import os from 'os'
import path from 'path'
import { promisify } from 'util'

const execPromise = promisify(childProcessExec)

program.option('-b, --beta', 'start beta')
program.parse(process.argv)
const options = program.opts()

type ProfileConfig = {
  path: string
  name?: string
}

type ZoteroConfig = {
  path?: string
  log?: string
  db?: string
}

type PluginConfig = {
  source: string
  build: string
}

type PreferenceConfig = Record<string, string | number | boolean | null>

class Config {
  public profile: ProfileConfig
  public zotero: ZoteroConfig
  public plugin: PluginConfig
  public preference: PreferenceConfig
  public windows: boolean

  constructor() {
    const config_file = 'zotero-plugin.ini'
    if (!fs.existsSync(config_file)) {
      throw new Error(`Cannot find ${config_file}`)
    }

    const config = ini.parse(fs.readFileSync(config_file, 'utf-8'))

    // Initialize profile configuration
    this.profile = {
      path: this.expandUserPath(config.profile?.path || ''),
      name: config.profile?.name,
    }

    if (!this.profile.path) throw new Error('no profile path')

    this.zotero = {
      path: config.zotero?.[options.beta ? 'beta' : 'path'],
      log: config.zotero?.log,
      db: config.zotero?.db,
    }

    const beta = options.beta ? '-beta' : ''
    if (this.zotero.path) {
      this.zotero.path = this.expandUserPath(this.zotero.path)
    }
    else {
      switch (os.platform()) {
        case 'darwin':
          this.zotero.path = `/Applications/Zotero${beta}.app/Contents/MacOS/zotero`
          break
        case 'linux':
          this.zotero.path = `/usr/lib/zotero${beta}/zotero`
          break
        case 'win32':
          this.zotero.path = `C:/Program Files (x86)/Zotero${beta}/Zotero.exe`
          break
        default:
          throw new Error(`${os.platform()} not supported`)
      }
    }

    this.windows = os.platform() === 'win32'

    if (this.zotero.log) this.zotero.log = this.expandUserPath(this.zotero.log)

    const source = config.plugin?.source || this.find_source()
    if (!source) {
      throw new Error('Plugin source not found.')
    }
    this.plugin = {
      source: path.resolve(source),
      build: config.plugin?.build || 'npm run build',
    }

    this.preference = {}
    if (config.preferences) {
      for (const key in config.preferences) {
        if (Object.prototype.hasOwnProperty.call(config.preferences, key)) {
          this.preference[key] = this.pref_value(config.preferences[key] as string)
        }
      }
    }

    this.preference['extensions.autoDisableScopes'] = 0
    this.preference['extensions.enableScopes'] = 15
    this.preference['extensions.startupScanScopes'] = 15
    this.preference['extensions.zotero.debug.log'] = true
    this.preference['extensions.lastAppBuildId'] = null
    this.preference['extensions.lastAppVersion'] = null
  }

  private expandUserPath(p: string): string {
    return p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p
  }

  private find_source(): string | false {
    const rdfs = globSync(path.join('*', 'manifest.json'))
    if (rdfs.length > 0) {
      return path.dirname(rdfs[0])
    }
    if (fs.existsSync('build')) {
      return 'build'
    }
    return false
  }

  private pref_value(v: string): string | number | boolean | null {
    if (v === 'true') return true
    if (v === 'false') return false
    if (v === 'null') return null
    try {
      return JSON.parse(v) as string | number | boolean
    }
    catch (e) {
      return v
    }
  }
}

const config = new Config()

function patch_prefs(prefs: string, add_config: boolean): void {
  const prefs_path = path.join(config.profile.path, `${prefs}.js`)
  if (!fs.existsSync(prefs_path)) return

  const lines = fs.readFileSync(prefs_path, 'utf-8').split('\n')
  const new_lines: string[] = []

  for (const line of lines) {
    const match = line.match(/user_pref\("(.+?)"/)
    if (!match || !(match[1] in config.preference)) {
      new_lines.push(line)
    }
  }

  if (add_config) {
    for (const [key, value] of Object.entries(config.preference)) {
      if (value !== null) {
        new_lines.push(`user_pref(${JSON.stringify(key)}, ${JSON.stringify(value)});`)
      }
    }
  }

  fs.writeFileSync(prefs_path, new_lines.join('\n'))
}

async function system(cmd: string): Promise<void> {
  console.log('$', cmd)
  try {
    const { stdout, stderr } = await execPromise(cmd)
    if (stdout) console.log(stdout)
    if (stderr) console.error(stderr)
  }
  catch (error) {
    const err = error as { code?: number; message?: string }
    console.error(`Command failed with exit code ${err.code || 1}: ${err.message}`)
    process.exit(err.code || 1)
  }
}

async function main() {
  try {
    patch_prefs('prefs', false)
    patch_prefs('user', true)

    if (config.plugin.build) {
      await system(config.plugin.build)
    }

    if (config.zotero.db) {
      fs.copyFileSync(config.zotero.db, path.join(config.profile.path, 'zotero', 'zotero.sqlite'))
    }

    const manifest = JSON.parse(fs.readFileSync(path.join(config.plugin.source, 'manifest.json'), 'utf-8'))

    const addonId = manifest?.applications?.zotero?.id
    if (!addonId) {
      throw new Error('Could not find addon ID in manifest.json')
    }

    const plugin_path = path.join(config.profile.path, 'extensions', addonId)
    const sources = config.plugin.source
    const proxyPath = config.windows ? sources.replace(/\\/g, '\\\\') : sources

    console.log('Writing addon source path to proxy file')
    console.log('Source path:', sources)
    console.log('Proxy file path:', plugin_path)

    fs.writeFileSync(plugin_path, proxyPath)

    const zoteroDebugFlag = config.windows ? '-ZoteroDebug' : '-ZoteroDebugText'
    const cmdParts = [
      config.zotero.path,
      '-purgecaches',
      '-P',
      config.profile.name,
      zoteroDebugFlag,
      '-jsconsole',
      '-datadir',
      'profile',
    ]

    if (config.zotero.log) {
      cmdParts.push(`> ${config.zotero.log}`)
      if (!config.windows) cmdParts.push('&')
    }

    await system(cmdParts.join(' '))
  }
  catch (err) {
    console.error(err)
  }
}

main()
