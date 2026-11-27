# The project verify skill

The gate runs static checks and tests. It never starts the program. The verify skill does: it starts the program through its declared entry point, drives one flow with a fixed input, and checks the evidence. Write it at `.claude/skills/verify/SKILL.md` in the target project.

## The four parts

1. **Start**: the command that starts the program through the entry point from Decision 1.
2. **Drive**: one flow, with a fixed input that is committed in the repo. Keep the input small and offline, unless the program exists to talk to the network.
3. **Evidence**: what to capture. The exit status and the output, a row count, a response body.
4. **Pass**: the condition the evidence must meet, stated so that two people reading it reach the same verdict.

Keep the flow short. A check that takes minutes gets skipped, and this one runs before every commit.

The skill reports the command it ran and the evidence it captured, then pass or fail. A report that says "looks fine" with no evidence is not a pass.

## Only commands someone gave you

Every command in the skill comes from the design doc or from the person. When the design doc doesn't say how the program starts, ask. Don't invent a plausible launch command.

Before the first feature there is usually nothing to run. Then the skill names the declared entry point and says that the flow does not run yet, and that the first feature change makes it run and fills in the command. The skill is a file in the project, so the change that alters the entry point also updates it.

## Template

    ---
    name: verify
    description: Start <project> and drive one real flow before a commit, and whenever asked to verify that the program works. The gate checks code; this checks that the program runs.
    ---

    # Verify

    1. Start: `<command>`
    2. Drive: <the flow, with the fixed input at <path>>
    3. Evidence: capture <what>
    4. Pass: <condition>

    Report the command, the captured evidence, and pass or fail.

## Before the first feature (nothing runs yet)

    1. Start: through `<declared entrypoint from Decision 1>`. It does not run yet.
       The first feature change makes this flow run and replaces this step with the command.
    2. Drive: one run on `tests/fixtures/<fixture>` (to be added with the first feature).
    3. Evidence: exit status and the output or target counts to check.
    4. Pass: exit 0; output matches the declared grain or expected fixture.

## Language-specific examples

Read the **Verify skill examples** section of the active language pack (`references/python.md` or `references/rust.md`) for archetype illustrations (pipeline/streaming engine, service, CLI tool, library). In a real project, every command comes from the design doc or the person.
