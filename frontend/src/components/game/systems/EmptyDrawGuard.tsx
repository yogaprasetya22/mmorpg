'use client'

import { useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { hasDrawableGeometry } from '@/src/lib/has-drawable-geometry'

/**
 * EmptyDrawGuard — guard empty-vertex-buffer draws for WebGPU.
 *
 * Pattern from `pascalorg/editor` — `installEmptyDrawGuard` in Viewer.tsx.
 */
export const EmptyDrawGuard = () => {
    const gl = useThree((s) => s.gl)
    const installedRef = useRef(false)

    useEffect(() => {
        const renderer = gl as any

        if (installedRef.current) return

        const origRenderObject = renderer.renderObject?.bind(renderer) ?? (() => { })
        installedRef.current = true

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

        return () => {
            renderer.setRenderObjectFunction(origRenderObject)
            installedRef.current = false
        }
    }, [gl])

    return null
}
