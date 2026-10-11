# 网站、Android 与 iPhone

本轮确认的优先级：**先做 Android，当前没有部署网址**。因此默认交付离线演示前端和 Android 工程；iOS 工程仅保留后续扩展基础，暂不进入发布验收。

一套学习界面和本地数据逻辑，两个构建目标：

- 网站：正常的 Next.js 服务，包含 `/api/*` 后端；可添加到主屏幕。
- 原生 App：Capacitor 的 `android/` 和 `ios/` 工程，前端静态文件随安装包分发；AI 请求发往部署后的 HTTPS 网站。没有使用只供开发热更新的 `server.url` 来加载整个远端网站。

## 现在可以做什么

浏览器运行 `npm run dev`。在“偏好与安装”调整字号或查看安装方法。生产环境会注册离线页：断网后可以查看本机文章正文与中文大意。网页离线页不支持生成、云端语音和更新学习统计；普通客户端导航失败时，可点击离线提示中的“查看本机文章”。

App 离线时可使用随包分发的页面、体验故事和已有本地学习记录。生成与云端朗读需要联网；设备朗读取决于系统语音。Android 返回键与原生备份分享已接入；iOS 文件访问声明随工程提交。

## 预览与正式构建

```sh
npm ci
npm run mobile:preview
npm run mobile:sync
```

这是没有线上地址时的**离线演示前端**。AI 功能会明确提示服务未连接。

正式联网版本在 PowerShell 中：

```powershell
$env:NEXT_PUBLIC_API_BASE_URL = "https://你的实际域名"
npm run mobile:build
npm run mobile:sync
```

地址必须是无路径、无账号密码的 HTTPS origin。它不是密钥，会写进前端包；DeepSeek/DashScope 密钥只配置在后端环境中。构建脚本只复制前端到 `.mobile-build/`，排除 API 路由、后端 proxy 与 `.env.local`，不会把服务端密钥复制进 App。后端 CORS 已允许默认原生 origin：`capacitor://localhost`、`https://localhost`、`http://localhost`。

构建脚本校验 `.mobile-build/` 位于项目根目录内后，才清理其生成的源码副本。不会改动正在开发的网站源码。`npm run mobile:sync` 会刷新原生工程中的生成资源。

### Android

安装与当前 Capacitor 8 工程匹配的 Android Studio/JDK/SDK，再运行：

```sh
npm run mobile:android
```

在 Android Studio 中等待 Gradle 同步，选择模拟器或真机运行。生成签名安装包时在 IDE 中配置你自己的 keystore；不要提交签名文件或密码。

### iPhone

将项目放到 macOS，安装 Xcode，然后：

```sh
npm ci
npm run mobile:preview
npm run mobile:sync
npm run mobile:ios
```

在 Xcode 里选择开发团队并配置签名；正式联网前使用实际后端地址重新 `mobile:build`。当前 Windows 环境只能生成 iOS 工程和前端资源，不能构建或签名 IPA。

## 发布前

当前工程标识为 `com.lexistory.app`，是开发默认值。首次公开发布前确认自己的应用标识、开发者名称、版本号、隐私说明、图标及启动画面。工程标识发布后影响应用身份和本机数据，请提前确定。

当前没有登录或自动云同步；浏览器/PWA/App 之间不保证共享本地存储。使用学习统计中的导出/导入备份转移数据。原生导出会打开系统分享/保存面板，用户需要选定保存位置。

尚未在本机完成原生二进制编译和真机测试。本机未检测到 Java/Android SDK；iOS 还需要 macOS/Xcode。重点回归：首次打开、深层路由、断网启动、前后台切换暂停、语音恢复、系统返回键、中文键盘遮挡、字号放大、备份保存与导入。

运行检查：`npm run lint`、`npm test`、`npm run build`、`npm run mobile:preview`。参考：[Capacitor 开发流程](https://capacitorjs.com/docs/basics/workflow)、[原生工程配置](https://capacitorjs.com/docs/config)。
