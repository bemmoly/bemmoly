export const HELP = `Bemmoly runner: claims Bemmoly Pipelines jobs and runs their steps.

Usage
  bemmoly-runner [options]              Register (first time), then run jobs until stopped
  bemmoly-runner split <glob>...        Inside a sharded step: print this shard's test files
  bemmoly-runner --help                 Show this help
  bemmoly-runner --version              Show the runner's version

Options (each also reads the environment variable in brackets)
  --url <address>        Your Bemmoly address, for example https://bemmoly.example.com [BEMMOLY_URL]
  --pool-token <token>   The pool's registration token; needed only the first time [BEMMOLY_POOL_TOKEN]
  --name <name>          How this runner appears in Bemmoly (default: this machine's name) [BEMMOLY_RUNNER_NAME]
  --labels <a,b>         Comma-separated labels pipelines can ask for [BEMMOLY_RUNNER_LABELS]
  --local                Run steps as processes on this machine instead of containers [BEMMOLY_RUNNER_LOCAL]
  --workspace <dir>      With --local: run every job in this folder and skip the check out [BEMMOLY_RUNNER_WORKSPACE]
  --allow-build-path <dir>  A folder outside the job's workspace an image build may read; repeat for more [BEMMOLY_RUNNER_ALLOW_BUILD_PATHS]
  --data-dir <dir>       Where the registration, job folders and unsent logs live (default: ~/.bemmoly-runner) [BEMMOLY_RUNNER_DATA_DIR]
  --once                 Run one job, then exit, for one machine or pod per job [BEMMOLY_RUNNER_ONCE]
  --docker-socket <path> The Docker socket (default: DOCKER_HOST, then Colima's, then /var/run/docker.sock)
  --log-level <level>    fatal, error, warn, info, debug or trace (default: info) [LOG_LEVEL]

How it works
  The runner only makes outgoing requests. It long-polls for a job, heartbeats while it works,
  checks out the commit, and runs each step as a container with the workspace at /workspace.
  Logs go out in ordered chunks and wait on disk when Bemmoly cannot be reached, so a job never
  fails because the server was down.

  Press Ctrl+C once to stop taking jobs and let the running one finish; press it again to
  cancel the running job.
`;
