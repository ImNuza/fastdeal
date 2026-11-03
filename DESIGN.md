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
| `src/components/FdIcon.vue` | Line icons for the navbar and the search bar. |
| `src/components/FdSearchBar.vue` | The search bar with recent searches, suggestions, and Search by photo. Full size in the Home hero; `compact` in the navbar on every other page. |
| `src/components/FdBreadcrumbs.vue` | The trail above a page title, in table header type (small bold capitals; the page you are on is blue and underlined): "FastDeal / Sony WH-1000XM5" on Compare, "FastDeal / Sony WH-1000XM5 / Shopee" on a product (the last item is the store the shopper clicked on Compare, or the product title without one). Every item but the last is a link. |
| `src/services/searchHistory.js` | A guest's last 5 searches, kept in the browser. Logged-in users get theirs from their account instead. |
| `src/services/itemName.js` | Shows a search term as a product name: "samsung galaxy s25" becomes "Samsung Galaxy S25". Use it wherever a search term is shown. |
| `src/components/FdTabs.vue` | Folder tabs and the card under them, as one piece. See [Lists in folder tabs](#lists-in-folder-tabs). |
| `src/components/FdListSearch.vue` | The search pill above a list (filter friends, notifications, the wishlist, budgets, users). |
| `src/components/FdScrollArea.vue` | A list that scrolls inside its card, with the brand scrollbar beside it. Add `fill` inside a tab card. |
| `src/components/FdAvatar.vue` | The blue circle with beige initials (Friends, Admin, Account) or an icon (Notifications). `size="lg"` for the Account header. |
| `src/components/FdGoogleButton.vue` | The Continue with Google button on Log in and Sign up. Its logo keeps Google's own colours, the only hex codes outside `tokens.css`. |
| `src/components/FdBelt.vue` | The auto-scrolling belt of cards (Home's Trending Today, Compare's "also viewed" on phones), so every belt rolls at the same speed and pauses the same way. |
| `src/components/FdEmptyState.vue` | An empty list: a blue icon and one short line, with an optional button under it. |
| `src/services/imgLoading.js` | `v-img-loading` on every product photo: a soft vanilla shimmer in its box until it loads (still for reduce motion). |
| `src/components/FdTotalBar.vue` | A bar under a list that sticks to the bottom of the screen (`stacked` centres page buttons in it). No page uses it at the moment. |
| `src/components/FdFooter.vue` | The footer on every page. |
| `src/App.vue` | Navbar, welcome prompt, page shell. |
| `src/mock/budget.js` | The Plan a budget logic on Wishlist: finds the best mix of items for a budget. |
| `src/views/LoginView.vue`, `SignupView.vue` | Log in and Sign up. Their pill-shaped inputs are styled at the bottom of each file. Log in also holds the Forgot password pop-up. |
| `src/views/HomeView.vue` | The home page at `/`: hero with search, values band, Trending Today, Trending This Week. Its page-only styles sit at the bottom of the file. |
| `index.html` | Loads Bootstrap and the Google Fonts. |

## Colours

| Name | Variable | Hex | Use it for |
|---|---|---|---|
| Deep blue (main) | `--fd-blue` | `#27508a` | Navbar, main buttons, all titles and headings, links, chart lines and bars |
| Blue dark | `--fd-blue-dark` | `#1d3f6e` | Hover state of blue buttons, footer background, tooltips |
| Beige | `--fd-beige` | `#f4ede3` | Page background, text on blue |
| Paper | `--fd-paper` | `#fbf8f3` | Cards, tables, inputs, the welcome prompt, the Home search bar and its suggestions |
| White | `--fd-white` | `#ffffff` | Only behind product photos (they come with white backgrounds), so the photo and its frame match. Every product photo uses `object-fit: contain` with a little padding, so it always shows whole and is never cropped |
| Vanilla (accent) | `--fd-vanilla` | `#fae8a4` | Highlights: "DEAL" and speed lines in the logo, active nav underline, the stripe behind "SMARTER" on Home, footer headings, the search bar focus ring |
| Vanilla soft | `--fd-vanilla-soft` | `#fcf2cc` | Table headers, chart area fill, neutral alerts, the highlighted search suggestion |
| Vanilla line | `--fd-vanilla-line` | `#e8d9ad` | Borders on cards, tables, inputs, and alerts |
| Tea green (results) | `--fd-green` | `#b3c77a` | "Cheapest" badge and chip |
| Green soft | `--fd-green-soft` | `#d8e4b4` | Cheapest table row |
| Clay red (results) | `--fd-red` | `#edb0a2` | Bad results, such as "extra you'd pay" bars |
| Green text | `--fd-green-text` | `#187447` | A good result written as text, such as "$20 lower" or "Sent!" |
| Red text | `--fd-red-text` | `#a24432` | A bad result written as text, such as "$20 higher" |
| Grey soft | `--fd-grey-soft` | `#ebe9e5` | Background of a Wishlist card on hold (Sleep on it) |
| Grey line | `--fd-grey-line` | `#d4d1cb` | Border of a Wishlist card on hold |
| Grey text | `--fd-grey-text` | `#5c5c5c` | The countdown on a Wishlist card on hold |
| Ink | `--fd-ink` | `#343b1b` | Body text only |
| Muted text | `--fd-text-muted` | `#585f3e` | Subtitles, captions, labels |

Tea green and clay red are too light for text, so a result written as text uses green text or red text instead. The Home hero cards use none of the result colours: only blue, vanilla, and the soft vanilla fill, so they stay calm.

### Colour rules

- Blue is the main colour. Vanilla is an accent for small highlights, never a whole page or card background.
- Green and red mean results: green is "best deal", red is "costs you more". Never use them for decoration.
- Text on vanilla, green, or red is always ink or blue, never beige or white, because the contrast is too low.
- `btn-dark` is blue in this app, despite its name. It is the main action button.
- No black and no ink backgrounds. Ink is for body text only; anything dark behind text (hover states, tooltips) is blue dark. The one place black appears is the soft shadow (`--fd-shadow`).
- For a see-through version of a colour, mix the token rather than typing an rgb value: `color-mix(in srgb, var(--fd-beige) 80%, transparent)`.

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
| Grey text on grey soft | 5.5:1 |
| Green text on beige | 5.0:1 |
| Red text on beige | 5.3:1 |

## Typography

Two fonts, loaded in `index.html`:

- **Anton** (`--fd-font-display`): heavy, condensed, always uppercase. For page titles, section titles, nav links, big numbers, and the logo. Short headings only, never sentences.
- **DM Sans** (`--fd-font-body`): everything you read in sentences, plus buttons, forms, table headers, and the small eyebrow labels.

Base size is 16px.

| Level | Use it for | Size (phone / 768px and up) | Font | Colour | Class |
|---|---|---|---|---|---|
| Page title | One per page: "Log in", "Trending", "Wishlist" | 36px / 48px | Anton | Blue | `<h1 class="fd-page-title">` |
| Page subtitle | The line under the page title | 17px (body size) | DM Sans 400 | Muted | `<p class="fd-page-subtitle">` |
| Section title | Blocks inside a page: "Price history" | 24px / 28px | Anton | Blue | `<h2 class="fd-section-title">` |
| Section subtitle | Card titles, product names | 17px (body size) | DM Sans 700 | Blue | `<h3 class="fd-section-subtitle">` |
| Eyebrow | Small capitals above a heading: "Welcome to FastDeal" | 14px | DM Sans 700, uppercase | Blue (Ink in the Home hero) | `<p class="fd-eyebrow">` |
| Table header | Column headings in every `table` and the Wishlist header pill (and the column labels inside Wishlist cards on smaller screens). Same size as button text | 14px | DM Sans 700, uppercase | Ink (beige on the blue Wishlist pill) | no class needed |
| Body | Paragraphs, table cells, inputs, card names, the footer tagline | 17px | DM Sans 400 | Ink | no class needed |
| Button | Text on every button, 48px tall (36px with `btn-sm`) | 14px, `btn-sm` too | DM Sans 700 | per button | `btn ...` |
| Small / caption | Hints, timestamps, form labels | 14px | DM Sans 400 | Muted | `class="small text-secondary"` |

The size variables behind this table (in `tokens.css`):

```css
--fd-page-title: 2.25rem;      /* 3rem from 768px */
--fd-page-subtitle: var(--fd-body);
--fd-section-title: 1.5rem;    /* 1.75rem from 768px */
--fd-section-subtitle: var(--fd-body);
--fd-body: 1.0625rem;  /* 17px */
--fd-small: 0.875rem;
--fd-eyebrow: 0.875rem;
--fd-table-header: 0.875rem;
--fd-button: 0.875rem;
--fd-button-sm: 0.875rem;
```

Every page follows these two rules. Bootstrap's `.small`, `.badge`, inputs, and input add-ons are pinned to them in `app.css`, and big numbers (prices, stats, the Sleep on it timer, verdict amounts) are Anton at a title size, never large DM Sans. Avatar initials are DM Sans, because the smallest Anton size does not fit their circles. Anton has only three sizes anywhere: the Home hero headline (`.fd-display`, 48px growing to 84px on wide screens), the page title size, and the section title size. Everything else in Anton uses one of the two title sizes: the "You save" amount is page title size; the hero graph's price, the values band titles, the footer "The team", and both logos (navbar and footer) are section title size. On the blue values band, titles and text are beige instead of blue or ink.

### Type rules

- One `<h1>` per page, and do not skip levels (h1, then h2, then h3). To make a heading look smaller, change its class, not its tag.
- DM Sans has two sizes only: body (17px) for normal text and small (14px) for everything secondary: captions, labels, tags, chart text, the eyebrow (which is the small size in capitals). Nothing smaller than 14px; inputs are body size, so phones do not zoom in when tapped.
- Muted text is only for subtitles and captions. Titles use blue, body text uses ink.

## Shape

- **Borders:** every border is 2px (`--fd-border`): cards, tables, inputs, buttons, checkboxes, alerts. To show meaning, change the border colour, not its thickness.
- **Corners:** cards and tables 1rem (`--fd-radius`), inputs 0.625rem, Home hero analytics cards and the welcome prompt 1.25rem, buttons and the Home search bar fully rounded (pill).
- **Padding:** every card and panel has the same inside padding, 20px (`--fd-card-pad`); for a Bootstrap `card`, add `fd-card-pad` instead of `p-3` or `p-4`. List rows inside a card (Wishlist rows, All listings rows) use `--fd-row-pad`, 12px top and bottom and 20px at the sides. A card that holds cards has a little more, 24px on all four sides (`--fd-panel-pad`; 16px on phones up to 576px): the folder-tab card (Wishlist, Friends, Notifications, Admin) and the product page's Worth it? and All listings cards. Small stat tiles (the Worth it? tiles) and the Admin leaderboard rows use `--fd-row-pad`, and the Admin stat cards and leaderboard use `--fd-card-pad`. The folder-tab card and on the three pages whose page scrolls it reaches the bottom of the screen from 768px however short the list (the card, the total under it, and the standard 64px gap fill exactly one screen; a longer list grows it and the page scrolls), while on phones it ends right after its last row. Pop-ups keep their own larger padding, and Friends and budget cards keep 14px by 16px so their trash icons line up with the search icon. Never type a padding for a single card; change the token.
- **Section gap:** two sections of a page (a section title and everything under it) are always 48px apart (`--fd-section-gap`). Give every section after the first the `fd-section-gap` class, and never end a section with a bottom margin (no `mb-5` on one section plus `mt-5` on the next), so the gap is the same on every page. The page header (title, subtitle, product hero) keeps its own spacing to the first section. Home's full-width bands keep their own padding.
- **Heights:** every button is 48px tall (`--fd-control`), or 36px with `btn-sm` (`--fd-control-sm`). Full-size search bars are a little shorter, 44px (`--fd-search`). Never set a height on a single button; change the token so every page moves together.
- **Shadows:** none on cards, except the front card of Home's Trending This Week deck. Only the search bar and its dropdown get a soft shadow, so they pop. Every full-size search bar (Home, Wishlist, Friends) is the same size: 44px tall (`--fd-search`), 17px text, 36px icon area, and its icon sits 18px in from the right edge, the same as the icon buttons at the end of a card (2px border plus 16px padding), so on Friends the search icon lines up with the trash icons; the Wishlist's sort box beside its search matches. Shadow: `--fd-shadow` (black at 15%). The welcome prompt keeps its own larger shadow.

## Components

### Buttons

| Button | Class | Use for |
|---|---|---|
| Main action | `btn btn-dark` | The one thing you want people to do: Search, Log in, Save |
| Second action | `btn btn-outline-dark` | The alternative: Continue as guest, Sleep on it, Continue with Google |
| Remove | `btn btn-outline-danger` | Deleting something: the trash button on Wishlist and Remove friend on Friends |
| Small | add `btn-sm` | 36px tall. Chips and buttons inside tables |
| Wide | add `fd-btn-lg` | Same 48px height, more room either side of the text. For heroes, pop-ups, and full-width form buttons |
| Icon only | add `fd-icon-btn` to a `btn-sm` | A 36px circle with just an icon, such as Remove or Decline. Always give it an `aria-label` |

Use at most one main-action button in each area. A minor option (like "Create an account" under Log in) is a text link, not a button.

### Lists in folder tabs

Friends, Notifications, Wishlist, and Admin's Manage Users are built from the same five pieces. A new page with a tabbed list should use them too, not copy another page's CSS. Their styles are in the "Lists in folder tabs" section of `app.css`.

```html
<div class="fd-list-page">
  <h1 class="fd-page-title">Friend List</h1>
  <p class="fd-page-subtitle">One line that explains what this page is for.</p>

  <FdTabs ref="tabsCard" v-model="activeTab" :tabs="tabs" label="Friends">
    <div class="fd-list-tools">
      <FdListSearch v-model="query" placeholder="Search your friends" label="Search your friends" />
      <div class="fd-sort">
        <label for="friend-sort">Sort by</label>
        <select id="friend-sort" v-model="sortBy" class="form-select">...</select>
      </div>
    </div>

    <FdScrollArea ref="scrollArea" fill label="Friends" :bar="rows.length > 0">
      <FdEmptyState v-if="!rows.length" icon="friends">No friends yet.</FdEmptyState>
      <div v-else>...one card per row...</div>
    </FdScrollArea>
  </FdTabs>

  <p v-if="listTotal > 0" class="fd-list-total">Total: 12 friends</p>
</div>
```

**Wishlist, Friends, Notifications, and Admin's Manage Users** show their whole list with `FdScrollArea page`: no box and no scrollbar inside the card, so the list runs its full length and the page itself scrolls (the search row and Wishlist's header pill run the full width, in line with the cards). No page buttons and no sticky bar: just "Total: 12 friends" in small muted text on the right, under the card (`.fd-list-total`).

The product page's **All stores** list works the same way: every listing, the page scrolling, and "Total: 10 listings" under the card.

**Paged list:** Compare's listings show **8 rows a page on every screen size** (`useListPages` in `src/services/listPages.js`), with `FdPager`'s page buttons centred under it, even for one page: Prev, the page numbers, and Next in a paper pill. A disabled Prev or Next fades to 40%. Under them, small and centred: "Showing 9 to 16 of 45 listings" (read out when the page changes). Changing the tab, search, filter, or sort goes back to page 1.

| Piece | What it does |
|---|---|
| `.fd-list-page` | Makes the page at least one screen tall, so a short list stretches the card down to the total bar. |
| `FdTabs` | The tabs and the paper card under them. `tabs` is `[{ id, label, count, countLabel }]`: a `count` above 0 shows the blue count bubble, and `countLabel` is what screen readers hear ("3 unread"). `v-model` is the open tab's id. Arrow keys move between tabs. `id-prefix` names the tab ids (`fd-tab` gives `fd-tab-requests`) when a page needs its own. `tabsCard.panel` is the card, for `FdPager`'s `top`. On phones the tabs share the width evenly and long labels wrap. |
| `.fd-list-tools` | The search and sort row. It ends where the cards end, so the scrollbar's column stays free. Each one gets a full row on phones. |
| `FdListSearch` | The search pill. `busy` swaps the icon for loading dots while a search is on its way. |
| `.fd-sort` | A muted "Sort by" (or "Show") label and a pill select as tall as the search. |
| `FdScrollArea fill` | The list fills the rest of the card and grows up to `--fd-list-max` (fits the screen, 20rem to 40rem), then scrolls inside with the brand scrollbar. The scrollbar only shows when the list is longer than its box (it keeps its room when hidden, so nothing shifts); its handle is a short pill, half the share of the list in view, between 10% and 25% of the track. On phones there is no box: the list runs its full length. Call `scrollArea.toTop()` when the tab changes. |
| `FdBelt` | `items` and an aria `label`; the slot draws each card from `{ item, tabindex }` and must put `tabindex` on the card's link, so only the first copy of each item is tabbable. Each item rolls past in 5 seconds, a short list repeats to at least 8 cards, and it pauses on hover, focus, or touch. |
| `FdEmptyState` | `icon` is an `FdIcon` name; the line goes in the slot. Anything after it, like the New budget button, goes in the `action` slot. |
| `FdTotalBar` | Sticks to the bottom of the screen and stops above the footer, so it must be the last thing in the page. `stacked` centres the phone page buttons with the count under them. |

### Shared small pieces

Defined once in `app.css`, so a colour or size change happens in one place:

- **AI tag** (`.fd-ai-tag`): a small vanilla pill reading "AI", beside the product page's Worth it? title and under an AI suggested target on the Wishlist.
- **Date range buttons** (`.fd-range` with `.fd-range-btn`, `.is-active` on the open one): 48px pills, blue when active. The Admin board and the Compare price history.
- **Change pill** (`.fd-delta`): "+5%" or "-2.1%" in ink. Add `is-good` (tea green), `is-bad` (soft red) or `is-flat` (vanilla). The page decides which way is good: more shoppers on the Admin board, a lower price on the Compare price history.
- **Photo boxes:** a square box around a product photo uses flex centring, never grid (`display: grid; place-items: center`), because in a grid the photo's `height: 100%` does not resolve and a tall photo is cut off at the bottom.

Pages other than Home load as their own file when opened (`src/router/index.js`), and the store price chart registers only the Chart.js parts it uses, so the first load stays small.

### Logo

`<FdLogo />` from `src/components/FdLogo.vue`. Built from live text, so it always uses Anton.

- "FAST" in beige, "DEAL" in vanilla, vanilla speed lines. It is made for blue backgrounds (navbar and footer), the only places it is used.
- Set its size with `font-size` on the element around it. Do not stretch it or recolour it.

### Icons

`<FdIcon name="..." />` from `src/components/FdIcon.vue`. Line icons that take the current text colour. Add new ones there.

| Icon | `name` | Used for |
|---|---|---|
| People | `friends` | Friends |
| Price tag | `tag` | Wishlist, and each Home search suggestion |
| Bell | `bell` | Notifications |
| Account | `account` | Log in, and the Account page once logged in (the icon stays the same) |
| Magnifier | `search` | Search button in the search bar |
| Camera | `camera` | Search by photo in the search bar |
| Clock | `clock` | Each recent search in the search bar's dropdown |
| Chevron up / down | `chevron-up`, `chevron-down` | The arrows in the Sleep on it time picker, and at each end of the Friends card's scrollbar |
| Moon | `moon` | Sleep on it buttons in the Wishlist table, and Decide on the Home values band |
| Sparkles | `sparkles` | Photo search (AI) on the Home values band |
| Scales | `scale` | Compare on the Home values band |
| Wallet | `wallet` | Plan on the Home values band |
| Trash | `trash` | Remove from Wishlist, Remove friend |
| Cross | `x` | Remove a recent search from the search dropdown |
| Check | `check` | Target reached, beside the target box on Wishlist |

Only keep icons something uses. Delete an icon from `FdIcon.vue` when its last use goes.

### Navbar

Blue, sticky (stays at the top while scrolling), in `App.vue`.

- Left: the logo, which links to Home.
- Beside the logo, on every page except Home (which has its own in the hero): the compact search bar. It sits faint and narrow on the blue; tapped, it turns paper and stretches across to the icons. Routes with `meta: { heroSearch: true }` hide it. Below 992px, while the hamburger shows, search is instead a plain beige search icon (no border, 44px) just left of the hamburger; tapping it opens the compact bar in a full-width row under the navbar, focused and ready to type, and the icon turns into a vanilla X to close it. Escape, opening the menu, or going to a new page closes it, and opening it closes the menu. The phone menu itself no longer holds a search bar.
- Right: Friends, Wishlist, Notifications, and Account as icons. The label always says Account. Logged out, it goes to Log in. Logged in, the same icon goes to the Account page (`/account`), which holds Log out. Log out asks first in the confirm pop-up (`FdConfirmDialog`): "Log out" (blue main button) or Cancel, which has focus so Escape or Enter backs out safely. On desktop each label shows as a tooltip on hover; in the phone menu each icon shows its text label.
- Exactly one icon gets the vanilla underline: the page you are on.
- Friends, Wishlist, Notifications, and Account need a login. A guest who taps one goes to `/login?next=...` and comes back after logging in or signing up. While they are on that login page, the icon they tapped keeps the underline, not Log in.

### Welcome prompt

The pop-up new visitors see, in `App.vue`.

- Shows on whichever page a visitor opens first, except Log in and Sign up. Guests see it again on their next visit (new tab or browser session). Logged-in users never see it.
- **Log in** (main button) goes to `/login`. **Continue as guest** (second button) closes it; guests can use Search, Compare, and Trending. **Create an account** (text link) goes to `/signup`.
- After logging in or signing up, people return to the page they started on.
- To see it again while testing, open an Incognito window.

### Forgot password pop-up

On the Log in page, "Forgot password?" opens a pop-up instead of a separate page. It reuses the welcome prompt's dialog styles (`.fd-entry-backdrop`, `.fd-entry-dialog`), so any other pop-up should too. It fills in the email already typed on the page, sends a Firebase reset link, and closes with Cancel (Done after sending), Escape, or a click outside.

### Footer

`src/components/FdFooter.vue`, dark blue, on every page: logo, tagline, course line (IS216 Web Application Development II, section, team), team members, and a centred © line. Names, section, and team come from `data/proposal.json`, so edit them there.

## Pages

- **Every page fills at least one screen** below the navbar, so the footer only shows after scrolling. This is automatic.
- **Same top gap on every page:** the standard page container (`.fd-page` in `app.css`) puts 40px between the navbar and the page title, and 64px between the end of the page and the footer. Do not add your own top or bottom padding to a page; change `.fd-page` so every page moves together.
- **Edge-to-edge pages:** add `meta: { fullBleed: true }` to the route in `src/router/index.js` to skip the standard page container (Home does this).
- **Home (`/`, also `/search`):** everything is in `src/views/HomeView.vue`, top to bottom:
  - **Hero**, about three quarters of the screen, on beige. Left: the eyebrow "Shop smart, not hard." in ink, the headline "SMARTER BUYS START HERE!" with "SMARTER" on a vanilla stripe, a short paragraph, and the search bar. Right: three calm cards that help a shopper decide where and when to buy, from our own data (`/api/home-stats`). Seed data stays in the database but is left out (seed accounts, and saved prices with no `source`). **Comparing pays** (the big card): this week's biggest saving, the product and day (with at least 3 real store prices) with the biggest gap between its cheapest and priciest store; it changes when a bigger gap is found. "Save S$…" (the priciest minus the cheapest), then three bars: that day's cheapest, median, and priciest store. **Next big sale** (top right): the next big double-day sale from `data/sale-calendar.js`, days away, and the stores that usually join. **Bottom right**: real **Price drops right now** (wishlist items 3% to 50% below their saved price; a bigger "drop" usually means a different listing), or, while there are none, **Most saved** (the 3 products on the most real users' wishlists). Keep these cards simple: one headline each, no dense charts. As you scroll, the cards slide out to the right one after another. The motion is off for people who turn on "reduce motion" on their device.
  - **Search bar** (`FdSearchBar`): a paper pill with Search by photo and Search icons inside. Tapped while empty, it shows the last 5 searches (the account's for logged-in users, this browser's for guests). Typing switches to matching catalogue products: the typed letters in bold blue, the cheapest price underneath. Arrow keys move through it, Enter opens one, Escape closes it.
  - **Values band**, full-width blue, "Why shop with FastDeal" in beige. Four features, each a vanilla icon, an Anton title, and one short line: Photo search (with a small vanilla "AI" tag, since it is the one feature that uses AI), Compare, Plan, Decide. One row of four on wide screens, a list on phones. No boxes; hovering one gives it a vanilla outline. Keep the lines short.
  - **Trending Today**, on beige: a belt of cards (`FdBelt`) that rolls left nonstop, like a conveyor belt, with no dots or arrows. A short list repeats so the row is always full, and it loops seamlessly. It pauses while hovered, focused, or touched, so a card can be read and tapped, and never moves with reduce motion (the row scrolls by hand instead). Each card is a link to Compare and the same size and look as a Trending This Week card (two, three, then four across; white photo area, then the name); hovering gives it a blue outline (cards never grow or lift on hover anywhere in the app; hover only highlights). When nothing is trending yet today, one line says so.
  - **Trending This Week**, on beige: the top 10 products of the week (Trending Today's 5 left out), one big card at a time on top of a stack: behind it, a paper card tilts out on the left (tap it for the previous product) and two peek out on the right (tap for the next). The stack is blank paper with the vanilla line and keeps still while the front card changes. From 992px the stack gives way to a looping row of all ten cards, three in view and 17rem wide: the middle one is the blue card, and the ones either side are the same layout on paper (blue label and title, muted count, vanilla line border), shrunk to 90%. With #1 in the middle, #10 sits on its left. Moving glides the whole row one card over (0.6s, eased) while the arriving card grows and fades to blue, like a scroll; cards wrapping round the loop jump while out of view. Tapping a side card brings it to the middle; tapping the middle card opens Compare. The card is blue with beige text, like the values band: a "#1 this week" eyebrow in beige with a round vanilla arrow on the right, the product name in the values band title type (two lines tall, three from 992px where the card is narrower, so every card is the same height), how many times it was searched (values band text), then a square white photo tile. The front card is 22rem wide at most (17rem from 992px) and has the soft shadow (`--fd-shadow`) so it lifts off the stack, the one card on the page with a shadow. The whole card is a link to Compare; hovering gives it a vanilla outline. A round 48px outline arrow sits either side of the card, centred on its height. There is no visible "3 / 10" count; screen readers hear the position instead. Arrows, a swipe, the arrow keys, or tapping a card behind switch the card, with a short slide on smaller screens and the gliding row from 992px; both ends wrap around. With reduce motion the card switches without sliding. The section is hidden when the list is empty. Both trending sections share the same padding and title gap.
- **Compare (`/compare`) listings:** 8 a page like every list, two full rows of four on wide screens, with the page buttons in a bar under them (not sticky, so it never covers the cards).
- **Compare (`/compare`), Customers who viewed this also viewed** (no colon): a section title (`fd-section-title`, 1rem above the cards). Below 992px, the first 10 on an `FdBelt` that rolls past exactly like Home's Trending Today (two, then three across); from 992px, a grid four across that starts with one row of 4; Load More adds a row of 4 at a time, and once everything is showing, "No more items to show" replaces it.
- **Notifications (`/notifications`):** **Mark all as read** (outline button) sits under the card on the left, in a row with the total on the right, so it is there on every tab whenever there are notifications; with nothing unread it stays instead of disappearing, reading "All read", disabled and faded to 40% like a disabled pager button. The search and Show filter sit at the top of the card.
- **Friends (`/friends`):** the title and subtitle, then three folder tabs with no strip behind them, labels in table header type (small bold capitals): **Friends**, **Add Friend**, and **Requests** (with a count bubble of requests waiting for you; the page re-checks every 5 seconds, like the navbar bell, so a new request shows up without a refresh). Requests lists only requests waiting for you (Accept as a solid blue button, Decline as a blue outline button, 8px apart), or an empty state, "No requests waiting." Add Friend shows your **Pending** requests (each with a Cancel outline button on the right) while its search is empty; typing switches it to the matching people, from `/api/friends/requests` and `/api/friends/sent`. The search ends where the friend cards end, clear of the scrollbar. Every outline on this page is the vanilla line, like the rest of the app. The open tab is paper, joined to the paper card below, which fills the screen. The page fits the screen; the card's contents scroll inside it, with the search box pinned at the top and a custom scrollbar on the right (arrows that jump to the top or bottom, a small brand-blue handle to drag, wider than its beige track) that holds its content, with a short blue line under its label; the others are muted text that turns blue on hover. A link can open a tab with `?tab=add` or `?tab=requests` (friend-request notifications open Requests); switching tabs stays inside the page, so the lists and search boxes are kept. Arrow keys move between tabs. Each tab is laid out like the Wishlist: a search pill where it helps (filter your friends by username or email; find people by username), then one card per row, 12px apart, the whole list scrolling inside the card, and under the card a small muted total on the right: "Total: 5 friends", "Total: 3 requests", "Total: 2 people" while searching, or "Total: 1 pending request".
- **Wishlist (`/wishlist`):** the title and subtitle, then a search box and a sort menu side by side (48px pills, like the Home search bar). Search filters by product name as you type. On wide screens (992px and up) the search row uses the table's columns: the search bar spans Product to Best now, and "Sort by" starts in line with the Target price alert heading. A "Sort by" label sits in front of the sort menu: Date added: Latest (the default), Date added: Earliest, Price: Low to High, Price: High to Low, Name: A to Z, Name: Z to A. Price sorts use today's best price. Under them, a 2px vanilla line and a header pill (blue with beige text, table header type) that stay pinned under the navbar together while scrolling, then one card per saved product (paper, 2px vanilla line border, `--fd-radius` corners, 12px apart). The header and cards share the same five columns, so everything lines up:
  - **Product:** the photo (96px square; on phones 72px), or the product's initials on vanilla soft when the catalogue has no `image` for it, then the name as a section subtitle. Both link to Compare.
  - **Saved price:** the price and the store it was saved from.
  - **Best now:** today's cheapest price and store. When the best price is at least 10% below the saved price (`DROP_PERCENT` in `WishlistView.vue`), a small tea green chip such as "−12%" sits on the same line as the price, so prices still line up from card to card. Screen readers hear "price drop of 12%, S$X less"; hovering shows the same.
  - **Target price alert:** an editable S$ box. Once the best price is at or below it, a tea green circle with a check, the same 36px as the round buttons, sits beside the box ("Target reached" for screen readers and on hover). Every item has a built-in alarm 10% under the price it was saved at: the Best now price gets the tea green "−12%" tag from there, and the server sends the price-drop alert (and an email when the shopper has no target of their own). The target box holds only a target the shopper typed (`targetSource: 'user'`), in addition to that alarm: reaching it sends the target alert and email and shows the tick. Older rows saved with the automatic target at exactly 10% under count as the alarm, so their box shows empty (`ownTarget` in `services/targetPriceEmail.js` and `src/store/wishlist.js`). When it is saved, Gemini suggests a target from the 30-day price history and today's store listings (cheapest, typical, highest; from the caches, no SerpApi credit), whichever there are (`models/target-price-model.js`; it must be below the saved price and not under 85% of the 30-day low or the cheapest listing, else it is thrown away). The history is the seeded demo history, else the real history of the product's search. The suggestion is only the box's faint grey placeholder (`--fd-grey-text` at 50%), never a value, and it disappears when the box is tapped; a small muted "*AI suggestion" note sits under the box (Gemini's one-line reason on hover) while the box is empty. Opening the Wishlist fills in suggestions for items that have none yet (saved before suggestions existed, or the AI did not answer): `POST /api/wishlist/suggest-targets`, 5 items a visit, 1.5 seconds apart, each item asked again at most once a day. With no history and no listings, or if the AI fails or takes over 5 seconds, the box is plain empty with no hint. Product photos whose link no longer loads show the initials, like a product with no photo.
  - **End of the row:** two round icon buttons (`fd-icon-btn`): the moon for Sleep on it and the trash to remove it.
  - Below 992px there is no room for five columns: the header pill is hidden and each card lays itself out, with the photo and name on top, then Saved price, Best now, and Target side by side under their own small labels, then the buttons. Below 768px those three stack too. On a held item below 992px, the countdown sits under the product, centred in the card, while the photo and name stay on the left. Store names link to that store's search for the product. When a search matches nothing, the page says so.
  - **Sleep on it** opens a pop-up (the welcome prompt's dialog styles) to pick how long to lock the item: a days : hours : minutes picker with an up arrow above and a down arrow below each number (blue Anton), which can also be typed into. Extra minutes roll into hours and extra hours into days, so typing 90 minutes gives 0 : 01 : 30. It starts at 1 day and goes up to 7 days. Under it, "Locked until" shows the exact date and time the hold would end (now plus the picked time). After Proceed, the whole card turns grey (grey soft background, grey line border, photo and name faded), and the Saved price, Best now, Target, and button columns give way to one countdown across them: the moon, "Sleeping on it, 3h 20m left" in grey text, and "Back on <date and time>" underneath. It updates every 30 seconds. When the hold ends, the prices, target, and buttons come back. A held item cannot be edited, removed, or opened (its photo and name stop being a link) until then, and Plan a budget leaves it out.
  - **Plan a budget** sits in a beige bar that sticks to the bottom of the screen while scrolling and stops above the footer (`position: sticky`, last thing on the page). The bar's right end shows the total: "Total: 8 products", with " (2 sleeping)" when some are on hold, or "3 of 8 products shown" while searching. The button opens a pop-up: enter a budget in S$, then under "Items to include" tick the items you want in the calculation and rank them (the list shows just each item's name; a small 1, 2, 3 menu appears beside each ticked item; 1 is the highest priority, ticking adds an item at the bottom, and picking a number moves it there so no two share one), then Find best combination. Pressing it with nothing ticked shows "Tick at least one item you want." in the red alert, like an empty budget does. Only ticked items are planned; nothing else from the wishlist is added. Items on hold are left out. The logic is in `src/mock/budget.js`: every mix of the ticked items that fits is tried. A mix is a set, so the same items in a different order never show twice. Mixes are ranked by priority kept (keeping #1 beats keeping #2 and #3 together), then most items, then least money left, so the best one is all the ticked items when they fit. Each result lists its items in priority order with a "#1" badge, the store, the total, and what is left. The best one shows first under a tea green "Best combination" chip, with no "Option 1 of 5" count; Try another combination (solid blue) swaps in the next best one, up to 5, then loops back to the best, which gets its chip again. When the ticked items do not all fit, a note says so and names the ones this mix leaves out.
  - Sleep on it is only on the Wishlist. The product page has Save to wishlist and Go to store; a product on hold shows Saved to wishlist there, with no Remove until the hold ends.
  - **Where a save comes from:** Compare's main Save button saves from today's cheapest store. Each store row in Compare's listings table also has its own button (Save from here, or Save from here instead when the product is already saved elsewhere), so you can save from a specific marketplace. Wishlist's Saved price column shows that store, linked. Products saved before stores were recorded say "Store not recorded" until they are saved again from Compare.
