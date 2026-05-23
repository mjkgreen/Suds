# Suds \U0001f37a

**Suds** is the social app for logging alcoholic beverages, following friends, and tracking your personal stats and streaks.

Built with **Expo**, **Supabase**, and **RevenueCat**, Suds combines habit tracking with a social layer to help you stay mindful and share your recreational drinking journey with friends.

---

## \U0001f680 Key Features

### \U0001f193 Free Tier
- **Drink Logging**: Log any drink (beer, wine, cocktail, spirit, etc.) with quantity, notes, and GPS location.
- **Social Feed**: Follow friends and see their activity in a real-time, infinite-scroll feed.
- **Heatmap**: View all your logged drinks on a native map.
- **Streaks & Goals**: Track drinking and sober streaks, and set weekly consumption goals.
- **Milestones**: Earn gamified badges for various drink counts and types.
- **Sessions**: Group multiple drinks into a single "Night Out" session.

### \u2b50 Suds Plus (Premium)
- **Advanced Analytics**: Detailed trends by week/month, day-of-week, and year-over-year.
- **BAC Estimator**: Real-time blood alcohol content estimate based on your active session.
- **Full History**: Access your entire drinking history and historical trends.
- **Data Export**: Export your logs to CSV for personal use.

---

## \U0001f6e0\ufe0f Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | [Expo](https://expo.dev) (SDK 54+) / React Native |
| **Routing** | Expo Router v3 |
| **Backend** | [Supabase](https://supabase.com/) (PostgreSQL + PostGIS, Auth, Storage) |
| **Data Fetching** | [TanStack Query v5](https://tanstack.com/query/latest) |
| **Global State** | [Zustand](https://github.com/pmndrs/zustand) |
| **Styling** | [NativeWind v4](https://www.nativewind.dev/) (Tailwind CSS) |
| **Payments** | [RevenueCat](https://www.revenuecat.com/) |
| **Build/Deploy** | EAS (Expo Application Services) |

---

## \U0001f4c2 Project Structure

```text
suds/
\u251c\u2500\u2500 app/                # Expo Router screens (file-based routing)
\u2502   \u251c\u2500\u2500 (auth)/         # Authentication screens
\u2502   \u251c\u2500\u2500 (tabs)/         # Bottom tab navigation screens
\u2502   \u2514\u2500\u2500 user/           # User profile and edit screens
\u251c\u2500\u2500 src/
\u2502   \u251c\u2500\u2500 components/     # Reusable UI components (Atomic design)
\u2502   \u251c\u2500\u2500 hooks/          # Custom hooks for data fetching & logic
\u2502   \u251c\u2500\u2500 lib/            # Third-party service clients & constants
\u2502   \u251c\u2500\u2500 stores/         # Zustand state management
\u2502   \u2514\u2500\u2500 types/          # TypeScript definitions & DB models
\u251c\u2500\u2500 supabase/           # SQL migrations and DB logic
\u2514\u2500\u2500 assets/             # Branding, icons, and static images
```

---

## \U0001f3c1 Getting Started

### 1. Prerequisites
- **Node.js**: (LTS recommended)
- **Git**
- **Supabase Account**
- **RevenueCat Account** (for premium features)

### 2. Local Setup
1. **Clone the repository**:
   ```bash
   git clone https://github.com/mjkgreen/suds.git
   cd suds
   ```
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Configure Environment Variables**:
   Create a `.env` file in the root directory based on `.env.example`:
   ```bash
   cp .env.example .env
   ```
   Fill in your Supabase and RevenueCat credentials:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - `EXPO_PUBLIC_RC_IOS_KEY`
   - `EXPO_PUBLIC_RC_ANDROID_KEY`

### 3. Environment Variables (full list)
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - `EXPO_PUBLIC_RC_IOS_KEY`
   - `EXPO_PUBLIC_RC_ANDROID_KEY`
   - `EXPO_PUBLIC_AUTH_URL` \u2014 set to `http://localhost:8081` in dev, `https://drink-with-suds.com` in prod
   - `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` \u2014 Google OAuth Web client ID
   - `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` \u2014 Google OAuth iOS client ID

### 4. Backend Implementation
1. Go to your **Supabase Dashboard**.
2. Run the SQL migrations found in `/supabase/migrations/` sequentially (001-007) or use the **`combined.sql`** script for a fresh setup.
3. Enable the **PostGIS** extension in the Supabase extension dashboard.
4. Create a public storage bucket named **`avatars`**.

---

## \U0001f310 Production

**Live at:** [drink-with-suds.com](https://drink-with-suds.com)

- Set `EXPO_PUBLIC_AUTH_URL=https://drink-with-suds.com` in your prod environment
- Google OAuth redirect URI (in Google Cloud Console): `https://gbenibgytweskljxneup.supabase.co/auth/v1/callback`
- Apple web OAuth (Services ID return URL): `https://gbenibgytweskljxneup.supabase.co/auth/v1/callback`

---

## \U0001f4f1 Running the App

Run the development server:
```bash
npm run start
```

- **iOS**: Press `i` to open in Xcode Simulator (requires macOS).
- **Android**: Press `a` to open in Android Emulator.
- **Web**: Press `w` to open in your browser.
- **Physical Device**: Scan the QR code with the **Expo Go** app.

---

## \U0001f4c4 License
This project is licensed under the MIT License - see the LICENSE file for details.

