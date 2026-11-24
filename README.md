# 网络互联技术基础 · 刷题助手

基于《2026-2027-1《网络互联技术基础题库》》制作的在线刷题程序。**纯静态网页、零依赖、离线可用**，可直接部署到 GitHub Pages。

- 📚 **375 道题**：单选题 162 · 多选题 59 · 判断题 70 · 填空题 53 · 简答题 31
- 💡 **全解析**：选择题 / 多选题 / 判断题 / 填空题 100% 配有「考点 + 逐项辨析 + 记忆要点」三段式解析
- 🔍 **题目搜索**：按题干、选项、答案、解析、知识点关键词检索
- ❌ **错题本**：答错自动收录，重做答对自动移出，支持按题型筛选
- ⭐ **收藏夹**：标记重点题，集中突破
- 🎲 **随机练习**：自定义题型与题量（10/20/30/50/100）
- ⏱️ **模拟考试**：限时 60 分钟，交卷给出得分与逐题回顾
- 📊 **学习统计**：各题型完成度、各知识点正确率
- 🌓 深色/浅色主题、手机端适配、键盘快捷键

---

## 一、直接使用（无需部署）

双击打开 `www/index.html` 即可在浏览器中使用（数据保存在本机浏览器 localStorage）。

> 提示：部分浏览器对 `file://` 协议的限制较严，如出现异常，请用下方“本地预览”方式打开。

## 二、本地预览

```bash
# 方式 1：Node（推荐）
node tools/serve.mjs        # 然后打开 http://127.0.0.1:8080

# 方式 2：Python
python -m http.server 8080 --directory www
```

## 三、部署到 GitHub Pages

### 方式 A：一键脚本（推荐）

1. 在 GitHub 上新建一个**空仓库**（不要勾选 README）
2. 在本项目目录执行：

```powershell
# Windows PowerShell
.\deploy.ps1 -Repo "https://github.com/你的用户名/仓库名.git"

# 或者双击运行
deploy.bat https://github.com/你的用户名/仓库名.git
```

3. 打开仓库 **Settings → Pages → Build and deployment → Source**，选择 **GitHub Actions**
4. 等 Actions 跑完（约 1 分钟），访问 `https://你的用户名.github.io/仓库名/`

工作流文件：`.github/workflows/deploy.yml`，推送 `main` 分支即自动发布 `www/` 目录。

### 方式 B：手动命令

```bash
git init && git branch -M main
git remote add origin https://github.com/<用户名>/<仓库名>.git
git add -A && git commit -m "init"
git push -u origin main
```

然后在仓库 Settings → Pages 中选择 **GitHub Actions**。

---

## 四、项目结构

```
├─ www/                      # 部署目录（GitHub Pages 即发布此目录）
│  ├─ index.html             # 页面骨架
│  └─ assets/
│     ├─ questions.js        # 题库数据（由 tools/build.py 生成，含答案与解析）
│     ├─ tags.js             # 知识点标签
│     ├─ app.js              # 应用逻辑（路由、作答、判分、错题本、统计）
│     ├─ router.js           # hash 路由引导
│     ├─ style.css           # 样式（含深色主题与移动端适配）
│     └─ images/             # 题库中的拓扑图
├─ tools/
│  ├─ build.py               # 合成题库 -> www/assets/questions.js
│  ├─ c1_*.py                # 题目与答案（人工校对后的数据源）
│  ├─ c2_*.py                # 解析文本（考点 / 辨析 / 记忆要点）
│  ├─ smoke.mjs              # 无依赖自测脚本（node tools/smoke.mjs）
│  └─ serve.mjs              # 本地静态服务器
├─ .github/workflows/deploy.yml
├─ deploy.ps1 / deploy.bat   # 一键发布脚本
└─ README.md
```

## 五、维护与二次开发

### 修改题目或解析

1. 题目与答案在 `tools/c1_single.py`、`c1_multi.py`、`c1_judge.py`、`c1_blank.py`、`c1_short.py`
2. 解析在 `tools/c2_ex_single.py`、`c2_ex_multi.py`、`c2_ex_judge.py`、`c2_ex_blank.py`
3. 修改后重新生成题库：

```bash
python tools/build.py        # 重新生成 www/assets/questions.js
```

### 自测

```bash
node tools/smoke.mjs         # 覆盖路由、判分、解析、错题本、搜索、考试等 34 项检查
```

---

## 六、题库说明（重要）

原题库存在若干先天问题，本项目在**忠实保留原题**的前提下做了如下处理，请在复习时留意：

| 情况 | 处理方式 |
| --- | --- |
| 大量题（尤其多选题区中的单选题）**没有给出答案** | 依据教材知识点补全答案，并在解析中给出推导过程 |
| 极少数题**答案或解析有误**（例：第 132 题的直连路由干扰项、判断题“OSPF DR 作为生成树的根”、多选题“水平分割 + 毒性逆转可同时生效”） | 按标准网络知识给出答案，并在解析中说明理由与原题问题 |
| 题干/选项存在**文字错漏**（如 `A.0级和1级 B 0级、1级和2级` 被写在同一段、`198` 选项混入题目列表） | 已拆分为规范选项，个别选项补注说明 |
| 题目**重复**（如“以下哪些是网络通信的例子”“园区网络链路聚合/堆叠提高可靠性”） | 保留原题顺序（便于整卷复习），解析中标注“重复题” |
| 业务题（配置题，含 9 张拓扑图） | 暂未收录进刷题模式；拓扑图已放在 `www/assets/images/`，供后续扩展 |

> 判断题 70 题中大量答案为「正确」，建议结合解析理解概念，而非死记答案。

## 七、常见问题

**Q：换电脑/清理浏览器后数据会丢吗？**
A：所有进度存在浏览器 localStorage。请在「设置与数据」中导出 JSON 备份，换设备后导入即可。

**Q：手机上能用吗？**
A：可以，页面已做移动端适配；添加到主屏幕后可当 App 使用。

**Q：访问 `https://用户名.github.io/仓库名/` 出现 404？**
A：检查 Settings → Pages 的 Source 是否为 **GitHub Actions**，并确认 Actions 中的
「Deploy to GitHub Pages」工作流已成功运行（第一次需要 1~2 分钟）。

---

MIT License · 题库版权归原作者所有，本项目仅用于学习与复习。