#!/usr/bin/env node

/* eslint-disable @typescript-eslint/no-unsafe-argument, no-console, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/restrict-template-expressions */

process.on('unhandledRejection', up => {
  throw up
})

import 'dotenv/config'
import * as fs from 'fs'
import moment from 'moment'
import * as path from 'path'

import { Octokit } from '@octokit/rest'
const octokit = new Octokit({ auth: `token ${process.env.GITHUB_TOKEN}` })

import { ContinuousIntegration as CI } from '../continuous-integration'
import root from '../root'

const pkg = require(path.join(root, 'package.json'))
const [, owner, repo] = pkg.repository.url.match(/:\/\/github.com\/([^/]+)\/([^.]+)\.git$/)

import version from '../version'
const xpi = `${pkg.name}-${version}.xpi`

const PRERELEASE = false
// eslint-disable-next-line no-magic-numbers
const EXPIRE_BUILDS = moment().subtract(7, 'days').toDate().toISOString()

function bail(msg, status = 1) {
  console.log(msg) // eslint-disable-line no-console
  process.exit(status)
}

const dryRun = !CI.service
if (dryRun) {
  console.log('Not running on CI service, switching to dry-run mode') // eslint-disable-line no-console
  CI.branch = require('current-git-branch')()
}

function report(msg) {
  console.log(`${dryRun ? 'dry-run: ' : ''}${msg}`) // eslint-disable-line no-console
}

if (CI.pull_request) bail('Not releasing pull requests', 0)

if (CI.tag) {
  if (`v${pkg.version}` !== CI.tag) bail(`Building tag ${CI.tag}, but package version is ${pkg.version}`)

  if (CI.branch && CI.branch !== 'master' && CI.branch !== 'main') bail(`Building tag ${CI.tag}, but branch is ${CI.branch}`)
}

const tags = new Set()
for (let regex = /(?:^|\s)(?:#)([a-zA-Z\d]+)/gm, tag; tag = regex.exec(CI.commit_message);) {
  tags.add(tag[1])
}

if (tags.has('norelease')) bail(`Not releasing on ${CI.branch || 'default branch'} because of 'norelease' tag`, 0)

const issues: Set<number> = new Set(Array.from(tags).map(parseInt).filter(tag => !isNaN(tag)))
if ((/^((issue|gh)-)?[0-9]+(-[a-z]+)?$/i).exec(CI.branch)) {
  issues.add(parseInt(CI.branch.replace(/[^0-9]/g, '')))
}

async function announce(issue_number, release) {
  if (tags.has('noannounce')) return

  let build
  let reason = ''

  if (CI.tag) {
    build = `${PRERELEASE ? 'pre-' : ''}release ${CI.tag}`
  }
  else {
    build = `test build ${version}`
  }
  const link = `[${build}](https://github.com/${owner}/${repo}/releases/download/${release.data.tag_name}/${pkg.name}-${version}.xpi)`

  if (!CI.tag) {
    reason = ` (${JSON.stringify(CI.commit_message)})`
    reason += `\n\nThis update may name other issues, but the build just dropped here is for you; it just means problems already fixed in other issues have been folded into the work we are doing here. Install in Zotero by downloading ${link}, opening the Zotero "Tools" menu, selecting "Add-ons", open the gear menu in the top right, and select "Install Add-on From File...".`
  }

  const body = `:robot: this is your friendly neighborhood build bot announcing ${link}${reason}`

  report(body)
  if (dryRun) return

  try {
    const locked = (await octokit.issues.get({ owner, repo, issue_number })).data.locked
    if (locked) await octokit.issues.unlock({ owner, repo, issue_number })
    await octokit.issues.createComment({ owner, repo, issue_number, body })
    if (locked) await octokit.issues.lock({ owner, repo, issue_number })
  }
  catch (error) {
    console.log(`Failed to announce '${build}: ${reason}' on ${issue_number}`) // eslint-disable-line no-console
  }

  if (process.env.GITHUB_ENV) fs.appendFileSync(process.env.GITHUB_ENV, `XPI_RELEASED=${issue_number}\n`)
}

async function uploadAsset(release, asset, contentType) {
  report(`uploading ${path.basename(asset)} to ${release.data.tag_name}`)
  if (dryRun) return

  const name = path.basename(asset)
  const exists = (await octokit.repos.listReleaseAssets({ owner, repo, release_id: release.data.id })).data.find(a => a.name === name)
  if (exists) {
    if (release.data.tag_name === 'builds') {
      await octokit.repos.deleteReleaseAsset({ owner, repo, asset_id: exists.id })
    }
    else {
      bail(`failed to upload ${path.basename(asset)} to ${release.data.html_url}: asset exists`)
    }
  }

  try {
    await octokit.repos.uploadReleaseAsset({
      owner,
      repo,
      url: release.data.upload_url,
      release_id: release.data.id,
      data: (fs.readFileSync(asset) as unknown as string), // TODO: what is going on here octokit?!
      headers: {
        'content-type': contentType,
        'content-length': fs.statSync(asset).size,
      },
      name,
    })
  }
  catch (err) {
    bail(`failed to upload ${path.basename(asset)} to ${release.data.html_url}: ${err}`)
  }
}

async function getRelease(tag, prerelease) {
  try {
    return await octokit.repos.getReleaseByTag({ owner, repo, tag })
  }
  catch {
    try {
      return await octokit.repos.createRelease({ owner, repo, tag_name: tag, prerelease })
    }
    catch (err) {
      bail(`Could not get release ${tag}: ${err}`)
      return null
    }
  }
}

async function update_rdf(releases_tag: string) {
  const release = await getRelease(releases_tag, false)

  const assets = (await octokit.repos.listReleaseAssets({ owner, repo, release_id: release.data.id })).data

  for (const asset of assets) {
    if (asset.name === 'update.rdf' || asset.name === 'updates.json') {
      report(`removing ${asset.name} from ${release.data.tag_name}`)
      // TODO: double asset.id until https://github.com/octokit/rest.js/issues/933 is fixed
      if (!dryRun) await octokit.repos.deleteReleaseAsset({ owner, repo, asset_id: asset.id })
    }
  }
  await uploadAsset(release, path.join(root, 'gen/update.rdf'), 'application/rdf+xml')
  await uploadAsset(release, path.join(root, 'gen/updates.json'), 'application/json')
}

async function main(): Promise<void> {
  if (process.env.NIGHTLY === 'true') return

  if (CI.branch === 'l10n_master') {
    for (const issue of (await octokit.issues.listForRepo({ owner, repo, state: 'open', labels: 'translation' })).data) {
      issues.add(issue.number)
    }
  }

  let release
  if (CI.tag) {
    // upload XPI

    try {
      await octokit.repos.getReleaseByTag({ owner, repo, tag: CI.tag })
      bail(`release ${CI.tag} exists, bailing`)
    }
    catch (err) { // eslint-disable-line @typescript-eslint/no-unused-vars
      // actually OK
    }

    report(`uploading ${xpi} to new release ${CI.tag}`)
    if (!dryRun) {
      release = await octokit.repos.createRelease({ owner, repo, tag_name: CI.tag, prerelease: !!PRERELEASE, body: process.argv[2] || '' })
      await uploadAsset(release, path.join(root, `xpi/${xpi}`), 'application/vnd.zotero.plugin')
    }

    // RDF update pointer(s)
    await update_rdf(pkg.xpi.releaseURL.split('/').filter((name: string) => name).reverse()[0])
  }
  else if (issues.size) { // only release builds tied to issues
    release = await getRelease('builds', true)

    for (const asset of release.data.assets || []) {
      if (asset.name.endsWith('.xpi') && asset.created_at < EXPIRE_BUILDS) {
        report(`deleting ${asset.name}`)
        // TODO: double asset.id until https://github.com/octokit/rest.js/issues/933 is fixed
        if (!dryRun) await octokit.repos.deleteReleaseAsset({ owner, repo, asset_id: asset.id })
      }
    }
    await uploadAsset(release, path.join(root, `xpi/${xpi}`), 'application/vnd.zotero.plugin')
  }

  if (process.env.VERBOSE) console.log({ tag: CI.tag, issues, release, tags })

  for (const issue of Array.from(issues)) {
    await announce(issue, release)
  }
}

main().catch(err => console.log(err))
