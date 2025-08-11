/* eslint-disable no-magic-numbers */

type ZoteroPane = {
  getSelectedItems: () => any[]
}

declare var Zotero: { // eslint-disable-line no-var
  platformMajorVersion: number
  debug: (msg: string) => void
  DebugLogSender: {
    plugins: Record<string, string[]>
  }
  Translate: any
  Prefs: {
    get: (name: string, global?: boolean) => string | number | boolean
  }
  getInstalledExtensions: () => Promise<string[]>
  platform: string
  oscpu: string
  arch: string
  locale: string
  Utilities: {
    generateObjectKey: () => string
  }
  Debug: {
    enabled: boolean
    getConsoleViewerOutput: () => string[]
  }
  getErrors: (something: boolean) => string[]
  Schema: {
    schemaUpdatePromise: Promise<void>
  }
  getActiveZoteroPane: () => ZoteroPane
  getMainWindow(): Window
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

import * as UZip from 'uzip'

class DebugLogSender {
  public id = {
    menu: 'debug-log-sender-menu',
    menupopup: 'debug-log-sender-menupopup',
    menuitem: 'debug-log-sender',
  }

  public debugEnabledAtStart: boolean = typeof Zotero !== 'undefined'
    ? (Zotero.Prefs.get('debug.store') || Zotero.Debug.enabled) as unknown as boolean
    : null

  private element(name: string, attrs: Record<string, string> = {}): HTMLElement {
    const doc = Zotero.getMainWindow().document
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const elt: HTMLElement = doc[Zotero.platformMajorVersion >= 102 ? 'createXULElement' : 'createElement'](name)
    for (const [k, v] of Object.entries(attrs)) {
      elt.setAttribute(k, v)
    }
    return elt
  }

  public register(plugin: string, preferences: string[] = [], pubkey = ''): void {
    const label = 'Send debug log to 0x0'

    const doc = Zotero.getMainWindow()?.document
    if (doc) {
      let menupopup = doc.querySelector(`#${this.id.menupopup}`)
      if (menupopup) {
        menupopup.setAttribute('label', label)
      }
      else {
        menupopup = doc.querySelector('menupopup#menu_HelpPopup')
          .appendChild(this.element('menu', { id: this.id.menu, label }))
          .appendChild(this.element('menupopup', { id: this.id.menupopup }))
      }

      doc.querySelector(`.${this.id.menuitem}[label=${JSON.stringify(plugin)}]`)?.remove()
      const menuitem = menupopup.appendChild(this.element('menuitem', {
        label: plugin,
        class: this.id.menuitem,
        'data-preferences': JSON.stringify(preferences || []),
        'data-pubkey': pubkey,
      }))
      menuitem.addEventListener('command', event => this.send(event.currentTarget))
    }
  }

  public unregister(plugin: string): void {
    const doc = Zotero.getMainWindow()?.document
    if (doc) {
      doc.querySelector(`.debug-log-sender[label=${JSON.stringify(plugin)}]`)?.remove()
      const menupopup = doc.querySelector('#debug-log-sender-menupopup')
      if (menupopup && !menupopup.children.length) doc.querySelector('#debug-log-sender-menu')?.remove()
    }
  }

  public send(target: EventTarget): void {
    const elt: HTMLElement = target as unknown as HTMLElement
    const plugin: string = elt.getAttribute('label')
    const preferences: string[] = JSON.parse(elt.getAttribute('data-preferences')) as string[]
    const pubkey: string = elt.getAttribute('data-pubkey')

    this.sendAsync(plugin, preferences, pubkey).catch((err: Error) => {
      Services.prompt.alert(null, 'Debug log submission error', `${err}`) // eslint-disable-line @typescript-eslint/restrict-template-expressions
    })
  }

  private async sendAsync(plugin: string, preferences: string[], pubkey?: string) {
    await Zotero.Schema.schemaUpdatePromise

    const files: Record<string, Uint8Array> = {}
    const enc = new TextEncoder()

    const key: string = Zotero.Utilities.generateObjectKey()

    let log = [
      await this.info(preferences),
      Zotero.getErrors(true).join('\n\n'),
      Zotero.Debug.getConsoleViewerOutput().slice(-250000).join('\n'), // eslint-disable-line no-magic-numbers
    ].filter((txt: string) => txt).join('\n\n').trim()
    files[`${key}/debug.txt`] = enc.encode(log)

    let rdf = await this.rdf()
    if (rdf) files[`${key}/items.rdf`] = enc.encode(rdf)

    // do this runtime because Zotero is not defined at start for bootstrapped zoter6 plugins
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    if (typeof FormData === 'undefined' && Zotero.platformMajorVersion >= 102) Components.utils.importGlobalProperties(['FormData'])

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const zip = new Uint8Array(UZip.encode(files) as ArrayBuffer)

    let blob: Blob
    let ext = ''

    if (pubkey) {
      try {
        const subtle = Zotero.getMainWindow().crypto.subtle
        const pem = pubkey
          .replace('-----BEGIN PUBLIC KEY-----', '')
          .replace('-----END PUBLIC KEY-----', '')
          .replace(/\s/g, '')
        const keyBuffer = Uint8Array.from(atob(pem), c => c.charCodeAt(0)).buffer
        const publicKey = await subtle.importKey('spki', keyBuffer, { name: 'RSA-OAEP', hash: 'SHA-256' }, true, ['encrypt'])
        const encrypted = await subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, zip)
        blob = new Blob([encrypted], { type: 'application/octet-stream' })
        ext = '.enc'
      }
      catch (err) {
        Services.prompt.alert(null, `Log encryption for ${plugin} failed`, err.message)
      }
    }

    if (!blob) blob = new Blob([zip], { type: 'application/zip' })

    const formData = new FormData()
    formData.append('file', blob, `${key}${ext || '.zip'}`)
    formData.append('expire', `${7 * 24}`)

    try {
      const response = await fetch('https://0x0.st', {
        method: 'POST',
        body: formData,
        headers: {
          'User-Agent': 'curl/8.7.1',
        },
      })
      const body = await response.text()
      const id = body.match(/https:\/\/0x0.st\/([A-Z0-9]+)\.zip/i)
      if (!id) throw new Error(body)
      Services.prompt.alert(null, `Debug log ID for ${plugin}`, `${key}-0x0-${id[1]}{ext}`)
    }
    catch (err) {
      Services.prompt.alert(null, `Could not post debug log for ${plugin}`, err.message)
    }
  }

  private preferences(preferences: string[]): Record<string, string | number | boolean> {
    const prefs: Record<string, string | number | boolean> = {}

    const names: string[] = []
    for (const pref of preferences) {
      if (pref.endsWith('.')) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
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
    const arch = Zotero.oscpu || Zotero.arch
    info += `Platform: ${platform} ${arch}\n`

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

  private arrayBufferToBase64(buffer) {
    let binary = ''
    const bytes = new Uint8Array(buffer)
    const len = bytes.byteLength
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }

  private base64ToArrayBuffer(base64) {
    const binaryString = atob(base64)
    const len = binaryString.length
    const bytes = new Uint8Array(len)
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    return bytes.buffer
  }
}

export const DebugLog = new DebugLogSender()
