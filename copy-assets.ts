/* eslint-disable no-console */

import * as fs from 'fs-extra'
import * as path from 'path'

function allow(file) {
  switch(path.basename(file)) {
    case '.DS_Store':
      return false
  }

  switch (path.extname(file).toLowerCase()) {
    case '.json':
    case '.ts':
    case '.peggy':
    case '.pug':
      return false
  }

  return true
}

console.log('copying assets')

function copy(dir) {
  return fs.existsSync(dir) && !fs.existsSync(path.join(dir, '.nomedia'))
}

for (const dir of ['defaults', 'content', 'skin', 'locale', 'resource', 'chrome.manifest', 'chrome']) {
  if (!copy(dir)) continue

  fs.copySync(dir, path.join('build', dir), {
    filter: src => {
      if (dir !== 'chrome.manifest' && dir !== 'resource' && !allow(src)) return false
      if (fs.lstatSync(src).isFile()) console.log(' ', src)
      return true
    },
  })
}

if (copy('client')) {
  fs.copySync('client', 'build', {
    filter: src => {
      if (fs.lstatSync(src).isFile()) console.log(' ', src)
      return true
    },
  })
}
