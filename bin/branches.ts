#!/usr/bin/env node

/* eslint-disable no-console, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */

process.on('unhandledRejection', up => { throw up })

import 'dotenv/config'
import * as path from 'path'

import { Octokit } from '@octokit/rest'
const octokit = new Octokit({ auth: `token ${process.env.GITHUB_TOKEN}` })

import root from '../root'
const pkg = require(path.join(root, 'package.json'))
const [ , owner, repo ] = pkg.repository.url.match(/:\/\/github.com\/([^/]+)\/([^.]+)\.git$/)

async function main() {
  const branches = await octokit.repos.listBranches({ owner, repo })

  for (const branch of branches.data) {
    if (/^[0-9]+$/.exec(branch.name)) {
      const issue = await octokit.issues.get({ owner, repo, issue_number: parseInt(branch.name) })
      if (issue.data.state !== 'open') console.log(branch.name, issue.data.state) // eslint-disable-line no-console
    }
    else if (branch.name !== 'master' && branch.name !== 'gh-pages') {
      console.log(branch.name)
    }
  }
}

main().catch(err => console.log(err))
