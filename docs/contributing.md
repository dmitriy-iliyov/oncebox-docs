---
id: contributing
title: Contributing
sidebar_position: 5
---

# Contributing

Bug reports, documentation fixes and code changes are welcome. The full guide is
[CONTRIBUTING.md](https://github.com/dmitriy-iliyov/oncebox/blob/main/CONTRIBUTING.md); this page is the short
version.

## Where to go

| You have                      | Go to                                                                                      |
|-------------------------------|--------------------------------------------------------------------------------------------|
| A bug                         | [Bug report](https://github.com/dmitriy-iliyov/oncebox/issues/new/choose), ideally with a failing test |
| A feature idea                | An issue first, to agree on the approach before writing code                               |
| A security issue              | [Support Policy](support-policy.md#reporting-a-vulnerability), never a public issue        |

## Building

You need JDK 21 and Docker (tests start the databases and brokers with Testcontainers). Maven comes with the wrapper:

```bash
./mvnw clean install -Dgpg.skip=true
```

The infrastructure integration tests, the end-to-end tests and the classpath isolation tests live in
`oncebox-tests/` outside the reactor and run after it is installed; the commands are in CONTRIBUTING.md.

## Ground rules

- One change per pull request, with tests; a bug fix comes with a test that fails without it.
- SQL changes go to all three dialect modules, and schema changes are synced to `oncebox-test-fixtures`.
- A user-visible change updates the documentation.

## Documentation

This site lives in its own repository, [oncebox-docs](https://github.com/dmitriy-iliyov/oncebox-docs), and is built
with Docusaurus. To preview a change:

```bash
git clone https://github.com/dmitriy-iliyov/oncebox-docs.git
cd oncebox-docs
npm ci
npm start
```

Every page has an "Edit this page" link at the bottom that opens it on GitHub.
