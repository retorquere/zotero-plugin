# zotero-plugin

Utility scripts for releasing zotero plugins on github. See also https://github.com/retorquere/generator-zotero-plugin/

zotero-plugin-release will release your plugin as a github release.
When it is ran on master/main, and it detects a tagged build in a Github Action,
it will issue a new release. When it is ran on a branch named
`gh-<number>`, it will publish the plugin to a pre-release named
`builds`, and will announce the new build on issue number `<number>`
in your repo.

For this to work you must have a variable named `GITHUB_TOKEN` in
your GH Actions environment with a github token with `repo` rights. You
are allowed one bot account by github; I use this to do the
announcements, but you can use one from your own account if you
want.

The release script will create two releases if they don't exist;
`builds` for temporary builds, mostly for debugging, and `release`
for the update.rdf, which needs to be at a stable URL for plugin
updates to work.

If you're doing a push on a branch named `gh-<number>` but you do
not want the build to be announced, include `#norelease` in the
commit message. If you want to announce on other issues in addition
to the current branch (or maybe your branch isn't named `gh-<number>`,
add `#<number>` to the commit message.

## Releasing a new version

Add the folowing to your `scripts` section in `package.json`:

```
"postversion": "git push --follow-tags",
```

and install this github actions workflow

```
name: release

on:
  push:

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v2
    - name: install node
      uses: actions/setup-node@v1
      with:
        node-version: 14.x
    - name: Cache node dependencies
      uses: actions/cache@v2
      env:
        cache-name: cache-dependencies
      with:
        path: |
          ~/.npm
        key: ${{ runner.os }}-build-${{ env.cache-name }}-${{ hashFiles('package-lock.json') }}
    - name: install node dependencies
      run: npm install
    - name: build
      run: npm run build
    - name: release
      run: npm run release
      env:
        GITHUB_TOKEN: ${{ github.token }}
```

You can now release new versions by issuing `npm version <major|minor|patch>`.

# Allowing your user to send debug information

In your plugin, add `import { DebugLog } from 'zotero-plugin/debug-log'` to your startup file, then
after `Zotero.Schema.updateSchemaPromise` clears, call

```
DebugLog.register('your plugin name', ['extensions.zotero.<your plugin extension root>.'])
```

the array is a list of either full names of preferences you want to know about, or a name ending in `.` which means "all keys directly under this".

The Help menu will now have an entry "send debug log to bashupload.com"; when your user selects that, the error log and the selected settings will be sent to bashupload.com; if any items are selected, when that is clicked, a copy of those items will be included in RDF format.

The user will get an ID that looks like `C3WvhYgA8RDM-buc-2XZGa`; the last part is the bashupload ID, so you would go to `https://bashupload.com/2XZGa/C3WvhYgA8RDM.zip` to retrieve the download; the zipfile you get there will be `C3WvhYgA8RDM.zip`.

# Starting Zotero with your plugin loaded

Note it is *much* adviced to create a separate Zotero profile for testing!

You will need to have python3 installed to use this.

Create a file called `zotero-plugin.ini` with the following contents:

```
[profile]
name = <your test profile name> # optional. when not present, the profile picker will popup, where you can select the test profile
path = <your test profile absolute path>

[zotero]
path = <explicit path to zotero binary> # optional
log = <file name to write log output to> # optional
db = <path to zotero.sqlite you want to populate the profile with> # optional

[plugin]
source = <plugin source directory> # optional
build = <command to build your plugin, or false if no build is needed> # optional

[preferences]
extensions.zotero.<your extension>.<some setting> = <value>
extensions.zotero.<your extension>.<some other setting> = <value>
```

and add this script to your package.json:

```
  "start": "zotero-start"
```

then when you execute `npm start`, zotero will start up with the latest build of your plugin installed, and the given preferences set.

**DO CREATE A BACKUP OF YOUR ZOTERO DATA *AND* YOUR ZOTERO PROFILE BEFORE USING THIS THE FIRST TIME**

`zotero-start` will **blindly** trust you've set it up right and will **alter data** in the profile

# Getting logging from your users

In your startup, you can call

```
import { DebugLog } from 'zotero-plugin/debug-log'
DebugLog.register('<your plugin name>', ['your-plugin.', 'fileHandler.pdf'])
```

and you will get an entry in the Help menu that will allow your users to upload their debug log for diagnosis. You can fetch the log by
running

```
zp-fetch-log <the ID that the user was presented with>
```

If you want to be extra secure, you can encrypt the logs before they are sent; first, run

```
zp-keypair
```

which will generate a keypair. Remember the passphrase, it cannot be recovered, but if you do forget, you can generate a new keypair. Logs
sent with the old keypair cannot be decrypted, so if you forget your passphrase, you will have to put out a new release of your plugin.

add this to your esbuild script:

```
const { pem } = require('zotero-plugin/esbuild')
```

and add `pem` to your plugins in the esbuild config:

```
...
plugins: [pem],
...
```

and in your code, register using

```
DebugLog.register('<your plugin name>', ['your-plugin.', 'fileHandler.pdf'], require('./public.pem'))
```

Logs are sent to/retrieved from 0x0.st

The preferences you list will be included in the log; if a preference ends with a period (`.`), all preferences under it will be included
