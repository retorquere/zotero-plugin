import * as peggy from 'peggy'

export = function loader(source: string): string {
  return peggy.generate(source, {
    output: 'source',
    format: 'commonjs',
  })
}
