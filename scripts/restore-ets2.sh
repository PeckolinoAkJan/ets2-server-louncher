#!/usr/bin/env bash
set -euo pipefail
: "${ETS2_HOME:?}"
backup="${1:?Backup fehlt}"
[[ -f "$backup" ]] || { echo "Backup nicht gefunden" >&2; exit 1; }
case "$backup" in *.tar.gz) ;; *) echo "Ungültiges Backupformat" >&2; exit 1;; esac
if tar -tzf "$backup" | grep -Eq '(^|/)\.\.(/|$)|^/'; then
  echo "Unsicherer Backupinhalt" >&2
  exit 1
fi
mkdir -p "$ETS2_HOME"
tar -xzf "$backup" -C "$ETS2_HOME" --no-same-owner --no-same-permissions
echo "Backup wiederhergestellt."
