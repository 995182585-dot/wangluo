@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
echo ============================================
echo   网络互联技术基础 - 一键发布到 GitHub Pages
echo ============================================
echo.

if "%~1"=="" (
  echo 用法: deploy.bat https://github.com/你的用户名/仓库名.git
  echo.
  set /p REPO=请输入你的 GitHub 仓库地址: 
) else (
  set REPO=%~1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy.ps1" -Repo "%REPO%"
pause