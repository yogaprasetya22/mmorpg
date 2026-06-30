'use client'

import { useThree } from '@react-three/fiber'
import { useLayoutEffect } from 'react'

type FrameLimiterProps = {
    fps?: number
}

/**
 * FrameLimiter — overrides R3F default render loop with a capped manual loop.
 *
 * Sets `frameloop: 'never'` on mount and drives `advance()` at a fixed interval.
 * Background tabs consume 0% CPU (RAF pauses automatically).
 * Components that need per-frame animation call `invalidate()` explicitly.
 */
const FrameLimiter: React.FC<FrameLimiterProps> = ({ fps = 50 }) => {
    const { advance, set, frameloop: initFrameloop } = useThree()

    useLayoutEffect(() => {
        let elapsed = 0
        let then = 0
        let i = 0
        let raf: number | null = null
        const interval = 1000 / fps

        function tick(t: DOMHighResTimeStamp) {
            raf = requestAnimationFrame(tick)
            elapsed = t - then
            if (elapsed > interval) {
                advance(i)
                i += elapsed / 1000 - (elapsed % interval) / 1000
                then = t - (elapsed % interval)
            }
        }

        set({ frameloop: 'never' })
        raf = requestAnimationFrame(tick)

        return () => {
            if (raf) cancelAnimationFrame(raf)
            set({ frameloop: initFrameloop })
        }
    }, [fps, advance, set, initFrameloop])

    return null
}

export default FrameLimiter
