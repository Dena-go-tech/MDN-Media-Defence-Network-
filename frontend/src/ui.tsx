// Small shared visual pieces: icons and the shield logo.

export const ICONS = {
  arrow: 'M5 12h14M13 6l6 6-6 6',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm9 2-3.5-3.5',
  close: 'M6 6l12 12M18 6 6 18',
  check: 'M5 12.5 10 17 19 7',
  spark: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18',
  speaker: 'M4 9v6h4l5 4V5L8 9z',
  waveOn: 'M16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12',
  waveOff: 'M17 9l4 6M21 9l-4 6',
  news: 'M4 5h13v14H6a2 2 0 0 1-2-2V5Zm13 4h3v8a2 2 0 0 1-2 2M8 9h5M8 13h5',
  tests: 'M9 5h10M9 12h10M9 19h10M4 5l1 1 2-2M4 12l1 1 2-2M4 19l1 1 2-2',
  assistant: 'M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V17h5v-1.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3Zm-2.5 17h5',
  profile: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0',
  rating: 'M6 20v-6M12 20V5M18 20v-9',
  admin: 'M4 7h10M18 7h2M4 17h2M10 17h10M14 5v4M6 15v4',
}

export function Icon({ d, size = 18, className }: { d: string; size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export const Arrow = () => <Icon d={ICONS.arrow} />

export function LogoMark() {
  return (
    <span className="logo-mark">
      <svg width="24" height="24" viewBox="0 0 36 36" aria-hidden="true">
        <path d="M18 2 31 7v10c0 8-5.5 14.5-13 17C10.5 31.5 5 25 5 17V7z" fill="currentColor" />
        <path d="M12 22V13l6 6 6-6v9" fill="none" stroke="var(--logo-ink)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    </span>
  )
}
