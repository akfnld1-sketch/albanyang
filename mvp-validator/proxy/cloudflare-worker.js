/**
 * MVP 가상검증 시스템 — HTML Fetch Proxy (Cloudflare Worker, 무료 플랜용)
 *
 * 역할: GitHub Pages 정적 앱이 CORS 때문에 직접 가져올 수 없는
 *       "공개 웹 페이지의 HTML"을 대신 받아서 CORS 헤더와 함께 돌려준다.
 * 사용: GET https://<이름>.workers.dev/?url=https%3A%2F%2Fexample-mvp.com
 * 배포: proxy/README.md 참고 (대시보드에 이 파일 전체를 붙여넣으면 끝, 의존성 없음)
 *
 * 환경 변수(Settings → Variables):
 *   ALLOWED_ORIGINS = "https://<계정>.github.io,http://localhost:10999"
 *
 * 보안 설계:
 *   - GET + ?url= 만 허용, http/https만, 기본 포트(80/443)만
 *   - SSRF 차단: localhost·사설 IP 대역·IP 리터럴·메타데이터 IP·IPv6 리터럴 거부
 *     (Cloudflare 엣지는 애초에 사설망에 도달할 수 없지만 이중 방어로 명시 차단)
 *   - 리다이렉트 수동 추적(최대 3회) — 매 홉마다 동일 검증 재적용
 *   - 응답 2MB 제한 + 8초 타임아웃 + text/html 계열만 통과
 *   - 쿠키/자격증명 미전달, Set-Cookie 제거, text/plain으로 반환(브라우저 실행 방지)
 *   - CORS는 ALLOWED_ORIGINS 목록의 Origin에만 발급 (타 사이트의 무단 사용 방지)
 *   - URL별 10분 엣지 캐시 + IP별 분당 요청 제한(베스트 에포트)
 */

const MAX_BYTES = 2 * 1024 * 1024;   // 2MB
const FETCH_TIMEOUT_MS = 8000;       // 8초
const MAX_REDIRECTS = 3;
const CACHE_TTL_SEC = 600;           // 10분
const RATE_LIMIT_PER_MIN = 10;       // IP당 분당 (아이솔레이트 단위 best-effort)

// 아이솔레이트 생명주기 동안만 유지되는 간이 카운터 (완전한 rate limit이 아님 — README 참고)
const rateMap = new Map();

export default {
  async fetch(request, env) {
    const reqUrl = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const allowed = String(env.ALLOWED_ORIGINS || '')
      .split(',').map(s => s.trim()).filter(Boolean);

    const cors = corsHeaders(origin, allowed);

    // 프리플라이트
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== 'GET') {
      return json(405, { error: 'GET만 허용됩니다' }, cors);
    }

    // 브라우저 요청인데 허용 목록 밖 Origin이면 거부 (오픈 프록시화 방지)
    if (origin && allowed.length > 0 && !allowed.includes(origin)) {
      return json(403, { error: '허용되지 않은 Origin입니다' }, cors);
    }

    const raw = reqUrl.searchParams.get('url');
    if (!raw) return json(400, { error: 'url 파라미터가 필요합니다' }, cors);

    let target;
    try { target = new URL(raw); }
    catch (e) { return json(400, { error: 'URL 형식이 올바르지 않습니다' }, cors); }

    const blockReason = validateTarget(target);
    if (blockReason) return json(403, { error: blockReason }, cors);

    // 간이 rate limit (IP당 분당)
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (!checkRate(ip)) {
      return json(429, { error: '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요' }, cors);
    }

    // 엣지 캐시 (동일 URL 10분)
    const cache = caches.default;
    const cacheKey = new Request('https://proxy-cache.invalid/?u=' + encodeURIComponent(target.href));
    const cached = await cache.match(cacheKey);
    if (cached) {
      const res = new Response(cached.body, cached);
      for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
      res.headers.set('X-Proxy-Cache', 'HIT');
      return res;
    }

    // 대상 fetch — 리다이렉트 수동 추적, 매 홉 검증
    let current = target;
    let upstream = null;
    try {
      for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
        upstream = await fetch(current.href, {
          method: 'GET',
          redirect: 'manual',
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
          headers: {
            'User-Agent': 'MVPValidator/2.1 (MVP structure analyzer; contact via repo)',
            'Accept': 'text/html,application/xhtml+xml,*/*;q=0.5',
            'Accept-Language': 'ko,en;q=0.8',
          },
        });
        if ([301, 302, 303, 307, 308].includes(upstream.status)) {
          const loc = upstream.headers.get('Location');
          if (!loc) return json(502, { error: '리다이렉트 응답에 Location이 없습니다' }, cors);
          current = new URL(loc, current);
          const r = validateTarget(current);
          if (r) return json(403, { error: '리다이렉트 대상 차단: ' + r }, cors);
          if (hop === MAX_REDIRECTS) return json(508, { error: '리다이렉트가 너무 많습니다' }, cors);
          continue;
        }
        break;
      }
    } catch (e) {
      const timedOut = e && (e.name === 'TimeoutError' || e.name === 'AbortError');
      return json(504, { error: timedOut ? '대상 사이트가 8초 안에 응답하지 않았습니다' : '대상 사이트에 연결하지 못했습니다' }, cors);
    }

    if (!upstream.ok) {
      return json(502, { error: '대상 사이트 오류 (HTTP ' + upstream.status + ')' }, cors);
    }
    const ct = (upstream.headers.get('Content-Type') || '').toLowerCase();
    if (ct && !/text\/html|application\/xhtml|text\/plain/.test(ct)) {
      return json(415, { error: 'HTML 문서가 아닙니다 (' + ct.split(';')[0] + ')' }, cors);
    }

    // 본문 스트림 읽기 — 2MB 초과 시 절단
    let body;
    try { body = await readLimited(upstream.body, MAX_BYTES); }
    catch (e) { return json(502, { error: '본문을 읽지 못했습니다' }, cors); }

    const headers = {
      ...cors,
      'Content-Type': 'text/plain; charset=utf-8', // HTML로 실행되지 않도록 plain으로 반환
      'X-Final-Url': current.href,
      'X-Truncated': body.truncated ? '1' : '0',
      'Cache-Control': 'public, max-age=' + CACHE_TTL_SEC,
      'X-Content-Type-Options': 'nosniff',
    };
    const res = new Response(body.text, { status: 200, headers });
    // Set-Cookie 등 원본 헤더는 일절 전달하지 않음 (위에서 새로 구성)
    try { await cache.put(cacheKey, res.clone()); } catch (e) {}
    return res;
  },
};

function corsHeaders(origin, allowed) {
  const h = {
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
  if (origin && (allowed.length === 0 || allowed.includes(origin))) {
    h['Access-Control-Allow-Origin'] = origin;
  }
  return h;
}

/** 대상 URL 검증 — 문제 있으면 사유 문자열, 없으면 null */
function validateTarget(u) {
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return '허용되지 않은 프로토콜입니다 (http/https만 가능)';
  if (u.username || u.password) return 'URL에 자격증명을 포함할 수 없습니다';
  if (u.port && u.port !== '80' && u.port !== '443') return '기본 포트(80/443) 외에는 접근할 수 없습니다';
  if (isBlockedHost(u.hostname)) return '차단된 호스트입니다 (localhost/사설망/IP 리터럴)';
  return null;
}

function isBlockedHost(hostname) {
  const h = hostname.toLowerCase().replace(/\.$/, '');
  if (h === 'localhost' || h.endsWith('.localhost')) return true;
  if (h.endsWith('.local') || h.endsWith('.internal') || h.endsWith('.home.arpa')) return true;
  // IPv6 리터럴 전체 차단 (URL hostname은 [::1] 형태)
  if (h.includes(':') || h.startsWith('[')) return true;
  // 순수 숫자/16진 호스트 (10진·16진 인코딩 IPv4: http://2130706433/, http://0x7f000001/)
  if (/^(0x[0-9a-f]+|\d+)$/.test(h)) return true;
  // 점 표기 IPv4 (8진/16진 옥텟 포함)
  const m = h.match(/^(0x[0-9a-f]+|\d+)\.(0x[0-9a-f]+|\d+)\.(0x[0-9a-f]+|\d+)\.(0x[0-9a-f]+|\d+)$/);
  if (m) {
    const oct = m.slice(1).map(p =>
      p.startsWith('0x') ? parseInt(p, 16)
        : (p.length > 1 && p[0] === '0') ? parseInt(p, 8)
          : parseInt(p, 10));
    if (oct.some(o => isNaN(o) || o > 255)) return true; // 비정상 표기는 통째로 거부
    const [a, b] = oct;
    if (a === 0 || a === 10 || a === 127) return true;                 // 0/8, 10/8, 127/8
    if (a === 172 && b >= 16 && b <= 31) return true;                  // 172.16/12
    if (a === 192 && b === 168) return true;                           // 192.168/16
    if (a === 169 && b === 254) return true;                           // 169.254/16 (메타데이터)
    if (a === 100 && b >= 64 && b <= 127) return true;                 // 100.64/10 (CGNAT)
    if (a >= 224) return true;                                         // 멀티캐스트·예약
  }
  return false;
}

function checkRate(ip) {
  const now = Date.now();
  const slot = Math.floor(now / 60000);
  const key = ip + ':' + slot;
  const n = (rateMap.get(key) || 0) + 1;
  rateMap.set(key, n);
  if (rateMap.size > 5000) rateMap.clear(); // 메모리 보호
  return n <= RATE_LIMIT_PER_MIN;
}

async function readLimited(stream, maxBytes) {
  const reader = stream.getReader();
  const chunks = [];
  let total = 0, truncated = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      chunks.push(value.slice(0, value.byteLength - (total - maxBytes)));
      truncated = true;
      try { await reader.cancel(); } catch (e) {}
      break;
    }
    chunks.push(value);
  }
  const buf = new Uint8Array(chunks.reduce((s, c) => s + c.byteLength, 0));
  let off = 0;
  for (const c of chunks) { buf.set(c, off); off += c.byteLength; }
  return { text: new TextDecoder('utf-8', { fatal: false }).decode(buf), truncated };
}

function json(status, obj, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' },
  });
}
