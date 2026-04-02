export type DrinkType =
  | 'beer'
  | 'wine'
  | 'cocktail'
  | 'spirit'
  | 'cider'
  | 'seltzer'
  | 'other';

export type SubscriptionTier = 'free' | 'premium';

export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  subscription_tier: SubscriptionTier;
  created_at: string;
  updated_at: string;
  // Computed at query time
  followers_count?: number;
  following_count?: number;
  is_following?: boolean;
}

export interface DrinkLog {
  id: string;
  user_id: string;
  drink_type: DrinkType;
  drink_name: string | null;
  brand: string | null;
  quantity: number;
  location_name: string | null;
  location_lat: number | null;
  location_lng: number | null;
  notes: string | null;
  photo_url: string | null;
  rating: number | null;
  event_name: string | null;
  session_id: string | null;
  logged_at: string;
  created_at: string;
  // Joined
  profile?: Profile;
}

export interface Follow {
  follower_id: string;
  following_id: string;
  created_at: string;
}

export interface DrinkTypeStats {
  drink_type: DrinkType;
  count: number;
}

export interface ActivityDay {
  date: string;
  count: number;
}

export interface UserStats {
  total_drinks: number;
  total_quantity: number;
  favorite_drink_types: DrinkTypeStats[];
  drinks_this_week: number;
  drinks_this_month: number;
  activity_by_day: ActivityDay[];
}

export interface FeedItem extends DrinkLog {
  profile: Profile;
  session_id?: string | null;
  session_title?: string | null;
}

export interface SessionFeedGroup {
  type: 'session';
  session_id: string;
  session_title: string | null;
  profile: Profile;
  items: FeedItem[];
  started_at: string;
  ended_at?: string | null;
}

export type FeedEntry =
  | { type: 'drink'; item: FeedItem }
  | SessionFeedGroup;

export interface Session {
  id: string;
  user_id: string;
  title: string | null;
  started_at: string;
  ended_at: string | null;
  created_at: string;
}

// ── Streaks ──────────────────────────────────────────────────
export interface StreakData {
  drink_streak: number;
  sober_streak: number;
  last_drink_date: string | null;
}

// ── Milestones ───────────────────────────────────────────────
export interface MilestoneData {
  total_drinks: number;
  latest_milestone: number | null;
  latest_earned_at: string | null;
  is_new: boolean;
  all_earned: number[];
  by_type: Partial<Record<DrinkType, number>>;
}

// ── Goals (free — moderation) ────────────────────────────────
export interface Goal {
  id: string;
  user_id: string;
  weekly_limit: number;
  created_at: string;
  updated_at: string;
}

// ── Advanced Stats (premium) ─────────────────────────────────
export interface WeeklyTrendPoint {
  week_start: string;
  count: number;
  total_quantity: number;
}

export interface MonthlyTrendPoint {
  month: string; // "YYYY-MM"
  count: number;
  total_quantity: number;
}

export interface DayOfWeekPoint {
  day_of_week: number; // 0 = Sunday
  count: number;
}

export interface HourPoint {
  hour: number;
  count: number;
}

export interface AdvancedStats {
  weekly_trend: WeeklyTrendPoint[];
  monthly_trend: MonthlyTrendPoint[];
  by_day_of_week: DayOfWeekPoint[];
  by_hour: HourPoint[];
  this_year_count: number;
  last_year_count: number;
  avg_per_week: number;
  best_session_count: number | null;
}

export type LogDrinkFormData = {
  event_name?: string;
  drink_type: DrinkType;
  drink_name: string;
  brand: string;
  quantity: number;
  location_name: string;
  location_lat?: number;
  location_lng?: number;
  notes: string;
  rating: number;
  photo_url?: string;
  logged_at?: string;
};
