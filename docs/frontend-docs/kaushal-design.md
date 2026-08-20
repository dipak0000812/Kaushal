---
version: v2
name: Kaushal-design-system
description: "A trust-first verified-internship platform for a college's students, companies, faculty mentors, T&P cell, and HOD. Light-leaning neutral surfaces, a confident GHR-purple brand accent, an orange secondary accent for key CTAs. Two separate color tracks carry the product's information: a verification/status track (company verification, offer verification, evidence review) and a distinct risk track (live-computed HIGH/MEDIUM/dismissed) — the two must never share hues, since a risk flag and a verification state can be true on the same application at the same time and need to read as different kinds of fact. Typography is a clean, highly legible sans (Inter). Cards and tables are the primary surface."

colors:
  primary: "#5B21B6"
  primary-hover: "#4C1D95"
  primary-focus: "#6D28D9"
  on-primary: "#FFFFFF"
  accent: "#EA580C"
  accent-hover: "#C2410C"
  on-accent: "#FFFFFF"
  ink: "#0F172A"
  ink-muted: "#475569"
  ink-subtle: "#94A3B8"
  canvas: "#F8FAFC"
  surface-1: "#FFFFFF"
  surface-2: "#F1F5F9"
  surface-3: "#E2E8F0"
  border: "#E2E8F0"
  border-strong: "#CBD5E1"
  inverse-canvas: "#0F172A"
  inverse-ink: "#F8FAFC"
  # Verification / status track — company verification, offer verification, evidence review
  status-verified: "#16A34A"
  status-verified-bg: "#DCFCE7"
  status-pending: "#D97706"
  status-pending-bg: "#FEF3C7"
  status-review: "#0EA5E9"
  status-review-bg: "#E0F2FE"
  status-flagged: "#DC2626"
  status-flagged-bg: "#FEE2E2"
  # Lifecycle stepper track — the 12-state application timeline (distinct from the 4-state verification track above)
  stage-open: "#64748B"
  stage-open-bg: "#F1F5F9"
  stage-active: "#5B21B6"
  stage-active-bg: "#EDE9FE"
  stage-success: "#16A34A"
  stage-success-bg: "#DCFCE7"
  stage-terminal-negative: "#94A3B8"
  stage-terminal-negative-bg: "#F1F5F9"
  # Risk track — live-computed only, visually unrelated to both tracks above
  risk-high: "#B91C1C"
  risk-high-bg: "#FEE2E2"
  risk-medium: "#B45309"
  risk-medium-bg: "#FEF3C7"
  risk-dismissed: "#64748B"
  risk-dismissed-bg: "#F1F5F9"

typography:
  display-lg:
    fontFamily: Inter
    fontSize: 40px
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: -0.8px
  display-md:
    fontFamily: Inter
    fontSize: 30px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: -0.4px
  headline:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: -0.2px
  card-title:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: 0
  body:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: 0
  caption:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 0.2px
  button:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: 0
  table-header:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: 0.3px
  mono:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0

rounded:
  xs: 4px
  sm: 6px
  md: 8px
  lg: 12px
  xl: 16px
  pill: 9999px
  full: 9999px

spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
  section: 80px

components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: 10px 16px
  button-accent:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: 10px 16px
  button-secondary:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: 10px 16px
  button-danger:
    backgroundColor: "{colors.status-flagged}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: 10px 16px
  status-badge-verified:
    backgroundColor: "{colors.status-verified-bg}"
    textColor: "{colors.status-verified}"
    typography: "{typography.caption}"
    rounded: "{rounded.pill}"
    padding: 4px 10px
  status-badge-pending:
    backgroundColor: "{colors.status-pending-bg}"
    textColor: "{colors.status-pending}"
    typography: "{typography.caption}"
    rounded: "{rounded.pill}"
    padding: 4px 10px
  status-badge-review:
    backgroundColor: "{colors.status-review-bg}"
    textColor: "{colors.status-review}"
    typography: "{typography.caption}"
    rounded: "{rounded.pill}"
    padding: 4px 10px
  status-badge-flagged:
    backgroundColor: "{colors.status-flagged-bg}"
    textColor: "{colors.status-flagged}"
    typography: "{typography.caption}"
    rounded: "{rounded.pill}"
    padding: 4px 10px
  stepper-node-open:
    backgroundColor: "{colors.stage-open-bg}"
    textColor: "{colors.stage-open}"
    rounded: "{rounded.full}"
  stepper-node-active:
    backgroundColor: "{colors.stage-active-bg}"
    textColor: "{colors.stage-active}"
    rounded: "{rounded.full}"
  stepper-node-success:
    backgroundColor: "{colors.stage-success-bg}"
    textColor: "{colors.stage-success}"
    rounded: "{rounded.full}"
  stepper-node-terminal-negative:
    backgroundColor: "{colors.stage-terminal-negative-bg}"
    textColor: "{colors.stage-terminal-negative}"
    rounded: "{rounded.full}"
  risk-badge-high:
    backgroundColor: "{colors.risk-high-bg}"
    textColor: "{colors.risk-high}"
    typography: "{typography.caption}"
    rounded: "{rounded.sm}"
    padding: 4px 10px
  risk-badge-medium:
    backgroundColor: "{colors.risk-medium-bg}"
    textColor: "{colors.risk-medium}"
    typography: "{typography.caption}"
    rounded: "{rounded.sm}"
    padding: 4px 10px
  risk-badge-dismissed:
    backgroundColor: "{colors.risk-dismissed-bg}"
    textColor: "{colors.risk-dismissed}"
    typography: "{typography.caption}"
    rounded: "{rounded.sm}"
    padding: 4px 10px
  internship-card:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: 20px
  data-table:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: 0
  text-input:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: 10px 12px
---

# Kaushal Design System (v2)

## What changed from the old `design.md` (TrackWise) — and why it had to

The previous file was written for a different assumed product (`TrackWise`, "Next.js + Supabase") with three roles (student / mentor / industry partner) and a single four-state verification badge. Kaushal is neither of those things, and the mismatch wasn't cosmetic:

1. **Backend.** Old doc: "Next.js + Supabase dashboard product." Actual: **custom Node/Express/MongoDB**, contract-first via `docs/api/API_CONTRACTS.md`. This didn't affect tokens directly but the doc's framing needed correcting so nobody builds against a Supabase client that doesn't exist.
2. **Roles.** Old doc assumed 3 roles. Kaushal has **5**: student, company, faculty, T&P, HOD — each with different scoping and edit authority (see the permission matrix in `API_CONTRACTS.md` §3). The old doc's "role-based view differences... haven't been separately audited" gap is exactly the gap that mattered here.
3. **The single status track doesn't cover the application lifecycle.** The old 4-state verification badge (verified/pending/in-review/flagged) fits *some* Kaushal states (company verification is genuinely a 2-state subset of it: pending/verified). But the application itself moves through a **12-state lifecycle** (`applied → shortlisted → offered → accepted → tnpVerified → mentorPending → mentorAssigned → inProgress → completed`, plus `rejected/withdrawn/cancelled`) that a 4-badge system can't express — you'd either collapse distinct states into one color or invent ad-hoc colors per screen, both of which break the "status colors are locked" rule the old doc itself sets. **v2 adds a separate stepper track** (`stage-open/active/success/terminal-negative`) for this, and keeps the original 4-badge track for the things that actually are 4-state (company verification, evidence review).
4. **Risk needed its own track entirely.** Kaushal's risk model (`API_CONTRACTS.md` §2, "Risk flag") is live-computed HIGH/MEDIUM, with a `Dismissal` state — and critically, a risk flag and a verification state can be true on the *same application at the same time* (an `inProgress` application can be simultaneously HIGH risk and have verified evidence). Reusing the verification-red for risk-red would make those two independent facts look like one signal. **v2 adds `risk-high/medium/dismissed`**, deliberately desaturated relative to `status-flagged` so a risk badge never gets mistaken for a verification failure at a glance. This is the "separate treatments for the status stepper and risk badges" split called for during planning.

Everything else — the purple/orange brand pair, typography, spacing, elevation, shape tokens, and the general "calm institutional tool, not a marketing page" direction — still applies unchanged and is repeated below for completeness.

## Brand
- Product: Kaushal (GHR Inter-Track Hackathon)
- Audience: students, companies, faculty mentors, the T&P cell, and HODs — five roles, not three
- Product surface: authenticated dashboard web app (light-mode primary), Next.js frontend against a custom Node/Express/MongoDB API
- Core job: make eligibility, offer status, and risk each instantly legible **as distinct facts**
- Brand alignment: primary and accent colors are drawn from GH Raisoni College's own palette (purple/orange)

## Colors
- **Primary (#5B21B6):** Primary actions, active nav, links.
- **Accent (#EA580C):** Secondary CTA color — standout creation actions only ("Post Internship," "Add Student"). Never for status, stage, or risk.
- **Ink / Ink Muted / Ink Subtle:** Three-step text hierarchy.
- **Canvas / Surface 1/2/3 / Border:** Same neutral ladder as before.
- **Verification track (`status-*`):** company verification, evidence review — genuinely 4-state or a 2-state subset of it (company account is only ever pending/verified; don't build a 4-option badge for a 2-option fact).
- **Lifecycle stepper track (`stage-*`):** the 12-state `<StatusStepper>`. Four buckets, not twelve colors: `stage-open` (not yet reached), `stage-active` (current step), `stage-success` (`completed`), `stage-terminal-negative` (`rejected`/`withdrawn`/`cancelled` — deliberately neutral gray, not red, since these are often a normal/expected outcome, e.g. declining a second offer after accepting another, not a failure).
- **Risk track (`risk-*`):** HIGH/MEDIUM/dismissed only. Never appears in the same badge shape as `status-*` (pill) — risk badges use `{rounded.sm}` instead of `{rounded.pill}` as an additional non-color differentiator, so the distinction survives grayscale/colorblind rendering too.

Status colors, stage colors, and risk colors are three separate reserved sets — none of the three is ever reused for the other two, and none is ever reused for generic UI feedback (toasts, form validation, etc).

## Typography, Layout & Spacing, Elevation, Shapes
Unchanged from the original TrackWise doc — Inter throughout, 4px base spacing scale, hairline-border elevation ladder (no heavy shadows/gradients), same `rounded` token set. See token values in the frontmatter above.

## Components — additions in v2
- **`<StatusStepper>`** uses `stepper-node-open/active/success/terminal-negative`, connected by a `{colors.border}` line that fills with `stage-active`/`stage-success` as steps complete — same visual grammar as the old verification timeline, different token set.
- **`<RiskBadge>`** uses `risk-badge-high/medium/dismissed`, square-ish (`{rounded.sm}`) rather than pill-shaped, positioned next to (not inside) any `<StatusStepper>` or `status-badge-*` on the same card so the two tracks never visually merge into one badge cluster.
- **Company verification** keeps using `status-badge-verified`/`status-badge-pending` from the original 4-badge set — no new token needed, it's a real subset.

## Do's and Don'ts — v2 additions
### Do
- Treat "what stage is this application at," "is this account/evidence verified," and "is this application at risk" as three independently-true facts, each with its own token track.
- Use `stage-terminal-negative` (gray) for `rejected`/`withdrawn`/`cancelled` — resist the urge to make these red; several of those transitions are routine, not failures.

### Don't
- Don't put a risk badge inside a `<StatusStepper>` node, and don't color a stepper node using a `risk-*` token, even if the application happens to currently be flagged.
- Don't add a fifth verification state to accommodate the lifecycle — that's what the separate stepper track is for.

## Known gaps (carried over, still open)
- Email/notification templates not yet specified.
- No dark theme defined.
- Empty/error-state illustrations not yet designed.
- Faculty vs. T&P vs. HOD information-density needs still share the same table/card density defaults — untested at scale for the two data-heaviest roles (T&P analytics, faculty at-risk list).