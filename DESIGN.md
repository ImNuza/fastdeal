# FastDeal Design Guide

How FastDeal looks and how to keep it consistent when you add or change a page. The look: deep blue as the main colour on a warm beige base, vanilla yellow as the accent, tea green kept for results. Flat colour, rounded shapes, no gradients.

## Quick start: adding or editing a page

1. Start the page with the standard title block:

   ```html
   <h1 class="fd-page-title">Trending</h1>
   <p class="fd-page-subtitle">One line that explains what this page is for.</p>
   ```

2. Use the Bootstrap classes the app already uses: `card`, `table`, `form-control`, `btn btn-dark` (main action), `btn btn-outline-dark` (second action). They are already restyled to FastDeal's colours, so do not add your own colours to them.
3. For any colour, size, or border in your own CSS, use a variable from `src/assets/tokens.css`, for example `color: var(--fd-blue)` or `font-size: var(--fd-small)`. Never type a hex code or pixel size directly.
4. Use the heading classes in the [Typography](#typography) table, not Bootstrap's `h1` to `h6` or `display-*` classes.
5. Check the page at phone width (390px) as well as desktop.

## Where things live

| File | What it holds |
|---|---|
| `src/assets/tokens.css` | Every shared value: colours, fonts, type sizes, border width, corner radius. Change a value here and the whole app updates. |
| `src/assets/app.css` | App-wide styles that use the tokens: type classes, navbar, cards, tables, buttons, forms, welcome prompt. |
| `src/components/FdLogo.vue` | The FastDeal logo. |
| `src/components/FdIcon.vue` | Navbar icons (basket, moon, account, log out). |
| `src/components/FdFooter.vue` | The footer on every page. |
| `src/App.vue` | Navbar, welcome prompt, page shell. |
| `src/views/LandingView.vue` | The landing page at `/`. Its page-only styles sit at the bottom of the file. |
| `index.html` | Loads Bootstrap and the Google Fonts. |

## Colours

| Name | Variable | Hex | Use it for |
|---|---|---|---|
| Deep blue (main) | `--fd-blue` | `#27508a` | Navbar, main buttons, page titles, links, chart lines and bars |
| Blue dark | `--fd-blue-dark` | `#1d3f6e` | Hover state of blue buttons, footer background |
| Beige | `--fd-beige` | `#f4ede3` | Page background, text on blue |
| Paper | `--fd-paper` | `#fbf8f3` | Cards, tables, inputs, the welcome prompt |
| Vanilla (accent) | `--fd-vanilla` | `#fae8a4` | Highlights: "DEAL" and speed lines in the logo, active nav underline, the stripe behind "BEST DEAL" |
| Vanilla soft | `--fd-vanilla-soft` | `#fcf2cc` | Table headers, chart area fill, neutral alerts |
| Vanilla line | `--fd-vanilla-line` | `#e8d9ad` | Borders on cards, tables, inputs, and alerts |
| Tea green (results) | `--fd-green` | `#b3c77a` | "Cheapest" badge and chip |
| Green soft | `--fd-green-soft` | `#d8e4b4` | Cheapest table row |
| Clay red (results) | `--fd-red` | `#edb0a2` | Bad results, such as "extra you'd pay" bars |
| Red soft | `--fd-red-soft` | `#f4d9cf` | Reserved for a bad-result row or panel background |
| Ink | `--fd-ink` | `#343b1b` | Body text, section titles |
| Muted text | `--fd-text-muted` | `#585f3e` | Subtitles, captions, labels |

The Worth It / Maybe / Not Worth It verdict box uses its own green, amber, and red border (`#2f6b47`, `#a8741a`, `#a3301f`). Keep those three for verdicts and errors only.

### Colour rules

- Blue is the main colour. Vanilla is an accent for small highlights, never a whole page or card background.
- Green and red mean results: green is "best deal", red is "costs you more". Never use them for decoration.
- Text on vanilla, green, or red is always ink or blue, never beige or white, because the contrast is too low.
- `btn-dark` is blue in this app, despite its name. It is the main action button.

Contrast is checked against WCAG AA (4.5:1 for body text):

| Pair | Contrast |
|---|---|
| Ink on beige | 10.1:1 |
| Muted text on beige | 5.8:1 |
| Blue on beige, beige on blue | 7.0:1 |
| Blue on vanilla | 6.6:1 |
| Ink on vanilla | 9.6:1 |
| Ink on tea green | 6.4:1 |
| Ink on clay red | 6.3:1 |

## Typography

Two fonts, loaded in `index.html`:

- **Anton** (`--fd-font-display`): heavy, condensed, always uppercase. For page titles, section titles, nav links, table headers, big numbers, and the logo. Short headings only, never sentences.
- **DM Sans** (`--fd-font-body`): everything you read in sentences, plus buttons, forms, and the small eyebrow labels.

Base size is 16px.

| Level | Use it for | Size (phone / 768px and up) | Font | Colour | Class |
|---|---|---|---|---|---|
| Page title | One per page: "Log in", "Trending", "Wishlist" | 36px / 48px | Anton | Blue | `<h1 class="fd-page-title">` |
| Page subtitle | The line under the page title | 18px | DM Sans 400 | Muted | `<p class="fd-page-subtitle">` |
| Section title | Blocks inside a page: "Price history" | 24px / 28px | Anton | Ink | `<h2 class="fd-section-title">` |
| Section subtitle | Card titles, product names | 18px | DM Sans 700 | Ink | `<h3 class="fd-section-subtitle">` |
| Eyebrow | Small capitals above a heading: "Welcome to FastDeal" | 14px | DM Sans 700, uppercase | Blue | `<p class="fd-eyebrow">` |
| Body | Paragraphs, table cells, inputs | 16px | DM Sans 400 | Ink | no class needed |
| Button | Text on every button | 16px (14px with `btn-sm`) | DM Sans 700 | per button | `btn ...` |
| Small / caption | Hints, timestamps, form labels | 14px | DM Sans 400 | Muted | `class="small text-secondary"` |

The size variables behind this table (in `tokens.css`):

```css
--fd-page-title: 2.25rem;      /* 3rem from 768px */
--fd-page-subtitle: 1.125rem;
--fd-section-title: 1.5rem;    /* 1.75rem from 768px */
--fd-section-subtitle: 1.125rem;
--fd-body: 1rem;
--fd-small: 0.875rem;
--fd-eyebrow: 0.875rem;
--fd-button: 1rem;
--fd-button-sm: 0.875rem;
```

### Type rules

- One `<h1>` per page, and do not skip levels (h1, then h2, then h3). To make a heading look smaller, change its class, not its tag.
- Nothing smaller than 14px. Form inputs stay at 16px so phones do not zoom in when tapped.
- Muted text is only for subtitles and captions. Titles and body text use ink.

## Shape

- **Borders:** every border is 2px (`--fd-border`): cards, tables, inputs, buttons, checkboxes, alerts. To show meaning, change the border colour, not its thickness.
- **Corners:** cards and tables 1rem (`--fd-radius`), landing analytics cards 1.25rem, buttons fully rounded (pill).
- **Shadows:** none on cards. Only the welcome prompt has a soft shadow, because it floats over the page.

## Components

### Buttons

| Button | Class | Use for |
|---|---|---|
| Main action | `btn btn-dark` | The one thing you want people to do: Search, Log in, Save |
| Second action | `btn btn-outline-dark` | The alternative: Continue as guest, Sleep on it |
| Small | add `btn-sm` | Chips and buttons inside tables |
| Big | add `fd-btn-lg` | 52px tall, for heroes and the welcome prompt |

Use at most one main-action button in each area. A minor option (like "Create an account" under Log in) is a text link, not a button.

### Logo

`<FdLogo />` from `src/components/FdLogo.vue`. Built from live text, so it always uses Anton.

- On blue (the default): "FAST" in beige, "DEAL" in vanilla, vanilla speed lines.
- On light backgrounds: `<FdLogo tone="on-light" />`, all blue.
- Set its size with `font-size` on the element around it. Do not stretch it or recolour it.

### Icons

`<FdIcon name="..." />` from `src/components/FdIcon.vue`. Line icons that take the current text colour. Add new ones there.

| Icon | `name` | Used for |
|---|---|---|
| Basket | `basket` | Wishlist |
| Moon | `moon` | Sleep on it |
| Account | `account` | Log in |
| Log out arrow | `logout` | Log out |

### Navbar

Blue, sticky (stays at the top while scrolling), in `App.vue`.

- Left: logo, then Search and Trending as text links in Anton.
- Right: Wishlist, Sleep, and Log in (or the user's email and Log out) as icons on desktop. In the phone menu each icon shows its text label.
- The current page gets a vanilla underline.
- Guests who tap Wishlist or Sleep are sent to the login page and brought back after logging in.

### Welcome prompt

The pop-up new visitors see, in `App.vue`.

- Shows on whichever page a visitor opens first, except Log in and Sign up. Guests see it again on their next visit (new tab or browser session). Logged-in users never see it.
- **Log in** (main button) goes to `/login`. **Continue as guest** (second button) closes it; guests can use Search, Compare, and Trending. **Create an account** (text link) goes to `/signup`.
- After logging in or signing up, people return to the page they started on.
- To see it again while testing, open an Incognito window.

### Footer

`src/components/FdFooter.vue`, dark blue, on every page: logo, tagline, course line (IS216 Web Application Development II, section, team), team members, and a centred © line. Names, section, and team come from `data/proposal.json`, so edit them there.

## Pages

- **Every page fills at least one screen** below the navbar, so the footer only shows after scrolling. This is automatic.
- **Edge-to-edge pages:** add `meta: { fullBleed: true }` to the route in `src/router/index.js` to skip the standard page container (the landing page does this).
- **Landing page (`/`):** a full-screen beige hero. Left: eyebrow, huge Anton headline with "BEST DEAL" on a vanilla stripe, a short paragraph, Start comparing and See what's trending buttons. Right: three analytics cards from the mock catalogue (14-day price chart with hover tooltip, "You save" figure, extra-you'd-pay bars per store). As you scroll, the cards slide out to the right one after another. The motion is off for people who turn on "reduce motion" on their device.
- **Search** lives at `/search`.
