# Visitor Counter design system

## 0. Research log
Operational admin screen. References considered: Notion, Linear, GitHub.
Selected Notion's readable neutral surfaces with taste-skill restraint and layout-skill document scroll.
Live design research and visual showcase are blocked: browser bridge is disconnected and shell DNS is unavailable.
Image concepts are omitted for this small operational interface; no illustrative assets are required.

## 1. Atmosphere & identity
A quiet registry for small websites: left-aligned title, numbered registration steps, compact site list and readable code output.

## 2. Color
CSS tokens: background #f6f5f4, surface #ffffff, ink #202020, muted #615d59,
border #d9d6d2, accent #075fae, accent-hover #064d8c, error #a51e28, success #166534.
Accent is reserved for the primary action and keyboard focus.

## 3. Typography
System sans-serif with Korean system fallback; monospace for code. Body 16px/1.6;
small 14px; section title 22px; page title clamp(28px,4vw,40px). Headings use keep-all.

## 4. Spacing & layout
4px base. Tokens 8/12/16/24/32/48px. Content width 1080px.
Document owns vertical scrolling. At 768px the registration/list columns collapse.
Code wraps long strings and is selectable. No fixed viewport height or nested vertical scroll region.

## 5. Components
Panel: white surface, border, 12px radius, 24px padding.
Field: visible label, optional hint, full-width input, 8px radius, minimum 44px height.
Button: primary/secondary variants, 44px minimum height; hover, pressed, focus-visible,
disabled and pending states. Status: inline live region, error/success text.
Site entry: heading, URL, metric labels, editable registration form and code region.
Code region: readonly textarea, copy button and copy-failure fallback through manual selection.
Empty state: explains registration; loading and error states remain explicit.
Management controls: password-change details with current/new/confirmation fields;
site active-state button with confirmation; last collection timestamp as plain text.
History: progressive disclosure, 7/30-day buttons with aria-pressed, daily table with
native meter bars plus exact visitor/view values. No chart dependency or inline style needed.

## 6. Motion & interaction
No decorative animation. Buttons give immediate disabled/pending feedback.
Keyboard navigation follows document order. Logout removes current server session.

## 7. Depth & surface
Borders-only depth. Radius scale: controls 8px, panels 12px. No hero illustrations or shadow cards.

## 8. Accessibility & verification gaps
Target WCAG AA: visible labels, focus outline, semantic headings, live status,
readable contrast, no layout-dependent content, responsive single column.
Real-browser screenshots, mobile layout and Lighthouse remain unverified until the browser bridge works.
