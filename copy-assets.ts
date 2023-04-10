/* eslint-disable no-console, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */

import * as fs from 'fs-extra'
import * as path from 'path'

import root from './root'

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

for (const dir of ['defaults', 'content', 'skin', 'locale', 'resource', 'chrome.manifest']) {
  if (!copy(dir)) continue

  fs.copySync(dir, path.join('build', dir), {
    filter(src, dest) {
      if (dir !== 'chrome.manifest' && dir !== 'resource' && !allow(src)) return false
      if (fs.lstatSync(src).isFile()) console.log(' ', src)
      return true
    }
  })
}

if (copy('client')) {
  fs.copySync('client', 'build', {
    filter(src) {
      if (fs.lstatSync(src).isFile()) console.log(' ', src)
      return true
    }
  })
}
