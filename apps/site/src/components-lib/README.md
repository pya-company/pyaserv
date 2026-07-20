# components-lib — pure stateless render functions

Every visible UI piece in PyaServ should live here as a pure function:

```ts
type RenderFn<P> = (props: P) => string  // returns HTML string
```

**Rules:**

1. **Stateless.** No closures over external state, no `let` reading from outside.
2. **Pure.** Same props → same HTML, every time.
3. **Atomic.** Atoms have no dependencies on other atoms beyond shared CSS classes. Molecules compose atoms via string concat. Organisms compose molecules.
4. **No fetch.** No `apiFetch`, no `localStorage`, no `Date.now()`. Data is passed in as props.
5. **Escape HTML.** Any string-typed prop is escaped at the boundary (use `escapeHtml`).
6. **i18n-ready.** Strings are passed in as props (already translated by caller), NOT looked up here.

**Levels:**
- `atoms/` — Button, BadgePill, AvatarCircle, Spotlight, Icon
- `molecules/` — FeatureCard, ServiceItem, QuestRow, BadgeTile, MetricCell
- `organisms/` — ProfileHeader, GameHUD, CompletenessBar, ProfilePublicView

**Why this matters:**
- `/components/` route renders each one in isolation with a prop-tweaker panel — instant visual QA + localization debugging.
- Demo Mode v2 reuses the SAME functions — just feeds them canned data.
- Onboarding tour anchors to elements rendered by these functions — same DOM structure as production.
