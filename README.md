# QA图片采集Chrome插件

这是一个Chrome浏览器插件，用于右键点击网页图片并自动下载上传到数据库。

## 功能特性

- **右键菜单上传**：在网页图片上右键点击，选择"下载并上传图片到数据库"
- **手动链接上传**：在插件面板中输入图片链接进行上传
- **图片格式转换**：自动将.jfif等特殊格式转换为标准JPEG格式
- **多重下载策略**：支持fetch请求、备用配置、页面注入等多种下载方法
- **自动处理流程**：自动下载图片、添加图片信息、上传到数据库
- **设置管理**：可配置API地址和访问Token
- **状态通知**：处理过程中显示桌面通知和页面提示
- **错误处理**：完善的错误提示和处理机制
- **数据持久化**：设置信息自动保存到浏览器存储

## 安装方法

1. 打开Chrome浏览器
2. 进入扩展程序管理页面 (`chrome://extensions/`)
3. 开启"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择本插件的文件夹

## 使用方法

### 1. 配置插件

1. 点击浏览器工具栏中的插件图标
2. 在弹出的设置页面中填写：
   - **API基础地址**: 你的API服务器地址（如：`https://api.example.com`）
   - **用户Token**: 用于API认证的Token
   - **分类**: 图片分类（如：数学）
   - **采集类型**: 采集方式（如：手动采集）
   - **题目方向**: 题目类型（如：计算题）
3. 点击"保存设置"

### 2. 采集图片

**方式一：右键菜单上传**
1. 浏览包含图片的网页
2. 右键点击要采集的图片
3. 选择"下载并上传图片到数据库"
4. 插件会自动：
   - 下载图片
   - 调用API添加图片信息
   - 上传图片文件
   - 显示处理结果通知
   - 标记已处理的图片（绿色边框）

**方式二：手动链接上传**
1. 点击插件图标打开设置面板
2. 在"手动上传图片"区域输入图片链接
3. 点击"上传图片"按钮
4. 系统会自动下载并上传图片，显示处理状态

## API接口说明

### 添加图片信息接口

- **URL**: `/api/image/`
- **方法**: POST
- **Headers**:
  - `Content-Type: application/json`
  - `Authorization: {your-token}`
- **Body**:
  ```json
  {
    "category": "数学",
    "collector_type": "手动采集",
    "question_direction": "计算题"
  }
  ```

### 上传图片接口

- **URL**: `/api/image/upload`
- **方法**: POST
- **Headers**:
  - `Authorization: {your-token}`
- **Body**: multipart/form-data
  - `file`: 图片文件
  - `image_id`: 图片ID（从添加图片信息接口返回）

## 文件结构

```
QA-Plug/
├── manifest.json          # 插件配置文件
├── popup.html             # 设置页面HTML
├── popup.js               # 设置页面脚本
├── background.js          # 后台脚本
├── content.js             # 内容脚本
├── icon16.png             # 16x16图标
├── icon48.png             # 48x48图标
├── icon128.png            # 128x128图标
└── README.md              # 说明文档
```

## 注意事项

1. 确保API服务器支持CORS跨域请求
2. Token格式通常为 `Bearer your-actual-token`
3. 插件需要网络权限来访问API
4. 图片下载可能受到网站的防盗链限制

## 故障排除

1. **无法保存设置**: 检查是否填写了所有必填字段
2. **上传失败**: 检查API地址和Token是否正确
3. **图片下载失败**: 可能是图片URL无效或有防盗链保护
4. **权限错误**: 确保API Token有效且有相应权限

## 开发说明

本插件使用Chrome Extension Manifest V3开发，主要技术栈：
- JavaScript ES6+
- Chrome Extensions API
- Fetch API
- FormData API
- Chrome Storage API