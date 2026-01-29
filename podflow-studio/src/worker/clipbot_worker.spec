# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec for SeeZee ClipBot Worker

Build command (Windows):
    pyinstaller clipbot_worker.spec

Output: dist/clipbot-worker/clipbot-worker.exe
"""

import os
import sys

block_cipher = None

# Get the worker directory
worker_dir = os.path.dirname(os.path.abspath(SPEC))

# Collect all Python files in the worker directory
def collect_data_files():
    """Collect all data files needed by the worker"""
    data_files = []
    
    # Include context packs
    context_packs = os.path.join(worker_dir, 'context_packs')
    if os.path.exists(context_packs):
        data_files.append((context_packs, 'context_packs'))
    
    # Include core module
    core_dir = os.path.join(worker_dir, 'core')
    if os.path.exists(core_dir):
        data_files.append((core_dir, 'core'))
    
    return data_files

# Hidden imports that PyInstaller might miss
hidden_imports = [
    'scipy',
    'scipy.ndimage',
    'numpy',
    'json',
    'hashlib',
    'subprocess',
    # AI providers (optional, include if used)
    'openai',
    'anthropic',
    # Core modules
    'narrative',
    'narrative.unit',
    'narrative.detector', 
    'narrative.gate',
    'pipeline',
    'pipeline.config',
]

a = Analysis(
    ['detector.py'],
    pathex=[worker_dir],
    binaries=[],
    datas=collect_data_files(),
    hiddenimports=hidden_imports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        # Exclude heavy unused packages to reduce size
        'matplotlib',
        'tkinter',
        'PIL',
        'cv2',
        'torch',  # Only exclude if not using local Whisper
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='clipbot-worker',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,  # Keep console for stdout communication
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,  # Add icon path here if desired
)
