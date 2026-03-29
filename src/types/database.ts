// Auto-generated Supabase types placeholder.
// Run: npx supabase gen types typescript --local > src/types/database.ts
// after running migrations against your local Supabase instance.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          display_name: string | null;
          avatar_url: string | null;
          bio: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          display_name?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          username?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          updated_at?: string;
        };
      };
      drink_logs: {
        Row: {
          id: string;
          user_id: string;
          drink_type: string;
          drink_name: string | null;
          quantity: number;
          location_name: string | null;
          location_lat: number | null;
          location_lng: number | null;
          notes: string | null;
          photo_url: string | null;
          session_id: string | null;
          logged_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          drink_type: string;
          drink_name?: string | null;
          quantity: number;
          location_name?: string | null;
          location_lat?: number | null;
          location_lng?: number | null;
          notes?: string | null;
          photo_url?: string | null;
          session_id?: string | null;
          logged_at?: string;
          created_at?: string;
        };
        Update: {
          drink_type?: string;
          drink_name?: string | null;
          quantity?: number;
          location_name?: string | null;
          location_lat?: number | null;
          location_lng?: number | null;
          notes?: string | null;
          photo_url?: string | null;
          session_id?: string | null;
          logged_at?: string;
        };
      };
      follows: {
        Row: {
          follower_id: string;
          following_id: string;
          created_at: string;
        };
        Insert: {
          follower_id: string;
          following_id: string;
          created_at?: string;
        };
        Update: never;
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_feed: {
        Args: { p_user_id: string; p_limit: number; p_offset: number };
        Returns: (Database['public']['Tables']['drink_logs']['Row'] & {
          username: string;
          display_name: string | null;
          avatar_url: string | null;
          session_title: string | null;
        })[];
      };
      get_user_stats: {
        Args: { p_user_id: string };
        Returns: {
          total_drinks: number;
          total_quantity: number;
          drinks_this_week: number;
          drinks_this_month: number;
        }[];
      };
    };
    Enums: Record<string, never>;
  };
}
