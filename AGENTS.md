# Agent Rules Repository

A curated collection of `.mdc` rule files and documentation for AI coding assistants (Claude Code, Cursor).

## Cursor Cloud specific instructions

This is a **static content repository** with no build system, no dependencies, no tests, and no services to run. There is nothing to install or compile.

### Repository structure
- `project-rules/` — 22 `.mdc` files: actionable AI assistant rules/slash commands
- `docs/` — Reference documentation (Swift, MCP)
- `global-rules/` — Global Claude Code configuration and shell scripts
- `install-project-rules.sh` — Installs rules into `~/.claude/CLAUDE.md`
- `tweak-claude.sh` — Interactive menu for MCP server and rules management

### Validation
Since there is no build/test/lint system, validation consists of:
- `bash -n <script>.sh` to check shell script syntax
- Verifying `.mdc` files are well-formed markdown (some have YAML frontmatter with `---` delimiters, some are plain markdown — both are valid)

### Running the "application"
The core functionality is `bash install-project-rules.sh` (run from repo root). It creates/updates `~/.claude/CLAUDE.md` with a reference to the project rules directory.

### Notes
- `tweak-claude.sh` is interactive (uses `read -p`) and requires TTY input — do not run it in non-interactive contexts.
- The `.mdc` format is documented in the README: YAML frontmatter is optional; Cursor uses it for rule metadata, Claude Code ignores it.
