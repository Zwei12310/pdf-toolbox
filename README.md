# PDF 工具箱

免费在线 PDF 处理工具，所有操作在浏览器本地完成，文件不上传。13个实用工具，支持合并、分割、压缩、转换、OCR识别、添加页码等。

## 功能

| 工具 | 说明 | 类型 |
|------|------|------|
| 合并 PDF | 多个 PDF 按顺序合并为一个文件 | 基础 |
| 分割 PDF | 按页提取或按范围分割 | 基础 |
| 压缩 PDF | 减小 PDF 文件体积 | 基础 |
| 图片转 PDF | 多张图片合成 PDF | 基础 |
| PDF 转图片 | 每页转换为 PNG 图片 | 基础 |
| 页面旋转 | 旋转 PDF 中的指定页面 | 基础 |
| 添加水印 | 文字或图片水印 | 基础 |
| 页面排序 | 拖拽调整页面顺序 | 基础 |
| PDF 加密 | 设置打开密码保护 | 基础 |
| 添加页码 | 为 PDF 每页添加页码 | 基础 |
| 删除页面 | 移除 PDF 中的指定页面 | 基础 |
| PDF 转 Word | 将 PDF 转换为可编辑的 Word 文档 | 高级 |
| 图片 OCR 识别 | 上传图片，提取其中的文字 | 高级 |

## 技术栈

- PDF.js - PDF 渲染
- pdf-lib - PDF 生成与编辑
- Tesseract.js - OCR 文字识别
- 纯前端，零后端依赖，文件不上传

## 部署

### 方式一：GitHub Pages（免费）
1. Fork 或上传本项目到 GitHub
2. Settings → Pages → Source 选 main 分支 → Save
3. 访问 `https://你的用户名.github.io/pdf-toolbox/`

### 方式二：Vercel（推荐，免费）
1. Fork 或上传本项目到 GitHub
2. 访问 [vercel.com](https://vercel.com)，用 GitHub 登录
3. 点击 New Project → 导入仓库 → 直接 Deploy

### 方式三：任意静态服务器
直接把 index.html 和 src/ 放到 Nginx / Apache / OSS 即可。

## 在线体验

访问 [https://zwei12310.github.io/pdf-toolbox](https://zwei12310.github.io/pdf-toolbox)

## 服务定价

如需代处理服务，可在闲鱼搜索"PDF处理"找到我们，或访问网站查看定价表。首单仅需 ¥1 体验价。
