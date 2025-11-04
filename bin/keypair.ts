#!/usr/bin/env node

// This script generates an RSA key pair and encrypts the private key using GPG with a symmetric key.
// You must have the 'gpg' command-line tool installed on your system.
// (e.g., `brew install gpg` on macOS, `sudo apt-get install gnupg` on Debian/Ubuntu).

import { Command } from 'commander'
import { stat, writeFile } from 'fs/promises'
import { extname, resolve } from 'path'
import prompts from 'prompts'

import { KeyObject, webcrypto as crypto } from 'crypto'
import { CIPHER_ALGORITHM, RSA_ALGORITHM, RSA_HASH } from '../crypto'

import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ quiet: true, override: true })

const program = new Command()
program
  .description('A script to generate and store an RSA key pair in an encrypted file.')
  .option('-p, --public <path>', 'Path for the public key file', 'public.json')
  .option('--private <path>', 'Path for the encrypted private key .pem', 'private.pem')
  .option('-r, --replace', 'Replace existing files', false)
  .parse(process.argv)
const options = program.opts()

async function main() {
  try {
    const publicKeyPath = resolve(options.public)
    const encryptedKeyPath = resolve(options.private)

    if (!extname(publicKeyPath).match(/^\.(cjs|mjs|ts|json)$/)) {
      console.error('Public key file must have .json, .cjs, .mjs or .ts extension.')
      process.exit(1)
    }
    if (!encryptedKeyPath.endsWith('.pem')) {
      console.error('Encrypted key file must have a .pem extension.')
      process.exit(1)
    }

    const fileExists = async (path: string) => {
      try {
        await stat(path)
        return true
      }
      catch (e: any) {
        if (e.code === 'ENOENT') {
          return false
        }
        throw e
      }
    }

    if (await fileExists(publicKeyPath) && !options.replace) {
      console.error(`Will not overwrite existing public key file: ${publicKeyPath}`)
      process.exit(1)
    }
    if (await fileExists(encryptedKeyPath) && !options.replace) {
      console.error(`Will not overwrite existing encrypted key file: ${encryptedKeyPath}`)
      process.exit(1)
    }

    const { privateKey, publicKey } = await crypto.subtle.generateKey(
      {
        name: RSA_ALGORITHM,
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: RSA_HASH,
      },
      true, // extractable
      ['encrypt', 'decrypt'],
    )

    const publicKeyJwk = await crypto.subtle.exportKey('jwk', publicKey)
    switch (extname(options.public)) {
      case '.json':
        await writeFile(options.public, JSON.stringify(publicKeyJwk, null, 2))
        break
      case '.mjs':
        await writeFile(options.public, `export const jwk = ${JSON.stringify(publicKeyJwk, null, 2)}`)
        break
      case '.mjs':
        await writeFile(options.public, `module.exports.jwk = ${JSON.stringify(publicKeyJwk, null, 2)}`)
        break
      case '.ts':
        await writeFile(options.public, `export const jwk: JsonWebKey = ${JSON.stringify(publicKeyJwk, null, 2)}`)
        break
    }

    const { passphrase } = await prompts({
      type: 'password',
      name: 'passphrase',
      message: 'Enter a passphrase to encrypt your private key:',
    })

    const privateKeyObject = KeyObject.from(privateKey)
    const encryptedPkcs8Pem = privateKeyObject.export({
      format: 'pem',
      type: 'pkcs8',
      cipher: CIPHER_ALGORITHM,
      passphrase,
    })
    await writeFile(options.private, encryptedPkcs8Pem)
  }
  catch (error) {
    if (error instanceof Error) {
      console.error('An error occurred:', error.message)
    }
    else {
      console.error('An unknown error occurred:', error)
    }
    process.exit(1)
  }
}

main()
