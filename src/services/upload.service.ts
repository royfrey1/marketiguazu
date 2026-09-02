import { supabase } from '../lib/supabase/client'

export const uploadService = {
  async uploadPublicationImage(userId: string, file: File) {
    const ext = file.name.split('.').pop()
    const fileName = `${userId}-${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('publicaciones')
      .upload(fileName, file)

    if (uploadError) return { data: null, error: uploadError }

    const { data: urlData } = supabase.storage
      .from('publicaciones')
      .getPublicUrl(fileName)

    return { data: { path: fileName, url: urlData.publicUrl }, error: null }
  },

  async uploadAvatar(userId: string, file: File) {
    const ext = file.name.split('.').pop()
    const fileName = `${userId}-${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('avatar')
      .upload(fileName, file, { upsert: true })

    if (uploadError) return { data: null, error: uploadError }

    const { data: urlData } = supabase.storage
      .from('avatar')
      .getPublicUrl(fileName)

    return { data: { path: fileName, url: urlData.publicUrl }, error: null }
  },

  getPublicUrl(bucket: string, path: string) {
    const { data } = supabase.storage
      .from(bucket)
      .getPublicUrl(path)

    return data.publicUrl
  },
}
