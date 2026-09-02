/**
 * Tipos TypeScript generados a partir del análisis de queries en el códigobase.
 *
 * IMPORTANTE: Estos tipos fueron derivados del análisis manual de todas las
 * consultas Supabase en el proyecto. No fueron generados por el CLI de Supabase.
 *
 * Si el CLI de Supabase se vuelve disponible, ejecutar:
 *   supabase gen types typescript --project-id <project-id> > src/lib/supabase/types.ts
 *
 * Tablas verificadas: profiles, publicaciones, categorias, favoritos, reportes_errores
 * Buckets de storage: publicaciones, avatar
 */

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          nombre: string
          whatsapp: string
          ciudad: string
          direccion: string | null
          avatar_url: string | null
          es_vendedor: boolean
          verificado: boolean
        }
        Insert: {
          id: string
          nombre: string
          whatsapp: string
          ciudad?: string
          direccion?: string | null
          avatar_url?: string | null
          es_vendedor?: boolean
          verificado?: boolean
        }
        Update: {
          id?: string
          nombre?: string
          whatsapp?: string
          ciudad?: string
          direccion?: string | null
          avatar_url?: string | null
          es_vendedor?: boolean
          verificado?: boolean
        }
      }
      publicaciones: {
        Row: {
          id: number
          user_id: string
          titulo: string
          descripcion: string | null
          precio: number
          precio_anterior: number | null
          imagen_url: string | null
          imagenes: string[] | null
          categoria_id: number
          activo: boolean
          created_at: string
          marca: string | null
          ventas: number | null
        }
        Insert: {
          id?: number
          user_id: string
          titulo: string
          descripcion?: string | null
          precio: number
          precio_anterior?: number | null
          imagen_url?: string | null
          imagenes?: string[] | null
          categoria_id: number
          activo?: boolean
          created_at?: string
          marca?: string | null
          ventas?: number | null
        }
        Update: {
          id?: number
          user_id?: string
          titulo?: string
          descripcion?: string | null
          precio?: number
          precio_anterior?: number | null
          imagen_url?: string | null
          imagenes?: string[] | null
          categoria_id?: number
          activo?: boolean
          created_at?: string
          marca?: string | null
          ventas?: number | null
        }
      }
      categorias: {
        Row: {
          id: number
          nombre: string
          icono: string
        }
        Insert: {
          id?: number
          nombre: string
          icono: string
        }
        Update: {
          id?: number
          nombre?: string
          icono?: string
        }
      }
      favoritos: {
        Row: {
          id: number
          user_id: string
          publicacion_id: number
        }
        Insert: {
          id?: number
          user_id: string
          publicacion_id: number
        }
        Update: {
          id?: number
          user_id?: string
          publicacion_id?: number
        }
      }
      reportes_errores: {
        Row: {
          id: number
          nombre: string
          email: string
          tipo_error: string
          descripcion: string
          user_id: string
        }
        Insert: {
          id?: number
          nombre: string
          email: string
          tipo_error: string
          descripcion: string
          user_id: string
        }
        Update: {
          id?: number
          nombre?: string
          email?: string
          tipo_error?: string
          descripcion?: string
          user_id?: string
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
