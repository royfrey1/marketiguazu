import { supabase } from '../lib/supabase/client'

export const authService = {
  async resetPasswordForEmail(email: string, redirectTo: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
    return { error }
  },

  async updatePassword(newPassword: string) {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    return { error }
  },

  async updateEmail(newEmail: string) {
    const { error } = await supabase.auth.updateUser({ email: newEmail })
    return { error }
  },

  async reauthenticate(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  },
}
