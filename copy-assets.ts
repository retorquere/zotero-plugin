#!/usr/bin/env node

import fs from 'fs-extra'
import path from 'path'

// @ts-expect-error TS2835
import { root } from './root'

function allow(file) {
  switch (path.basename(file)) {
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

function shouldCopy(dir) {
  return fs.existsSync(dir) && !fs.existsSync(path.join(dir, '.nomedia'))
}

export function copy() {
  for (const dir of ['defaults', 'content', 'skin', 'locale', 'resource', 'chrome.manifest', 'chrome'].map(_ => path.join(root, _))) {
    if (!shouldCopy(dir)) continue

    fs.copySync(dir, path.join('build', dir), {
      filter(src) {
        if (dir !== 'chrome.manifest' && dir !== 'resource' && !allow(src)) return false
        if (fs.lstatSync(src).isFile()) console.log(' ', src)
        return true
      },
    })
  }

  if (shouldCopy('client')) {
    fs.copySync('client', 'build', {
      filter(src) {
        if (fs.lstatSync(src).isFile()) console.log(' ', src)
        return true
      },
    })
  }
}

copy()
