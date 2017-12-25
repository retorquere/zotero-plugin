#!/bin/bash

set -e

TAG=$(echo $(git describe --tags $(git rev-list --tags --max-count=1)))
git tag -a $TAG $TAG -f -m "$(git log `git describe --tags --abbrev=0 HEAD^`..HEAD --oneline)"
git push && git push --tags
