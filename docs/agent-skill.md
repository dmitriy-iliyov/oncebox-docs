---
id: agent-skill
title: Agent Skill
sidebar_position: 4
---

# Agent Skill

The [oncebox skill](https://github.com/dmitriy-iliyov/java-agent-skills/blob/main/plugins/oncebox/skills/oncebox/SKILL.md)
gives a coding agent what it cannot know about this library: the minimal set of modules, which idempotent consumer to
inject, and the traps - the startup failures with the errors they print, and the misconfigurations that lose or skip
events without an error.

The agent loads it when a task is about an outbox, an inbox or deduplication of redelivered messages, or when
`oncebox-starter` is in the build file, so it uses the library instead of writing a poller by hand.

## Claude Code

Install it from the `dmitriy-iliyov-skills` marketplace:

```text
/plugin marketplace add dmitriy-iliyov/java-agent-skills
/plugin install oncebox@dmitriy-iliyov-skills
```

## Other agents

The skill is a plain `SKILL.md`, so any agent that reads the format can use it.
