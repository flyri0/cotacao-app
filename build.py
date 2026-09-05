#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Script de automação de Build do Mapa Comparativo de Cotações.
Executa o build de produção do frontend (Vite/React) e empacota o executável (.exe) standalone com PyInstaller.

Uso:
    python build.py
"""

import os
import shutil
import subprocess
import sys
import time


def print_step(message: str) -> None:
    print(f"\n{'=' * 60}\n  {message}\n{'=' * 60}")


def print_success(message: str) -> None:
    print(f"\n[OK] {message}")


def print_error(message: str) -> None:
    print(f"\n[ERRO] {message}", file=sys.stderr)


def main() -> int:
    start_time = time.time()
    project_root = os.path.dirname(os.path.abspath(__file__))
    frontend_dir = os.path.join(project_root, "frontend")
    dist_dir = os.path.join(project_root, "dist")
    exe_path = os.path.join(dist_dir, "MapaCotacoes.exe")
    folder_path = os.path.join(dist_dir, "MapaCotacoes-Folder")
    zip_path = os.path.join(dist_dir, "MapaCotacoes-Folder.zip")

    print_step("1. Verificando ambiente e ferramentas")

    # Localiza o executável do npm
    npm_cmd = "npm.cmd" if sys.platform == "win32" else "npm"
    if not shutil.which(npm_cmd) and not shutil.which("npm"):
        print_error("Node.js / npm não foi encontrado no PATH do sistema. Instale o Node.js 18+.")
        return 1

    # Localiza o PyInstaller no virtualenv ou no sistema
    venv_pyinstaller = os.path.join(project_root, ".venv", "Scripts", "pyinstaller.exe")
    if os.path.exists(venv_pyinstaller):
        pyinstaller_cmd = venv_pyinstaller
    elif shutil.which("pyinstaller"):
        pyinstaller_cmd = "pyinstaller"
    else:
        print_error(
            "PyInstaller não foi encontrado no virtualenv (.venv) nem no PATH.\nInstale via: pip install pyinstaller"
        )
        return 1

    print(f"Diretório do projeto : {project_root}")
    print(f"PyInstaller          : {pyinstaller_cmd}")
    print(f"npm                  : {npm_cmd}")

    # Passo 2: Build do Frontend
    print_step("2. Compilando o Frontend React (Vite / TypeScript)")
    try:
        subprocess.run(
            [npm_cmd, "run", "build"],
            cwd=frontend_dir,
            check=True,
            shell=sys.platform == "win32",
        )
    except subprocess.CalledProcessError as e:
        print_error(f"Falha ao compilar o frontend com npm run build (código {e.returncode}).")
        return e.returncode

    frontend_dist_index = os.path.join(frontend_dir, "dist", "index.html")
    if not os.path.exists(frontend_dist_index):
        print_error(f"Arquivo {frontend_dist_index} não foi gerado.")
        return 1

    print_success("Frontend compilado com sucesso na pasta frontend/dist/")

    # Passo 3: Empacotamento PyInstaller (Standalone e Pasta)
    print_step("3. Gerando executáveis com PyInstaller (Standalone e Pasta)")
    spec_file = os.path.join(project_root, "app.spec")
    if not os.path.exists(spec_file):
        print_error(f"Arquivo {spec_file} não encontrado.")
        return 1

    try:
        subprocess.run(
            [pyinstaller_cmd, "app.spec", "--noconfirm", "--clean"],
            cwd=project_root,
            check=True,
        )
    except subprocess.CalledProcessError as e:
        print_error(f"Falha ao gerar os executáveis com PyInstaller (código {e.returncode}).")
        return e.returncode

    if not os.path.exists(exe_path):
        print_error(f"O executável standalone esperado não foi encontrado em: {exe_path}")
        return 1

    if not os.path.exists(folder_path):
        print_error(f"A pasta do executável não-standalone não foi encontrada em: {folder_path}")
        return 1

    # Passo 4: Compactação da versão não-standalone em .zip
    print_step("4. Compactando versão não-standalone em arquivo .zip")
    try:
        if os.path.exists(zip_path):
            os.remove(zip_path)
        shutil.make_archive(
            base_name=os.path.join(dist_dir, "MapaCotacoes-Folder"),
            format="zip",
            root_dir=dist_dir,
            base_dir="MapaCotacoes-Folder",
        )
        print_success("Arquivo .zip gerado com sucesso!")
    except Exception as e:
        print_error(f"Falha ao compactar pasta em .zip: {e}")
        return 1

    tamanho_exe_mb = os.path.getsize(exe_path) / (1024 * 1024)
    tamanho_zip_mb = os.path.getsize(zip_path) / (1024 * 1024) if os.path.exists(zip_path) else 0.0
    elapsed = time.time() - start_time

    print_step("5. Build Concluído com Sucesso!")
    print_success("Todos os artefatos foram gerados na pasta dist/:")
    print(f"  • Standalone (.exe)          : {exe_path} ({tamanho_exe_mb:.2f} MB)")
    print(f"  • Não-standalone (Pasta)     : {folder_path}")
    print(f"  • Não-standalone (.zip)      : {zip_path} ({tamanho_zip_mb:.2f} MB)")
    print(f"  • Tempo total de build       : {elapsed:.1f} segundos")
    print("\nVocê já pode distribuir o executável standalone ou o arquivo .zip com a pasta pronta para uso em rede.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
