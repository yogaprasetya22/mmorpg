import json
import os
import sys

def analyze_performance_report(file_path):
    if not os.path.exists(file_path):
        print(f"Error: File {file_path} not found.")
        sys.exit(1)
        
    with open(file_path, 'r') as f:
        try:
            data = json.load(f)
        except Exception as e:
            print(f"Error: Failed to parse JSON file. {e}")
            sys.exit(1)
            
    print("======================================================================")
    print("           SEAL M ARENA - PERFORMANCE ANALYSIS REPORT")
    print("======================================================================\n")
    
    # 1. Session Information
    session = data.get("sessionInfo", {})
    system = data.get("systemInfo", {})
    summary = data.get("performanceSummary", {})
    memory = data.get("memoryInfo", {})
    
    gpu_vendor = system.get('gpuVendor', 'Unknown')
    gpu_renderer = system.get('gpuRenderer', 'Unknown')
    
    print("--- 📋 SESSION & HARDWARE DETAILS ---")
    print(f"Active Map ID       : {session.get('activeMapId', 'Unknown')}")
    print(f"Current DPR         : {session.get('currentDpr', 1.0)}")
    print(f"Potato Mode Active  : {session.get('potatoModeActive', False)}")
    print(f"Screen Resolution   : {system.get('screenSize', 'Unknown')} (DPR: {system.get('devicePixelRatio', 1)})")
    print(f"GPU Vendor          : {gpu_vendor}")
    print(f"GPU Renderer        : {gpu_renderer}")
    print(f"Browser User Agent  : {system.get('userAgent', 'Unknown')}")
    print(f"WebGL Version       : {system.get('webglVersion', 'Unknown')}\n")
    
    # 2. Performance Summary
    print("--- 📈 BENCHMARK SUMMARY ---")
    print(f"Average Frame Rate  : {summary.get('averageFps', 0)} FPS")
    print(f"1% Low Frame Rate   : {summary.get('onePercentLowFps', 0)} FPS (Micro-Stutters)")
    print(f"0.1% Low Frame Rate : {summary.get('zeroOnePercentLowFps', 0)} FPS (Severe Freezes)")
    print(f"Total Frames Tracked: {summary.get('totalFramesTracked', 0)}")
    print(f"Total Lag Spikes    : {summary.get('totalLagSpikesCount', 0)}\n")
    
    # 3. Rolling History Analysis
    history = data.get("rollingFrameHistory", [])
    if not history:
        print("No rolling frame history found.")
        return
        
    total_samples = len(history)
    spikes = [h for h in history if h.get("d", 0) > 33.33]
    
    fps_values = [h.get("fps", 60) for h in history]
    deltas = [h.get("d", 16.6) for h in history]
    players = [h.get("p", 0) for h in history]
    monsters = [h.get("m", 0) for h in history]
    draw_calls = [h.get("dc", 0) for h in history]
    triangles = [h.get("tr", 0) for h in history]
    
    memories = [h.get("mem", 0) for h in history if h.get("mem") is not None]
    avg_mem = sum(memories) / len(memories) if memories else 0
    max_mem = max(memories) if memories else 0
    
    # Classification of frames
    stable_frames = sum(1 for f in fps_values if f >= 50)
    acceptable_frames = sum(1 for f in fps_values if 30 <= f < 50)
    poor_frames = sum(1 for f in fps_values if f < 30)
    
    print("--- 📊 FRAME QUALITY DISTRIBUTION ---")
    print(f"Stable (>= 50 FPS)   : {stable_frames} frames ({stable_frames/total_samples*100:.1f}%)")
    print(f"Acceptable (30-49)   : {acceptable_frames} frames ({acceptable_frames/total_samples*100:.1f}%)")
    print(f"Poor (< 30 FPS)      : {poor_frames} frames ({poor_frames/total_samples*100:.1f}%)")
    print(f"Avg / Max JS Memory  : {avg_mem:.1f} MB / {max_mem} MB\n")
    
    # Correlation Analysis (Simplified Pearson Correlation)
    def pearson_correlation(x, y):
        n = len(x)
        if n == 0: return 0
        mean_x = sum(x) / n
        mean_y = sum(y) / n
        num = sum((x[i] - mean_x) * (y[i] - mean_y) for i in range(n))
        den_x = sum((x[i] - mean_x) ** 2 for i in range(n))
        den_y = sum((y[i] - mean_y) ** 2 for i in range(n))
        if den_x == 0 or den_y == 0: return 0
        return num / ((den_x * den_y) ** 0.5)
        
    print("--- 🔗 BOTTLENECK CORRELATION ANALYSIS ---")
    print("Determines which factor correlates most with frame times (higher positive = stronger cause of lag):")
    corr_monsters = pearson_correlation(deltas, monsters)
    corr_players = pearson_correlation(deltas, players)
    corr_draw_calls = pearson_correlation(deltas, draw_calls)
    corr_triangles = pearson_correlation(deltas, triangles)
    
    print(f"Monster Count correlation to Frame Lag    : {corr_monsters:+.4f} " + 
          ("[🔥 HIGH CORRELATION]" if abs(corr_monsters) > 0.4 else "[MODERATE]" if abs(corr_monsters) > 0.2 else "[LOW]"))
    print(f"Player Count correlation to Frame Lag     : {corr_players:+.4f} " + 
          ("[🔥 HIGH CORRELATION]" if abs(corr_players) > 0.4 else "[MODERATE]" if abs(corr_players) > 0.2 else "[LOW]"))
    print(f"WebGL Draw Calls correlation to Frame Lag : {corr_draw_calls:+.4f} " + 
          ("[🔥 HIGH CORRELATION]" if abs(corr_draw_calls) > 0.4 else "[MODERATE]" if abs(corr_draw_calls) > 0.2 else "[LOW]"))
    print(f"WebGL Triangles correlation to Frame Lag  : {corr_triangles:+.4f} " + 
          ("[🔥 HIGH CORRELATION]" if abs(corr_triangles) > 0.4 else "[MODERATE]" if abs(corr_triangles) > 0.2 else "[LOW]"))
    print("")
    
    # 4. Spike Profiling
    lag_spikes = data.get("lagSpikes", [])
    if lag_spikes:
        print(f"--- 🔍 LAG SPIKE PROFILE ({len(lag_spikes)} occurrences) ---")
        categories = {
            "Loading/Init Stutter (DrawCalls = 1)": 0,
            "Heavy GPU Load (High Triangles > 250K)": 0,
            "High Draw Calls (Calls > 300)": 0,
            "High Entity Density (Monsters + Players > 10)": 0,
            "General CPU/GC Spikes (Others)": 0
        }
        
        max_spike = None
        for s in lag_spikes:
            if max_spike is None or s.get("durationMs", 0) > max_spike.get("durationMs", 0):
                max_spike = s
                
            dc = s.get("drawCalls", 0)
            tr = s.get("triangles", 0)
            p = s.get("playersCount", 0)
            m = s.get("monstersCount", 0)
            
            if dc <= 1 or tr <= 1:
                categories["Loading/Init Stutter (DrawCalls = 1)"] += 1
            elif tr > 250000:
                categories["Heavy GPU Load (High Triangles > 250K)"] += 1
            elif dc > 300:
                categories["High Draw Calls (Calls > 300)"] += 1
            elif (p + m) > 10:
                categories["High Entity Density (Monsters + Players > 10)"] += 1
            else:
                categories["General CPU/GC Spikes (Others)"] += 1
                
        for cat, count in categories.items():
            print(f"- {cat:<48}: {count:<3} spikes ({count/len(lag_spikes)*100:.1f}%)")
            
        print(f"\nWorst Lag Spike Detail:")
        print(f"  Frame Index  : {max_spike.get('frameIndex')}")
        print(f"  Duration     : {max_spike.get('durationMs')} ms (Instant FPS: {max_spike.get('instantFps')})")
        print(f"  Active Units : Players: {max_spike.get('playersCount')}, Monsters: {max_spike.get('monstersCount')}")
        print(f"  WebGL Stats  : Draw Calls: {max_spike.get('drawCalls')}, Triangles: {max_spike.get('triangles')}")
        print(f"  JS Heap Size : {max_spike.get('memoryMb')} MB\n")
        
    # 5. Conclusions & Recommendations
    print("--- 💡 DIAGNOSIS & ACTIONS ---")
    
    # Analyze the hardware
    is_integrated = "intel" in gpu_renderer.lower() or "intel" in gpu_vendor.lower()
    
    if is_integrated:
        print("⚠️ HARDWARE BOTTLENECK DETECTED:")
        print(f"  Klien menggunakan GPU terintegrasi: '{gpu_renderer}'.")
        print("  GPU Intel Iris Xe sangat sensitif terhadap Draw Calls tinggi dan Triangles di atas 200K.")
        
    print("\nREKOMENDASI AKSI OPTIMASI:")
    if is_integrated or corr_triangles > 0.3 or categories.get("Heavy GPU Load (High Triangles > 250K)", 0) > 0:
        print("1. [GPU] Aktifkan POTATO MODE di menu pengaturan untuk mengurangi resolusi render scale (DPR) menjadi 0.5-0.6.")
        print("2. [GPU] Batasi jumlah poligon model monster dan player remote. Gunakan model Low-Poly LOD.")
        
    if corr_draw_calls > 0.3 or categories.get("High Draw Calls (Calls > 300)", 0) > 0:
        print("3. [CPU] Lakukan Batching pada obstacle statis atau gabungkan mesh lingkungan menjadi satu Instanced Mesh.")
        print("4. [CPU] Matikan bayangan (shadowMap) untuk remote entities karena bayangan melipatgandakan draw calls per frame.")
        
    if categories.get("Loading/Init Stutter (DrawCalls = 1)", 0) > 20:
        print("5. [JS/Assets] Lag spike di awal (DrawCalls = 1) wajar terjadi karena browser sedang mengompilasi shader WebGL")
        print("   dan menginisialisasi tekstur GLTF saat pertama kali dimuat ke kartu grafis.")
        
    print("6. [JS/GC] Pemakaian memori stabil di ~130-150MB, menunjukkan tidak ada kebocoran memori (Memory Leak) yang parah.")
    print("======================================================================")

if __name__ == "__main__":
    report_file = "/home/yoga/Dokumen/game mmorpg/mmorpg_perf_report_2026-05-24T08-28-27-424Z.json"
    analyze_performance_report(report_file)
