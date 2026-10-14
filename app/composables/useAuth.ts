import type { RecordModel } from 'pocketbase'
import type { InstanceConfig } from '~/utils/types'

let listening = false

// Passwordless login state (email + 6-digit code), backed by PocketBase's authStore.
export function useAuth() {
  const pb = usePb()
  const user = useState<RecordModel | null>('auth-user', () => (pb.authStore.isValid ? pb.authStore.record : null))

  if (!listening) {
    listening = true
    pb.authStore.onChange(() => {
      user.value = pb.authStore.isValid ? pb.authStore.record : null
    })
  }

  const api = useApi()
  const { locale } = useI18n()

  async function requestCode(email: string): Promise<string> {
    await api.post('/auth/start', { email, lang: locale.value })
    try {
      const result = await pb.collection('users').requestOTP(email)
      return result.otpId
    } catch (err) {
      throw toApiError(err)
    }
  }

  async function verifyCode(otpId: string, code: string) {
    try {
      await pb.collection('users').authWithOTP(otpId, code)
    } catch (err) {
      const error = toApiError(err)
      // PocketBase answers 400 for a wrong or expired code.
      throw error.status === 400 ? new ApiError('invalid_code', 400) : error
    }
  }

  function logout() {
    pb.authStore.clear()
  }

  return { user, requestCode, verifyCode, logout }
}

// Instance-wide settings (who can create events, limits, …), loaded once.
export function useInstanceConfig() {
  const config = useState<InstanceConfig | null>('instance-config', () => null)
  const api = useApi()

  async function load() {
    if (!config.value) {
      try {
        config.value = await api.get<InstanceConfig>('/config')
      } catch {
        config.value = null
      }
    }
    return config.value
  }

  return { config, load }
}
