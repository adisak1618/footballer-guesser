#!/bin/bash
# Ralph Wiggum - Long-running AI agent loop
# Usage: ./ralph.sh [--tool amp|claude] [max_iterations]

# NOTE: removed `set -e` because the upstream script's `|| true` after the
# claude pipeline does NOT actually catch all error paths under `set -e`
# (subtle interaction between subshell-pipe-exit-code and assignment context).
# We handle errors explicitly per command instead. This was the root cause of
# "stuck on iteration 1" — the loop body's `echo "$OUTPUT" | grep -q ...` returns
# non-zero when grep doesn't match, and under `set -e` that propagated through
# the pipe-substitution into a script-level error.

# Parse arguments
TOOL="amp"  # Default to amp for backwards compatibility
MAX_ITERATIONS=10

while [[ $# -gt 0 ]]; do
  case $1 in
    --tool)
      TOOL="$2"
      shift 2
      ;;
    --tool=*)
      TOOL="${1#*=}"
      shift
      ;;
    *)
      # Assume it's max_iterations if it's a number
      if [[ "$1" =~ ^[0-9]+$ ]]; then
        MAX_ITERATIONS="$1"
      fi
      shift
      ;;
  esac
done

# Validate tool choice
if [[ "$TOOL" != "amp" && "$TOOL" != "claude" ]]; then
  echo "Error: Invalid tool '$TOOL'. Must be 'amp' or 'claude'."
  exit 1
fi
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PRD_FILE="$SCRIPT_DIR/prd.json"
PROGRESS_FILE="$SCRIPT_DIR/progress.txt"
ARCHIVE_DIR="$SCRIPT_DIR/archive"
LAST_BRANCH_FILE="$SCRIPT_DIR/.last-branch"

# Archive previous run if branch changed
if [ -f "$PRD_FILE" ] && [ -f "$LAST_BRANCH_FILE" ]; then
  CURRENT_BRANCH=$(jq -r '.branchName // empty' "$PRD_FILE" 2>/dev/null || echo "")
  LAST_BRANCH=$(cat "$LAST_BRANCH_FILE" 2>/dev/null || echo "")
  
  if [ -n "$CURRENT_BRANCH" ] && [ -n "$LAST_BRANCH" ] && [ "$CURRENT_BRANCH" != "$LAST_BRANCH" ]; then
    # Archive the previous run
    DATE=$(date +%Y-%m-%d)
    # Strip "ralph/" prefix from branch name for folder
    FOLDER_NAME=$(echo "$LAST_BRANCH" | sed 's|^ralph/||')
    ARCHIVE_FOLDER="$ARCHIVE_DIR/$DATE-$FOLDER_NAME"
    
    echo "Archiving previous run: $LAST_BRANCH"
    mkdir -p "$ARCHIVE_FOLDER"
    [ -f "$PRD_FILE" ] && cp "$PRD_FILE" "$ARCHIVE_FOLDER/"
    [ -f "$PROGRESS_FILE" ] && cp "$PROGRESS_FILE" "$ARCHIVE_FOLDER/"
    echo "   Archived to: $ARCHIVE_FOLDER"
    
    # Reset progress file for new run
    echo "# Ralph Progress Log" > "$PROGRESS_FILE"
    echo "Started: $(date)" >> "$PROGRESS_FILE"
    echo "---" >> "$PROGRESS_FILE"
  fi
fi

# Track current branch
if [ -f "$PRD_FILE" ]; then
  CURRENT_BRANCH=$(jq -r '.branchName // empty' "$PRD_FILE" 2>/dev/null || echo "")
  if [ -n "$CURRENT_BRANCH" ]; then
    echo "$CURRENT_BRANCH" > "$LAST_BRANCH_FILE"
  fi
fi

# Initialize progress file if it doesn't exist
if [ ! -f "$PROGRESS_FILE" ]; then
  echo "# Ralph Progress Log" > "$PROGRESS_FILE"
  echo "Started: $(date)" >> "$PROGRESS_FILE"
  echo "---" >> "$PROGRESS_FILE"
fi

echo "Starting Ralph - Tool: $TOOL - Max iterations: $MAX_ITERATIONS"

# Diagnostic log file — every iteration appends a line so we can audit cadence
# and spot early exits. View with: tail -f .ralph/run.log
RUN_LOG="$SCRIPT_DIR/run.log"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] LAUNCH max=$MAX_ITERATIONS tool=$TOOL pending=$(jq '[.userStories[] | select(.passes == false)] | length' "$PRD_FILE" 2>/dev/null || echo ?)" >> "$RUN_LOG"

for i in $(seq 1 $MAX_ITERATIONS); do
  echo ""
  echo "==============================================================="
  echo "  Ralph Iteration $i of $MAX_ITERATIONS ($TOOL)"
  echo "==============================================================="
  ITER_PENDING_BEFORE=$(jq '[.userStories[] | select(.passes == false)] | length' "$PRD_FILE" 2>/dev/null || echo ?)
  ITER_NEXT_BEFORE=$(jq -r '.userStories | map(select(.passes==false)) | .[0].id' "$PRD_FILE" 2>/dev/null || echo ?)
  echo "[$(date '+%H:%M:%S')] ITER $i START — pending=$ITER_PENDING_BEFORE next=$ITER_NEXT_BEFORE" >> "$RUN_LOG"
  ITER_START=$(date +%s)

  # Run the selected tool with the ralph prompt
  if [[ "$TOOL" == "amp" ]]; then
    OUTPUT=$(cat "$SCRIPT_DIR/prompt.md" | amp --dangerously-allow-all 2>&1 | tee /dev/stderr) || true
  else
    # Claude Code: use --dangerously-skip-permissions for autonomous operation, --print for output
    OUTPUT=$(claude --dangerously-skip-permissions --print < "$SCRIPT_DIR/CLAUDE.md" 2>&1 | tee /dev/stderr) || true
  fi
  CHILD_EXIT=$?
  ITER_DUR=$(( $(date +%s) - ITER_START ))
  ITER_PENDING_AFTER=$(jq '[.userStories[] | select(.passes == false)] | length' "$PRD_FILE" 2>/dev/null || echo ?)
  echo "[$(date '+%H:%M:%S')] ITER $i CHILD_EXIT=$CHILD_EXIT dur=${ITER_DUR}s pending_after=$ITER_PENDING_AFTER" >> "$RUN_LOG"

  # Check for completion signal — VERIFIED variant.
  # Upstream ralph.sh blindly greps for the sentinel substring, which
  # false-positives whenever the agent narrates the literal string
  # "<promise>COMPLETE</promise>" mid-iteration. We additionally verify
  # that prd.json has zero passes:false stories before honoring.
  if echo "$OUTPUT" | grep -q "<promise>COMPLETE</promise>"; then
    PENDING=$(jq '[.userStories[] | select(.passes == false)] | length' "$PRD_FILE" 2>/dev/null || echo 99)
    if [ "$PENDING" = "0" ]; then
      echo ""
      echo "Ralph completed all tasks!"
      echo "Completed at iteration $i of $MAX_ITERATIONS"
      echo "[$(date '+%H:%M:%S')] EXIT 0 — all stories pass" >> "$RUN_LOG"
      exit 0
    else
      echo ""
      echo "WARNING: agent emitted COMPLETE signal but $PENDING stories still have passes:false."
      echo "Treating as a false-positive and continuing the loop."
      NEXT=$(jq -r '.userStories | map(select(.passes==false)) | .[0].id' "$PRD_FILE" 2>/dev/null || echo "?")
      echo "Next pending: $NEXT"
      echo "[$(date '+%H:%M:%S')] FALSE-POSITIVE COMPLETE signal — continuing (next=$NEXT)" >> "$RUN_LOG"
    fi
  fi

  echo "Iteration $i complete. Continuing..."
  echo "[$(date '+%H:%M:%S')] ITER $i END — about to sleep 2 + loop" >> "$RUN_LOG"
  sleep 2
done

echo "[$(date '+%H:%M:%S')] LOOP EXHAUSTED — ran all $MAX_ITERATIONS iterations" >> "$RUN_LOG"

echo ""
echo "Ralph reached max iterations ($MAX_ITERATIONS) without completing all tasks."
echo "Check $PROGRESS_FILE for status."
exit 1
