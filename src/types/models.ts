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
