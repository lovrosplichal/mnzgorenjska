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
      appearances: {
        Row: {
          clean_sheet: boolean
          goals: number
          goals_conceded: number
          id: number
          match_id: number
          minute_off: number
          minute_on: number
          minutes_played: number
          own_goals: number
          penalties_missed: number
          penalties_saved: number
          penalties_scored: number
          player_id: number
          red_cards: number
          shirt_number: number | null
          started: boolean
          team_id: number
          yellow_cards: number
        }
        Insert: {
          clean_sheet?: boolean
          goals?: number
          goals_conceded?: number
          id?: never
          match_id: number
          minute_off?: number
          minute_on?: number
          minutes_played?: number
          own_goals?: number
          penalties_missed?: number
          penalties_saved?: number
          penalties_scored?: number
          player_id: number
          red_cards?: number
          shirt_number?: number | null
          started?: boolean
          team_id: number
          yellow_cards?: number
        }
        Update: {
          clean_sheet?: boolean
          goals?: number
          goals_conceded?: number
          id?: never
          match_id?: number
          minute_off?: number
          minute_on?: number
          minutes_played?: number
          own_goals?: number
          penalties_missed?: number
          penalties_saved?: number
          penalties_scored?: number
          player_id?: number
          red_cards?: number
          shirt_number?: number | null
          started?: boolean
          team_id?: number
          yellow_cards?: number
        }
        Relationships: [
          {
            foreignKeyName: "appearances_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "match_assist_status"
            referencedColumns: ["match_id"]
          },
          {
            foreignKeyName: "appearances_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appearances_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "krog_najboljsi"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "appearances_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appearances_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_season_standings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appearances_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_standings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appearances_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appearances_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "pozicije_v_cakanju"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "appearances_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "competition_teams"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "appearances_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "krog_najboljsi"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "appearances_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "player_reports_view"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "appearances_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      assist_votes: {
        Row: {
          created_at: string
          goal_id: number
          id: number
          player_id: number | null
          voter_id: string
        }
        Insert: {
          created_at?: string
          goal_id: number
          id?: never
          player_id?: number | null
          voter_id: string
        }
        Update: {
          created_at?: string
          goal_id?: number
          id?: never
          player_id?: number | null
          voter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assist_votes_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assist_votes_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "krog_najboljsi"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "assist_votes_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assist_votes_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_season_standings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assist_votes_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_standings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assist_votes_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assist_votes_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "pozicije_v_cakanju"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "assist_votes_voter_id_fkey"
            columns: ["voter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assist_votes_deleted: {
        Row: {
          created_at: string | null
          deleted_at: string
          deleted_by: string | null
          goal_id: number | null
          id: number
          player_id: number | null
          reason: string | null
          voter_id: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string
          deleted_by?: string | null
          goal_id?: number | null
          id: number
          player_id?: number | null
          reason?: string | null
          voter_id?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string
          deleted_by?: string | null
          goal_id?: number | null
          id?: number
          player_id?: number | null
          reason?: string | null
          voter_id?: string | null
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          alias: string
          content: string
          created_at: string
          id: number
          user_id: string
        }
        Insert: {
          alias: string
          content: string
          created_at?: string
          id?: never
          user_id: string
        }
        Update: {
          alias?: string
          content?: string
          created_at?: string
          id?: never
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      competitions: {
        Row: {
          active: boolean
          country_id: number
          id: number
          mnzg_liga: string | null
          name: string
          prvi_fantasy_krog: number
          rok_pomak_ur: number
          short_name: string
          slug: string
          sort_order: number
          source: string
          source_league_code: string | null
        }
        Insert: {
          active?: boolean
          country_id: number
          id?: never
          mnzg_liga?: string | null
          name: string
          prvi_fantasy_krog?: number
          rok_pomak_ur?: number
          short_name: string
          slug: string
          sort_order?: number
          source: string
          source_league_code?: string | null
        }
        Update: {
          active?: boolean
          country_id?: number
          id?: never
          mnzg_liga?: string | null
          name?: string
          prvi_fantasy_krog?: number
          rok_pomak_ur?: number
          short_name?: string
          slug?: string
          sort_order?: number
          source?: string
          source_league_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "competitions_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
        ]
      }
      countries: {
        Row: {
          active: boolean
          code: string
          id: number
          name: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          code: string
          id?: never
          name: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          code?: string
          id?: never
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      email_log: {
        Row: {
          competition_id: number | null
          email: string
          id: number
          napaka: string | null
          poslano_at: string
          resend_id: string | null
          user_id: string | null
          vrsta: string
        }
        Insert: {
          competition_id?: number | null
          email: string
          id?: never
          napaka?: string | null
          poslano_at?: string
          resend_id?: string | null
          user_id?: string | null
          vrsta: string
        }
        Update: {
          competition_id?: number | null
          email?: string
          id?: never
          napaka?: string | null
          poslano_at?: string
          resend_id?: string | null
          user_id?: string | null
          vrsta?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_log_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_log_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions_view"
            referencedColumns: ["id"]
          },
        ]
      }
      fantasy_chips: {
        Row: {
          chip: string
          fantasy_team_id: number
          played_at: string
          round_id: number
        }
        Insert: {
          chip: string
          fantasy_team_id: number
          played_at?: string
          round_id: number
        }
        Update: {
          chip?: string
          fantasy_team_id?: number
          played_at?: string
          round_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "fantasy_chips_fantasy_team_id_fkey"
            columns: ["fantasy_team_id"]
            isOneToOne: false
            referencedRelation: "fantasy_round_points"
            referencedColumns: ["fantasy_team_id"]
          },
          {
            foreignKeyName: "fantasy_chips_fantasy_team_id_fkey"
            columns: ["fantasy_team_id"]
            isOneToOne: false
            referencedRelation: "fantasy_round_standings"
            referencedColumns: ["fantasy_team_id"]
          },
          {
            foreignKeyName: "fantasy_chips_fantasy_team_id_fkey"
            columns: ["fantasy_team_id"]
            isOneToOne: false
            referencedRelation: "fantasy_team_budget"
            referencedColumns: ["fantasy_team_id"]
          },
          {
            foreignKeyName: "fantasy_chips_fantasy_team_id_fkey"
            columns: ["fantasy_team_id"]
            isOneToOne: false
            referencedRelation: "fantasy_team_standings"
            referencedColumns: ["fantasy_team_id"]
          },
          {
            foreignKeyName: "fantasy_chips_fantasy_team_id_fkey"
            columns: ["fantasy_team_id"]
            isOneToOne: false
            referencedRelation: "fantasy_team_wealth"
            referencedColumns: ["fantasy_team_id"]
          },
          {
            foreignKeyName: "fantasy_chips_fantasy_team_id_fkey"
            columns: ["fantasy_team_id"]
            isOneToOne: false
            referencedRelation: "fantasy_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fantasy_chips_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "fantasy_round_points"
            referencedColumns: ["round_id"]
          },
          {
            foreignKeyName: "fantasy_chips_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "fantasy_round_standings"
            referencedColumns: ["round_id"]
          },
          {
            foreignKeyName: "fantasy_chips_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "naslednji_krog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fantasy_chips_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fantasy_chips_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "zadnji_odigrani_krog"
            referencedColumns: ["id"]
          },
        ]
      }
      fantasy_lineups: {
        Row: {
          bench_order: number | null
          captured_at: string
          fantasy_team_id: number
          is_captain: boolean
          is_starter: boolean
          is_vice: boolean
          player_id: number
          round_id: number
        }
        Insert: {
          bench_order?: number | null
          captured_at?: string
          fantasy_team_id: number
          is_captain?: boolean
          is_starter: boolean
          is_vice?: boolean
          player_id: number
          round_id: number
        }
        Update: {
          bench_order?: number | null
          captured_at?: string
          fantasy_team_id?: number
          is_captain?: boolean
          is_starter?: boolean
          is_vice?: boolean
          player_id?: number
          round_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "fantasy_lineups_fantasy_team_id_fkey"
            columns: ["fantasy_team_id"]
            isOneToOne: false
            referencedRelation: "fantasy_round_points"
            referencedColumns: ["fantasy_team_id"]
          },
          {
            foreignKeyName: "fantasy_lineups_fantasy_team_id_fkey"
            columns: ["fantasy_team_id"]
            isOneToOne: false
            referencedRelation: "fantasy_round_standings"
            referencedColumns: ["fantasy_team_id"]
          },
          {
            foreignKeyName: "fantasy_lineups_fantasy_team_id_fkey"
            columns: ["fantasy_team_id"]
            isOneToOne: false
            referencedRelation: "fantasy_team_budget"
            referencedColumns: ["fantasy_team_id"]
          },
          {
            foreignKeyName: "fantasy_lineups_fantasy_team_id_fkey"
            columns: ["fantasy_team_id"]
            isOneToOne: false
            referencedRelation: "fantasy_team_standings"
            referencedColumns: ["fantasy_team_id"]
          },
          {
            foreignKeyName: "fantasy_lineups_fantasy_team_id_fkey"
            columns: ["fantasy_team_id"]
            isOneToOne: false
            referencedRelation: "fantasy_team_wealth"
            referencedColumns: ["fantasy_team_id"]
          },
          {
            foreignKeyName: "fantasy_lineups_fantasy_team_id_fkey"
            columns: ["fantasy_team_id"]
            isOneToOne: false
            referencedRelation: "fantasy_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fantasy_lineups_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "krog_najboljsi"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "fantasy_lineups_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fantasy_lineups_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_season_standings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fantasy_lineups_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_standings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fantasy_lineups_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fantasy_lineups_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "pozicije_v_cakanju"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "fantasy_lineups_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "fantasy_round_points"
            referencedColumns: ["round_id"]
          },
          {
            foreignKeyName: "fantasy_lineups_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "fantasy_round_standings"
            referencedColumns: ["round_id"]
          },
          {
            foreignKeyName: "fantasy_lineups_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "naslednji_krog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fantasy_lineups_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fantasy_lineups_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "zadnji_odigrani_krog"
            referencedColumns: ["id"]
          },
        ]
      }
      fantasy_roster: {
        Row: {
          bench_order: number | null
          buy_position: string | null
          buy_value: number | null
          fantasy_team_id: number
          is_captain: boolean
          is_starter: boolean
          is_vice: boolean
          player_id: number
        }
        Insert: {
          bench_order?: number | null
          buy_position?: string | null
          buy_value?: number | null
          fantasy_team_id: number
          is_captain?: boolean
          is_starter?: boolean
          is_vice?: boolean
          player_id: number
        }
        Update: {
          bench_order?: number | null
          buy_position?: string | null
          buy_value?: number | null
          fantasy_team_id?: number
          is_captain?: boolean
          is_starter?: boolean
          is_vice?: boolean
          player_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "fantasy_roster_fantasy_team_id_fkey"
            columns: ["fantasy_team_id"]
            isOneToOne: false
            referencedRelation: "fantasy_round_points"
            referencedColumns: ["fantasy_team_id"]
          },
          {
            foreignKeyName: "fantasy_roster_fantasy_team_id_fkey"
            columns: ["fantasy_team_id"]
            isOneToOne: false
            referencedRelation: "fantasy_round_standings"
            referencedColumns: ["fantasy_team_id"]
          },
          {
            foreignKeyName: "fantasy_roster_fantasy_team_id_fkey"
            columns: ["fantasy_team_id"]
            isOneToOne: false
            referencedRelation: "fantasy_team_budget"
            referencedColumns: ["fantasy_team_id"]
          },
          {
            foreignKeyName: "fantasy_roster_fantasy_team_id_fkey"
            columns: ["fantasy_team_id"]
            isOneToOne: false
            referencedRelation: "fantasy_team_standings"
            referencedColumns: ["fantasy_team_id"]
          },
          {
            foreignKeyName: "fantasy_roster_fantasy_team_id_fkey"
            columns: ["fantasy_team_id"]
            isOneToOne: false
            referencedRelation: "fantasy_team_wealth"
            referencedColumns: ["fantasy_team_id"]
          },
          {
            foreignKeyName: "fantasy_roster_fantasy_team_id_fkey"
            columns: ["fantasy_team_id"]
            isOneToOne: false
            referencedRelation: "fantasy_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fantasy_roster_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "krog_najboljsi"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "fantasy_roster_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fantasy_roster_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_season_standings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fantasy_roster_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_standings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fantasy_roster_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fantasy_roster_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "pozicije_v_cakanju"
            referencedColumns: ["player_id"]
          },
        ]
      }
      fantasy_teams: {
        Row: {
          budget: number
          cash: number
          competition_id: number
          created_at: string
          id: number
          name: string
          owner_id: string
        }
        Insert: {
          budget?: number
          cash?: number
          competition_id?: number
          created_at?: string
          id?: never
          name: string
          owner_id: string
        }
        Update: {
          budget?: number
          cash?: number
          competition_id?: number
          created_at?: string
          id?: never
          name?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fantasy_teams_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fantasy_teams_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fantasy_teams_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fantasy_transfers: {
        Row: {
          created_at: string
          fantasy_team_id: number
          free_transfers: number
          penalty: number
          round_id: number
          transfers: number
        }
        Insert: {
          created_at?: string
          fantasy_team_id: number
          free_transfers?: number
          penalty?: number
          round_id: number
          transfers?: number
        }
        Update: {
          created_at?: string
          fantasy_team_id?: number
          free_transfers?: number
          penalty?: number
          round_id?: number
          transfers?: number
        }
        Relationships: [
          {
            foreignKeyName: "fantasy_transfers_fantasy_team_id_fkey"
            columns: ["fantasy_team_id"]
            isOneToOne: false
            referencedRelation: "fantasy_round_points"
            referencedColumns: ["fantasy_team_id"]
          },
          {
            foreignKeyName: "fantasy_transfers_fantasy_team_id_fkey"
            columns: ["fantasy_team_id"]
            isOneToOne: false
            referencedRelation: "fantasy_round_standings"
            referencedColumns: ["fantasy_team_id"]
          },
          {
            foreignKeyName: "fantasy_transfers_fantasy_team_id_fkey"
            columns: ["fantasy_team_id"]
            isOneToOne: false
            referencedRelation: "fantasy_team_budget"
            referencedColumns: ["fantasy_team_id"]
          },
          {
            foreignKeyName: "fantasy_transfers_fantasy_team_id_fkey"
            columns: ["fantasy_team_id"]
            isOneToOne: false
            referencedRelation: "fantasy_team_standings"
            referencedColumns: ["fantasy_team_id"]
          },
          {
            foreignKeyName: "fantasy_transfers_fantasy_team_id_fkey"
            columns: ["fantasy_team_id"]
            isOneToOne: false
            referencedRelation: "fantasy_team_wealth"
            referencedColumns: ["fantasy_team_id"]
          },
          {
            foreignKeyName: "fantasy_transfers_fantasy_team_id_fkey"
            columns: ["fantasy_team_id"]
            isOneToOne: false
            referencedRelation: "fantasy_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fantasy_transfers_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "fantasy_round_points"
            referencedColumns: ["round_id"]
          },
          {
            foreignKeyName: "fantasy_transfers_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "fantasy_round_standings"
            referencedColumns: ["round_id"]
          },
          {
            foreignKeyName: "fantasy_transfers_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "naslednji_krog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fantasy_transfers_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fantasy_transfers_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "zadnji_odigrani_krog"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          assist_confirmed_at: string | null
          assist_none_confirmed_at: string | null
          assist_player_id: number | null
          id: number
          is_own_goal: boolean
          is_penalty: boolean
          match_id: number
          minute: number | null
          score_away: number | null
          score_home: number | null
          scorer_id: number | null
          team_id: number
        }
        Insert: {
          assist_confirmed_at?: string | null
          assist_none_confirmed_at?: string | null
          assist_player_id?: number | null
          id?: never
          is_own_goal?: boolean
          is_penalty?: boolean
          match_id: number
          minute?: number | null
          score_away?: number | null
          score_home?: number | null
          scorer_id?: number | null
          team_id: number
        }
        Update: {
          assist_confirmed_at?: string | null
          assist_none_confirmed_at?: string | null
          assist_player_id?: number | null
          id?: never
          is_own_goal?: boolean
          is_penalty?: boolean
          match_id?: number
          minute?: number | null
          score_away?: number | null
          score_home?: number | null
          scorer_id?: number | null
          team_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "goals_assist_player_id_fkey"
            columns: ["assist_player_id"]
            isOneToOne: false
            referencedRelation: "krog_najboljsi"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "goals_assist_player_id_fkey"
            columns: ["assist_player_id"]
            isOneToOne: false
            referencedRelation: "player_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_assist_player_id_fkey"
            columns: ["assist_player_id"]
            isOneToOne: false
            referencedRelation: "player_season_standings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_assist_player_id_fkey"
            columns: ["assist_player_id"]
            isOneToOne: false
            referencedRelation: "player_standings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_assist_player_id_fkey"
            columns: ["assist_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_assist_player_id_fkey"
            columns: ["assist_player_id"]
            isOneToOne: false
            referencedRelation: "pozicije_v_cakanju"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "goals_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "match_assist_status"
            referencedColumns: ["match_id"]
          },
          {
            foreignKeyName: "goals_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_scorer_id_fkey"
            columns: ["scorer_id"]
            isOneToOne: false
            referencedRelation: "krog_najboljsi"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "goals_scorer_id_fkey"
            columns: ["scorer_id"]
            isOneToOne: false
            referencedRelation: "player_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_scorer_id_fkey"
            columns: ["scorer_id"]
            isOneToOne: false
            referencedRelation: "player_season_standings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_scorer_id_fkey"
            columns: ["scorer_id"]
            isOneToOne: false
            referencedRelation: "player_standings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_scorer_id_fkey"
            columns: ["scorer_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_scorer_id_fkey"
            columns: ["scorer_id"]
            isOneToOne: false
            referencedRelation: "pozicije_v_cakanju"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "goals_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "competition_teams"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "goals_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "krog_najboljsi"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "goals_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "player_reports_view"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "goals_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          away_goals: number
          away_team_id: number
          home_goals: number
          home_team_id: number
          id: number
          import_warnings: string[]
          imported_at: string | null
          played_on: string | null
          round_id: number
          source_url: string | null
          zapisnik_id: string | null
        }
        Insert: {
          away_goals?: number
          away_team_id: number
          home_goals?: number
          home_team_id: number
          id?: never
          import_warnings?: string[]
          imported_at?: string | null
          played_on?: string | null
          round_id: number
          source_url?: string | null
          zapisnik_id?: string | null
        }
        Update: {
          away_goals?: number
          away_team_id?: number
          home_goals?: number
          home_team_id?: number
          id?: never
          import_warnings?: string[]
          imported_at?: string | null
          played_on?: string | null
          round_id?: number
          source_url?: string | null
          zapisnik_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "competition_teams"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "matches_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "krog_najboljsi"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "matches_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "player_reports_view"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "matches_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "competition_teams"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "matches_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "krog_najboljsi"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "matches_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "player_reports_view"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "matches_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "fantasy_round_points"
            referencedColumns: ["round_id"]
          },
          {
            foreignKeyName: "matches_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "fantasy_round_standings"
            referencedColumns: ["round_id"]
          },
          {
            foreignKeyName: "matches_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "naslednji_krog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "zadnji_odigrani_krog"
            referencedColumns: ["id"]
          },
        ]
      }
      player_reports: {
        Row: {
          content: string
          created_at: string
          id: number
          kind: string
          player_id: number
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: never
          kind: string
          player_id: number
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: never
          kind?: string
          player_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_reports_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "krog_najboljsi"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "player_reports_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_reports_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_season_standings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_reports_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_standings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_reports_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_reports_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "pozicije_v_cakanju"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "player_reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      player_scores: {
        Row: {
          computed_at: string
          player_id: number
          points: number
          round_id: number
        }
        Insert: {
          computed_at?: string
          player_id: number
          points: number
          round_id: number
        }
        Update: {
          computed_at?: string
          player_id?: number
          points?: number
          round_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "player_scores_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "krog_najboljsi"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "player_scores_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_scores_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_season_standings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_scores_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_standings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_scores_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_scores_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "pozicije_v_cakanju"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "player_scores_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "fantasy_round_points"
            referencedColumns: ["round_id"]
          },
          {
            foreignKeyName: "player_scores_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "fantasy_round_standings"
            referencedColumns: ["round_id"]
          },
          {
            foreignKeyName: "player_scores_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "naslednji_krog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_scores_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_scores_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "zadnji_odigrani_krog"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          active: boolean
          competition_id: number
          first_name: string
          full_name: string | null
          id: number
          last_name: string
          nzs_birth_year: number | null
          nzs_confirmed_at: string | null
          nzs_top_league: string | null
          nzs_top_league_minutes: number | null
          nzs_url: string | null
          position: string | null
          position_source: string
          shirt_number: number | null
          team_id: number
          value: number
          value_locked: boolean
          value_start: number | null
        }
        Insert: {
          active?: boolean
          competition_id?: number
          first_name: string
          full_name?: string | null
          id?: never
          last_name: string
          nzs_birth_year?: number | null
          nzs_confirmed_at?: string | null
          nzs_top_league?: string | null
          nzs_top_league_minutes?: number | null
          nzs_url?: string | null
          position?: string | null
          position_source?: string
          shirt_number?: number | null
          team_id: number
          value?: number
          value_locked?: boolean
          value_start?: number | null
        }
        Update: {
          active?: boolean
          competition_id?: number
          first_name?: string
          full_name?: string | null
          id?: never
          last_name?: string
          nzs_birth_year?: number | null
          nzs_confirmed_at?: string | null
          nzs_top_league?: string | null
          nzs_top_league_minutes?: number | null
          nzs_url?: string | null
          position?: string | null
          position_source?: string
          shirt_number?: number | null
          team_id?: number
          value?: number
          value_locked?: boolean
          value_start?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "players_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "players_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "competition_teams"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "krog_najboljsi"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "player_reports_view"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      position_priors: {
        Row: {
          player_id: number
          position: string
          score: number
          updated_at: string
        }
        Insert: {
          player_id: number
          position: string
          score?: number
          updated_at?: string
        }
        Update: {
          player_id?: number
          position?: string
          score?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "position_priors_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "krog_najboljsi"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "position_priors_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "position_priors_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_season_standings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "position_priors_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_standings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "position_priors_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "position_priors_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "pozicije_v_cakanju"
            referencedColumns: ["player_id"]
          },
        ]
      }
      position_votes: {
        Row: {
          created_at: string
          id: number
          player_id: number
          position: string
          voter_id: string
        }
        Insert: {
          created_at?: string
          id?: never
          player_id: number
          position: string
          voter_id: string
        }
        Update: {
          created_at?: string
          id?: never
          player_id?: number
          position?: string
          voter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "position_votes_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "krog_najboljsi"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "position_votes_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "position_votes_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_season_standings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "position_votes_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_standings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "position_votes_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "position_votes_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "pozicije_v_cakanju"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "position_votes_voter_id_fkey"
            columns: ["voter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      position_votes_deleted: {
        Row: {
          created_at: string | null
          deleted_at: string
          deleted_by: string | null
          id: number
          player_id: number | null
          position: string | null
          reason: string | null
          voter_id: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string
          deleted_by?: string | null
          id: number
          player_id?: number | null
          position?: string | null
          reason?: string | null
          voter_id?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string
          deleted_by?: string | null
          id?: number
          player_id?: number | null
          position?: string | null
          reason?: string | null
          voter_id?: string | null
        }
        Relationships: []
      }
      price_changes: {
        Row: {
          changed_at: string
          form: number
          id: number
          new_value: number
          old_value: number
          player_id: number
          round_id: number
        }
        Insert: {
          changed_at?: string
          form: number
          id?: never
          new_value: number
          old_value: number
          player_id: number
          round_id: number
        }
        Update: {
          changed_at?: string
          form?: number
          id?: never
          new_value?: number
          old_value?: number
          player_id?: number
          round_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "price_changes_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "krog_najboljsi"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "price_changes_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_changes_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_season_standings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_changes_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_standings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_changes_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_changes_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "pozicije_v_cakanju"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "price_changes_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "fantasy_round_points"
            referencedColumns: ["round_id"]
          },
          {
            foreignKeyName: "price_changes_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "fantasy_round_standings"
            referencedColumns: ["round_id"]
          },
          {
            foreignKeyName: "price_changes_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "naslednji_krog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_changes_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_changes_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "zadnji_odigrani_krog"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
          insider_team_id: number | null
          is_admin: boolean
        }
        Insert: {
          created_at?: string
          display_name: string
          id: string
          insider_team_id?: number | null
          is_admin?: boolean
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          insider_team_id?: number | null
          is_admin?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "profiles_insider_team_id_fkey"
            columns: ["insider_team_id"]
            isOneToOne: false
            referencedRelation: "competition_teams"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "profiles_insider_team_id_fkey"
            columns: ["insider_team_id"]
            isOneToOne: false
            referencedRelation: "krog_najboljsi"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "profiles_insider_team_id_fkey"
            columns: ["insider_team_id"]
            isOneToOne: false
            referencedRelation: "player_reports_view"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "profiles_insider_team_id_fkey"
            columns: ["insider_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      rounds: {
        Row: {
          competition_id: number
          deadline_at: string | null
          id: number
          number: number
          played_on: string | null
          season: string
          voting_closes_at: string | null
          voting_opens_at: string | null
        }
        Insert: {
          competition_id?: number
          deadline_at?: string | null
          id?: never
          number: number
          played_on?: string | null
          season: string
          voting_closes_at?: string | null
          voting_opens_at?: string | null
        }
        Update: {
          competition_id?: number
          deadline_at?: string | null
          id?: never
          number?: number
          played_on?: string | null
          season?: string
          voting_closes_at?: string | null
          voting_opens_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rounds_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rounds_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions_view"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          key: string
          value: Json
        }
        Insert: {
          key: string
          value: Json
        }
        Update: {
          key?: string
          value?: Json
        }
        Relationships: []
      }
      teams: {
        Row: {
          country_id: number
          id: number
          logo_url: string | null
          name: string
          short_name: string | null
        }
        Insert: {
          country_id: number
          id?: never
          logo_url?: string | null
          name: string
          short_name?: string | null
        }
        Update: {
          country_id?: number
          id?: never
          logo_url?: string | null
          name?: string
          short_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      appearance_points: {
        Row: {
          appearance_id: number | null
          assists: number | null
          clean_sheet: boolean | null
          goals: number | null
          goals_conceded: number | null
          match_id: number | null
          minutes_played: number | null
          player_id: number | null
          points: number | null
          position: string | null
          round_id: number | null
        }
        Relationships: [
          {
            foreignKeyName: "appearances_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "match_assist_status"
            referencedColumns: ["match_id"]
          },
          {
            foreignKeyName: "appearances_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appearances_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "krog_najboljsi"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "appearances_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appearances_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_season_standings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appearances_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_standings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appearances_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appearances_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "pozicije_v_cakanju"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "matches_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "fantasy_round_points"
            referencedColumns: ["round_id"]
          },
          {
            foreignKeyName: "matches_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "fantasy_round_standings"
            referencedColumns: ["round_id"]
          },
          {
            foreignKeyName: "matches_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "naslednji_krog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "zadnji_odigrani_krog"
            referencedColumns: ["id"]
          },
        ]
      }
      assist_vote_counts: {
        Row: {
          goal_id: number | null
          player_id: number | null
          votes: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assist_votes_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assist_votes_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "krog_najboljsi"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "assist_votes_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assist_votes_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_season_standings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assist_votes_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_standings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assist_votes_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assist_votes_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "pozicije_v_cakanju"
            referencedColumns: ["player_id"]
          },
        ]
      }
      competition_teams: {
        Row: {
          competition_id: number | null
          logo_url: string | null
          name: string | null
          short_name: string | null
          team_id: number | null
        }
        Relationships: [
          {
            foreignKeyName: "players_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "players_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions_view"
            referencedColumns: ["id"]
          },
        ]
      }
      competitions_view: {
        Row: {
          active: boolean | null
          country_code: string | null
          country_id: number | null
          country_name: string | null
          id: number | null
          mnzg_liga: string | null
          name: string | null
          prvi_fantasy_krog: number | null
          rok_pomak_ur: number | null
          short_name: string | null
          slug: string | null
          sort_order: number | null
          source: string | null
          source_league_code: string | null
        }
        Relationships: [
          {
            foreignKeyName: "competitions_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
        ]
      }
      fantasy_round_points: {
        Row: {
          competition_id: number | null
          fantasy_team_id: number | null
          penalty: number | null
          points: number | null
          round_id: number | null
          round_number: number | null
          season: string | null
          transfers: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fantasy_teams_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fantasy_teams_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions_view"
            referencedColumns: ["id"]
          },
        ]
      }
      fantasy_round_standings: {
        Row: {
          competition_id: number | null
          fantasy_team_id: number | null
          owner_name: string | null
          penalty: number | null
          points: number | null
          rank: number | null
          round_id: number | null
          round_number: number | null
          season: string | null
          team_name: string | null
          transfers: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fantasy_teams_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fantasy_teams_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions_view"
            referencedColumns: ["id"]
          },
        ]
      }
      fantasy_team_budget: {
        Row: {
          budget: number | null
          competition_id: number | null
          fantasy_team_id: number | null
          name: string | null
          remaining: number | null
          spent: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fantasy_teams_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fantasy_teams_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions_view"
            referencedColumns: ["id"]
          },
        ]
      }
      fantasy_team_standings: {
        Row: {
          best_round: number | null
          competition_id: number | null
          fantasy_team_id: number | null
          owner_name: string | null
          owner_registered_at: string | null
          rounds_played: number | null
          team_created_at: string | null
          team_name: string | null
          total_points: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fantasy_teams_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fantasy_teams_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions_view"
            referencedColumns: ["id"]
          },
        ]
      }
      fantasy_team_wealth: {
        Row: {
          cash: number | null
          competition_id: number | null
          fantasy_team_id: number | null
          name: string | null
          roster_value: number | null
          starting_budget: number | null
          total_wealth: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fantasy_teams_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fantasy_teams_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions_view"
            referencedColumns: ["id"]
          },
        ]
      }
      krog_najboljsi: {
        Row: {
          competition_id: number | null
          full_name: string | null
          minutes: number | null
          player_id: number | null
          points: number | null
          position: string | null
          price_delta: number | null
          rank: number | null
          round_id: number | null
          round_number: number | null
          season: string | null
          team_id: number | null
          team_logo: string | null
          team_name: string | null
          team_short: string | null
          value: number | null
        }
        Relationships: [
          {
            foreignKeyName: "player_scores_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "fantasy_round_points"
            referencedColumns: ["round_id"]
          },
          {
            foreignKeyName: "player_scores_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "fantasy_round_standings"
            referencedColumns: ["round_id"]
          },
          {
            foreignKeyName: "player_scores_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "naslednji_krog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_scores_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_scores_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "zadnji_odigrani_krog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rounds_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rounds_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions_view"
            referencedColumns: ["id"]
          },
        ]
      }
      match_assist_status: {
        Row: {
          away_goals: number | null
          away_logo: string | null
          away_name: string | null
          away_short: string | null
          away_team_id: number | null
          brez_asistence: number | null
          competition_id: number | null
          golov: number | null
          home_goals: number | null
          home_logo: string | null
          home_name: string | null
          home_short: string | null
          home_team_id: number | null
          match_id: number | null
          played_on: string | null
          round_id: number | null
          round_number: number | null
          season: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "competition_teams"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "matches_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "krog_najboljsi"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "matches_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "player_reports_view"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "matches_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "competition_teams"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "matches_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "krog_najboljsi"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "matches_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "player_reports_view"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "matches_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "fantasy_round_points"
            referencedColumns: ["round_id"]
          },
          {
            foreignKeyName: "matches_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "fantasy_round_standings"
            referencedColumns: ["round_id"]
          },
          {
            foreignKeyName: "matches_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "naslednji_krog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "zadnji_odigrani_krog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rounds_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rounds_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions_view"
            referencedColumns: ["id"]
          },
        ]
      }
      minute_kroga: {
        Row: {
          minutes: number | null
          player_id: number | null
          round_id: number | null
        }
        Relationships: [
          {
            foreignKeyName: "appearances_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "krog_najboljsi"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "appearances_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appearances_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_season_standings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appearances_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_standings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appearances_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appearances_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "pozicije_v_cakanju"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "matches_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "fantasy_round_points"
            referencedColumns: ["round_id"]
          },
          {
            foreignKeyName: "matches_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "fantasy_round_standings"
            referencedColumns: ["round_id"]
          },
          {
            foreignKeyName: "matches_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "naslednji_krog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "zadnji_odigrani_krog"
            referencedColumns: ["id"]
          },
        ]
      }
      naslednji_krog: {
        Row: {
          competition_id: number | null
          deadline_at: string | null
          id: number | null
          number: number | null
          played_on: string | null
          season: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rounds_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rounds_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions_view"
            referencedColumns: ["id"]
          },
        ]
      }
      player_overview: {
        Row: {
          active: boolean | null
          assists: number | null
          clean_sheets: number | null
          competition_id: number | null
          first_name: string | null
          full_name: string | null
          goals: number | null
          id: number | null
          last_name: string | null
          matches: number | null
          minutes: number | null
          points: number | null
          position: string | null
          position_source: string | null
          position_votes: number | null
          shirt_number: number | null
          team_id: number | null
          team_logo: string | null
          team_name: string | null
          team_short: string | null
          value: number | null
        }
        Relationships: [
          {
            foreignKeyName: "players_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "players_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "competition_teams"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "krog_najboljsi"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "player_reports_view"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      player_reports_view: {
        Row: {
          author_name: string | null
          competition_id: number | null
          content: string | null
          created_at: string | null
          id: number | null
          kind: string | null
          player_id: number | null
          player_name: string | null
          team_id: number | null
          team_logo: string | null
          team_name: string | null
          team_short: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "player_reports_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "krog_najboljsi"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "player_reports_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_reports_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_season_standings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_reports_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_standings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_reports_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_reports_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "pozicije_v_cakanju"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "player_reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "players_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "players_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions_view"
            referencedColumns: ["id"]
          },
        ]
      }
      player_season_standings: {
        Row: {
          assists: number | null
          clean_sheets: number | null
          competition_id: number | null
          form: number | null
          full_name: string | null
          goals: number | null
          id: number | null
          last_round: number | null
          matches: number | null
          minutes: number | null
          owners: number | null
          points: number | null
          points_per_match: number | null
          points_per_value: number | null
          position: string | null
          position_source: string | null
          rank: number | null
          season: string | null
          team_id: number | null
          team_logo: string | null
          team_name: string | null
          team_short: string | null
          value: number | null
        }
        Relationships: [
          {
            foreignKeyName: "players_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "players_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "competition_teams"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "krog_najboljsi"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "player_reports_view"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      player_season_stats: {
        Row: {
          assists: number | null
          clean_sheets: number | null
          goals: number | null
          matches: number | null
          minutes: number | null
          own_goals: number | null
          player_id: number | null
          points: number | null
          red_cards: number | null
          season: string | null
          yellow_cards: number | null
        }
        Relationships: [
          {
            foreignKeyName: "appearances_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "krog_najboljsi"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "appearances_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appearances_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_season_standings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appearances_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_standings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appearances_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appearances_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "pozicije_v_cakanju"
            referencedColumns: ["player_id"]
          },
        ]
      }
      player_standings: {
        Row: {
          assists: number | null
          clean_sheets: number | null
          competition_id: number | null
          form: number | null
          full_name: string | null
          goals: number | null
          id: number | null
          last_round: number | null
          matches: number | null
          minutes: number | null
          owners: number | null
          points: number | null
          points_per_match: number | null
          points_per_value: number | null
          position: string | null
          position_source: string | null
          rank: number | null
          team_id: number | null
          team_logo: string | null
          team_name: string | null
          team_short: string | null
          value: number | null
        }
        Relationships: [
          {
            foreignKeyName: "players_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "players_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "competition_teams"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "krog_najboljsi"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "player_reports_view"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      position_confidence: {
        Row: {
          players: number | null
          position_source: string | null
        }
        Relationships: []
      }
      position_prior_leader: {
        Row: {
          leader_position: string | null
          leader_score: number | null
          player_id: number | null
        }
        Relationships: [
          {
            foreignKeyName: "position_priors_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "krog_najboljsi"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "position_priors_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "position_priors_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_season_standings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "position_priors_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_standings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "position_priors_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "position_priors_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "pozicije_v_cakanju"
            referencedColumns: ["player_id"]
          },
        ]
      }
      position_vote_counts: {
        Row: {
          player_id: number | null
          position: string | null
          votes: number | null
        }
        Relationships: [
          {
            foreignKeyName: "position_votes_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "krog_najboljsi"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "position_votes_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "position_votes_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_season_standings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "position_votes_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_standings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "position_votes_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "position_votes_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "pozicije_v_cakanju"
            referencedColumns: ["player_id"]
          },
        ]
      }
      position_vote_weights: {
        Row: {
          player_id: number | null
          position: string | null
          votes: number | null
          weight: number | null
        }
        Relationships: [
          {
            foreignKeyName: "position_votes_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "krog_najboljsi"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "position_votes_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "position_votes_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_season_standings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "position_votes_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_standings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "position_votes_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "position_votes_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "pozicije_v_cakanju"
            referencedColumns: ["player_id"]
          },
        ]
      }
      pozicije_v_cakanju: {
        Row: {
          competition_id: number | null
          full_name: string | null
          glasov: number | null
          izglasovana: string | null
          player_id: number | null
          prag: number | null
          team_id: number | null
          trenutna: string | null
          utez: number | null
        }
        Relationships: [
          {
            foreignKeyName: "players_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "players_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "competition_teams"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "krog_najboljsi"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "player_reports_view"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      prihodnje_tekme: {
        Row: {
          competition_id: number | null
          doma: boolean | null
          match_id: number | null
          opponent_id: number | null
          opponent_logo: string | null
          opponent_name: string | null
          opponent_short: string | null
          played_on: string | null
          round_id: number | null
          round_number: number | null
          season: string | null
          team_id: number | null
        }
        Relationships: []
      }
      sezone: {
        Row: {
          competition_id: number | null
          krogov: number | null
          odigranih: number | null
          season: string | null
          tekoca: boolean | null
          zadnji_dan: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rounds_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rounds_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions_view"
            referencedColumns: ["id"]
          },
        ]
      }
      voter_position_accuracy: {
        Row: {
          correct: number | null
          resolved: number | null
          voter_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "position_votes_voter_id_fkey"
            columns: ["voter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      zadnji_odigrani_krog: {
        Row: {
          competition_id: number | null
          id: number | null
          number: number | null
          played_on: string | null
          season: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rounds_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rounds_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions_view"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      adaptivni_prag: {
        Args: { p_player_id: number; p_position: string }
        Returns: number
      }
      admin_uporabniki: {
        Args: { p_competition_id?: number }
        Returns: {
          display_name: string
          ekipa_veljavna: boolean
          email: string
          is_admin: boolean
          registered_at: string
          roster_stevilo: number
          team_id: number
          team_name: string
          user_id: string
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      krog_je_odigran: { Args: { p_round_id: number }; Returns: boolean }
      nastavitev_int: {
        Args: { p_key: string; p_privzeto: number }
        Returns: number
      }
      nedavni_opomnik: {
        Args: { p_competition_id: number; p_user_id: string }
        Returns: boolean
      }
      poenostavljeno_ime: { Args: { p_ime: string }; Returns: string }
      postava_kroga: {
        Args: { p_round: number; p_team: number }
        Returns: {
          bench_order: number
          is_captain: boolean
          is_starter: boolean
          is_vice: boolean
          player_id: number
        }[]
      }
      potrdi_asistenco: { Args: { p_goal_id: number }; Returns: undefined }
      potrdi_pozicijo: { Args: { p_player_id: number }; Returns: undefined }
      preracunaj_cene: {
        Args: { p_round_id: number }
        Returns: {
          forma: number
          igralec: number
          nova_cena: number
          stara_cena: number
        }[]
      }
      preracunaj_igralca: {
        Args: { p_okno?: string; p_player_id: number }
        Returns: number
      }
      pripisi_obranjene_enajstmetrovke: {
        Args: { p_round_id: number }
        Returns: number
      }
      recompute_round_scores: {
        Args: { p_round_id: number }
        Returns: undefined
      }
      roster_je_veljaven: { Args: { p_team_id: number }; Returns: boolean }
      shrani_ekipo: {
        Args: { p_roster: Json; p_team_id: number }
        Returns: Json
      }
      skupaj_uporabnikov: { Args: never; Returns: number }
      tekmovanje_id: { Args: { p_slug: string }; Returns: number }
      tocke_za_nastop: {
        Args: {
          p_assists: number
          p_clean_sheet: boolean
          p_conceded: number
          p_goals: number
          p_minutes: number
          p_own_goals: number
          p_pen_missed: number
          p_pen_saved: number
          p_position: string
          p_red: number
          p_yellow: number
        }
        Returns: number
      }
      ucinkovita_postava: {
        Args: { p_round: number; p_team: number }
        Returns: {
          mnozitelj: number
          player_id: number
        }[]
      }
      uveljavi_cene: { Args: { p_round_id: number }; Returns: number }
      uveljavi_pozicije: { Args: never; Returns: number }
      uveljavi_zapadle_cene: { Args: { p_okno?: string }; Returns: number }
      voter_weight: { Args: { p_voter_id: string }; Returns: number }
      zakleni_krog: { Args: { p_round_id: number }; Returns: number }
      zakleni_zapadle_kroge: { Args: { p_okno?: string }; Returns: number }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const

