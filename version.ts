/* eslint-disable no-console */

import * as path from 'path'
import * as os from 'os'
import * as fs from 'fs-extra'

import root from './root'
import { ContinuousIntegration as CI } from './continuous-integration'

let version = null

const version_js = path.join(root, 'gen/version.js')
if (fs.existsSync(version_js)) {
  version = require(version_js)
} else {
  console.log('writing version')

  version = require(path.join(root, 'package.json')).version

  if (CI.service && !CI.tag) {
    version = `${version}.${CI.build_number}`
  } else if (!CI.service) {
    version = `${version}.${os.userInfo().username}.${os.hostname()}`
  }

  fs.writeFileSync(version_js, `module.exports = ${JSON.stringify(version)};\n`, 'utf8')
}

export default version
