#!/usr/bin/env node

import 'dotenv/config'

import AWSS3Form = require('aws-s3-form')
import moment = require('moment')
import * as path from 'path'
import stringToArrayBuffer = require('string-to-arraybuffer')

import * as OctoKit from '@octokit/rest'
const octokit = new OctoKit
octokit.authenticate({ type: 'token', token: process.env.GITHUB_TOKEN })

import root from '../root'

const pkg = require(path.join(root, 'package.json'))

const [ , owner, repo ] = pkg.repository.url.match(/:\/\/github.com\/([^\/]+)\/([^\.]+)\.git$/)

const expireAfterDay = 6

function verify(key) {
  if (process.env[key]) return
  console.log(`${key} not set, cannot proceed`) // tslint:disable-line:no-console
  process.exit(1)
}

async function replaceAsset(release, request) {
  for (const asset of release.data.assets || []) {
    if (asset.name === request.name) await octokit.repos.deleteAsset({ owner, repo, id: asset.id })
  }

  request.contentLength = request.body.length
  request.file = stringToArrayBuffer(request.body) // workaround for https://github.com/octokit/rest.js/issues/714
  delete request.body
  await octokit.repos.uploadAsset(request)
}

async function main() {
  verify('AWSAccessKeyId')
  verify('AWSSecretAccessKey')

  const formGenerator = new AWSS3Form({
    accessKeyId: process.env.AWSAccessKeyId,
    secretAccessKey: process.env.AWSSecretAccessKey,
    region: pkg.bugs.logs.region,
    bucket: pkg.bugs.logs.bucket,
    policyExpiration: moment.duration(expireAfterDay, 'days').asSeconds(),
    acl: 'private',
    useUuid: false,
  })

  const release = await octokit.repos.getReleaseByTag({ owner, repo, tag: pkg.xpi.releaseURL.split('/').filter(part => part).reverse()[0] })

  const form = formGenerator.create('${filename}')

  await replaceAsset(release, {
    url: release.data.upload_url,
    body: JSON.stringify(form, null, 2),
    contentType: 'application/json',
    name: 'error-report.json',
  })

  /*
  const template = fs.readFileSync(path.join(__dirname, '..', 'error-report.pug'), 'utf8')

  await replaceAsset(release, {
    url: release.data.upload_url,
    body: pug.render(template, { form }),
    contentType: 'text/html',
    name: 'error-report.html',
  })
  */
}

asyn function run() {
  try {
    main()
  } catch (err) {
    console.log(err)
    process.exit(1)
  }
}

run()
