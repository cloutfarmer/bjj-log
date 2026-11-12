# Documentation index

Start with the smallest document that answers the task, and follow links only when you
need them. Coding-agent constraints live in [`../AGENTS.md`](../AGENTS.md).

| Document | Purpose |
|---|---|
| [`../README.md`](../README.md) | Project overview and code map |
| [`../CONTRIBUTING.md`](../CONTRIBUTING.md) | Setup, branches, verification, pull requests, and landing and releasing |
| [`../ARCHITECTURE.md`](../ARCHITECTURE.md) | Durable design and invariants |
| [`STATUS.md`](STATUS.md) | What has been verified, what hasn't, and the next gate |
| [`TESTING.md`](TESTING.md) | Safe checks and browser test procedures |
| [`../tests/README.md`](../tests/README.md) | Test groups and what each one touches |
| [`NEON.md`](NEON.md) | Database branches, connections, and browser-note import |
| [`ROADMAP.md`](ROADMAP.md) | Planned features |
| [`../.agent/policy.yml`](../.agent/policy.yml) | Paths agents never edit, commands they never run, and design triggers |
| [`../.agent/lessons.md`](../.agent/lessons.md) | Rules added after real failures |

## Truth and precedence

1. Code, migrations, and tests establish implemented behavior.
2. `ARCHITECTURE.md` establishes intended durable design.

If a document disagrees with the code, verify the behavior, then fix the document.
