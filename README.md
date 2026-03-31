# Suds 🍺

**Suds** is the "Strava for drinking" — a social iOS and Android app for logging alcoholic beverages, following friends, and tracking your personal stats and streaks.

Built with **Expo**, **Supabase**, and **RevenueCat**, Suds combines habit tracking with a social layer to help you stay mindful and share your recreational drinking journey with friends.

---

## 🚀 Key Features

### 🆓 Free Tier
- **Drink Logging**: Log any drink (beer, wine, cocktail, spirit, etc.) with quantity, notes, and GPS location.
- **Social Feed**: Follow friends and see their activity in a real-time, infinite-scroll feed.
- **Heatmap**: View all your logged drinks on a native map.
- **Streaks & Goals**: Track drinking and sober streaks, and set weekly consumption goals.
- **Milestones**: Earn gamified badges for various drink counts and types.
- **Sessions**: Group multiple drinks into a single "Night Out" session.

### ⭐ Suds Plus (Premium)
- **Advanced Analytics**: Detailed trends by week/month, day-of-week, and year-over-year.
- **BAC Estimator**: Real-time blood alcohol content estimate based on your active session.
- **Full History**: Access your entire drinking history and historical trends.
- **Data Export**: Export your logs to CSV for personal use.

---

## 🛠️ Tech Stack

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

## 📂 Project Structure

```text
suds/
├── app/                # Expo Router screens (file-based routing)
│   ├── (auth)/         # Authentication screens
│   ├── (tabs)/         # Bottom tab navigation screens
│   └── user/           # User profile and edit screens
├── src/
│   ├── components/     # Reusable UI components (Atomic design)
│   ├── hooks/          # Custom hooks for data fetching & logic
│   ├── lib/            # Third-party service clients & constants
│   ├── stores/         # Zustand state management
│   └── types/          # TypeScript definitions & DB models
├── supabase/           # SQL migrations and DB logic
└── assets/             # Branding, icons, and static images
```

---

## 🏁 Getting Started

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

### 3. Backend Implementation
1. Go to your **Supabase Dashboard**.
2. Run the SQL migrations found in `/supabase/migrations/` sequentially (001-007) or use the **`combined.sql`** script for a fresh setup.
3. Enable the **PostGIS** extension in the Supabase extension dashboard.
4. Create a public storage bucket named **`avatars`**.

---

## 📱 Running the App

Run the development server:
```bash
npm run start
```

- **iOS**: Press `i` to open in Xcode Simulator (requires macOS).
- **Android**: Press `a` to open in Android Emulator.
- **Web**: Press `w` to open in your browser.
- **Physical Device**: Scan the QR code with the **Expo Go** app.

---

## 📄 License
This project is licensed under the MIT License - see the LICENSE file for details.

