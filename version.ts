// tslint:disable:no-console

import * as path from 'path'
import * as os from 'os'
import * as fs from 'fs-extra'

import root from './root'
import { ContinuousIntegration as CI } from './continuous-integration'

let version = null

const version_json = path.join(root, 'gen/version.json')
if (fs.existsSync(version_json)) {
  version = require(version_json)
} else {
  console.log('writing version')

  version = require(path.join(root, 'package.json')).version

  if (CI.service && !CI.tag) {
    version = `${version}.${CI.build_number}`
  } else if (!CI.service) {
    version = `${version}.${os.userInfo().username}.${os.hostname()}`
  }

  fs.writeFileSync(version_json, JSON.stringify(version), 'utf8')
}

export default version
