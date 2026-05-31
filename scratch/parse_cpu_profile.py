import json
import sys

def parse_cpu_profile(trace_path):
    print(f"Loading trace: {trace_path} ...")
    with open(trace_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    events = data.get("traceEvents", []) if isinstance(data, dict) else data
    
    # Let's find cpuProfile events
    # Or SampleProfile / CPUProfile
    profile_event = None
    for event in events:
        if event.get("name") == "CpuProfile" or "cpuProfile" in event.get("args", {}):
            profile_event = event
            break
            
    if not profile_event:
        # Check if there are 'Profile' or 'ProfileChunk' events
        print("No direct CpuProfile event found, checking ProfileChunks...")
        nodes = {}
        samples = []
        for event in events:
            if event.get("name") == "Profile":
                args = event.get("args", {})
                data_arg = args.get("data", {})
                if "startTime" in data_arg:
                    print("Found Profile event start")
            elif event.get("name") == "ProfileChunk":
                args = event.get("args", {})
                data_arg = args.get("data", {})
                cpu_profile = data_arg.get("cpuProfile", {})
                chunk_nodes = cpu_profile.get("nodes", [])
                for node in chunk_nodes:
                    node_id = node.get("id")
                    nodes[node_id] = node
                chunk_samples = cpu_profile.get("samples", [])
                samples.extend(chunk_samples)
        
        if nodes:
            print(f"Parsed profile from chunks: {len(nodes)} nodes, {len(samples)} samples")
            # Let's see if we can resolve 'cQ' or line 393
            cq_nodes = []
            for node_id, node in nodes.items():
                call_frame = node.get("callFrame", {})
                func_name = call_frame.get("functionName")
                url = call_frame.get("url", "")
                line = call_frame.get("lineNumber", -1)
                if func_name == "cQ" or "11wtrnqt2-i8i.js" in url:
                    cq_nodes.append(node)
                    
            print(f"Found {len(cq_nodes)} nodes associated with cQ/chunk")
            for node in cq_nodes[:20]:
                print(f"Node ID {node.get('id')}: {node.get('callFrame')}")
                
            # Let's find parent nodes of these nodes to see who calls them
            # In CPU profiles, nodes have a hierarchy or parent relationship
            # Wait, nodes typically don't have direct 'parent' pointer in the chunk JSON,
            # but we can look for nodes whose children contain these node IDs.
            parent_map = {}
            for nid, n in nodes.items():
                children = n.get("children", [])
                for child_id in children:
                    parent_map[child_id] = nid
                    
            print("\n=== Call Stack For cQ Nodes ===")
            for node in cq_nodes[:5]:
                stack = []
                curr_id = node.get("id")
                while curr_id in parent_map:
                    parent_id = parent_map[curr_id]
                    pnode = nodes[parent_id]
                    pframe = pnode.get("callFrame", {})
                    stack.append(f"{pframe.get('functionName')} ({pframe.get('url')}:{pframe.get('lineNumber')})")
                    curr_id = parent_id
                print(f"Node {node.get('id')} ({node.get('callFrame').get('functionName')}):")
                for s in stack[:5]:
                    print(f"  <- {s}")
        else:
            print("No CPU Profile chunks found either.")
            return

if __name__ == "__main__":
    path = "Trace-20260530T170009.json"
    if len(sys.argv) > 1:
        path = sys.argv[1]
    parse_cpu_profile(path)
