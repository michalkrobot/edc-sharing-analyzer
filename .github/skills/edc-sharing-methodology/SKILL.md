---
name: edc-sharing-methodology
description: 'Validate and implement EDC electricity-sharing simulation per Vyhodnoceni-sdileni-elektriny methodology PDF. Use for allocation rules, priorities, iterative rounds, 15-minute evaluation, and rounding-down checks.'
argument-hint: 'Describe the simulation code path and whether you want analysis-only or code fixes.'
---

# EDC Sharing Methodology

Use this skill when you need to validate or implement simulation logic against the official EDC methodology document.

## When To Use
- Reviewing whether a simulation algorithm matches EDC rules.
- Refactoring producer to consumer allocation behavior.
- Validating iterative rounds and priority processing.
- Verifying rounding and per-interval accounting behavior.
- Auditing export/report terminology so it matches EDC concepts.

## Canonical Rules To Enforce
- Allocation key is producer to consumer, with percentage per producer row.
- Sum of allocations for one producer cannot exceed 100%.
- One consumer can receive from max 5 producers.
- Sharing is evaluated per 15-minute interval independently.
- Sharing amount for pair producer to consumer is min(remaining consumer demand, allocation percent times producer delivery for current iteration).
- Consumer remaining demand is reduced immediately after each pair computation.
- Producer remaining delivery is reduced after completing all consumers and priorities in one iteration round.
- Iteration rounds: if SSE size is above 50 then one round; otherwise rounds equal consumer count, capped at 5.
- Rounding: floor to 2 decimal places in disfavor of sharing for sharing computations.

## Procedure
1. Identify code paths for:
- Simulation engine.
- Allocation matrix construction.
- Priority ordering.
- Rounding and unit conversions.
- Export labels and UI terminology.

2. Validate hard constraints:
- Producer row sum <= 100%.
- Max 5 producers per consumer.
- Round limits by SSE size.

3. Validate computational sequence:
- Per interval processing.
- Priority traversal.
- Immediate consumer reduction.
- End-of-round producer reduction.

4. Validate numeric behavior:
- Two-decimal floor semantics for shared energy.
- No carry-over between 15-minute intervals.

5. Report gaps in three classes:
- Critical mismatch to methodology.
- Terminology mismatch causing user confusion.
- Optional enhancements.

6. If code changes are requested:
- Apply smallest possible patch.
- Add explicit safeguards for producer row sums and rounding behavior.
- Update report/export labels to distinguish allocation key vs recommended demand share.

## Output Template
- Methodology match verdict: full, partial, or mismatch.
- Findings ordered by severity.
- Evidence with file links and line references.
- Proposed fixes with expected behavior changes.

## References
- [Methodology Summary](./references/methodology-summary.md)
