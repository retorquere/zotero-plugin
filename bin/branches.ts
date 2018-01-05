#!/usr/bin/env node

import 'dotenv/config'
import * as path from 'path'

import * as GitHub from 'github'
const github = new GitHub
github.authenticate({ type: 'token', token: process.env.GITHUB_TOKEN })

import root from '../root'
const pkg = require(path.join(root, 'package.json'))
const [ , owner, repo ] = pkg.repository.url.match(/:\/\/github.com\/([^\/]+)\/([^\.]+)\.git$/)

async function _main() {
  const branches = await github.repos.getBranches({ owner, repo })

  for (const branch of branches.data) {
    if (branch.name.match(/^[0-9]+$/)) {
      const issue = await github.issues.get({ owner, repo, number: parseInt(branch.name) })
      if (issue.data.state !== 'open') console.log(branch.name, issue.data.state) // tslint:disable-line:no-console

    } else if (branch.name !== 'master' && branch.name !== 'gh-pages') {
      console.log(branch.name) // tslint:disable-line:no-console

    }
  }
}

async function main() {
  try {
    await _main()
  } catch (err) {
    console.log(err) // tslint:disable-line:no-console
  }
}

main()
