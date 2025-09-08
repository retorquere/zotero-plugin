/* eslint-disable no-console */

import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

import { ContinuousIntegration as CI } from './continuous-integration'
import root from './root'

let version: string = null

function load(vpath: string): string {
  return JSON.parse(fs.readFileSync(vpath, 'utf-8')).version as string
}

const version_json = path.join(root, 'gen/version.json')
if (fs.existsSync(version_json)) {
  version = load(version_json)
}
else {
  console.log('writing version')

  version = load(path.join(root, 'package.json'))

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
