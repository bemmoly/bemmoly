# The Bemmoly step agent: runs the steps a runner in the same pod hands this container.
#
#   sh step-agent.sh <inbox> <logs>
#
# For each step the runner writes <id>.sh (what to run), <id>.env (its environment, as export
# lines), <id>.cwd (the workspace) into <inbox>, then <id>.go. The agent runs the script in
# the workspace with output in <logs>/<id>.out, and writes the exit code to <logs>/<id>.exit
# when it ends. An <id>.cancel file stops it. POSIX sh only, as step images vary: Alpine's
# BusyBox, Debian's dash, Kaniko's /busybox/sh.

inbox="$1"
logs="$2"
mkdir -p "$inbox" "$logs" || exit 1
# The pod stops this container when the runner exits; leave at once rather than wait for KILL.
trap 'exit 0' TERM INT

run_step() {
  id="$1"
  (
    (
      cd "$(cat "$inbox/$id.cwd")" || exit 127
      . "$inbox/$id.env"
      exec sh "$inbox/$id.sh"
    ) >"$logs/$id.out" 2>&1 &
    echo "$!" >"$inbox/$id.pid"
    wait "$!"
    code=$?
    # The environment holds the job's secrets; it goes as soon as the step ends.
    rm -f "$inbox/$id.env" "$inbox/$id.sh" "$inbox/$id.cwd" "$inbox/$id.pid" "$inbox/$id.cancel"
    echo "$code" >"$logs/$id.exit.tmp" && mv "$logs/$id.exit.tmp" "$logs/$id.exit"
  ) &
  while [ ! -e "$logs/$id.exit" ]; do
    if [ -e "$inbox/$id.cancel" ] && [ -s "$inbox/$id.pid" ]; then
      rm -f "$inbox/$id.cancel"
      pid=$(cat "$inbox/$id.pid")
      kill -TERM "$pid" 2>/dev/null
      (sleep 10 && kill -KILL "$pid" 2>/dev/null) &
    fi
    sleep 1
  done
}

while :; do
  for go in "$inbox"/*.go; do
    [ -e "$go" ] || continue
    id=$(basename "$go" .go)
    rm -f "$go"
    run_step "$id"
  done
  sleep 1
done
