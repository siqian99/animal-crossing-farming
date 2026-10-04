# 第一次把程序上传 GitHub

作者主页：<https://github.com/VickieZhou>。建议仓库名称：`acnh-cooking-profit`，名称可以另选。

## 上传源码

1. 解压提供的源码 ZIP，打开 `acnh-cooking-profit` 文件夹。
2. 登录 GitHub，右上角 `+` → `New repository`。
3. Owner 选自己的账号，Repository name 填名称，Description 填「无人岛料理收益管家：动森库存料理与农田种植收益规划」。
4. 希望别人下载和参与开发时选 `Public`。不要再自动生成 README、许可证或 `.gitignore`，源码包已有这些文件。
5. 点击 `Create repository`。仓库首页选 `uploading an existing file`，或 `Add file → Upload files`。
6. 将解压后文件夹**里面的文件和子文件夹**拖入上传区，使 README 与 `dist/` 位于仓库根目录。不要只上传 ZIP；否则别人无法直接浏览源码。
7. 检查上传列表，确保有 `dist/vendor/highs.wasm`、README、LICENSE、docs、scripts。文件选择器可能隐藏 `.github/`、`.gitignore` 或 `.nojekyll`；显示隐藏文件后一起上传，或之后补传。
8. Commit message 可填 `Initial open-source release`，点击 `Commit changes`。

现在别人能看 README、下载源码、Fork 和提交改进，但这一步不会自动生成可运行网站。

如果你希望改用 Git 命令行，首次提交前请确认整个干净源码包已解压在独立目录；不要上传本机预览所在目录的历史、临时文件或托管配置。

## 下载包

别人可以在仓库点击 `Code → Download ZIP`。也可以之后创建一个 GitHub Release，把源码 ZIP 放在下载附件中。Release 属于可选项，不影响开源或下载。

## 用与实习小金库相同的 Netlify Drop 发布

1. 解压 `acnh-cooking-profit-v0.2.1-web.zip`，得到 `acnh-cooking-profit-web` 文件夹；打开后直接能看到 `index.html`。
2. 登录自己的 Netlify 账户，打开 [Netlify Drop](https://app.netlify.com/drop)。
3. 上传整个 `acnh-cooking-profit-web` 文件夹，等待部署成功；该项目无需运行构建命令。
4. 使用返回的 HTTPS 网站地址在手机打开，也可以把该网址发给朋友。
5. 更新时，在同一 Netlify 项目的 Deploys 页面上传新版网页文件夹，保持原网址。

**GitHub 上传源码包；Netlify Drop 上传网页包。** 两个 ZIP 都要先解压，不能把整个源码包当网页上传。

## 可选：GitHub 更新后自动发布

在 Netlify 选择从 Git 仓库添加项目，连接自己的 `acnh-cooking-profit` 仓库，生产分支选择 `main`，发布目录为 `dist`，构建命令留空。仓库的 `netlify.toml` 已配置发布目录。连接 GitHub 的账户授权由本人完成，随后每次推送会自动触发发布。

## 把电脑的记录迁到手机

本机预览、公开网址和不同设备各自保存记录。在本机「数据与使用说明」导出备份，再在手机 Safari 的正式网站导入。然后用 Safari「分享 → 添加到主屏幕」。这不会自动同步电脑和手机。

参考官方说明：[创建仓库](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-new-repository)、[上传文件](https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository)、[Netlify 部署](https://docs.netlify.com/deploy/create-deploys/)。
