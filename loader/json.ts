import { OnLoadArgs, PluginBuild } from 'esbuild'
import fs from 'fs'

export const json = {
  name: 'json',
  setup(build: PluginBuild) {
    build.onLoad({ filter: /\.json$/ }, async (args: OnLoadArgs) => {
      const json = await fs.promises.readFile(args.path, 'utf-8')
      return {
        contents: `export default ${json.normalize('NFC')}`,
        loader: 'js',
      }
    })
  },
}
