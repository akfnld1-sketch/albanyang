/**
 * sw.js — Service Worker (오프라인 지원)
 * 전략: Cache First (캐시 우선) — 오프라인에서도 앱 전체 동작
 * ★ v11 분리 구조 대응 — CSS/JS 파일 모두 캐시
 * ★ 통합본: cache-v8 기준, 캐시버스팅 쿼리 포함
 */

// ★ Fix #70: 근태관리 히어로카드에 생존관리로 이어지는 질문형 문구 추가
//   ("이 돈으로 다음 월급날까지 버틸 수 있을까요?") — 기능 변경 없음 (2026-06-22)
const CACHE_NAME = 'moneynyang-v1-cache-v105';

// ── 로컬 파일 (분리된 CSS/JS 전체) ──
// ★ index.html의 <script>/<link> 태그와 쿼리스트링이 항상 일치해야 함 (불일치 시 사전 캐시 무의미)
const LOCAL_RESOURCES = [
  './',
  './index.html',
  './manifest.json',
  './css/main.css?v=20260627b',
  './css/mobile.css?v=20260627b',
  './img/icons/app-icon-192.png',
  './img/icons/app-icon-512.png',
  './js/sw-init.js',
  './js/storage.js?v=20260628',
  './js/leave.js?v=20260627',
  './js/ui.js?v=20260628c',
  './js/salary.js?v=20260627',
  './js/budget.js?v=20260627',
  './js/data-utils.js',
  './js/nyang-emoji.js',
  './js/assistant.js?v=20260627',
  './js/freelance.js?v=20260627',
  './js/render-salary.js?v=20260627',
  './js/jobtype.js?v=20260623',
  './js/calendar-modes.js?v=20260627',
  './js/notifications.js?v=20260626a',
  './js/init.js?v=20260628b',
  './js/tutorial.js',
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
