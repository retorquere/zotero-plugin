#!/usr/bin/env node

import os from 'node:os'

import { ContinuousIntegration as CI } from './bin/continuous-integration'
import { pkg } from './bin/find-root'

export let version = ''
export let release = Boolean(CI.tag)

export function buildNumber(n = 4) {
  version = pkg.version as string

  if (!release && CI.service) {
    version += '.' + `${CI.build_number % (10 ** n)}`.padStart(n, '0') // assuming you are not outputting thousands of builds a week
  }
  else if (!release) {
    version += `.${os.userInfo().username}.${os.hostname()}`
  }
}

buildNumber()
