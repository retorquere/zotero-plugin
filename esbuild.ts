import fs from 'fs'

export const pem = {
  name: 'PEM loader',
  setup(build) {
    build.onLoad({ filter: /[.]pem$/i }, async args => {
      return {
        contents: await fs.promises.readFile(args.path, 'utf-8'),
        loader: 'text',
      }
    })
  },
}
