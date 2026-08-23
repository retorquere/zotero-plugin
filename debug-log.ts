/* eslint-disable no-magic-numbers */

Components.utils.importGlobalProperties(['FormData'])
import { CONTENT_ENCRYPTION_ALG, KEY_WRAPPING_ALG, KEYTYPE } from './crypto'

import * as jose from 'jose'
import * as UZip from 'uzip'

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

export class DebugLogSender {
  // #menu: string | false = false
  #preferences: string[]

  public enabled = false
  public debugEnabledAtStart: boolean = (Zotero.Prefs.get('debug.store') || Zotero.Debug.enabled) as unknown as boolean

  constructor(public pluginID: string, public label: string, preferences: string[] = [], private pubKey?: JsonWebKey) {
    this.#preferences = preferences
    Zotero.MenuManager.registerMenu({
      menuID: `debug-log-sender-${pluginID}`,
      pluginID,
      target: 'main/menubar/help',
      menus: [
        {
          menuType: 'menuitem',
          onShowing: (event: Event, context: _ZoteroTypes.MenuManager.MenuContext) => {
          context.setVisible(this.enabled)
          context.menuElem?.setAttribute('label', this.label)
        },
        onCommand: (event: Event, context: _ZoteroTypes.MenuManager.MenuContext) => {
          void this.send()
        },
      }],
    })
  }

  private async send(): Promise<void> {
    try {
      await Zotero.Schema.schemaUpdatePromise

      const bundler = new Bundler(this.pubKey || undefined)

      let log = [
        await this.info(),
        Zotero.getErrors(true).join('\n\n'),
        Zotero.Debug.getConsoleViewerOutput().slice(-250000).join('\n'), // eslint-disable-line no-magic-numbers
      ].filter((txt: string) => txt).join('\n\n').trim()
      await bundler.add('debug.txt', log)

      let rdf = await this.rdf()
      if (rdf) await bundler.add('items.rdf', rdf, true)

      const logid = await bundler.send()
      Services.prompt.alert(null, `Debug log ID for ${this.label}`, logid)
    }
    catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      Services.prompt.alert(null, `Could not post debug log for ${this.label}`, message)
    }
  }

  private preferences(): Record<string, string | number | boolean> {
    const prefs: Record<string, string | number | boolean> = {}

    const names: string[] = []
    for (let pref of this.#preferences) {
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
      const value = Zotero.Prefs.get(pref, true) as string | number | boolean | undefined
      if (typeof value !== 'undefined') prefs[pref] = value
    }

    return prefs
  }

  // general state of Zotero
  private async info(): Promise<string> {
    let info = ''

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
    const appInfo: { name: string; version: string } = Components.classes['@mozilla.org/xre/app-info;1'].getService(Components.interfaces.nsIXULAppInfo)
    info += `Application: ${appInfo.name} ${appInfo.version} ${Zotero.locale}\n`

    const platformFlags = Zotero as unknown as Record<string, unknown>
    const platform = ['Win', 'Mac', 'Linux'].find(p => Boolean(platformFlags[`is${p}`])) || 'Unknown'
    info += `Platform: ${platform}\n`

    const addons: string[] = await Zotero.getInstalledExtensions()
    if (addons.length) {
      info += 'Addons:\n' + addons.map((addon: string) => `  ${addon}\n`).join('') // eslint-disable-line prefer-template
    }
    info += `Debug logging on at Zotero start: ${this.debugEnabledAtStart}\n`
    info += `Debug logging on at log submit: ${Zotero.Prefs.get('debug.store') || Zotero.Debug.enabled}\n`

    for (const [pref, value] of Object.entries(this.preferences())) {
      info += `${pref} = ${JSON.stringify(value)}\n`
    }

    return info
  }

  private rdf(): Promise<string> {
    return new Promise((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
      const pane = Zotero.getActiveZoteroPane()
      if (!pane) return resolve('')
      const items: any[] = pane.getSelectedItems()
      if (items.length === 0) return resolve('')

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      const translation: ExportTranslator = new Zotero.Translate.Export() as ExportTranslator
      translation.setItems(items)
      translation.setTranslator('14763d24-8ba0-45df-8f52-b8d1108e7ac9') // rdf

      translation.setHandler('done', (obj, success) => {
        if (success) {
          resolve(obj?.string || '')
        }
        else {
          reject(new Error('translation failed'))
        }
      })

      translation.translate() // eslint-disable-line @typescript-eslint/no-unsafe-call
    })
  }
}
