# Getting help

Bemmoly is a young open source project run in public. There is no paid support and no support
contract; help comes from the maintainers and the community on GitHub, as time allows.

## Where to go

| You want to                                    | Go to                                                                                                  |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Ask how to do something, or why it works so    | [Discussions › Q&A](https://github.com/bemmoly/bemmoly/discussions/categories/q-a)                     |
| Suggest an idea that is not yet a clear change | [Discussions › Ideas](https://github.com/bemmoly/bemmoly/discussions/categories/ideas)                 |
| Report something that does not work            | [A bug report](https://github.com/bemmoly/bemmoly/issues/new?template=bug.yml)                         |
| Ask for a concrete change                      | [A feature request](https://github.com/bemmoly/bemmoly/issues/new?template=feature.yml)                |
| Report a security problem                      | Privately, as [SECURITY.md](SECURITY.md) describes; never in public                                    |
| Show what you built or how you run it          | [Discussions › Show and tell](https://github.com/bemmoly/bemmoly/discussions/categories/show-and-tell) |
| Chat with the maintainers and other users      | [Discord](https://discord.gg/qT7zsDeRwz)                                                               |

Search [open and closed issues](https://github.com/bemmoly/bemmoly/issues?q=is%3Aissue) and
[Discussions](https://github.com/bemmoly/bemmoly/discussions) first; someone may have hit it
already.

## Before you ask

- **Install problems.** The installer checks the machine itself and prints the fix for anything
  it finds missing; the [install guide](https://bemmoly.com/docs/install) walks through every
  step. Include the installer's last lines and the output of `bemmoly status`.
- **Errors in the app.** Error messages show a reference (a request id). Include it, and the
  log lines from `bemmoly logs` that carry it, so the server log line can be found.
- **Version.** Settings › System shows it, and so does `bemmoly status`.
- **Remove secrets.** Tokens, passwords, keys and personal data do not belong in a public
  issue or discussion.

## Try it without installing

The [live demo](https://bemmoly.com/demo) runs in your browser on sample data, with no server
and no sign-up. It resets when you reload.
