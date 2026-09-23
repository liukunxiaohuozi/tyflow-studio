# 0.1.1 — 主窗口显示修复

用户症状：双击桌面快捷方式无反应，但后台存在 Tyflow Studio 进程。

复现：以 Windows Hidden 启动标记运行客户端。0.1.0 页面和 preload 均加载成功，窗口 visible=false；再次启动只调用 focus，无法显示隐藏窗口。相同程序正常启动后立即得到可见主窗口，排除了快捷方式路径与渲染加载失败。

修复：页面加载完成后明确 show；第二实例及 macOS activate 事件先恢复、show，再 focus。保留首次绘制 ready-to-show。隔离测试数据目录在申请单实例锁前设置，避免冒烟测试唤醒正常用户进程。

回归：scripts/smoke-windows.ps1 在相同 Hidden 启动条件下验证 ready、bootstrapServed、visible=true、minimized=false，并加入 Windows 打包 CI。旧版复现输出 visible=false；源码修复版输出 visible=true。类型检查、ESLint、生产构建通过。

旧证据：D:/UserData/tingyun/Temp/tyflow-window-before-55d3948f-f670-4c90-bba1-656e54e9af09/smoke.json
修复证据：D:/UserData/tingyun/Temp/tyflow-visible-smoke-44eae3d7-f9b9-4306-915c-2c32deb342ab/smoke.json

初版启动检查遗漏窗口可见性，不能据页面加载推断用户能看到客户端；新断言用于防止再次漏检。

打包客户端回归通过：release/0.1.1/win-unpacked/Tyflow Studio.exe 在 Hidden 启动下 visible=true，bootstrapServed=true。证据：D:/UserData/tingyun/Temp/tyflow-visible-smoke-25e6b9bf-9ba0-400f-93dd-fd5399067705/smoke.json。桌面快捷方式已指向此 0.1.1 客户端，窗口模式为正常。
