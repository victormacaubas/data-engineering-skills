"""Check the structural rules of this repository.

Run with `uv run scripts/validate_repo.py [REPO_ROOT]`. REPO_ROOT defaults to
the parent of the directory that holds this script. The command reads files
and runs `bash -n`; it writes nothing and uses no network.

Each failure prints as `<file>: <rule>: <detail>`. The last line gives the
count of failures, or the count of checks that passed. Exit status is 0 when
every check passes, 1 when a check fails, and 2 when REPO_ROOT is not a
directory.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import tomllib
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path, PurePosixPath

GROUPS = ("craft", "flow", "data")
UNRELEASED_DIRS = ("in-progress", "deprecated")
CLAUDE_CATALOG = ".claude-plugin/marketplace.json"
CURSOR_CATALOG = ".cursor-plugin/marketplace.json"
AGENT_VARIANTS = (("claude", ".md"), ("codex", ".toml"), ("cursor", ".md"))
WORKSPACE_SUFFIX = "-workspace"
FRONTMATTER_FENCE = "---"
BLOCK_SCALAR_MARKERS = ("|", ">")


@dataclass(frozen=True)
class Failure:
    file: str
    rule: str
    detail: str

    def render(self) -> str:
        return f"{self.file}: {self.rule}: {self.detail}"


class FrontmatterError(ValueError):
    pass


@dataclass(frozen=True)
class Catalog:
    path: str
    data: dict | None
    error: str | None


@dataclass(frozen=True)
class Agent:
    name: str
    description: str
    skills: tuple[str, ...]


@dataclass(frozen=True)
class Repo:
    """Everything the checks read, loaded once."""

    root: Path
    claude: Catalog
    cursor: Catalog
    skills_root_dirs: tuple[str, ...]
    skill_dirs: dict[str, tuple[str, ...]]
    agent_names: tuple[str, ...]
    agent_files: frozenset[str]
    agents: dict[tuple[str, str], Agent]
    agent_failures: tuple[Failure, ...]
    mod_dirs: tuple[str, ...]


def _read_catalog(root: Path, rel: str) -> Catalog:
    try:
        data = json.loads((root / rel).read_text(encoding="utf-8"))
    except OSError as exc:
        return Catalog(rel, None, f"cannot read file: {exc}")
    except json.JSONDecodeError as exc:
        return Catalog(rel, None, f"invalid JSON: {exc}")
    if not isinstance(data, dict):
        return Catalog(rel, None, "no top-level 'plugins' list")
    if not isinstance(data.get("plugins"), list):
        return Catalog(rel, data, "no top-level 'plugins' list")
    return Catalog(rel, data, None)


def _plugins(catalog: Catalog) -> list[dict]:
    if catalog.data is None:
        return []
    plugins = catalog.data.get("plugins", [])
    if not isinstance(plugins, list):
        return []
    return [p for p in plugins if isinstance(p, dict)]


def _group_entries(catalog: Catalog) -> dict[str, dict]:
    """Plugin entries sourced from `./skills/<group>`, keyed by group name.

    When a group appears twice, the first entry is the one other checks read;
    the repeat is reported by `check_catalog_entries`.
    """
    entries: dict[str, dict] = {}
    for plugin in _plugins(catalog):
        source = str(plugin.get("source", ""))
        if source.startswith("./skills/"):
            entries.setdefault(source.removeprefix("./skills/").strip("/"), plugin)
    return entries


def _skills_of(entry: dict) -> list[str]:
    skills = entry.get("skills", [])
    return [s for s in skills if isinstance(s, str)] if isinstance(skills, list) else []


def _mod_entries(catalog: Catalog) -> list[dict]:
    return [p for p in _plugins(catalog) if str(p.get("source", "")).startswith("./mods/")]


def _visible_dirs(base: Path, *, skip_workspaces: bool = True) -> tuple[str, ...]:
    """Names of the directories under `base`, minus hidden ones and eval workspaces."""
    if not base.is_dir():
        return ()
    return tuple(
        sorted(
            p.name
            for p in base.iterdir()
            if p.is_dir()
            and not p.name.startswith(".")
            and not (skip_workspaces and p.name.endswith(WORKSPACE_SUFFIX))
        )
    )


def _unquote(value: str) -> str:
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
        return value[1:-1]
    return value


def parse_frontmatter(text: str) -> dict[str, str | list[str]]:
    """Read the flat frontmatter of an agent file.

    Supports `key: value`, inline `key: [a, b]`, and a `key:` line followed by
    `  - item` lines. Raises FrontmatterError on any other shape so that a new
    field form fails loudly instead of being read wrongly.
    """
    lines = text.splitlines()
    if not lines or lines[0].strip() != FRONTMATTER_FENCE:
        raise FrontmatterError("no opening '---' on the first line")
    try:
        end = next(
            i for i in range(1, len(lines)) if lines[i].strip() == FRONTMATTER_FENCE
        )
    except StopIteration:
        raise FrontmatterError("no closing '---'") from None

    fields: dict[str, str | list[str]] = {}
    current: str | None = None
    for number, line in enumerate(lines[1:end], start=2):
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        key_match = re.match(r"^([A-Za-z_][\w-]*):\s*(.*)$", line)
        item_match = re.match(r"^\s+-\s+(.*)$", line)
        if key_match:
            current = key_match.group(1)
            value = key_match.group(2).strip()
            if value[:1] in BLOCK_SCALAR_MARKERS:
                raise FrontmatterError(
                    f"line {number}: block scalar for '{current}' is not supported"
                )
            if value.startswith("[") and value.endswith("]"):
                inner = value[1:-1]
                fields[current] = [
                    _unquote(v) for v in inner.split(",") if v.strip()
                ]
            else:
                fields[current] = _unquote(value)
        elif (
            item_match
            and current is not None
            and (fields[current] == "" or isinstance(fields[current], list))
        ):
            existing = fields[current]
            items = existing if isinstance(existing, list) else []
            items.append(_unquote(item_match.group(1)))
            fields[current] = items
        else:
            raise FrontmatterError(f"line {number}: cannot parse '{line.strip()}'")
    return fields


def _frontmatter_agent(root: Path, rel: str) -> tuple[Agent | None, Failure | None]:
    try:
        fields = parse_frontmatter((root / rel).read_text(encoding="utf-8"))
    except (OSError, FrontmatterError) as exc:
        return None, Failure(rel, "agent-frontmatter", str(exc))
    skills = fields.get("skills", [])
    if isinstance(skills, list):
        preloads = tuple(skills)
    else:
        preloads = (skills,) if skills else ()
    return (
        Agent(
            name=str(fields.get("name", "")),
            description=str(fields.get("description", "")),
            skills=preloads,
        ),
        None,
    )


def _toml_agent(root: Path, rel: str) -> tuple[Agent | None, Failure | None]:
    try:
        data = tomllib.loads((root / rel).read_text(encoding="utf-8"))
    except (OSError, tomllib.TOMLDecodeError) as exc:
        return None, Failure(rel, "agent-toml", str(exc))
    agent = Agent(
        name=str(data.get("name", "")),
        description=str(data.get("description", "")),
        skills=(),
    )
    return agent, None


def _agent_names(root: Path) -> tuple[str, ...]:
    names: set[str] = set()
    for platform, suffix in AGENT_VARIANTS:
        base = root / "agents" / platform
        if base.is_dir():
            names.update(p.stem for p in base.glob(f"*{suffix}") if p.is_file())
    return tuple(sorted(names))


def _load_agents(
    root: Path, names: tuple[str, ...]
) -> tuple[dict[tuple[str, str], Agent], tuple[Failure, ...]]:
    """Parse every agent variant that exists, keyed by (platform, file stem)."""
    agents: dict[tuple[str, str], Agent] = {}
    failures: list[Failure] = []
    for name in names:
        for platform, suffix in AGENT_VARIANTS:
            rel = f"agents/{platform}/{name}{suffix}"
            if not (root / rel).is_file():
                continue
            loader = _toml_agent if suffix == ".toml" else _frontmatter_agent
            agent, failure = loader(root, rel)
            if agent is not None:
                agents[(platform, name)] = agent
            if failure is not None:
                failures.append(failure)
    return agents, tuple(failures)


def load_repo(root: Path) -> Repo:
    names = _agent_names(root)
    agents, agent_failures = _load_agents(root, names)
    return Repo(
        root=root,
        claude=_read_catalog(root, CLAUDE_CATALOG),
        cursor=_read_catalog(root, CURSOR_CATALOG),
        skills_root_dirs=_visible_dirs(root / "skills"),
        skill_dirs={g: _visible_dirs(root / "skills" / g) for g in GROUPS},
        agent_names=names,
        agent_files=frozenset(
            f"agents/{platform}/{name}{suffix}"
            for name in names
            for platform, suffix in AGENT_VARIANTS
            if (root / f"agents/{platform}/{name}{suffix}").is_file()
        ),
        agents=agents,
        agent_failures=agent_failures,
        mod_dirs=_visible_dirs(root / "mods", skip_workspaces=False),
    )


def check_catalog_json(repo: Repo) -> list[Failure]:
    return [
        Failure(catalog.path, "catalog-json", catalog.error)
        for catalog in (repo.claude, repo.cursor)
        if catalog.error is not None
    ]


def check_catalog_parity(repo: Repo) -> list[Failure]:
    claude, cursor = repo.claude, repo.cursor
    if claude.data is None or cursor.data is None:
        return []
    failures = []
    claude_groups, cursor_groups = _group_entries(claude), _group_entries(cursor)
    for catalog, groups in ((claude, claude_groups), (cursor, cursor_groups)):
        for group in GROUPS:
            if group not in groups:
                failures.append(
                    Failure(catalog.path, "catalog-parity", f"no entry for group '{group}'")
                )
    for group in GROUPS:
        if group not in claude_groups or group not in cursor_groups:
            continue
        in_claude = set(_skills_of(claude_groups[group]))
        in_cursor = set(_skills_of(cursor_groups[group]))
        for skill in sorted(in_claude - in_cursor):
            failures.append(
                Failure(
                    cursor.path,
                    "catalog-parity",
                    f"{group}/{skill.removeprefix('./')} is in {claude.path} but not here",
                )
            )
        for skill in sorted(in_cursor - in_claude):
            failures.append(
                Failure(
                    claude.path,
                    "catalog-parity",
                    f"{group}/{skill.removeprefix('./')} is in {cursor.path} but not here",
                )
            )
    return failures


def _has_unreleased_segment(path: str) -> bool:
    return any(part in UNRELEASED_DIRS for part in PurePosixPath(path).parts)


def check_catalog_entries(repo: Repo) -> list[Failure]:
    """Plugin names and sources are unique; a skill-group entry is named for its group."""
    failures = []
    for catalog in (repo.claude, repo.cursor):
        seen_names: set[str] = set()
        seen_sources: set[str] = set()
        for plugin in _plugins(catalog):
            name, source = str(plugin.get("name", "")), str(plugin.get("source", ""))
            repeated = []
            if name in seen_names:
                repeated.append(f"name '{name}'")
            if source in seen_sources:
                repeated.append(f"source '{source}'")
            if repeated:
                failures.append(
                    Failure(
                        catalog.path,
                        "plugin-unique",
                        f"entry repeats an earlier entry's {' and '.join(repeated)}",
                    )
                )
            seen_names.add(name)
            seen_sources.add(source)

            if _has_unreleased_segment(source) or not re.fullmatch(r"\./skills/[^/]+", source):
                continue
            group = source.removeprefix("./skills/")
            if group not in GROUPS:
                failures.append(
                    Failure(
                        catalog.path,
                        "plugin-group",
                        f"entry '{name}' has source {source}; '{group}' is not one of "
                        f"{', '.join(GROUPS)}",
                    )
                )
            elif name != group:
                failures.append(
                    Failure(
                        catalog.path,
                        "plugin-name",
                        f"entry named '{name}' has source {source}; expected name '{group}'",
                    )
                )
    return failures


def check_catalog_paths(repo: Repo) -> list[Failure]:
    """Each `source` and `skills` path is well formed and resolves to a skill."""
    failures = []
    for catalog in (repo.claude, repo.cursor):
        rel = catalog.path
        for plugin in _plugins(catalog):
            name = plugin.get("name", "?")
            source = str(plugin.get("source", ""))
            if _has_unreleased_segment(source):
                failures.append(
                    Failure(rel, "unreleased-skill", f"entry '{name}' has source {source}")
                )
                continue
            if not (
                re.fullmatch(r"\./skills/[^/]+", source)
                or re.fullmatch(r"\./mods/[^/]+", source)
            ):
                failures.append(
                    Failure(
                        rel,
                        "plugin-source",
                        f"entry '{name}' has source '{source}'; "
                        "expected ./skills/<group> or ./mods/<name>",
                    )
                )
                continue
            if not source.startswith("./skills/"):
                continue
            for skill in _skills_of(plugin):
                if _has_unreleased_segment(skill):
                    failures.append(
                        Failure(rel, "unreleased-skill", f"entry '{name}' lists {skill}")
                    )
                elif not re.fullmatch(r"\./[^/]+", skill):
                    failures.append(
                        Failure(
                            rel,
                            "skills-path",
                            f"entry '{name}' lists '{skill}'; expected ./<skill-name>",
                        )
                    )
                elif not (repo.root / source / skill).is_dir():
                    failures.append(
                        Failure(
                            rel,
                            "skills-path",
                            f"entry '{name}' lists {skill}, which is not a directory under {source}",
                        )
                    )
                elif not (repo.root / source / skill / "SKILL.md").is_file():
                    failures.append(
                        Failure(
                            f"{source.removeprefix('./')}/{skill.removeprefix('./')}",
                            "skill-md",
                            f"cataloged skill has no SKILL.md (listed in {rel})",
                        )
                    )
    return failures


def check_skill_directories(repo: Repo) -> list[Failure]:
    """Each skill directory under a group is in that group's `skills` array."""
    failures = []
    for name in repo.skills_root_dirs:
        if name not in (*GROUPS, *UNRELEASED_DIRS):
            failures.append(
                Failure(
                    f"skills/{name}",
                    "skill-group",
                    "directory is not a skill group, in-progress, or deprecated",
                )
            )
    if repo.claude.data is None:
        return failures
    groups = _group_entries(repo.claude)
    for group in GROUPS:
        if group not in groups:
            continue
        listed = {s.removeprefix("./") for s in _skills_of(groups[group])}
        for skill in repo.skill_dirs[group]:
            if skill not in listed:
                failures.append(
                    Failure(
                        f"skills/{group}/{skill}",
                        "skill-cataloged",
                        f"directory is not in the '{group}' skills array of {CLAUDE_CATALOG}",
                    )
                )
    return failures


def check_skill_names(repo: Repo) -> list[Failure]:
    seen: dict[str, list[str]] = {}
    for group in GROUPS:
        for skill in repo.skill_dirs[group]:
            seen.setdefault(skill, []).append(f"skills/{group}/{skill}")
    return [
        Failure(paths[0], "skill-name-unique", f"name also at {', '.join(paths[1:])}")
        for paths in seen.values()
        if len(paths) > 1
    ]


def check_agent_variants(repo: Repo) -> list[Failure]:
    return [
        Failure(rel, "agent-variant", "variant file is missing")
        for name in repo.agent_names
        for platform, suffix in AGENT_VARIANTS
        if (rel := f"agents/{platform}/{name}{suffix}") not in repo.agent_files
    ]


def check_agent_names(repo: Repo) -> list[Failure]:
    """Also reports the agent files that did not parse; no other check does."""
    failures = list(repo.agent_failures)
    for (platform, stem), agent in repo.agents.items():
        suffix = dict(AGENT_VARIANTS)[platform]
        if agent.name != stem:
            failures.append(
                Failure(
                    f"agents/{platform}/{stem}{suffix}",
                    "agent-name",
                    f"name is '{agent.name}'; expected '{stem}'",
                )
            )
    return failures


def check_agent_descriptions(repo: Repo) -> list[Failure]:
    failures: list[Failure] = []
    for (platform, stem), agent in repo.agents.items():
        suffix = dict(AGENT_VARIANTS)[platform]
        for other in repo.agent_names:
            if other == stem:
                continue
            pattern = rf"(?<![\w-]){re.escape(other)}(?![\w-])"
            if re.search(pattern, agent.description):
                failures.append(
                    Failure(
                        f"agents/{platform}/{stem}{suffix}",
                        "agent-description",
                        f"description names a different agent: '{other}'",
                    )
                )
    return failures


def check_agent_preloads(repo: Repo) -> list[Failure]:
    if repo.claude.data is None:
        return []
    resolved = {
        f"{group}:{skill.removeprefix('./')}"
        for group, entry in _group_entries(repo.claude).items()
        for skill in _skills_of(entry)
    }
    failures: list[Failure] = []
    for (platform, stem), agent in repo.agents.items():
        if platform != "claude":
            continue
        for preload in agent.skills:
            rel = f"agents/claude/{stem}.md"
            if ":" not in preload:
                failures.append(
                    Failure(rel, "agent-preload", f"'{preload}' has no <group>: prefix")
                )
            elif preload not in resolved:
                failures.append(
                    Failure(
                        rel,
                        "agent-preload",
                        f"'{preload}' is not a cataloged <group>:<skill>",
                    )
                )
    return failures


def check_mods(repo: Repo) -> list[Failure]:
    claude, cursor, mod_dirs = repo.claude, repo.cursor, repo.mod_dirs
    failures = []
    if claude.data is not None:
        claude_mods = {
            str(p["source"]).removeprefix("./mods/").strip("/"): p
            for p in _mod_entries(claude)
        }
        for name in mod_dirs:
            if name not in claude_mods:
                failures.append(
                    Failure(
                        f"mods/{name}",
                        "mod-cataloged",
                        f"no entry with source ./mods/{name} in {CLAUDE_CATALOG}",
                    )
                )
        for name, entry in claude_mods.items():
            if name not in mod_dirs:
                failures.append(
                    Failure(CLAUDE_CATALOG, "mod-cataloged", f"entry source ./mods/{name} has no directory")
                )
            if entry.get("name") != name:
                failures.append(
                    Failure(
                        CLAUDE_CATALOG,
                        "mod-name",
                        f"entry named '{entry.get('name')}' has source ./mods/{name}",
                    )
                )
            if "skills" in entry:
                failures.append(
                    Failure(CLAUDE_CATALOG, "mod-entry", f"mod entry '{name}' has a skills array")
                )
        for name in claude_mods:
            if name in GROUPS:
                failures.append(
                    Failure(CLAUDE_CATALOG, "mod-name", f"mod '{name}' has the name of a skill group")
                )
    if cursor.data is not None:
        for entry in _mod_entries(cursor):
            failures.append(
                Failure(CURSOR_CATALOG, "mod-in-cursor", f"lists mod entry '{entry.get('name')}'")
            )
    for name in mod_dirs:
        manifest = f"mods/{name}/.claude-plugin/plugin.json"
        try:
            declared = json.loads((repo.root / manifest).read_text(encoding="utf-8")).get("name")
        except (OSError, json.JSONDecodeError, AttributeError) as exc:
            failures.append(Failure(manifest, "mod-manifest", f"cannot read manifest: {exc}"))
            continue
        if declared != name:
            failures.append(
                Failure(manifest, "mod-name", f"name is '{declared}'; expected '{name}'")
            )
    return failures


def check_script_syntax(repo: Repo) -> list[Failure]:
    failures = []
    scripts = repo.root / "scripts"
    for script in sorted(scripts.glob("*.sh")) if scripts.is_dir() else []:
        result = subprocess.run(
            ["bash", "-n", f"scripts/{script.name}"],
            cwd=repo.root,
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode != 0:
            detail = result.stderr.strip().splitlines()
            failures.append(
                Failure(
                    f"scripts/{script.name}",
                    "shell-syntax",
                    detail[0] if detail else "bash -n failed",
                )
            )
    return failures


CHECKS: tuple[Callable[[Repo], list[Failure]], ...] = (
    check_catalog_json,
    check_catalog_parity,
    check_catalog_entries,
    check_catalog_paths,
    check_skill_directories,
    check_skill_names,
    check_agent_variants,
    check_agent_names,
    check_agent_descriptions,
    check_agent_preloads,
    check_mods,
    check_script_syntax,
)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Check the structural rules of this repository. The command reads "
            "files and writes none. It checks the repository at REPO_ROOT; "
            "without the argument it checks the repository that holds this "
            "script."
        ),
        epilog=(
            "Exit status: 0 when every check passes, 1 when a check fails, "
            "2 when REPO_ROOT is not a directory."
        ),
    )
    parser.add_argument(
        "repo_root",
        nargs="?",
        type=Path,
        default=Path(__file__).resolve().parent.parent,
        help="repository to check (default: the parent of this script's directory)",
    )
    root = parser.parse_args(argv).repo_root.resolve()
    if not root.is_dir():
        print(f"{root}: repo-root: not a directory", file=sys.stderr)
        return 2

    repo = load_repo(root)
    failures: list[Failure] = []
    failed_checks = 0
    for check in CHECKS:
        found = check(repo)
        failed_checks += bool(found)
        failures.extend(found)

    for failure in failures:
        print(failure.render())
    if failures:
        print(
            f"FAILED: {len(failures)} failure(s) in {failed_checks} of {len(CHECKS)} checks"
        )
        return 1
    print(f"OK: {len(CHECKS)} checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
