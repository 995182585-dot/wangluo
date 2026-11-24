/* =========================================================
 * 网络互联技术基础 · 刷题助手
 * 纯前端、零依赖、离线可用；数据保存在 localStorage
 * ========================================================= */
(function () {
  'use strict';

  /* ---------------- 常量 ---------------- */
  const LETTERS = 'ABCDEFGH';
  const TYPES = {
    single: { name: '单选题', icon: '🔘', order: 1 },
    multi: { name: '多选题', icon: '☑️', order: 2 },
    judge: { name: '判断题', icon: '⚖️', order: 3 },
    blank: { name: '填空题', icon: '✏️', order: 4 },
    short: { name: '简答题', icon: '💬', order: 5 }
  };
  const TYPE_NAME = Object.fromEntries(Object.entries(TYPES).map(([k, v]) => [k, v.name]));
  const TAG = window.TAG_MAP || {};
  const ALL = window.QUESTION_BANK || [];
  const META = window.QUESTION_META || { total: ALL.length };
  const QMAP = new Map(ALL.map(q => [q.id, q]));

  /* ---------------- 存储 ---------------- */
  const KEY = 'netquiz.v1';
  const store = (function () {
    const def = {
      theme: null,
      stats: {},          // id -> {t: 作答次数, r: 答对次数, last}
      wrong: {},          // 错题本 id -> {t: 最近一次错误时间, c: 错误次数}
      fav: {},            // 收藏 id -> 时间
      answers: {},        // id -> 最近一次作答（预留）
      last: {},           // 各题型上次进度 { type: index }
      settings: {
        shuffle: false,       // 顺序练习是否打乱
        autoNext: true,       // 单选/判断答对后自动下一题
        instantExplain: true, // 单选/判断作答后立即显示解析
        showTag: true         // 显示知识点标签
      },
      exam: []
    };
    let data;
    try {
      data = Object.assign({}, def, JSON.parse(localStorage.getItem(KEY) || '{}'));
      data.settings = Object.assign({}, def.settings, data.settings || {});
    } catch (e) {
      data = JSON.parse(JSON.stringify(def));
    }
    let timer = null;
    function save() {
      clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          localStorage.setItem(KEY, JSON.stringify(data));
        } catch (e) {
          toast('保存失败：浏览器存储空间不足或被禁用');
        }
      }, 80);
    }
    return { data, save, def };
  })();
  const S = store.data;

  /* ---------------- 工具函数 ---------------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  function toast(msg, ms) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), ms || 1800);
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function byType(type) { return ALL.filter(q => q.type === type); }

  function countByType() {
    const c = { all: ALL.length };
    ALL.forEach(q => { c[q.type] = (c[q.type] || 0) + 1; });
    return c;
  }

  function tagName(id) { return TAG[id] || '综合'; }

  function say(v) { return Array.isArray(v) ? v.join('') : String(v == null ? '' : v); }

  function normText(s) { return String(s == null ? '' : s).trim().toLowerCase().replace(/\s+/g, ' '); }

  function answerText(q) {
    if (q.type === 'judge') return q.a[0] === 'T' ? '正确（√）' : '错误（×）';
    if (q.type === 'short') return q.a;
    if (q.type === 'blank') return q.a.join(' / ');
    return say(q.a);
  }

  function checkAnswer(q, resp) {
    if (q.type === 'single') return resp === q.a[0];
    if (q.type === 'multi') {
      const a = new Set(q.a), b = new Set(resp || []);
      return a.size === b.size && [...a].every(x => b.has(x));
    }
    if (q.type === 'judge') return resp === q.a[0];
    if (q.type === 'blank') {
      const inputs = (resp || []).map(normText).filter(Boolean);
      if (!inputs.length) return false;
      const pool = q.a.map(normText);
      const hit = inputs.filter(v => pool.some(p => p === v || p.includes(v) || v.includes(p)));
      return hit.length === inputs.length;
    }
    return true;
  }

  /* ---------------- 统计与错题 ---------------- */
  function record(qid, correct, prevCorrect) {
    const st = S.stats[qid] || { t: 0, r: 0, last: 0 };
    st.t += 1;
    if (correct) st.r += 1;
    st.last = Date.now();
    S.stats[qid] = st;

    if (!correct) {
      const w = S.wrong[qid] || { t: 0, c: 0 };
      w.t = Date.now();
      w.c = (w.c || 0) + 1;
      S.wrong[qid] = w;
    } else if (S.wrong[qid] && prevCorrect === false) {
      delete S.wrong[qid];   // 在错题本中重新答对 → 自动移出
    }
    store.save();
    refreshBadges();
  }

  function doneCount() { return Object.keys(S.stats).length; }

  function accuracy() {
    let t = 0, r = 0;
    Object.values(S.stats).forEach(s => { t += s.t; r += s.r; });
    return t ? Math.round((r / t) * 100) : 0;
  }

  function refreshBadges() {
    const wb = $('#wrongBadge'), fb = $('#favBadge');
    if (wb) {
      const w = Object.keys(S.wrong).filter(id => QMAP.has(id)).length;
      wb.textContent = w; wb.dataset.zero = w ? '0' : '1';
    }
    if (fb) {
      const f = Object.keys(S.fav).filter(id => QMAP.has(id)).length;
      fb.textContent = f; fb.dataset.zero = f ? '0' : '1';
    }
    const pp = $('#progressPill');
    if (pp) pp.textContent = `已做 ${doneCount()} / ${ALL.length} · 正确率 ${accuracy()}%`;
  }

  /* ---------------- 渲染片段 ---------------- */
  function typeTag(type) { return `<span class="tag">${TYPES[type].icon} ${TYPE_NAME[type]}</span>`; }

  function optionRows(q, resp, revealed) {
    return q.o.map(o => {
      let cls = 'opt';
      const selected = q.type === 'multi' ? (resp || []).includes(o.k) : resp === o.k;
      if (selected) cls += ' selected';
      if (revealed) {
        cls += ' locked';
        const isAns = q.a.includes(o.k);
        if (isAns) cls += ' correct';
        else if (selected) cls += ' wrong';
      }
      return `<button type="button" class="${cls}" data-key="${o.k}">
        <span class="key">${o.k}</span><span class="txt">${esc(o.t)}</span>
      </button>`;
    }).join('');
  }

  function stemHtml(q) {
    let html = esc(q.q);
    if (q.img) html += `<img class="q-img" src="assets/images/${esc(q.img)}" alt="拓扑图" loading="lazy" />`;
    return `<div class="q-stem">${html}</div>`;
  }

  function blankInputs(q, resp, revealed) {
    const n = Math.max(1, q.n || 1);
    const vals = resp || [];
    let html = '<div class="blank-inputs">';
    for (let i = 0; i < n; i++) {
      html += `<div><label>第 ${i + 1} 空</label>
        <input type="text" data-blank="${i}" value="${esc(vals[i] || '')}"
          placeholder="输入答案后按 Enter 提交" ${revealed ? 'disabled' : ''} /></div>`;
    }
    return html + '</div>';
  }

  function explainBlock(q, correct, resp) {
    const userTxt = q.type === 'short' ? ''
      : q.type === 'blank' ? (resp || []).join(' / ')
        : say(resp);
    const cls = correct ? 'ok' : 'bad';
    const icon = correct ? '✅ 回答正确' : '❌ 回答错误';
    let html = `<div class="result-line ${cls}">${icon}</div>`;
    html += `<div class="answer-box ${cls}">
      <div class="label">正确答案</div>
      <div><b>${esc(answerText(q))}</b></div>
      ${userTxt ? `<div class="label" style="margin-top:8px">你的作答</div><div>${esc(userTxt)}</div>` : ''}
    </div>`;
    if (q.e) html += `<div class="explain"><h4>💡 解析</h4>${esc(q.e)}</div>`;
    return html;
  }

  /* ---------------- 答题状态 ---------------- */
  const Quiz = {
    items: [], idx: 0, resp: {}, revealed: {}, result: {},
    mode: 'practice', type: 'single', title: '练习',
    examTimer: null, examLeft: 0, examStart: 0
  };

  function startQuiz(opts) {
    const { ids, mode, type, title } = opts;
    if (!ids.length) { toast('没有可练习的题目'); return; }
    Quiz.items = ids;
    Quiz.idx = 0;
    Quiz.resp = {};
    Quiz.revealed = {};
    Quiz.result = {};
    Quiz.mode = mode || 'practice';
    Quiz.type = type || (QMAP.get(ids[0]) || {}).type;
    Quiz.title = title || '练习';
    if (Quiz.mode === 'exam') {
      Quiz.examStart = Date.now();
      startExamTimer();
    } else {
      stopExamTimer();
    }
    go('#/quiz');
  }

  function stopExamTimer() {
    if (Quiz.examTimer) { clearInterval(Quiz.examTimer); Quiz.examTimer = null; }
  }

  function startExamTimer() {
    stopExamTimer();
    Quiz.examLeft = 60 * 60;
    Quiz.examTimer = setInterval(() => {
      Quiz.examLeft--;
      paintClock();
      if (Quiz.examLeft <= 0) {
        stopExamTimer();
        toast('考试时间到，已自动提交');
        finishExam();
      }
    }, 1000);
  }

  function paintClock() {
    const el = $('#examClock');
    if (!el) return;
    const m = String(Math.floor(Math.max(0, Quiz.examLeft) / 60)).padStart(2, '0');
    const s = String(Math.max(0, Quiz.examLeft) % 60).padStart(2, '0');
    el.textContent = `⏱️ ${m}:${s}`;
    el.classList.toggle('warn', Quiz.examLeft < 300);
  }

  function finishExam() {
    const total = Quiz.items.length;
    let right = 0, unanswered = 0;
    Quiz.items.forEach(id => {
      if (!(id in Quiz.resp)) { unanswered++; return; }
      if (Quiz.result[id]) right++;
    });
    const rec = {
      at: Date.now(), total, right, unanswered,
      used: Math.round((Date.now() - Quiz.examStart) / 1000),
      score: total ? Math.round((right / total) * 100) : 0,
      rightIds: Quiz.items.filter(id => Quiz.result[id]),
      wrongIds: Quiz.items.filter(id => id in Quiz.resp && !Quiz.result[id]),
      blankIds: Quiz.items.filter(id => !(id in Quiz.resp))
    };
    S.exam.unshift(rec);
    S.exam = S.exam.slice(0, 20);
    store.save();
    stopExamTimer();
    go('#/examresult');
  }

  /* ---------------- 路由 ---------------- */
  const ROUTES = {};
  let currentRoute = 'home';

  function go(hash) {
    if (!hash) return;
    if (location.hash === hash) return render();
    location.hash = hash;
    // 部分嵌入式浏览器/沙箱环境不会触发 hashchange，这里主动兜底渲染一次
    setTimeout(render, 0);
  }

  function parseHash() {
    const h = (location.hash || '#/home').replace(/^#\/?/, '');
    const [path, qs] = h.split('?');
    return { path: path || 'home', params: new URLSearchParams(qs || '') };
  }

  function setTitle(t) {
    const el = $('#topbarTitle');
    if (el) el.textContent = t;
    document.title = t + ' · 网络互联技术基础刷题';
  }

  function render() {
    const { path, params } = parseHash();
    currentRoute = path;
    const fn = ROUTES[path] || ROUTES.home;
    const view = $('#view');
    if (!view) return;
    if (path !== 'quiz') stopExamTimer();
    const html = fn(params) || '';
    view.innerHTML = html;
    bind(view, path, params);
    document.querySelectorAll('.nav a').forEach(a => {
      a.classList.toggle('active', a.getAttribute('data-route') === path);
    });
    const sb = $('#sidebar');
    if (sb) sb.classList.remove('open');
    window.scrollTo({ top: 0, behavior: 'auto' });
    refreshBadges();
    if (typeof fn.after === 'function') fn.after(params);
    if (path === 'quiz') { renderExplainZone(); }   // 回显已作答题目的解析
  }

  /* ---------------- 页面：首页 ---------------- */
  ROUTES.home = function () {
    setTitle('首页');
    const c = countByType();
    const st = S.stats;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let todayN = 0;
    Object.values(st).forEach(s => { if (s.last >= today.getTime()) todayN++; });
    const wrongN = Object.keys(S.wrong).filter(id => QMAP.has(id)).length;
    const favN = Object.keys(S.fav).filter(id => QMAP.has(id)).length;
    const pct = ALL.length ? Math.round((doneCount() / ALL.length) * 100) : 0;

    const catCards = Object.entries(TYPES).map(([k, v]) => {
      const total = c[k] || 0;
      const done = ALL.filter(q => q.type === k && st[q.id]).length;
      return `<div class="cat-card" data-start="${k}">
        <div class="ico">${v.icon}</div>
        <div><div class="name">${v.name}</div>
        <div class="meta">共 ${total} 题 · 已做 ${done}</div></div>
      </div>`;
    }).join('');

    return `
      <section class="hero">
        <h1>网络互联技术基础 · 刷题助手</h1>
        <p>题库来源：${esc(META.source || '')} · 共 ${ALL.length} 道题，全部含详细解析</p>
        <div class="row">
          <button class="btn" data-go="#/practice">📚 从头开始练习</button>
          <button class="btn" data-random="20">🎲 随机 20 题</button>
          <button class="btn" data-go="#/wrong">❌ 错题本（${wrongN}）</button>
          <button class="btn" data-go="#/exam">⏱️ 模拟考试</button>
        </div>
      </section>

      <div class="grid cols-4" style="margin-top:14px">
        <div class="stat"><div class="k">总题数</div><div class="v">${ALL.length}</div></div>
        <div class="stat"><div class="k">已练习</div><div class="v">${doneCount()} <small>/${ALL.length}</small></div></div>
        <div class="stat"><div class="k">正确率</div><div class="v">${accuracy()}<small>%</small></div></div>
        <div class="stat"><div class="k">今日新增</div><div class="v">${todayN}</div></div>
      </div>

      <div class="card" style="margin-top:14px">
        <div class="row" style="margin-bottom:8px">
          <h2 style="margin:0">总体进度</h2><div class="spacer"></div>
          <span class="muted tiny">${pct}%</span>
        </div>
        <div class="progress"><i style="width:${pct}%"></i></div>
      </div>

      <div class="card">
        <h3>按题型练习</h3>
        <p class="sub">点击卡片进入该题型的顺序练习；也可以到「随机练习」中自定义题量与题型</p>
        <div class="grid cols-3">${catCards}</div>
      </div>

      <div class="card">
        <h3>快捷入口</h3>
        <div class="row">
          <button class="btn small" data-go="#/search">🔍 题目搜索</button>
          <button class="btn small" data-go="#/fav">⭐ 收藏夹（${favN}）</button>
          <button class="btn small" data-go="#/stats">📊 学习统计</button>
          <button class="btn small" data-go="#/settings">⚙️ 设置与数据备份</button>
        </div>
      </div>`;
  };

  /* ---------------- 页面：顺序练习 ---------------- */
  ROUTES.practice = function (params) {
    const type = params.get('type') || 'single';
    setTitle('顺序练习 · ' + (TYPE_NAME[type] || ''));
    const c = countByType();
    const chips = Object.keys(TYPES).map(k =>
      `<button class="chip ${k === type ? 'active' : ''}" data-type="${k}">${TYPES[k].icon} ${TYPE_NAME[k]}<span class="n">${c[k] || 0}</span></button>`
    ).join('');

    let list = byType(type);
    if (S.settings.shuffle && type !== 'short') list = shuffle(list);
    const last = S.last[type] || 0;
    const st = S.stats;

    const rows = list.slice(0, 400).map((q, i) => {
      const s = st[q.id];
      const mark = s ? (s.r ? '<span class="tag ok">已掌握</span>' : '<span class="tag bad">有错</span>') : '<span class="tag gray">未做</span>';
      return `<div class="list-item">
        <div class="no">${i + 1}</div>
        <div class="body"><div class="q-text">${esc(q.q)}</div>
          <div class="row tight" style="margin-top:6px">${mark}<span class="tag gray">${esc(tagName(q.tag))}</span></div>
        </div>
        <div class="acts"><button class="btn small" data-jump="${i}">开始</button></div>
      </div>`;
    }).join('');

    ROUTES.practice._list = list;
    return `
      <div class="card">
        <h2>顺序练习</h2>
        <p class="sub">选择题型后从任意一题开始，答题记录与错题会自动保存</p>
        <div class="row" style="margin-bottom:12px">${chips}</div>
        <div class="row">
          <button class="btn primary" id="startFromLast">▶️ 继续练习（第 ${last + 1} 题起）</button>
          <button class="btn" id="startFromZero">↩️ 从第 1 题开始</button>
          <div class="spacer"></div>
          <label class="row tight muted tiny" style="gap:4px">
            <input type="checkbox" id="shuffleChk" ${S.settings.shuffle ? 'checked' : ''} style="width:auto" /> 打乱题目顺序
          </label>
        </div>
      </div>
      <div class="card">
        <h3>题目列表（${list.length} 题）</h3>
        <div class="list" style="margin-top:10px">${rows || '<div class="empty">暂无题目</div>'}</div>
      </div>`;
  };

  /* ---------------- 页面：随机练习 ---------------- */
  ROUTES.random = function () {
    setTitle('随机练习');
    const c = countByType();
    const typeOpts = ['all', 'single', 'multi', 'judge', 'blank'].map(k =>
      `<button class="chip ${k === 'all' ? 'active' : ''}" data-rtype="${k}">${k === 'all' ? '🟦 全部' : TYPES[k].icon + ' ' + TYPE_NAME[k]}<span class="n">${k === 'all' ? ALL.length : c[k] || 0}</span></button>`
    ).join('');
    return `
      <div class="card">
        <h2>🎲 随机练习</h2>
        <p class="sub">从题库中随机抽题，适合碎片时间刷题与考前突击</p>
        <div class="row" style="margin-bottom:14px">${typeOpts}</div>
        <div class="row" style="margin-bottom:14px">
          <span class="muted tiny">题量</span>
          ${[10, 20, 30, 50, 100].map(n => `<button class="chip ${n === 20 ? 'active' : ''}" data-rnum="${n}">${n} 题</button>`).join('')}
        </div>
        <div class="row">
          <button class="btn primary" id="randomStart">开始随机练习</button>
          <button class="btn" id="randomWrong">🎯 随机抽 20 道错题</button>
        </div>
      </div>
      <div class="card">
        <h3>说明</h3>
        <ul class="muted" style="margin:0; padding-left:20px">
          <li>随机练习的作答同样计入统计与错题本；</li>
          <li>简答题（问答卡）建议使用「顺序练习 → 简答题」逐题自测；</li>
          <li>也可以从首页「随机 20 题」一键开始。</li>
        </ul>
      </div>`;
  };

  /* ---------------- 页面：模拟考试 ---------------- */
  ROUTES.exam = function () {
    setTitle('模拟考试');
    const history = (S.exam || []).map((e, i) => `
      <div class="list-item">
        <div class="no">#${S.exam.length - i}</div>
        <div class="body">
          <div>${new Date(e.at).toLocaleString()} · 得分 <b>${e.score}</b> 分</div>
          <div class="muted tiny">共 ${e.total} 题，答对 ${e.right}，未答 ${e.unanswered}，用时 ${Math.floor(e.used / 60)} 分 ${e.used % 60} 秒</div>
        </div>
      </div>`).join('') || '<div class="empty"><div class="big">📝</div>还没有考试记录</div>';
    return `
      <div class="card">
        <h2>⏱️ 模拟考试</h2>
        <p class="sub">限时 60 分钟，随机抽取单选 20 + 多选 10 + 判断 20 共 50 道，交卷后给出得分与逐题解析</p>
        <div class="grid cols-3">
          <div class="stat"><div class="k">单选题</div><div class="v">20 <small>题</small></div></div>
          <div class="stat"><div class="k">多选题</div><div class="v">10 <small>题</small></div></div>
          <div class="stat"><div class="k">判断题</div><div class="v">20 <small>题</small></div></div>
        </div>
        <div class="row" style="margin-top:14px">
          <button class="btn primary" id="examStart">开始考试</button>
          <button class="btn" id="examQuick">快速测验（15 题）</button>
        </div>
      </div>
      <div class="card">
        <h3>考试记录</h3>
        <div class="list" style="margin-top:10px">${history}</div>
      </div>`;
  };

  ROUTES.examresult = function () {
    setTitle('考试结果');
    const e = (S.exam || [])[0];
    if (!e) return `<div class="empty">没有考试记录</div>`;
    Quiz.items = e.rightIds.concat(e.wrongIds, e.blankIds);
    Quiz.idx = 0;
    Quiz.resp = {};
    Quiz.revealed = {};
    Quiz.result = {};
    Quiz.mode = 'review';
    Quiz.title = '考试回顾';
    return `
      <div class="card">
        <h2>考试成绩：<span class="${e.score >= 60 ? 'tag ok' : 'tag bad'}" style="font-size:16px">${e.score} 分</span></h2>
        <div class="grid cols-4" style="margin-top:12px">
          <div class="stat"><div class="k">题目数</div><div class="v">${e.total}</div></div>
          <div class="stat"><div class="k">答对</div><div class="v" style="color:var(--ok)">${e.right}</div></div>
          <div class="stat"><div class="k">答错/未答</div><div class="v" style="color:var(--bad)">${e.wrongIds.length}/${e.unanswered}</div></div>
          <div class="stat"><div class="k">用时</div><div class="v">${Math.floor(e.used / 60)}<small>分${e.used % 60}秒</small></div></div>
        </div>
        <div class="row" style="margin-top:14px">
          <button class="btn primary" data-go="#/quiz">📖 逐题回顾（含解析）</button>
          <button class="btn" id="examWrongOnly">❌ 只看错题</button>
          <button class="btn" data-go="#/exam">↩️ 返回</button>
        </div>
      </div>`;
  };

  /* ---------------- 页面：错题本 ---------------- */
  ROUTES.wrong = function (params) {
    setTitle('错题本');
    const type = params.get('type') || 'all';
    let ids = Object.keys(S.wrong).filter(id => QMAP.has(id));
    ids.sort((a, b) => (S.wrong[b].t || 0) - (S.wrong[a].t || 0));
    if (type !== 'all') ids = ids.filter(id => QMAP.get(id).type === type);
    const chips = ['all', 'single', 'multi', 'judge', 'blank', 'short'].map(k => {
      const n = Object.keys(S.wrong).filter(id => QMAP.has(id) && (k === 'all' || QMAP.get(id).type === k)).length;
      return `<button class="chip ${k === type ? 'active' : ''}" data-wtype="${k}">${k === 'all' ? '全部' : TYPE_NAME[k]}<span class="n">${n}</span></button>`;
    }).join('');

    const rows = ids.map(id => {
      const q = QMAP.get(id), w = S.wrong[id];
      return `<div class="list-item">
        <div class="no">${q.id.toUpperCase()}</div>
        <div class="body">
          <div class="q-text">${esc(q.q)}</div>
          <div class="row tight" style="margin-top:6px">
            ${typeTag(q.type)}
            <span class="tag bad">错 ${w.c || 1} 次</span>
            <span class="muted tiny">${w.t ? new Date(w.t).toLocaleDateString() : ''}</span>
          </div>
        </div>
        <div class="acts">
          <button class="btn small" data-fav="${q.id}" title="收藏">${S.fav[q.id] ? '★' : '☆'}</button>
          <button class="btn small" data-remove-wrong="${q.id}" title="移出错题本">移除</button>
        </div>
      </div>`;
    }).join('') || `<div class="empty"><div class="big">🎉</div>错题本是空的，继续保持！</div>`;

    return `
      <div class="card">
        <h2>❌ 错题本</h2>
        <p class="sub">答错自动收录；在「错题重练」中重新答对后会自动移出（也可以手动移除）</p>
        <div class="row" style="margin-bottom:12px">${chips}</div>
        <div class="row">
          <button class="btn primary" id="wrongPractice">🔁 错题重练（${ids.length} 题）</button>
          <button class="btn" id="wrongRandom">🎲 随机抽 20 道</button>
          <div class="spacer"></div>
          <button class="btn danger small" id="wrongClear">清空错题本</button>
        </div>
      </div>
      <div class="card">
        <h3>错题列表</h3>
        <div class="list" style="margin-top:10px">${rows}</div>
      </div>`;
  };

  /* ---------------- 页面：收藏夹 ---------------- */
  ROUTES.fav = function () {
    setTitle('收藏夹');
    const ids = Object.keys(S.fav).filter(id => QMAP.has(id)).sort((a, b) => S.fav[b] - S.fav[a]);
    const rows = ids.map(id => {
      const q = QMAP.get(id);
      return `<div class="list-item">
        <div class="no">${q.id.toUpperCase()}</div>
        <div class="body">
          <div class="q-text">${esc(q.q)}</div>
          <div class="row tight" style="margin-top:6px">${typeTag(q.type)}<span class="tag gray">${esc(tagName(q.tag))}</span></div>
        </div>
        <div class="acts"><button class="btn small" data-fav="${q.id}">取消收藏</button></div>
      </div>`;
    }).join('') || `<div class="empty"><div class="big">⭐</div>还没有收藏题目，答题时点 ☆ 即可收藏</div>`;
    return `
      <div class="card">
        <h2>⭐ 收藏夹</h2>
        <p class="sub">把重点、易错、需要背下来的题目收藏起来集中突破</p>
        <div class="row"><button class="btn primary" id="favPractice">▶️ 练习收藏题（${ids.length} 题）</button></div>
      </div>
      <div class="card"><div class="list">${rows}</div></div>`;
  };

  /* ---------------- 页面：题目搜索 ---------------- */
  ROUTES.search = function (params) {
    setTitle('题目搜索');
    const kw = (params.get('q') || '').trim();
    const ftype = params.get('type') || 'all';
    const ftag = params.get('tag') || 'all';
    const k = kw.toLowerCase();
    const active = !!kw || ftype !== 'all' || ftag !== 'all';
    let res = [];
    if (active) {
      res = ALL.filter(q => {
        if (ftype !== 'all' && q.type !== ftype) return false;
        if (ftag !== 'all' && q.tag !== ftag) return false;
        if (!k) return true;
        const hay = [q.q, q.e, (q.o || []).map(o => o.t).join(' '), answerText(q), tagName(q.tag)].join(' ').toLowerCase();
        return hay.includes(k);
      });
    }
    const hl = s => {
      const t = esc(s);
      if (!kw) return t;
      try {
        return t.replace(new RegExp('(' + kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi'), '<mark>$1</mark>');
      } catch (e) { return t; }
    };
    const typeChips = ['all', 'single', 'multi', 'judge', 'blank', 'short'].map(x =>
      `<button class="chip ${x === ftype ? 'active' : ''}" data-stype="${x}">${x === 'all' ? '全部' : TYPE_NAME[x]}</button>`).join('');
    const tagOpts = Object.keys(TAG).map(x =>
      `<option value="${x}" ${x === ftag ? 'selected' : ''}>${esc(TAG[x])}</option>`).join('');

    const items = res.slice(0, 200).map(q => `
      <div class="list-item">
        <div class="no">${q.id.toUpperCase()}</div>
        <div class="body">
          <div class="q-text">${hl(q.q)}</div>
          ${q.o ? `<div class="muted tiny" style="margin-top:4px">${q.o.map(o => o.k + '. ' + hl(o.t)).join('　')}</div>` : ''}
          <div class="row tight" style="margin-top:6px">${typeTag(q.type)}<span class="tag ok">答案 ${esc(String(answerText(q)).slice(0, 40))}</span><span class="tag gray">${esc(tagName(q.tag))}</span></div>
          <details style="margin-top:8px"><summary class="muted tiny" style="cursor:pointer">查看解析</summary>
            <div class="explain">${esc(q.e || '—')}</div></details>
        </div>
        <div class="acts"><button class="btn small" data-fav="${q.id}" title="收藏">${S.fav[q.id] ? '★' : '☆'}</button></div>
      </div>`).join('');

    return `
      <div class="card">
        <h2>🔍 题目搜索</h2>
        <p class="sub">支持按题干、选项、答案、解析、知识点关键词检索（例如：ACL、OSPF DR、4094、PVID）</p>
        <form id="searchForm" class="row" style="margin-bottom:10px">
          <input type="search" id="searchInput" placeholder="输入关键词，例如：STP 根端口 / 4094 / 静态路由" value="${esc(kw)}" style="flex:1;min-width:200px" />
          <select id="searchTag" style="width:auto;min-width:140px"><option value="all">全部知识点</option>${tagOpts}</select>
          <button class="btn primary" type="submit">搜索</button>
        </form>
        <div class="row">${typeChips}</div>
        ${active ? `<div class="result-meta">共找到 <b>${res.length}</b> 道题${res.length > 200 ? '（仅显示前 200 条）' : ''}</div>`
        : `<div class="result-meta muted">输入关键词开始搜索，或直接选择题型 / 知识点浏览</div>`}
      </div>
      <div class="list">${items}</div>`;
  };

  /* ---------------- 页面：学习统计 ---------------- */
  ROUTES.stats = function () {
    setTitle('学习统计');
    const c = countByType();
    const st = S.stats;

    const typeRows = Object.keys(TYPES).map(k => {
      const total = c[k] || 0;
      const done = ALL.filter(q => q.type === k && st[q.id]).length;
      const pct = total ? Math.round((done / total) * 100) : 0;
      return `<div class="bar-row"><div class="lbl">${TYPES[k].icon} ${TYPE_NAME[k]}</div>
        <div class="bar"><i style="width:${pct}%"></i></div><div class="num">${done}/${total} (${pct}%)</div></div>`;
    }).join('');

    const tagCount = {};
    ALL.forEach(q => {
      const t = q.tag || '19';
      tagCount[t] = tagCount[t] || { total: 0, done: 0, right: 0, times: 0 };
      tagCount[t].total++;
      const s = st[q.id];
      if (s) { tagCount[t].done++; tagCount[t].right += s.r; tagCount[t].times += s.t; }
    });
    const tagRows = Object.keys(tagCount).sort((a, b) => Number(a) - Number(b)).map(t => {
      const v = tagCount[t];
      const acc = v.times ? Math.round((v.right / v.times) * 100) : 0;
      return `<div class="bar-row"><div class="lbl">${esc(tagName(t))}</div>
        <div class="bar"><i style="width:${acc}%"></i></div>
        <div class="num">${v.done}/${v.total} 题 · ${acc}%</div></div>`;
    }).join('');

    let t = 0, r = 0;
    Object.values(st).forEach(s => { t += s.t; r += s.r; });
    const wrongN = Object.keys(S.wrong).filter(id => QMAP.has(id)).length;
    const mastered = Object.values(st).filter(s => s.r > 0 && s.r === s.t).length;

    return `
      <div class="grid cols-4">
        <div class="stat"><div class="k">总作答次数</div><div class="v">${t}</div></div>
        <div class="stat"><div class="k">总体正确率</div><div class="v">${t ? Math.round(r / t * 100) : 0}<small>%</small></div></div>
        <div class="stat"><div class="k">一次做对的题</div><div class="v">${mastered}</div></div>
        <div class="stat"><div class="k">错题本</div><div class="v">${wrongN}</div></div>
      </div>
      <div class="card" style="margin-top:14px">
        <h3>各题型完成度</h3>${typeRows}
      </div>
      <div class="card">
        <h3>各知识点（进度条 = 该知识点的累计正确率）</h3>${tagRows}
      </div>`;
  };

  /* ---------------- 页面：设置 ---------------- */
  ROUTES.settings = function () {
    setTitle('设置与数据');
    const s = S.settings;
    const c = countByType();
    return `
      <div class="card">
        <h2>⚙️ 练习设置</h2>
        <div class="row" style="margin:10px 0"><label class="row tight" style="gap:8px;cursor:pointer">
          <input type="checkbox" id="setAutoNext" ${s.autoNext ? 'checked' : ''} style="width:auto" /> 单选 / 判断答对后自动跳到下一题</label></div>
        <div class="row" style="margin:10px 0"><label class="row tight" style="gap:8px;cursor:pointer">
          <input type="checkbox" id="setInstant" ${s.instantExplain ? 'checked' : ''} style="width:auto" /> 单选 / 判断选中后立即判定并显示解析</label></div>
        <div class="row" style="margin:10px 0"><label class="row tight" style="gap:8px;cursor:pointer">
          <input type="checkbox" id="setShuffle" ${s.shuffle ? 'checked' : ''} style="width:auto" /> 顺序练习打乱题目顺序（多轮练习更有效）</label></div>
        <div class="row" style="margin:10px 0"><label class="row tight" style="gap:8px;cursor:pointer">
          <input type="checkbox" id="setShowTag" ${s.showTag ? 'checked' : ''} style="width:auto" /> 答题时显示知识点标签</label></div>
      </div>

      <div class="card">
        <h2>💾 数据备份 / 恢复</h2>
        <p class="sub">所有数据仅保存在本机浏览器（localStorage）。换设备或清理浏览器前请先导出备份。</p>
        <div class="row">
          <button class="btn primary" id="exportBtn">📤 导出备份（JSON）</button>
          <button class="btn" id="importBtn">📥 导入备份</button>
          <input type="file" id="importFile" accept="application/json,.json" hidden />
          <button class="btn danger" id="resetBtn">🗑️ 清空所有数据</button>
        </div>
        <p class="muted tiny" style="margin-top:10px">已记录：${doneCount()} 道题的作答、${Object.keys(S.wrong).length} 道错题、${Object.keys(S.fav).length} 道收藏、${(S.exam || []).length} 次考试记录</p>
      </div>

      <div class="card">
        <h2>ℹ️ 关于</h2>
        <p class="muted" style="margin:0">
          题库：${esc(META.source || '')}<br />
          题量：${ALL.length} 题（单选 ${c.single || 0} · 多选 ${c.multi || 0} · 判断 ${c.judge || 0} · 填空 ${c.blank || 0} · 简答 ${c.short || 0}）<br />
          选择题、多选题、判断题、填空题均配有「考点 + 逐项辨析 + 记忆要点」三段式解析。<br />
          项目为纯静态网页，可部署在 GitHub Pages / 任意静态托管，浏览器本地运行，不收集任何个人数据。
        </p>
      </div>`;
  };

  /* ---------------- 页面：答题 ---------------- */
  function quizDoneHtml() {
    const total = Quiz.items.length;
    const answered = Quiz.items.filter(id => id in Quiz.resp).length;
    const right = Quiz.items.filter(id => Quiz.result[id] === true).length;
    const acc = answered ? Math.round((right / answered) * 100) : 0;
    return `
      <div class="card" style="text-align:center">
        <div style="font-size:44px">🎉</div>
        <h2>本组练习完成</h2>
        <p class="sub">${esc(Quiz.title)}</p>
        <div class="grid cols-3" style="margin:16px 0">
          <div class="stat"><div class="k">题目</div><div class="v">${total}</div></div>
          <div class="stat"><div class="k">答对</div><div class="v" style="color:var(--ok)">${right}</div></div>
          <div class="stat"><div class="k">正确率</div><div class="v">${acc}<small>%</small></div></div>
        </div>
        <div class="row" style="justify-content:center">
          <button class="btn primary" id="restartQuiz">🔁 再练一遍</button>
          <button class="btn" data-go="#/wrong">❌ 查看错题本</button>
          <button class="btn" data-go="#/home">🏠 返回首页</button>
        </div>
      </div>`;
  }

  ROUTES.quiz = function () {
    const total = Quiz.items.length;
    if (!total) return `<div class="empty"><div class="big">🤔</div>没有题目，请从首页开始练习</div>`;
    if (Quiz.idx >= total) return quizDoneHtml();
    const q = QMAP.get(Quiz.items[Quiz.idx]);
    if (!q) return `<div class="empty">题目不存在</div>`;

    setTitle(Quiz.mode === 'exam'
      ? `模拟考试 ${Quiz.idx + 1}/${total}`
      : `${Quiz.title} · 第 ${Quiz.idx + 1}/${total} 题`);

    const revealed = !!Quiz.revealed[q.id];
    const resp = Quiz.resp[q.id];
    const pct = Math.round((Quiz.idx / total) * 100);

    let bodyHtml = '';
    if (q.type === 'single' || q.type === 'multi') {
      bodyHtml = `<div class="opts">${optionRows(q, resp, revealed)}</div>`;
    } else if (q.type === 'judge') {
      bodyHtml = `<div class="opts">
        <button type="button" class="opt ${resp === 'T' ? 'selected' : ''} ${revealed && q.a[0] === 'T' ? 'correct' : ''} ${revealed && resp === 'F' ? 'wrong' : ''} ${revealed ? 'locked' : ''}" data-key="T">
          <span class="key">√</span><span class="txt">正确</span></button>
        <button type="button" class="opt ${resp === 'F' ? 'selected' : ''} ${revealed && q.a[0] === 'F' ? 'correct' : ''} ${revealed && resp === 'T' ? 'wrong' : ''} ${revealed ? 'locked' : ''}" data-key="F">
          <span class="key">×</span><span class="txt">错误</span></button>
      </div>`;
    } else if (q.type === 'blank') {
      bodyHtml = blankInputs(q, resp, revealed);
    } else if (q.type === 'short') {
      bodyHtml = `<div class="muted tiny" style="margin-bottom:8px">先在纸上 / 心里作答，再展开参考答案对比要点。</div>`;
    }

    const rightCount = Quiz.items.filter(id => Quiz.result[id] === true).length;
    let actionHtml;
    if (q.type === 'short') {
      actionHtml = `<button class="btn primary" id="showShort" ${revealed ? 'disabled' : ''}>${revealed ? '已展开参考答案' : '👀 展开参考答案'}</button>`;
    } else if (!revealed) {
      actionHtml = `<button class="btn primary" id="submitBtn">提交答案</button>`;
    } else {
      actionHtml = `<button class="btn primary" id="nextBtn">${Quiz.idx === total - 1 ? '完成练习' : '下一题 →'}</button>`;
    }

    return `
      <div class="quiz-progress">
        <span class="quiz-no">${Quiz.idx + 1}/${total}</span>
        <div class="progress"><i style="width:${pct}%"></i></div>
        ${Quiz.mode === 'exam' ? `<span class="tag" id="examClock">⏱️ 60:00</span>` : `<span class="tag ok">✔ ${rightCount}</span>`}
      </div>
      <div class="card">
        <div class="quiz-head">
          ${typeTag(q.type)}
          ${S.settings.showTag ? `<span class="tag gray">${esc(tagName(q.tag))}</span>` : ''}
          <span class="quiz-no">${q.id.toUpperCase()}</span>
          <div class="spacer"></div>
          <button class="btn ghost small" id="favBtn" title="收藏">${S.fav[q.id] ? '★ 已收藏' : '☆ 收藏'}</button>
        </div>
        ${stemHtml(q)}
        ${bodyHtml}
        <div id="judgeZone"></div>
        <div class="quiz-actions">
          ${actionHtml}
          <button class="btn ghost small" id="prevBtn" ${Quiz.idx === 0 ? 'disabled' : ''}>← 上一题</button>
          <div class="spacer"></div>
          <span class="kbd-hint">快捷键：<kbd>1-6</kbd> 选项 · <kbd>Enter</kbd> 提交 / 下一题 · <kbd>←</kbd><kbd>→</kbd> 切题</span>
        </div>
      </div>`;
  };

  ROUTES.quiz.after = function () { paintClock(); };

  function renderQuiz() {
    if (currentRoute !== 'quiz') return;
    const view = $('#view');
    if (!view) return;
    view.innerHTML = ROUTES.quiz();
    bind(view, 'quiz', null);
    refreshBadges();
    paintClock();
    renderExplainZone();
  }

  function renderExplainZone() {
    const zone = $('#judgeZone');
    const q = QMAP.get(Quiz.items[Quiz.idx]);
    if (!zone || !q) return;
    if (!Quiz.revealed[q.id]) { zone.innerHTML = ''; return; }
    zone.innerHTML = q.type === 'short'
      ? `<div class="answer-box ok"><div class="label">参考答案</div><div class="short-ans">${esc(q.a)}</div></div>`
      + `<div class="explain"><h4>💡 解析</h4>${esc(q.e || '')}</div>`
      : explainBlock(q, Quiz.result[q.id] === true, Quiz.resp[q.id]);
  }

  /* ---------------- 答题交互 ---------------- */
  function submitCurrent() {
    const q = QMAP.get(Quiz.items[Quiz.idx]);
    if (!q) return;
    const resp = Quiz.resp[q.id];
    if (q.type === 'single' || q.type === 'multi') {
      if (!resp || (Array.isArray(resp) && resp.length === 0)) { toast('请先选择答案'); return; }
    } else if (q.type === 'judge') {
      if (!resp) { toast('请先选择 正确 / 错误'); return; }
    } else if (q.type === 'blank') {
      if (!(resp || []).some(v => String(v || '').trim())) { toast('请先填写答案'); return; }
    }
    if (Quiz.revealed[q.id]) return;
    const prev = q.id in Quiz.result ? Quiz.result[q.id] : null;
    const ok = checkAnswer(q, resp);
    Quiz.result[q.id] = ok;
    Quiz.revealed[q.id] = true;
    record(q.id, ok, prev);
    renderQuiz();
    if (ok && S.settings.autoNext && (q.type === 'single' || q.type === 'judge') && Quiz.mode !== 'exam') {
      setTimeout(() => { if (currentRoute === 'quiz') nextQuestion(); }, 800);
    }
  }

  function nextQuestion() {
    if (Quiz.idx < Quiz.items.length - 1) {
      Quiz.idx++;
      const q = QMAP.get(Quiz.items[Quiz.idx]);
      if (Quiz.mode === 'practice' && q) { S.last[q.type] = Quiz.idx; store.save(); }
      renderQuiz();
    } else {
      Quiz.idx = Quiz.items.length;
      if (Quiz.mode === 'exam') {
        const answered = Quiz.items.filter(id => id in Quiz.resp).length;
        if (answered < Quiz.items.length && !window.confirm(`还有 ${Quiz.items.length - answered} 题未作答，确定交卷吗？`)) return;
        finishExam();
        return;
      }
      renderQuiz();
    }
  }

  function chooseOption(key) {
    const q = QMAP.get(Quiz.items[Quiz.idx]);
    if (!q || Quiz.revealed[q.id]) return;
    if (q.type === 'multi') {
      const cur = new Set(Quiz.resp[q.id] || []);
      cur.has(key) ? cur.delete(key) : cur.add(key);
      Quiz.resp[q.id] = [...cur].sort();
      renderQuiz();
      return;
    }
    Quiz.resp[q.id] = key;
    if (S.settings.instantExplain) { submitCurrent(); return; }
    // 不即时判定：仅记录选择，等待点击“提交答案”
    const view = $('#view');
    if (view) {
      view.querySelectorAll('.opt[data-key]').forEach(el => {
        el.classList.toggle('selected', el.getAttribute('data-key') === key);
      });
    }
  }

  /* ---------------- 事件绑定 ---------------- */
  function bind(view, path, params) {
    view.querySelectorAll('[data-go]').forEach(el => {
      el.addEventListener('click', () => go(el.getAttribute('data-go')));
    });

    view.querySelectorAll('[data-start]').forEach(el => {
      el.addEventListener('click', () => go('#/practice?type=' + el.getAttribute('data-start')));
    });
    view.querySelectorAll('[data-random]').forEach(el => {
      el.addEventListener('click', () => {
        const n = Number(el.getAttribute('data-random')) || 20;
        const pool = shuffle(ALL.filter(q => q.type !== 'short')).slice(0, n).map(q => q.id);
        startQuiz({ ids: pool, mode: 'random', title: `随机 ${n} 题` });
      });
    });

    if (path === 'practice') {
      view.querySelectorAll('[data-type]').forEach(el => {
        el.addEventListener('click', () => go('#/practice?type=' + el.getAttribute('data-type')));
      });
      const list = ROUTES.practice._list || [];
      const type = params.get('type') || 'single';
      const startAt = i => {
        S.last[type] = i;
        store.save();
        startQuiz({ ids: list.map(q => q.id), mode: 'practice', type, title: `顺序练习 · ${TYPE_NAME[type]}` });
      };
      view.querySelectorAll('[data-jump]').forEach(el => {
        el.addEventListener('click', () => startAt(Number(el.getAttribute('data-jump'))));
      });
      const sf = $('#startFromLast');
      if (sf) sf.addEventListener('click', () => startAt(Math.min(S.last[type] || 0, list.length - 1)));
      const sz = $('#startFromZero');
      if (sz) sz.addEventListener('click', () => startAt(0));
      const sc = $('#shuffleChk');
      if (sc) sc.addEventListener('change', () => {
        S.settings.shuffle = sc.checked; store.save();
        go('#/practice?type=' + type);
      });
    }

    if (path === 'random') {
      let rtype = 'all', rnum = 20;
      view.querySelectorAll('[data-rtype]').forEach(el => el.addEventListener('click', () => {
        rtype = el.getAttribute('data-rtype');
        view.querySelectorAll('[data-rtype]').forEach(x => x.classList.toggle('active', x === el));
      }));
      view.querySelectorAll('[data-rnum]').forEach(el => el.addEventListener('click', () => {
        rnum = Number(el.getAttribute('data-rnum'));
        view.querySelectorAll('[data-rnum]').forEach(x => x.classList.toggle('active', x === el));
      }));
      const rs = $('#randomStart');
      if (rs) rs.addEventListener('click', () => {
        const pool = ALL.filter(q => q.type !== 'short' && (rtype === 'all' || q.type === rtype));
        const ids = shuffle(pool).slice(0, Math.min(rnum, pool.length)).map(q => q.id);
        startQuiz({ ids, mode: 'random', title: `随机 ${ids.length} 题` });
      });
      const rw = $('#randomWrong');
      if (rw) rw.addEventListener('click', () => {
        const ids = shuffle(Object.keys(S.wrong).filter(id => QMAP.has(id))).slice(0, 20);
        if (!ids.length) { toast('错题本是空的'); return; }
        startQuiz({ ids, mode: 'random', title: '随机错题 20 道' });
      });
    }

    if (path === 'exam') {
      const pick = (t, n) => shuffle(byType(t)).slice(0, n).map(q => q.id);
      const a = $('#examStart');
      if (a) a.addEventListener('click', () => {
        const ids = shuffle(pick('single', 20).concat(pick('multi', 10), pick('judge', 20)));
        startQuiz({ ids, mode: 'exam', title: '模拟考试' });
      });
      const b = $('#examQuick');
      if (b) b.addEventListener('click', () => {
        const ids = shuffle(pick('single', 6).concat(pick('multi', 3), pick('judge', 6)));
        startQuiz({ ids, mode: 'exam', title: '快速测验' });
      });
    }

    if (path === 'examresult') {
      const w = $('#examWrongOnly');
      if (w) w.addEventListener('click', () => {
        const e = S.exam[0];
        if (!e) return;
        Quiz.items = e.wrongIds.length ? e.wrongIds : e.blankIds;
        Quiz.idx = 0; Quiz.resp = {}; Quiz.revealed = {}; Quiz.result = {};
        Quiz.mode = 'review'; Quiz.title = '考试错题回顾';
        go('#/quiz');
      });
    }

    if (path === 'wrong') {
      view.querySelectorAll('[data-wtype]').forEach(el => el.addEventListener('click', () =>
        go('#/wrong?type=' + el.getAttribute('data-wtype'))));
      view.querySelectorAll('[data-remove-wrong]').forEach(el => el.addEventListener('click', () => {
        delete S.wrong[el.getAttribute('data-remove-wrong')];
        store.save(); refreshBadges(); render();
      }));
      const wp = $('#wrongPractice');
      if (wp) wp.addEventListener('click', () => {
        const ids = Object.keys(S.wrong).filter(id => QMAP.has(id));
        startQuiz({ ids, mode: 'wrong', title: '错题重练' });
      });
      const wr = $('#wrongRandom');
      if (wr) wr.addEventListener('click', () => {
        const ids = shuffle(Object.keys(S.wrong).filter(id => QMAP.has(id))).slice(0, 20);
        startQuiz({ ids, mode: 'wrong', title: '随机错题 20 道' });
      });
      const wc = $('#wrongClear');
      if (wc) wc.addEventListener('click', () => askConfirm('清空错题本', '确定清空全部错题记录吗？此操作不可撤销。', () => {
        S.wrong = {}; store.save(); refreshBadges(); render();
      }));
    }

    if (path === 'fav') {
      const fp = $('#favPractice');
      if (fp) fp.addEventListener('click', () => {
        const ids = Object.keys(S.fav).filter(id => QMAP.has(id));
        startQuiz({ ids, mode: 'fav', title: '收藏题练习' });
      });
    }

    view.querySelectorAll('[data-fav]').forEach(el => el.addEventListener('click', () => {
      const id = el.getAttribute('data-fav');
      if (S.fav[id]) { delete S.fav[id]; toast('已取消收藏'); }
      else { S.fav[id] = Date.now(); toast('已加入收藏夹'); }
      store.save(); refreshBadges(); render();
    }));

    if (path === 'search') {
      const buildUrl = (q, tag, type) => {
        const sp = new URLSearchParams();
        if (q) sp.set('q', q);
        if (tag && tag !== 'all') sp.set('tag', tag);
        if (type && type !== 'all') sp.set('type', type);
        return '#/search' + (sp.toString() ? '?' + sp.toString() : '');
      };
      const form = $('#searchForm');
      if (form) form.addEventListener('submit', ev => {
        ev.preventDefault();
        go(buildUrl($('#searchInput').value.trim(), $('#searchTag').value, params.get('type') || 'all'));
      });
      view.querySelectorAll('[data-stype]').forEach(el => el.addEventListener('click', () => {
        go(buildUrl($('#searchInput').value.trim(), $('#searchTag').value, el.getAttribute('data-stype')));
      }));
    }

    if (path === 'settings') {
      [['#setAutoNext', 'autoNext'], ['#setInstant', 'instantExplain'], ['#setShuffle', 'shuffle'], ['#setShowTag', 'showTag']]
        .forEach(([sel, k]) => {
          const el = $(sel);
          if (el) el.addEventListener('change', () => { S.settings[k] = el.checked; store.save(); toast('设置已保存'); });
        });
      const ex = $('#exportBtn'); if (ex) ex.addEventListener('click', exportData);
      const im = $('#importBtn'); if (im) im.addEventListener('click', () => $('#importFile').click());
      const fi = $('#importFile'); if (fi) fi.addEventListener('change', importData);
      const rs = $('#resetBtn');
      if (rs) rs.addEventListener('click', () => askConfirm('清空所有数据', '将删除错题本、收藏、统计与考试记录，确定继续吗？', () => {
        localStorage.removeItem(KEY);
        location.reload();
      }));
    }

    if (path === 'quiz') bindQuiz(view);
  }

  function bindQuiz(view) {
    const q = QMAP.get(Quiz.items[Quiz.idx]);
    if (!q) {
      const r = $('#restartQuiz');
      if (r) r.addEventListener('click', () => {
        Quiz.idx = 0; Quiz.resp = {}; Quiz.revealed = {}; Quiz.result = {}; renderQuiz();
      });
      return;
    }
    view.querySelectorAll('.opt[data-key]').forEach(el => {
      el.addEventListener('click', () => chooseOption(el.getAttribute('data-key')));
    });
    view.querySelectorAll('input[data-blank]').forEach(el => {
      el.addEventListener('input', () => {
        const i = Number(el.getAttribute('data-blank'));
        const arr = Quiz.resp[q.id] || [];
        arr[i] = el.value;
        Quiz.resp[q.id] = arr;
      });
      el.addEventListener('keydown', ev => {
        if (ev.key === 'Enter') { ev.preventDefault(); submitCurrent(); }
      });
    });
    const sb = $('#submitBtn'); if (sb) sb.addEventListener('click', submitCurrent);
    const nb = $('#nextBtn'); if (nb) nb.addEventListener('click', nextQuestion);
    const pb = $('#prevBtn'); if (pb) pb.addEventListener('click', () => {
      if (Quiz.idx > 0) { Quiz.idx--; renderQuiz(); }
    });
    const fb = $('#favBtn'); if (fb) fb.addEventListener('click', () => {
      if (S.fav[q.id]) { delete S.fav[q.id]; toast('已取消收藏'); }
      else { S.fav[q.id] = Date.now(); toast('已加入收藏夹'); }
      store.save(); refreshBadges(); renderQuiz();
    });
    const ss = $('#showShort'); if (ss) ss.addEventListener('click', () => {
      if (Quiz.revealed[q.id]) return;
      Quiz.revealed[q.id] = true;
      Quiz.result[q.id] = true;
      record(q.id, true, null);
      renderQuiz();
    });
  }

  /* ---------------- 数据导入导出 ---------------- */
  function exportData() {
    const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    const d = new Date();
    const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    a.href = URL.createObjectURL(blob);
    a.download = `netquiz-backup-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    toast('已导出备份');
  }

  function importData(ev) {
    const file = ev.target.files && ev.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(reader.result);
        if (!obj || typeof obj !== 'object') throw new Error('格式错误');
        ['stats', 'wrong', 'fav'].forEach(k => { if (obj[k] && typeof obj[k] !== 'object') throw new Error('格式错误'); });
        localStorage.setItem(KEY, JSON.stringify(Object.assign({}, store.def, obj, {
          settings: Object.assign({}, store.def.settings, obj.settings || {})
        })));
        toast('导入成功，即将刷新');
        setTimeout(() => location.reload(), 700);
      } catch (e) {
        toast('导入失败：' + e.message);
      }
    };
    reader.readAsText(file);
  }

  function askConfirm(title, text, onYes) {
    const dlg = $('#confirmDlg');
    if (!dlg || !dlg.showModal) {
      if (window.confirm(title + '\n' + text)) onYes();
      return;
    }
    $('#cfmTitle').textContent = title;
    $('#cfmText').textContent = text;
    const handler = () => {
      dlg.removeEventListener('close', handler);
      if (dlg.returnValue === 'yes') onYes();
    };
    dlg.addEventListener('close', handler);
    dlg.showModal();
  }

  /* ---------------- 主题 ---------------- */
  function applyTheme() {
    const t = S.theme || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', t);
  }

  /* ---------------- 键盘快捷键 ---------------- */
  document.addEventListener('keydown', ev => {
    if (currentRoute !== 'quiz') return;
    const tag = (ev.target && ev.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') {
      if (ev.key === 'Enter' && tag === 'input') { ev.preventDefault(); submitCurrent(); }
      return;
    }
    const q = QMAP.get(Quiz.items[Quiz.idx]);
    if (!q) return;
    if (/^[1-8]$/.test(ev.key)) {
      if (q.type === 'judge') { chooseOption(ev.key === '1' ? 'T' : 'F'); return; }
      const k = LETTERS[Number(ev.key) - 1];
      if (q.o && q.o.some(o => o.k === k) && !Quiz.revealed[q.id]) chooseOption(k);
    } else if (ev.key === 'Enter') {
      ev.preventDefault();
      if (Quiz.revealed[q.id]) nextQuestion();
      else submitCurrent();
    } else if (ev.key === 'ArrowRight') {
      if (Quiz.revealed[q.id] || Quiz.mode === 'exam') nextQuestion();
    } else if (ev.key === 'ArrowLeft') {
      if (Quiz.idx > 0) { Quiz.idx--; renderQuiz(); }
    }
  });

  /* ---------------- 初始化 ---------------- */
  function init() {
    applyTheme();
    const bs = $('#bankSize');
    if (bs) bs.textContent = ALL.length;
    const menuBtn = $('#menuBtn');
    if (menuBtn) menuBtn.addEventListener('click', () => $('#sidebar').classList.toggle('open'));
    const themeBtn = $('#themeBtn');
    if (themeBtn) themeBtn.addEventListener('click', () => {
      const cur = document.documentElement.getAttribute('data-theme');
      S.theme = cur === 'dark' ? 'light' : 'dark';
      store.save();
      applyTheme();
    });
    window.NetQuiz = { go, startQuiz, Quiz };   // 便于控制台调试 / 自动化测试
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();