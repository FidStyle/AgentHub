# Type Safety

> Type safety patterns in this project.

---

## Overview

<!--
Document your project's type safety conventions here.

Questions to answer:
- What type system do you use?
- How are types organized?
- What validation library do you use?
- How do you handle type inference?
-->

(To be filled by the team)

---

## Type Organization

<!-- Where types are defined, shared types vs local types -->

(To be filled by the team)

---

## Validation

<!-- Runtime validation patterns (Zod, Yup, io-ts, etc.) -->

(To be filled by the team)

---

## Common Patterns

- Mobile RN code must run a real `tsc --noEmit` gate; do not use `echo skip` scripts for type-check or build pass.
- React Native 0.73 component declarations can be rejected as JSX components by newer TypeScript versions. If upgrading the full RN/TS stack is outside the task, adapt the imported RN primitive to a typed `React.ComponentType<Props>` at the local screen boundary, preserving concrete props such as `ViewProps`, `TextProps`, `TextInputProps`, `TouchableOpacityProps`, and `FlatListProps<T>`.
- Keep the adapter local to the affected RN surface. Do not replace shared domain types or API payload types with broad casts.

---

## Forbidden Patterns

<!-- any, type assertions, etc. -->

- Do not mark Mobile/RN `type-check`, `build`, or `test` as passed with placeholder shell output.
- Do not hide TypeScript failures by changing real user flows to mock data, local echo, or untyped API payloads.
