import { useState, type ClipboardEvent, type ReactNode, type Ref } from 'react'

export type EditLang = 'ru' | 'ky'

/** RU | KG switch attached to one text field; a dot marks a filled-in translation. */
export function LangToggle({ value, onChange, kyFilled, label }: { value: EditLang; onChange: (l: EditLang) => void; kyFilled: boolean; label: string }) {
  return (
    <span className="lang-toggle" role="tablist" aria-label={`Язык поля «${label}»`}>
      <button type="button" role="tab" aria-selected={value === 'ru'} className={value === 'ru' ? 'active' : ''} onClick={() => onChange('ru')}>RU</button>
      <button
        type="button"
        role="tab"
        aria-selected={value === 'ky'}
        className={`${value === 'ky' ? 'active' : ''}${kyFilled ? ' filled' : ''}`}
        title={kyFilled ? 'Перевод заполнен' : 'Перевода нет: на сайте будет русский текст'}
        onClick={() => onChange('ky')}
      >KG</button>
    </span>
  )
}

interface FieldProps {
  label: string
  ru: string
  ky: string
  onRu: (v: string) => void
  onKy: (v: string) => void
  multiline?: boolean
  rows?: number
  required?: boolean
  placeholder?: string
  /** Without a visible label: the toggle sits inside the row, next to the input (answer options). */
  compact?: boolean
  /** Controlled language, for fields whose surroundings depend on it (article body toolbar). */
  lang?: EditLang
  onLang?: (l: EditLang) => void
  inputRef?: Ref<HTMLTextAreaElement>
  onPaste?: (e: ClipboardEvent<HTMLTextAreaElement>) => void
  id?: string
  hint?: ReactNode
  toolbar?: ReactNode
}

/**
 * A text field stored in two languages, like django-modeltranslation: Russian is the original,
 * Kyrgyz is optional and falls back to Russian on the site.
 */
export default function I18nField(p: FieldProps) {
  const [own, setOwn] = useState<EditLang>('ru')
  const lang = p.lang ?? own
  const setLang = p.onLang ?? setOwn
  const ky = lang === 'ky'
  const value = ky ? p.ky : p.ru
  const onChange = ky ? p.onKy : p.onRu
  const common = {
    id: p.id,
    value,
    lang: ky ? 'ky' : 'ru',
    className: ky ? 'i18n-ky' : undefined,
    'aria-label': `${p.label}${ky ? ' (кыргызча)' : ''}`,
    // Only the original is required; an empty translation falls back to it.
    required: !ky && p.required,
    placeholder: ky ? p.ru || 'Перевод на кыргызский' : p.placeholder,
  }
  const control = p.multiline
    ? <textarea {...common} ref={p.inputRef} rows={p.rows ?? 3} onPaste={p.onPaste} onChange={(e) => onChange(e.target.value)} />
    : <input {...common} onChange={(e) => onChange(e.target.value)} />
  const toggle = <LangToggle value={lang} onChange={setLang} kyFilled={!!p.ky.trim()} label={p.label} />

  if (p.compact) {
    return <div className="i18n-inline">{control}{toggle}</div>
  }
  return (
    <div className="field i18n-field">
      <div className="i18n-head">
        <label htmlFor={p.id} className="field-label">{p.label}</label>
        {toggle}
      </div>
      {p.toolbar}
      {control}
      {p.hint}
    </div>
  )
}
