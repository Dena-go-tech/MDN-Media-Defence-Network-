import { useRef, useState, type ClipboardEvent, type DragEvent } from 'react'
import { uploadImage } from '../api'

const imageFrom = (items: DataTransferItemList | null | undefined) => {
  for (const item of Array.from(items ?? [])) {
    if (item.kind === 'file' && item.type.startsWith('image/')) return item.getAsFile()
  }
  return null
}

/** Reads an image from the system clipboard (button press). Returns null if there is none. */
export async function clipboardImage(): Promise<File | null> {
  if (!navigator.clipboard?.read) throw new Error('Браузер не даёт доступ к буферу: нажмите Ctrl+V (⌘V) в поле.')
  const items = await navigator.clipboard.read()
  for (const item of items) {
    const type = item.types.find((t) => t.startsWith('image/'))
    if (type) {
      const blob = await item.getType(type)
      return new File([blob], `clipboard.${type.split('/')[1]}`, { type })
    }
  }
  return null
}

/** Pulls an image file out of a paste event, if the clipboard holds one. */
export const pastedImage = (e: ClipboardEvent) => imageFrom(e.clipboardData?.items)

/** Cover image: upload a file, paste from clipboard, drag & drop, or type a URL. */
export default function ImageField({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [over, setOver] = useState(false)

  const upload = async (file: File | null | undefined) => {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      onChange(await uploadImage(file))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const fromClipboard = async () => {
    try {
      const file = await clipboardImage()
      if (file) upload(file)
      else setError('В буфере обмена нет картинки.')
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setOver(false)
    upload(Array.from(e.dataTransfer.files).find((f) => f.type.startsWith('image/')))
  }

  return (
    <div className="field">
      <span className="field-label">Обложка статьи</span>
      <div
        className={`image-drop${over ? ' over' : ''}${value ? ' has-image' : ''}`}
        tabIndex={0}
        role="group"
        aria-label="Обложка: перетащите файл или вставьте картинку"
        onPaste={(e) => { const f = pastedImage(e); if (f) { e.preventDefault(); upload(f) } }}
        onDragOver={(e) => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
      >
        {value ? <img src={value} alt="Обложка" /> : (
          <span className="muted">Перетащите картинку сюда или кликните и нажмите Ctrl+V (⌘V)</span>
        )}
        {busy && <span className="image-drop-busy">Загружаем…</span>}
      </div>
      <div className="row wrap">
        <button type="button" className="btn small" onClick={() => fileRef.current?.click()} disabled={busy}>Загрузить файл</button>
        <button type="button" className="btn secondary small" onClick={fromClipboard} disabled={busy}>Вставить из буфера</button>
        {value && <button type="button" className="link-btn danger" onClick={() => onChange('')}>Убрать</button>}
      </div>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden
        onChange={(e) => { upload(e.target.files?.[0]); e.target.value = '' }} />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="или ссылка на картинку: https://…" aria-label="Ссылка на картинку" />
      {error && <span className="error" role="status">{error}</span>}
      <span className="muted small">JPEG, PNG, WebP или GIF до 8 МБ.</span>
    </div>
  )
}
