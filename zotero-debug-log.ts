declare const Zotero: any
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
    const enumerator = Services.wm.getEnumerator('navigator:browser')
    while (enumerator.hasMoreElements()) {
      const win = enumerator.getNext()
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
    const ps = Components.classes['@mozilla.org/embedcomp/prompt-service;1'].getService(Components.interfaces.nsIPromptService)
    ps.alert(null, title, body)
  }

  private select(): string {
    const plugins = Object.keys(this.plugins)
    if (plugins.length === 1) return plugins[0]

    const prompts = Components.classes['@mozilla.org/embedcomp/prompt-service;1'].getService(Components.interfaces.nsIPromptService)
    const selected = { value: -1 }
    if (!prompts.select(null, 'Plugin', 'Send debug log for', plugins.length, plugins, selected)) return null
    return plugins[selected.value]
  }

  public send() {
    this.sendAsync().catch(err => {
      this.alert('Debug log submission error', `${err}`)
    })
  }
  private async sendAsync() {
    await Zotero.Schema.schemaUpdatePromise

    const plugin = this.select()
    const zip = new Zip()
    const key = Zotero.Utilities.generateObjectKey()

    const log = [
      await this.info(plugin),
      Zotero.getErrors(true).join('\n\n'),
      Zotero.Debug.getConsoleViewerOutput().slice(-250000).join('\n'), // eslint-disable-line @typescript-eslint/no-magic-numbers
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
  private async info(plugin) {
    let info = ''

    const appInfo = Components.classes['@mozilla.org/xre/app-info;1'].getService(Components.interfaces.nsIXULAppInfo)
    info += `Application: ${appInfo.name} ${appInfo.version} ${Zotero.locale}\n`
    info += `Platform: ${Zotero.platform} ${Zotero.oscpu}\n`

    const addons = await Zotero.getInstalledExtensions()
    if (addons.length) {
      info += 'Addons:\n'
      for (const addon of addons) {
        info += `  ${addon}\n`
      }
    }

    for (const pref of (this.plugins[plugin] || [])) {
      info += `${pref} = ${JSON.stringify(Zotero.Prefs.get(pref))}\n`
    }

    return info
  }

  private rdf(): Promise<string> {
    return new Promise((resolve, reject) => {
      const items = Zotero.getActiveZoteroPane().getSelectedItems()
      if (items.length === 0) return resolve('')

      const translation = new Zotero.Translate.Export()
      translation.setItems(items)
      translation.setTranslator('14763d24-8ba0-45df-8f52-b8d1108e7ac9') // rdf

      translation.setHandler('done', (obj, success) => {
        if (success) {
          resolve(obj ? obj.string as string : undefined)
        }
        else {
          reject('translation failed')
        }
      })

      translation.translate()
    })
  }
}

Zotero.DebugLogSender = Zotero.DebugLogSender || new DebugLogSender
export const DebugLog = Zotero.DebugLogSender
