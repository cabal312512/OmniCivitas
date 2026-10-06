# OmniCivitas v0.1.4

Generated backend programs now resolve their execution directory before granting file-read permission. This fixes directory alias handling, including macOS temporary paths, while retaining the single-file permission grant and generated-file cleanup.

The standard test command runs profile and audio tests with their native Node runner. Search coverage now includes all 112 tools. The tower guard regression checks ordinary jumps; the intentionally higher sprint jump remains available. A regression test executes a program through a directory alias and verifies cleanup.

This release includes all v0.1.3 features and the same curated source publication rules. AI briefs, handoffs, internal records, compiled paper PDFs, dependencies, runtime state and secrets remain excluded. Local originals and the frozen scientific seals are unchanged.

See [English deployment instructions](DEPLOY.en.md) or [中文部署说明](DEPLOY.zh-CN.md). The ZIP contains sources; install and build using the documented standard commands. Original code is MIT, copyright 2026 cabal312512; third-party materials retain their respective terms.
