import { ClientResponseError } from 'pocketbase'
import { toast } from 'vue-sonner'

export class ApiError extends Error {
  constructor(
    public code: string,
    public status: number,
    public data: Record<string, any> = {},
  ) {
    super(code)
  }
}

interface RequestOptions {
  body?: unknown
  query?: Record<string, string>
  /** Owner or moderator key (X-Askaway-Key). */
  key?: string | null
  /** Participant token (X-Askaway-Participant). */
  participant?: string | null
}

export function toApiError(err: unknown): ApiError {
  if (err instanceof ClientResponseError) {
    if (err.isAbort) return new ApiError('aborted', 0)
    if (err.status === 0) return new ApiError('offline', 0)
    const data = (err.response || {}) as Record<string, any>
    const fallback = err.status === 429 ? 'slow_down' : 'server_error'
    return new ApiError(String(data.code || fallback), err.status, data)
  }
  return new ApiError('server_error', 500)
}

// Calls the /api/askaway routes. Logged-in users' tokens are sent automatically.
export function useApi() {
  const pb = usePb()

  async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
    const headers: Record<string, string> = {}
    if (options.key) headers['X-Askaway-Key'] = options.key
    if (options.participant) headers['X-Askaway-Participant'] = options.participant
    try {
      return await pb.send<T>(`/api/askaway${path}`, {
        method,
        headers,
        query: options.query,
        body: options.body,
      })
    } catch (err) {
      throw toApiError(err)
    }
  }

  return {
    get: <T>(path: string, options?: RequestOptions) => request<T>('GET', path, options),
    post: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>('POST', path, { ...options, body: body ?? {} }),
    patch: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>('PATCH', path, { ...options, body: body ?? {} }),
    del: <T>(path: string, options?: RequestOptions) => request<T>('DELETE', path, options),
  }
}

// Shows a friendly, translated toast for an API error.
export function useErrorToast() {
  const { t, te } = useI18n()
  return (err: unknown) => {
    const error = err instanceof ApiError ? err : new ApiError('server_error', 500)
    if (error.code === 'aborted') return
    const key = `errors.${error.code}`
    const message = te(key) ? t(key, error.data) : t('errors.server_error')
    toast.error(message)
  }
}
