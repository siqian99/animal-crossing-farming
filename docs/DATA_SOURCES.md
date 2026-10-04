# 数据来源与核验

程序作者：[Vickie](https://github.com/VickieZhou)。数据整理日期：2026-10-04。反馈邮箱：[zhouyy0113@126.com](mailto:zhouyy0113@126.com)。

当前游戏版本：Ver. 3.0.3，核对于 2026-10-04，来源：[任天堂更新记录](https://support.nintendo.com/jp/switch/software_support/acbaa/index.html)。版本号与逐条价格核验状态分别记录。

## 参考来源

1. [ACNH 社区数据表及贡献者](https://nookipedia.com/wiki/Community:ACNH_Spreadsheet)：配方、产量、分类编号与翻译。
2. [Norviah/animal-crossing](https://github.com/Norviah/animal-crossing)：社区表的 JSON 镜像。原始文件来源、快照 SHA 和大小记录于 `data-provenance.json`，许可证于 `../licenses/animal-crossing-MIT.txt`。
3. [Nookipedia](https://nookipedia.com/)：部分料理出售价格的逐项核对，已核对项目在 `dist/data.js` 里记录 `priceSourceUrl`。
4. 小红书作者 **银蘖**：料理价格表。Vickie 已获得作者授权用于本程序；不附带原表或原截图。

`priceEvidence` 中旧的 `user screenshots` 指作者获得授权后提供的价格表截图作为核对证据，不是本程序用户自己编写的表。此字段保留原核对记录含义。

## 数据结构

`dist/data.js` 定义 `HARVEST_DATA`，主要字段：

| 字段 | 含义 |
| --- | --- |
| `recipes` | 141 个料理与加工配方 |
| `ingredients` | 食材中文名、基础出售价格、类别 |
| 配方 `id` / `name` / `zh` | 稳定编号、英文物品名、中文展示名 |
| `ingredients` | 每批配方消耗数量 |
| `outputQuantity` | 一批产出份数 |
| `sellPrice` | 每份产出的普通商店售价 |
| `serialId` / `gameIndex` | 社区分类编号及展示位置 |
| `priceEvidence` / `priceSourceUrl` | 价格证据与逐条核对链接 |

价格必须按「每份」记录，不能把 10 份砂糖的整批售价写成单份售价。只有作为输入的数量和价格口径一致，求解结果才可靠。

## 已知范围

部分价格尚待最新游戏版本逐项核验，当前数据不应被描述为已经全部实机验证。分类排序按社区 SerialID，不等同于名称排序或个人取得顺序。

源码包只附带整理后的应用数据，不包含整个镜像、游戏图片或小红书原表。外部资料保留自己的权利与条款，项目 MIT 许可不替资料作者重新授权原表。完整署名见 `../THIRD_PARTY_NOTICES.md`。
