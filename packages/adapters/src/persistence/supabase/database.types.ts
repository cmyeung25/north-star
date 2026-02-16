export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      cases: {
        Row: {
          id: string;
          owner_id: string;
          title: string;
          description: string | null;
          currency: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id?: string;
          title: string;
          description?: string | null;
          currency?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          description?: string | null;
          currency?: string;
          updated_at?: string;
        };
      };
      scenarios: {
        Row: {
          id: string;
          case_id: string;
          owner_id: string;
          title: string;
          state: Json;
          revision: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          case_id: string;
          owner_id?: string;
          title: string;
          state?: Json;
          revision?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          state?: Json;
          revision?: number;
          updated_at?: string;
        };
      };
    };
  };
};
