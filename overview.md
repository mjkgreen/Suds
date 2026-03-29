# Suds Project Overview

Suds is designed as a modern React Native app utilizing Expo Router for navigation and Supabase as a backend-as-a-service.

## Directory Structure

- `app/`: Contains the Expo Router screen definitions including tab navigation (`(tabs)`), authentication flows (`(auth)`), and dynamic screens like drink details.
- `src/components/`: Reusable UI components.
  - `common/`: Buttons, Location Picker, Avatars.
  - `drink/`: Components specific to drink displays (Drink Badge, Drink Type Picker, etc.).
- `src/hooks/`: Custom React hooks, notably wrapping React Query for data fetching (`useDrinkLog.ts`, `useSession.ts`).
- `src/lib/`: Library configurations and wrappers such as Supabase client initialization (`supabase.ts`), query client config, and storage utilities.
- `src/stores/`: Global state management using Zustand (e.g., `authStore.ts`).
- `src/types/`: TypeScript definitions (`models.ts`).
- `assets/`: Image assets and icons.

## Data Flow & State Management

- **Authentication**: Managed through Supabase Auth, with the session state synchronized to a global Zustand store (`useAuthStore`).
- **Data Fetching/Mutations**: Component data fetching and Supabase database interactions are abstracted behind custom hooks using `TanStack React Query`. Query keys are invalidated eagerly on successful mutations to ensure the UI is fresh.
- **Forms**: Handled with `react-hook-form` for complex inputs, ensuring robust client-side validation and state encapsulation.
- **Storage**: Image uploads are dispatched to Supabase storage, returning public URLs which are subsequently saved to the PostgreSQL database.
