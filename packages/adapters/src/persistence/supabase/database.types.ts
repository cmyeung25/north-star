export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      cases: {
        Row: {
          id: string;
          owner_id: string;
          title: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id?: string;
          title: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          updated_at?: string;
        };
      };
      scenarios: {
        Row: {
          id: string;
          case_id: string;
          owner_id: string;
          title: string;
          payload: Json;
          schema_version: number;
          revision: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          case_id: string;
          owner_id?: string;
          title: string;
          payload: Json;
          schema_version?: number;
          revision?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          payload?: Json;
          schema_version?: number;
          revision?: number;
          updated_at?: string;
        };
      };
    };
  };
};
