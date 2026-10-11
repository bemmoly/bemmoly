/**
 * The homepage's questions, the doubts every visitor of a free, self-hosted product has. The
 * same list is the page's FAQPage data (Base.astro), so search engines read the words the page
 * shows. Answers are plain text, true of the release the installer pulls today.
 */
import type { FaqItem } from '../lib/structured-data.ts';

export const HOME_FAQ: readonly FaqItem[] = [
  {
    question: 'How is it free?',
    answer:
      'Bemmoly is software you run, not a service we run for you, so there is nothing for us to meter or charge for. It is MIT licensed: you may use, change and share it, at work, for any number of people. Your only cost is the server; a 2 vCPU, 4 GB VM lists at roughly $5–25 a month. Sponsoring the project on Buy Me a Coffee is optional: it supports development and unlocks nothing, because every feature is in the free product.',
  },
  {
    question: 'What’s the catch?',
    answer:
      'You run it. HTTPS, backups and updates are built in, but the machine is yours to keep alive, and help comes from GitHub issues rather than a support contract. Work, Docs, optional AI, imports, single sign-on, webhooks and automation, a roadmap view, code host links, and Kubernetes and Terraform ship today; an installable app is coming soon, and every page of this site says which is which.',
  },
  {
    question: 'Who maintains it?',
    answer:
      'An independent open-source project and its contributors, in public. The code, the plans and the design decisions are in the public repository, and anyone can open an issue or a pull request. Changes land through pull requests with tests, and each release is tagged, signed and listed in the changelog.',
  },
  {
    question: 'Is there a paid or enterprise edition?',
    answer:
      'No. There is no open core, no enterprise tier and no licence key. Every feature is in the repository and in the image you install.',
  },
  {
    question: 'Does it send anything to you?',
    answer:
      'No. There is no telemetry, and the check for new releases is off until an admin turns it on. Outbound traffic is only what you configure: your mail server, a backup bucket, the certificate authority for HTTPS, and tracing only if you point it at a collector of your own.',
  },
  {
    question: 'What do I need to run it?',
    answer:
      'A Linux VM with at least 1 vCPU and 2 GB (2 vCPU and 4 GB is the size we plan for about 200 people, an estimate until measured), 10 GB of free disk, a domain pointing at it, and ports 80 and 443 free. The installer supports Ubuntu 22.04 or later, Debian 12 or later, Fedora 40 or later and Amazon Linux 2023.',
  },
  {
    question: 'How do upgrades and backups work?',
    answer:
      'Backups run every night and are test-restored every week. Updating takes one click in Settings › Updates or one command: it backs up first, checks the signature and rolls back on its own if the app is not healthy within three minutes.',
  },
  {
    question: 'Do I need AI?',
    answer:
      'No. AI shipped in 0.5 and is off until an admin turns it on in Settings › AI and models. Bring your own provider from the models.dev catalog or a model on your own network: summaries with sources, answers from your docs, help in the editor and plans you confirm, all drawn in lilac. Everything else works without it.',
  },
];
