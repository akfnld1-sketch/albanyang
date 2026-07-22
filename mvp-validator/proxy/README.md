# HTML Fetch Proxy 배포 가이드 (Cloudflare Worker, 무료)

MVP 가상검증 시스템이 외부 MVP URL의 공개 HTML을 자동 수집하려면, CORS를 우회해 줄 소형 프록시가 1개 필요합니다.
Cloudflare Workers 무료 플랜(일 10만 요청, 카드 등록 불필요)으로 **5분 안에** 배포할 수 있습니다.
프록시가 없어도 앱은 동작합니다(직접 수집 + 수동 붙여넣기/업로드) — 프록시는 "URL 하나만 입력" UX를 완성하는 선택 요소입니다.

## 1. 배포 (대시보드 방식 — CLI 불필요)

1. https://dash.cloudflare.com 에서 무료 계정 생성 (신용카드 불필요)
2. 좌측 **Workers & Pages → Create → Create Worker** → 이름 예: `mvp-fetch-proxy` → **Deploy**
3. **Edit code** 를 눌러 기본 코드를 전부 지우고, 이 폴더의 `cloudflare-worker.js` 내용 전체를 붙여넣기 → **Deploy**
4. Worker의 **Settings → Variables and Secrets** 에서 환경 변수 추가:
   - 이름: `ALLOWED_ORIGINS`
   - 값(쉼표 구분, 공백 없이 자신의 배포 주소로): `https://<깃허브계정>.github.io,http://localhost:10999`
5. 발급된 주소를 복사: `https://mvp-fetch-proxy.<계정>.workers.dev`

## 2. 앱에 연결

### 방법 A — 모든 사용자에게 기본 적용 (권장, 무설정 UX)

`js/url-fetcher.js` 상단의 **한 줄**만 배포한 주소로 바꾸면 끝입니다. 이후 일반 사용자는 아무 설정 없이 URL만 입력하면 자동 수집됩니다.

```js
// 변경 전 (플레이스홀더 — 이 상태에서는 프록시 자동 수집이 비활성)
const DEFAULT_PROXY = 'https://__REPLACE_WITH_YOUR_WORKER__.workers.dev';

// 변경 후 (예시)
const DEFAULT_PROXY = 'https://mvp-fetch-proxy.myname.workers.dev';
```

> 플레이스홀더(`__REPLACE_WITH_YOUR_WORKER__`)가 남아 있으면 앱은 프록시를 호출하지 않고 "직접 수집 → 수동 방법"으로만 동작합니다. 실제 주소로 바꾸는 순간 기본 프록시가 활성화됩니다.

### 방법 B — 개발자 임시 오버라이드

배포된 앱을 건드리지 않고 잠깐 다른 프록시로 테스트하려면, **STEP 1 → ⚙️ 고급 설정 → 🛠️ 개발자 설정 · 프록시**에 주소를 입력해 저장합니다. 브라우저 localStorage `mvpv_proxy`에만 저장되는 개인 오버라이드이며, "기본값으로 초기화"로 되돌립니다. 이 설정은 일반 사용자에게 노출되지 않습니다.

## 3. 배포 후 확인 체크리스트

```bash
# 정상 수집 (200 + HTML 텍스트)
curl "https://<worker>/?url=https%3A%2F%2Fexample.com"

# SSRF 차단 확인 (403)
curl "https://<worker>/?url=http%3A%2F%2F127.0.0.1"
curl "https://<worker>/?url=http%3A%2F%2F192.168.0.1"
curl "https://<worker>/?url=http%3A%2F%2F169.254.169.254%2Flatest%2Fmeta-data"
curl "https://<worker>/?url=http%3A%2F%2F2130706433"          # 10진 인코딩 127.0.0.1
curl "https://<worker>/?url=http%3A%2F%2Flocalhost%3A8080"    # 비표준 포트

# 프로토콜 차단 (403)
curl "https://<worker>/?url=file%3A%2F%2F%2Fetc%2Fpasswd"

# HTML 아님 (415)
curl "https://<worker>/?url=https%3A%2F%2Fexample.com%2Fimage.png"
```

## 4. 보안 설계 요약

| 항목 | 구현 |
|---|---|
| 프로토콜 | http/https만, 기본 포트(80/443)만 |
| SSRF | localhost·`.local`·`.internal`, 사설 IP 대역(10/8, 172.16/12, 192.168/16, 127/8, 169.254/16, 100.64/10, 224+), 10진·8진·16진 인코딩 IP, IPv6 리터럴 전부 차단. 리다이렉트 매 홉 재검증(최대 3회). Cloudflare 엣지는 애초에 사설망 도달이 불가능해 이중 방어 |
| 응답 제한 | 2MB 절단(`X-Truncated` 헤더), 8초 타임아웃, text/html 계열만 통과 |
| 헤더 위생 | 쿠키·자격증명 미전달, `Set-Cookie` 미반환, `text/plain`으로 반환(브라우저 실행 방지) |
| 오픈 프록시 방지 | `ALLOWED_ORIGINS` 목록의 Origin에만 CORS 발급, 목록 밖 브라우저 Origin은 403 |
| Rate limit | IP당 분당 10회(아이솔레이트 단위 best-effort) + URL별 10분 엣지 캐시 + 무료 플랜 일 10만 요청이 최종 백스톱 |

**정직한 한계**
- Origin 헤더는 브라우저 밖(스크립트/서버)에서는 위조 가능합니다. 이 프록시는 "다른 웹사이트가 브라우저에서 무단 사용"하는 것을 막는 수준이며, 완전한 인증이 필요하면 요청에 공유 토큰을 추가하세요(코드에 주석 참고 위치: `ALLOWED_ORIGINS` 검사 부근).
- 인메모리 rate limit은 엣지 아이솔레이트마다 별도라 완벽하지 않습니다. 자체 도메인을 Worker에 연결하면 무료 플랜에 포함된 **WAF Rate Limiting 규칙 1개**(예: IP당 분당 20회)를 정식으로 걸 수 있습니다.
- CSR 전용 SPA는 JS를 실행하지 않으므로 셸 HTML만 수집됩니다(앱이 "미분석 영역"으로 안내). 로그인 뒤 화면은 수집할 수 없습니다.
- 일부 사이트는 데이터센터 IP·봇 트래픽을 차단해 403을 반환할 수 있습니다 → 앱의 수동 붙여넣기 경로를 사용하세요.

## 5. 대안 (동일 로직 이식 가능)

- **Vercel Serverless Functions** / **Netlify Functions**: 같은 검증 로직을 Node 핸들러로 옮기면 됩니다. 콜드스타트가 있고 GitHub 연동 프로젝트가 필요하지만 무료 한도는 충분합니다.
- 공개 CORS 프록시(corsproxy.io 등)는 **비권장**: 사용자 MVP URL이 제3자에게 노출되고 신뢰성이 낮습니다.
- GitHub Actions 중계는 부적합: 정적 사이트에서 토큰 없이 트리거할 수 없고 지연이 수십 초~분 단위입니다.
