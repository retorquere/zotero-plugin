import jsesc = require('jsesc')
import JSON5 = require('json5')

function normalize(obj) {
  if (Array.isArray(obj)) {
    return obj.map(normalize)
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

  return obj
}

export = function loader(source) {
  if (this.cacheable) this.cacheable()

  const value = typeof source === 'string' ? JSON5.parse(source) : source

  return `module.exports = ${jsesc(normalize(value), { compact: false, indent: '  ' })};`
}
