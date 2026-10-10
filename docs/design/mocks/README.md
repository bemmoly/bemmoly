# Superseded: the first release's mocks

**Do not build from these files when the design system covers the screen.** The canonical design
system is [`../system/`](../system/README.md) (ADR 0016); the design review in
[`../premium/`](../premium/README.md) is its evidence. These mocks are kept as history, and
because Storybook serves them beside older stories.

| Mock                                   | Status                                                                 |
| -------------------------------------- | ---------------------------------------------------------------------- |
| App, Home, Board, Backlog, Issue       | Superseded: the frame, header, cards, rows and glyphs are the system's |
| Workflow, Board Settings               | Superseded for the frame and vocabulary; internals still a reference   |
| Docs, Doc Editor                       | Superseded by the Docs review (with #77) and the system                |
| Command                                | Superseded: the palette follows the system and the shell notes         |
| Themes, Appearance Settings            | Superseded for tokens; the Appearance page's content is a reference    |
| Modules, Updates, Backups, People Settings | Reference for page content only, inside the system's settings frame |
| Setup                                  | Reference for step content only; tokens, tiles and lockup are the system's |
| Landing                                | Superseded by the marketing site rules in the system                  |
| Roadmap, Directions                    | History only                                                           |

Where a mock and the system disagree, the system wins. Where only a mock draws something (most
settings page contents, the setup steps), build its content from the mock and everything around
it (frame, tokens, components, icons, words, states) from the system.
