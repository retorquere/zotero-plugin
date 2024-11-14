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

type FileIO = {
  success: boolean
  key: string
  link: string
}

class DebugLogSender {
  private $zotero: typeof Zotero

  public id = {
    menu: 'debug-log-sender-menu',
    menupopup: 'debug-log-sender-menupopup',
    menuitem: 'debug-log-sender',
  }

  public debugEnabledAtStart: boolean = typeof Zotero !== 'undefined'
    ? (Zotero.Prefs.get('debug.store') || Zotero.Debug.enabled) as unknown as boolean
    : null

  private get zotero() {
    if (typeof Zotero !== 'undefined') return Zotero
    if (!this.$zotero) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      if (typeof Services === 'undefined') Services = ChromeUtils.import('resource://gre/modules/Services.jsm').Services
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const windows = Services.wm.getEnumerator('navigator:browser')
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      while (!this.$zotero && windows.hasMoreElements()) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        this.$zotero = windows.getNext().Zotero
      }
    }
    return this.$zotero
  }

  public convertLegacy() {
    if (!this.zotero.DebugLogSender) return
    const plugins = this.zotero.DebugLogSender.plugins || {}
    delete this.zotero.DebugLogSender

    const doc = this.zotero.getMainWindow()?.document
    if (doc) {
      doc.querySelector('menuitem#debug-log-menu')?.remove()
      for (const [plugin, preferences] of Object.entries(plugins)) {
        this.register(plugin, preferences)
      }
    }
  }

  private element(name: string, attrs: Record<string, string> = {}): HTMLElement {
    const doc = this.zotero.getMainWindow().document
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const elt: HTMLElement = doc[this.zotero.platformMajorVersion >= 102 ? 'createXULElement' : 'createElement'](name)
    for (const [k, v] of Object.entries(attrs)) {
      elt.setAttribute(k, v)
    }
    return elt
  }

  public register(plugin: string, preferences: string[] = []): void {
    this.convertLegacy()

    const doc = this.zotero.getMainWindow()?.document
    if (doc) {
      let menupopup = doc.querySelector(`#${this.id.menupopup}`)
      if (!menupopup) {
        menupopup = doc.querySelector('menupopup#menu_HelpPopup')
          .appendChild(this.element('menu', { id: this.id.menu, label: 'Send debug log to file.io' }))
          .appendChild(this.element('menupopup', { id: this.id.menupopup }))
      }

      doc.querySelector(`.${this.id.menuitem}[label=${JSON.stringify(plugin)}]`)?.remove()
      const menuitem = menupopup.appendChild(this.element('menuitem', {
        label: plugin,
        class: this.id.menuitem,
        'data-preferences': JSON.stringify(preferences || []),
      }))
      menuitem.addEventListener('command', event => this.send(event.currentTarget))
    }
  }

  public unregister(plugin: string): void {
    const doc = this.zotero.getMainWindow()?.document
    if (doc) {
      doc.querySelector(`.debug-log-sender[label=${JSON.stringify(plugin)}]`)?.remove()
      const menupopup = doc.querySelector('#debug-log-sender-menupopup')
      if (menupopup && !menupopup.children.length) doc.querySelector('#debug-log-sender-menu')?.remove()
    }
  }

  private alert(title, body) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const ps = this.zotero.platformMajorVersion >= 102
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      ? Services.prompt
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      : Components.classes['@mozilla.org/embedcomp/prompt-service;1'].getService(Components.interfaces.nsIPromptService)

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    ps.alert(null, title, body)
  }

  public send(target: EventTarget): void {
    const elt: HTMLElement = target as unknown as HTMLElement
    const plugin: string = elt.getAttribute('label')
    const preferences: string[] = JSON.parse(elt.getAttribute('data-preferences')) as string[]

    this.sendAsync(plugin, preferences).catch((err: Error) => {
      this.alert('Debug log submission error', `${err}`) // eslint-disable-line @typescript-eslint/restrict-template-expressions
    })
  }

  private async sendAsync(plugin: string, preferences: string[]) {
    await this.zotero.Schema.schemaUpdatePromise

    const files: Record<string, Uint8Array> = {}
    const enc = new TextEncoder()

    const key: string = this.zotero.Utilities.generateObjectKey()

    const log = [
      await this.info(preferences),
      this.zotero.getErrors(true).join('\n\n'),
      this.zotero.Debug.getConsoleViewerOutput().slice(-250000).join('\n'), // eslint-disable-line no-magic-numbers
    ].filter((txt: string) => txt).join('\n\n').trim()
    files[`${key}/debug.txt`] = enc.encode(log)

    const rdf = await this.rdf()
    if (rdf) files[`${key}/items.rdf`] = enc.encode(rdf)

    // do this runtime because Zotero is not defined at start for bootstrapped zoter6 plugins
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    if (typeof FormData === 'undefined' && this.zotero.platformMajorVersion >= 102) Components.utils.importGlobalProperties(['FormData'])

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const zip = new Uint8Array(UZip.encode(files) as ArrayBuffer)
    const blob = new Blob([zip], { type: 'application/zip' })
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const formData = new FormData()
    formData.append('file', blob, `${key}.zip`)

    const response = await this.post('https://file.io', formData)
    this.alert(`Debug log ID for ${plugin}`, `${key}-fio-${response.key}`)
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
      prefs[pref] = this.zotero.Prefs.get(pref, true)
    }

    return prefs
  }

  private async post(url: string, data: FormData): Promise<FileIO> {
    const response = await fetch(url, { method: 'POST', body: data })
    return (await response.json()) as FileIO
  }

  // general state of Zotero
  private async info(preferences: string[]): Promise<string> {
    let info = ''

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
    const appInfo: { name: string; version: string } = Components.classes['@mozilla.org/xre/app-info;1'].getService(Components.interfaces.nsIXULAppInfo)
    info += `Application: ${appInfo.name} ${appInfo.version} ${this.zotero.locale}\n`

    const platform = ['Win', 'Mac', 'Linux'].find(p => Zotero[`is${p}`]) || 'Unknown'
    const arch = this.zotero.oscpu || this.zotero.arch
    info += `Platform: ${platform} ${arch}\n`

    const addons: string[] = await this.zotero.getInstalledExtensions()
    if (addons.length) {
      info += 'Addons:\n' + addons.map((addon: string) => `  ${addon}\n`).join('') // eslint-disable-line prefer-template
    }
    info += `Debug logging on at Zotero start: ${this.debugEnabledAtStart}\n`
    info += `Debug logging on at log submit: ${this.zotero.Prefs.get('debug.store') || this.zotero.Debug.enabled}\n`

    for (const [pref, value] of Object.entries(this.preferences(preferences))) {
      info += `${pref} = ${JSON.stringify(value)}\n`
    }

    return info
  }

  private rdf(): Promise<string> {
    return new Promise((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
      const items: any[] = this.zotero.getActiveZoteroPane().getSelectedItems()
      if (items.length === 0) return resolve('')

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      const translation: ExportTranslator = new this.zotero.Translate.Export() as ExportTranslator
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

export const DebugLog = new DebugLogSender()
