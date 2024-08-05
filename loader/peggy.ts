/* eslint-disable prefer-arrow/prefer-arrow-functions, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */

import * as peggy from 'peggy'

export default function loader(source: string): string {
  return peggy.generate(source, {
    output: 'source',
    format: 'commonjs',
  })
}
