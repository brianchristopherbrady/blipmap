#!/usr/bin/env python3
"""
PreToolUse hook: flags destructive terminal commands for user confirmation.

Reads the Copilot hook JSON payload from stdin.
Outputs a JSON permission decision to stdout.
Exit 0 in all cases (non-blocking guard — only escalates to 'ask').
"""
import sys
import json
import re

try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)

tool_name: str = data.get("tool_name", "")
tool_input: dict = data.get("tool_input", {})
command: str = tool_input.get("command", "")

# Only inspect tools that execute shell commands
if not re.search(r"terminal|execute", tool_name, re.IGNORECASE):
    sys.exit(0)

DESTRUCTIVE_PATTERNS = [
    r"rm\s+-[rf]{1,2}\s+/",          # rm -rf /
    r"rm\s+-rf\b",                    # rm -rf anything
    r"git\s+push\s+--force",
    r"git\s+push\s+-f\b",
    r"git\s+reset\s+--hard",
    r"git\s+clean\s+-[fd]+",
    r"\bDROP\s+TABLE\b",
    r"\bDROP\s+DATABASE\b",
    r"format\s+c:",
    r"rd\s+/s\s+/q",                  # Windows recursive delete
    r"Remove-Item.*-Recurse.*-Force",  # PowerShell recursive delete
]

for pattern in DESTRUCTIVE_PATTERNS:
    if re.search(pattern, command, re.IGNORECASE):
        print(json.dumps({
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "ask",
                "permissionDecisionReason": (
                    f"Potentially destructive command detected. "
                    f"Please confirm this is intentional before proceeding."
                )
            }
        }))
        sys.exit(0)

sys.exit(0)
