export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      categories: {
        Row: {
          label_en: string
          label_th: string
          query: Json
          slug: string
        }
        Insert: {
          label_en: string
          label_th: string
          query: Json
          slug: string
        }
        Update: {
          label_en?: string
          label_th?: string
          query?: Json
          slug?: string
        }
        Relationships: []
      }
      category_players: {
        Row: {
          category_slug: string
          player_id: string
        }
        Insert: {
          category_slug: string
          player_id: string
        }
        Update: {
          category_slug?: string
          player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_players_category_slug_fkey"
            columns: ["category_slug"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "category_players_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "football_players"
            referencedColumns: ["id"]
          },
        ]
      }
      content_packs: {
        Row: {
          created_at: string
          display_name: string
          display_name_th: string | null
          enabled: boolean
          handler: string
          slug: string
          source_ref: string
        }
        Insert: {
          created_at?: string
          display_name: string
          display_name_th?: string | null
          enabled?: boolean
          handler: string
          slug: string
          source_ref: string
        }
        Update: {
          created_at?: string
          display_name?: string
          display_name_th?: string | null
          enabled?: boolean
          handler?: string
          slug?: string
          source_ref?: string
        }
        Relationships: []
      }
      football_players: {
        Row: {
          aliases: string[]
          birth_date: string | null
          career_goals: number | null
          difficulty_tier: number
          id: string
          name: string
          name_th: string | null
          nationalities: string[]
          position: string | null
          sitelinks: number
        }
        Insert: {
          aliases?: string[]
          birth_date?: string | null
          career_goals?: number | null
          difficulty_tier: number
          id: string
          name: string
          name_th?: string | null
          nationalities?: string[]
          position?: string | null
          sitelinks?: number
        }
        Update: {
          aliases?: string[]
          birth_date?: string | null
          career_goals?: number | null
          difficulty_tier?: number
          id?: string
          name?: string
          name_th?: string | null
          nationalities?: string[]
          position?: string | null
          sitelinks?: number
        }
        Relationships: []
      }
      game_insider_responses: {
        Row: {
          created_at: string
          id: number
          response: string
          room_id: string
          round_number: number
        }
        Insert: {
          created_at?: string
          id?: number
          response: string
          room_id: string
          round_number: number
        }
        Update: {
          created_at?: string
          id?: number
          response?: string
          room_id?: string
          round_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "game_insider_responses_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      game_insider_roles: {
        Row: {
          player_id: string
          role: string
          room_id: string
          round_number: number
        }
        Insert: {
          player_id: string
          role: string
          room_id: string
          round_number: number
        }
        Update: {
          player_id?: string
          role?: string
          room_id?: string
          round_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "game_insider_roles_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      game_insider_room_config: {
        Row: {
          created_at: string
          pack_slug: string
          room_id: string
          round_count: number
          time_limit_s: number
        }
        Insert: {
          created_at?: string
          pack_slug: string
          room_id: string
          round_count: number
          time_limit_s: number
        }
        Update: {
          created_at?: string
          pack_slug?: string
          room_id?: string
          round_count?: number
          time_limit_s?: number
        }
        Relationships: [
          {
            foreignKeyName: "game_insider_room_config_pack_slug_fkey"
            columns: ["pack_slug"]
            isOneToOne: false
            referencedRelation: "content_packs"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "game_insider_room_config_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: true
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      game_insider_round: {
        Row: {
          eligible_voter_ids: string[] | null
          guessed_at: string | null
          guessed_by_player_id: string | null
          outcome: string | null
          pack_slug: string
          phase: string
          room_id: string
          round_number: number
          scored_at: string | null
          secret_value: string
          started_at: string | null
          time_limit_s: number
          vote_deadline: string | null
        }
        Insert: {
          eligible_voter_ids?: string[] | null
          guessed_at?: string | null
          guessed_by_player_id?: string | null
          outcome?: string | null
          pack_slug: string
          phase?: string
          room_id: string
          round_number: number
          scored_at?: string | null
          secret_value: string
          started_at?: string | null
          time_limit_s: number
          vote_deadline?: string | null
        }
        Update: {
          eligible_voter_ids?: string[] | null
          guessed_at?: string | null
          guessed_by_player_id?: string | null
          outcome?: string | null
          pack_slug?: string
          phase?: string
          room_id?: string
          round_number?: number
          scored_at?: string | null
          secret_value?: string
          started_at?: string | null
          time_limit_s?: number
          vote_deadline?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_insider_round_pack_slug_fkey"
            columns: ["pack_slug"]
            isOneToOne: false
            referencedRelation: "content_packs"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "game_insider_round_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      game_insider_votes: {
        Row: {
          room_id: string
          round_number: number
          voted_at: string
          voted_player_id: string
          voter_player_id: string
        }
        Insert: {
          room_id: string
          round_number: number
          voted_at?: string
          voted_player_id: string
          voter_player_id: string
        }
        Update: {
          room_id?: string
          round_number?: number
          voted_at?: string
          voted_player_id?: string
          voter_player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_insider_votes_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      player_clubs: {
        Row: {
          club_name: string
          player_id: string
        }
        Insert: {
          club_name: string
          player_id: string
        }
        Update: {
          club_name?: string
          player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_clubs_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "football_players"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          connected: boolean | null
          display_name: string
          id: string
          join_order: number
          player_id: string
          room_id: string | null
          total_score: number | null
        }
        Insert: {
          connected?: boolean | null
          display_name: string
          id?: string
          join_order: number
          player_id: string
          room_id?: string | null
          total_score?: number | null
        }
        Update: {
          connected?: boolean | null
          display_name?: string
          id?: string
          join_order?: number
          player_id?: string
          room_id?: string | null
          total_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "players_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          category: string
          category_locked: boolean
          code: string
          created_at: string | null
          current_round: number | null
          difficulty: string
          effective_score_positions: number | null
          game_type: string
          host_player_id: string | null
          id: string
          max_rounds: number
          rounds_locked: boolean
          score_positions: number
          status: Database["public"]["Enums"]["room_status"] | null
        }
        Insert: {
          category?: string
          category_locked?: boolean
          code: string
          created_at?: string | null
          current_round?: number | null
          difficulty?: string
          effective_score_positions?: number | null
          game_type?: string
          host_player_id?: string | null
          id?: string
          max_rounds: number
          rounds_locked?: boolean
          score_positions: number
          status?: Database["public"]["Enums"]["room_status"] | null
        }
        Update: {
          category?: string
          category_locked?: boolean
          code?: string
          created_at?: string | null
          current_round?: number | null
          difficulty?: string
          effective_score_positions?: number | null
          game_type?: string
          host_player_id?: string | null
          id?: string
          max_rounds?: number
          rounds_locked?: boolean
          score_positions?: number
          status?: Database["public"]["Enums"]["room_status"] | null
        }
        Relationships: []
      }
      round_events: {
        Row: {
          created_at: string | null
          guess_text: string | null
          id: number
          player_id: string
          position: number | null
          room_id: string | null
          round_number: number
          type: Database["public"]["Enums"]["event_type"]
        }
        Insert: {
          created_at?: string | null
          guess_text?: string | null
          id?: number
          player_id: string
          position?: number | null
          room_id?: string | null
          round_number: number
          type: Database["public"]["Enums"]["event_type"]
        }
        Update: {
          created_at?: string | null
          guess_text?: string | null
          id?: number
          player_id?: string
          position?: number | null
          room_id?: string | null
          round_number?: number
          type?: Database["public"]["Enums"]["event_type"]
        }
        Relationships: [
          {
            foreignKeyName: "round_events_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      round_positions: {
        Row: {
          next_position: number | null
          room_id: string
          round_number: number
        }
        Insert: {
          next_position?: number | null
          room_id: string
          round_number: number
        }
        Update: {
          next_position?: number | null
          room_id?: string
          round_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "round_positions_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      round_state: {
        Row: {
          assigned_name: string
          final_position: number | null
          id: string
          is_active: boolean | null
          is_correct: boolean | null
          player_id: string
          room_id: string | null
          round_number: number
          score_this_round: number | null
        }
        Insert: {
          assigned_name: string
          final_position?: number | null
          id?: string
          is_active?: boolean | null
          is_correct?: boolean | null
          player_id: string
          room_id?: string | null
          round_number: number
          score_this_round?: number | null
        }
        Update: {
          assigned_name?: string
          final_position?: number | null
          id?: string
          is_active?: boolean | null
          is_correct?: boolean | null
          player_id?: string
          room_id?: string | null
          round_number?: number
          score_this_round?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "round_state_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      word_pack_items: {
        Row: {
          metadata: Json
          pack_slug: string
          value: string
        }
        Insert: {
          metadata?: Json
          pack_slug: string
          value: string
        }
        Update: {
          metadata?: Json
          pack_slug?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "word_pack_items_pack_slug_fkey"
            columns: ["pack_slug"]
            isOneToOne: false
            referencedRelation: "word_packs"
            referencedColumns: ["slug"]
          },
        ]
      }
      word_packs: {
        Row: {
          created_at: string
          display_name: string
          display_name_th: string | null
          enabled: boolean
          slug: string
        }
        Insert: {
          created_at?: string
          display_name: string
          display_name_th?: string | null
          enabled?: boolean
          slug: string
        }
        Update: {
          created_at?: string
          display_name?: string
          display_name_th?: string | null
          enabled?: boolean
          slug?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      advance_to_asking: {
        Args: { p_player_id: string; p_room_id: string; p_round: number }
        Returns: undefined
      }
      advance_to_next_round: {
        Args: { p_player_id: string; p_room_id: string; p_round: number }
        Returns: number
      }
      advance_to_reveal: {
        Args: { p_room_id: string; p_round: number }
        Returns: undefined
      }
      advance_to_voting: {
        Args: { p_player_id: string; p_room_id: string; p_round: number }
        Returns: undefined
      }
      cast_vote: {
        Args: {
          p_player_id: string
          p_room_id: string
          p_round: number
          p_voted_player_id: string
        }
        Returns: undefined
      }
      change_insider_max_rounds: {
        Args: { p_max_rounds: number; p_player_id: string; p_room_id: string }
        Returns: undefined
      }
      change_insider_pack: {
        Args: { p_pack_slug: string; p_player_id: string; p_room_id: string }
        Returns: undefined
      }
      create_insider_room: {
        Args: {
          p_host_name: string
          p_host_player_id: string
          p_pack_slug: string
          p_round_count: number
          p_time_limit_s: number
        }
        Returns: {
          code: string
          player_id: string
        }[]
      }
      create_room: {
        Args: {
          p_host_name: string
          p_host_player_id: string
          p_max_rounds: number
          p_score_positions: number
        }
        Returns: {
          code: string
          player_id: string
        }[]
      }
      daitch_mokotoff: { Args: { "": string }; Returns: string[] }
      dmetaphone: { Args: { "": string }; Returns: string }
      dmetaphone_alt: { Args: { "": string }; Returns: string }
      expire_round: {
        Args: { p_room_id: string; p_round: number }
        Returns: number
      }
      get_my_insider_secret: {
        Args: { p_player_id: string; p_room_id: string; p_round: number }
        Returns: string
      }
      get_random_pack_item: {
        Args: { p_slug: string }
        Returns: {
          display_value: string
          item_id: string
          metadata: Json
        }[]
      }
      get_revealed_secret: {
        Args: { p_player_id: string; p_room_id: string; p_round: number }
        Returns: string
      }
      join_room: {
        Args: { p_code: string; p_display_name: string; p_player_id: string }
        Returns: {
          player_id: string
          room_id: string
        }[]
      }
      mark_correct_guess: {
        Args: { p_player_id: string; p_room_id: string; p_round: number }
        Returns: undefined
      }
      master_respond: {
        Args: {
          p_player_id: string
          p_response: string
          p_room_id: string
          p_round: number
        }
        Returns: undefined
      }
      next_round: {
        Args: { p_host_player_id: string; p_room_id: string }
        Returns: undefined
      }
      reconcile_round_phase: {
        Args: { p_room_id: string; p_round: number }
        Returns: undefined
      }
      reset_game: {
        Args: { p_host_player_id: string; p_room_id: string }
        Returns: undefined
      }
      reset_insider_game: {
        Args: { p_player_id: string; p_room_id: string }
        Returns: undefined
      }
      soundex: { Args: { "": string }; Returns: string }
      start_game: {
        Args: { p_host_player_id: string; p_room_id: string }
        Returns: undefined
      }
      start_insider_round: {
        Args: {
          p_pack_slug: string
          p_player_id: string
          p_room_id: string
          p_time_limit_s: number
        }
        Returns: number
      }
      start_round: {
        Args: { p_host_player_id: string; p_room_id: string }
        Returns: undefined
      }
      submit_guess: {
        Args: {
          p_guess: string
          p_player_id: string
          p_room_id: string
          p_round_number: number
        }
        Returns: {
          correct: boolean
          position: number
          score: number
        }[]
      }
      text_soundex: { Args: { "": string }; Returns: string }
      unaccent: { Args: { "": string }; Returns: string }
      update_room_settings: {
        Args: {
          p_category: string
          p_difficulty: string
          p_host_player_id: string
          p_max_rounds: number
          p_room_id: string
          p_score_positions: number
        }
        Returns: undefined
      }
    }
    Enums: {
      event_type: "GUESS_OK" | "FOUL" | "ROUND_END"
      room_status: "LOBBY" | "PLAYING" | "ENDED"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      event_type: ["GUESS_OK", "FOUL", "ROUND_END"],
      room_status: ["LOBBY", "PLAYING", "ENDED"],
    },
  },
} as const
