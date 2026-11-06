# Documentation index

Start with the smallest document that answers the task, and follow links only when you
need them. Coding-agent constraints live in [`../AGENTS.md`](../AGENTS.md).

| Document | Purpose |
|---|---|
| [`../README.md`](../README.md) | Project overview and code map |
| [`../CONTRIBUTING.md`](../CONTRIBUTING.md) | Setup, branches, verification, and pull requests |
| [`../ARCHITECTURE.md`](../ARCHITECTURE.md) | Durable design and invariants |
| [`TESTING.md`](TESTING.md) | Safe checks and browser test procedures |
| [`../tests/README.md`](../tests/README.md) | Test groups and what each one touches |
| [`NEON.md`](NEON.md) | Database branches, connections, and browser-note import |
| [`ROADMAP.md`](ROADMAP.md) | Planned features |

## Truth and precedence

1. Code, migrations, and tests establish implemented behavior.
2. `ARCHITECTURE.md` establishes intended durable design.

If a document disagrees with the code, verify the behavior, then fix the document.
