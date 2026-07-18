# LUXE — Full App Audit

Codebase audit — 2026-07-17. Every screen across all 7 portals (customer app, admin, seller, brand, delivery, delivery-company, plus auth/onboarding — ~140 screens total), read end to end for UI consistency, device support, and functional correctness.

**Totals: 13 Critical · 15 High · 38 Medium · 7 Low**

Severity key:
- **Critical** — breaks a core flow outright, moves money without a safety net, or leaks something it shouldn't
- **High** — a real, verifiable bug, narrower blast radius than Critical
- **Medium** — device/UX/consistency defect
- **Low** — cosmetic/polish

Two related bugs were already found and fixed earlier in this session, before this audit ran, so they're excluded below: a stale-closure pagination bug in the product grid (`useProductGrid.ts`), and a `Text` `lineHeight`/`fontSize` mismatch clipping the product-detail header.

---

## Systemic patterns

These seven habits repeat across many unrelated screens. Fixing each once — a shared confirm-dialog helper, a shared error-vs-empty state, a lint rule — resolves dozens of individual findings at once, which makes them the highest-leverage place to start.

### P1 — Destructive and financial actions fire with no confirmation, and no error handling
A tap-and-forget pattern: the action fires immediately, only `onSuccess` is handled, and there's no `Alert.alert` confirm step. When the call actually fails, the UI looks exactly like it succeeded.
- **Admin:** catalogue approve/reject, banner delete, campaign/coupon live-toggle, user role changes, product approve/reject, order status override, gift-card void & balance adjustment, commission-rate edits
- **Delivery-company:** warehouse receive, manual driver assignment
- **Brand:** team-member removal (partially — see High findings)

### P2 — A failed fetch renders identically to a real empty state
On `res.ok === false`, most screens just leave data empty and fall into the same "Nothing here" copy used for a genuinely empty result — no retry, no distinction between "you have zero orders" and "the request failed."
- **Main:** blog list/detail, order & return detail, "Following" list
- **Brand:** confirmed absent everywhere (zero `isError` checks in the entire portal)
- **Delivery:** orders, pickups, history, store-pickups
- **Admin:** analytics dashboard renders "LKR 0" as if it were real revenue

### P3 — Muted text uses a background-color token, not a text-color token
`colors.light.muted` (`#eaeade`, a near-white card/background swatch) is used as a text `color` instead of `colors.light.mutedForeground` (`#65684d`). Against the `#f5f4ef` page background that's roughly 1.05:1 contrast — the text is there, but effectively invisible. Same defect class as the header-clipping bug fixed earlier today, just a wrong token instead of a stale style property.
- **Main:** blog subtitle/date/excerpt text
- **Admin:** order dates, product/store meta, sale counts, settings labels — across orders, products, stores, users, and settings screens

### P4 — `Dimensions.get('window')` captured once at module scope
Read at import time instead of via the reactive `useWindowDimensions()` hook, so the value is frozen at launch orientation and never updates for rotation, split-screen, or foldables.
- **Main:** `ProductImageGallery` (live — carousel width), product-detail skeleton height, `StoreHero` (dead code today, re-activate with care), checkout-success (dead), wardrobe grid card width
- **Onboarding:** slide carousel paging math
- **Seller:** dashboard & analytics KPI-card widths

### P5 — Missing or hand-rolled safe-area handling
No `useSafeAreaInsets()`/`SafeAreaView` at all, or a hardcoded top offset (e.g. a bare `paddingTop: 56`) standing in for it — both break on notches, Dynamic Island, and gesture-nav home indicators of a size the constant didn't anticipate.
- **Main:** blog screens, contact form (bottom only)
- **Brand:** the entire portal, systemically
- **Seller:** order & product detail screens
- **Delivery:** route-map bottom sheet, pickup detail
- **Admin:** courier/gift-card/notification modals

### P6 — Dark mode silently ignored on a handful of screens
These screens import `colors.light.*` directly instead of going through `useTheme()`, so they stay light-themed even when the rest of the app switches to dark.
- **Main:** wishlist, wardrobe, gift cards, contact
- **Delivery:** order detail (the screen used to mark deliveries complete), store-pickups

### P7 — Dense list and KPI screens don't adapt to tablet width
Single-column cards or a fixed 2-column `%`-width grid, with no breakpoint logic anywhere. Low priority for the customer-facing app, but the Admin, Seller, and Delivery-company portals are explicitly staff/ops tools likely to see real tablet use at a desk or warehouse.
- **Admin:** nearly every list screen, the dashboard, and the 21-item "More" grid
- **Delivery-company:** drivers/routes/warehouses/packages lists, both KPI grids
- **Seller:** dashboard & analytics KPI/action cards

---

## Critical findings

Blocks a core flow outright, moves money without a safety net, or leaks something it shouldn't. Worth fixing before anything else on this list.

1. **[Auth · root routing] Admin accounts have no redirect case — they land in the customer app, not the admin portal**
   `app/_layout.tsx` — role-based redirect switch
   The switch handles `store_owner`, `brand_owner`, `delivery`, `delivery_company`, else default → `/(main)`. There is no `"admin"` case, so an admin logging in is dropped straight into the customer storefront.

2. **[Admin · navigation] Courier management is likely unreachable from the More menu**
   `app/(admin)/more/index.tsx:60`
   The courier route is registered as `"/(admin)/courier/index"` — the only entry in the whole menu with an explicit `/index` suffix, while every sibling omits it. Tapping "Courier Providers" most likely fails to resolve.

3. **[Main · product detail] Any product with no size/color variants is permanently shown as sold out**
   `app/(main)/products/[slug].tsx:123-126`
   `currentStock` falls back to `selectedVariant?.stock ?? 0`, but a variant-less product never sets `selectedVariant` — so it's `0` forever. `ProductCard.tsx` already handles this correctly elsewhere; the PDP doesn't.

4. **[Main · product detail] Products with color-only variants (no sizes) can never be added to cart**
   `app/(main)/products/[slug].tsx:146-149` · `VariantSelector.tsx:90`
   Checkout is gated on `!selectedSize` whenever `variants.length > 0`, but the size picker only renders when a size actually exists on the variant set. A bag in 3 colors and no sizes fails "Select a size" forever.

5. **[Main · checkout] Double-tapping "Place order" can create two orders**
   `app/(main)/checkout/index.tsx:364-480`
   Address validation, cart validation, and snapshot/reservation calls are all awaited *before* `setLoading(true)` ever runs, and the button only disables on `loading`. Two fast taps both pass validation before either sets the guard.

6. **[Main · account security] The phone-number-change fallback skips OTP verification entirely**
   `app/(main)/account/settings/index.tsx:389-399`
   When `supabase.auth.updateUser({ phone })` errors, the fallback writes the new phone number directly via the settings API — bypassing the OTP-verification step the primary path enforces. No proof of ownership required whenever phone-auth is unavailable.

7. **[Admin · security] Courier integration credentials render as raw, selectable, unredacted JSON**
   `app/(admin)/courier/[id].tsx:98-105`
   A provider's `env_vars` (API keys/secrets) is printed straight to screen with no masking. Any staff member with admin app access can read and copy a live integration's credentials off their phone.

8. **[Admin · commissions] Commission-rate edits have no validation and no confirmation**
   `app/(admin)/commissions/index.tsx:40-61`
   A staff member can type any string into a tier's rate — including "50" meant as a decimal — with no bounds check and no "are you sure," and it overwrites the live commission tier applied to every seller's future orders.

9. **[Seller · inventory] Bulk stock updates skip the reserved-stock safety check single edits enforce**
   `app/(seller)/inventory/index.tsx` — `handleSaveStock:196` vs `bulkApply:249`
   A single-row stock edit warns before dropping stock below units already held in active carts. Selecting 20 variants and bulk-setting stock to 0 skips that check entirely — silently breaking any cart already holding one of those items.

10. **[Admin · gift cards] Voiding or adjusting a gift-card balance is a single tap with no confirmation**
    `app/(admin)/gift-cards/index.tsx` — `VoidForm:245-261`, `AdjustForm:222-243`
    The screen's own copy states "Voiding is permanent," yet the button fires `voidAdminGiftCard`/`adjustAdminGiftCard` immediately — a fat-finger tap permanently changes a customer's real balance.

11. **[Admin · reports] "Generate report" doesn't generate anything**
    `app/(admin)/reports/index.tsx:28`
    The button only shows a static `Alert.alert`; no API call is ever made. Staff believe they've queued a CSV/PDF export that in fact was never created, emailed, or logged anywhere.

12. **[Admin · delivery ops] Reassigning a failed delivery is silently broken on every Android device**
    `app/(admin)/delivery/failures.tsx:124`
    `Alert.prompt` is an iOS-only API. On Android the optional-chained call is just a no-op — a staff member taps "Reassign" and nothing happens at all, with no error to explain why.

13. **[Delivery · scan] A permanently-denied camera permission has no recovery path**
    `app/(delivery)/scan/index.tsx:344-353`
    The only action offered is `requestPermission()`, with no check for `canAskAgain === false` and no `Linking.openSettings()` fallback. Once a rider denies camera access twice, they can never scan a package on that device again without knowing to dig into OS Settings unprompted — blocking their ability to work.

---

## High-priority findings

Real, verifiable bugs with a narrower blast radius than Critical, or ones the systemic patterns above don't already fully cover.

1. **[Main · blog] Every blog post's cover photo is replaced by a placeholder icon**
   `app/(main)/blog/[slug].tsx:57-61` — when `post.cover_image` exists, the detail screen renders a static camera-icon placeholder instead of an `Image` — the list screen resolves the same field correctly, the detail screen doesn't.

2. **[Main · blog] A post missing its `tags` field crashes both blog screens**
   `app/(main)/blog/[slug].tsx:64` · `blog/index.tsx:67` — both screens call `.map`/`.length` straight on `tags` assuming it's always an array. The type is optional on the wire but the client re-declares it as required and casts blindly — a post returned without tags throws.

3. **[Main · stores] Store pages have no cover image — the hero component exists but is never used**
   `app/(main)/stores/[slug].tsx` — the screen renders only a plain text header and identity card; it never imports `StoreHero`, even though the API already returns `banner_url` and the brand-detail screen's equivalent hero works fine.

4. **[Main · account] Order tracking shows no progress at all for cancelled, returned, or refunded orders**
   `app/(main)/account/orders/[id]/track.tsx:25-32, 102-105` — `STATUS_ORDER` only lists `pending → delivered`; any terminal status isn't in that list, so its index resolves to `-1` and clamps to `0` — a delivered-then-returned order renders as if only "Order placed" ever happened.

5. **[Main · gift cards] "Copy code" opens the share sheet instead of copying anything**
   `app/(main)/account/gift-cards.tsx:43-49` — `copyCode` is implemented with `Share.share()`, not a clipboard write — no `expo-clipboard` import exists. Tapping "copy" opens the native share sheet; nothing ever lands on the clipboard.

6. **[Brand · team] A team member can remove every other manager, including the sole remaining owner**
   `app/(brand)/more/team.tsx` — `MemberRow:110-139` — removal is gated only by a generic "Remove member?" alert — no role check stops a member from removing the last owner/manager, which would lock the brand out of managing its own storefront.

7. **[Brand · notifications] The unread-notification dot can't render — a `View` is nested inside a `Text`**
   `app/(brand)/more/notifications.tsx:92` — `<Badge><View /></Badge>` — `Badge`'s children always render inside an `AppText`. Nesting a `View` inside RN's `Text` is invalid and will fail to render (or throw in dev) instead of showing the dot.

8. **[Main · cart] Fast double-tapping the quantity stepper under- or over-counts**
   `app/(main)/cart/index.tsx:634-635` — same defect class as the pagination bug fixed earlier today: `onIncrement`/`onDecrement` compute the next quantity from the render-time closure rather than the live store value. Two fast taps both read the same stale quantity — 2 → 3 instead of 2 → 4.

9. **[Admin · users] Promoting a user to admin has no error handling**
   `app/(admin)/users/index.tsx:23-29, 93-102` — the role-change mutation has no `res.ok` check and no `onError`. If the privilege-escalation call fails server-side, the screen still refreshes as though it worked.

10. **[Delivery-company · routes] Route status goes stale after dispatching or cancelling**
    `app/(delivery-company)/routes/index.tsx, routes/[id]/index.tsx` — these are the only two list-bearing screens in the portal with neither realtime updates nor focus-triggered refresh. Dispatch or cancel a route, navigate back, and the list still shows the pre-action status until a manual pull-to-refresh.

11. **[Delivery-company · warehouses] Receiving a shipment at a warehouse commits with zero confirmation**
    `app/(delivery-company)/warehouses/receive.tsx:75-108` — typing an order reference and submitting goes straight to `receiveAtWarehouse` with no "are you sure" step — unlike every other high-stakes action in this portal. A typo'd order number commits before the dispatcher even sees which order it resolved to.

12. **[Delivery-company · assignments] Manually assigning a driver commits on the first tap**
    `app/(delivery-company)/assignments/index.tsx` — `confirmManual:218-236` — tapping a name in the driver-candidate list immediately calls `manualAssignOrder` — a mis-tap on a dense list assigns the wrong driver with no undo.

13. **[Admin · products] Approving or rejecting a product fails silently**
    `app/(admin)/products/[id].tsx:26-27` — `onSuccess` invalidates the query unconditionally with no `res.ok` check — a failed approve/reject looks identical to a successful one.

14. **[Admin · orders] Force-overriding an order's status has no confirmation and no error handling**
    `app/(admin)/orders/[id]/index.tsx:28-34, 109-117` — "Mark as {nextStatus}" fires with `adminOverride: true` on a single tap; a misclick force-transitions a real order, and a failed request gives the admin no feedback either way.

---

## Full list, by portal

Everything at Medium and Low severity, organized by portal for reference.

### Main app — Home, browse, product detail
- **Medium** — `products/[slug].tsx:168-171` — "Buy Now" still navigates to the cart screen even when the add-to-cart step failed (e.g. no size selected) — user lands on an unchanged cart with no purchase made.
- **Medium** — `products/[slug].tsx:519-521` — Submitting a review re-triggers the full-page skeleton loader, discarding scroll position and images just to refresh the review list.
- **Medium** — `search/index.tsx:877-880` — Hardcodes a white background instead of the shared PaperBackground/token system — visibly different texture from every other tab.
- **Medium** — `categories/index.tsx:86-96` — No loading state while categories fetch — blank space below the header on a slow connection.

### Main app — Cart, checkout, wishlist, wardrobe, gift cards
- **Medium** — `checkout/index.tsx:622-629` — On COD success, navigation to the success screen fires before the cart is actually released/cleared — a quick back-tap can briefly show just-purchased items as still reserved.
- **Medium** — `wardrobe/[id].tsx:99-108` — Deleting a wardrobe item has no confirmation dialog — one mis-tap on the header trash icon deletes it permanently.
- **Medium** — `gift-cards/index.tsx:139-140,195` — Custom gift-card amount has no floor — the field accepts 0 or negative values and the submit button doesn't guard on amount > 0.
- **Medium** — `contact/index.tsx:106,256` — Bottom padding is a fixed 32px constant instead of adding `insets.bottom` — the submit button sits closer to the gesture bar on some devices than others.
- **Low** — `checkout/success.tsx:29` — Vestigial module-scope `Dimensions.get` call — unused today, but carries the stale-on-rotation defect if ever wired up.

### Main app — Account: orders, returns, reviews, wardrobe
- **Medium** — `account/wardrobe.tsx:337` — The empty state's "Add manually" button navigates to the very screen it's already on — no add-item route exists anywhere in the app, so it's a dead end.
- **Medium** — `orders/[id].tsx, returns/[id].tsx, returns/new.tsx` — A failed fetch and a genuine 404 render the same "not found" copy, with no retry action.
- **Medium** — `returns/new.tsx:301` — The notes field's placeholder invites photos/serials, but there's no image picker anywhere on the screen and none is required to submit — no evidence ever reaches the seller for damage/mismatch claims.
- **Medium** — `orders/[id].tsx:335-346` — The shipping-address block has no fallback when both `address` and `shipping_address` are absent — renders a card with blank fields instead of an explicit empty state.
- **Medium** — `price-alerts.tsx:44` — Threshold input sends `Number(editValue)` straight through with no `isNaN`/format check.
- **Low** — `orders/[id].tsx, returns/[id].tsx, returns/new.tsx, track.tsx` — Bottom padding is a hardcoded constant rather than reading `insets.bottom`.

### Main app — Account: profile, settings, payments, addresses
- **Medium** — `account/security/index.tsx` — No `KeyboardAvoidingView` anywhere on the screen — the password-change and 2FA-enrollment fields can be covered by the keyboard on smaller devices.
- **Medium** — `payments/add.tsx:87-99` — The Save button stays enabled during an un-awaited-for lookup — a fast double-tap can save two cards, both possibly marked default.
- **Medium** — `payments/add.tsx:70` — Expiry validation only checks digit shape (`MM/YY`), never that the month is 01-12 or that the date is in the future.
- **Medium** — `addresses/index.tsx:214-216` — The header button shows an overflow-menu (⋮) icon but actually opens "add address" — a misleading affordance.
- **Medium** — `payments/index.tsx:53` — Every saved card permanently displays "0 charges" — the value is hardcoded, not real usage data.
- **Medium** — `following/index.tsx:30-37` — A failed fetch for a signed-in user silently falls through to the guest/local fallback path with no error surfaced.

### Auth, onboarding, root entry
- **Medium** — `app/_layout.tsx:112-119` — Delivery-company home-route resolution has no `.catch` — a network blip during that lookup strands the user on the auth screen with no fallback or error.
- **Medium** — `(auth)/register.tsx:266 vs 72-75` — Password placeholder says "Min. 6 characters" but validation actually requires 8 — a new user's very first form rejects them on bad advice.
- **Medium** — `(auth)/register.tsx:34-36` — Deep-link `role` params only special-case "delivery" — a seller/brand invite link silently defaults to "customer" instead of pre-selecting the right role.
- **Medium** — `(auth)/register.tsx` — No password-confirmation field, unlike reset-password's matching check — a signup typo creates an account with an unintended password.
- **Low** — `(auth)/login.tsx` — `handleSocialLogin` — No visible loading indicator on the Google button itself while the OAuth session launches.
- **Low** — `brand/accept.tsx` — Uses raw Text/StyleSheet instead of the shared Typography components every other auth screen uses.

### Admin — catalogue, content, campaigns, coupons
- **Medium** — `app/(admin)/index.tsx:371-378` — The "Content" alert tile hardcodes `value="Open"` instead of a real pending count, unlike its three sibling tiles.
- **Medium** — `analytics/index.tsx:21-45, 87-99` — No `isError` branch on any of the three parallel stats queries — a failed fetch renders "LKR 0 / 0 orders" as if that were the real performance number.

### Admin — orders, delivery, courier, users, stores
- **Medium** — `more/index.tsx:230` — The 21-item destination grid is a fixed 2-column `47%` layout with no tablet adaptation.
- **Medium** — `courier/*, delivery/failures.tsx, gift-card & notification modals` — Bottom padding relies on a fixed 48-100px constant instead of `useSafeAreaInsets()` — primary action buttons can sit flush against the home-indicator area.
- **Medium** — `orders/index.tsx, products/index.tsx, stores/index.tsx, users/index.tsx, settings/index.tsx` — Same muted-text token misuse as Pattern P3 — dates, meta text, and labels rendered in a near-invisible color across all five screens.

### Seller
- **Medium** — `orders/[id]/index.tsx, products/[id]/index.tsx` — Detail screens have no safe-area handling at all — the back control can render under the status bar/notch.
- **Medium** — `bulk-upload/index.tsx` — `parseCsv:51` — The CSV parser splits on raw newlines before any quote-aware parsing, so a description field with an embedded newline gets garbled into two rows.
- **Medium** — `products/index.tsx` — `exportCsv:435` — "Export CSV" only exports the currently-loaded paginated page (20 rows), not the full catalogue, with no indication the file is partial.
- **Medium** — `bulk-upload/index.tsx:420,479` — The up-to-200-row upload preview and its error list render in a plain ScrollView, not a virtualized list.
- **Medium** — `products/[id]/index.tsx` — `syncImages:261` — If an image upload fails mid-sequence after the product record was already created, variants never get saved and the seller sees only a generic error with no indication the product is half-configured.

### Brand
- **Medium** — `more/campaigns.tsx:103-148` — The campaign create/edit form never exposes start/end dates even though the API supports them — campaigns can't be date-scoped from mobile at all.
- **Medium** — `more/campaigns.tsx:108,112,136` — Budget field has no validation — non-numeric input produces `NaN` sent straight to the create/update call.
- **Medium** — `products/index.tsx:30,55-61` — The product search box is bound directly into the query key with no debounce — fires a network request on every keystroke.
- **Medium** — `more/collections.tsx:102-107` — "Feature on storefront" toggle is a bare Text tap target nested inside a Badge, instead of the Chip/switch pattern used elsewhere.
- **Medium** — `more/team.tsx:74` — Invite gating only checks for an "@" character — accepts clearly invalid addresses like "a@".
- **Low** — `index.tsx, products/index.tsx` — The two primary tabs bypass the shared font tokens, rendering in the OS default font while every other Brand screen uses the design system.
- **Low** — `more/notifications.tsx:16-22, more/inventory.tsx:85` — Hardcoded hex colors bypass the token file — a future palette change would silently miss these.

### Delivery (rider)
- **Medium** — `route-map.tsx:288-298` — The bottom stops sheet uses a fixed `paddingBottom: 24` instead of `insets.bottom` — the last stop's "Navigate" target can sit under a gesture bar.
- **Medium** — `pickups/[id]/index.tsx:298` — A hardcoded `paddingTop: 56` stands in for safe-area insets — wrong on devices with a taller or shorter status bar.
- **Medium** — `profile.tsx:362-370` — The capacity stepper's +/- buttons are 32×32px, below the ~40px one-handed tap-target guidance this field-use portal calls for.
- **Medium** — `scan/index.tsx:384-398` — No timeout or retry feedback for an unreadable QR (glare, damaged label) beyond the static hint text — a rider can be left staring at a frozen frame with no guidance toward manual entry.

### Delivery-company
- **Medium** — `drivers/[id]/index.tsx:326` — "View routes" from a driver's profile pushes the unfiltered routes list — the driver filter it just used to compute a route count is dropped entirely.
- **Medium** — `packages/index.tsx` — `onScan:255-265` — Scanning a package already marked "received" re-opens the same Receive form for it, with nothing blocking a duplicate receive.
- **Medium** — `drivers/index.tsx:191,203` — A single `inviting` boolean is shared as a mutex between the driver active/inactive toggle and the invite-modal submit spinner — using one while the other is mid-flight silently no-ops or shows a stale spinner.
- **Low** — `team/index.tsx:136` — The invite modal's Cancel button has no style at all, rendering in default black system font against a themed modal.
