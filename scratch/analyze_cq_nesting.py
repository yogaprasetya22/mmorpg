import json
import sys

def analyze_cq_nesting(trace_path):
    print(f"Loading trace file: {trace_path} ...")
    with open(trace_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    events = data.get("traceEvents", []) if isinstance(data, dict) else data
    
    # 1. Let's find all cQ FunctionCall events
    cq_events = []
    for event in events:
        name = event.get("name")
        ph = event.get("ph")
        dur = event.get("dur")
        if name == "FunctionCall" and ph == "X" and dur is not None:
            args = event.get("args", {})
            data_arg = args.get("data", {})
            func_name = data_arg.get("functionName")
            if func_name == "cQ":
                cq_events.append(event)
                
    print(f"Found {len(cq_events)} total FunctionCall events for 'cQ'")
    if not cq_events:
        return
        
    # Sort by duration to see the heaviest ones
    cq_events.sort(key=lambda x: x.get("dur", 0), reverse=True)
    
    # Let's take the top 5 heaviest cQ events and analyze what events are nested inside them
    print("\n=== Nesting analysis for top 5 heaviest cQ events ===")
    for idx, cq_ev in enumerate(cq_events[:5]):
        ts = cq_ev.get("ts")
        dur = cq_ev.get("dur")
        dur_ms = dur / 1000.0
        print(f"\ncQ Event {idx+1}: Duration {dur_ms:.2f} ms at timestamp {ts:.2f} us")
        
        # Find children: events entirely within this event's window
        children = []
        # Also find parent: the smallest event containing this event (excluding itself)
        parent = None
        parent_dur = float('inf')
        
        for event in events:
            ev_name = event.get("name")
            ev_ph = event.get("ph")
            ev_ts = event.get("ts")
            ev_dur = event.get("dur")
            
            if ev_ts is None or ev_dur is None or ev_ph != "X":
                continue
                
            # Check for children (exclude itself)
            if event != cq_ev and ev_ts >= ts and (ev_ts + ev_dur) <= (ts + dur):
                children.append(event)
                
            # Check for parent (exclude itself)
            if event != cq_ev and ev_ts <= ts and (ev_ts + ev_dur) >= (ts + dur):
                if ev_dur < parent_dur:
                    parent = event
                    parent_dur = ev_dur
                    
        if parent:
            p_args = parent.get("args", {})
            p_data = p_args.get("data", {})
            p_func = p_data.get("functionName", "anonymous")
            print(f"  Parent: {parent.get('name')} | Function: {p_func} | Duration: {parent_dur/1000.0:.2f} ms")
        else:
            print("  Parent: None found")
            
        print(f"  Total child events inside: {len(children)}")
        # Let's count child event types
        from collections import defaultdict
        child_counts = defaultdict(int)
        child_durations = defaultdict(float)
        for child in children:
            child_name = child.get("name")
            child_counts[child_name] += 1
            child_durations[child_name] += child.get("dur") / 1000.0
            
        sorted_children = sorted(child_durations.items(), key=lambda x: x[1], reverse=True)
        for name, tot_ms in sorted_children[:10]:
            print(f"    - Child event: {name:<25} | Total duration inside: {tot_ms:6.2f} ms | Count: {child_counts[name]}")

if __name__ == "__main__":
    path = "Trace-20260530T170009.json"
    if len(sys.argv) > 1:
        path = sys.argv[1]
    analyze_cq_nesting(path)
