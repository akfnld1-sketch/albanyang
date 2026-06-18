/**
 * sw.js — Service Worker (오프라인 지원)
 * 전략: Cache First (캐시 우선) — 오프라인에서도 앱 전체 동작
 * ★ v11 분리 구조 대응 — CSS/JS 파일 모두 캐시
 * ★ 통합본: cache-v8 기준, 캐시버스팅 쿼리 포함
 */

// ★ Fix #13: 버전 쿼리 파라미터 변경에 맞게 캐시명 업데이트
const CACHE_NAME = 'moneynyang-v1-cache-v10';

// ── 로컬 파일 (분리된 CSS/JS 전체) ──
const LOCAL_RESOURCES = [
  './',
  './index.html',
  './manifest.json',
  './css/main.css',
  './css/mobile.css',
  './img/icons/app-icon-192.png',
  './img/icons/app-icon-512.png',
  './js/sw-init.js',
  './js/storage.js',
  './js/leave.js',
  './js/ui.js?v=20260611-fix3',
  './js/salary.js',
  './js/budget.js?v=20260611-fix5',
  './js/data-utils.js',
  './js/assistant.js',
  './js/freelance.js',
  './js/render-salary.js',
  './js/jobtype.js?v=20260614-fix2',
  './js/calendar-modes.js?v=20260614-fix2',
  './js/notifications.js?v=20260614-fix1',
  './js/init.js',
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
