#!/usr/bin/env python3
"""
PostToolUse hook: runs `tsc --noEmit` after TypeScript file edits and injects
any type errors as a system message so the agent self-corrects immediately.

Only fires when:
  - The tool was a file-editing operation
  - The edited file ends in .ts or .tsx
  - The project is initialized (node_modules/.bin/tsc exists)

Non-blocking: exits 0 in all cases; uses systemMessage for feedback.
"""
import sys
import json
import os
import subprocess

try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)

tool_name: str = data.get("tool_name", "")
tool_input: dict = data.get("tool_input", {})

# Only trigger on file-editing tools
EDIT_TOOLS = ("edit", "replace", "create_file", "write_file")
if not any(kw in tool_name.lower() for kw in EDIT_TOOLS):
    sys.exit(0)

# Only TypeScript source files
filepath: str = tool_input.get("filePath", "") or tool_input.get("path", "")
if not filepath.endswith((".ts", ".tsx")):
    sys.exit(0)

# Only if project is initialized (avoids noise before `npm install`)
tsc_cmd = os.path.join("node_modules", ".bin", "tsc" + (".cmd" if os.name == "nt" else ""))
if not (os.path.exists("package.json") and os.path.exists(tsc_cmd)):
    sys.exit(0)

try:
    result = subprocess.run(
        ["npx", "tsc", "--noEmit", "--skipLibCheck"],
        capture_output=True,
        text=True,
        timeout=45,
        cwd=os.getcwd(),
    )
    if result.returncode != 0:
        errors = (result.stdout + result.stderr).strip()[:2000]
        print(json.dumps({
            "systemMessage": (
                f"TypeScript errors detected after editing "
                f"{os.path.basename(filepath)}. Fix these before proceeding:\n\n{errors}"
            )
        }))
except subprocess.TimeoutExpired:
    pass
except Exception:
    pass

sys.exit(0)
