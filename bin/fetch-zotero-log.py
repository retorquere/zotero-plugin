#!/usr/bin/env python3

import sys, os
import urllib.request
from zipfile import ZipFile
from types import SimpleNamespace
from pathlib import Path

from Cryptodome.PublicKey import RSA
from Cryptodome.Cipher import PKCS1_OAEP

def oops(*args):
  print(*args)
  sys.exit(1)

def debuglog():
  if len(sys.argv) < 2:
    oops('No log ID')

  logid = Path(sys.argv[1])
  tags = logid.suffixes
  logid = str(logid).rstrip(''.join(tags))

  try:
    key, host, remote = logid.split('-')
  except ValueError:
    oops('Invalid log ID', sys.argv[1])

  if host != '0x0':
    oops('unexpected debug log host', host)

  encrypted = ('.enc' in tags)
  references = ('.refs' in tags)
  cypher_rsa = None
  if encrypted:
    if len(len(sys.argv) != 3):
      oops('no private key provided')
    if Path(sys.argv[2]).suffix != '.pem':
      oops('private key must be a .pem')

  url = f'https://0x0.com/{remote}.zip'
  SimpleNamespace(key=key, host=host, remote=remote, encrypted=encrypted, references=references, url=url),
debuglog = debuglog()

def download():
  debuglog.zip = f'logs/{debuglog.key}.zip'
  print(debuglog.url, '=>', debuglog.zip)
  logs = os.path.dirname(log)
  if not os.path.exists(logs):
    os.makedirs(logs)
  urllib.request.urlretrieve(debuglog.url, debuglog.zip)

def decrypt(encrypted, iv, target):
  encrypted = encrypted.read()
  iv = iv.read()

  # The last 16 bytes of the encrypted file are the authentication tag for GCM
  tag = encrypted[-16:]
  ciphertext = encrypted[:-16]

  cipher_aes = AES.new(symmetric_key, AES.MODE_GCM, nonce=iv)
  decrypted = cipher_aes.decrypt_and_verify(ciphertext, tag)
  with open(target, 'wb') as f:
    f.write(decrypted)

def unpack():
  symmetric_key = None

  with ZipFile(debuglog.zip) as zip:
    files = zip.namelist()

    symmetric_key = [f for f in files if Path(f).suffix == '.key']
    match len(private_key):
      case 0:
        if debuglog.encrypted:
          oops('No key found in', debuglog.key)

      case 1:
        with open(sys.argv[2], 'rb') as f:
          private_key = RSA.import_key(f.read())
          cipher_rsa = PKCS1_OAEP.new(private_key)
        with zip.open(symmetric_key[0]) as f:
          symmetric_key = cipher_rsa.decrypt(f.read())

      case _:
        oops('Multiple keys found in', debuglog.key)

    for name in files:
      match Path(name).suffix:
        case '.key' | '.iv'
          pass
        case '.enc'
          print(Path('logs') / name.with_suffix('.zip'), '(encrypted)')
          iv = next((f for f in filename_list if f == Path(name).with_suffix('.iv')), None)

          with zip.open(name) as f_data, open(iv) as f_iv:
            decrypt(f_data, f_iv, str(Path('logs') / name))

        case _:
          print(Path('logs') / name)
          f.extract(name, path='logs')

download()
decrypt()
