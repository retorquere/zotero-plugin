#!/usr/bin/env python3

import sys, os
import urllib.request
from zipfile import ZipFile

local, fio, remote = sys.argv[1].split('-')
url = 'https://file.io/' + remote
log = 'logs/' + local + '.zip'
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
