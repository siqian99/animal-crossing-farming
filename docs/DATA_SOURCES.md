# 数据来源与核验

程序作者：[Vickie](https://github.com/VickieZhou)。数据整理日期：2026-10-04。反馈邮箱：[zhouyy0113@126.com](mailto:zhouyy0113@126.com)。

当前游戏版本：Ver. 3.0.3，核对于 2026-10-04，来源：[任天堂更新记录](https://support.nintendo.com/jp/switch/software_support/acbaa/index.html)。版本号与逐条价格核验状态分别记录。

## 参考来源

1. [ACNH 社区数据表及贡献者](https://nookipedia.com/wiki/Community:ACNH_Spreadsheet)：配方、产量、分类编号与翻译。
2. [Norviah/animal-crossing](https://github.com/Norviah/animal-crossing)：社区表的 JSON 镜像。原始文件来源、快照 SHA 和大小记录于 `data-provenance.json`，许可证于 `../licenses/animal-crossing-MIT.txt`。
3. [Nookipedia](https://nookipedia.com/)：全部 141 个料理出售价格的逐条核对（2026-10-06），`dist/data.js` 里每个配方记录 `priceSourceUrl`。

`priceEvidence` 记录每条价格的核验方式，当前统一为 `live Nookipedia verification 2026-10-06`。

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

售价已全部逐条核验自 Nookipedia（2026-10-06），核验对象为 Nookipedia 页面数据，未做游戏实机验证。分类排序按社区 SerialID，不等同于名称排序或个人取得顺序。

源码包只附带整理后的应用数据，不包含整个镜像或游戏图片。外部资料保留自己的权利与条款，项目 MIT 许可不替资料作者重新授权原表。完整署名见 `../THIRD_PARTY_NOTICES.md`。
