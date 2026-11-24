#!/usr/bin/env pwsh
<#
  一键发布到 GitHub Pages
  ------------------------------------------------------------
  用法（在仓库根目录执行）：
    .\deploy.ps1 -Repo "https://github.com/<你的用户名>/netquiz.git"

  参数：
    -Repo     你的 GitHub 仓库地址（HTTPS 或 SSH）
    -Message  提交说明（可选）

  前提：
    1) 已安装 Git，且在 GitHub 上创建了同名空仓库
    2) 已配置好 GitHub 凭据（Personal Access Token 或 SSH Key）
    3) 推送后到仓库 Settings → Pages → Source 选择 "GitHub Actions"
#>
param(
  [Parameter(Mandatory = $true)][string]$Repo,
  [string]$Message = "更新题库与功能"
)

$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here

if (-not (Test-Path ".git")) {
  Write-Host "→ 初始化 git 仓库" -ForegroundColor Cyan
  git init | Out-Null
  git branch -M main
}

$name = git config user.name
if (-not $name) {
  Write-Host "! 未配置 git user.name / user.email，请先执行：" -ForegroundColor Yellow
  Write-Host '  git config --global user.name  "你的名字"' -ForegroundColor Yellow
  Write-Host '  git config --global user.email "你的邮箱"' -ForegroundColor Yellow
  exit 1
}

$remotes = git remote
if ($remotes -notcontains "origin") {
  Write-Host "→ 添加远程仓库 $Repo" -ForegroundColor Cyan
  git remote add origin $Repo
} else {
  Write-Host "→ 更新远程仓库地址为 $Repo" -ForegroundColor Cyan
  git remote set-url origin $Repo
}

Write-Host "→ 重新生成题库数据（可选，需 Python3）" -ForegroundColor Cyan
$py = (Get-Command python -ErrorAction SilentlyContinue)
if ($py) {
  try { & python tools/build.py } catch { Write-Host "! 生成失败，使用仓库内已有 questions.js" -ForegroundColor Yellow }
} else {
  Write-Host "! 未找到 python，跳过生成，使用已有 questions.js" -ForegroundColor Yellow
}

Write-Host "→ 提交并推送" -ForegroundColor Cyan
git add -A
git commit -m $Message 2>$null | Out-Null
git push -u origin main

Write-Host ""
Write-Host "✅ 推送完成！" -ForegroundColor Green
Write-Host "接下来请在 GitHub 仓库页面操作：" -ForegroundColor Green
Write-Host "  Settings → Pages → Build and deployment → Source 选择 'GitHub Actions'"
Write-Host "  几分钟后访问  https://<你的用户名>.github.io/<仓库名>/"
Write-Host ""
Write-Host "如果之前选的是 'Deploy from a branch'，请在 Settings → Pages 中把 Branch 设为 main / (root)，"
Write-Host "并在 Settings → Pages → Source 里选择 'GitHub Actions' 以启用自动部署工作流。"