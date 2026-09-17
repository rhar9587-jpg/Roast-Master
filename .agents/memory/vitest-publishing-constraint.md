---
name: Vitest publishing constraint
description: Why this Node 20 project currently avoids Vitest in its publish dependency graph.
---

Keep Vitest out of the dependency graph unless publishing compatibility is verified first. Replit's package firewall blocked the tested Node 20-compatible Vitest releases, while the permitted latest major required Node 22 or newer.

**Why:** A publish failed during package installation before the application build began. Forcing the latest release would leave the test runner on an unsupported runtime.

**How to apply:** When restoring automated tests, either migrate the tests to a runner compatible with the current Node version or upgrade the project runtime and verify a clean production install through Replit's package firewall.