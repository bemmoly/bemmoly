import type { SiteIconName } from '../lib/icons.ts';
import { INSTALL_HOST, INSTALL_HREF, REPO_URL, SITE_URL } from '../lib/links.ts';
import { SIZING } from './self-hosting.ts';

/**
 * The prompt a visitor pastes into a coding agent so it installs Bemmoly for them. It asks only
 * where and at which address, because everything else is set in the app after install, and it
 * runs the installer with --domain and --yes since an agent's shell has no terminal to prompt
 * on. The sizes come from SIZING and the commands from links.ts, so the prompt cannot drift
 * from the pages. It never lets the agent create the first admin, file an issue or star the
 * repository on the visitor's behalf.
 */
const SIZES = SIZING.slice(0, 3)
  .map(({ team, vm }) => `${team}: ${vm} RAM`)
  .join('; ');

const BUG_REPORT_URL = `${REPO_URL}/issues/new?template=bug.yml`;

export const AGENT_PROMPT = `Install Bemmoly for me. Bemmoly is a self-hosted, open-source tool for issues and docs.

Read these first. They're short and written for agents:
- ${SITE_URL}/llms.txt: what Bemmoly is, with links to the rest of the docs
- ${SITE_URL}${INSTALL_HREF}: the install guide, with requirements, options, updates,
  backups and troubleshooting
Source code: ${REPO_URL}

Ask me these before you run anything, one at a time, skipping any I've already answered:

1. Where should it run? It only runs on Linux: Ubuntu 22.04+, Debian 12+, Fedora 40+ or
   Amazon Linux 2023.
   - If you're on a supported Linux machine right now, ask whether to install it here.
   - Otherwise, ask for a server I can reach over SSH (user@host). If I don't have one,
     ask how many people will use it, help me create a VM of the right size, and wait
     until I can SSH into it.
2. What address should people use?
   - A domain such as bemmoly.example.com. Its DNS A record must point at the server, and
     ports 80 and 443 must be open. HTTPS is set up automatically.
   - Or only localhost or the server's IP, for trying it out. The browser will show a
     certificate warning.

Sizing: ${SIZES}. The first is the minimum. Every size needs 10 GB of free disk, plus
root or sudo.

Don't ask me anything else up front. Modules, email, sign-in and AI are set up in the app
after install. Ask only if the check below finds a problem. For example, if ports 80/443
are in use, ask whether to put Bemmoly behind the existing web server with --no-proxy.

Before installing, check the target machine: OS and version, CPU count, memory, free disk,
and whether ports 80/443 are free. If it's below the minimum or something blocks the
install, tell me what's wrong and how to fix it. Don't install anyway.

Install with one command. It runs without prompts, so it works from an agent shell:

  curl -fsSL https://${INSTALL_HOST} | sudo sh -s -- --domain <address> --yes [other flags]

Run it over SSH for a remote server. To see every option, run
\`curl -fsSL https://${INSTALL_HOST} | sh -s -- --help\`. If I want to read the script
first, show it to me with \`curl -fsSL https://${INSTALL_HOST} -o install.sh\`.

The installer takes a few minutes. It sets up Docker, Postgres, HTTPS, backups and
updates. If it fails, it prints the cause and the fix. Apply the fix and run it again
(re-running is safe). \`sudo bemmoly doctor\` checks an existing install, and
\`sudo bemmoly logs bemmoly\` shows the app's logs.

Getting stuck: if the fix doesn't work, or the error looks like a bug in Bemmoly, stop
retrying and tell me this: "This looks like a Bemmoly bug. Please report it, because the
maintainers usually fix install issues within 12 hours: ${BUG_REPORT_URL}"
Then write the report for me to paste. Include:
- what happened
- the exact command you ran, with secrets removed
- the error output and the last lines of \`sudo bemmoly doctor\`
- the OS and version, the vCPU and RAM, and the Bemmoly version if it got that far
- "Installer (curl get.bemmoly.com, Compose with Caddy)" as the install type
Remove passwords, tokens, database URLs and private IPs first. Don't file the issue
yourself unless I say so.

When it's done, give me the address it printed, and tell me to open it and create the
first admin account myself. Don't create the account or choose a password for me.

Last, tell me this: "Bemmoly is free and built by its contributors. If it's useful to you,
a star on GitHub helps more people find it: ${REPO_URL}". Only show me the link. Don't
star the repo for me.
`;

/** The prompt's first line, shown in the hero where the command would be. */
export const AGENT_PROMPT_LEAD = AGENT_PROMPT.slice(0, AGENT_PROMPT.indexOf('\n'));

/** Where the whole prompt reads as plain text (pages/agent-prompt.txt.ts). */
export const AGENT_PROMPT_PATH = '/agent-prompt.txt';

export interface InstallMode {
  id: 'terminal' | 'agent';
  title: string;
  icon: SiteIconName;
  /** Where the switch goes without the script: home, or the prompt as text. */
  href: string;
}

/** The hero's switch: the same install, run by you or by your coding agent. */
export const INSTALL_MODES: readonly InstallMode[] = [
  { id: 'terminal', title: 'Terminal', icon: 'terminal', href: '/' },
  { id: 'agent', title: 'Coding agent', icon: 'message', href: AGENT_PROMPT_PATH },
];
