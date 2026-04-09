# Suds — Project Overview

## Concept

Suds is a **"Strava for drinking"** — a social iOS app where users log alcoholic beverages, follow friends, and track personal stats and streaks. It blends the habit-tracking loop of fitness apps with a light, social layer to make recreational drinking more self-aware and fun.

---

## Business Model

### Free Tier
Core social and tracking features, always free:

| Feature | Description |
|---|---|
| Drink logging | Log drinks with quantity, notes, **end times**, and GPS location. Automatic **DPH (Drinks Per Hour)** calculation on cards. |
| Social feed | Real-time activities feed for users and followers that mimics the existing feed experience. |
| User search | Find users by name/username and perform **follower/following lookups**. |
| Heatmap | Map of your and friends' drink locations with **stabilized filter switching**. |
| Privacy Mode | Enable to **disable exact street address locations** for sensitive areas (e.g., home). |
| Streaks | Drink streaks and sober streaks |
| Milestones | Gamification badges (1st, 10th, 25th, 50th, 100th drink, etc.) |
| Weekly goal | Set a weekly drink limit to stay accountable |
| Basic stats | Drink counts by type, top drinks |
| Sessions | Group drinks into a session (e.g., "Friday night out") |

### Suds Plus (Premium)
Monetized via **RevenueCat** (in-app subscription, iOS App Store / Google Play). Entitlement ID: `premium`.

| Feature | Description |
|---|---|
| Advanced Analytics | Weekly trend, monthly trend, day-of-week breakdown, hour-of-day breakdown, year-over-year comparison, average drinks per week |
| BAC Estimator | Real-time blood alcohol content estimate based on active session |
| Full History | Stats and trends across the complete drink history (not just recent) |
| Data Export | Export drink logs to CSV |
| Premium Badge | "Suds Plus" badge on profile |

**Monetization stack:** RevenueCat handles purchase flow, entitlement verification, and restore. Subscription state is also synced to the Supabase `profiles.subscription_tier` column (`free` | `premium`) for server-side enforcement.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Expo (managed workflow, SDK 55) |
| Routing | Expo Router v3 (file-based) |
| Backend | Supabase (PostgreSQL + PostGIS, Auth, Storage, Realtime) |
| Data fetching | TanStack Query v5 (infinite scroll, cache invalidation) |
| Global state | Zustand (`authStore`, `sessionStore`) |
| Styling | NativeWind v4 + Tailwind CSS |
| Forms | React Hook Form |
| Payments | RevenueCat (`react-native-purchases`) |
| Build / Deploy | EAS Build (Expo Application Services) |

---

## Project Structure

```
suds/
├── app/                        # Expo Router screens
│   ├── _layout.tsx             # Root layout — auth guard, RevenueCat init
│   ├── index.tsx               # Redirect: authenticated → tabs, guest → sign-in
│   ├── paywall.tsx             # Suds Plus upgrade screen
│   ├── (auth)/
│   │   ├── sign-in.tsx
│   │   └── sign-up.tsx
│   ├── (tabs)/
│   │   ├── feed.tsx            # Social feed (infinite scroll)
│   │   ├── log.tsx             # Log a new drink
│   │   ├── map.tsx             # Drink heatmap (native)
│   │   ├── map.web.tsx         # Map stub for web
│   │   ├── profile.tsx         # Own profile — stats, streaks, milestones
│   │   └── search.tsx          # Find & follow users
│   ├── drink/
│   │   ├── [id].tsx            # Drink detail view
│   │   └── edit/[id].tsx       # Edit a drink log
│   └── user/
│       ├── [id].tsx            # Other user's public profile
│       └── edit.tsx            # Edit own profile
│
├── src/
│   ├── components/
│   │   ├── common/
│   │   │   ├── Avatar.tsx
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   ├── LocationPicker.tsx
│   │   │   ├── PremiumGate.tsx  # Wraps premium-only UI, shows paywall CTA
│   │   │   └── RemoteImage.tsx
│   │   ├── drink/
│   │   │   ├── DrinkBadge.tsx
│   │   │   ├── DrinkCard.tsx    # Feed card for a single drink log
│   │   │   └── DrinkTypePicker.tsx
│   │   ├── profile/
│   │   │   ├── AdvancedStatsCard.tsx  # Premium — charts and analytics
│   │   │   ├── BACEstimator.tsx       # Premium — live BAC estimate
│   │   │   ├── GoalCard.tsx           # Free — weekly goal progress
│   │   │   ├── MilestoneBanner.tsx    # Free — milestone notifications
│   │   │   └── StreakCard.tsx         # Free — drink / sober streaks
│   │   └── session/
│   │       ├── SessionBanner.tsx      # Active session status bar
│   │       └── SessionCard.tsx
│   │
│   ├── hooks/
│   │   ├── useAuth.ts           # Auth state + sign in/out
│   │   ├── useAdvancedStats.ts  # Premium analytics (calls get_advanced_stats RPC)
│   │   ├── useDebounce.ts
│   │   ├── useDrinkLog.ts       # CRUD for drink_logs
│   │   ├── useFeed.ts           # Infinite-scroll social feed
│   │   ├── useFollow.ts         # Follow / unfollow users
│   │   ├── useGoals.ts          # Weekly drink goal
│   │   ├── useLocation.ts       # Device GPS
│   │   ├── useMilestones.ts     # Milestone data (calls get_milestones RPC)
│   │   ├── useProfile.ts        # Own and other-user profiles
│   │   ├── useSession.ts        # Drinking session management
│   │   ├── useStreaks.ts        # Streak data (calls get_streaks RPC)
│   │   └── useSubscription.ts  # RevenueCat entitlement + purchase flow
│   │
│   ├── lib/
│   │   ├── constants.ts         # DRINK_TYPES, page sizes
│   │   ├── queryClient.ts       # TanStack Query config
│   │   ├── revenuecat.ts        # RevenueCat init, purchase, restore
│   │   ├── storage.ts           # Supabase Storage helpers (avatar upload)
│   │   └── supabase.ts          # Supabase client singleton
│   │
│   ├── stores/
│   │   ├── authStore.ts         # Zustand — user session
│   │   └── sessionStore.ts      # Zustand — active drinking session
│   │
│   ├── types/
│   │   ├── database.ts          # Supabase generated types
│   │   └── models.ts            # App-level models (DrinkType, etc.)
│   │
│   └── utils/
│       ├── dateHelpers.ts
│       ├── locationPrivacy.ts   # Sanitizes residential addresses for Privacy Mode
│       └── profileHelpers.ts
│
├── supabase/
│   └── migrations/
│       ├── 001_init_schema.sql  # Core tables: profiles, drink_logs, follows
│       ├── 002_rls_policies.sql # Row-level security
│       ├── 003_functions.sql    # Utility DB functions
│       ├── 004_sessions.sql     # Sessions table + session_logs
│       ├── 005_storage.sql      # Supabase Storage bucket policies
│       └── 006_premium.sql      # subscription_tier column, goals table,
│                                #   get_streaks(), get_milestones(),
│                                #   get_advanced_stats() RPCs
│
├── assets/                      # Icons, splash, images
├── app.json                     # Expo config (EAS, RevenueCat plugin)
├── eas.json                     # EAS build profiles
└── tailwind.config.js
```

---

## Database Schema (key tables)

| Table | Purpose |
|---|---|
| `profiles` | One row per user. Extends Supabase auth. Includes `subscription_tier`, avatar, bio, display name, **username**, **height**, **weight**, **age**, and **privacy_mode**. |
| `drink_logs` | Every drink ever logged. Foreign key to `profiles`. Has `drink_type`, `quantity`, `notes`, `location` (PostGIS point), `session_id`, `logged_at`, and **`ended_at`**. |
| `follows` | Follower → followee edges |
| `sessions` | A named drinking session. References `profile_id`, has start/end times |
| `goals` | One row per user (unique). Stores `weekly_limit` |

### Key DB Functions (RPCs)

| Function | Tier | Returns |
|---|---|---|
| `get_streaks(user_id)` | Free | `drink_streak`, `sober_streak`, `last_drink_date` |
| `get_milestones(user_id)` | Free | Total drinks, latest milestone, all earned milestones, per-type counts |
| `get_advanced_stats(user_id)` | Premium | Weekly/monthly trends, day-of-week, hour-of-day, year-over-year, avg/week, best session count |

---

## Data Flow

```
User action
  │
  ▼
React Hook Form (log screen) / Pressable
  │
  ▼
Custom hook (useDrinkLog, useSession, etc.)
  │  — TanStack Query mutation
  ▼
Supabase client → PostgreSQL (RLS enforced)
  │
  ▼
Query cache invalidation → UI re-renders
```

Auth state lives in Zustand (`useAuthStore`). Supabase Auth session changes propagate via `onAuthStateChange` → store update → Expo Router redirect.

Premium gating uses `PremiumGate` component: wraps premium UI, checks `useSubscription().isPremium`, and shows a paywall CTA if not entitled.

---

## Production

**Live at:** https://drink-with-suds.com

- `EXPO_PUBLIC_AUTH_URL=https://drink-with-suds.com` in prod env
- Google OAuth authorized redirect URI: `https://gbenibgytweskljxneup.supabase.co/auth/v1/callback` (Web client only)
- Apple web OAuth Services ID return URL: `https://gbenibgytweskljxneup.supabase.co/auth/v1/callback`
- Apple domain verification: `https://drink-with-suds.com/.well-known/apple-developer-domain-association.txt`

---

## Setup Checklist

1. Create a Supabase project at supabase.com
2. Run all migrations in `supabase/migrations/` in order (or `combined.sql`)
3. Enable PostGIS extension in Supabase dashboard
4. Create Supabase Storage bucket `avatars` (public)
5. Fill `.env`:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - `EXPO_PUBLIC_RC_IOS_KEY` (RevenueCat iOS key)
   - `EXPO_PUBLIC_RC_ANDROID_KEY` (RevenueCat Android key)
6. In RevenueCat dashboard: create entitlement `premium`, attach a product/offering
7. `npx expo start` for development (Expo Go / dev client)
8. `eas build` for production builds
