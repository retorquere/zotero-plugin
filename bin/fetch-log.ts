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

type FetchLogOptions = {
  private: string
  keep: boolean
  encrypted: boolean
  zip: string
  url: string
}

type LogIdGroups = {
  host: string
  key: string
  tags: string
}

async function getPassphrase(): Promise<string> {
  const service = `${pkg.name} Zotero plugin`
  const account = `${pkg.name}-debug-log`
  const entry = new KeyRingEntry(service, account)
  const storedPassphrase = entry.getPassword()
  if (storedPassphrase) return storedPassphrase

  const response = await prompts({
    type: 'password',
    name: 'passphrase',
    message: `Enter a passphrase to decrypt your private key for ${service} ${account}:`,
  }) as { passphrase?: string }
  const providedPassphrase = response.passphrase || oops('No passphrase entered')

  entry.setPassword(providedPassphrase)
  return providedPassphrase
}

const oops = (...args: unknown[]): never => {
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
const args = program.args as string[]

if (!args.length) oops('No log ID')

const m = args[0].match(/^(?<key>[a-z0-9]+)-(?<host>[^.-]+)(?<tags>([.][^.]+)*)$/i)
const groups = m?.groups as Partial<LogIdGroups> | undefined
if (!groups?.host || !groups.key || typeof groups.tags !== 'string') oops(args[0], 'is not a valid log ID')

const { host, key, tags } = groups as LogIdGroups
if (host !== 'fbin') oops('Unexpected debug log host', host)

const options: FetchLogOptions = {
  ...(program.opts() as Pick<FetchLogOptions, 'private' | 'keep'>),
  encrypted: tags.split('.').includes('enc'),
  zip: path.join('logs', `${key}.zip`),
  url: `https://filebin.net/${key}/${key}.zip`,
}

if (options.encrypted) {
  if (!options.private) oops('No private key provided')
  if (!fs.existsSync(options.private)) oops('Private key', options.private, 'does not exist')
  if (!fs.existsSync('package.json')) oops('package.json does not exist in the current directory')
}

const logs = path.join('logs', key)
console.log(options.url, '=>', logs)
if (!fs.existsSync(logs)) {
  fs.mkdirSync(logs, { recursive: true })
}

async function getPrivateKey(): Promise<webcrypto.CryptoKey | undefined> {
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
        'User-Agent': 'curl/7.81.0', // filebin does not seem to accept custom user agents
        'Accept-Encoding': 'identity',
        Accept: '*/*',
      },
    })
    if (!response.ok) oops(`Failed to download: ${response.statusText}`)

    const download = fs.createWriteStream(options.zip)
    await finished(Readable.fromWeb(response.body as any).pipe(download))

    const zipfile = new StreamZip.async({ file: options.zip })
    const entries = Object.values(await zipfile.entries()).filter(entry => !entry.isDirectory)

    const privateKey = await getPrivateKey()

    for (const entry of entries) {
      const m = entry.name.match(/(?<filename>.+)\.(?<type>jwe)$/i)
      const filename = m?.groups!.filename || entry.name
      const type = (m?.groups!.type || '').toLowerCase()
      const target = path.join('logs', filename)

      if (options.encrypted && !type) oops('Unexpected unencrypted contents', entry.name)
      if (type && !options.encrypted) oops('Unexpected encrypted contents', entry.name)
      switch (type) {
        case '':
          fs.writeFileSync(target, await zipfile.entryData(entry.name))
          break
        case 'jwe': {
          if (!privateKey) oops('Missing private key for encrypted log entry', entry.name)
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
