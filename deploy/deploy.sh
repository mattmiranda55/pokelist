#!/usr/bin/env bash
set -euo pipefail

cd /mnt/ssd/stacks/pokelist
git fetch origin deploy
git reset --hard origin/deploy
