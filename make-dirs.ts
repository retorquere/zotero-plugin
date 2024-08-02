/* eslint-disable no-console, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */

import { rimrafSync } from 'rimraf'
import * as fs from 'fs'
import * as path from 'path'

import root from './root'

console.log('make build dirs')
for (const dir of [ path.join(root, 'build'), path.join(root, 'gen'), path.join(root, 'xpi') ]) {
  rimrafSync(dir)
  fs.mkdirSync(dir)
}
