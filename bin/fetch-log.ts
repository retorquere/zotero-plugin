#!/usr/bin/env node

import { Command } from 'commander'
import crypto, { webcrypto } from 'crypto'
import fs from 'fs'
import * as jose from 'jose'
import StreamZip from 'node-stream-zip'
import { Readable } from 'node:stream'
import { finished } from 'node:stream/promises'
import path from 'path'

import { Entry as KeyRingEntry } from '@napi-rs/keyring'
import prompts from 'prompts'

import { KEY_WRAPPING_ALG } from '../crypto'
import { pkg } from './find-root'

async function getPassphrase(): Promise<string> {
  const service = `${pkg.name} Zotero plugin`
  const account = `${pkg.name}-debug-log`
  const entry = new KeyRingEntry(service, account)
  let passphrase = entry.getPassword()
  if (!passphrase) {
    const response = await prompts({
      type: 'password',
      name: 'passphrase',
      message: `Enter a passphrase to decrypt your private key for ${service} ${account}:`,
    })
    entry.setPassword(passphrase = response.passphrase)
  }
  return passphrase
}

const oops = (...args) => {
  console.error(...args)
  process.exit(1)
}

const program = new Command()
program
  .description('A script to fetch debug logs.')
  .option('-p, --private <path>', 'Path for the encrypted private key .pem file', 'private.pem')
  .option('-k, --keep', 'Keep the downloaded zip', false)
  .argument('<debug log id>', 'debug log ID to fetch')
  .parse(process.argv)
const options = program.opts()
const args = program.args

if (!args.length) oops('No log ID')

let m = args[0].match(/^(?<key>[a-z0-9]+)-(?<host>[^-]+)-(?<remote>[^.]+)(?<tags>.*)$/i)
if (!m) oops(args[0], 'is not a valid log ID')

if (m.groups.host !== '0x0') oops('Unexpected debug log host', m.groups.host)

options.encrypted = m.groups.tags.split('.').includes('enc')
options.zip = path.join('logs', `${m.groups.key}.zip`)
options.url = `https://0x0.st/${m.groups.remote}.zip`

if (options.encrypted) {
  if (!options.private) oops('No private key provided')
  if (!fs.existsSync(options.private)) oops('Private key', options.private, 'does not exist')
  if (!fs.existsSync('package.json')) oops('package.json does not exist in the current directory')
}

const logs = path.join('logs', m.groups!.key)
console.log(options.url, '=>', logs)
if (!fs.existsSync(logs)) {
  fs.mkdirSync(logs, { recursive: true })
}

async function getPrivateKey(): Promise<webcrypto.CryptoKey> {
  if (!options.encrypted) return undefined

  const privateKeyObject = crypto.createPrivateKey({
    key: fs.readFileSync(options.private, 'utf-8'),
    format: 'pem',
    passphrase: await getPassphrase(),
  })
  const unencryptedKeyPEM = privateKeyObject.export({
    type: 'pkcs8',
    format: 'pem',
  }).toString()
  return await jose.importPKCS8(
    unencryptedKeyPEM,
    KEY_WRAPPING_ALG,
  )
}
async function main() {
  try {
    const response = await fetch(options.url, {
      method: 'GET',
      headers: {
        'User-Agent': `Zotero plugin log fetcher ${pkg.version}`,
        Accept: '*/*',
      },
    })
    if (!response.ok) oops(`Failed to download: ${response.statusText}`)

    const readable = Readable.fromWeb(response.body as any)
    const download = fs.createWriteStream(options.zip)
    await finished(readable.pipe(download))

    const zipfile = new StreamZip.async({ file: options.zip })
    const entries = Object.values(await zipfile.entries()).filter(entry => !entry.isDirectory)

    const privateKey = await getPrivateKey()

    for (const entry of entries) {
      const m = entry.name.match(/(?<filename>.+)\.(?<type>jwe)$/i)
      const filename = m?.groups!.filename || entry.name
      const type = (m?.groups!.type || '').toLowerCase()
      const target = path.join('logs', filename)

      switch (type) {
        case '':
          if (options.encrypted) oops('Unexpected unencrypted contents', entry.name)

          fs.writeFileSync(target, await zipfile.entryData(entry.name))
          break
        case 'jwe': {
          if (!options.encrypted) oops('Unexpected encrypted contents', entry.name)
          const { plaintext } = await jose.compactDecrypt((await zipfile.entryData(entry.name)).toString('utf8'), privateKey)
          fs.writeFileSync(target, plaintext)
          break
        }
        default:
          oops('Unexpected log entry', entry.name)
          break
      }
    }
  }
  finally {
    if (!options.keep && fs.existsSync(options.zip)) fs.unlinkSync(options.zip)
  }
}

main().catch(err => {
  oops(err.message)
})
