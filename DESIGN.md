# FastDeal Design Guide

All shared values (colours, fonts, type sizes, border width, corner radius) live in one file: `src/assets/tokens.css`. Change a value there and every page updates. In any stylesheet or component, use the variable, for example `color: var(--fd-blue)`, never a raw hex code or pixel value. `src/assets/app.css` holds the component styles that use these tokens.

The look is fresh and friendly: deep blue as the main colour on a warm beige base, with vanilla yellow as the accent, and tea green kept for results. Flat colour blocks, rounded shapes, and no gradients.

## Logo

The logo is the `FdLogo` component in `src/components/FdLogo.vue`. It is built from live text and CSS, so it always uses the brand font.

- Wordmark: "FAST" and "DEAL" in Anton, uppercase, leaning forward slightly for speed.
- Three vanilla speed lines sit to the left of the wordmark.
- On blue backgrounds (`<FdLogo />`, the default): "FAST" is beige and "DEAL" is vanilla.
- On light backgrounds (`<FdLogo tone="on-light" />`): the wordmark is all blue. The speed lines stay vanilla.
- Set its size with `font-size` on the parent. Everything inside scales with it.
- Do not stretch it, recolour it outside these two tones, or put it on vanilla or green.

## Icons

Icons are the `FdIcon` component in `src/components/FdIcon.vue`: simple line icons (2px stroke, 24px grid) that take the current text colour. Add new icons there.

| Icon | `name` | Used for |
|---|---|---|
| Basket | `basket` | Wishlist |
| Moon | `moon` | Sleep on it |
| Account | `account` | Log in |
| Log out arrow | `logout` | Log out |

In the navbar, Wishlist, Sleep, and Log in / Log out show as icons only on desktop, with the text label hidden but still read by screen readers. In the phone menu the label shows next to the icon. Every icon link has a `title` so hovering shows its name.

## Landing page

`/` is the landing page (`src/views/LandingView.vue`), where the logo links. The search tool lives at `/search`. The layout is editorial and data-led, like a printed report, while keeping FastDeal's colours and fonts:

- **Hero:** fills at least the first screen below the navbar (`100svh` minus `--fd-nav-height`), with its content centred vertically, so the footer only appears after scrolling. A beige split. Left: small blue eyebrow, huge blue Anton headline with the key words on a vanilla highlighter stripe (a block centred behind the capitals, sized in em so it scales with the headline), one short paragraph, and the two standard buttons ("Start comparing", "See what's trending").
- **Analytics cards (right):** three cards built from real catalogue data, so the hero shows what the product actually does:
  - **Price history:** 14-day line chart (2px blue line, vanilla area, dashed average line, green dot on the 14-day low, blue dot on today). Hovering or tapping shows a crosshair and a tooltip with the date and price.
  - **You save:** the gap between the cheapest and priciest store as one big number, with a green "Cheapest" chip.
  - **Extra you'd pay vs cheapest:** one bar per store in clay red, starting from zero, with the value written beside each bar.
  - From 1200px wide the cards overlap in a cluster. On every screen size they fan out to the right as you scroll, one after another: the small store-bars card first, then "You save", then the big chart. Each eases in and out and glides toward the scroll position, so the motion stays soft. All three are off screen once the hero has scrolled past (off when the device asks for reduced motion). Between 768px and 1199px the chart sits beside the two smaller cards. On phones they stack.

Pages marked `meta: { fullBleed: true }` in the router skip the default page container so their bands can run edge to edge.

The navbar is sticky on every page: it stays pinned to the top while you scroll.

Every page ends with the footer (`src/components/FdFooter.vue`) on dark blue: logo, tagline, course line (IS216 Web Application Development II, section and team name), the team members, and a © year line. Names, section, and team name are read from `data/proposal.json`, so the footer updates if the proposal changes. Every page's main area is at least one screen tall (below the navbar), so the footer is never visible on first load; you scroll down to reach it.

## Colours

All colours are CSS variables in `src/assets/tokens.css`.

| Name | Variable | Hex | Use it for |
|---|---|---|---|
| Deep blue (main) | `--fd-blue` | `#27508a` | Navbar, primary buttons, page titles, links, price history bars |
| Blue dark | `--fd-blue-dark` | `#1d3f6e` | Hover and pressed state of blue buttons |
| Beige | `--fd-beige` | `#f4ede3` | Page background, text on blue |
| Paper | `--fd-paper` | `#fbf8f3` | Cards, tables, inputs |
| Vanilla (accent) | `--fd-vanilla` | `#fae8a4` | Welcome pop-up, "DEAL" and speed lines in the logo, active nav underline |
| Vanilla soft | `--fd-vanilla-soft` | `#fcf2cc` | Table headers, neutral alerts |
| Vanilla line | `--fd-vanilla-line` | `#e8d9ad` | Borders on cards, tables, inputs, and alerts |
| Tea green (results) | `--fd-green` | `#b3c77a` | "Cheapest" badge |
| Green soft | `--fd-green-soft` | `#d8e4b4` | Cheapest table row |
| Clay red (results) | `--fd-red` | `#edb0a2` | Reserved, not used yet. Pair with green for bad results, such as the priciest listing or a price that went up |
| Red soft | `--fd-red-soft` | `#f4d9cf` | Reserved, not used yet. Row or panel background for a bad result |
| Drab dark | `--fd-ink` | `#343b1b` | Body text, section titles |
| Muted text | `--fd-text-muted` | `#585f3e` | Subtitles and captions |

Contrast is checked against WCAG AA (4.5:1 for body text, 3:1 for large text):

- Ink on beige: 10.1:1
- Muted text on beige: 5.8:1
- Blue on beige, and beige on blue: 7.0:1
- Blue on vanilla, and vanilla on blue: 6.6:1
- Ink on vanilla: 9.6:1
- Ink on tea green: 6.4:1
- Ink on clay red: 6.3:1

Rules:

- Blue is the main colour. Vanilla is the accent, so use it for small areas and highlights, not whole pages.
- Tea green is only for results: marking the best deal (the "Cheapest" badge and row). Do not use it for decoration, so green always means "this is the one".
- Clay red is green's opposite for bad results. It matches green's lightness, so the two read as a pair. Like green, never use it for decoration, and always put ink text on it.
- Text on vanilla or green is ink or blue, never beige or white, because the contrast is too low.
- Keep the verdict colours (green, amber, red) only for Worth It / Maybe / Not Worth It and for errors.
- Use the Bootstrap classes the app already uses (`btn-dark`, `btn-outline-dark`, `card`, `table`). They are restyled to this palette, so you do not need extra colour classes. (`btn-dark` is blue now, despite the name.)

## Fonts

Loaded from Google Fonts in `index.html`.

| Font | Variable | Use it for |
|---|---|---|
| Anton, uppercase | `--fd-font-display` | Page titles, section titles, nav links (including Log in / Log out, which are plain nav links, not buttons), table headers, eyebrow labels, and the FastDeal logo. Heavy and condensed, so keep it to short headings, never sentences. |
| DM Sans | `--fd-font-body` | Everything else: page subtitles, body text, buttons, forms |

Only two fonts: a loud condensed sans for headings and labels, and a plain sans for everything you read in sentences.

Buttons are pill shaped (fully rounded). Cards are rounded at 1rem.

Every border is the same thickness: 2px, set once as `--fd-border` in `src/assets/tokens.css`. That covers cards, tables, inputs, buttons, checkboxes, alerts, and the verdict box. Do not add thicker accent borders; to show meaning, change the border colour instead (the verdict box border is green, amber, or red).

## Typography

Base size is 16px (1rem). All sizes live as CSS variables in `src/assets/tokens.css`. Use the classes below instead of Bootstrap's `h1` to `h6` size classes, so every page matches.

| Level | Use it for | Size (phone / 768px and up) | Font and weight | Colour | Class |
|---|---|---|---|---|---|
| Page title | One per page: "Log in", "Trending", "Wishlist" | 36px / 48px | Anton, uppercase | `--fd-text` | `<h1 class="fd-page-title">` |
| Page subtitle | The line under the page title that explains the page | 18px | DM Sans 400 | `--fd-text-muted` | `<p class="fd-page-subtitle">` |
| Section title | Blocks inside a page: "Price history", "Searched with this" | 24px / 28px | Anton, uppercase | `--fd-text` | `<h2 class="fd-section-title">` |
| Section subtitle | Card titles and product names | 18px | DM Sans 700 | `--fd-text` | `<h3 class="fd-section-subtitle">` |
| Body | Paragraphs, table cells, inputs, buttons | 16px | DM Sans 400 | `--fd-text` | no class needed |
| Small / caption | Hints, timestamps, form labels, demo info | 14px | DM Sans 400 | `--fd-text-muted` | `class="small text-secondary"` |

### Size variables

```css
--fd-page-title: 2.25rem;      /* 3rem from 768px */
--fd-page-subtitle: 1.125rem;
--fd-section-title: 1.5rem;    /* 1.75rem from 768px */
--fd-section-subtitle: 1.125rem;
--fd-body: 1rem;
--fd-small: 0.875rem;
```

### Rules

- One `<h1>` per page. Do not skip heading levels (h1, then h2, then h3). To make a heading look smaller, change its class, not its tag. A card heading directly under the page title can be `<h2 class="fd-section-subtitle">`.
- Line height: 1.5 for body text, about 1.05 to 1.1 for Anton titles (it is tall and condensed), 1.5 for subtitles.
- Nothing on screen smaller than 14px. Form inputs stay at 16px or larger so iOS does not zoom in when they are tapped.
- Muted grey is only for subtitles and captions. Titles and body text use the dark colour.
- Use `small` only for secondary information. Main card or paragraph content is body size.
