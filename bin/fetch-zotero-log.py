#!/usr/bin/env python3

import sys, os
import urllib.request
from zipfile import ZipFile
from types import SimpleNamespace

from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.serialization import load_pem_private_key

def debuglog():
  local, host, remote = sys.argv[1].split('-')
  if host != '0x0':
    print('unexpected debug log host', host)
    sys.exit(1)

  encrypted = ('.') in remote
  remote = remote.split('.')[0]
  ext = '.enc' if encrypted else '.zip'
  url = f'https://0x0.com/{remote}{ext}'
  return SimpleNamespace(local=local, host=host, remote=remote, encrypted=encrypted, ext=ext, url=url)

def download():
  debuglog.downloaded = f'logs/{debuglog.local}{debuglog.ext}'
  print(debuglog.url, '=>', debuglog.downloaded)
  logs = os.path.dirname(log)
  if not os.path.exists(logs):
    os.makedirs(logs)
  urllib.request.urlretrieve(debuglog.url, debuglog.downloaded)

def decrypt():
  if not debuglog.encrypted:
    return

  encrypted = debuglog.downloaded
  debuglog.downloaded = f'logs/{debuglog.local}.zip'

  with open(sys.argv[2], 'rb') as f:
    private_key = load_pem_private_key(f.read(), password=None)
  with open(encrypted, 'rb') as f:
    encrypted_data = f.read()
  with open(debuglog.downloaded, 'wb') as f:
    f.write(private_key.decrypt(encrypted_data, padding.OAEP(mgf=padding.MGF1(algorithm=hashes.SHA256()), algorithm=hashes.SHA256(), label=None)))

def show():
  with ZipFile(debuglod.downloaded) as f:
    for name in f.namelist():
      if not '/' in name:
        print('Unexpected', name, 'in', sys.argv[1])
        sys.exit(1)
      print(name)
    f.extractall(path='logs')
  os.remove(debuglog.downloaded)
  print(debuglog.local)

debuglog = debuglog()
download()
decrypt()
show()
