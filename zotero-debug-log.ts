type ZoteroPane = {
  getSelectedItems: () => any[]
}
declare const Zotero: {
  DebugLogSender: DebugLogSender
  Translate: any
  Prefs: {
    get: (name: string) => string | number | boolean
  }
  getInstalledExtensions: () => Promise<string[]>
  platform: string
  oscpu: string
  locale: string
  Utilities: {
    generateObjectKey: () => string
  }
  Debug: {
    getConsoleViewerOutput: () => string[]
  }
  getErrors: (something: boolean) => string[]
  Schema: {
    schemaUpdatePromise: Promise<void>
  }
  getActiveZoteroPane: () => ZoteroPane
}
type ExportTranslator = {
  setHandler: (phase: string, handler: (obj: { string: string }, success: boolean) => void) => void // eslint-disable-line id-blacklist
  setTranslator: (id: string) => void
  setItems: (items: any[]) => void
  translate: () => void
}
declare const Components: any
declare const Services: any

import Zip from 'jszip'

type FileIO = {
  success: boolean
  key: string
  link: string
}

class DebugLogSender { // tslint:disable-line:variable-name
  private enabled = false
  private plugins: Record<string, string[]> = {}

  public register(plugin: string, preferences: string[]): void {
    this.plugins[plugin] = preferences
    this.enabled = true

    let doc: Document = null
    const enumerator = Services.wm.getEnumerator('navigator:browser') // eslint-disable-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    while (enumerator.hasMoreElements()) { // eslint-disable-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      const win: { ZoteroPane: boolean; document: Document } = enumerator.getNext() // eslint-disable-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
      if (!win.ZoteroPane) continue
      doc = win.document
    }

    if (!doc.querySelector('menuitem#debug-log-menu')) {
      const help = doc.querySelector('menupopup#menu_HelpPopup')
      const menuitem = help.appendChild(doc.createElement('menuitem'))
      menuitem.setAttribute('id', 'debug-log-menu')
      menuitem.setAttribute('label', 'Send debug log to file.io')
      menuitem.setAttribute('oncommand', 'Zotero.DebugLogSender.send()')
    }
  }

  private alert(title, body) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const ps = Components.classes['@mozilla.org/embedcomp/prompt-service;1'].getService(Components.interfaces.nsIPromptService)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    ps.alert(null, title, body)
  }

  private select(): string {
    const plugins = Object.keys(this.plugins)
    if (plugins.length === 1) return plugins[0]

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const prompts = Components.classes['@mozilla.org/embedcomp/prompt-service;1'].getService(Components.interfaces.nsIPromptService)
    const selected = { value: -1 }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    if (!prompts.select(null, 'Plugin', 'Send debug log for', plugins.length, plugins, selected)) return null
    return plugins[selected.value]
  }

  public send() {
    this.sendAsync().catch((err: Error) => {
      this.alert('Debug log submission error', `${err}`) // eslint-disable-line @typescript-eslint/restrict-template-expressions
    })
  }
  private async sendAsync() {
    await Zotero.Schema.schemaUpdatePromise

    const plugin = this.select()
    const zip = new Zip()
    const key: string = Zotero.Utilities.generateObjectKey()

    const log = [
      await this.info(plugin),
      Zotero.getErrors(true).join('\n\n'),
      Zotero.Debug.getConsoleViewerOutput().slice(-250000).join('\n'), // eslint-disable-line no-magic-numbers
    ].filter((txt: string) => txt).join('\n\n').trim()
    zip.file(`${key}/${key}.txt`, log)

    const rdf = await this.rdf()
    if (rdf) zip.file(`${key}/${key}.rdf`, rdf)

    const zipped = await zip.generateAsync({
      type: 'uint8array',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 },
    })

    const blob = new Blob([zipped], { type: 'application/zip'})
    const formData = new FormData()
    formData.append('file', blob, `${key}.zip`)

    const response = await this.post('https://file.io', formData)
    this.alert(`Debug log ID for ${plugin}`, `${response.key}-${key}`)
  }

  private async post(url: string, data: FormData): Promise<FileIO> {
    const response = await fetch(url, { method: 'POST', body: data })
    return (await response.json()) as FileIO
  }

  // general state of Zotero
  private async info(plugin: string) {
    let info = ''

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
    const appInfo: { name: string; version: string } = Components.classes['@mozilla.org/xre/app-info;1'].getService(Components.interfaces.nsIXULAppInfo)
    info += `Application: ${appInfo.name} ${appInfo.version} ${Zotero.locale}\n`
    info += `Platform: ${Zotero.platform} ${Zotero.oscpu}\n`

    const addons: string[] = await Zotero.getInstalledExtensions()
    if (addons.length) {
      info += 'Addons:\n' + addons.map((addon: string) => `  ${addon}\n`).join('') // eslint-disable-line prefer-template
    }

    for (const pref of (this.plugins[plugin] || [])) {
      info += `${pref} = ${JSON.stringify(Zotero.Prefs.get(pref))}\n`
    }

    return info
  }

  private rdf(): Promise<string> {
    return new Promise((resolve, reject) => {
      const items: any[] = Zotero.getActiveZoteroPane().getSelectedItems() // eslint-disable-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
      if (items.length === 0) return resolve('')

      const translation: ExportTranslator = new Zotero.Translate.Export() as ExportTranslator // eslint-disable-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      translation.setItems(items)
      translation.setTranslator('14763d24-8ba0-45df-8f52-b8d1108e7ac9') // rdf

      translation.setHandler('done', (obj, success) => {
        if (success) {
          resolve(obj ? obj.string : undefined)
        }
        else {
          reject('translation failed')
        }
      })

      translation.translate() // eslint-disable-line @typescript-eslint/no-unsafe-call
    })
  }
}

Zotero.DebugLogSender = Zotero.DebugLogSender || new DebugLogSender
export const DebugLog: DebugLogSender = Zotero.DebugLogSender as unknown as DebugLogSender
