
# PDF 工具箱

免费在线 PDF 处理工具，所有操作在浏览器本地完成，文件不上传。

## 功能

| 工具 | 说明 |
|------|------|
| 合并 PDF | 多个 PDF 按顺序合并为一个文件 |
| 分割 PDF | 按页提取或按范围分割 |
| 压缩 PDF | 减小 PDF 文件体积 |
| 图片转 PDF | 多张图片合成 PDF |
| PDF 转图片 | 每页转换为 PNG 图片 |

## 技术栈

- PDF.js - PDF 渲染
- pdf-lib - PDF 生成与编辑
- 纯前端，零后端依赖

## 部署

### 方式一：Vercel（推荐，免费）
1. Fork 或上传本项目到 GitHub
2. 访问 [vercel.com](https://vercel.com)，用 GitHub 登录
3. 点击 New Project → 导入仓库 → 直接 Deploy

### 方式二：GitHub Pages（免费）
1. 上传到 GitHub 仓库
2. Settings → Pages → Source 选 main 分支 → Save
3. 访问 `https://你的用户名.github.io/仓库名`

### 方式三：任意静态服务器
直接把 index.html 和 src/ 放到 Nginx / Apache / OSS 即可。
