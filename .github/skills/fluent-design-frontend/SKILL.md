---
name: fluent-design-frontend
description: 'Design and implement frontend UI using Microsoft Fluent 2 principles and Fluent UI React v9 patterns. Use for layout, components, theming, accessibility, and interaction guidance.'
argument-hint: 'Describe the page or component, platform (web/react), and whether you need design-only guidance or direct code changes.'
---

# Fluent Design Frontend

Use this skill when creating or refactoring frontend UI to align with Microsoft Fluent 2.

## When To Use
- Building new pages, forms, dashboards, or flows where consistency and accessibility matter.
- Refactoring existing UI to a cleaner design-system-based structure.
- Choosing between custom markup and Fluent UI React v9 components.
- Defining theme, spacing, typography, and component states in a consistent way.
- Improving interaction quality (focus, feedback, loading, errors, and progressive disclosure).

## Canonical Sources
- Fluent 2 home: https://fluent2.microsoft.design/
- Start developing (React v9): https://fluent2.microsoft.design/get-started/develop
- Web React component guidance: https://fluent2.microsoft.design/components/web/react
- Start designing (tokens and variables): https://fluent2.microsoft.design/get-started/design

## Core Rules To Enforce
- Prefer design tokens over hardcoded values for color, radius, spacing, and sizing.
- Use Fluent UI React v9 components when available before creating custom components.
- Wrap app or page root in `FluentProvider` with explicit theme selection.
- Preserve clear hierarchy with purpose-first layout and predictable grouping.
- Ensure keyboard navigation and visible focus for all interactive controls.
- Use semantic HTML landmarks and labels so screen readers get meaningful structure.
- Provide clear component states: default, hover, focus, active, disabled, loading, error, success.
- Keep motion purposeful and subtle; never rely on motion alone to convey meaning.

## Implementation Defaults (Web/React)
1. Install and bootstrap Fluent UI React v9:
- `npm install @fluentui/react-components`
- Start with `FluentProvider` and `webLightTheme` (or project-selected theme).

2. Prefer these patterns:
- Forms: `Field` + input component (`Input`, `Textarea`, `Select`, `Dropdown`, `Combobox`).
- Primary actions: `Button` with clear appearance hierarchy.
- Feedback: `MessageBar`, `Toast`, `Spinner`, `Skeleton`, `ProgressBar`.
- Navigation: `Breadcrumb`, `Nav`, `TabList`, `Menu`.
- Density and grouping: `Card`, `Divider`, `Label`, `Text`.

3. Avoid these anti-patterns:
- One-off spacing/color values duplicated across files.
- Div-based clickable controls when semantic controls exist.
- Placeholder-only field labeling.
- Custom focus styling that hides or removes focus indication.

## Accessibility Baseline Checklist
- All controls reachable and usable by keyboard only.
- Logical tab order and no keyboard traps.
- Visible focus ring on interactive elements.
- Inputs have persistent labels and clear validation text.
- Icons that convey meaning include accessible names.
- Contrast is sufficient for text and controls in chosen theme.

## Page Composition Heuristics
- Start from task flow: identify primary task, then secondary actions.
- Keep top-level page sections short and scannable.
- Group related actions close to relevant content.
- Use progressive disclosure (popover, drawer, dialog) instead of overcrowding.
- Reserve destructive actions for explicit, confirmable interactions.

## Delivery Workflow
1. Identify user task and success criteria.
2. Map UI blocks to Fluent components before coding custom UI.
3. Establish theme and tokens at root/provider level.
4. Implement layout and states, then run accessibility pass.
5. Validate behavior on desktop and mobile breakpoints.
6. Document any intentional deviation from Fluent guidance.

## Output Template
- Fluent alignment verdict: aligned, mostly aligned, or not aligned.
- Findings ordered by severity (accessibility, consistency, usability, maintainability).
- Concrete file-level changes with rationale.
- Remaining risks and follow-up improvements.

## Notes
- For non-React pages in this repository, apply the same Fluent principles with semantic HTML, tokenized CSS variables, and consistent interaction states.
- If Fluent component guidance and legacy project conventions conflict, prefer accessibility and consistency first, then document the trade-off.