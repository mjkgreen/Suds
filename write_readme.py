# -*- coding: utf-8 -*-
import sys

readme_content = """# Suds \\U0001f37a

**Suds** is the premier social app for logging alcoholic beverages, following friends, tracking hydration, and gaining deep insights into your consumption habits.

Built with **Expo SDK 54**, **Supabase**, and **RevenueCat**, Suds combines intuitive habit tracking with a social feed, gamified badges, and real-time blood alcohol content (BAC) estimations.

---

## \\U0001f680 Key Features

### \\U0001f193 Free Tier
- **Drink Logging**: Log any drink (beer, wine, cocktail, spirit, seltzer, cider, etc.) with custom branding, rating, event names, or notes.
- **Social Feed**: Follow friends and view their drinking activity in a real-time, infinite-scroll feed complete with likes and comments.
- **Heatmap & Geolocation**: Map your logged drinks with GPS coordinates and automatic country-code tracking.
- **Streaks & Goals**: Set weekly consumption limits and monitor active streaks.
- **Milestones**: Earn gamified achievements/badges for drink frequencies and varieties.
- **Sessions & Hydration Tracking**: Group multiple drinks into "sessions" and log non-alcoholic drinks (water, soft drinks, etc.) to calculate active hydration status.

### \\u2b50 Suds Plus (Premium)
- **Advanced Analytics**: Granular trends (weekly/monthly charts, day-of-week distribution).
- **BAC Estimator**: Live estimation of Blood Alcohol Content based on height, weight, gender, birthdate, and session duration.
- **Full History**: Unlimited archive and data export (CSV format).

---

## \\u2692\\ufe0f Tech Stack & Expo SDK 54 Configuration

Suds leverages **Expo SDK 54** to build high-performance native iOS, Android, and Web applications.

### Expo SDK 54 Specifications & Setup
- **Target SDK Version**: `^54.0.33` (as defined in `package.json`)
- **React Native Engine**: `0.81.5`
- **React**: `19.1.0` (with Concurrent rendering support)
- **Bundler**: Metro (`metro.config.js` configuration with CSS support)
- **Typed Routing**: Enabled experiments for static typescript types in Expo Router.
- **Required Device Permissions**:
  - `NSLocationWhenInUseUsageDescription` / `ACCESS_FINE_LOCATION`: Required for logging GPS coordinates and determining geographical bounds.
  - `NSCameraUsageDescription` / `CAMERA`: Used for snapping pictures of your drinks.
  - `NSPhotoLibraryUsageDescription` / `READ_EXTERNAL_STORAGE`: Allows users to upload pre-existing drink images.
- **Expo Plugins Configured in `app.json`**:
  - `expo-router` with customized origin URLs.
  - `expo-location` for precise geotagging.
  - `expo-image-picker` with custom permission prompts.
  - `expo-font` for loading custom typographic styles.
  - `@react-native-google-signin/google-signin` with native iOS URL schemes.

To run/build with Expo SDK 54:
```bash
# Start development server
npm run start

# Run on iOS simulator (requires macOS)
npm run ios

# Run on Android emulator
npm run android

# Build using EAS CLI (EAS configuration configured in eas.json)
npm install -g eas-cli
eas build --profile development --platform all
```

---

## \\u2611\\ufe0f Database Schema & Migrations (001 to 026)

The Supabase PostgreSQL database is constructed incrementally. Migrations `001` through `006` setup the initial structure. Migrations `007` to `026` add advanced application features:

### Migration 007 to 026 Breakdown

| Migration | File | Key Capabilities Added |
| :--- | :--- | :--- |
| **007** | `007_drink_brand.sql` | Extends `drink_logs` with `brand` (text) and `rating` (integer, 1-10) for deeper quality profiling of logged beverages. |
| **008** | `008_event_name.sql` | Adds an `event_name` text column to associate logs with events (e.g., "Oktoberfest"). Updates the central `get_feed()` DB function to include this. |
| **009** | `009_security_fixes.sql` | Enforces `security_invoker = true` on the `profile_counts` view, running queries with invoker privileges instead of definer to comply with PostgreSQL RLS security best practices. |
| **010** | `010_onboarding_fields.sql` | Adds onboarding fields to user `profiles` including `height` (numeric), `height_unit` ('cm', 'in'), `weight` (numeric), `weight_unit` ('kg', 'lb'), `age` (integer), and `onboarded` (boolean) to prepare for high-fidelity BAC calculation. |
| **011** | `011_drink_log_ended_at.sql` | Introduces the `ended_at` TIMESTAMPTZ column to support time-range drink durations (e.g., logging a 4-drink session over 3 hours) and adjusts `get_feed()`. |
| **012** | `012_displayed_badge.sql` | Implements user-showcase capability by adding a single `displayed_badge` reference to profiles. |
| **013** | `013_top_three_badges.sql` | Upgrades single badge showcases to support up to 3 badges simultaneously using a Postgres text array `displayed_badges text[]`. |
| **014** | `014_expanded_stats.sql` | Enhances `get_user_stats()` to compute deep temporal statistics: weekly limits, drinks by day of week, hour distribution, and favorite drink category counts. |
| **015** | `015_country_tracking.sql` | Adds global mapping capability by tracking `location_country_code` on logs. |
| **016** | `016_stats_countries.sql` | Upgrades statistics calculations to include `unique_countries_count` in user metrics. |
| **017** | `017_early_bird_refine.sql` | Adjusts statistical tracking filters for the "Early Bird" badge window to 10:00 AM \\u2013 3:00 PM. |
| **018** | `018_early_bird_refine_v2.sql` | Fine-tunes the "Early Bird" metric tracking window to encompass 10:00 AM \\u2013 4:00 PM. |
| **019** | `019_add_more_drink_types.sql` | Refactors drinking categorization logic. Incorporates hydration tracking and non-alcoholic drinks: `water`, `soft_drink`, `mocktail`, `non_alcoholic`, and `other` into the database. Updates streaks and milestone statistics to specifically ignore non-alcoholic categories. |
| **019-Feed**| `019_feed_badges.sql` | Re-integrates displayed user badge arrays (`displayed_badges`) directly into the returned payloads of the central `get_feed()` function. |
| **020** | `020_stats_weekly_limit.sql` | Links `get_user_stats()` directly with custom target variables (`weekly_limit`) configured dynamically in the `goals` table. |
| **021** | `021_hydration_stats.sql` | Enhances overall analytics tracking to monitor water intake versus alcohol intake, calculating precise per-day hydration rates. |
| **022** | `022_consistency_king_stats.sql` | Updates metric outputs to track user profile creation times (`user_created_at`), hydration metrics, and goals update timestamps. |
| **023** | `023_delete_account.sql` | Implements secure, GDPR-compliant account deletion. Exposes a `SECURITY DEFINER` SQL function `delete_account()` that safely and completely purges the caller's auth record in `auth.users`, cascading deletions to clear all profiles, drink logs, comments, and likes. |
| **024** | `024_birthdate.sql` | Discards static `age` integers in favor of an accurate `birthdate` (date) field, allowing dynamic calculations of blood-alcohol levels based on precise ages over time. |
| **025** | `025_social_interactions.sql` | Adds complete social interaction features. Introduces `drink_likes` and `drink_comments` tables, custom PostgreSQL performance indices, strict Row Level Security (RLS) policies, and updates `get_feed()` to retrieve live social engagement tallies. |
| **026** | `026_photo_urls.sql` | Upgrades basic single-photo logging to comprehensive multi-photo logging. Replaces singular `photo_url` references with `photo_urls` text arrays (allowing up to 3 photos per drink log). Standardizes existing entries with robust SQL backfilling. |

---

## \\u2709\\ufe0f Resend Email Integration Setup

Suds leverages **Resend** to send automated, high-deliverability transactional emails (such as welcome messages on user registration).

### Configuration & Architecture

1. **Supabase Edge Function (`supabase/functions/send-signup-email/index.ts`)**:
   A serverless TypeScript function listening on triggers/HTTP queries that accepts account details and submits templates directly to Resend's API.
2. **Client Email Hook (`src/hooks/useAuth.ts` & `src/lib/email.ts`)**:
   An asynchronous, non-blocking client hook wrapper. On successful user registration, the app pushes user details asynchronously to the Edge Function to prevent delayed screen transitions.

### Setup and Deployment

To configure Resend for your environment, follow these steps:

#### Step 1: Install the Supabase CLI
Ensure you have the Supabase CLI installed globally:
```bash
npm install -g supabase
```

#### Step 2: Link Your Remote Project
Connect the CLI to your hosted Supabase instance:
```bash
supabase link --project-ref gbenibgytweskljxneup
```
*(Enter your database password when prompted)*

#### Step 3: Register Environment Variables & Secrets
Securely store your Resend API credentials directly in Supabase using the CLI:
```bash
# Set the mandatory Resend API key environment variable
supabase secrets set RESEND_API_KEY=re_XjZvRdFu_KcAb8vkbq2Bzq76fdRrpdr9z

# (Optional) Customize the transactional sender address
supabase secrets set RESEND_FROM_EMAIL=noreply@drink-with-suds.com
```

#### Step 4: Deploy the Serverless Edge Function
Deploy the function to the Supabase Edge infrastructure:
```bash
supabase functions deploy send-signup-email
```

#### Step 5: Verify & Test Setup
You can invoke the deployed function manually to confirm delivery:
```bash
# Send a test registration payload
curl -i --location --request POST 'https://gbenibgytweskljxneup.supabase.co/functions/v1/send-signup-email' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"record":{"id":"test-uuid","email":"your-email@example.com","raw_user_meta_data":{"username":"testuser"}}}'
```

---

## \\U0001f680 Installation & Getting Started

### 1. Prerequisites
- **Node.js**: (LTS v18+ recommended)
- **Git**
- **Supabase Account**
- **RevenueCat Account** (for premium subscriptions)

### 2. Local Setup & Configuration
1. **Clone the repository**:
   ```bash
   git clone https://github.com/mjkgreen/suds.git
   cd suds
   ```
2. **Install all packages**:
   ```bash
   npm install
   ```
3. **Configure Environment Variables**:
   Duplicate `.env.example` as `.env` and configure credentials:
   ```bash
   cp .env.example .env
   ```

#### Complete Environment Configuration File (`.env`)
Fill in the following environment properties:
```env
# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# RevenueCat Configurations
EXPO_PUBLIC_RC_IOS_KEY=your_revenuecat_ios_public_api_key
EXPO_PUBLIC_RC_ANDROID_KEY=your_revenuecat_android_public_api_key

# Authentication Host URL
EXPO_PUBLIC_AUTH_URL=http://localhost:8081

# Google OAuth Keys
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=google_web_client_id_here
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=google_ios_client_id_here

# Resend Mail Configuration (Used inside edge functions/environments)
RESEND_API_KEY=re_XjZvRdFu_KcAb8vkbq2Bzq76fdRrpdr9z
```

---

## \\U0001f4f1 Running the App

Start the Expo bundler:
```bash
npm run start
```

- **iOS Development**: Press `i` to boot inside the iOS Simulator (macOS required).
- **Android Development**: Press `a` to open within the Android Emulator.
- **Web Development**: Press `w` to spin up a web build in your local browser.
- **Physical Device**: Scan the console QR code using the **Expo Go** application.

---

## \\U0001f4c4 License
This repository is licensed under the MIT License - see the `LICENSE` file for details.
"""

# Decode unicode escape sequences so the actual characters/emojis are written to the file
decoded_content = readme_content.encode('utf-8').decode('unicode_escape')

with open('README.md', 'w', encoding='utf-8') as f:
    f.write(decoded_content)

print("Successfully wrote README.md in UTF-8 encoding!")
