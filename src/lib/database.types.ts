// Generated from the Supabase schema (Supabase MCP generate_typescript_types).
// Regenerate after schema changes: npx supabase gen types typescript --project-id ivusybbjhtegrlzftdma

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      bookings: {
        Row: {
          cancellation_reason: string | null
          cancelled_at: string | null
          channel_ref: string | null
          created_at: string
          customer_id: string
          ends_at: string
          id: string
          notes: string | null
          price: number
          public_token: string
          salon_id: string
          service_id: string
          source: string
          specialist_id: string
          starts_at: string
          status: Database["public"]["Enums"]["booking_status"]
          status_changed_at: string
          updated_at: string
        }
        Insert: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          channel_ref?: string | null
          created_at?: string
          customer_id: string
          ends_at: string
          id?: string
          notes?: string | null
          price: number
          salon_id: string
          service_id: string
          specialist_id: string
          starts_at: string
          status?: Database["public"]["Enums"]["booking_status"]
          status_changed_at?: string
          updated_at?: string
        }
        Update: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          channel_ref?: string | null
          created_at?: string
          customer_id?: string
          ends_at?: string
          id?: string
          notes?: string | null
          price?: number
          salon_id?: string
          service_id?: string
          specialist_id?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["booking_status"]
          status_changed_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_customer_id_salon_id_fkey"
            columns: ["customer_id", "salon_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id", "salon_id"]
          },
          {
            foreignKeyName: "bookings_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_service_id_salon_id_fkey"
            columns: ["service_id", "salon_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id", "salon_id"]
          },
          {
            foreignKeyName: "bookings_specialist_id_salon_id_fkey"
            columns: ["specialist_id", "salon_id"]
            isOneToOne: false
            referencedRelation: "specialists"
            referencedColumns: ["id", "salon_id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          notes: string | null
          phone: string
          salon_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id?: string
          notes?: string | null
          phone: string
          salon_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          notes?: string | null
          phone?: string
          salon_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      salon_integrations: {
        Row: {
          api_key_created_at: string | null
          api_key_prefix: string | null
          created_at: string
          enabled: boolean
          last_used_at: string | null
          last_webhook_at: string | null
          last_webhook_status: string | null
          salon_id: string
          telegram_bot_username: string | null
          updated_at: string
          webhook_secret: string
          webhook_url: string | null
        }
        Insert: {
          enabled?: boolean
          salon_id: string
          telegram_bot_username?: string | null
          webhook_url?: string | null
        }
        Update: {
          enabled?: boolean
          last_webhook_at?: string | null
          last_webhook_status?: string | null
          telegram_bot_username?: string | null
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "salon_integrations_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: true
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      salons: {
        Row: {
          address: string | null
          auto_confirm_bookings: boolean
          city: string | null
          created_at: string
          currency: string
          description: string | null
          email: string | null
          id: string
          is_published: boolean
          logo_url: string | null
          name: string
          owner_id: string
          phone: string | null
          slug: string
          status: Database["public"]["Enums"]["salon_status"]
          timezone: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          auto_confirm_bookings?: boolean
          city?: string | null
          created_at?: string
          currency: string
          description?: string | null
          email?: string | null
          id?: string
          is_published?: boolean
          logo_url?: string | null
          name: string
          owner_id: string
          phone?: string | null
          slug: string
          status?: Database["public"]["Enums"]["salon_status"]
          timezone: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          auto_confirm_bookings?: boolean
          city?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          email?: string | null
          id?: string
          is_published?: boolean
          logo_url?: string | null
          name?: string
          owner_id?: string
          phone?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["salon_status"]
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "salons_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          is_active: boolean
          name: string
          price: number
          salon_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_minutes: number
          id?: string
          is_active?: boolean
          name: string
          price: number
          salon_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          salon_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      specialist_services: {
        Row: {
          salon_id: string
          service_id: string
          specialist_id: string
        }
        Insert: {
          salon_id: string
          service_id: string
          specialist_id: string
        }
        Update: {
          salon_id?: string
          service_id?: string
          specialist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "specialist_services_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "specialist_services_service_id_salon_id_fkey"
            columns: ["service_id", "salon_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id", "salon_id"]
          },
          {
            foreignKeyName: "specialist_services_specialist_id_salon_id_fkey"
            columns: ["specialist_id", "salon_id"]
            isOneToOne: false
            referencedRelation: "specialists"
            referencedColumns: ["id", "salon_id"]
          },
        ]
      }
      specialists: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          salon_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          full_name: string
          id?: string
          is_active?: boolean
          salon_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          salon_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "specialists_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_events: {
        Row: {
          actor_id: string | null
          created_at: string
          details: Json
          event: string
          id: number
          salon_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          details?: Json
          event: string
          salon_id: string
        }
        Update: {
          actor_id?: string | null
          details?: Json
          event?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_events_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          payment_provider: string | null
          plan: string
          provider_customer_id: string | null
          provider_subscription_id: string | null
          salon_id: string
          status: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at: string
          trial_starts_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          payment_provider?: string | null
          plan?: string
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          salon_id: string
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string
          trial_starts_at?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          payment_provider?: string | null
          plan?: string
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          salon_id?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string
          trial_starts_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: true
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      time_off: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          reason: string | null
          salon_id: string
          specialist_id: string | null
          starts_at: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          reason?: string | null
          salon_id: string
          specialist_id?: string | null
          starts_at: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          reason?: string | null
          salon_id?: string
          specialist_id?: string | null
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_off_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_off_specialist_id_salon_id_fkey"
            columns: ["specialist_id", "salon_id"]
            isOneToOne: false
            referencedRelation: "specialists"
            referencedColumns: ["id", "salon_id"]
          },
        ]
      }
      working_hours: {
        Row: {
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          salon_id: string
          specialist_id: string | null
          start_time: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          salon_id: string
          specialist_id?: string | null
          start_time: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          salon_id?: string
          specialist_id?: string | null
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "working_hours_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "working_hours_specialist_id_salon_id_fkey"
            columns: ["specialist_id", "salon_id"]
            isOneToOne: false
            referencedRelation: "specialists"
            referencedColumns: ["id", "salon_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      api_availability: {
        Args: { p_api_key: string; p_date: string; p_service_id: string; p_specialist_id?: string | null }
        Returns: Json
      }
      api_cancel_booking: { Args: { p_api_key: string; p_booking_id: string }; Returns: Json }
      api_create_booking: {
        Args: {
          p_api_key: string
          p_channel_ref?: string | null
          p_email: string
          p_full_name: string
          p_idempotency_key?: string | null
          p_notes?: string | null
          p_phone: string
          p_service_id: string
          p_specialist_id: string | null
          p_starts_at: string
        }
        Returns: Json
      }
      api_get_booking: { Args: { p_api_key: string; p_booking_id: string }; Returns: Json }
      api_salon_info: { Args: { p_api_key: string }; Returns: Json }
      api_services: { Args: { p_api_key: string }; Returns: Json }
      api_specialists: { Args: { p_api_key: string; p_service_id?: string | null }; Returns: Json }
      cancel_booking_by_token: { Args: { p_token: string }; Returns: Json }
      create_booking: {
        Args: {
          p_email: string
          p_full_name: string
          p_notes?: string | null
          p_phone: string
          p_salon_id: string
          p_service_id: string
          p_specialist_id: string | null
          p_starts_at: string
        }
        Returns: Json
      }
      get_available_slots: {
        Args: { p_date: string; p_salon_id: string; p_service_id: string; p_specialist_id: string | null }
        Returns: { ends_at: string; specialist_id: string; specialist_name: string; starts_at: string }[]
      }
      get_booking_by_token: { Args: { p_token: string }; Returns: Json }
      rotate_integration_key: { Args: { p_salon_id: string }; Returns: string }
      rotate_webhook_secret: { Args: { p_salon_id: string }; Returns: undefined }
    }
    Enums: {
      app_role: "super_admin" | "salon_owner"
      booking_status: "pending" | "confirmed" | "cancelled"
      salon_status: "active" | "suspended"
      subscription_status:
        | "trialing"
        | "active"
        | "past_due"
        | "suspended"
        | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database["public"]

export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"]
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T]
