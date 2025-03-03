/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */

import jsesc from 'jsesc'

function normalize(obj) {
  if (Array.isArray(obj)) {
    return obj.map(normalize) // eslint-disable-line @typescript-eslint/no-unsafe-return
  }

  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((n, p) => {
      n[p.normalize('NFC')] = normalize(obj[p])
      return n
    }, {})
  }

  if (typeof obj === 'string') {
    return obj.normalize('NFC')
  }

  return obj // eslint-disable-line @typescript-eslint/no-unsafe-return
}

export default function loader(source: string): string {
  // if (this.cacheable) this.cacheable()

  const value = typeof source === 'string' ? JSON.parse(source) : source

  // const jsesc_options = { compact: false, indent: '  ' }
  const jsesc_options = { compact: true }
  return `module.exports = ${jsesc(normalize(value), jsesc_options)};` // eslint-disable-line @typescript-eslint/restrict-template-expressions
}
