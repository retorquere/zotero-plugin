#!/usr/bin/env node

import fs from 'fs'
import os from 'os'
import path from 'path'

// @ts-expect-error TS2835
import { ContinuousIntegration as CI } from './continuous-integration'
// @ts-expect-error TS2835
import { pkg, root } from './find-root'

export function version(): string {
  let version = pkg.version as string

  if (CI.service && !CI.tag) {
    const issue = CI.issue && process.env.VERSION_WITH_ISSUE !== 'false' ? `.${CI.issue}` : ''
    version = `${version}${issue}.${CI.build_number}`
  }
  else if (!CI.service) {
    version = `${version}.${os.userInfo().username}.${os.hostname()}`
  }

  const version_module = path.join(root, 'gen', 'version.cjs')
  if (!fs.existsSync(path.dirname(version_module))) fs.mkdirSync(path.dirname(version_module))
  fs.writeFileSync(version_module, `module.exports = { version: ${JSON.stringify(version)} }`)
  return version
}

version()
