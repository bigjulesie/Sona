// Placeholder — will be replaced by `npx supabase gen types typescript` after linking
// For now, define the minimal types we need for development

export type Database = {
  public: {
    Tables: {
      portraits: {
        Row: {
          id: string
          slug: string
          display_name: string
          system_prompt: string
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          slug: string
          display_name: string
          system_prompt: string
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          slug?: string
          display_name?: string
          system_prompt?: string
          avatar_url?: string | null
          updated_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          access_tier: 'public' | 'acquaintance' | 'colleague' | 'family'
          portrait_id: string | null
          invited_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          access_tier?: 'public' | 'acquaintance' | 'colleague' | 'family'
          portrait_id?: string | null
          invited_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          email?: string
          full_name?: string | null
          access_tier?: 'public' | 'acquaintance' | 'colleague' | 'family'
          portrait_id?: string | null
          updated_at?: string
        }
      }
      knowledge_chunks: {
        Row: {
          id: string
          portrait_id: string
          content: string
          embedding: string | null
          source_title: string | null
          source_type: string | null
          source_date: string | null
          min_tier: 'public' | 'acquaintance' | 'colleague' | 'family'
          chunk_index: number
          metadata: Record<string, unknown>
          created_at: string
        }
        Insert: {
          id?: string
          portrait_id: string
          content: string
          embedding?: string | null
          source_title?: string | null
          source_type?: string | null
          source_date?: string | null
          min_tier?: 'public' | 'acquaintance' | 'colleague' | 'family'
          chunk_index?: number
          metadata?: Record<string, unknown>
          created_at?: string
        }
        Update: {
          content?: string
          embedding?: string | null
          source_title?: string | null
          source_type?: string | null
          min_tier?: 'public' | 'acquaintance' | 'colleague' | 'family'
          metadata?: Record<string, unknown>
        }
      }
      conversations: {
        Row: {
          id: string
          user_id: string
          portrait_id: string
          title: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          portrait_id: string
          title?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          title?: string | null
          updated_at?: string
        }
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          role: 'user' | 'assistant'
          content: string
          tokens_used: number | null
          chunks_referenced: string[]
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          role: 'user' | 'assistant'
          content: string
          tokens_used?: number | null
          chunks_referenced?: string[]
          created_at?: string
        }
        Update: {
          content?: string
          tokens_used?: number | null
        }
      }
      audit_log: {
        Row: {
          id: string
          user_id: string | null
          action: string
          resource_type: string
          resource_id: string | null
          metadata: Record<string, unknown>
          ip_address: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          action: string
          resource_type: string
          resource_id?: string | null
          metadata?: Record<string, unknown>
          ip_address?: string | null
          created_at?: string
        }
        Update: never
      }
    }
    Views: Record<string, never>
    Functions: {
      match_knowledge_chunks: {
        Args: {
          query_embedding: string
          match_portrait_id: string
          match_count?: number
        }
        Returns: {
          id: string
          content: string
          source_title: string | null
          source_type: string | null
          similarity: number
        }[]
      }
      tier_level: {
        Args: { t: string }
        Returns: number
      }
    }
    Enums: {
      access_tier: 'public' | 'acquaintance' | 'colleague' | 'family'
    }
  }
}
