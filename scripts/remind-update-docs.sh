#!/usr/bin/env bash
# PostToolUse hook: reminds Claude to update docs when key infrastructure files change.
# Reads the tool call JSON from stdin, checks if the edited file path matches
# docs-relevant patterns, and outputs a reminder if so.

set -euo pipefail

INPUT=$(cat)

FILE_PATH=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(d.get('tool_input', {}).get('file_path', ''))
except Exception:
    print('')
" <<< "$INPUT" 2>/dev/null || echo "")

if [[ -z "$FILE_PATH" ]]; then
    exit 0
fi

DOC_TRIGGERS=(
    "package.json"
    "app.config.js"
    "app.json"
    "eas.json"
    "scripts/"
    "src-tauri/src/lib.rs"
    "android/app/build.gradle"
    "ios/native/"
)

for trigger in "${DOC_TRIGGERS[@]}"; do
    if [[ "$FILE_PATH" == *"$trigger"* ]]; then
        echo "REMINDER: '$(basename "$FILE_PATH")' was modified. If this changes build commands, configuration, or architecture, update CLAUDE.md, AGENTS.md, and/or ROADMAP.md."
        exit 0
    fi
done

exit 0
