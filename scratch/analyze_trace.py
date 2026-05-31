import json
import sys
from collections import defaultdict

def analyze_trace(trace_path):
    print(f"Reading trace file: {trace_path} ...")
    
    # Trace files can be structured as an object with a "traceEvents" key or a direct array of events.
    try:
        with open(trace_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        print(f"Error loading JSON: {e}")
        return

    events = data.get("traceEvents", []) if isinstance(data, dict) else data
    if not isinstance(events, list):
        print("Invalid trace event format: traceEvents is not a list")
        return

    print(f"Total events found: {len(events)}")

    # Group events by name to find the heaviest operations
    event_durations = defaultdict(float)
    event_counts = defaultdict(int)
    max_durations = defaultdict(float)
    
    gc_events = []
    animation_frame_events = []
    
    for event in events:
        name = event.get("name")
        ph = event.get("ph") # phase
        dur = event.get("dur") # duration in microseconds (us)
        ts = event.get("ts") # timestamp in us
        
        if not name or ph not in ("X", "B", "E"):
            continue
            
        # Only process complete events (X) or calculate durations from B/E if needed
        # Chrome trace events with phase 'X' have a duration 'dur' in microseconds
        if ph == "X" and dur is not None:
            dur_ms = dur / 1000.0
            event_durations[name] += dur_ms
            event_counts[name] += 1
            if dur_ms > max_durations[name]:
                max_durations[name] = dur_ms
                
            if "GarbageCollection" in name or name in ("GCEvent", "MajorGC", "MinorGC", "BlinkGC.AtomicPhase"):
                gc_events.append((ts / 1000.0, dur_ms, name))
            elif name == "FireAnimationFrame":
                animation_frame_events.append((ts / 1000.0, dur_ms))

    print("\n=== TOP 15 HEAVIEST TRACE EVENTS BY TOTAL DURATION ===")
    sorted_by_total = sorted(event_durations.items(), key=lambda x: x[1], reverse=True)[:15]
    for name, total_ms in sorted_by_total:
        avg = total_ms / event_counts[name]
        print(f" - {name:<40} | Total: {total_ms:10.2f} ms | Count: {event_counts[name]:6d} | Avg: {avg:6.2f} ms | Max: {max_durations[name]:8.2f} ms")

    print("\n=== TOP 10 SINGLE LONGEST EVENTS ===")
    # Find individual longest events
    individual_events = []
    for event in events:
        name = event.get("name")
        ph = event.get("ph")
        dur = event.get("dur")
        if ph == "X" and dur is not None:
            individual_events.append((name, dur / 1000.0, event.get("args")))
            
    individual_events.sort(key=lambda x: x[1], reverse=True)
    for name, dur_ms, args in individual_events[:10]:
        print(f" - {name:<40} | Duration: {dur_ms:8.2f} ms | Args: {str(args)[:100]}")

    print("\n=== GARBAGE COLLECTION ANALYSIS ===")
    if gc_events:
        print(f"Total GC events detected: {len(gc_events)}")
        total_gc_ms = sum(x[1] for x in gc_events)
        max_gc_ms = max(x[1] for x in gc_events)
        print(f"Total time spent in GC: {total_gc_ms:.2f} ms")
        print(f"Max single GC pause: {max_gc_ms:.2f} ms")
        print("Detailed GC events:")
        for ts, dur, name in sorted(gc_events, key=lambda x: x[1], reverse=True)[:10]:
            print(f"  * GC Event: {name:<25} | Duration: {dur:6.2f} ms | Timestamp: {ts:.2f} ms")
    else:
        print("No Garbage Collection events found in trace.")

    print("\n=== FRAME TIMING & JITTER ===")
    if len(animation_frame_events) > 1:
        # Calculate deltas between animation frames
        animation_frame_events.sort(key=lambda x: x[0])
        deltas = []
        stutters = 0
        for i in range(1, len(animation_frame_events)):
            dt = animation_frame_events[i][0] - animation_frame_events[i-1][0]
            deltas.append(dt)
            if dt > 22.0: # Frame time > 22ms (target is 16.6ms) is a stutter
                stutters += 1
                
        avg_dt = sum(deltas) / len(deltas)
        max_dt = max(deltas)
        print(f"Total frames tracked: {len(animation_frame_events)}")
        print(f"Average frame delta: {avg_dt:.2f} ms ({1000.0/avg_dt:.1f} FPS equivalent)")
        print(f"Max frame delta (longest frame): {max_dt:.2f} ms")
        print(f"Frames exceeding 22ms (stutters): {stutters} ({stutters/len(deltas)*100:.1f}%)")
    else:
        print("Not enough FireAnimationFrame events found to compute pacing.")

if __name__ == "__main__":
    path = "/home/yoga/Dokumen/game mmorpg/Trace-20260530T163015.json"
    if len(sys.argv) > 1:
        path = sys.argv[1]
    analyze_trace(path)
