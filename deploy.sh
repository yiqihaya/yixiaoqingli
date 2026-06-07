#!/bin/bash
# GitHub Pages 部署脚本

set -e

echo "🔨 构建项目..."
cd "$(dirname "$0")/mybag-app"
npx vite build --base=/xiaomeng-ai/
cd ..

echo "📁 清理旧的部署文件..."
rm -rf deploy
mkdir -p deploy

echo "📋 复制构建产物..."
cp -r mybag-app/dist/* deploy/
cp mybag-app/public/live2d-models deploy/ 2>/dev/null || true

echo "✅ 构建完成！"
echo ""
echo "下一步："
echo "  1. git add deploy/"
echo "  2. git commit -m 'Deploy'"
echo "  3. git push origin main"
echo "  4. 在 GitHub 仓库 Settings → Pages → Source 选择 'gh-pages / (root)'"
