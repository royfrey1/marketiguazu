import { supabase } from '../lib/supabase/client'

interface ReportData {
  nombre: string
  email: string
  tipo_error: string
  descripcion: string
  user_id: string
}

export const reportService = {
  async create(report: ReportData) {
    const { data, error } = await supabase
      .from('reportes_errores')
      .insert(report)
      .select()
      .single()

    return { data, error }
  },
}
