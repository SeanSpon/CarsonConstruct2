#!/usr/bin/env python3
"""
Build script for SeeZee ClipBot Worker executable

Usage:
    python build_worker.py

Requirements:
    pip install pyinstaller

Output:
    dist/clipbot-worker.exe (Windows)
    dist/clipbot-worker (Linux/Mac)
"""

import os
import sys
import subprocess
import shutil

def main():
    worker_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(worker_dir)
    
    print("=" * 50)
    print("Building SeeZee ClipBot Worker")
    print("=" * 50)
    
    # Check PyInstaller is installed
    try:
        import PyInstaller
        print(f"PyInstaller version: {PyInstaller.__version__}")
    except ImportError:
        print("ERROR: PyInstaller not installed")
        print("Run: pip install pyinstaller")
        sys.exit(1)
    
    # Clean previous builds
    for folder in ['build', 'dist']:
        if os.path.exists(folder):
            print(f"Cleaning {folder}/...")
            shutil.rmtree(folder)
    
    # Build using spec file
    spec_file = os.path.join(worker_dir, 'clipbot_worker.spec')
    
    if os.path.exists(spec_file):
        print(f"Building with spec file: {spec_file}")
        cmd = ['pyinstaller', '--clean', spec_file]
    else:
        # Fallback: build directly
        print("Building directly (no spec file)")
        cmd = [
            'pyinstaller',
            '--onefile',
            '--name', 'clipbot-worker',
            '--console',
            '--clean',
            'detector.py'
        ]
    
    print(f"Running: {' '.join(cmd)}")
    result = subprocess.run(cmd, cwd=worker_dir)
    
    if result.returncode != 0:
        print("ERROR: Build failed!")
        sys.exit(1)
    
    # Check output
    if sys.platform == 'win32':
        exe_path = os.path.join(worker_dir, 'dist', 'clipbot-worker.exe')
    else:
        exe_path = os.path.join(worker_dir, 'dist', 'clipbot-worker')
    
    if os.path.exists(exe_path):
        size_mb = os.path.getsize(exe_path) / (1024 * 1024)
        print("=" * 50)
        print(f"SUCCESS: Built {exe_path}")
        print(f"Size: {size_mb:.1f} MB")
        print("=" * 50)
        print()
        print("Next steps:")
        print("1. Copy dist/clipbot-worker[.exe] to podflow-studio/resources/worker/")
        print("2. Rebuild Electron app: npm run package")
        print("3. Test on a machine WITHOUT Python installed")
    else:
        print(f"ERROR: Expected output not found at {exe_path}")
        sys.exit(1)

if __name__ == '__main__':
    main()
