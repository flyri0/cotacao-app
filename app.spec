# -*- mode: python ; coding: utf-8 -*-
import os
import sys

block_cipher = None

# Diretório base
project_root = os.path.abspath(os.getcwd())
frontend_dist = os.path.join(project_root, 'frontend', 'dist')

# Inclusão dos arquivos estáticos de produção do frontend (HTML, CSS, JS) e ícone
datas = [
    (frontend_dist, os.path.join('frontend', 'dist')),
    (os.path.join(project_root, 'favicon.ico'), '.'),
]

# Módulos adicionais para garantir que pywebview e pythonnet carreguem corretamente no Windows
hidden_imports = [
    'webview',
    'clr_loader',
    'pythonnet',
    'sqlite3',
    'base64',
    'json',
    'typing_extensions',
    'openpyxl',
    'openpyxl.styles',
    'openpyxl.utils',
    'et_xmlfile',
    'backend',
    'backend.api',
    'backend.server',
    'backend.core',
    'backend.domain',
    'backend.services',
    'backend.services.excel_service',
]

a = Analysis(
    ['app.py'],
    pathex=[project_root],
    binaries=[],
    datas=datas,
    hiddenimports=hidden_imports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

# 1. Executável Standalone (Arquivo único auto-contido)
exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='MapaCotacoes',
    icon=os.path.join(project_root, 'favicon.ico'),
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

# 2. Executável Não-Standalone (Diretório / onedir descompactado para rede e inicialização rápida)
exe_onedir = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='MapaCotacoes',
    icon=os.path.join(project_root, 'favicon.ico'),
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe_onedir,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='MapaCotacoes-Folder',
)
