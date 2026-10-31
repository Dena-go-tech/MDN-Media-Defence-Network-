import { useLayoutEffect, useRef } from 'react'
import { renderPose } from './lib/buddy-bulb.js'

// Static (non-animated) bulb for the site logo.
export default function LogoBulb() {
  const host = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    const el = host.current!
    const svg = renderPose(el, 'idle', 'logo')
    svg.removeAttribute('role')
    svg.setAttribute('aria-hidden', 'true')
    return () => {
      el.innerHTML = ''
    }
  }, [])

  return <span ref={host} className="logo-bulb" />
}
