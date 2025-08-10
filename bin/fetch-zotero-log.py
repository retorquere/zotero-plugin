#!/usr/bin/env python3

import sys, os
import urllib.request
from zipfile import ZipFile

from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.serialization import load_pem_private_key

local, host, remote = sys.argv[1].split('-')
assert host == '0x0', sys.argv[1]
url = f'https://0x0.com/{remote}.zip'
log = 'logs/' + local + '.zip'
print(url, '=>', log)
logs = os.path.dirname(log)
if not os.path.exists(logs):
  os.makedirs(logs)

urllib.request.urlretrieve(url, log)
with ZipFile(log) as f:
  for name in f.namelist():
    if not '/' in name: raise ValueError(name)
    print(name)
  f.extractall(path=logs)
os.remove(log)
print(log)
