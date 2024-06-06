/* eslint-disable no-console */

import * as path from 'path'
import * as os from 'os'
import * as fs from 'fs'

import root from './root'
import { ContinuousIntegration as CI } from './continuous-integration'

let version: string = null

const version_js = path.join(root, 'gen/version.js')
if (fs.existsSync(version_js)) {
  version = (require(version_js) as string)
}
else {
  console.log('writing version')

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
  version = require(path.join(root, 'package.json')).version

  if (CI.service && !CI.tag) {
    const issue = CI.issue ? `.${CI.issue}` : ''
    version = `${version}${issue}.${CI.build_number}`
  }
  else if (!CI.service) {
    version = `${version}.${os.userInfo().username}.${os.hostname()}`
  }

  if (!fs.existsSync(path.dirname(version_js))) fs.mkdirSync(path.dirname(version_js))
  fs.writeFileSync(version_js, `module.exports = ${JSON.stringify(version)};\n`, 'utf8')
}

export default version
