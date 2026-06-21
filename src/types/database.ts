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
          height: number | null;
          height_unit: string | null;
          weight: number | null;
          weight_unit: string | null;
          birthdate: string | null;
          onboarded: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          display_name?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          height?: number | null;
          height_unit?: string | null;
          weight?: number | null;
          weight_unit?: string | null;
          birthdate?: string | null;
          onboarded?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          username?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          height?: number | null;
          height_unit?: string | null;
          weight?: number | null;
          weight_unit?: string | null;
          birthdate?: string | null;
          onboarded?: boolean;
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
          ended_at: string | null;
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
          ended_at?: string | null;
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
          ended_at?: string | null;
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
      push_tokens: {
        Row: {
          id: string;
          user_id: string;
          token: string;
          platform: 'ios' | 'android';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          token: string;
          platform: 'ios' | 'android';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          token?: string;
          platform?: 'ios' | 'android';
          updated_at?: string;
        };
      };
      notification_preferences: {
        Row: {
          user_id: string;
          notify_likes: boolean;
          notify_comments: boolean;
          notify_follows: boolean;
          notify_session_invites: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          notify_likes?: boolean;
          notify_comments?: boolean;
          notify_follows?: boolean;
          notify_session_invites?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          notify_likes?: boolean;
          notify_comments?: boolean;
          notify_follows?: boolean;
          notify_session_invites?: boolean;
          updated_at?: string;
        };
      };
      session_members: {
        Row: {
          session_id: string;
          user_id: string;
          role: 'host' | 'guest';
          joined_at: string;
        };
        Insert: {
          session_id: string;
          user_id: string;
          role: 'host' | 'guest';
          joined_at?: string;
        };
        Update: {
          role?: 'host' | 'guest';
        };
      };
      session_invites: {
        Row: {
          id: string;
          session_id: string;
          inviter_id: string;
          invitee_id: string;
          status: 'pending' | 'accepted' | 'declined';
          token: string;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          inviter_id: string;
          invitee_id: string;
          status?: 'pending' | 'accepted' | 'declined';
          token?: string;
          expires_at?: string;
          created_at?: string;
        };
        Update: {
          status?: 'pending' | 'accepted' | 'declined';
        };
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_feed: {
        Args: { p_user_id: string; p_limit: number; p_offset: number };
        Returns: {
          id: string;
          user_id: string;
          drink_type: string;
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
          logged_at: string;
          ended_at: string | null;
          created_at: string;
          username: string;
          display_name: string | null;
          avatar_url: string | null;
          session_id: string | null;
          session_title: string | null;
        }[];
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
      get_my_active_session: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          user_id: string;
          title: string | null;
          started_at: string;
          ended_at: string | null;
          created_at: string;
          my_role: 'host' | 'guest';
        }[];
      };
      get_session_members_with_profiles: {
        Args: { p_session_id: string };
        Returns: {
          user_id: string;
          role: 'host' | 'guest';
          joined_at: string;
          username: string;
          display_name: string | null;
          avatar_url: string | null;
        }[];
      };
      get_invite_preview: {
        Args: { p_token: string };
        Returns: Record<string, unknown>;
      };
      accept_session_invite: {
        Args: { p_token: string };
        Returns: Record<string, unknown>;
      };
    };
    Enums: Record<string, never>;
  };
}
