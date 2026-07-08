'use client'

import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'

type WebGPUDeviceLossInfo = {
    reason?: string
    message?: string
}

type WebGPUDeviceLike = {
    lost: Promise<WebGPUDeviceLossInfo>
    label?: string
    features?: Set<string>
    addEventListener?: (type: string, listener: EventListener) => void
    removeEventListener?: (type: string, listener: EventListener) => void
}

/**
 * GPUDeviceWatcher — monitor WebGPU device for loss / uncaptured errors.
 *
 * Pattern from `pascalorg/editor` — `GPUDeviceWatcher` in Viewer.tsx.
 * Device loss can happen when tab backgrounded, driver crash, or GPU reset.
 * Uncaptured errors are normally silent; pipe to console.error for visibility.
 */
export const GPUDeviceWatcher = () => {
    const gl = useThree((s) => s.gl)

    useEffect(() => {
        const backend = (gl as any).backend
        const device = backend.device as WebGPUDeviceLike

        device.lost.then((info: WebGPUDeviceLossInfo) => {
            console.error(
                `[WebGPU] Device lost: reason="${info.reason ?? 'unknown'}", message="${info.message ?? ''}". ` +
                'Page reload needed to recover GPU context.',
            )
        })

        const onUncapturedError = (event: any) => {
            console.error('[WebGPU] Uncaptured error:', event?.error?.message, event?.error)
        }
        device.addEventListener?.('uncapturederror', onUncapturedError)

        return () => {
            device.removeEventListener?.('uncapturederror', onUncapturedError)
        }
    }, [gl])

    return null
}
