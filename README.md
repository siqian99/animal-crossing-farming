# 无人岛料理收益管家

《集合啦！动物森友会》的非官方料理与种植收益工具，作者：[Vickie](https://github.com/VickieZhou)。反馈邮箱：[zhouyy0113@126.com](mailto:zhouyy0113@126.com)。

输入你已有的食材和已学 DIY，得到料理组合、加工顺序、可直接出售的余料，以及相比生卖多赚的铃钱。也可以输入一片农田的格数，计算每种作物该种多少株。

本项目为纯静态网页，计算在浏览器中完成。无需账号、数据库、付费 API 或构建工具；可以下载后在本机运行，也可以部署为大家能打开的网址。

## 可以做什么

| 功能 | 输入 | 得到的安排 |
| --- | --- | --- |
| 库存原料 | 六种作物、其他食材、加工原料的实际数量 | 做哪些料理、各做多少、按什么顺序做、余料卖多少 |
| 农田分配 | 土地格数、每株 1–3 个产量、可选的各作物最低株数 | 每种作物的株数、每轮收获后的料理方案 |
| 我的配方 | 勾选自己已学的 DIY | 只使用你会做的配方；可搜索与按分类序号浏览 |
| 制作进度 | 全部完成或部分完成的实际份数 | 自动保存勾选与半勾，卖完回来继续做 |
| 岛屿设置 | 今日双倍料理、出售渠道、特产水果等 | 按自己的出售条件计算 |

包含141个料理与加工配方。2026-10-04 查询的当前游戏版本为 Ver. 3.0.3；该版本号表示官方最新版本，不等同于每条价格都已完成实机核验。主界面采用不透明的深绿、金黄与奶油色，头像和作物插图为原创 SVG。

两种计算模式：

- **总收益最高**：最大化料理与剩余食材出售后的总收入。
- **省制作批次**：先保证至少获得最高收入的指定比例，再尽量减少制作批次（同一配方最多 10 次合为一批）。可选择 50%–100% 的多个档位；减少的是配方制作批次，不是对完整游戏操作耗时的测量。

## 第一次使用

1. 在「我的配方」勾选已学会的料理 DIY。
2. 在「岛屿设置」填写出售条件。
3. 在「库存原料」输入实际食材数量，或在「农田分配」输入土地和产量。
4. 选择计算模式并生成方案，按制作清单执行。
5. 完成一部分时输入已做份数，全部完成时打勾。「直接卖」包含无需再加工的剩余材料。

砂糖、面粉等一批会产出多份。清单按实际产出份数记录进度，并区分「后续料理用量」与「直接卖数量」。余料售价已计入总收入。勾选进度不会自动扣减手动输入的库存。

## 下载并在电脑运行

在 GitHub 仓库选择 **Code → Download ZIP**，解压后进入含 `package.json` 的目录。不要直接双击 `dist/index.html`；计算使用 Web Worker，需要通过 HTTP 打开。

安装 Node.js 20 或更新版本后，打开终端运行：

```sh
npm start
```

打开 <http://127.0.0.1:4173/>。本项目没有 npm 依赖，不需要 `npm install`。停止时在终端按 `Ctrl+C`；端口被占用时使用 `npm start -- --port 4174`。

也可以使用已有的 Python 3：

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory dist
```

## 用 Netlify 发布网页

Netlify Drop 方式：解压网页发布包，在 [Netlify Drop](https://app.netlify.com/drop) 上传整个 `acnh-cooking-profit-web` 文件夹。该文件夹打开后直接能看到 `index.html`；不要上传源码包最外层目录或仅上传 ZIP。使用自己的 Netlify 账户保存和管理项目，后续更新上传到同一个项目。

也可以先把源码上传 GitHub，再在 Netlify 选择从 Git 仓库部署。发布目录为 `dist`，不需要构建命令；仓库内 `netlify.toml` 已声明发布目录。连接后，推送到所选生产分支会自动更新网页。首次连接 GitHub 时由仓库拥有者完成授权。

网站部署成功后会得到 HTTPS 地址，可分享给别人，也可在 iPhone 添加到主屏幕。当前仓库附带的 GitHub Actions 只测试；实际发布由 Netlify 完成。详细步骤见 [docs/GITHUB_GUIDE.md](docs/GITHUB_GUIDE.md)。

## iPhone、网址分享与数据迁移

公开部署到 HTTPS 网站后，在 iPhone Safari 打开该网址，选择 **分享 → 添加到主屏幕 → 添加**；如果出现「作为网页 App 打开」开关，保持开启。参考 [Apple 官方步骤](https://support.apple.com/zh-cn/guide/iphone/iphea86e5236/ios)。

把公开网址发给别人，他们就能在自己的手机或电脑上打开。无需让对方下载源码。GitHub 仓库地址是给开发者看源码的入口；网站地址是直接使用程序的入口，两者不同。

本机 `127.0.0.1` 链接只在运行服务器的电脑上有效。临时手机预览可让手机与电脑连接同一 Wi-Fi，运行 `npm start -- --host 0.0.0.0 --port 4174`，然后用手机打开 `http://电脑的局域网IP:4174/`。该方式依赖电脑开机与网络，不是公开网址；普通局域网 HTTP 不支持完整的 PWA 离线安装。

库存、DIY、设置与制作进度使用本机 `localStorage`。不同设备、浏览器和网址分别存储，不会自动同步。从电脑迁移到手机，或从本机迁移到正式网址时，请先在「数据与使用说明」导出备份，再在目标设备／网址导入。

首次完整加载且缓存成功后，HTTPS／localhost 下可离线使用已缓存资源。浏览器清理或回收网站数据可能移除记录和缓存，请定期备份。

## 项目结构

```text
dist/                       可直接托管的网页，也是未压缩的前端源码
  index.html                页面入口、指引与说明
  app.js                    输入、配方选择、结果展示与本机保存
  data.js                   配方、食材、价格、排序与来源字段
  optimizer.js              整数规划、收入与物料复核
  worker.js                 后台计算入口
  progress.js               制作进度与备份校验
  style-v2.css              桌面与手机界面
  icon-heads.svg            双狸头像和作物料理装饰
  manifest.webmanifest      主屏幕应用设置
  sw.js                     离线缓存
  vendor/                   HiGHS JS/WASM 与许可证
scripts/                    本机预览、源码包生成
docs/                       算法、数据来源、GitHub 新手步骤
licenses/                   社区数据镜像许可证
test-optimizer.cjs          求解与物料计算验证
THIRD_PARTY_NOTICES.md       第三方资料署名与许可说明
LICENSE                     原创程序、文档和图标的 MIT 许可
```

无需编译。修改 `dist/` 后刷新本机预览即可。修改缓存资源时同步更新 `sw.js` 的缓存版本和文件清单，避免离线用户继续使用旧资源。

## 验证与参与开发

```sh
npm test
```

验证包含整数规划与穷举比较、库存与土地限制、双倍与出售渠道、加工余料、进度份数校验。GitHub Actions 只运行测试，不会自动部署网站。更多模型说明见 [docs/ALGORITHM.md](docs/ALGORITHM.md)。

欢迎通过 GitHub Issue 提交问题，或 Fork 仓库后发起 Pull Request。报告价格或配方问题时，请提供料理名、游戏版本、出售条件、实际数量与截图依据；请勿提交自己的备份文件或账号凭据。

制作干净源码包需 Python 3：

```sh
python3 scripts/package_release.py
```

ZIP 输出到 `release/`，只包含运行、开发和说明文件。第一次上传步骤见 [docs/GITHUB_GUIDE.md](docs/GITHUB_GUIDE.md)。

## 数据、鸣谢与许可

感谢小红书作者 **银蘖** 授权料理价格表用于本程序；发行包不附带原表或原表截图。配方及翻译参考 [ACNH 社区数据表](https://nookipedia.com/wiki/Community:ACNH_Spreadsheet)、[Norviah/animal-crossing](https://github.com/Norviah/animal-crossing) 与 [Nookipedia](https://nookipedia.com/)。计算使用 HiGHS。

本项目采用 MIT 开源许可，可在保留相关版权与许可声明的前提下使用、修改和开发。第三方资料保留各自条款，详见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) 与 [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md)。

部分价格尚待当前游戏版本逐项核验。收益以输入条件和内置数据为准；分类顺序使用社区 SerialID，不保证与所有游戏菜单排序方式一致。计算只覆盖料理，不含家具 DIY、酒店兑换等。农田按每轮稳定收获规划，不自动估算初次生长时间、浇水时间或种苗购买成本。

这是非官方爱好者工具，与任天堂无官方合作关系。项目未使用游戏原图、官方 Logo 或字体。
