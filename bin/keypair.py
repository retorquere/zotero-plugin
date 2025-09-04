#!/usr/bin/env python3

from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
import sys, os, subprocess
from pathlib import Path
import argparse
import json
from pykeepass import PyKeePass, Entry, create_database
from types import SimpleNamespace

from dotenv import load_dotenv
load_dotenv(override=True)

cwd = os.getcwd()
pkg = None
while True:
  pkg = os.path.join(cwd, 'package.json')
  if os.path.exists(pkg):
    with open(pkg) as f:
      pkg = json.load(f, object_hook=lambda d: SimpleNamespace(**d))
    break

  parent = os.path.dirname(cwd)
  if parent == cwd:
    pkg = SimpleNamespace(name='plugin')
    break
  cwd = parent

parser = argparse.ArgumentParser(description='A script to generate and store an RSA key pair in a KeePass database.')
parser.add_argument('-p', '--public', default=f'{pkg.name}.pem', help='public key file')
parser.add_argument('-k', '--kdbx', help='key store file')
parser.add_argument('-g', '--group', help='slash-delimited group path')
parser.add_argument('-e', '--entry', default=pkg.name, help='entry name')
parser.add_argument('-r', '--replace', action='store_true', help='replace existing files')
args = parser.parse_args()

if not args.kdbx:
  args.kdbx = str(Path(args.public).with_suffix('.kdbx'))
if not args.public.endswith('.pem'):
  print('public key file must have .pem extension', file=sys.stderr)
  sys.exit(1)
if not args.kdbx.endswith('.kdbx'):
  print('key store file must have .kdbx extension', file=sys.stderr)
  sys.exit(1)

if os.path.exists(args.public) and not args.replace:
  print('will not overwrite', args.public)
  sys.exit(1)

entry_name = args.kdbx + '::'
if args.group: entry_name += '/' + args.group
entry_name += '/' + args.entry

private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
private_pem = private_key.private_bytes(
  encoding=serialization.Encoding.PEM,
  format=serialization.PrivateFormat.PKCS8,
  encryption_algorithm=serialization.NoEncryption()
).decode('utf-8')
public_key = private_key.public_key()
public_pem = public_key.public_bytes(
  encoding=serialization.Encoding.PEM,
  format=serialization.PublicFormat.SubjectPublicKeyInfo
).decode('utf-8')

if not os.path.exists(args.kdbx):
  kp = create_database(args.kdbx, password=os.environ['KDBXPWD'])
  kp.save()
kp = PyKeePass(args.kdbx, password=os.environ['KDBXPWD'])
if args.group:
  group = kp.find_groups(path=args.group, first=True)
else:
  group = kp.root_group

entries = [entry for entry in group.entries if entry.title == args.entry]
if len(entries) == 0:
  kp.add_entry(group, title=args.entry, username=pkg.name, password=private_pem)
elif args.replace:
  entries[0].password = private_pem
else:
  print('will not overwrite', entry_name)
  sys.exit(1)

print('creating private key', entry_name)
kp.save()

with open(args.public, 'w') as f:
  print('creating public key', args.public)
  f.write(public_pem)
