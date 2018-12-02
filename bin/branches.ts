#!/usr/bin/env node

process.on('unhandledRejection', up => { throw up })

import 'dotenv/config'
import * as path from 'path'

import * as OctoKit from '@octokit/rest'
const octokit = new OctoKit
octokit.authenticate({ type: 'token', token: process.env.GITHUB_TOKEN })

import root from '../root'
const pkg = require(path.join(root, 'package.json'))
const [ , owner, repo ] = pkg.repository.url.match(/:\/\/github.com\/([^\/]+)\/([^\.]+)\.git$/)

async function main() {
  const branches = await octokit.repos.listBranches({ owner, repo })

  for (const branch of branches.data) {
    if (branch.name.match(/^[0-9]+$/)) {
      const issue = await octokit.issues.get({ owner, repo, number: parseInt(branch.name) })
      if (issue.data.state !== 'open') console.log(branch.name, issue.data.state) // tslint:disable-line:no-console

    } else if (branch.name !== 'master' && branch.name !== 'gh-pages') {
      console.log(branch.name) // tslint:disable-line:no-console

    }
  }
}

main()
