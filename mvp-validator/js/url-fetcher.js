/**
 * url-fetcher.js — MVP URL의 HTML 확보 계층
 * ① 브라우저 fetch 직접 시도 (동일 출처·CORS 허용 사이트만 성공)
 * ② 실패 시: HTML 소스 붙여넣기 / .html 파일 업로드 (완전 로컬)
 * ③ iframe 미리보기는 표시 전용 — 크로스오리진 iframe 내부는 분석·조작 불가 (브라우저 보안 모델)
 * 어떤 경로로도 확보하지 못하면 "화면 미분석" 모드로 정직하게 진행한다.
 */
(function (global) {
  'use strict';
  const MVPV = global.MVPV = global.MVPV || {};

  /** URL 정규화: 프로토콜 보정 + 유효성 검사 → 정규화된 문자열 또는 null */
  function normalizeUrl(raw) {
    let s = (raw || '').trim();
    if (!s) return null;
    if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
    try {
      const u = new URL(s);
      if (!u.hostname || u.hostname.indexOf('.') === -1 && u.hostname !== 'localhost') return null;
      return u.href;
    } catch (e) { return null; }
  }

  /**
   * fetch 직접 시도.
   * @returns {ok:true, html} | {ok:false, error:'cors-or-network'|'http'|'timeout'|'not-html', status?}
   * 주의: 브라우저는 CORS 차단과 네트워크 오류를 구분해 주지 않음 (둘 다 TypeError)
   */
  async function tryFetch(url, timeoutMs) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs || 8000);
    try {
      const res = await fetch(url, { signal: ctrl.signal, redirect: 'follow' });
      clearTimeout(timer);
      if (!res.ok) return { ok: false, error: 'http', status: res.status };
      const type = res.headers.get('content-type') || '';
      const html = await res.text();
      if (type.indexOf('html') === -1 && !/<html|<body|<head/i.test(html.slice(0, 2000))) {
        return { ok: false, error: 'not-html' };
      }
      return { ok: true, html };
    } catch (e) {
      clearTimeout(timer);
      if (e.name === 'AbortError') return { ok: false, error: 'timeout' };
      return { ok: false, error: 'cors-or-network' };
    }
  }

  /** 파일 목록(.html/.htm/.txt) → pages 배열 */
  function readFiles(fileList) {
    const files = Array.from(fileList || []).slice(0, 10);
    return Promise.all(files.map(f => new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ name: f.name, html: String(reader.result || '') });
      reader.onerror = () => resolve(null);
      reader.readAsText(f);
    }))).then(pages => pages.filter(p => p && p.html.trim().length > 0));
  }

  const ERROR_GUIDE = {
    'cors-or-network': '브라우저 보안 정책(CORS) 또는 네트워크 문제로 직접 가져올 수 없었습니다.',
    'http': '사이트가 오류 상태 코드를 반환했습니다. 주소를 확인해 주세요.',
    'timeout': '응답이 8초 안에 오지 않았습니다.',
    'not-html': '응답이 HTML 문서가 아닙니다. 웹 페이지 주소인지 확인해 주세요.',
    'no-proxy': '자동 수집용 프록시가 아직 준비되지 않았습니다. 잠시 후 다시 시도하거나, 아래 수동 방법(소스 붙여넣기/파일 업로드)을 이용해 주세요.',
    'bad-proxy': '프록시 주소 형식이 올바르지 않습니다. ⚙️ 고급 설정을 확인해 주세요.',
    'proxy-network': '프록시 서버에 연결하지 못했습니다. 주소가 맞는지, Worker가 배포되어 있는지 확인해 주세요.',
    'proxy-timeout': '프록시 응답이 12초 안에 오지 않았습니다.',
  };

  // ── 프록시 (Cloudflare Worker 등 — proxy/README.md로 1회 배포) ──
  // ★ 운영 기본 프록시: 여기 한 줄만 배포한 Worker 주소로 바꾸면
  //   일반 사용자는 아무 설정 없이 URL만 입력해도 자동 프록시 수집이 동작한다.
  //   개발자는 고급 설정에서 이 값을 일시적으로 덮어쓸 수 있다(localStorage 오버라이드).
  const DEFAULT_PROXY = 'https://__REPLACE_WITH_YOUR_WORKER__.workers.dev';
  const PROXY_LS_KEY = 'mvpv_proxy';

  // 아직 실제 주소로 교체하지 않은 플레이스홀더인지 판별 (미배포 상태에서 헛된 프록시 호출 방지)
  function isPlaceholder(u) { return !u || /__REPLACE_WITH_YOUR_WORKER__/.test(u); }

  /** 개발자 오버라이드 값 (없으면 빈 문자열) */
  function getProxyOverride() {
    try { return (localStorage.getItem(PROXY_LS_KEY) || '').trim(); }
    catch (e) { return ''; }
  }
  /** 실제 사용할 프록시 주소 (오버라이드 우선, 없으면 기본값). 플레이스홀더면 빈 문자열 */
  function getProxyUrl() {
    const eff = getProxyOverride() || DEFAULT_PROXY;
    return isPlaceholder(eff) ? '' : eff.trim();
  }
  /** 코드에 실제 기본 프록시가 심어져 있는지 */
  function hasBuiltinProxy() { return !isPlaceholder(DEFAULT_PROXY); }
  function setProxyUrl(u) {
    try {
      const v = (u || '').trim();
      if (v) localStorage.setItem(PROXY_LS_KEY, v);
      else localStorage.removeItem(PROXY_LS_KEY);
    } catch (e) {}
  }

  /**
   * 프록시 경유 fetch.
   * 프록시 규약: GET <proxy>/?url=<encoded> → 200 text/plain(HTML 본문) | 4xx/5xx JSON {error}
   */
  async function tryProxyFetch(url, timeoutMs) {
    const proxy = getProxyUrl();
    if (!proxy) return { ok: false, error: 'no-proxy' };
    let endpoint;
    try { endpoint = new URL(/^https?:\/\//i.test(proxy) ? proxy : 'https://' + proxy); }
    catch (e) { return { ok: false, error: 'bad-proxy' }; }
    const reqUrl = endpoint.origin + endpoint.pathname.replace(/\/$/, '') + '/?url=' + encodeURIComponent(url);

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs || 12000);
    try {
      const res = await fetch(reqUrl, { signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) {
        let detail = '';
        try { detail = (await res.json()).error || ''; } catch (e) {}
        return { ok: false, error: 'proxy-http', status: res.status, detail };
      }
      const html = await res.text();
      if (html.trim().length < 30) return { ok: false, error: 'not-html' };
      return { ok: true, html, finalUrl: res.headers.get('X-Final-Url') || url, truncated: res.headers.get('X-Truncated') === '1' };
    } catch (e) {
      clearTimeout(timer);
      if (e.name === 'AbortError') return { ok: false, error: 'proxy-timeout' };
      return { ok: false, error: 'proxy-network' };
    }
  }

  /**
   * 수집 체인: 직접 fetch → 프록시 fetch. 각 단계 시작 시 onStatus(stage) 통지.
   * @returns {ok:true, source:'fetch'|'proxy', html, truncated?} | {ok:false, direct, proxy}
   */
  async function acquire(url, onStatus) {
    if (onStatus) onStatus('direct');
    const direct = await tryFetch(url, 8000);
    if (direct.ok) return { ok: true, source: 'fetch', html: direct.html };
    if (onStatus) onStatus('proxy', direct);
    const prox = await tryProxyFetch(url, 12000);
    if (prox.ok) return { ok: true, source: 'proxy', html: prox.html, truncated: prox.truncated };
    return { ok: false, direct, proxy: prox };
  }

  MVPV.urlFetcher = { normalizeUrl, tryFetch, tryProxyFetch, acquire, readFiles,
    getProxyUrl, getProxyOverride, setProxyUrl, hasBuiltinProxy, DEFAULT_PROXY, ERROR_GUIDE };
})(window);
