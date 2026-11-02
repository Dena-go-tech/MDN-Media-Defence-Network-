import { useCallback, useEffect, useState } from 'react'
import { api } from './api'
import { useLang } from './i18n'

export function useFetch<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  // Refetch when the portal language changes: public content comes back translated.
  const { lang } = useLang()

  const reload = useCallback(() => {
    if (!path) return
    setLoading(true)
    api<T>(path)
      .then((d) => {
        setData(d)
        setError(null)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [path, lang])

  useEffect(reload, [reload])

  return { data, error, loading, reload }
}
