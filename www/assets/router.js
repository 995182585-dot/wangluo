/* 路由引导：监听 hash 变化并驱动 app.js 渲染（独立文件，便于扩展与测试） */
(function () {
  'use strict';
  function boot() {
    if (!window.NetQuiz) return;               // app.js 未就绪
    window.addEventListener('hashchange', function () { window.NetQuiz.go(location.hash); });
    if (!location.hash) location.replace('#/home');
    else window.NetQuiz.go(location.hash);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();