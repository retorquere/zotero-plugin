import { OnLoadArgs, PluginBuild } from 'esbuild'
import fs from 'fs'

export const pem = {
  name: 'PEM loader',
  setup(build: PluginBuild) {
    build.onLoad({ filter: /[.]pem$/i }, async (args: OnLoadArgs) => {
      return {
        contents: await fs.promises.readFile(args.path, 'utf-8'),
        loader: 'text',
      }
    })
  },
}
