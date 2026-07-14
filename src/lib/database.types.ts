/**
 * Supabase generated TS types — T-0.5 (Phase 0 apply gate).
 *
 * Generated with:
 *   supabase gen types typescript --project-id aruteznqhdaaxxvllvzm --schema public
 *
 * Pre-migration baseline (data-model schema, live in sa-east-1). `profiles.rol`
 * is a plain `string` here (CHECK constraint, not a Postgres enum) — this file
 * gets regenerated once the auth-pin migration lands (T-1.1/T-1.4), at which
 * point `profiles.activo` appears and `rol` still types as `string` (CHECK
 * constraints never surface as unions in generated types; the app-level
 * `"admin" | "empleado"` narrowing lives in application code, not here).
 *
 * DO NOT hand-edit. Excluded from ESLint/Prettier (generated code).
 */
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
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          detail: Json | null
          entity: string | null
          entity_id: string | null
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          detail?: Json | null
          entity?: string | null
          entity_id?: string | null
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          detail?: Json | null
          entity?: string | null
          entity_id?: string | null
          id?: string
        }
        Relationships: []
      }
      auth_attempts: {
        Row: {
          attempted_at: string
          id: string
          success: boolean
          user_id: string | null
        }
        Insert: {
          attempted_at?: string
          id?: string
          success: boolean
          user_id?: string | null
        }
        Update: {
          attempted_at?: string
          id?: string
          success?: boolean
          user_id?: string | null
        }
        Relationships: []
      }
      configuracion: {
        Row: {
          id: number
          nombre_tienda: string
          stock_minimo_default: number
          updated_at: string
        }
        Insert: {
          id?: number
          nombre_tienda?: string
          stock_minimo_default?: number
          updated_at?: string
        }
        Update: {
          id?: number
          nombre_tienda?: string
          stock_minimo_default?: number
          updated_at?: string
        }
        Relationships: []
      }
      movimientos_stock: {
        Row: {
          actor_id: string | null
          cantidad: number
          created_at: string
          id: string
          producto_id: string
          referencia_id: string | null
          tipo: string
        }
        Insert: {
          actor_id?: string | null
          cantidad: number
          created_at?: string
          id?: string
          producto_id: string
          referencia_id?: string | null
          tipo: string
        }
        Update: {
          actor_id?: string | null
          cantidad?: number
          created_at?: string
          id?: string
          producto_id?: string
          referencia_id?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "movimientos_stock_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      producto_costos: {
        Row: {
          costo: number
          producto_id: string
          proveedor_id: string | null
          updated_at: string
        }
        Insert: {
          costo: number
          producto_id: string
          proveedor_id?: string | null
          updated_at?: string
        }
        Update: {
          costo?: number
          producto_id?: string
          proveedor_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "producto_costos_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: true
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producto_costos_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
        ]
      }
      productos: {
        Row: {
          color_hex: string | null
          color_nombre: string | null
          created_at: string
          grosor: string | null
          id: string
          imagen_url: string | null
          marca: string | null
          nombre: string
          peso_metraje: string | null
          precio_venta: number
          sku: string | null
          stock: number
          stock_minimo: number | null
          tipo: string | null
          updated_at: string
        }
        Insert: {
          color_hex?: string | null
          color_nombre?: string | null
          created_at?: string
          grosor?: string | null
          id?: string
          imagen_url?: string | null
          marca?: string | null
          nombre: string
          peso_metraje?: string | null
          precio_venta: number
          sku?: string | null
          stock?: number
          stock_minimo?: number | null
          tipo?: string | null
          updated_at?: string
        }
        Update: {
          color_hex?: string | null
          color_nombre?: string | null
          created_at?: string
          grosor?: string | null
          id?: string
          imagen_url?: string | null
          marca?: string | null
          nombre?: string
          peso_metraje?: string | null
          precio_venta?: number
          sku?: string | null
          stock?: number
          stock_minimo?: number | null
          tipo?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          rol: string
        }
        Insert: {
          created_at?: string
          id: string
          rol?: string
        }
        Update: {
          created_at?: string
          id?: string
          rol?: string
        }
        Relationships: []
      }
      proveedores: {
        Row: {
          contacto: string | null
          created_at: string
          id: string
          nombre: string
          telefono: string | null
          updated_at: string
        }
        Insert: {
          contacto?: string | null
          created_at?: string
          id?: string
          nombre: string
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          contacto?: string | null
          created_at?: string
          id?: string
          nombre?: string
          telefono?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      venta_items: {
        Row: {
          cantidad: number
          id: string
          precio_unitario: number
          producto_id: string
          venta_id: string
        }
        Insert: {
          cantidad: number
          id?: string
          precio_unitario: number
          producto_id: string
          venta_id: string
        }
        Update: {
          cantidad?: number
          id?: string
          precio_unitario?: number
          producto_id?: string
          venta_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venta_items_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venta_items_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "ventas"
            referencedColumns: ["id"]
          },
        ]
      }
      ventas: {
        Row: {
          actor_id: string | null
          created_at: string
          estado: string
          id: string
          medio_pago: string
          total: number
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          estado?: string
          id?: string
          medio_pago: string
          total: number
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          estado?: string
          id?: string
          medio_pago?: string
          total?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      actualizar_producto: {
        Args: {
          p_costo?: number
          p_id: string
          p_producto: Json
          p_proveedor_id?: string
          p_stock_delta?: number
        }
        Returns: undefined
      }
      confirmar_venta: {
        Args: { p_items: Json; p_medio_pago: string }
        Returns: string
      }
      crear_producto: {
        Args: { p_costo?: number; p_producto: Json; p_proveedor_id?: string }
        Returns: string
      }
      deshacer_venta: { Args: { p_venta_id: string }; Returns: undefined }
      is_admin: { Args: never; Returns: boolean }
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
  public: {
    Enums: {},
  },
} as const
