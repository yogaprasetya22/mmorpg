// Long-Task Detector — tracks main-thread blocking >50ms via PerformanceObserver.
// Wire callback into ProfilerHUD snapshot accumulator for worker-migration decision data.
//
// ponytail: only used when debug mode active; gated by initLongTaskDetector() call site.

let longTaskCount = 0;
let longTaskTotalMs = 0;

export function initLongTaskDetector(
    onLongTask?: (duration: number) => void,
): () => void {
    if (typeof PerformanceObserver === "undefined") {
        console.warn("[LongTaskDetector] PerformanceObserver not available");
        return () => {};
    }

    const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
            if (entry.duration > 50) {
                longTaskCount += 1;
                longTaskTotalMs += entry.duration;
                onLongTask?.(entry.duration);
            }
        }
    });

    observer.observe({ type: "longtask", buffered: true });

    // Publish stats to window global so PerformanceHUD can poll without import
    const pump = () => {
        (window as any).__longTaskStats = {
            count: longTaskCount,
            totalMs: longTaskTotalMs,
        };
    };
    const interval = setInterval(pump, 500);

    console.log(
        "[LongTaskDetector] Active — monitoring main thread blocking >50ms",
    );

    return () => {
        observer.disconnect();
        clearInterval(interval);
        longTaskCount = 0;
        longTaskTotalMs = 0;
    };
}

export function getLongTaskStats() {
    return { count: longTaskCount, totalMs: longTaskTotalMs };
}
