/* eslint-disable prefer-arrow/prefer-arrow-functions, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */

import * as pegjs from 'pegjs'

export = function loader(source: string): string {
  // Description of PEG.js options: https://github.com/pegjs/pegjs#javascript-api
  return pegjs.generate(source, {
    output: 'source',
    cache: false,
    optimize: 'speed',
    trace: false,
    format: 'commonjs',
  })
}
