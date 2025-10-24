#!/usr/bin/env node

// This script generates an RSA key pair and encrypts the private key using GPG with a symmetric key.
// You must have the 'gpg' command-line tool installed on your system.
// (e.g., `brew install gpg` on macOS, `sudo apt-get install gnupg` on Debian/Ubuntu).

import { Command } from 'commander'
import crypto from 'crypto'
import { stat, writeFile } from 'fs/promises'
import { resolve } from 'path'
import prompts from 'prompts'

import { encrypt } from './crypto'

import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ quiet: true, override: true })

const program = new Command()
program
  .description('A script to generate and store an RSA key pair in an encrypted file.')
  .option('-p, --public <path>', 'Path for the public key .pem file', 'public.pem')
  .option('--private <path>', 'Path for the encrypted private key .pem.json file', 'private.pem.json')
  .option('-r, --replace', 'Replace existing files', false)
  .parse(process.argv)
const options = program.opts()

async function main() {
  try {
    const publicKeyPath = resolve(options.public)
    const encryptedKeyPath = resolve(options.private)

    if (!publicKeyPath.endsWith('.pem')) {
      console.error('Public key file must have a .pem extension.')
      process.exit(1)
    }
    if (!encryptedKeyPath.endsWith('.pem.json')) {
      console.error('Encrypted key file must have a .pem.json extension.')
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

    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
      },
    })

    const { passphrase } = await prompts({
      type: 'password',
      name: 'passphrase',
      message: 'Enter a passphrase to encrypt your private key:',
    })

    if (!passphrase) {
      console.error('Passphrase is required for encryption.')
      process.exit(1)
    }

    await writeFile(encryptedKeyPath, JSON.stringify(encrypt(privateKey, passphrase), null, 2))
    console.log(`Encrypted private key saved to: ${encryptedKeyPath}`)

    await writeFile(publicKeyPath, publicKey)
    console.log(`Public key saved to: ${publicKeyPath}`)
  }
  catch (error) {
    throw error
    /*
    if (error instanceof Error) {
      console.error('An error occurred:', error.message)
    }
    else {
      console.error('An unknown error occurred:', error)
    }
    process.exit(1)
    */
  }
}

main()
