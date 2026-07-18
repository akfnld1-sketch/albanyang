/**
 * sw.js — Service Worker (오프라인 지원)
 * 전략: Cache First (캐시 우선) — 오프라인에서도 앱 전체 동작
 * ★ v11 분리 구조 대응 — CSS/JS 파일 모두 캐시
 * ★ 통합본: cache-v8 기준, 캐시버스팅 쿼리 포함
 */

// ★ Fix #70: 근태관리 히어로카드에 생존관리로 이어지는 질문형 문구 추가
//   ("이 돈으로 다음 월급날까지 버틸 수 있을까요?") — 기능 변경 없음 (2026-06-22)
const CACHE_NAME = 'moneynyang-v1-cache-v236';

// ── 로컬 파일 (분리된 CSS/JS 전체) ──
// ★ index.html의 <script>/<link> 태그와 쿼리스트링이 항상 일치해야 함 (불일치 시 사전 캐시 무의미)
const LOCAL_RESOURCES = [
  './',
  './index.html',
  './manifest.json',
  './css/main.css?v=20260712a',
  './css/design-system.css?v=20260710f',
  './css/mobile.css?v=20260705a',
  './css/theme-pastel.css?v=20260718a',
  './css/theme-sky.css?v=20260718a',
  './css/theme-mint.css?v=20260718a',
  './css/theme-lavender.css?v=20260718a',
  './css/theme-peach.css?v=20260718a',
  './js/color-theme.js?v=20260718c',
  './js/sw-init.js',
  './js/storage.js?v=20260710c',
  './js/company-engine.js?v=20260710b',
  './js/leave.js?v=20260629g',
  './js/help.js?v=20260704c',
  './js/ui.js?v=20260704c',
  './js/salary.js?v=20260713b',
  './js/budget.js?v=20260717a',
  './js/attendance-v3.js?v=20260718c',
  './js/data-utils.js',
  './js/nyang-emoji.js',
  './js/assistant.js?v=20260717a',
  './js/mn-character.js?v=20260710c',
  './js/dev-mode.js?v=20260710b',
  './js/login.js?v=20260710h',
  './js/sao-memory.js?v=20260710d',
  './js/sao-router.js?v=20260710c',
  './js/sao-mod-weather.js?v=20260710a',
  './js/sao-mod-attendance.js?v=20260710b',
  './js/sao-mod-salary.js?v=20260710e',
  './js/sao-mod-budget.js?v=20260710a',
  './js/freelance.js?v=20260704c',
  './js/render-salary.js?v=20260718b',
  './js/income-wizard.js?v=20260717a',
  './js/jobtype.js?v=20260705a',
  './js/calendar-modes.js?v=20260704g',
  './js/notifications.js?v=20260628a',
  './js/init.js?v=20260710d',
  './js/inquiry.js?v=20260709e',
  './js/quotes-data.js?v=20260701l',
  './js/assets.js?v=20260718b',
  './js/weather.js?v=20260718c',
  './js/home-news.js?v=20260718a',
  './js/sao-engine.js?v=20260710a',
  './js/sao-initiative.js?v=20260710d',
  './js/tutorial.js?v=20260704c',
  './img/icons/app-icon-192.png',
  './img/icons/app-icon-512.png',
  './img/login-bg.jpg',
  './img/emoji/수입돈.png',
  './img/emoji/환영인사.png',
  './img/emoji/생각중.png',
  './img/emoji/걱정경고.png',
  './img/emoji/모를때.png',
  './img/emoji/울음오류.png',
  './img/emoji/칭찬축하.png',
];

// ── 외부 리소스 (폰트, Chart.js) ──
const EXTERNAL_RESOURCES = [
  'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700;900&family=JetBrains+Mono:wght@400;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js',
];

// ── 설치: 로컬 파일 + 외부 리소스 미리 캐시 ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      // 로컬 파일 캐시 (필수 — 실패 시 설치 실패)
      await cache.addAll(LOCAL_RESOURCES);

      // 외부 리소스 미리 캐시 (실패해도 설치는 계속)
      await Promise.allSettled(
        EXTERNAL_RESOURCES.map(url =>
          fetch(url, { mode: 'cors' })
            .then(res => { if(res.ok) cache.put(url, res); })
            .catch(() => {})
        )
      );
    })
  );
  self.skipWaiting();
});

// ── 활성화: 이전 캐시 삭제 ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── 네트워크 요청 처리 ──
self.addEventListener('fetch', event => {
  const reqUrl = new URL(event.request.url);
  const url = event.request.url;
  const sameOrigin = reqUrl.origin === self.location.origin;

  // HTML → Network First (최신 버전 우선, 오프라인이면 캐시)
  if (url.endsWith('.html') || url.endsWith('/') || event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // CSS / JS (같은 출처) → Cache First (캐시 우선, 없으면 네트워크 후 캐시 갱신)
  if (sameOrigin && (reqUrl.pathname.includes('/css/') || reqUrl.pathname.includes('/js/'))) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return res;
        });
      })
    );
    return;
  }

  // 외부 리소스 (폰트, Chart.js) → Cache First
  if (url.includes('fonts.googleapis.com') ||
      url.includes('fonts.gstatic.com') ||
      url.includes('cdnjs.cloudflare.com')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request, { mode: 'cors' })
          .then(res => {
            if (res.ok) {
              const clone = res.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
            }
            return res;
          })
          .catch(() => new Response('', { status: 503 }));
      })
    );
    return;
  }

  // 나머지 → 기본 네트워크 (오프라인이면 캐시 시도)
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
