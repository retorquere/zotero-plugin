/* eslint-disable no-console */

import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

import { ContinuousIntegration as CI } from './continuous-integration'
import root from './root'

let version: string = null

const version_json = path.join(root, 'gen/version.json')
if (fs.existsSync(version_json)) {
  version = require(version_json).version as string // eslint-disable-line @typescript-eslint/no-require-imports
}
else {
  console.log('writing version')

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
  version = require(path.join(root, 'package.json')).version // eslint-disable-line @typescript-eslint/no-require-imports

  if (CI.service && !CI.tag) {
    const issue = CI.issue && process.env.VERSION_WITH_ISSUE !== 'false' ? `.${CI.issue}` : ''
    version = `${version}${issue}.${CI.build_number}`
  }
  else if (!CI.service) {
    version = `${version}.${os.userInfo().username}.${os.hostname()}`
  }

  if (!fs.existsSync(path.dirname(version_json))) fs.mkdirSync(path.dirname(version_json))
  fs.writeFileSync(version_json, JSON.stringify({ version }))
}

export default version
