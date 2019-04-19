import jsesc = require('jsesc')

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

  const value = JSON.parse(source)

  // const jsesc_options = { compact: false, indent: '  ' }
  const jsesc_options = { compact: true }
  return `module.exports = ${jsesc(normalize(value), jsesc_options)};`
}
