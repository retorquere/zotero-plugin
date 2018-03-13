export default function BailPlugin() {
  compiler.hooks.done.tap('BailPlugin', stats => {
    while (stats.compilation.warnings.length) {
      stats.compilation.errors.push(stats.compilation.warnings.pop())
    }
  })
}
