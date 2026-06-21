import os
import re

# Configuration
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
# Both frontend and backend are siblings under game mmorpg directory
WORKSPACE_ROOT = os.path.dirname(os.path.dirname(SCRIPT_DIR)) # game mmorpg
BACKEND_ASSETS_DIR = os.path.join(WORKSPACE_ROOT, "backend", "assets")
ENVIRONMENT_DIR = os.path.join(BACKEND_ASSETS_DIR, "environment")
TEXTURES_DIR = os.path.join(BACKEND_ASSETS_DIR, "textures", "materials")
OUTPUT_FILE = os.path.join(WORKSPACE_ROOT, "frontend", "src", "core", "logic", "environment", "assetRegistry.ts")

def format_name(filename):
    name = os.path.splitext(filename)[0]
    name = re.sub(r'[-_]', ' ', name)
    return name.title()

def find_texture(folder, pattern):
    """Finds a file in folder (recursive) matching a keyword pattern."""
    for root, dirs, files in os.walk(folder):
        for f in files:
            if any(p in f.lower() for p in pattern):
                if f.lower().endswith(('.jpg', '.jpeg', '.png')):
                    # Path relative to backend/assets
                    rel_path = os.path.relpath(os.path.join(root, f), BACKEND_ASSETS_DIR)
                    return rel_path.replace(os.sep, '/')
    return None

def generate_registry():
    # Dynamic detection of subdirectories to determine valid categories
    subdirs = []
    if os.path.exists(ENVIRONMENT_DIR):
        subdirs = sorted([d for d in os.listdir(ENVIRONMENT_DIR) if os.path.isdir(os.path.join(ENVIRONMENT_DIR, d))])
    
    # Format categories list for typescript type definition
    categories_union = " | ".join([f"'{d}'" for d in subdirs])
    if not categories_union:
        categories_union = "'trees' | 'vegetation' | 'rocks' | 'characters'"

    lines = [
        "'use client';",
        "",
        "import { API_BASE_URL } from '@/src/core/config';",
        "",
        "export interface AssetInfo {",
        "  name: string;",
        "  path: string;",
        f"  category: {categories_union};",
        "}",
        "",
        "export interface MaterialInfo {",
        "  id: string;",
        "  name: string;",
        "  diffuse?: string;",
        "  normal?: string;",
        "  roughness?: string;",
        "  displacement?: string;",
        "}",
        "",
        "// FULL_ASSET_LIBRARY fallback static list",
        "export let FULL_ASSET_LIBRARY: AssetInfo[] = ["
    ]

    for subdir in subdirs:
        dir_path = os.path.join(ENVIRONMENT_DIR, subdir)
        lines.append(f"  // {subdir.upper()} Assets")
        files = sorted([f for f in os.listdir(dir_path) if f.endswith(('.glb', '.gltf'))])
        for filename in files:
            name = format_name(filename)
            lines.append(f"  {{ name: \"{name}\", path: `${{API_BASE_URL}}/assets/environment/{subdir}/{filename}`, category: '{subdir}' }},")
        lines.append("")

    lines.append("];")
    lines.append("")

    lines.append("// Helper to update the asset library in-place")
    lines.append("export function setAssetLibrary(assets: AssetInfo[]) {")
    lines.append("  FULL_ASSET_LIBRARY.length = 0; // Clear array in-place")
    lines.append("  FULL_ASSET_LIBRARY.push(...assets); // Add loaded assets")
    lines.append("}")
    lines.append("")

    # 2. Generate Material Registry
    lines.append("export const FULL_MATERIAL_LIBRARY: MaterialInfo[] = [")
    if os.path.exists(TEXTURES_DIR):
        folders = sorted([f for f in os.listdir(TEXTURES_DIR) if os.path.isdir(os.path.join(TEXTURES_DIR, f))])
        for index, folder_name in enumerate(folders):
            full_path = os.path.join(TEXTURES_DIR, folder_name)
            
            diff = find_texture(full_path, ['diff', 'color', 'albedo', 'basecolor'])
            nor = find_texture(full_path, ['nor', 'nrm'])
            rough = find_texture(full_path, ['rough', 'rgh'])
            disp = find_texture(full_path, ['disp', 'height'])
            
            if diff:
                name = format_name(folder_name)
                tex_id = f"texture_{index + 1}"
                lines.append(f"  {{")
                lines.append(f"    id: \"{tex_id}\",")
                lines.append(f"    name: \"{name}\",")
                lines.append(f"    diffuse: `${{API_BASE_URL}}/assets/{diff}`,")
                if nor: lines.append(f"    normal: `${{API_BASE_URL}}/assets/{nor}`,")
                if rough: lines.append(f"    roughness: `${{API_BASE_URL}}/assets/{rough}`,")
                if disp: lines.append(f"    displacement: `${{API_BASE_URL}}/assets/{disp}`,")
                lines.append(f"  }},")

    lines.append("];")

    # Write to file
    with open(OUTPUT_FILE, "w") as f:
        f.write("\n".join(lines))
    
    print(f"Successfully generated asset and material registry at: {OUTPUT_FILE}")

if __name__ == "__main__":
    generate_registry()
