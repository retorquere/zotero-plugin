/* eslint-disable @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-empty-function, no-restricted-syntax */

declare const Zotero: any

declare const dump: (msg: string) => void

function stringifyXPCOM(obj): string {
  if (!obj.QueryInterface) return ''
  if (obj.message) return `[XPCOM error ${obj.message}]`
  if (obj.name) return `[XPCOM object ${obj.name}]`
  return '[XPCOM object]'
}

function stringifyError(obj) {
  if (obj instanceof Error) return `[error: ${obj.message || '<unspecified error>'}\n${obj.stack}]`
  // guess it is an errorevent
  if (obj.error instanceof Error && obj.message) return `[errorevent: ${obj.message} ${stringifyError(obj.error)}]`
  if (typeof ErrorEvent !== 'undefined' && obj instanceof ErrorEvent) return `[errorevent: ${obj.message || '<unspecified errorevent>'}]`
  return ''
}

function replacer() {
  const seen = new WeakSet()
  return (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) return '[Circular]'
      seen.add(value)
    }

    if (value === null) return value
    if (value instanceof Set) return [...value]
    if (value instanceof Map) return Object.fromEntries(value)

    switch (typeof value) {
      case 'string':
      case 'number':
      case 'boolean':
        return value

      case 'object':
        return stringifyXPCOM(value) || stringifyError(value) || value
    }

    if (Array.isArray(value)) return value

    return undefined
  }
}

export class Logger {
  public phase = ''
  public indent?: number

  constructor(public id: string) {
  }

  #prefix(error?: any) {
    return `{${error ? 'error: ' : ''}${this.phase}${this.id}} `
  }

  public debug(...msg): void {
    Zotero.debug(`${this.#prefix()}${this.format(...msg)}\n`)
  }

  public info(...msg): void {
    Zotero.debug(`${this.#prefix()}${this.format(...msg)}\n`)
  }

  public error(...msg): void {
    Zotero.debug(`${this.#prefix(true)}${this.format(...msg)}\n`)
  }

  public dump(msg: string, error?: Error): void {
    if (error) {
      dump(`${this.#prefix(error)}${this.format(msg, error)}\n`)
    }
    else {
      dump(`${this.#prefix()}${this.format(msg)}\n`)
    }
  }

  private to_s(obj: any): string {
    if (typeof obj === 'string') return obj
    return JSON.stringify(obj, replacer(), this.indent)
  }

  public format(...msg): string {
    return msg.map(m => this.to_s(m)).join(' ')
  }
}
