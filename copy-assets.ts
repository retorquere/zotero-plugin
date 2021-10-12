/* eslint-disable no-console, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */

import * as fs from 'fs'
import * as glob from 'glob'
import * as path from 'path'

import root from './root'

function include(file, sources) {
  if (fs.lstatSync(file).isDirectory()) return false

  if (!sources) return true

  switch (path.extname(file).toLowerCase()) {
    case '.json':
    case '.ts':
    case '.pegjs':
      return false
  }

  return true
}

console.log('copying assets')

let files = []
for (const dir of ['defaults', 'content', 'skin', 'locale', 'resource']) {
  if (fs.existsSync(dir) && !fs.existsSync(`${dir}/.nomedia}`)) {
    files = files.concat(glob.sync(`${dir}/**/*.*`, { cwd: root, mark: true }).filter(file => include(file, dir !== 'resource')))
  }
}
files.push('chrome.manifest')

for (const source of (files as string[])) {
  console.log(`  ${source}`)
  const target = path.join(root, 'build', source)
  if (!fs.existsSync(path.dirname(target))) fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.copyFileSync(source, target)
}
