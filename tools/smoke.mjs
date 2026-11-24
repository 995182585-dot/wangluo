/**
 * 开发自测脚本（无需 npm 依赖）：在 node:vm 中用极简 DOM 垫片运行 www 下的前端代码，
 * 覆盖路由、各题型作答判分、解析展示、错题本、搜索、考试等主要流程。
 *
 *   node tools/smoke.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([a-zA-Z]:)/, '$1'));
const www = path.join(here, '..', 'www');

/* ============== 极简 DOM ============== */
class ClassList {
  constructor() { this.set = new Set(); }
  add(...c) { c.forEach(x => x && this.set.add(x)); }
  remove(...c) { c.forEach(x => this.set.delete(x)); }
  contains(c) { return this.set.has(c); }
  toggle(c, force) {
    const on = force === undefined ? !this.set.has(c) : !!force;
    on ? this.set.add(c) : this.set.delete(c);
    return on;
  }
  get value() { return [...this.set].join(' '); }
}

const VOID_TAGS = ['input', 'br', 'img', 'hr', 'meta', 'link'];

class El {
  constructor(tag, attrs = {}) {
    this.tagName = (tag || 'div').toUpperCase();
    this.attrs = attrs;
    this.children = [];
    this.parent = null;
    this.listeners = {};
    this.classList = new ClassList();
    this.style = {};
    this.dataset = {};
    this._text = '';
    this._raw = undefined;
    this.value = attrs.value || '';
    this.checked = false;
    if (attrs.class) this.classList.set = new Set(attrs.class.split(/\s+/).filter(Boolean));
  }
  getAttribute(n) {
    if (n === 'class') return this.classList.value;
    if (n && n.startsWith('data-')) {
      const k = n.slice(5).replace(/-([a-z])/g, (_m, c) => c.toUpperCase());
      return this.dataset[k] !== undefined ? this.dataset[k] : (this.attrs[n] ?? null);
    }
    return this.attrs[n] !== undefined ? this.attrs[n] : null;
  }
  setAttribute(n, v) { this.attrs[n] = v; }
  addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); }
  removeEventListener(t, fn) { this.listeners[t] = (this.listeners[t] || []).filter(f => f !== fn); }
  dispatchEvent(ev) {
    ev.target = ev.target || this;
    (this.listeners[ev.type] || []).forEach(fn => fn.call(this, ev));
    return true;
  }
  click() {
    (this.listeners.click || []).forEach(fn => fn.call(this, { type: 'click', target: this, preventDefault() { } }));
  }
  focus() { }
  get textContent() { return (this._raw !== undefined ? this._raw.replace(/<[^>]*>/g, '') : '') + this._text + this.children.map(c => c ? c.textContent : '').join(''); }
  set textContent(v) { this._text = String(v); this.children = []; this._raw = String(v); }
  get innerHTML() { return this._raw !== undefined ? this._raw : this.children.map(c => c.outer).join(''); }
  set innerHTML(v) {
    this._raw = String(v);
    this._text = '';
    const pair = parse(this._raw);
    this.children = pair.list;
    this.children.forEach(c => (c.parent = this));
  }
  get className() { return this.classList.value; }
  set className(v) { this.classList.set = new Set(String(v).split(/\s+/).filter(Boolean)); }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  querySelectorAll(sel) {
    const out = [];
    const walk = el => (el.children || []).forEach(c => { if (matches(c, sel)) out.push(c); walk(c); });
    walk(this);
    return out;
  }
  get outer() {
    const tag = this.tagName.toLowerCase();
    const attrs = [this.attrs.id ? ` id="${this.attrs.id}"` : '', this.classList.value ? ` class="${this.classList.value}"` : '']
      .concat(Object.keys(this.dataset).map(k => ` data-${k}="${this.dataset[k]}"`)).join('');
    return `<${tag}${attrs}>${this._text}${this.children.map(c => c.outer).join('')}</${tag}>`;
  }
}

function matches(el, sel) {
  return String(sel).split(',').some(s => {
    s = s.trim();
    if (!s) return false;
    const m = s.match(/^([a-zA-Z0-9]*)((?:[.#][\w-]+|\[[^\]]+\])*)$/);
    if (!m) return false;
    const [, tag, rest] = m;
    if (tag && el.tagName !== tag.toUpperCase()) return false;
    for (const t of (rest.match(/[.#][\w-]+|\[[^\]]+\]/g) || [])) {
      if (t[0] === '.') { if (!el.classList.contains(t.slice(1))) return false; }
      else if (t[0] === '#') { if (el.getAttribute('id') !== t.slice(1)) return false; }
      else {
        const mm = t.slice(1, -1).match(/^([\w-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\]]*)))?$/);
        if (!mm) return false;
        const v = el.getAttribute(mm[1]);
        if (v === null) return false;
        const want = mm[2] ?? mm[3] ?? mm[4];
        if (want !== undefined && String(v) !== want) return false;
      }
    }
    return true;
  });
}

function parse(html) {
  const out = [];
  const stack = [];
  const re = /<(\/?)([a-zA-Z0-9]+)([^>]*?)(\/?)>/g;
  let m;
  while ((m = re.exec(html))) {
    if (m[1]) { stack.pop(); continue; }
    const attrs = {}, dataset = {};
    const ar = /([^\s=]+)(?:="([^"]*)"|='([^']*)'|([^\s>]+))?/g;
    let a;
    while ((a = ar.exec(m[3] || ''))) {
      const v = a[2] ?? a[3] ?? a[4] ?? '';
      attrs[a[1]] = v;
      if (a[1].startsWith('data-')) dataset[a[1].slice(5).replace(/-([a-z])/g, (_x, c) => c.toUpperCase())] = v;
    }
    const el = new El(m[2], attrs);
    el.dataset = dataset;
    const parent = stack[stack.length - 1];
    if (parent) { el.parent = parent; parent.children.push(el); } else out.push(el);
    if (!m[4] && !VOID_TAGS.includes(m[2].toLowerCase())) stack.push(el);
  }
  return { list: out, raw: html };
}

/* ============== 环境 ============== */
const els = {};
const documentEl = { attrs: {}, setAttribute(n, v) { this.attrs[n] = v; }, getAttribute(n) { return this.attrs[n] || null; } };
const document = {
  readyState: 'complete',
  documentElement: documentEl,
  title: '',
  addEventListener() { },
  createElement(tag) { return new El(tag); },
  get body() { return els.body; },
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; },
  querySelectorAll(sel) {
    const out = [];
    Object.values(els).forEach(el => {
      if (!el) return;
      if (matches(el, sel)) out.push(el);
      out.push(...el.querySelectorAll(sel));
    });
    return out;
  }
};
['view', 'topbarTitle', 'sidebar', 'wrongBadge', 'favBadge', 'progressPill', 'toast', 'bankSize', 'menuBtn', 'themeBtn', 'confirmDlg', 'cfmTitle', 'cfmText']
  .forEach(id => (els[id] = new El('div', { id })));
els.body = new El('body');
els.confirmDlg.showModal = function () { };
els.confirmDlg.close = function () { };

const localStorage = {
  _d: {},
  getItem(k) { return this._d[k] ?? null; },
  setItem(k, v) { this._d[k] = String(v); },
  removeItem(k) { delete this._d[k]; }
};
const location = { hash: '#/home', reload() { } };

const windowObj = {
  __listeners: {},
  document,
  localStorage,
  addEventListener(t, fn) { (this.__listeners[t] = this.__listeners[t] || []).push(fn); },
  matchMedia: () => ({ matches: false }),
  scrollTo() { },
  confirm: () => true,
  setTimeout, clearTimeout, setInterval, clearInterval,
  URL: { createObjectURL: () => 'blob:', revokeObjectURL() { } },
  Blob: class { },
  Event: class { constructor(type, o = {}) { Object.assign(this, { type, bubbles: !!(o && o.bubbles) }); } }
};
Object.defineProperty(windowObj, 'location', { get() { return location; }, enumerable: true });
windowObj.window = windowObj;

const sandbox = {
  window: windowObj,
  document,
  localStorage,
  console,
  setTimeout, clearTimeout, setInterval, clearInterval,
  confirm: () => true,
  alert() { },
  requestAnimationFrame: fn => setTimeout(fn, 0),
  URLSearchParams,
  URL: windowObj.URL,
  Blob: windowObj.Blob,
  Event: windowObj.Event,
  FileReader: class { readAsText() { } },
  matchMedia: windowObj.matchMedia,
  navigator: { userAgent: 'node' }
};
Object.defineProperty(sandbox, 'location', { get() { return location; }, enumerable: true });
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

for (const f of ['questions.js', 'tags.js', 'app.js', 'router.js']) {
  vm.runInContext(fs.readFileSync(path.join(www, 'assets', f), 'utf8'), sandbox, { filename: f });
}

/* ============== 测试工具 ============== */
const view = els.view;
const W = sandbox.window;
const wait = ms => new Promise(r => setTimeout(r, ms));
const go = async hash => { W.NetQuiz.go(hash); await wait(5); };
const click = el => { if (!el) throw new Error('click: element not found'); el.click(); };
const q1 = sel => { const el = view.querySelector(sel); if (!el) throw new Error('missing ' + sel); return el; };
const txt = sel => q1(sel).textContent;

const results = [];
function check(name, cond, extra = '') {
  results.push([name, !!cond]);
  console.log((cond ? '✅ ' : '❌ ') + name + (cond ? '' : '   [' + extra + ']'));
}

async function main() {
  await wait(30);

  /* ---------- 数据 ---------- */
  check('题库加载 375 题', W.QUESTION_BANK.length === 375, W.QUESTION_BANK.length);
  check('知识点标签 19 个', Object.keys(W.TAG_MAP).length === 19);

  /* ---------- 首页 ---------- */
  check('首页渲染', view.innerHTML.includes('刷题助手'));

  /* ---------- 顺序练习：单选 ---------- */
  await go('#/practice?type=single');
  check('单选题列表 162 题', view.querySelectorAll('[data-jump]').length === 162, view.querySelectorAll('[data-jump]').length);
  click(view.querySelectorAll('[data-jump]')[0]);
  await wait(10);
  check('进入答题页 4 选项', view.querySelectorAll('.opt[data-key]').length === 4);
  click(view.querySelectorAll('.opt[data-key]')[1]);   // 第 1 题正确答案为 A，故意答错
  await wait(10);
  check('答错显示解析', txt('#judgeZone').includes('解析'));
  check('答错显示正确答案', txt('#judgeZone').includes('正确答案'));
  check('答错显示“回答错误”', txt('#judgeZone').includes('回答错误'));
  click(q1('#nextBtn'));
  check('进入第 2 题', view.innerHTML.includes('2/162'));

  /* ---------- 错题本 ---------- */
  await go('#/wrong');
  check('错题本收录 1 题', view.querySelectorAll('[data-remove-wrong]').length === 1, view.querySelectorAll('[data-remove-wrong]').length);
  click(q1('[data-remove-wrong]'));
  await wait(10);
  check('移出错题本', view.querySelectorAll('[data-remove-wrong]').length === 0);

  /* ---------- 搜索 ---------- */
  await go('#/search?q=OSPF');
  check('搜索 OSPF 命中 > 5', view.querySelectorAll('.list-item').length > 5, view.querySelectorAll('.list-item').length);
  await go('#/search?q=4094');
  check('搜索选项文本 4094', view.querySelectorAll('.list-item').length >= 1);
  await go('#/search?tag=16&type=single');
  check('按知识点筛选 ACL', view.querySelectorAll('.list-item').length >= 1);

  /* ---------- 判断题 ---------- */
  await go('#/practice?type=judge');
  check('判断题列表 70 题', view.querySelectorAll('[data-jump]').length === 70, view.querySelectorAll('[data-jump]').length);
  click(view.querySelectorAll('[data-jump]')[0]);
  await wait(10);
  check('判断题 2 个选项', view.querySelectorAll('.opt[data-key]').length === 2);
  click(view.querySelectorAll('.opt[data-key]')[0]);
  await wait(10);
  check('判断题显示解析', txt('#judgeZone').includes('正确答案'));

  /* ---------- 填空题 ---------- */
  await go('#/practice?type=blank');
  check('填空题列表 53 题', view.querySelectorAll('[data-jump]').length === 53, view.querySelectorAll('[data-jump]').length);
  click(view.querySelectorAll('[data-jump]')[0]);
  await wait(10);
  const inp = view.querySelectorAll('input[data-blank]');
  check('填空题有输入框', inp.length >= 1, inp.length);
  inp[0].value = 'CAPWAP';
  (inp[0].listeners.input || []).forEach(fn => fn.call(inp[0], { type: 'input', target: inp[0] }));
  click(q1('#submitBtn'));
  await wait(10);
  check('填空题判对', txt('#judgeZone').includes('回答正确'));

  /* ---------- 简答题 ---------- */
  await go('#/practice?type=short');
  check('简答题列表 31 题', view.querySelectorAll('[data-jump]').length === 31, view.querySelectorAll('[data-jump]').length);
  click(view.querySelectorAll('[data-jump]')[0]);
  await wait(10);
  check('简答题有展开按钮', !!view.querySelector('#showShort'));
  click(q1('#showShort'));
  await wait(10);
  check('简答题展开参考答案', txt('#judgeZone').length > 50);

  /* ---------- 多选题 ---------- */
  await go('#/practice?type=multi');
  check('多选题列表 59 题', view.querySelectorAll('[data-jump]').length === 59, view.querySelectorAll('[data-jump]').length);
  click(view.querySelectorAll('[data-jump]')[0]);
  await wait(10);
  const mopts = view.querySelectorAll('.opt[data-key]');
  check('多选题选项 >= 4', mopts.length >= 4, mopts.length);
  click(mopts[0]);
  await wait(5);
  check('多选可选中', !!view.querySelector('.opt.selected'));
  click(q1('#submitBtn'));
  await wait(10);
  check('多选题判定出结果', txt('#judgeZone').includes('回答'));

  /* ---------- 收藏 ---------- */
  await go('#/practice?type=single');
  click(view.querySelectorAll('[data-jump]')[3]);
  await wait(10);
  click(q1('#favBtn'));
  await wait(10);
  check('收藏后会话保持', view.innerHTML.includes('★ 已收藏'), txt('#favBtn'));
  await go('#/fav');
  check('收藏夹有 1 题', view.querySelectorAll('[data-fav]').length === 1, view.querySelectorAll('[data-fav]').length);

  /* ---------- 模拟考试 ---------- */
  await go('#/exam');
  click(q1('#examQuick'));
  await wait(10);
  check('考试页显示倒计时', !!view.querySelector('#examClock'));

  /* ---------- 随机练习 ---------- */
  await go('#/random');
  click(q1('#randomStart'));
  await wait(10);
  check('随机练习进入答题页', view.innerHTML.includes('quiz-progress'));

  /* ---------- 统计 / 设置 / 首页 ---------- */
  await go('#/stats');
  check('统计页有条形图', view.querySelectorAll('.bar-row').length > 5);
  await go('#/settings');
  check('设置页有导出按钮', !!view.querySelector('#exportBtn'));
  await go('#/practice?type=single');
  await go('#/home');
  check('返回首页', view.innerHTML.includes('总题数'));

  const fails = results.filter(r => !r[1]);
  console.log(`\n总计 ${results.length} 项，失败 ${fails.length} 项`);
  if (fails.length) console.log(fails.map(f => ' - ' + f[0]).join('\n'));
  process.exit(fails.length ? 1 : 0);
}

main().catch(e => { console.error('SMOKE ERROR', e); process.exit(2); });
