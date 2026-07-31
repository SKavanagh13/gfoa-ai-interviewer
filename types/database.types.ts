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
      analysis_eligibility_segments: {
        Row: {
          created_at: string
          interview_id: string
          segment_id: string
        }
        Insert: {
          created_at?: string
          interview_id: string
          segment_id: string
        }
        Update: {
          created_at?: string
          interview_id?: string
          segment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "analysis_eligibility_segments_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["interview_id"]
          },
          {
            foreignKeyName: "analysis_eligibility_segments_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "transcript_segments"
            referencedColumns: ["segment_id"]
          },
        ]
      }
      analysis_runs: {
        Row: {
          additional_issue: string | null
          analysis_id: string
          analysis_model: string | null
          analysis_prompt_version: string | null
          created_at: string
          emerging_signal: string | null
          error_message: string | null
          estimated_analysis_cost_usd: number | null
          estimated_input_tokens: number | null
          estimated_output_tokens: number | null
          interview_id: string
          key_tension: string | null
          limitations: string | null
          opportunity_signal: string | null
          output_specification_version: string | null
          overall_quality: Database["public"]["Enums"]["overall_quality"] | null
          overall_summary: string | null
          primary_takeaway: string | null
          raw_structured_output: Json | null
          recurring_concern: string | null
          status: Database["public"]["Enums"]["analysis_run_status"]
          structured_schema_version: string | null
          updated_at: string
        }
        Insert: {
          additional_issue?: string | null
          analysis_id?: string
          analysis_model?: string | null
          analysis_prompt_version?: string | null
          created_at?: string
          emerging_signal?: string | null
          error_message?: string | null
          estimated_analysis_cost_usd?: number | null
          estimated_input_tokens?: number | null
          estimated_output_tokens?: number | null
          interview_id: string
          key_tension?: string | null
          limitations?: string | null
          opportunity_signal?: string | null
          output_specification_version?: string | null
          overall_quality?:
            | Database["public"]["Enums"]["overall_quality"]
            | null
          overall_summary?: string | null
          primary_takeaway?: string | null
          raw_structured_output?: Json | null
          recurring_concern?: string | null
          status?: Database["public"]["Enums"]["analysis_run_status"]
          structured_schema_version?: string | null
          updated_at?: string
        }
        Update: {
          additional_issue?: string | null
          analysis_id?: string
          analysis_model?: string | null
          analysis_prompt_version?: string | null
          created_at?: string
          emerging_signal?: string | null
          error_message?: string | null
          estimated_analysis_cost_usd?: number | null
          estimated_input_tokens?: number | null
          estimated_output_tokens?: number | null
          interview_id?: string
          key_tension?: string | null
          limitations?: string | null
          opportunity_signal?: string | null
          output_specification_version?: string | null
          overall_quality?:
            | Database["public"]["Enums"]["overall_quality"]
            | null
          overall_summary?: string | null
          primary_takeaway?: string | null
          raw_structured_output?: Json | null
          recurring_concern?: string | null
          status?: Database["public"]["Enums"]["analysis_run_status"]
          structured_schema_version?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "analysis_runs_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["interview_id"]
          },
        ]
      }
      interview_quote_segments: {
        Row: {
          created_at: string
          quote_id: string
          segment_id: string
        }
        Insert: {
          created_at?: string
          quote_id: string
          segment_id: string
        }
        Update: {
          created_at?: string
          quote_id?: string
          segment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "interview_quote_segments_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "interview_quotes"
            referencedColumns: ["quote_id"]
          },
          {
            foreignKeyName: "interview_quote_segments_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "transcript_segments"
            referencedColumns: ["segment_id"]
          },
        ]
      }
      interview_quotes: {
        Row: {
          analysis_id: string
          created_at: string
          interview_id: string
          objective: Database["public"]["Enums"]["objective"] | null
          quote_id: string
          quote_text: string
          reason_selected: string | null
          start_time_ms: number | null
          updated_at: string
          verification_status: Database["public"]["Enums"]["quote_verification_status"]
        }
        Insert: {
          analysis_id: string
          created_at?: string
          interview_id: string
          objective?: Database["public"]["Enums"]["objective"] | null
          quote_id?: string
          quote_text: string
          reason_selected?: string | null
          start_time_ms?: number | null
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["quote_verification_status"]
        }
        Update: {
          analysis_id?: string
          created_at?: string
          interview_id?: string
          objective?: Database["public"]["Enums"]["objective"] | null
          quote_id?: string
          quote_text?: string
          reason_selected?: string | null
          start_time_ms?: number | null
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["quote_verification_status"]
        }
        Relationships: [
          {
            foreignKeyName: "interview_quotes_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analysis_runs"
            referencedColumns: ["analysis_id"]
          },
          {
            foreignKeyName: "interview_quotes_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["interview_id"]
          },
        ]
      }
      interviews: {
        Row: {
          analysis_eligibility:
            | Database["public"]["Enums"]["analysis_eligibility"]
            | null
          analysis_eligibility_decided_at: string | null
          analysis_eligibility_supporting_objective:
            | Database["public"]["Enums"]["objective"]
            | null
          audio_storage_path: string | null
          browser_connection_status: Database["public"]["Enums"]["connection_status"]
          consent_version: string | null
          consented_at: string | null
          cost_category: Database["public"]["Enums"]["cost_category"] | null
          created_at: string
          duration_seconds: number | null
          end_disposition: Database["public"]["Enums"]["end_disposition"] | null
          ended_at: string | null
          estimated_input_tokens: number | null
          estimated_live_cost_usd: number | null
          estimated_output_tokens: number | null
          estimated_total_cost_usd: number | null
          interview_guide_version: string | null
          interview_id: string
          lifecycle_status: Database["public"]["Enums"]["interview_lifecycle_status"]
          live_prompt_version: string | null
          negative_reaction_flag: boolean | null
          operating_principles_version: string | null
          participant_id: string
          realtime_call_id: string | null
          sideband_connection_status: Database["public"]["Enums"]["connection_status"]
          started_at: string | null
          technical_error: string | null
          transcript_processing_error: string | null
          transcript_reconciliation_timeout_ms: number | null
          transcript_stabilized_at: string | null
          transcript_status: Database["public"]["Enums"]["transcript_status"]
          transcript_storage_path: string | null
          updated_at: string
        }
        Insert: {
          analysis_eligibility?:
            | Database["public"]["Enums"]["analysis_eligibility"]
            | null
          analysis_eligibility_decided_at?: string | null
          analysis_eligibility_supporting_objective?:
            | Database["public"]["Enums"]["objective"]
            | null
          audio_storage_path?: string | null
          browser_connection_status?: Database["public"]["Enums"]["connection_status"]
          consent_version?: string | null
          consented_at?: string | null
          cost_category?: Database["public"]["Enums"]["cost_category"] | null
          created_at?: string
          duration_seconds?: number | null
          end_disposition?:
            | Database["public"]["Enums"]["end_disposition"]
            | null
          ended_at?: string | null
          estimated_input_tokens?: number | null
          estimated_live_cost_usd?: number | null
          estimated_output_tokens?: number | null
          estimated_total_cost_usd?: number | null
          interview_guide_version?: string | null
          interview_id?: string
          lifecycle_status?: Database["public"]["Enums"]["interview_lifecycle_status"]
          live_prompt_version?: string | null
          negative_reaction_flag?: boolean | null
          operating_principles_version?: string | null
          participant_id: string
          realtime_call_id?: string | null
          sideband_connection_status?: Database["public"]["Enums"]["connection_status"]
          started_at?: string | null
          technical_error?: string | null
          transcript_processing_error?: string | null
          transcript_reconciliation_timeout_ms?: number | null
          transcript_stabilized_at?: string | null
          transcript_status?: Database["public"]["Enums"]["transcript_status"]
          transcript_storage_path?: string | null
          updated_at?: string
        }
        Update: {
          analysis_eligibility?:
            | Database["public"]["Enums"]["analysis_eligibility"]
            | null
          analysis_eligibility_decided_at?: string | null
          analysis_eligibility_supporting_objective?:
            | Database["public"]["Enums"]["objective"]
            | null
          audio_storage_path?: string | null
          browser_connection_status?: Database["public"]["Enums"]["connection_status"]
          consent_version?: string | null
          consented_at?: string | null
          cost_category?: Database["public"]["Enums"]["cost_category"] | null
          created_at?: string
          duration_seconds?: number | null
          end_disposition?:
            | Database["public"]["Enums"]["end_disposition"]
            | null
          ended_at?: string | null
          estimated_input_tokens?: number | null
          estimated_live_cost_usd?: number | null
          estimated_output_tokens?: number | null
          estimated_total_cost_usd?: number | null
          interview_guide_version?: string | null
          interview_id?: string
          lifecycle_status?: Database["public"]["Enums"]["interview_lifecycle_status"]
          live_prompt_version?: string | null
          negative_reaction_flag?: boolean | null
          operating_principles_version?: string | null
          participant_id?: string
          realtime_call_id?: string | null
          sideband_connection_status?: Database["public"]["Enums"]["connection_status"]
          started_at?: string | null
          technical_error?: string | null
          transcript_processing_error?: string | null
          transcript_reconciliation_timeout_ms?: number | null
          transcript_stabilized_at?: string | null
          transcript_status?: Database["public"]["Enums"]["transcript_status"]
          transcript_storage_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "interviews_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["participant_id"]
          },
        ]
      }
      objective_result_segments: {
        Row: {
          created_at: string
          objective_result_id: string
          segment_id: string
        }
        Insert: {
          created_at?: string
          objective_result_id: string
          segment_id: string
        }
        Update: {
          created_at?: string
          objective_result_id?: string
          segment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "objective_result_segments_objective_result_id_fkey"
            columns: ["objective_result_id"]
            isOneToOne: false
            referencedRelation: "objective_results"
            referencedColumns: ["objective_result_id"]
          },
          {
            foreignKeyName: "objective_result_segments_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "transcript_segments"
            referencedColumns: ["segment_id"]
          },
        ]
      }
      objective_results: {
        Row: {
          analysis_id: string
          confidence: Database["public"]["Enums"]["confidence"]
          coverage: Database["public"]["Enums"]["objective_coverage"]
          created_at: string
          narrative_summary: string
          objective: Database["public"]["Enums"]["objective"]
          objective_result_id: string
          structured_fields: Json
          updated_at: string
        }
        Insert: {
          analysis_id: string
          confidence: Database["public"]["Enums"]["confidence"]
          coverage: Database["public"]["Enums"]["objective_coverage"]
          created_at?: string
          narrative_summary: string
          objective: Database["public"]["Enums"]["objective"]
          objective_result_id?: string
          structured_fields?: Json
          updated_at?: string
        }
        Update: {
          analysis_id?: string
          confidence?: Database["public"]["Enums"]["confidence"]
          coverage?: Database["public"]["Enums"]["objective_coverage"]
          created_at?: string
          narrative_summary?: string
          objective?: Database["public"]["Enums"]["objective"]
          objective_result_id?: string
          structured_fields?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "objective_results_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analysis_runs"
            referencedColumns: ["analysis_id"]
          },
        ]
      }
      participants: {
        Row: {
          created_at: string
          email: string
          experience_band: string | null
          gfoa_member_id: string | null
          government_type: string | null
          name: string | null
          organization_name: string | null
          organization_size_band: string | null
          participant_id: string
          profile_confirmed_at: string | null
          profile_status: Database["public"]["Enums"]["profile_status"]
          state_or_region: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          experience_band?: string | null
          gfoa_member_id?: string | null
          government_type?: string | null
          name?: string | null
          organization_name?: string | null
          organization_size_band?: string | null
          participant_id?: string
          profile_confirmed_at?: string | null
          profile_status?: Database["public"]["Enums"]["profile_status"]
          state_or_region?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          experience_band?: string | null
          gfoa_member_id?: string | null
          government_type?: string | null
          name?: string | null
          organization_name?: string | null
          organization_size_band?: string | null
          participant_id?: string
          profile_confirmed_at?: string | null
          profile_status?: Database["public"]["Enums"]["profile_status"]
          state_or_region?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      theme_assignment_segments: {
        Row: {
          created_at: string
          segment_id: string
          theme_assignment_id: string
        }
        Insert: {
          created_at?: string
          segment_id: string
          theme_assignment_id: string
        }
        Update: {
          created_at?: string
          segment_id?: string
          theme_assignment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "theme_assignment_segments_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "transcript_segments"
            referencedColumns: ["segment_id"]
          },
          {
            foreignKeyName: "theme_assignment_segments_theme_assignment_id_fkey"
            columns: ["theme_assignment_id"]
            isOneToOne: false
            referencedRelation: "theme_assignments"
            referencedColumns: ["theme_assignment_id"]
          },
        ]
      }
      theme_assignments: {
        Row: {
          analysis_id: string
          created_at: string
          description: string | null
          label: string
          theme_assignment_id: string
          updated_at: string
        }
        Insert: {
          analysis_id: string
          created_at?: string
          description?: string | null
          label: string
          theme_assignment_id?: string
          updated_at?: string
        }
        Update: {
          analysis_id?: string
          created_at?: string
          description?: string | null
          label?: string
          theme_assignment_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "theme_assignments_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analysis_runs"
            referencedColumns: ["analysis_id"]
          },
        ]
      }
      transcript_segments: {
        Row: {
          created_at: string
          end_time_ms: number | null
          interview_id: string
          is_final: boolean
          provider_event_id: string | null
          segment_id: string
          sequence_number: number
          speaker: Database["public"]["Enums"]["transcript_speaker"]
          start_time_ms: number | null
          text: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_time_ms?: number | null
          interview_id: string
          is_final?: boolean
          provider_event_id?: string | null
          segment_id?: string
          sequence_number: number
          speaker: Database["public"]["Enums"]["transcript_speaker"]
          start_time_ms?: number | null
          text: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_time_ms?: number | null
          interview_id?: string
          is_final?: boolean
          provider_event_id?: string | null
          segment_id?: string
          sequence_number?: number
          speaker?: Database["public"]["Enums"]["transcript_speaker"]
          start_time_ms?: number | null
          text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transcript_segments_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["interview_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: never; Returns: boolean }
      is_staff_or_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      analysis_eligibility: "eligible" | "ineligible_insufficient_content"
      analysis_run_status: "pending" | "succeeded" | "failed"
      confidence: "high" | "moderate" | "low"
      connection_status: "pending" | "connected" | "failed" | "closed"
      cost_category: "completed" | "abandoned" | "technical_failure"
      end_disposition: "completed" | "participant_ended" | "technical_failure"
      interview_lifecycle_status:
        | "created"
        | "active"
        | "ending"
        | "ended"
        | "failed"
      objective:
        | "current_issue"
        | "enduring_concern"
        | "theory_vs_practice"
        | "recent_change"
        | "unmet_need"
        | "innovation_orientation"
      objective_coverage:
        | "sufficiently_covered"
        | "partially_covered"
        | "not_covered"
        | "unclear"
      overall_quality: "strong" | "adequate" | "limited" | "unusable"
      profile_status:
        | "matched_confirmed"
        | "matched_corrected"
        | "unmatched_minimum_collected"
        | "not_confirmed"
      quote_verification_status:
        | "proposed"
        | "accepted"
        | "rejected"
        | "needs_review"
      transcript_speaker: "participant" | "interviewer" | "system"
      transcript_status: "pending" | "stabilizing" | "stable" | "failed"
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
      analysis_eligibility: ["eligible", "ineligible_insufficient_content"],
      analysis_run_status: ["pending", "succeeded", "failed"],
      confidence: ["high", "moderate", "low"],
      connection_status: ["pending", "connected", "failed", "closed"],
      cost_category: ["completed", "abandoned", "technical_failure"],
      end_disposition: ["completed", "participant_ended", "technical_failure"],
      interview_lifecycle_status: [
        "created",
        "active",
        "ending",
        "ended",
        "failed",
      ],
      objective: [
        "current_issue",
        "enduring_concern",
        "theory_vs_practice",
        "recent_change",
        "unmet_need",
        "innovation_orientation",
      ],
      objective_coverage: [
        "sufficiently_covered",
        "partially_covered",
        "not_covered",
        "unclear",
      ],
      overall_quality: ["strong", "adequate", "limited", "unusable"],
      profile_status: [
        "matched_confirmed",
        "matched_corrected",
        "unmatched_minimum_collected",
        "not_confirmed",
      ],
      quote_verification_status: [
        "proposed",
        "accepted",
        "rejected",
        "needs_review",
      ],
      transcript_speaker: ["participant", "interviewer", "system"],
      transcript_status: ["pending", "stabilizing", "stable", "failed"],
    },
  },
} as const

