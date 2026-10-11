#!/bin/sh
# Test du hook pre-push : sh scripts/git-hooks/pre-push.test.sh
H="$(dirname "$0")/pre-push"; Z=0000000000000000000000000000000000000000; ok=0
echo "refs/heads/x $Z refs/heads/claude/file-context-analysis-ixq8w3 $Z" | sh "$H" 2>/dev/null && { echo "ECHEC : push prod accepté"; ok=1; }
echo "refs/heads/x $Z refs/heads/feat/autre $Z" | sh "$H" || { echo "ECHEC : push hors prod refusé"; ok=1; }
printf '' | sh "$H" || { echo "ECHEC : push vide refusé"; ok=1; }
[ $ok -eq 0 ] && echo "OK : 3/3"; exit $ok
