/* eslint-disable no-console, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */

import * as fs from 'fs'
import * as path from 'path'
import { rimrafSync } from 'rimraf'

import { root } from './find-root'

console.log('make build dirs')
for (const dir of [path.join(root, 'build'), path.join(root, 'gen'), path.join(root, 'xpi')]) {
  rimrafSync(dir)
  fs.mkdirSync(dir)
}
