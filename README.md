# zotero-plugin

Utility scripts for releasing zotero plugins on github. See also https://github.com/retorquere/generator-zotero-plugin/

zotero-plugin-release will release your plugin as a github release.
When it is ran on master/main, and it detects a tagged build on travis,
it will issue a new release. When it is ran on a branch named
`gh-<number>`, it will publish the plugin to a pre-release named
`builds`, and will announce the new build on issue number `<number>`
in your repo.

For this to work you must have a variable named `GITHUB_TOKEN` in
your travis environment with a github token with `repo` rights. You
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

Release new versions by issuing `npm version <major|minor|patch>`.

# Allowing your user to send debug information

In your plugin, add `import { DebugLog } from 'zotero-plugin/debug-log'` to your startup file, then
after `Zotero.Schema.updateSchemaPromise` clears, call

```
DebugLog.register('your plugin name', ['extensions.zotero.<your plugin extension root>.'])
```

the array is a list of either full names of preferences you want to know about, or a name ending in `.` which means "all keys directly under this".

The Help menu will now have an entry "send debug log to file.io"; when your user selects that, the error log and the selected settings will be sent to file.io; if any items are selected, when that is clicked, a copy of those items will be included in RDF format.

The user will get an ID that looks like `C3WvhYgA8RDM-2XZGASLV`; the first part is the file.io ID, so you would go to `https://file.io/C3WvhYgA8RDM` to retrieve the download; the zipfile you get there will be `2XZGASLV.zip`.

# Starting Zotero with your plugin loaded

Note is is *much* adviced to create a separate Zotero profile for testing!

You will need to have python3 installed to use this.

Create a file called `zotero-plugin.ini` with the following contents:

```
[profile]
name = <your test profile name>
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

then when you execute `npm start`, zotero will start up with the latest build of your plugin installed.

**DO CREATE A BACKUP OF YOUR ZOTERO DATA *AND* YOUR ZOTERO PROFILE BEFORE USING THIS THE FIRST TIME**

`zotero-start` will **blindly** trust you've set it up right and will **alter data** in the profile
