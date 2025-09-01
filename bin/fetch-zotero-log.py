#!/usr/bin/env python3

import sys, os
import urllib.request
from zipfile import ZipFile
from types import SimpleNamespace
from pathlib import Path

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
    if len(sys.argv) != 3:
      oops('no private key provided')
    if Path(sys.argv[2]).suffix != '.pem':
      oops('private key must be a .pem')

  url = f'https://0x0.st/{remote}.zip'
  return SimpleNamespace(key=key, host=host, remote=remote, encrypted=encrypted, references=references, url=url)
debuglog = debuglog()

if debuglog.encrypted:
  from cryptography.hazmat.primitives.asymmetric import padding
  from cryptography.hazmat.primitives import hashes
  from cryptography.hazmat.primitives.serialization import load_pem_private_key
  from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
  from cryptography.hazmat.backends import default_backend

def download():
  debuglog.zip = f'logs/{debuglog.key}.zip'
  logs = os.path.dirname(debuglog.zip)
  if not os.path.exists(logs):
    os.makedirs(logs)
  print(debuglog.url, '=>', debuglog.zip)
  urllib.request.urlretrieve(debuglog.url, debuglog.zip)

def decrypt(symmetric_key, encrypted, iv, target):
  encrypted = encrypted.read()
  iv = iv.read()

  # The last 16 bytes of the encrypted file are the authentication tag for GCM
  tag = encrypted[-16:]
  ciphertext = encrypted[:-16]

  cipher = Cipher(algorithms.AES(symmetric_key), modes.GCM(iv, tag), backend=default_backend())
  decryptor = cipher.decryptor()

  with open(target, 'wb') as f:
    f.write(decryptor.update(ciphertext) + decryptor.finalize())

def unpack():
  symmetric_key = None

  with ZipFile(debuglog.zip) as zip:
    files = zip.namelist()

    symmetric_key = [f for f in files if Path(f).suffix == '.key']
    match len(symmetric_key):
      case 0:
        if debuglog.encrypted:
          oops('No key found in', debuglog.key)

      case 1:
        with open(sys.argv[2], 'rb') as f:
          private_key = load_pem_private_key(f.read(), password=None, backend=default_backend())
        with zip.open(symmetric_key[0]) as f:
          symmetric_key = private_key.decrypt(f.read(), padding.OAEP(
            mgf=padding.MGF1(algorithm=hashes.SHA256()),
            algorithm=hashes.SHA256(),
            label=None
          ))

      case _:
        oops('Multiple keys found in', debuglog.key)

    for name in files:
      match Path(name).suffix:
        case '.key' | '.iv':
          pass
        case '.enc':
          print(Path('logs') / Path(name).with_suffix('.zip'), '(encrypted)')
          iv = next((f for f in files if f == Path(name).with_suffix('.iv')), None)
          print(name, iv, files)

          with zip.open(name) as f_data, zip.open(iv) as f_iv:
            decrypt(symmetric_key, f_data, f_iv, str(Path('logs') / name))

        case _:
          print(Path('logs') / name)
          zip.extract(name, path='logs')

download()
unpack()
