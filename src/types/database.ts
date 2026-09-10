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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      account: {
        Row: {
          account_id: string
          account_name: string
          account_status: string
          birth_date: string
          created_at: string
          email: string
          last_login_at: string | null
          marketing_alimtalk_opt_in: boolean
          marketing_consent_updated_at: string
          marketing_email_opt_in: boolean
          marketing_sms_opt_in: boolean
          phone_number: string
        }
        Insert: {
          account_id: string
          account_name: string
          account_status?: string
          birth_date: string
          created_at?: string
          email: string
          last_login_at?: string | null
          marketing_alimtalk_opt_in?: boolean
          marketing_consent_updated_at?: string
          marketing_email_opt_in?: boolean
          marketing_sms_opt_in?: boolean
          phone_number: string
        }
        Update: {
          account_id?: string
          account_name?: string
          account_status?: string
          birth_date?: string
          created_at?: string
          email?: string
          last_login_at?: string | null
          marketing_alimtalk_opt_in?: boolean
          marketing_consent_updated_at?: string
          marketing_email_opt_in?: boolean
          marketing_sms_opt_in?: boolean
          phone_number?: string
        }
        Relationships: []
      }
      admin_user: {
        Row: {
          admin_id: string
          admin_name: string
          admin_role: Database["public"]["Enums"]["admin_role"]
          created_at: string
          email: string
          is_active: boolean
          last_seen_at: string | null
        }
        Insert: {
          admin_id: string
          admin_name: string
          admin_role?: Database["public"]["Enums"]["admin_role"]
          created_at?: string
          email: string
          is_active?: boolean
          last_seen_at?: string | null
        }
        Update: {
          admin_id?: string
          admin_name?: string
          admin_role?: Database["public"]["Enums"]["admin_role"]
          created_at?: string
          email?: string
          is_active?: boolean
          last_seen_at?: string | null
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          admin_id: string
          audit_id: string
          created_at: string
          reason: string | null
          target_id: string
          target_type: string
        }
        Insert: {
          action: string
          admin_id: string
          audit_id?: string
          created_at?: string
          reason?: string | null
          target_id: string
          target_type: string
        }
        Update: {
          action?: string
          admin_id?: string
          audit_id?: string
          created_at?: string
          reason?: string | null
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      consent_log: {
        Row: {
          account_id: string
          agreed: boolean
          agreed_at: string
          consent_id: string
          consent_type: string
          document_version: string
        }
        Insert: {
          account_id: string
          agreed: boolean
          agreed_at?: string
          consent_id?: string
          consent_type: string
          document_version: string
        }
        Update: {
          account_id?: string
          agreed?: boolean
          agreed_at?: string
          consent_id?: string
          consent_type?: string
          document_version?: string
        }
        Relationships: []
      }
      evaluation: {
        Row: {
          evaluated_at: string
          evaluation_id: string
          final_accuracy: boolean
          initial_accuracy: boolean | null
          problem_id: string
          reasoning_score: number
          reflection_score: number | null
          rule_score: number
          self_correction: boolean
          student_id: string
          support_level: number
          transfer_score: number | null
        }
        Insert: {
          evaluated_at?: string
          evaluation_id?: string
          final_accuracy: boolean
          initial_accuracy?: boolean | null
          problem_id: string
          reasoning_score: number
          reflection_score?: number | null
          rule_score: number
          self_correction: boolean
          student_id: string
          support_level: number
          transfer_score?: number | null
        }
        Update: {
          evaluated_at?: string
          evaluation_id?: string
          final_accuracy?: boolean
          initial_accuracy?: boolean | null
          problem_id?: string
          reasoning_score?: number
          reflection_score?: number | null
          rule_score?: number
          self_correction?: boolean
          student_id?: string
          support_level?: number
          transfer_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_problem_id_fkey"
            columns: ["problem_id"]
            isOneToOne: true
            referencedRelation: "problem"
            referencedColumns: ["problem_id"]
          },
          {
            foreignKeyName: "evaluation_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student"
            referencedColumns: ["student_id"]
          },
        ]
      }
      event: {
        Row: {
          account_id: string | null
          created_at: string
          event_id: string
          event_name: string
          event_properties: Json
          session_id: string | null
          student_id: string | null
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          event_id?: string
          event_name: string
          event_properties?: Json
          session_id?: string | null
          student_id?: string | null
        }
        Update: {
          account_id?: string | null
          created_at?: string
          event_id?: string
          event_name?: string
          event_properties?: Json
          session_id?: string | null
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "event_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "learning_session"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "event_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student"
            referencedColumns: ["student_id"]
          },
        ]
      }
      learning_report: {
        Row: {
          generated_at: string
          period_end: string
          period_start: string
          report_id: string
          report_type: Database["public"]["Enums"]["report_type"]
          student_id: string
          summary_data: Json
        }
        Insert: {
          generated_at?: string
          period_end: string
          period_start: string
          report_id?: string
          report_type: Database["public"]["Enums"]["report_type"]
          student_id: string
          summary_data: Json
        }
        Update: {
          generated_at?: string
          period_end?: string
          period_start?: string
          report_id?: string
          report_type?: Database["public"]["Enums"]["report_type"]
          student_id?: string
          summary_data?: Json
        }
        Relationships: [
          {
            foreignKeyName: "learning_report_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student"
            referencedColumns: ["student_id"]
          },
        ]
      }
      learning_session: {
        Row: {
          completed_problem_count: number
          ended_at: string | null
          resumed_from_session_id: string | null
          session_date: string
          session_id: string
          session_status: Database["public"]["Enums"]["session_status"]
          started_at: string
          student_id: string
          target_problem_count: number
        }
        Insert: {
          completed_problem_count?: number
          ended_at?: string | null
          resumed_from_session_id?: string | null
          session_date: string
          session_id?: string
          session_status?: Database["public"]["Enums"]["session_status"]
          started_at?: string
          student_id: string
          target_problem_count?: number
        }
        Update: {
          completed_problem_count?: number
          ended_at?: string | null
          resumed_from_session_id?: string | null
          session_date?: string
          session_id?: string
          session_status?: Database["public"]["Enums"]["session_status"]
          started_at?: string
          student_id?: string
          target_problem_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "learning_session_resumed_from_session_id_fkey"
            columns: ["resumed_from_session_id"]
            isOneToOne: false
            referencedRelation: "learning_session"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "learning_session_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student"
            referencedColumns: ["student_id"]
          },
        ]
      }
      logic_gap: {
        Row: {
          concept: string
          description: string
          detected_at: string
          gap_type: Database["public"]["Enums"]["gap_type"]
          logic_gap_id: string
          problem_id: string
          resolved: boolean
          student_id: string
        }
        Insert: {
          concept: string
          description: string
          detected_at?: string
          gap_type: Database["public"]["Enums"]["gap_type"]
          logic_gap_id?: string
          problem_id: string
          resolved?: boolean
          student_id: string
        }
        Update: {
          concept?: string
          description?: string
          detected_at?: string
          gap_type?: Database["public"]["Enums"]["gap_type"]
          logic_gap_id?: string
          problem_id?: string
          resolved?: boolean
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "logic_gap_problem_id_fkey"
            columns: ["problem_id"]
            isOneToOne: false
            referencedRelation: "problem"
            referencedColumns: ["problem_id"]
          },
          {
            foreignKeyName: "logic_gap_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student"
            referencedColumns: ["student_id"]
          },
        ]
      }
      message: {
        Row: {
          created_at: string
          drilldown_stage: Database["public"]["Enums"]["drilldown_stage"] | null
          is_hint: boolean
          message_id: string
          message_text: string
          problem_id: string
          session_id: string
          speaker: Database["public"]["Enums"]["speaker"]
          student_id: string
          support_level: number
          turn_number: number
        }
        Insert: {
          created_at?: string
          drilldown_stage?:
            | Database["public"]["Enums"]["drilldown_stage"]
            | null
          is_hint?: boolean
          message_id?: string
          message_text: string
          problem_id: string
          session_id: string
          speaker: Database["public"]["Enums"]["speaker"]
          student_id: string
          support_level: number
          turn_number: number
        }
        Update: {
          created_at?: string
          drilldown_stage?:
            | Database["public"]["Enums"]["drilldown_stage"]
            | null
          is_hint?: boolean
          message_id?: string
          message_text?: string
          problem_id?: string
          session_id?: string
          speaker?: Database["public"]["Enums"]["speaker"]
          student_id?: string
          support_level?: number
          turn_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "message_problem_id_fkey"
            columns: ["problem_id"]
            isOneToOne: false
            referencedRelation: "problem"
            referencedColumns: ["problem_id"]
          },
          {
            foreignKeyName: "message_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "learning_session"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "message_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student"
            referencedColumns: ["student_id"]
          },
        ]
      }
      payment: {
        Row: {
          account_id: string
          amount: number
          currency: string
          failed_at: string | null
          paid_at: string | null
          payment_id: string
          payment_method: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          refunded_at: string | null
          student_id: string
          subscription_id: string
        }
        Insert: {
          account_id: string
          amount: number
          currency?: string
          failed_at?: string | null
          paid_at?: string | null
          payment_id?: string
          payment_method?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          refunded_at?: string | null
          student_id: string
          subscription_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          currency?: string
          failed_at?: string | null
          paid_at?: string | null
          payment_id?: string
          payment_method?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          refunded_at?: string | null
          student_id?: string
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "payment_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "payment_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscription"
            referencedColumns: ["subscription_id"]
          },
        ]
      }
      problem: {
        Row: {
          ai_wrong_answer: Json | null
          ai_wrong_reasoning: string | null
          answer_lock_status: Database["public"]["Enums"]["answer_lock_status"]
          concept: string
          target_misconception: string | null
          created_at: string
          difficulty: number
          learning_mode: Database["public"]["Enums"]["learning_mode"]
          problem_id: string
          problem_source: Database["public"]["Enums"]["problem_source"]
          problem_status: Database["public"]["Enums"]["problem_status"]
          problem_text: string
          session_id: string
          student_id: string
          verified_answer: Json | null
        }
        Insert: {
          ai_wrong_answer?: Json | null
          ai_wrong_reasoning?: string | null
          answer_lock_status: Database["public"]["Enums"]["answer_lock_status"]
          concept: string
          target_misconception?: string | null
          created_at?: string
          difficulty: number
          learning_mode: Database["public"]["Enums"]["learning_mode"]
          problem_id?: string
          problem_source: Database["public"]["Enums"]["problem_source"]
          problem_status?: Database["public"]["Enums"]["problem_status"]
          problem_text: string
          session_id: string
          student_id: string
          verified_answer?: Json | null
        }
        Update: {
          ai_wrong_answer?: Json | null
          ai_wrong_reasoning?: string | null
          answer_lock_status?: Database["public"]["Enums"]["answer_lock_status"]
          concept?: string
          target_misconception?: string | null
          created_at?: string
          difficulty?: number
          learning_mode?: Database["public"]["Enums"]["learning_mode"]
          problem_id?: string
          problem_source?: Database["public"]["Enums"]["problem_source"]
          problem_status?: Database["public"]["Enums"]["problem_status"]
          problem_text?: string
          session_id?: string
          student_id?: string
          verified_answer?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "problem_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "learning_session"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "problem_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student"
            referencedColumns: ["student_id"]
          },
        ]
      }
      student: {
        Row: {
          account_id: string
          auth_user_id: string | null
          birth_date: string
          created_at: string
          current_difficulty: number
          deleted_at: string | null
          grade: number
          learning_data_retain_until: string | null
          login_id: string | null
          nickname: string
          nickname_source: Database["public"]["Enums"]["nickname_source"]
          persona_type: Database["public"]["Enums"]["persona_type"]
          student_id: string
          student_name: string
          student_status: Database["public"]["Enums"]["student_status"]
        }
        Insert: {
          account_id: string
          auth_user_id?: string | null
          birth_date: string
          created_at?: string
          current_difficulty: number
          deleted_at?: string | null
          grade: number
          learning_data_retain_until?: string | null
          login_id?: string | null
          nickname: string
          nickname_source?: Database["public"]["Enums"]["nickname_source"]
          persona_type: Database["public"]["Enums"]["persona_type"]
          student_id?: string
          student_name: string
          student_status?: Database["public"]["Enums"]["student_status"]
        }
        Update: {
          account_id?: string
          auth_user_id?: string | null
          birth_date?: string
          created_at?: string
          current_difficulty?: number
          deleted_at?: string | null
          grade?: number
          learning_data_retain_until?: string | null
          login_id?: string | null
          nickname?: string
          nickname_source?: Database["public"]["Enums"]["nickname_source"]
          persona_type?: Database["public"]["Enums"]["persona_type"]
          student_id?: string
          student_name?: string
          student_status?: Database["public"]["Enums"]["student_status"]
        }
        Relationships: [
          {
            foreignKeyName: "student_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account"
            referencedColumns: ["account_id"]
          },
        ]
      }
      student_memory: {
        Row: {
          average_support_level: number
          current_level: number
          memory_id: string
          reasoning_level: number
          recurring_logic_gaps: Json
          review_concepts: Json
          student_id: string
          transfer_level: number
          updated_at: string
          weak_concepts: Json
        }
        Insert: {
          average_support_level: number
          current_level: number
          memory_id?: string
          reasoning_level: number
          recurring_logic_gaps?: Json
          review_concepts?: Json
          student_id: string
          transfer_level: number
          updated_at?: string
          weak_concepts?: Json
        }
        Update: {
          average_support_level?: number
          current_level?: number
          memory_id?: string
          reasoning_level?: number
          recurring_logic_gaps?: Json
          review_concepts?: Json
          student_id?: string
          transfer_level?: number
          updated_at?: string
          weak_concepts?: Json
        }
        Relationships: [
          {
            foreignKeyName: "student_memory_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "student"
            referencedColumns: ["student_id"]
          },
        ]
      }
      subscription: {
        Row: {
          account_id: string
          cancelled_at: string | null
          current_period_ends_at: string | null
          grace_period_ends_at: string | null
          next_billing_at: string | null
          student_id: string
          subscription_id: string
          subscription_started_at: string | null
          subscription_status: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at: string | null
          trial_started_at: string | null
        }
        Insert: {
          account_id: string
          cancelled_at?: string | null
          current_period_ends_at?: string | null
          grace_period_ends_at?: string | null
          next_billing_at?: string | null
          student_id: string
          subscription_id?: string
          subscription_started_at?: string | null
          subscription_status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          trial_started_at?: string | null
        }
        Update: {
          account_id?: string
          cancelled_at?: string | null
          current_period_ends_at?: string | null
          grace_period_ends_at?: string | null
          next_billing_at?: string | null
          student_id?: string
          subscription_id?: string
          subscription_started_at?: string | null
          subscription_status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          trial_started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "subscription_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student"
            referencedColumns: ["student_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      owns_student: { Args: { p_student_id: string }; Returns: boolean }
    }
    Enums: {
      admin_role: "full" | "cs" | "readonly"
      answer_lock_status: "locked" | "recheck" | "invalid_problem"
      drilldown_stage:
        | "judgment"
        | "reasoning"
        | "rule"
        | "transfer"
        | "reflection"
      gap_type:
        | "knowledge_gap"
        | "evidence_gap"
        | "rule_gap"
        | "inference_gap"
        | "transfer_gap"
        | "monitoring_gap"
      learning_mode: "mode_a" | "mode_b"
      nickname_source: "name_default" | "custom"
      payment_status:
        | "pending"
        | "paid"
        | "failed"
        | "refunded"
        | "partially_refunded"
      persona_type: "friend" | "villain"
      problem_source: "ai" | "text" | "photo"
      problem_status:
        | "active"
        | "completed"
        | "needs_review"
        | "system_interrupted"
        | "verification_failed"
        | "abandoned"
      report_type: "daily_student" | "weekly_parent"
      session_status: "active" | "completed" | "incomplete"
      speaker: "student" | "ai" | "system"
      student_status: "active" | "deleted_pending"
      subscription_status:
        | "trial"
        | "active"
        | "payment_failed"
        | "expired"
        | "cancelled"
        | "reactivated"
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
  public: {
    Enums: {
      admin_role: ["full", "cs", "readonly"],
      answer_lock_status: ["locked", "recheck", "invalid_problem"],
      drilldown_stage: [
        "judgment",
        "reasoning",
        "rule",
        "transfer",
        "reflection",
      ],
      gap_type: [
        "knowledge_gap",
        "evidence_gap",
        "rule_gap",
        "inference_gap",
        "transfer_gap",
        "monitoring_gap",
      ],
      learning_mode: ["mode_a", "mode_b"],
      nickname_source: ["name_default", "custom"],
      payment_status: [
        "pending",
        "paid",
        "failed",
        "refunded",
        "partially_refunded",
      ],
      persona_type: ["friend", "villain"],
      problem_source: ["ai", "text", "photo"],
      problem_status: [
        "active",
        "completed",
        "needs_review",
        "system_interrupted",
        "verification_failed",
        "abandoned",
      ],
      report_type: ["daily_student", "weekly_parent"],
      session_status: ["active", "completed", "incomplete"],
      speaker: ["student", "ai", "system"],
      student_status: ["active", "deleted_pending"],
      subscription_status: [
        "trial",
        "active",
        "payment_failed",
        "expired",
        "cancelled",
        "reactivated",
      ],
    },
  },
} as const
