/* eslint-disable no-magic-numbers */

Components.utils.importGlobalProperties(['FormData'])
import { CONTENT_ENCRYPTION_ALG, KEY_WRAPPING_ALG, KEYTYPE } from './crypto'

import * as jose from 'jose'
import * as UZip from 'uzip'
import pkg from './package.json'

export class Bundler {
  public key: string

  #refs = false

  #pk?: JsonWebKey
  #pubKey?: CryptoKey

  #files: Record<string, Uint8Array> = {}
  #encoder = new TextEncoder()

  constructor(pk?: JsonWebKey) {
    this.key = Zotero.Utilities.generateObjectKey()

    if (pk && pk.kty === KEYTYPE) this.#pk = pk
  }

  async add(path: string, data: string, refs = false): Promise<void> {
    this.#refs = this.#refs || refs

    const encoded = this.#encoder.encode(data)

    if (this.#pk) {
      if (!this.#pubKey) this.#pubKey = (await jose.importJWK(this.#pk, KEY_WRAPPING_ALG)) as CryptoKey
      const jwe = await (new jose.CompactEncrypt(encoded))
        .setProtectedHeader({
          alg: KEY_WRAPPING_ALG,
          enc: CONTENT_ENCRYPTION_ALG,
        })
        .encrypt(this.#pubKey)

      this.#files[`${this.key}/${path}.jwe`] = this.#encoder.encode(jwe)
    }
    else {
      this.#files[`${this.key}/${path}`] = encoded
    }
  }

  public get zip(): ArrayBuffer {
    return UZip.encode(this.#files) as ArrayBuffer
  }

  public get name(): string {
    return `${this.key}.zip`
  }

  public id(host: string): string {
    return `${this.key}-${host}${this.#refs ? '.refs' : ''}${this.#pubKey ? '.enc' : ''}`
  }

  public async send(): Promise<string> {
    const response = await fetch(`https://filebin.net/${this.key}/${this.name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/zip',
      },
      body: new Blob([this.zip], { type: 'application/zip' }),
    })

    if (response.ok) return this.id('fbin')
    throw new Error(await response.text())
  }
}

declare var Services: any // eslint-disable-line no-var
declare const Components: any
declare const ChromeUtils: any

type ExportTranslator = {
  setHandler: (phase: string, handler: (obj: { string: string }, success: boolean) => void) => void // eslint-disable-line id-blacklist
  setTranslator: (id: string) => void
  setItems: (items: any[]) => void
  translate: () => void
}

const zotero_prefs_root = 'extensions.zotero.'

type Plugin = {
  plugin: string
  preferences: string[]
  pubKey?: JsonWebKey
}

class DebugLogSender {
  version = pkg.version
  #menu: string | false
  #plugins: Plugin[] = []

  public debugEnabledAtStart: boolean = typeof Zotero !== 'undefined'
    ? (Zotero.Prefs.get('debug.store') || Zotero.Debug.enabled) as unknown as boolean
    : null

  public register(plugin: string, preferences: string[] = [], pubKey?: JsonWebKey): void {
    this.#menu ??= Zotero.MenuManager.registerMenu({
      menuID: 'debug-log-sender',
      pluginID: 'debug-log-sender',
      target: 'main/menubar/help',
      menus: [
        {
          menuType: 'submenu',
          onShowing: (event, context) => {
            context.setVisible(!!this.#plugins.length)
            context.menuElem?.setAttribute('label', 'Send plugin debug log')
          },
          menus: Array.from({ length: 20 }, (v, i) => ({
            menuType: 'menuitem',
            onShowing: (event: Event, context: _ZoteroTypes.MenuManager.MenuContext) => {
              context.setVisible(this.#plugins.length > i)
              context.menuElem?.setAttribute('label', this.#plugins[i]?.plugin || '')
            },
            onCommand: (event: Event, context: _ZoteroTypes.MenuManager.MenuContext) => {
              void this.send(this.#plugins[i])
            },
          })),
        },
      ],
    })

    this.#plugins.push({ plugin, preferences, pubKey })
  }

  public unregister(plugin: string) {
    this.#plugins = this.#plugins.filter(p => p.plugin !== plugin)
  }

  private async send({ plugin, preferences, pubKey }: Plugin): Promise<void> {
    try {
      await Zotero.Schema.schemaUpdatePromise

      const bundler = new Bundler(pubKey || undefined)

      let log = [
        await this.info(preferences),
        Zotero.getErrors(true).join('\n\n'),
        Zotero.Debug.getConsoleViewerOutput().slice(-250000).join('\n'), // eslint-disable-line no-magic-numbers
      ].filter((txt: string) => txt).join('\n\n').trim()
      await bundler.add('debug.txt', log)

      let rdf = await this.rdf()
      if (rdf) await bundler.add('items.rdf', rdf, true)

      const logid = await bundler.send()
      Services.prompt.alert(null, `Debug log ID for ${plugin}`, logid)
    }
    catch (err) {
      Services.prompt.alert(null, `Could not post debug log for ${plugin}`, err.message)
    }
  }

  private preferences(preferences: string[]): Record<string, string | number | boolean> {
    const prefs: Record<string, string | number | boolean> = {}

    const names: string[] = []
    for (let pref of preferences) {
      if (pref[0] === ':') {
        pref = pref.substring(1)
      }
      else if (!pref.startsWith(zotero_prefs_root)) {
        pref = zotero_prefs_root + pref
      }
      if (pref.endsWith('.')) {
        const childkeys: string[] = Services.prefs.getBranch(pref).getChildList('', {})
        for (const key of childkeys) {
          names.push(pref + key)
        }
      }
      else {
        names.push(pref)
      }
    }

    for (const pref of names.sort()) {
      prefs[pref] = Zotero.Prefs.get(pref, true)
    }

    return prefs
  }

  // general state of Zotero
  private async info(preferences: string[]): Promise<string> {
    let info = ''

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
    const appInfo: { name: string; version: string } = Components.classes['@mozilla.org/xre/app-info;1'].getService(Components.interfaces.nsIXULAppInfo)
    info += `Application: ${appInfo.name} ${appInfo.version} ${Zotero.locale}\n`

    const platform = ['Win', 'Mac', 'Linux'].find(p => Zotero[`is${p}`]) || 'Unknown'
    info += `Platform: ${platform}\n`

    const addons: string[] = await Zotero.getInstalledExtensions()
    if (addons.length) {
      info += 'Addons:\n' + addons.map((addon: string) => `  ${addon}\n`).join('') // eslint-disable-line prefer-template
    }
    info += `Debug logging on at Zotero start: ${this.debugEnabledAtStart}\n`
    info += `Debug logging on at log submit: ${Zotero.Prefs.get('debug.store') || Zotero.Debug.enabled}\n`

    for (const [pref, value] of Object.entries(this.preferences(preferences))) {
      info += `${pref} = ${JSON.stringify(value)}\n`
    }

    return info
  }

  private rdf(): Promise<string> {
    return new Promise((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
      const items: any[] = Zotero.getActiveZoteroPane().getSelectedItems()
      if (items.length === 0) return resolve('')

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      const translation: ExportTranslator = new Zotero.Translate.Export() as ExportTranslator
      translation.setItems(items)
      translation.setTranslator('14763d24-8ba0-45df-8f52-b8d1108e7ac9') // rdf

      translation.setHandler('done', (obj, success) => {
        if (success) {
          resolve(obj ? obj.string : undefined)
        }
        else {
          reject(new Error('translation failed'))
        }
      })

      translation.translate() // eslint-disable-line @typescript-eslint/no-unsafe-call
    })
  }
}

declare global {
  interface Zotero {
    DebugLogSender?: DebugLogSender
  }
  namespace Zotero {
    var DebugLogSender: DebugLogSender | undefined
  }
}

function upgrade(installed?: string) {
  if (!installed) return true
  return installed.localeCompare(pkg.version, undefined, { numeric: true }) < 0
}

if (upgrade(Zotero.DebugLogSender?.version)) Zotero.DebugLogSender = new DebugLogSender()
export const DebugLog = Zotero.DebugLogSender
