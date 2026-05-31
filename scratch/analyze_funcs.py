import json
import sys

def parse_function_calls(trace_path):
    print(f"Parsing trace file: {trace_path} ...")
    try:
        with open(trace_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        print(f"Error: {e}")
        return

    events = data.get("traceEvents", []) if isinstance(data, dict) else data
    if not isinstance(events, list):
        print("Invalid trace event format")
        return

    # Let's extract all FunctionCall events
    func_calls = []
    for event in events:
        name = event.get("name")
        ph = event.get("ph")
        dur = event.get("dur")
        if name == "FunctionCall" and ph == "X" and dur is not None:
            dur_ms = dur / 1000.0
            # Let's get details from args
            args = event.get("args", {})
            data_arg = args.get("data", {})
            func_name = data_arg.get("functionName", "anonymous")
            script_id = data_arg.get("scriptId", "")
            url = data_arg.get("url", "")
            line = data_arg.get("lineNumber", -1)
            
            # Let's exclude the 746ms startup event
            if dur_ms < 500:
                func_calls.append((dur_ms, func_name, url, line, script_id))

    func_calls.sort(key=lambda x: x[0], reverse=True)
    print("\n=== TOP 30 LONGEST FUNCTION CALL EVENTS (excluding startup) ===")
    for dur_ms, func_name, url, line, script_id in func_calls[:30]:
        print(f" - {dur_ms:6.2f} ms | Function: {func_name:<30} | Line {line:<5} | URL: {url[-50:] if url else ''}")

if __name__ == "__main__":
    path = "/home/yoga/Dokumen/game mmorpg/Trace-20260530T163015.json"
    if len(sys.argv) > 1:
        path = sys.argv[1]
    parse_function_calls(path)
