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
      addresses: {
        Row: {
          calle: string
          ciudad: string
          codigo_postal: string
          created_at: string
          departamento: string | null
          es_default: boolean
          id: number
          nombre: string
          numero: string | null
          pais: string
          piso: string | null
          provincia: string
          telefono: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          calle: string
          ciudad: string
          codigo_postal: string
          created_at?: string
          departamento?: string | null
          es_default?: boolean
          id?: never
          nombre: string
          numero?: string | null
          pais?: string
          piso?: string | null
          provincia: string
          telefono?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          calle?: string
          ciudad?: string
          codigo_postal?: string
          created_at?: string
          departamento?: string | null
          es_default?: boolean
          id?: never
          nombre?: string
          numero?: string | null
          pais?: string
          piso?: string | null
          provincia?: string
          telefono?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "addresses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_items: {
        Row: {
          cantidad: number
          cart_id: string
          created_at: string
          id: number
          precio_unitario: number
          product_id: number
          updated_at: string | null
          variant_id: number | null
        }
        Insert: {
          cantidad?: number
          cart_id: string
          created_at?: string
          id?: never
          precio_unitario: number
          product_id: number
          updated_at?: string | null
          variant_id?: number | null
        }
        Update: {
          cantidad?: number
          cart_id?: string
          created_at?: string
          id?: never
          precio_unitario?: number
          product_id?: number
          updated_at?: string | null
          variant_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_variant_id_product_id_fkey"
            columns: ["variant_id", "product_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id", "product_id"]
          },
        ]
      }
      carts: {
        Row: {
          created_at: string
          id: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "carts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          activo: boolean
          created_at: string
          icono: string | null
          id: number
          nombre: string
          parent_id: number | null
          slug: string
          sort_order: number
          updated_at: string | null
        }
        Insert: {
          activo?: boolean
          created_at?: string
          icono?: string | null
          id?: never
          nombre: string
          parent_id?: number | null
          slug: string
          sort_order?: number
          updated_at?: string | null
        }
        Update: {
          activo?: boolean
          created_at?: string
          icono?: string | null
          id?: never
          nombre?: string
          parent_id?: number | null
          slug?: string
          sort_order?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string
          id: number
          product_id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: never
          product_id: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: never
          product_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory: {
        Row: {
          created_at: string
          id: number
          low_stock_threshold: number
          product_id: number
          quantity: number
          reserved: number
          updated_at: string | null
          variant_id: number | null
        }
        Insert: {
          created_at?: string
          id?: never
          low_stock_threshold?: number
          product_id: number
          quantity?: number
          reserved?: number
          updated_at?: string | null
          variant_id?: number | null
        }
        Update: {
          created_at?: string
          id?: never
          low_stock_threshold?: number
          product_id?: number
          quantity?: number
          reserved?: number
          updated_at?: string | null
          variant_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_variant_id_product_id_fkey"
            columns: ["variant_id", "product_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id", "product_id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          cantidad: number
          created_at: string
          created_by: string | null
          direccion: string
          id: number
          inventory_id: number
          notas: string | null
          referencia_id: number | null
          referencia_tipo: string | null
          tipo: string
        }
        Insert: {
          cantidad: number
          created_at?: string
          created_by?: string | null
          direccion: string
          id?: never
          inventory_id: number
          notas?: string | null
          referencia_id?: number | null
          referencia_tipo?: string | null
          tipo: string
        }
        Update: {
          cantidad?: number
          created_at?: string
          created_by?: string | null
          direccion?: string
          id?: never
          inventory_id?: number
          notas?: string | null
          referencia_id?: number | null
          referencia_tipo?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "inventory_admin_view"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          cantidad: number
          created_at: string
          id: number
          nombre_producto: string
          order_id: number
          precio_unitario: number
          product_id: number | null
          sku: string | null
          subtotal: number
          variant_id: number | null
          variante_nombre: string | null
        }
        Insert: {
          cantidad: number
          created_at?: string
          id?: never
          nombre_producto: string
          order_id: number
          precio_unitario: number
          product_id?: number | null
          sku?: string | null
          subtotal: number
          variant_id?: number | null
          variante_nombre?: string | null
        }
        Update: {
          cantidad?: number
          created_at?: string
          id?: never
          nombre_producto?: string
          order_id?: number
          precio_unitario?: number
          product_id?: number | null
          sku?: string | null
          subtotal?: number
          variant_id?: number | null
          variante_nombre?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          direccion_envio: Json
          envio_costo: number
          id: number
          metodo_envio: string | null
          notas: string | null
          numero_pedido: string
          payment_status: string
          status: string
          subtotal: number
          total: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          direccion_envio: Json
          envio_costo?: number
          id?: never
          metodo_envio?: string | null
          notas?: string | null
          numero_pedido?: string
          payment_status?: string
          status?: string
          subtotal: number
          total: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          direccion_envio?: Json
          envio_costo?: number
          id?: never
          metodo_envio?: string | null
          notas?: string | null
          numero_pedido?: string
          payment_status?: string
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: number
          metadata: Json | null
          order_id: number
          provider: string
          provider_payment_id: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: never
          metadata?: Json | null
          order_id: number
          provider: string
          provider_payment_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: never
          metadata?: Json | null
          order_id?: number
          provider?: string
          provider_payment_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      price_history: {
        Row: {
          created_at: string
          id: number
          origen: string
          precio_anterior: number
          precio_nuevo: number
          product_id: number | null
          user_id: string | null
          variant_id: number | null
        }
        Insert: {
          created_at?: string
          id?: never
          origen: string
          precio_anterior: number
          precio_nuevo: number
          product_id?: number | null
          user_id?: string | null
          variant_id?: number | null
        }
        Update: {
          created_at?: string
          id?: never
          origen?: string
          precio_anterior?: number
          precio_nuevo?: number
          product_id?: number | null
          user_id?: string | null
          variant_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_history_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          alt_text: string | null
          created_at: string
          es_principal: boolean
          id: number
          product_id: number
          sort_order: number
          url: string
          variant_id: number | null
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          es_principal?: boolean
          id?: never
          product_id: number
          sort_order?: number
          url: string
          variant_id?: number | null
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          es_principal?: boolean
          id?: never
          product_id?: number
          sort_order?: number
          url?: string
          variant_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_specifications: {
        Row: {
          created_at: string
          id: number
          name: string
          product_id: number
          sort_order: number
          updated_at: string | null
          value: string
        }
        Insert: {
          created_at?: string
          id?: never
          name: string
          product_id: number
          sort_order?: number
          updated_at?: string | null
          value: string
        }
        Update: {
          created_at?: string
          id?: never
          name?: string
          product_id?: number
          sort_order?: number
          updated_at?: string | null
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_specifications_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          activo: boolean
          atributos: Json | null
          created_at: string
          id: number
          imagen_url: string | null
          nombre: string
          precio: number
          precio_anterior: number | null
          product_id: number
          sku: string
          sort_order: number
          updated_at: string | null
        }
        Insert: {
          activo?: boolean
          atributos?: Json | null
          created_at?: string
          id?: never
          imagen_url?: string | null
          nombre: string
          precio: number
          precio_anterior?: number | null
          product_id: number
          sku: string
          sort_order?: number
          updated_at?: string | null
        }
        Update: {
          activo?: boolean
          atributos?: Json | null
          created_at?: string
          id?: never
          imagen_url?: string | null
          nombre?: string
          precio?: number
          precio_anterior?: number | null
          product_id?: number
          sku?: string
          sort_order?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          activo: boolean
          alto_paquete_cm: number | null
          ancho_paquete_cm: number | null
          category_id: number
          created_at: string
          descripcion: string | null
          destacado: boolean
          fts: unknown
          id: number
          imagen_url: string | null
          largo_paquete_cm: number | null
          marca: string | null
          peso_envio_gramos: number | null
          precio: number
          precio_anterior: number | null
          slug: string
          titulo: string
          updated_at: string | null
        }
        Insert: {
          activo?: boolean
          alto_paquete_cm?: number | null
          ancho_paquete_cm?: number | null
          category_id: number
          created_at?: string
          descripcion?: string | null
          destacado?: boolean
          fts?: unknown
          id?: never
          imagen_url?: string | null
          largo_paquete_cm?: number | null
          marca?: string | null
          peso_envio_gramos?: number | null
          precio: number
          precio_anterior?: number | null
          slug: string
          titulo: string
          updated_at?: string | null
        }
        Update: {
          activo?: boolean
          alto_paquete_cm?: number | null
          ancho_paquete_cm?: number | null
          category_id?: number
          created_at?: string
          descripcion?: string | null
          destacado?: boolean
          fts?: unknown
          id?: never
          imagen_url?: string | null
          largo_paquete_cm?: number | null
          marca?: string | null
          peso_envio_gramos?: number | null
          precio?: number
          precio_anterior?: number | null
          slug?: string
          titulo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          ciudad: string | null
          created_at: string
          id: string
          nombre: string
          role: string
          telefono: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          ciudad?: string | null
          created_at?: string
          id: string
          nombre: string
          role?: string
          telefono?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          ciudad?: string | null
          created_at?: string
          id?: string
          nombre?: string
          role?: string
          telefono?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      reportes_errores: {
        Row: {
          created_at: string | null
          descripcion: string
          email: string | null
          id: number
          nombre: string | null
          tipo_error: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          descripcion: string
          email?: string | null
          id?: number
          nombre?: string | null
          tipo_error: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          descripcion?: string
          email?: string | null
          id?: number
          nombre?: string | null
          tipo_error?: string
          user_id?: string | null
        }
        Relationships: []
      }
      shipments: {
        Row: {
          costo: number
          created_at: string
          estimated_days: number | null
          id: number
          metadata: Json | null
          order_id: number
          provider: string
          provider_tracking_id: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          costo?: number
          created_at?: string
          estimated_days?: number | null
          id?: never
          metadata?: Json | null
          order_id: number
          provider: string
          provider_tracking_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          costo?: number
          created_at?: string
          estimated_days?: number | null
          id?: never
          metadata?: Json | null
          order_id?: number
          provider?: string
          provider_tracking_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawal_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          email: string
          handled_at: string | null
          handled_by: string | null
          id: number
          motivo: string | null
          nombre: string
          numero: string
          numero_pedido: string
          order_id: number
          order_item_ids: number[] | null
          status: string
          user_id: string
          within_deadline: boolean
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          email: string
          handled_at?: string | null
          handled_by?: string | null
          id?: number
          motivo?: string | null
          nombre: string
          numero?: string
          numero_pedido: string
          order_id: number
          order_item_ids?: number[] | null
          status?: string
          user_id: string
          within_deadline: boolean
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          email?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: number
          motivo?: string | null
          nombre?: string
          numero?: string
          numero_pedido?: string
          order_id?: number
          order_item_ids?: number[] | null
          status?: string
          user_id?: string
          within_deadline?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      inventory_admin_view: {
        Row: {
          category_nombre: string | null
          created_at: string | null
          id: number | null
          low_stock_threshold: number | null
          product_activo: boolean | null
          product_category_id: number | null
          product_id: number | null
          product_imagen_url: string | null
          product_slug: string | null
          product_titulo: string | null
          quantity: number | null
          reserved: number | null
          updated_at: string | null
          variant_activo: boolean | null
          variant_id: number | null
          variant_imagen_url: string | null
          variant_nombre: string | null
          variant_sku: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_variant_id_product_id_fkey"
            columns: ["variant_id", "product_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id", "product_id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["product_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_update_withdrawal: {
        Args: { p_id: number; p_notes: string | null; p_status: string }
        Returns: Json
      }
      adjust_stock: {
        Args: {
          p_inventory_id: number
          p_notas?: string
          p_quantity: number
          p_tipo: string
        }
        Returns: {
          created_at: string
          id: number
          low_stock_threshold: number
          product_id: number
          quantity: number
          reserved: number
          updated_at: string | null
          variant_id: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "inventory"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      cancel_order: {
        Args: { p_order_id: number; p_reason?: string }
        Returns: Json
      }
      confirm_sale: {
        Args: {
          p_cantidad: number
          p_order_id: number
          p_product_id: number
          p_variant_id: number
        }
        Returns: undefined
      }
      create_admin_product: {
        Args: {
          p_activo?: boolean
          p_alto_paquete_cm?: number
          p_ancho_paquete_cm?: number
          p_category_id: number
          p_descripcion?: string
          p_destacado?: boolean
          p_largo_paquete_cm?: number
          p_marca?: string
          p_peso_envio_gramos?: number
          p_precio: number
          p_precio_anterior?: number
          p_slug: string
          p_titulo: string
        }
        Returns: Json
      }
      create_product_variant: {
        Args: {
          p_activo?: boolean
          p_atributos?: Json
          p_imagen_url?: string
          p_nombre: string
          p_precio: number
          p_precio_anterior?: number
          p_product_id: number
          p_sku: string
        }
        Returns: {
          activo: boolean
          atributos: Json | null
          created_at: string
          id: number
          imagen_url: string | null
          nombre: string
          precio: number
          precio_anterior: number | null
          product_id: number
          sku: string
          sort_order: number
          updated_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "product_variants"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      create_shipment: {
        Args: {
          p_costo: number
          p_estimated_days?: number
          p_order_id: number
          p_provider: string
          p_provider_tracking_id?: string
        }
        Returns: Json
      }
      delete_product_variant: {
        Args: { p_variant_id: number }
        Returns: undefined
      }
      generate_order_number: { Args: never; Returns: string }
      get_product_availability: {
        Args: never
        Returns: {
          available: number
          product_id: number
        }[]
      }
      get_variant_availability: {
        Args: { p_product_id: number }
        Returns: {
          available: number
          variant_id: number
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      qa_reset_admin_order: { Args: { p_order_id: number }; Returns: Json }
      release_reservation: {
        Args: {
          p_cantidad: number
          p_order_id: number
          p_product_id: number
          p_variant_id: number
        }
        Returns: undefined
      }
      reserve_stock: {
        Args: {
          p_cantidad: number
          p_order_id: number
          p_product_id: number
          p_variant_id: number
        }
        Returns: undefined
      }
      update_admin_product: {
        Args: {
          p_activo?: boolean
          p_alto_paquete_cm?: number
          p_ancho_paquete_cm?: number
          p_category_id: number
          p_descripcion?: string
          p_destacado?: boolean
          p_largo_paquete_cm?: number
          p_marca?: string
          p_peso_envio_gramos?: number
          p_precio: number
          p_precio_anterior?: number
          p_product_id: number
          p_slug: string
          p_titulo: string
        }
        Returns: Json
      }
      update_order_status: {
        Args: { p_new_status: string; p_order_id: number }
        Returns: Json
      }
      update_payment_status: {
        Args: { p_new_status: string; p_payment_id: number }
        Returns: Json
      }
      update_product_variant: {
        Args: {
          p_activo?: boolean
          p_atributos?: Json
          p_imagen_url?: string
          p_nombre: string
          p_precio: number
          p_precio_anterior?: number
          p_sku: string
          p_variant_id: number
        }
        Returns: {
          activo: boolean
          atributos: Json | null
          created_at: string
          id: number
          imagen_url: string | null
          nombre: string
          precio: number
          precio_anterior: number | null
          product_id: number
          sku: string
          sort_order: number
          updated_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "product_variants"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      update_shipment: {
        Args: {
          p_costo?: number
          p_estimated_days?: number
          p_provider?: string
          p_provider_tracking_id?: string
          p_shipment_id: number
        }
        Returns: Json
      }
      update_shipment_status: {
        Args: { p_new_status: string; p_shipment_id: number }
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
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
