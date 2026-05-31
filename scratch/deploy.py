#!/usr/bin/env python3
import os
import sys
import time
import subprocess

# Add parent directory to path so we can import vps_manager
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from vps_manager import (
    get_ssh_client,
    run_remote_command,
    VPS_IP,
    REMOTE_DIR,
    LOCAL_DIR,
    Colors
)

def is_excluded(local_filepath):
    # Normalize path separators
    normalized_path = local_filepath.replace('\\', '/')
    
    # Exclude directories recursively
    exclude_dirs = {'node_modules', '.next', '.git', '__pycache__', 'build', '.vscode', 'scratch'}
    for part in normalized_path.split('/'):
        if part in exclude_dirs:
            return True
            
    # Exclude specific file names or suffixes
    base = os.path.basename(normalized_path)
    if base.startswith('Trace-') or base.endswith('.pyc') or base.endswith('.db') or base.endswith('.gz'):
        return True
    if base in {'.env', '.DS_Store', 'vps_manager.py', 'deploy.py'}:
        return True
        
    return False

def get_git_changed_files():
    """Get list of modified and untracked files from git."""
    try:
        # Get modified files (both staged and unstaged)
        staged = subprocess.check_output(['git', 'diff', '--cached', '--name-only'], cwd=LOCAL_DIR).decode('utf-8').splitlines()
        unstaged = subprocess.check_output(['git', 'diff', '--name-only'], cwd=LOCAL_DIR).decode('utf-8').splitlines()
        # Get untracked files
        untracked = subprocess.check_output(['git', 'ls-files', '--others', '--exclude-standard'], cwd=LOCAL_DIR).decode('utf-8').splitlines()
        
        all_changed = set(staged + unstaged + untracked)
        return [os.path.join(LOCAL_DIR, f) for f in all_changed]
    except Exception as e:
        print(f"{Colors.WARNING}⚠️  Git check failed ({e}), falling back to full scan.{Colors.ENDC}")
        return None

def non_interactive_sync(client):
    print(f"\n{Colors.CYAN}🚀 Starting Git-based non-interactive file synchronization to VPS...{Colors.ENDC}")
    print(f"📂 Local Root:       {LOCAL_DIR}")
    print(f"📂 VPS Target Path:  {REMOTE_DIR}")

    changed_files = get_git_changed_files()
    
    if changed_files is not None:
        files_to_upload = []
        for filepath in changed_files:
            if os.path.exists(filepath) and not os.path.isdir(filepath) and not is_excluded(filepath):
                files_to_upload.append(filepath)
    else:
        # Fallback to full scan if git failed
        files_to_upload = []
        for root, dirs, files in os.walk(LOCAL_DIR):
            dirs[:] = [d for d in dirs if not is_excluded(os.path.join(root, d))]
            for file in files:
                filepath = os.path.join(root, file)
                if not is_excluded(filepath):
                    files_to_upload.append(filepath)

    total_files = len(files_to_upload)
    if total_files == 0:
        print(f"{Colors.GREEN}✅ No changed files to upload.{Colors.ENDC}")
        return True

    print(f"📦 Found {Colors.BOLD}{total_files}{Colors.ENDC} files to synchronize.")
    for f in files_to_upload:
        print(f"   - {os.path.relpath(f, LOCAL_DIR)}")

    sftp = client.open_sftp()
    uploaded_count = 0
    start_time = time.time()

    try:
        try:
            sftp.stat(REMOTE_DIR)
        except FileNotFoundError:
            client.exec_command(f"mkdir -p {REMOTE_DIR}")
            time.sleep(0.5)

        for i, filepath in enumerate(files_to_upload, 1):
            rel_path = os.path.relpath(filepath, LOCAL_DIR)
            remote_path = os.path.join(REMOTE_DIR, rel_path).replace('\\', '/')

            remote_parent = os.path.dirname(remote_path)
            try:
                sftp.stat(remote_parent)
            except FileNotFoundError:
                client.exec_command(f"mkdir -p {remote_parent}")
                time.sleep(0.05)

            percent = (i / total_files) * 100
            print(f"\r📤 Uploading [{i}/{total_files}] ({percent:.1f}%) -> {rel_path[:50]}...", end="", flush=True)

            try:
                sftp.put(filepath, remote_path)
                uploaded_count += 1
            except Exception as e:
                print(f"\n{Colors.FAIL}❌ Failed to upload {rel_path}: {e}{Colors.ENDC}")

        elapsed = time.time() - start_time
        print(f"\n\n{Colors.GREEN}✅ SFTP Sync completed successfully!{Colors.ENDC}")
        print(f"📊 Summary: Synced {uploaded_count}/{total_files} files in {elapsed:.2f} seconds.")
        return True
    except Exception as e:
        print(f"\n{Colors.FAIL}❌ SFTP Sync failed: {e}{Colors.ENDC}")
        return False
    finally:
        sftp.close()

def main():
    client = get_ssh_client()
    if not client:
        print(f"{Colors.FAIL}❌ Could not connect to VPS SSH.{Colors.ENDC}")
        sys.exit(1)

    try:
        # Sync files
        sync_success = non_interactive_sync(client)
        if not sync_success:
            print(f"{Colors.FAIL}❌ File synchronization failed. Aborting rebuild.{Colors.ENDC}")
            sys.exit(1)

        # Trigger clean rebuild of the frontend container
        print(f"\n{Colors.CYAN}🏗️  Rebuilding the Next.js frontend container on the VPS...{Colors.ENDC}")
        rebuild_success, err = run_remote_command(client, "docker compose up -d --build frontend")
        if rebuild_success:
            print(f"\n{Colors.GREEN}🎉 DEPLOYMENT SUCCESSFUL!{Colors.ENDC}")
            print(f"🌐 Game Client URL: {Colors.CYAN}{Colors.BOLD}http://{VPS_IP}:18033{Colors.ENDC}")
        else:
            print(f"\n{Colors.FAIL}❌ Deployment failed during rebuild: {err}{Colors.ENDC}")
            sys.exit(1)

    finally:
        client.close()
        print(f"\n🔌 SSH Connection closed.")

if __name__ == "__main__":
    main()
