# utown. — food delivery, end to end

**Live demo:** https://utown-korea.netlify.app · **API:** [utown-backend](https://github.com/E-L-R/utown-backend) (Spring Boot) · [Swagger](https://utown-backend.onrender.com/swagger-ui/index.html)

UTown is a working food-delivery marketplace for Seoul. One React app serves four products — the
customer storefront, a restaurant kitchen board, a rider app and an operations console — all on the
same order lifecycle, backed by a real Spring Boot API.

> The backend runs on Render's free tier, so the very first request after a quiet period can take a minute or two while it wakes up. The app pings the API as soon as it loads and explains the wait on screen; the optional `keep-backend-warm` GitHub Action keeps it awake.

## Try the whole flow in two minutes

Open the **Demo tour** (bottom-left) — each step signs you in as a seeded account:

1. **Customer** — pick a restaurant, customise a dish (required / optional option groups), check out.
2. **Restaurant** — the ticket lands on the kitchen board. Accept it with a prep time, start cooking, mark it ready, call a rider.
3. **Rider** — the job appears in the app of whichever rider was dispatched (the tour signs in as them; the rider app can switch between all three). Accept, pick up (only once the kitchen marks it ready), deliver.
4. **Customer** — the tracking page has followed every step live. Leave a review; it shows up on the restaurant page.

Operations (admin) can watch it all from the control room and dispatch riders from a queue.

## What's inside

| | |
|---|---|
| **Storefront** | Cuisine rail, server + local search, sorting, open-now filter, menu with scroll-spied category tabs, reviews, option-group modal, one-restaurant bag with minimum-order meter |
| **Checkout** | Saved addresses or a new one (city → neighbourhood), payment method, rider note |
| **Live tracking** | Status hero with ETA, progress bar, timeline with real timestamps, assigned rider, receipt, cancel / rate / reorder |
| **Kitchen board** | Kanban (New → Cooking → Ready → On the road), per-ticket timers that turn red when late, prep-time presets, decline reasons, rider dispatch, multi-restaurant tabs, daily stats |
| **Rider app** | Online/offline toggle, active job card with pickup → drop-off route, items, cash-to-collect, guarded actions, trip history |
| **Operations** | KPIs, live pipeline by status, "needs a rider" queue, all orders, fleet presence, restaurant activity |
| **Polish** | Light/dark themes (no flash), route-level code splitting, skeletons, cold-start hints, toasts, keyboard (`/` to search, `Esc` to close), reduced-motion support, responsive down to phone widths |

## Stack

React 19 · TypeScript · Vite · TanStack Query (polling for live updates, optimistic cart) · React Router · Axios (JWT with silent token refresh) · lucide icons · hand-written CSS design system (no UI kit).

```
src/
  api/          axios client (auth + refresh), typed endpoint modules
  auth/         AuthContext (cached demo sessions), useSwitchRole
  hooks/        TanStack Query hooks: catalog, cart, orders, dispatch
  components/   layout, header, demo tour, cart drawer, modals, UI primitives
  pages/        one file per screen; dashboards are lazy-loaded
  lib/          formatting, order-status copy, cuisine artwork, theme
```

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173, talks to the live API by default
```

Point it at a local backend with `VITE_API_URL=http://localhost:8080 npm run dev`.

## Demo accounts

All passwords are `password123`.

| Role | Phone |
|---|---|
| Customer | 01033333333 |
| Restaurant owner 1 (Pizza, Korean, Noodles, Café) | 01022222222 |
| Restaurant owner 2 (Burger, Chicken, Sushi) | 01022222223 |
| Rider — Speedy Rider (scooter) | 01044444444 |
| Rider — Jisoo Han (bicycle) | 01044444445 |
| Rider — Marco Silva (car) | 01044444446 |
| Operations | 01011111111 |
