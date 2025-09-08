import crypto from 'crypto'

export type Encrypted = {
  ciphertext: string
  iv: string
  tag: string
  salt: string
  iterations: number
  keyLength: number
  algorithm: 'aes-256-gcm'
}

export function encrypt(plaintext: string, passphrase: string): Encrypted {
  const salt = crypto.randomBytes(16)
  const iterations = 100000
  const keyLength = 32
  const algorithm = 'aes-256-gcm'

  const key = crypto.pbkdf2Sync(passphrase, salt, iterations, keyLength, 'sha256')
  const iv = crypto.randomBytes(12)

  const cipher = crypto.createCipheriv(algorithm, key, iv)

  let ciphertext = cipher.update(plaintext, 'utf8', 'base64')
  ciphertext += cipher.final('base64')

  const tag = cipher.getAuthTag()

  return {
    ciphertext,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    salt: salt.toString('base64'),
    iterations,
    keyLength,
    algorithm,
  }
}

export function decrypt({ ciphertext, iv, tag, salt, iterations, keyLength, algorithm }: Encrypted, passphrase: string): string {
  const key = crypto.pbkdf2Sync(passphrase, Buffer.from(salt, 'base64'), iterations, keyLength, 'sha256')
  const decipher = crypto.createDecipheriv(algorithm, key, Buffer.from(iv, 'base64'))
  decipher.setAuthTag(Buffer.from(tag, 'base64'))
  let decrypted = decipher.update(ciphertext, 'base64', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}
