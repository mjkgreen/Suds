export type DrinkType =
  | 'beer'
  | 'wine'
  | 'cocktail'
  | 'spirit'
  | 'cider'
  | 'seltzer'
  | 'other';

export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
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
  quantity: number;
  location_name: string | null;
  location_lat: number | null;
  location_lng: number | null;
  notes: string | null;
  photo_url: string | null;
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

export type LogDrinkFormData = {
  drink_type: DrinkType;
  drink_name: string;
  quantity: number;
  location_name: string;
  location_lat?: number;
  location_lng?: number;
  notes: string;
  photo_url?: string;
};
