'use client'

import { useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'

/**
 * EmptyDrawGuard — guard empty-vertex-buffer draws for WebGPU only.
 *
 * three.js 0.183 WebGLRenderer does NOT have `setRenderObjectFunction`;
 * only WebGPURenderer (CommonRenderer) does.  On WebGL this guard is a no-op.
 *
 * Pattern from `pascalorg/editor` — `installEmptyDrawGuard` in Viewer.tsx.
 */
export const EmptyDrawGuard = () => {
    const gl = useThree((s) => s.gl)
    const installedRef = useRef(false)

    useEffect(() => {
        const renderer = gl as any

        // WebGL guard: no setRenderObjectFunction — skip
        if (typeof renderer.setRenderObjectFunction !== 'function') return

        if (installedRef.current) return

        const origRenderObject = renderer.renderObject?.bind(renderer) ?? (() => { })

        // lazy import to avoid three at module scope
        const { hasDrawableGeometry } = require('@/src/lib/has-drawable-geometry')

        renderer.setRenderObjectFunction(
            (
                object: any,
                scene: any,
                camera: any,
                geometry: any,
                material: any,
                group: any,
                lightsNode?: any,
                clippingContext?: any,
                passId?: any,
            ) => {
                if (!hasDrawableGeometry(geometry)) return
                origRenderObject(
                    object,
                    scene,
                    camera,
                    geometry,
                    material,
                    group,
                    lightsNode,
                    clippingContext,
                    passId,
                )
            },
        )

        installedRef.current = true

        return () => {
            if (typeof renderer.setRenderObjectFunction === 'function') {
                renderer.setRenderObjectFunction(origRenderObject)
            }
            installedRef.current = false
        }
    }, [gl])

    return null
}
