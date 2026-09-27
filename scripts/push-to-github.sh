#!/usr/bin/env bash
#
# Push this repository to GitHub.
#
# Run from the repository root:  bash scripts/push-to-github.sh
#
# Why a script: the first push needs a GitHub Personal Access Token (classic or
# fine-grained with "Contents: read and write" + repository creation). Pass it
# via the environment so it never lands in shell history or in .git/config:
#
#   GH_TOKEN=<your_token> bash scripts/push-to-github.sh
#
# The token is injected into the push URL for that single command only; it is
# not written to the remote (the remote stays credential-free), so nothing
# persists on disk.

set -euo pipefail

OWNER="sanqianshuang"
REPO="sqs-dsh-better-input"
DESC="Better input experience for DeepSeek Harness: voice input with AI polishing, prompt optimization, and a local prompt template library"

if [ -n "${GH_TOKEN:-}" ]; then
  AUTH_ARGS=(-H "Authorization: Bearer ${GH_TOKEN}")
else
  AUTH_ARGS=()
fi

echo "==> Ensuring remote repository ${OWNER}/${REPO} exists"
if curl -fsS "${AUTH_ARGS[@]}" "https://api.github.com/repos/${OWNER}/${REPO}" >/dev/null 2>&1; then
  echo "    already exists — skipping creation"
else
  if [ -z "${GH_TOKEN:-}" ]; then
    echo "    not found, and GH_TOKEN is unset." >&2
    echo "    Set GH_TOKEN, or create the repo by hand at:" >&2
    echo "      https://github.com/new?name=${REPO}&visibility=public" >&2
    exit 1
  fi
  echo "    creating (public, MIT)"
  curl -fsS -X POST "${AUTH_ARGS[@]}" \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/user/repos" \
    -d "{\"name\":\"${REPO}\",\"description\":\"${DESC}\",\"private\":false,\"has_issues\":true,\"has_wiki\":false,\"has_projects\":false}" \
    >/dev/null
  echo "    created"
fi

echo "==> Configuring remote 'origin'"
if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "https://github.com/${OWNER}/${REPO}.git"
else
  git remote add origin "https://github.com/${OWNER}/${REPO}.git"
fi

echo "==> Pushing main"
if [ -n "${GH_TOKEN:-}" ]; then
  # Token used for this one command only; remote stays clean.
  git push "https://x-access-token:${GH_TOKEN}@github.com/${OWNER}/${REPO}.git" main:main
else
  # Falls back to your own credential helper / prompt.
  git push -u origin main
fi

echo
echo "Done: https://github.com/${OWNER}/${REPO}"
