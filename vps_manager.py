#!/usr/bin/env python3
import os
import sys
import time
import fnmatch

# ANSI colors for beautiful terminal output
class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'

# Auto-install dependencies if not present
try:
    import paramiko
    from paramiko import SSHClient, AutoAddPolicy
except ImportError:
    print(f"{Colors.WARNING}⚠️  Paramiko library is missing. Installing it now...{Colors.ENDC}")
    import subprocess
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "paramiko", "--break-system-packages"])
        import paramiko
        from paramiko import SSHClient, AutoAddPolicy
        print(f"{Colors.GREEN}✅ Paramiko successfully installed!{Colors.ENDC}\n")
    except Exception as e:
        print(f"{Colors.FAIL}❌ Failed to install paramiko automatically. Please run: pip install paramiko{Colors.ENDC}")
        print(e)
        sys.exit(1)

# VPS Connection Configuration
VPS_IP = "72.62.125.68"
VPS_PORT = 22
VPS_USER = "root"
VPS_PASS = "OnPers.123.123"
REMOTE_DIR = "/var/www/mmorpg"
LOCAL_DIR = os.path.dirname(os.path.abspath(__file__))

# Exclude patterns for file synchronization
EXCLUDE_PATTERNS = [
    '.git', '.git/*', 'node_modules', 'node_modules/*', '.next', '.next/*', 
    '__pycache__', '__pycache__/*', 'backend/build', 'backend/build/*', 
    '*.pyc', '*.db', '.env', '.DS_Store', 'vps_manager.py'
]

def print_header(title):
    print(f"\n{Colors.HEADER}{Colors.BOLD}================================================================={Colors.ENDC}")
    print(f"{Colors.CYAN}{Colors.BOLD} 🌐  MMORPG VPS OPERATIONS DASHBOARD - {title.upper()} {Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}================================================================={Colors.ENDC}")

def get_ssh_client():
    """Establish an SSH connection to the VPS."""
    print(f"🔌 Connecting to VPS {Colors.BOLD}{VPS_USER}@{VPS_IP}:{VPS_PORT}{Colors.ENDC}...")
    client = SSHClient()
    client.set_missing_host_key_policy(AutoAddPolicy())
    try:
        client.connect(VPS_IP, port=VPS_PORT, username=VPS_USER, password=VPS_PASS, timeout=10)
        print(f"{Colors.GREEN}✅ Connected successfully!{Colors.ENDC}")
        return client
    except Exception as e:
        print(f"{Colors.FAIL}❌ Connection failed: {e}{Colors.ENDC}")
        return None

def run_remote_command(client, command, show_output=True, directory=REMOTE_DIR):
    """Run a shell command on the VPS."""
    full_command = f"cd {directory} && {command}"
    if show_output:
        print(f"\n{Colors.BLUE}🏃 Running remote command:{Colors.ENDC} {Colors.BOLD}{full_command}{Colors.ENDC}")
    
    try:
        stdin, stdout, stderr = client.exec_command(full_command)
        
        # We need to print output dynamically if show_output is enabled
        if show_output:
            # Print standard output line-by-line
            for line in stdout:
                print(line, end="")
            
            # Print standard errors
            err_output = stderr.read().decode('utf-8')
            if err_output:
                print(f"{Colors.FAIL}{err_output}{Colors.ENDC}", file=sys.stderr)
            
            exit_status = stdout.channel.recv_exit_status()
            if exit_status == 0:
                print(f"{Colors.GREEN}✅ Command finished with exit code 0{Colors.ENDC}")
                return True, ""
            else:
                print(f"{Colors.WARNING}⚠️  Command finished with exit code {exit_status}{Colors.ENDC}")
                return False, err_output
        else:
            out_str = stdout.read().decode('utf-8')
            err_str = stderr.read().decode('utf-8')
            exit_status = stdout.channel.recv_exit_status()
            return exit_status == 0, out_str if exit_status == 0 else err_str
            
    except Exception as e:
        print(f"{Colors.FAIL}❌ Failed to execute command: {e}{Colors.ENDC}")
        return False, str(e)

def fix_env_and_rebuild(client):
    """Creates/Fixes the .env file on the VPS and rebuilds the containers."""
    print_header("Fix ERR_CONNECTION_REFUSED")
    
    print(f"\n{Colors.BOLD}🔍 Exposing the problem:{Colors.ENDC}")
    print("The frontend has been built with default API endpoints referencing 'localhost:18088'.")
    print("When clients load the website, their browsers attempt to fetch resources from their local machine")
    print("instead of your remote VPS, leading to 'net::ERR_CONNECTION_REFUSED' in their browser console.")
    
    print(f"\n{Colors.BOLD}🛠️  The Solution:{Colors.ENDC}")
    print(f"We will generate a `.env` file directly on the VPS at `{REMOTE_DIR}/.env` with:")
    print(f"  {Colors.GREEN}NEXT_PUBLIC_API_URL=http://{VPS_IP}:18088{Colors.ENDC}")
    print(f"  {Colors.GREEN}NEXT_PUBLIC_WS_URL=ws://{VPS_IP}:18088/ws{Colors.ENDC}")
    print("Then we will trigger a clean rebuild of the Next.js client container to bake in these variables.")
    
    confirm = input(f"\n❓ Do you want to apply this fix now? (y/n): ").strip().lower()
    if confirm != 'y':
        print(f"❌ Cancelled.")
        return

    # Create the remote env file contents
    env_content = f"""# ==============================================================================
# MMORPG VPS Production Environment Configurations
# Generated automatically by vps_manager.py
# ==============================================================================
NEXT_PUBLIC_API_URL=http://{VPS_IP}:18088
NEXT_PUBLIC_WS_URL=ws://{VPS_IP}:18088/ws
"""

    print(f"\n📝 Writing '.env' on VPS at {REMOTE_DIR}/.env...")
    sftp = client.open_sftp()
    try:
        # Check if remote directory exists
        try:
            sftp.stat(REMOTE_DIR)
        except FileNotFoundError:
            print(f"📁 Creating remote directory {REMOTE_DIR}...")
            # We'll create it recursively by calling a bash command
            client.exec_command(f"mkdir -p {REMOTE_DIR}")
            time.sleep(1)
            
        remote_env_path = f"{REMOTE_DIR}/.env"
        with sftp.file(remote_env_path, 'w') as f:
            f.write(env_content)
        print(f"{Colors.GREEN}✅ Production '.env' written successfully!{Colors.ENDC}")
    except Exception as e:
        print(f"{Colors.FAIL}❌ Failed to write '.env' over SFTP: {e}{Colors.ENDC}")
        sftp.close()
        return
    finally:
        sftp.close()
        
    print(f"\n🏗️  Rebuilding and restarting docker containers with the new configurations...")
    # First, bring it down, then build and run detached
    success1, _ = run_remote_command(client, "docker compose down")
    if success1:
        # Rebuilding the frontend container specifically, and backend
        success2, _ = run_remote_command(client, "docker compose up -d --build")
        if success2:
            print(f"\n{Colors.GREEN}🎉 HURRAY! Your MMORPG is now fully accessible!{Colors.ENDC}")
            print(f"🌐 Game Client URL: {Colors.CYAN}{Colors.BOLD}http://{VPS_IP}:18033{Colors.ENDC}")
            print(f"🔌 API Endpoint:    {Colors.CYAN}{Colors.BOLD}http://{VPS_IP}:18088{Colors.ENDC}")
            print(f"🛰️  WebSockets URL:  {Colors.CYAN}{Colors.BOLD}ws://{VPS_IP}:18088/ws{Colors.ENDC}")
            print("\nPlease refresh your browser and try again. The connection refused errors should be completely gone!")
        else:
            print(f"{Colors.FAIL}❌ Rebuild failed. Please check the command logs above.{Colors.ENDC}")
    else:
        print(f"{Colors.FAIL}❌ Failed to shutdown previous container instances.{Colors.ENDC}")

def is_excluded(local_filepath):
    """Verify if a file path matches any exclusion pattern."""
    relative_path = os.path.relpath(local_filepath, LOCAL_DIR)
    for pattern in EXCLUDE_PATTERNS:
        # Match pattern directly
        if fnmatch.fnmatch(relative_path, pattern):
            return True
        # Match pattern prefix for directories
        parts = relative_path.split(os.sep)
        for i in range(len(parts)):
            subpath = os.sep.join(parts[:i+1])
            if fnmatch.fnmatch(subpath, pattern) or fnmatch.fnmatch(subpath + '/*', pattern):
                return True
    return False

def sync_files(client):
    """Synchronize local codebase with the VPS via SFTP."""
    print_header("Sync Local Files to VPS")
    print(f"📂 Local Directory:  {LOCAL_DIR}")
    print(f"📂 VPS Target Path:  {VPS_USER}@{VPS_IP}:{REMOTE_DIR}")
    print(f"🚫 Exclude patterns: {', '.join(p for p in EXCLUDE_PATTERNS if not p.endswith('/*'))}")
    
    confirm = input(f"\n❓ Do you want to sync local changes to VPS now? (y/n): ").strip().lower()
    if confirm != 'y':
        print("❌ Sync cancelled.")
        return

    print("\n🔍 Scanning files to upload...")
    files_to_upload = []
    for root, dirs, files in os.walk(LOCAL_DIR):
        # Filter directories to avoid scanning excluded ones
        dirs[:] = [d for d in dirs if not is_excluded(os.path.join(root, d))]
        
        for file in files:
            filepath = os.path.join(root, file)
            if not is_excluded(filepath):
                files_to_upload.append(filepath)

    total_files = len(files_to_upload)
    print(f"📦 Found {Colors.BOLD}{total_files}{Colors.ENDC} files to synchronize.")
    
    sftp = client.open_sftp()
    uploaded_count = 0
    start_time = time.time()
    
    try:
        # First ensure the base directory exists
        try:
            sftp.stat(REMOTE_DIR)
        except FileNotFoundError:
            client.exec_command(f"mkdir -p {REMOTE_DIR}")
            time.sleep(0.5)
            
        for i, filepath in enumerate(files_to_upload, 1):
            rel_path = os.path.relpath(filepath, LOCAL_DIR)
            remote_path = os.path.join(REMOTE_DIR, rel_path).replace('\\', '/')
            
            # Make sure parent directory exists on remote
            remote_parent = os.path.dirname(remote_path)
            # Recursively create remote parent directories if needed
            # A simple way is to use client exec
            try:
                sftp.stat(remote_parent)
            except FileNotFoundError:
                client.exec_command(f"mkdir -p {remote_parent}")
                time.sleep(0.05) # Allow filesystem a micro-moment to react
            
            percent = (i / total_files) * 100
            print(f"\r📤 Uploading [{i}/{total_files}] ({percent:.1f}%) -> {rel_path[:50]}...", end="", flush=True)
            
            try:
                sftp.put(filepath, remote_path)
                uploaded_count += 1
            except Exception as e:
                print(f"\n{Colors.FAIL}❌ Failed to upload {rel_path}: {e}{Colors.ENDC}")
                
        elapsed = time.time() - start_time
        print(f"\n\n{Colors.GREEN}✅ Sync completed!{Colors.ENDC}")
        print(f"📊 Summary: Successfully synced {uploaded_count}/{total_files} files in {elapsed:.2f} seconds.")
        
    except Exception as e:
        print(f"\n{Colors.FAIL}❌ SFTP Sync failed: {e}{Colors.ENDC}")
    finally:
        sftp.close()

def show_status(client):
    """Show the status of the docker containers on the VPS."""
    print_header("VPS Container Status")
    
    # 1. System stats
    print(f"{Colors.BOLD}💻 Remote Server Resources:{Colors.ENDC}")
    run_remote_command(client, "free -h && df -h /", show_output=True, directory="/")
    
    # 2. Container status
    print(f"\n{Colors.BOLD}🐳 Docker Container Status:{Colors.ENDC}")
    success, output = run_remote_command(client, "docker compose ps", show_output=False)
    if success:
        print(output)
    else:
        print(f"{Colors.FAIL}Failed to get docker container status. Is Docker installed/running on the VPS?{Colors.ENDC}")
        print(output)

def stream_logs(client):
    """View container logs from the VPS."""
    print_header("Container Logs")
    print("1. All Services")
    print("2. Backend (Go Server)")
    print("3. Frontend (Next.js Client)")
    print("4. Authoritative Database (Postgres)")
    print("5. State Cache (Redis)")
    
    choice = input("\nSelect service for logs (1-5): ").strip()
    
    service_map = {
        "1": "",
        "2": "backend",
        "3": "frontend",
        "4": "db",
        "5": "redis"
    }
    
    service = service_map.get(choice, "")
    log_cmd = f"docker compose logs -f --tail=100 {service}"
    
    print(f"\n{Colors.WARNING}📢 Streaming logs (Press Ctrl+C to stop streaming logs from VPS)...{Colors.ENDC}\n")
    try:
        # For real-time interactive logs streaming, we use a interactive channel
        transport = client.get_transport()
        channel = transport.open_session()
        channel.get_pty()
        channel.exec_command(f"cd {REMOTE_DIR} && {log_cmd}")
        
        while True:
            if channel.recv_ready():
                data = channel.recv(1024).decode('utf-8', errors='ignore')
                print(data, end="", flush=True)
            if channel.recv_stderr_ready():
                err = channel.recv_stderr(1024).decode('utf-8', errors='ignore')
                print(f"{Colors.FAIL}{err}{Colors.ENDC}", end="", flush=True)
            if channel.exit_status_ready():
                break
            time.sleep(0.05)
            
    except KeyboardInterrupt:
        print(f"\n\n{Colors.BLUE}🛑 Stopped streaming logs.{Colors.ENDC}")
    except Exception as e:
        print(f"{Colors.FAIL}❌ Error viewing logs: {e}{Colors.ENDC}")

def custom_command(client):
    """Run any custom command on the VPS in the MMORPG folder."""
    print_header("Run Custom Shell Command")
    print(f"📂 Execution Context: `{REMOTE_DIR}` on {VPS_IP}")
    
    while True:
        cmd = input(f"\n{Colors.BOLD}remote-ssh $ {Colors.ENDC}").strip()
        if not cmd:
            continue
        if cmd.lower() in ['exit', 'quit', 'back']:
            break
            
        run_remote_command(client, cmd, show_output=True)

def interactive_menu():
    """Main dashboard execution loop."""
    client = get_ssh_client()
    if not client:
        input("\nPress Enter to exit...")
        return
        
    try:
        while True:
            print_header("Main Control Panel")
            print(f"🟢 VPS Status: {Colors.GREEN}{Colors.BOLD}CONNECTED{Colors.ENDC}")
            print(f"🌐 Host: {Colors.CYAN}{VPS_USER}@{VPS_IP}{Colors.ENDC} | Target Directory: {Colors.CYAN}{REMOTE_DIR}{Colors.ENDC}")
            print("-" * 65)
            print(f"⚡ {Colors.BOLD}QUICK FIXES & SETUP:{Colors.ENDC}")
            print(f"  {Colors.GREEN}{Colors.BOLD}[1]{Colors.ENDC} 🛠️  Fix 'Connection Refused' (Generate VPS .env & Rebuild Frontend)")
            print(f"  {Colors.GREEN}{Colors.BOLD}[2]{Colors.ENDC} 📤  Synchronize Local MMORPG Codebase to VPS")
            print(f"  {Colors.GREEN}{Colors.BOLD}[3]{Colors.ENDC} 🐳  Rebuild & Restart All Docker Containers on VPS")
            
            print(f"\n🔍 {Colors.BOLD}MONITORING & LOGS:{Colors.ENDC}")
            print(f"  {Colors.CYAN}{Colors.BOLD}[4]{Colors.ENDC} 📊  View System & Docker Containers Status")
            print(f"  {Colors.CYAN}{Colors.BOLD}[5]{Colors.ENDC} 📋  Stream Real-time Docker Container Logs")
            
            print(f"\n🛠️  {Colors.BOLD}MAINTENANCE:{Colors.ENDC}")
            print(f"  {Colors.BLUE}{Colors.BOLD}[6]{Colors.ENDC} 🐚  Execute Custom Shell Command in /var/www/mmorpg")
            print(f"  {Colors.BLUE}{Colors.BOLD}[7]{Colors.ENDC} 🧹  Wipe & Re-Seed Enemies/Monsters Database on VPS")
            
            print(f"\n🔴 {Colors.BOLD}EXIT:{Colors.ENDC}")
            print(f"  {Colors.FAIL}{Colors.BOLD}[0]{Colors.ENDC} 🔌  Close SSH Connection & Exit")
            print("-" * 65)
            
            choice = input(f"{Colors.BOLD}Select an option (0-7): {Colors.ENDC}").strip()
            
            if choice == "1":
                fix_env_and_rebuild(client)
            elif choice == "2":
                sync_files(client)
            elif choice == "3":
                print_header("Hard Rebuild Container Suite")
                confirm = input("❓ Are you sure you want to rebuild all containers from scratch? (y/n): ").strip().lower()
                if confirm == 'y':
                    run_remote_command(client, "docker compose down && docker compose up -d --build")
            elif choice == "4":
                show_status(client)
            elif choice == "5":
                stream_logs(client)
            elif choice == "6":
                custom_command(client)
            elif choice == "7":
                print_header("Re-Seeding Monsters Database")
                print("Running the backend seeder command inside the docker backend container...")
                # Run compiled seeder binary inside the go backend container
                run_remote_command(client, "docker compose exec -T backend ./seeder")
            elif choice == "0":
                print(f"\n🔌 Disconnecting from VPS...")
                client.close()
                print(f"{Colors.GREEN}👋 Goodbye!{Colors.ENDC}")
                break
            else:
                print(f"{Colors.FAIL}❌ Invalid choice. Please select between 0 and 7.{Colors.ENDC}")
            
            input(f"\n{Colors.WARNING}Press Enter to return to the menu...{Colors.ENDC}")
            
    except Exception as e:
        print(f"\n{Colors.FAIL}💥 An unexpected error occurred: {e}{Colors.ENDC}")
        if client:
            client.close()
    finally:
        print(f"\n🔌 Connection closed.")

if __name__ == "__main__":
    try:
        interactive_menu()
    except KeyboardInterrupt:
        print(f"\n\n{Colors.WARNING}🛑 Script interrupted by user. Exiting.{Colors.ENDC}")
        sys.exit(0)
