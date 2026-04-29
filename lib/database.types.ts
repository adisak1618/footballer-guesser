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
      football_players: {
        Row: {
          category: string
          id: string
          name: string
        }
        Insert: {
          category: string
          id?: string
          name: string
        }
        Update: {
          category?: string
          id?: string
          name?: string
        }
        Relationships: []
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
          code: string
          created_at: string | null
          current_round: number | null
          host_player_id: string | null
          id: string
          max_rounds: number
          score_positions: number
          status: Database["public"]["Enums"]["room_status"] | null
        }
        Insert: {
          category?: string
          code: string
          created_at?: string | null
          current_round?: number | null
          host_player_id?: string | null
          id?: string
          max_rounds: number
          score_positions: number
          status?: Database["public"]["Enums"]["room_status"] | null
        }
        Update: {
          category?: string
          code?: string
          created_at?: string | null
          current_round?: number | null
          host_player_id?: string | null
          id?: string
          max_rounds?: number
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
      join_room: {
        Args: { p_code: string; p_display_name: string; p_player_id: string }
        Returns: {
          player_id: string
          room_id: string
        }[]
      }
      next_round: {
        Args: { p_host_player_id: string; p_room_id: string }
        Returns: undefined
      }
      start_game: {
        Args: { p_host_player_id: string; p_room_id: string }
        Returns: undefined
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

