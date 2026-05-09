#!/bin/bash
# Ralph health check — paste-and-go diagnostic for "is Ralph still working or stuck?"
# Usage: ./.ralph/status.sh

set +e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PRD_FILE="$SCRIPT_DIR/prd.json"
RUN_LOG="$SCRIPT_DIR/run.log"

echo "════════════════════════════════════════════════════════════════"
echo "  RALPH HEALTH CHECK — $(date '+%Y-%m-%d %H:%M:%S')"
echo "════════════════════════════════════════════════════════════════"

# ── PROGRESS ────────────────────────────────────────────────────
DONE=$(jq '[.userStories[] | select(.passes == true)] | length' "$PRD_FILE" 2>/dev/null || echo ?)
TOTAL=$(jq '.userStories | length' "$PRD_FILE" 2>/dev/null || echo ?)
NEXT=$(jq -r '.userStories | map(select(.passes==false)) | .[0].id // "ALL DONE"' "$PRD_FILE" 2>/dev/null)
NEXT_TITLE=$(jq -r '.userStories | map(select(.passes==false)) | .[0].title // ""' "$PRD_FILE" 2>/dev/null)
echo "PROGRESS:  $DONE / $TOTAL stories done"
echo "NEXT:      $NEXT  $NEXT_TITLE"

# ── PROCESS HEALTH ──────────────────────────────────────────────
echo ""
echo "PROCESSES:"
RALPH_PIDS=$(pgrep -f "ralph\.sh --tool" 2>/dev/null | tr '\n' ' ')
# Match claude with --print flag anywhere in args. cmux injects --session-id and
# --settings between "claude" and "--print", so a literal "claude --print" substring
# match misses the real process. Use regex instead.
CLAUDE_PIDS=$(pgrep -f "claude.*--print" 2>/dev/null | tr '\n' ' ')
DEV_PIDS=$(pgrep -f "next dev|next-server|turbo run dev" 2>/dev/null | tr '\n' ' ')

if [ -n "$RALPH_PIDS" ]; then
  echo "  ✓ ralph.sh alive (pids: $RALPH_PIDS)"
else
  echo "  ✗ ralph.sh NOT running"
fi

if [ -n "$CLAUDE_PIDS" ]; then
  for pid in $CLAUDE_PIDS; do
    ETIME=$(ps -o etime= -p "$pid" 2>/dev/null | tr -d ' ')
    CTIME=$(ps -o time= -p "$pid" 2>/dev/null | tr -d ' ')
    CPU=$(ps -o %cpu= -p "$pid" 2>/dev/null | tr -d ' ')
    echo "  ✓ claude --print alive (pid: $pid, elapsed: $ETIME, cpu_time: $CTIME, %CPU: $CPU)"
  done
else
  if [ -n "$RALPH_PIDS" ]; then
    echo "  ⚠ claude --print NOT running but ralph.sh IS — between iterations or stuck"
  else
    echo "  · claude --print not running (loop ended or not started)"
  fi
fi

if [ -n "$DEV_PIDS" ]; then
  # Distinguish "actively used" vs "leaked":
  #   - dev servers + agent alive    = actively used (agent running e2e/qa) — fine
  #   - dev servers + no agent       = leaked from a previous iteration — would block next
  if [ -n "$CLAUDE_PIDS" ]; then
    echo "  · dev servers running (pids: $DEV_PIDS) — likely in use by current GATE/UI iteration"
  else
    echo "  ⚠ leaked dev servers detected (pids: $DEV_PIDS) — would block next claude exit"
    echo "    fix: pkill -f 'next dev'; pkill -f 'next-server'; pkill -f 'turbo run dev'"
  fi
fi

# ── RUN LOG (most recent activity) ──────────────────────────────
echo ""
echo "RUN LOG (last 5 lines):"
if [ -f "$RUN_LOG" ]; then
  tail -5 "$RUN_LOG" | sed 's/^/  /'
  LAST_LOG_AGE=$(( $(date +%s) - $(stat -f %m "$RUN_LOG" 2>/dev/null || stat -c %Y "$RUN_LOG" 2>/dev/null) ))
  echo ""
  echo "  Last log line: ${LAST_LOG_AGE}s ago"
else
  echo "  (no run.log yet)"
fi

# ── GIT ACTIVITY ────────────────────────────────────────────────
echo ""
echo "GIT (last 3 commits):"
git -C "$(dirname "$SCRIPT_DIR")" log --oneline -3 2>/dev/null | sed 's/^/  /'
LAST_COMMIT_AGE=$(git -C "$(dirname "$SCRIPT_DIR")" log -1 --format=%cr 2>/dev/null)
echo "  Last commit: $LAST_COMMIT_AGE"

# ── VERDICT ─────────────────────────────────────────────────────
echo ""
echo "VERDICT:"
if [ -z "$RALPH_PIDS" ] && [ "$DONE" = "$TOTAL" ]; then
  echo "  ✓ ALL DONE — every story passes"
elif [ -z "$RALPH_PIDS" ] && [ -n "$DEV_PIDS" ]; then
  echo "  ⚠ Ralph not running but dev servers leaked from a previous run."
  echo "    Clean up before re-launching:"
  echo "      pkill -f 'next dev'; pkill -f 'next-server'; pkill -f 'turbo run dev'"
elif [ -z "$RALPH_PIDS" ]; then
  echo "  · Ralph not running. $((TOTAL - DONE)) stories remain. Re-launch with:"
  echo "      ./.ralph/ralph.sh --tool claude 30"
elif [ -n "$CLAUDE_PIDS" ]; then
  if [ "${CPU:-0}" != "0" ] && [ -n "$CPU" ]; then
    if [ -n "$DEV_PIDS" ]; then
      echo "  ✓ HEALTHY — agent is actively working a UI/GATE story (CPU=$CPU%, dev servers in use)"
    else
      echo "  ✓ HEALTHY — agent is actively working (CPU=$CPU%)"
    fi
  else
    if [ -n "$DEV_PIDS" ]; then
      echo "  · agent alive at low CPU — likely in test/qa phase using dev servers (CPU=$CPU%)"
      echo "    Test/QA suites can take 20-40 min for GATE stories. Be patient."
    else
      echo "  ⚠ POSSIBLY STUCK — agent alive but %CPU=$CPU and no dev servers."
      echo "    If elapsed time >30min, watchdog will eventually fire."
    fi
  fi
elif [ -n "$DEV_PIDS" ]; then
  echo "  ✗ STUCK — dev servers leaked AND no agent process. Watchdog may eventually fire."
  echo "      Kill manually to recover faster: pkill -f 'next dev'; pkill -f 'next-server'"
else
  echo "  ⚠ ralph.sh alive without claude --print child — between iterations,"
  echo "    or the bash loop hung after a child exit. Wait 10s and re-check."
fi

echo "════════════════════════════════════════════════════════════════"
