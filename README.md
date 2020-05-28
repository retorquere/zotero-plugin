# zotero-plugin

Utility scripts for releasing zotero plugins on github. See also https://github.com/retorquere/generator-zotero-plugin/

zotero-plugin-release will release your plugin as a github release.
When it is ran on master, and it detects a tagged build on travis,
it will issue a new release. When it is ran on a branch named
`gh-<number>`, it will publish the plugin to a pre-release named
`builds`, and will announce the new build on issue number `<number>`
in your repo.

For this to work you must have a variable named `GITHUB_TOKEN` in
your travis environment with a githun token with `repo` rights. You
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
