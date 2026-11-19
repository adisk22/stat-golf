
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "daily_holes": {
                  Row: {
                    "date": string,"hole_number": number,"par": number,"question_id": string,"target_rank": number
                  }
                  ComputedFields: never
                  Insert: {
                    "date": string,"hole_number": number,"par"?: number,"question_id": string,"target_rank": number
                  }
                  Update: {
                    "date"?: string,"hole_number"?: number,"par"?: number,"question_id"?: string,"target_rank"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "daily_holes_date_fkey"
      columns: ["date"]
isOneToOne: false
      referencedRelation: "daily_puzzles"
      referencedColumns: ["date"]
    },{
      foreignKeyName: "daily_holes_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "questions"
      referencedColumns: ["id"]
    }
                  ]
                },"daily_puzzles": {
                  Row: {
                    "created_at": string,"date": string,"published": boolean,"published_at": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"date": string,"published"?: boolean,"published_at"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"date"?: string,"published"?: boolean,"published_at"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"entities": {
                  Row: {
                    "aliases": (string)[],"country": string | null,"created_at": string,"disambiguation": string | null,"external_ids": NonNullable<Json>,"id": string,"name": string,"search_text": string,"sport": string,"type": Database["public"]['Enums']["entity_type"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "aliases"?: (string)[],"country"?: string | null,"created_at"?: string,"disambiguation"?: string | null,"external_ids"?: NonNullable<Json>,"id"?: string,"name": string,"search_text"?: string,"sport"?: string,"type": Database["public"]['Enums']["entity_type"],"updated_at"?: string
                  }
                  Update: {
                    "aliases"?: (string)[],"country"?: string | null,"created_at"?: string,"disambiguation"?: string | null,"external_ids"?: NonNullable<Json>,"id"?: string,"name"?: string,"search_text"?: string,"sport"?: string,"type"?: Database["public"]['Enums']["entity_type"],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"guesses": {
                  Row: {
                    "actual_rank": number | null,"actual_value": number | null,"created_at": string,"entity_id": string,"hole_number": number,"play_id": string,"strokes": number
                  }
                  ComputedFields: never
                  Insert: {
                    "actual_rank"?: number | null,"actual_value"?: number | null,"created_at"?: string,"entity_id": string,"hole_number": number,"play_id": string,"strokes": number
                  }
                  Update: {
                    "actual_rank"?: number | null,"actual_value"?: number | null,"created_at"?: string,"entity_id"?: string,"hole_number"?: number,"play_id"?: string,"strokes"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "guesses_entity_id_fkey"
      columns: ["entity_id"]
isOneToOne: false
      referencedRelation: "entities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "guesses_play_id_fkey"
      columns: ["play_id"]
isOneToOne: false
      referencedRelation: "plays"
      referencedColumns: ["id"]
    }
                  ]
                },"plays": {
                  Row: {
                    "completed_at": string | null,"date": string,"id": string,"is_archive": boolean,"started_at": string,"total_strokes": number | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "completed_at"?: string | null,"date": string,"id"?: string,"is_archive"?: boolean,"started_at"?: string,"total_strokes"?: number | null,"user_id": string
                  }
                  Update: {
                    "completed_at"?: string | null,"date"?: string,"id"?: string,"is_archive"?: boolean,"started_at"?: string,"total_strokes"?: number | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "plays_date_fkey"
      columns: ["date"]
isOneToOne: false
      referencedRelation: "daily_puzzles"
      referencedColumns: ["date"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "best_streak": number,"created_at": string,"current_streak": number,"display_name": string | null,"games_played": number,"is_admin": boolean,"last_streak_date": string | null,"total_strokes": number,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "best_streak"?: number,"created_at"?: string,"current_streak"?: number,"display_name"?: string | null,"games_played"?: number,"is_admin"?: boolean,"last_streak_date"?: string | null,"total_strokes"?: number,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "best_streak"?: number,"created_at"?: string,"current_streak"?: number,"display_name"?: string | null,"games_played"?: number,"is_admin"?: boolean,"last_streak_date"?: string | null,"total_strokes"?: number,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"question_rankings": {
                  Row: {
                    "entity_id": string,"question_id": string,"rank": number,"value": number
                  }
                  ComputedFields: never
                  Insert: {
                    "entity_id": string,"question_id": string,"rank": number,"value": number
                  }
                  Update: {
                    "entity_id"?: string,"question_id"?: string,"rank"?: number,"value"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "question_rankings_entity_id_fkey"
      columns: ["entity_id"]
isOneToOne: false
      referencedRelation: "entities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "question_rankings_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "questions"
      referencedColumns: ["id"]
    }
                  ]
                },"questions": {
                  Row: {
                    "answer_type": Database["public"]['Enums']["entity_type"],"created_at": string,"created_by": string | null,"data_as_of": string | null,"id": string,"prompt": string,"scope_note": string | null,"source_name": string | null,"source_url": string | null,"sport": string,"stat_label": string,"status": Database["public"]['Enums']["question_status"],"updated_at": string,"value_order": Database["public"]['Enums']["value_order"]
                  }
                  ComputedFields: never
                  Insert: {
                    "answer_type": Database["public"]['Enums']["entity_type"],"created_at"?: string,"created_by"?: string | null,"data_as_of"?: string | null,"id"?: string,"prompt": string,"scope_note"?: string | null,"source_name"?: string | null,"source_url"?: string | null,"sport"?: string,"stat_label": string,"status"?: Database["public"]['Enums']["question_status"],"updated_at"?: string,"value_order"?: Database["public"]['Enums']["value_order"]
                  }
                  Update: {
                    "answer_type"?: Database["public"]['Enums']["entity_type"],"created_at"?: string,"created_by"?: string | null,"data_as_of"?: string | null,"id"?: string,"prompt"?: string,"scope_note"?: string | null,"source_name"?: string | null,"source_url"?: string | null,"sport"?: string,"stat_label"?: string,"status"?: Database["public"]['Enums']["question_status"],"updated_at"?: string,"value_order"?: Database["public"]['Enums']["value_order"]
                  }
                  Relationships: [
                    
                  ]
                },"rate_limits": {
                  Row: {
                    "count": number,"key": string,"window_start": string
                  }
                  ComputedFields: never
                  Insert: {
                    "count"?: number,"key": string,"window_start": string
                  }
                  Update: {
                    "count"?: number,"key"?: string,"window_start"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "search_entities":
{ Args: { "p_limit"?: number,"p_query": string,"p_sport"?: string,"p_type": Database["public"]['Enums']["entity_type"] }; Returns: {
              "country": string,"disambiguation": string,"id": string,"name": string,"score": number
            }[]
                           },
"server_check_rate_limit":
{ Args: { "p_key": string,"p_limit": number,"p_window_seconds": number }; Returns: boolean
                           },
"server_merge_user_plays":
{ Args: { "p_from": string,"p_to": string }; Returns: {
              "merged": number,"skipped": number
            }[]
                           },
"server_puzzle_publish_errors":
{ Args: { "p_date": string }; Returns: (string)[]
                           },
"server_recompute_profile_stats":
{ Args: { "p_user_id": string }; Returns: undefined
                           }
          }
          Enums: {
            "entity_type": "club"|"player"|"nation","question_status": "draft"|"ready","value_order": "desc"|"asc"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "entity_type": ["club", "player", "nation"],"question_status": ["draft", "ready"],"value_order": ["desc", "asc"]
          }
        }
} as const
