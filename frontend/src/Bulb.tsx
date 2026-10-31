import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from 'react'
import createBulb, { type BulbController, type BulbOptions } from './lib/buddy-bulb.js'

// Thin wrapper: creates the character on mount, destroys it on unmount and
// exposes the controller to the parent through a ref.
const Bulb = forwardRef<BulbController | null, BulbOptions>(function Bulb(options, ref) {
  const host = useRef<HTMLDivElement>(null)
  const bulb = useRef<BulbController | null>(null)

  // Layout effect so the controller exists before useImperativeHandle runs.
  useLayoutEffect(() => {
    bulb.current = createBulb(host.current!, options)
    return () => {
      bulb.current?.destroy()
      bulb.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useImperativeHandle(ref, () => bulb.current!, [])

  return <div ref={host} className="bulb-host" />
})

export default Bulb
