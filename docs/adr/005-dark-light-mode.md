# ADR-005: Dark/Light Mode via CSS Custom Properties

**Status:** Accepted

## Context

Event operators use Surket in varied lighting conditions — dim conference halls, bright offices, outdoor venues. The UI must adapt without requiring a page reload or backend round-trip. The implementation must:

- Support **dark**, **light**, and **system** (follows OS preference) modes
- Persist the user's choice across sessions and reloads
- Work cohesively with the 5 accent themes (Aurora, Ember, Forest, Violet, Rose)
- Add zero backend writes — operators shouldn't need an account or database entry for a UI preference
- Transition smoothly without flash-of-wrong-theme on page load

## Decision

Use **CSS custom properties** (variables) with an **HTML attribute** (`data-color-mode`) as the switching mechanism:

### Architecture

```
settings.tsx (localStorage)
    ↓ resolveColorMode()
    ↓ applyToBody()
    ↓
<html data-color-mode="dark|light">
    ↓
styles.css: :root { --bg: #0b0e14; ... }
            [data-color-mode="light"] { --bg: #f5f6f8; ... }
    ↓
All components consume var(--bg), var(--text), var(--accent), etc.
```

### Key Implementation Points

1. **Variable scoping**: Dark variables on `:root`, light variables on `[data-color-mode="light"]`. CSS specificity ensures light overrides dark when active.

2. **System detection**: `window.matchMedia("(prefers-color-scheme: light)").matches` detects OS preference. A `change` event listener re-applies when the user toggles their OS setting.

3. **Persistence**: `localStorage` key `surket.settings` stores the full `OperatorSettings` object including `colorMode: "dark" | "light" | "system"`.

4. **Theme contrast overrides**: Each accent theme has a light-mode variant with higher contrast for readability on white backgrounds:
   ```css
   .theme-aurora { --accent: #6ea8fe; }
   [data-color-mode="light"] .theme-aurora { --accent: #3b7ddd; }
   ```

5. **Quick toggle**: A sun/moon button in the topbar cycles between dark and light, bypassing "system" for immediate control.

6. **Full control**: The Settings page offers a segmented Dark / Light / System control with icons.

7. **Meta tag sync**: `<meta name="theme-color">` updates to match the active mode, ensuring mobile browser chrome matches the app background.

8. **Smooth transitions**: `transition: background .35s ease, color .25s ease` on body, sidebar, topbar, and cards prevents jarring mode switches.

### Files Involved

| File | Role |
|------|------|
| `web/src/styles.css` | CSS variables for both modes, theme overrides, transitions |
| `web/src/lib/settings.tsx` | `ColorMode` type, `resolveColorMode()`, `applyToBody()`, system listener |
| `web/src/components/Layout.tsx` | Theme toggle button in topbar |
| `web/src/pages/Settings.tsx` | Full color mode segmented control |
| `web/src/components/icons.tsx` | `IconSun`, `IconMoon`, `IconMonitor` SVG icons |
| `web/index.html` | Initial `theme-color` meta tag |

## Consequences

- **Positive**: Zero JavaScript needed at render time — CSS handles all visual switching. The JS only sets the attribute.
- **Positive**: No flash-of-wrong-theme — `applyToBody()` runs synchronously in the React `useEffect`, and the default is dark, which matches the initial `:root` variables.
- **Positive**: System preference is respected automatically — users who set their OS to dark/light get the matching mode without configuration.
- **Positive**: Works identically on all hosts — no server-side rendering or cookies needed. Pure client-side.
- **Positive**: Easy to add new themes — define new CSS variables under a `.theme-*` class and add a light-mode override.
- **Negative**: Cannot use `prefers-color-scheme` media query directly in CSS because the user's explicit choice (dark/light) must override system preference. The `data-color-mode` attribute approach solves this.
- **Negative**: Some third-party components (e.g., embedded iframes) may not respect the custom properties. Mitigated by keeping the app self-contained (no iframes).
- **Negative**: Light mode required tuning every accent theme for contrast. Dark mode colors that look vibrant on dark backgrounds become washed-out on white. Each theme needed hand-tuned light-mode values.

## Alternatives Considered

| Alternative | Why Rejected |
|-------------|-------------|
| CSS-in-JS library (styled-components, emotion) | Adds bundle size, runtime overhead, and SSR complexity. CSS custom properties are native and zero-cost. |
| Separate CSS files per mode | Doubles CSS payload, requires file-level switching logic, harder to maintain shared variables. |
| `prefers-color-scheme` only (no manual override) | Users can't override their OS setting for just this app. Conference presenters often need dark mode in bright rooms. |
| Server-side theme cookie | Adds backend coupling, requires cookie parsing on every request, unnecessary for a purely visual preference. |
| Class-based switching (`body.dark` / `body.light`) | Works but requires toggling many classes. A single attribute on `<html>` is cleaner and more specific. |
