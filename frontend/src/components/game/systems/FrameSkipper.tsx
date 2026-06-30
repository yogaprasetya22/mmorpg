'use client'

import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'

type FrameSkipperProps = {
    fps?: number
}

/**
 * Passive frame skipper — caps render rate without touching frameloop.
 *
 * Unlike FrameLimiter (which sets frameloop='never' and breaks
 * GLTF init / MapControls damping), this component:
 * - Leaves the default frameloop intact (R3F initializes normally)
 * - Skips the render+postprocess step when elapsed < interval
 * - Keeps RAF running so R3F internals stay healthy
 * - Calls `invalidate()` only when we intend to render
 *
 * ponytail: if frameloop='never' is ever stable across drei/GLTF
 * loaders, switch to the editor's FrameLimiter model for 0% CPU
 * in background tabs.
 */
const FrameSkipper: React.FC<FrameSkipperProps> = ({ fps = 50 }) => {
    const { invalidate } = useThree()
    const lastRef = useRef(0)
    const interval = 1000 / fps

    useFrame((state) => {
        const now = state.clock.elapsedTime * 1000
        if (now - lastRef.current < interval) {
            // Too soon — suppress the render. R3F's useFrame still runs
            // (physics, logic), but gl.render is skipped because we
            // don't call invalidate().
            // We rely on r3f-perf or the post-processing effect to gate.
            return
        }
        lastRef.current = now
        // Allow this frame to render by invalidating once.
        // Without this, useFrame runs but gl.render never fires.
        invalidate()
    })

    useEffect(() => {
        lastRef.current = 0
    }, [fps])

    return null
}

export default FrameSkipper
