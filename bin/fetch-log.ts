#!/usr/bin/env node

import { Command } from 'commander'
import crypto from 'crypto'
import fs from 'fs'
import fetch from 'node-fetch'
import StreamZip from 'node-stream-zip'
import path from 'path'

import { Entry as KeyRingEntry } from '@napi-rs/keyring'
import prompts from 'prompts'

import { decrypt } from './crypto'
import * as pkg from '../package.json';

async function getPassphrase(service, account): Promise<string> {
  const entry = new KeyRingEntry(service, account)
  let passphrase = entry.getPassword()
  if (!passphrase) {
    const response = await prompts({
      type: 'password',
      name: 'passphrase',
      message: 'Enter a passphrase to decrypt your private key for ${service} ${account}:',
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
  .description('A script to generate and store an RSA key pair in an encrypted file.')
  .option('-p, --private <path>', 'Path for the encrypted private key .pem.json file', 'private.pem.json')
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

async function main() {
  try {
    const response = await fetch(options.url, {
      method: 'GET',
      headers: {
        'User-Agent': `Zotero plugin log fetcher ${pkg.version}`,
        'Accept': '*/*',
      },
    })
    if (!response.ok) oops(`Failed to download: ${response.statusText}`)

    const download = fs.createWriteStream(options.zip)
    response.body.pipe(download)
    await new Promise<void>((resolve, reject) => {
      download.on('finish', () => resolve())
      download.on('error', err => reject(err))
    })

    let privateKey
    if (options.encrypted) {
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'))
      const passphrase = await getPassphrase(`${pkg.name} Zotero plugin`, 'debug-log')
      privateKey = decrypt(JSON.parse(fs.readFileSync(options.private, 'utf-8')), passphrase)
    }

    const zipfile = new StreamZip.async({ file: options.zip })
    let decryptionKey: Buffer
    const fileEntries: Record<string, { filename: string, contents?: string; iv?: string, encrypted?: boolean }> = {}
    for (const entry of Object.values(await zipfile.entries())) {
      if (entry.isDirectory) continue

      const m = entry.name.match(/(?<filename>.+)\.(?<type>key|enc|iv)$/i)
      let filename = (m?.groups!.filename || entry.name)
      const type = (m?.groups!.ext || '').toLowerCase()

      if (type && !options.encrypted) oops('unexpected', type, 'file in non-encrypted log')

      if (type === 'key') {
        decryptionKey = crypto.privateDecrypt({
          key: privateKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256',
        }, await zipfile.entryData(entry.name))
      }
      else {
        const key = filename.toLowerCase()
        const f = fileEntries[key] = fileEntries[key] || { filename }
        f[type === 'iv' ? 'iv' : 'contents'] = entry.name
        if (type) f.encrypted = true
      }
    }

    if (options.encrypted && !decryptionKey) oops('no key file found')

    for (const entry of Object.values(fileEntries)) {
      if (!entry.contents) oops('no contents for', entry.filename)
      if (entry.encrypted && !entry.iv) oops('no iv for', entry.filename)

      const data = await zipfile.entryData(entry.contents)
      const target = path.join('logs', entry.filename)

      if (entry.iv) {
        const iv = await zipfile.entryData(entry.iv)
        const tag = data.slice(-16)
        const ciphertext = data.slice(0, -16)
        const decipher = crypto.createDecipheriv('aes-256-gcm', decryptionKey, iv)
        decipher.setAuthTag(tag)
        const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
        fs.writeFileSync(target, decrypted)
      }
      else {
        fs.writeFileSync(target, data)
      }
    }
  }
  finally {
    if (fs.existsSync(options.zip)) fs.unlinkSync(options.zip)
  }
}

main().catch(err => {
  oops(err.message)
})
