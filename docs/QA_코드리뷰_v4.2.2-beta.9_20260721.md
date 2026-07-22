# 머니냥 v4.2.2-beta.9 QA 코드 리뷰 리포트

- 일자: 2026-07-21 / 대상: v4.2.2-beta.9 (2026-07-18 빌드)
- 방법: 정적 코드 검토 (index.html + js 모듈 전체, sw.js, manifest.json)
- **본 결과는 현재 QA(정적 검토) 기준이며, 실기기(Android PWA) 검증 전 단정 불가 항목은 "추정"으로 표기**
- Feature Freeze 준수: 본 리포트는 발견·기록만 하며 코드 수정은 하지 않음

## 요약

| 구분 | P0 | P1 | P2 |
|---|---|---|---|
| 계산 로직 | 3 | 9 | 8 |
| UI/PWA | 0 | 6 | 12 |

계산 로직 P0 3건(강의 수입 0원, 알바 이중 합산, 60시간 판정 무력화)은 금액이 실제로 틀리게 표시되는 버그로 최우선 수정 권장. UI/PWA는 P0 없음이나 오프라인 흰 화면·뒤로가기 종료 등 조건부 치명(P1) 있음.

---

# A. 급여 계산 로직

## P0 — 금액 오류 (확정적)

### [P0-A] 수입관리 화면에서 프리랜서 '강의' 수입이 0원으로 누락
- 위치: `js/salary.js` 약 1802행
```js
(data.free||[]).forEach(it=>{
  const amt = (it.count||0)*(it.price||0);   // lecture 타입은 count/price가 없음 → 0
```
- 강의 항목은 `{type:'lecture', fee}`로 저장됨(`js/calendar-modes.js` 1110행). 연간요약(`salary.js` 861행), 생존관리(`budget.js` 918행 `freeItemAmount(it)`), 근태 일별(`attendance-v3.js` 216행)은 모두 fee를 반영하는데 **수입관리(renderSal)만 0원**.
- 재현: 프리랜서로 강의 수입 30만원 입력 → 근태/생존관리/연간요약엔 30만원, 수입관리 총 실수령·프리랜서 섹션엔 0원.
- 수정 방향: renderSal의 free 집계도 `freeItemAmount(it)` 공용 헬퍼로 통일.

### [P0-B] 회사알바 + 단기알바 병행 시 알바 수입 이중 합산 (수입관리·연간요약)
- 위치: `js/salary.js` 1789행(njobGross에 data.alba 합산) + 1750~1753행(`albaCompanyPay = getAlbaPaySummary().finalPay` 추가 합산), 연간 동일(`salary.js` 846~874행 getNjobIncomeForMonth).
- `getAlbaPaySummary`(→`getAlbaMonthlyAggregate`, `js/freelance.js` 279~290행)는 회사알바(dayData)뿐 아니라 같은 njob 알바 항목(data.alba)과 레거시 albaData까지 totalGross에 포함 → njobNet에도 같은 알바 항목이 들어가 **두 번 합산**됨.
- 재현: `convenience`+`albaSubtype='company'` 사용자가 회사알바 출퇴근 기록 + 같은 달 단기알바 항목 1건 입력 → 그 알바 금액이 수입관리 총액과 연간요약에 약 2배 반영.
- 수정 방향: 회사알바 경로에서는 `getAlbaPaySummary`의 companyGross(+회사알바 주휴)만 합산하거나, njobNet에서 alba 항목 제외.

### [P0-C] 알바 "월 60시간 초과" 판정이 영구히 false — 4대보험 공제 미적용
- 위치: `js/salary.js` 1818~1821행
```js
const albaMonthHours = njobItems
  .filter(it => it.jobType==='shortAlba' || it.jobType==='convenience')
  .reduce((s,it) => s+(it.hours||0), 0);   // njobItems에는 hours 필드가 없음
```
- njobItems push 시 `{jobType,label,amount,detail,date}`만 저장(1791행) → `albaMonthHours` 항상 0, `albaOver60` 항상 false. 60시간 초과 알바도 고용보험 0.9%만 공제, 화면엔 "이달 누적 0시간 · ✅ 60h 이하"로 표시.
- 수정 방향: njobItems에 hours(또는 dayHours+nightHours+otHours)를 함께 담아 합산.

## P1 — 조건부 금액 오류 / 화면 간 불일치

### [P1-A] 야간수당 "근무형태 기준" 정책(beta.4)이 월 급여계산에는 미적용
- 위치: `js/salary.js` 293~300행(shared는 근무형태 게이트 있음) vs 364~367행(getPayData) / 767~770행(getPayDataForMonth)은 시간대만으로 무조건 가산.
- 재현: 주간고정 09~23시 근무 → 일별 카드는 야간수당 0, 급여 상세·연간은 22~23시 1h 가산. beta.4 정책 위반 + 화면 간 금액 불일치.
- 수정 방향: getPayData/getPayDataForMonth의 nightH 누적에도 shared와 동일한 nightEligible 게이트 적용.

### [P1-B] 연장수당 기준시간 불일치 — shared는 8h 고정, getPayData는 2교대 12h
- 위치: `js/salary.js` 287행(`net-8` 고정) vs 349~356행(2교대 stdH=12) / 761행.
- 재현: 2교대 야간조 12h 근무 → 일별 카드는 연장 4h×0.5 가산 표시, 월 명세는 연장 0 → 하루 수입이 월 합계와 불일치.

### [P1-C] shared의 야간시간 계산에 야식 휴게 미차감
- 위치: `js/salary.js` 300행 `calcNight(rec.start, endH)` — snack 인자 누락. getPayData(366행)는 차감.
- 재현: 야간고정 22~07시 → 일별 카드 야간 8.0h vs 월 명세 7.5h.

### [P1-D] getPayDataForMonth가 지각공제·weeklyOn·perfectOn 미반영 — 당월 명세와 과거월/연간 불일치
- 위치: `js/salary.js` 787행(lateDeduct 없음), 794~795행(perfectOn/weeklyOn 토글 무시 — getPayData 438행과 다름).
- 재현: 지각 2회 있는 달 → 당월엔 공제 반영, 다음 달 연간요약/생존관리/SAO "지난달"에선 공제 없는 더 큰 금액.

### [P1-E] 오늘 날짜에 미래 시작시각 기록 시 실시간 수입 과대 표시 (41,280원 버그 잔존 경로)
- 위치: `js/salary.js` 276~286행. isLive 캡은 Work Session이 있을 때만 동작.
- 재현: 출근 버튼 없이 팝업 편집기로 오늘 기록에 미래 시작시각만 입력(예: 오전에 "18:00", end 없음) → `calcHours(18,10)=16h` 오해석 → Hero에 과대 금액.
- 수정 방향: `rec.start > nowH`이고 세션 없으면(자정넘김 형태 제외) net=0 처리.

### [P1-F] 보조 사업장 실시간 수입이 홈/근태 상단 합산에서 잘못된 Work Session 키로 계산
- 위치: `js/attendance-v3.js` 280~282행, `js/weather.js` 405~406·452~453행 — wsKey 없이 shared 호출(기본 키 = 메인 세션). 사업장 카드/수입관리/SAO는 `atm2_workSession_{wpId}` 정상 전달.
- 재현: 보조 사업장 근무 중 → 상단 "오늘 총 예상수입" ≠ 사업장 카드 예상수입.
- 수정 방향: 합산 루프에도 `{wsKey:'atm2_workSession_'+c.wpId}` 전달.

### [P1-G] 자정 넘김(야간조) 실시간 수입이 자정 이후 표시되지 않음
- 위치: `js/salary.js` 270~271행 — isLive가 "기록 날짜===오늘"일 때만 true. 야간조 23:50 출근 → 자정 이후 금액 미표시.
- 추가 edge(추정): 월말 자정 넘김 시 `_wsEnd`(`attendance-v3.js` 46~55행)가 다음 달 dayData에서 어제 기록을 못 찾아 퇴근 미기록 → 그 날 수입 누락.
- 수정 방향: 세션 date 기준 isLive 판정.

### [P1-H] 생존관리 vs 수입관리 세금 모델 불일치 (같은 수입, 다른 실수령)
- 알바: 생존관리는 job별 4대보험+간이세액(`js/freelance.js` 401~407행), 수입관리는 0.9%만(P0-C 영향).
- 배달: 생존관리 gross 그대로(`budget.js` 922~923행), 수입관리는 3.3% 공제.
- 기타(etc): 수입관리만 3.3% 원천징수 포함(`salary.js` 1827행) — 중고판매·리워드 등은 원천징수 대상 아님.
- 재현: 배달 50만원만 있는 달 → 생존관리 500,000원 vs 수입관리 483,500원.
- 수정 방향: 소득 유형별 공제 규칙을 공용 함수 한 곳으로 통일.

### [P1-I] 수입관리 '직장 급여' 아코디언의 공제 라벨·합계 불일치
- 위치: `js/salary.js` 1942~1949행 — "4대보험+세금" 라벨에 근태공제(totDeduct)를 표시, 실제 4대보험·세금(ins.total+tax.total)은 미표시 → 기본급+수당−공제 ≠ 실수령.
- 수정 방향: 라벨을 "근태 공제"로 고치고 4대보험+세금 행 별도 추가.

## P2 — 경미 / 추정

- **[P2-A]** calcNight 30분 스텝 방식 반올림 오차 — `js/ui.js` 156~169행, 15분 단위 시각에서 최대 ±0.25h.
- **[P2-B]** `_attV3MonthCache`가 사업장 구분 없이 'y-m' 키 공유 — `js/attendance-v3.js` 187~203행 (조건부 캐시 오염).
- **[P2-C]** 연간 지각 카운트 부분 재발 — `js/mn-character.js` 80~95행 지각 판정이 주간고정만 대상. 교대 근무자는 월 명세엔 공제 있는데 연간요약 지각 0.
- **[P2-D]** 최저시급 자동 업그레이드 오탐 — `js/storage.js` 118~127행. 계약시급이 과거 최저시급과 우연히 같으면 소리 없이 변경 (추정).
- **[P2-E]** 주휴수당 항상 8h 고정 — 법정은 (주 소정근로÷40)×8h. 주 15~39h 근로자 과대 계상 (정책 단순화 여부 확인 필요, 추정).
- **[P2-F]** 연간 N잡 알바시간 통계에서 nightHours 누락 — `js/salary.js` 858행.
- **[P2-G]** getPayDataForMonth만 'public' 상태의 start/end로 야간 가산 — getPayData와 상태 목록 불일치 (조건부).
- **[P2-H]** 과거 날짜의 end 없는 기록은 0원으로 조용히 누락 — 퇴근 미기록 경고 없음.

## 과거 버그 재발 여부
- 41,280원(출근 직후 과대): 정상 출근 경로 방어됨. 단 세션 없는 미래 시작시각 경로 미방어(P1-E), 보조 사업장 wsKey 오류(P1-F).
- 주간고정 16.6h: 방어됨.
- 월별 합산 totalWorkH 누락: 수정 확인. (단 `_SUM_FIELDS` 중 normalH/holidayH/halfDays/lateCount는 미반환 — 현재 렌더 미사용이라 실해 없음)
- 연간 지각 0: 주간고정 수정됨, 교대 근무자는 여전히 0 (P2-C).

---

# B. 표시(UI) · PWA/모바일

## P1 (조건부 치명)

### [P1-1] 오프라인 실행 시 쿼리스트링 붙은 내비게이션 → 흰 화면
- 위치: `sw.js` 120~131행, 174행 — 오프라인 폴백이 `caches.match(event.request)` 정확 일치. 쿼리 붙은 URL로 PWA 실행 시 매칭 실패 → 네트워크 오류 화면.
- 재현: 온라인 1회 실행 → 비행기 모드 → `index.html?anything=1` 진입 → 흰 화면.
- 수정 방향: `caches.match(req, {ignoreSearch:true}).then(r => r || caches.match('./index.html'))` 최종 폴백.

### [P1-2] `cache.addAll` 원자성 — 리소스 1개만 404여도 SW 설치 전체 실패
- 위치: `sw.js` 86행 (50여 개 파일). 하나라도 404면 v236 설치 실패 → 전 사용자 구버전 잔존, 조용한 실패.
- (참고: 현재 index.html 쿼리 ↔ sw.js 목록은 전부 일치함을 diff로 확인)
- 수정 방향: 필수 코어만 addAll, 나머지는 `Promise.allSettled`.

### [P1-3] 캐시버스팅 쿼리 없는 JS 3종 — 수정해도 영구 구버전 서빙
- 위치: `index.html` 35행 `js/sw-init.js`, 1450행 `js/data-utils.js`, 1451행 `js/nyang-emoji.js` (쿼리 없음) + Cache First 분기.
- 수정 방향: 세 파일에도 `?v=` 부여, 배포 체크리스트화.

### [P1-4] (추정) Android 뒤로가기 처리 부재 — 모달/서브화면에서 뒤로가기 시 앱 즉시 종료
- 근거: `history.pushState`/`popstate` 처리 전무(grep). standalone PWA에서 뒤로가기 = 앱 종료.
- 수정 방향: 모달 오픈 시 pushState, popstate에서 모달 닫기(#popup·드로어·챗봇 최소 3곳). **실기기 QA 1순위.**

### [P1-5] 좌우 엣지 스와이프가 Android 10+ 제스처 내비게이션과 충돌
- 위치: `index.html` 약 588~609행(드로어), 650~676행(SAO 메뉴 — 🗑️ 초기화 버튼 포함 진입로).
- 수정 방향: 핸들 탭(#sao-handle, ☰) 중심으로 안내, 엣지 의존 축소.

### [P1-6] (추정) 챗봇 입력창이 Android 소프트 키보드에 가려짐
- 위치: `#asst-panel { position:fixed; bottom:100px }` + viewport 메타에 interactive-widget 미지정.
- 수정 방향: `interactive-widget=resizes-content` 또는 visualViewport 보정.

## P2 (경미)

- **[P2-1]** `#njob-total-bar` style에 `display:none`과 `display:flex` 공존(index.html 1204~1205행) — 뒤의 flex가 이겨 초기부터 노출 가능 (추정).
- **[P2-2]** `viewport-fit=cover` 누락인데 safe-area 변수 사용 — env()가 항상 0.
- **[P2-3]** CACHE_NAME(v236) ↔ APP_VERSION(beta.9) 수동 이원 관리 + sw.js 낡은 주석("cache-v8 기준" 등).
- **[P2-4]** EmailJS CDN(jsdelivr)이 SW 캐시 대상 제외 — 오프라인 재방문 시 콘솔 에러 가능.
- **[P2-5]** manifest 캐시 키 불일치(`?v=20260611-fix3` vs 무쿼리 프리캐시), favicon 미프리캐시.
- **[P2-6]** `setTheme('default')` 저장/복원 비대칭 + head 첫 스크립트 try/catch 없음 (추정).
- **[P2-7]** 문구 오타: 약 456행 "퇴근을**기록하면**" → "퇴근을 기록하면" (Freeze 허용 범위 확실 버그).
- **[P2-8]** 사업장명 기본값 "주식회사 VibeWork" 하드코딩(170행) — placeholder 전환 권장.
- **[P2-9]** 접근성 잔존: 튜토리얼 "건너뛰기" #999 대비 2.8:1(AA 미달), font-size 9px 잔존 2곳, 10~11px 회색 다수, 챗봇 #4f7cff 하드코딩(테마 미적용).
- **[P2-10]** 날짜 팝업 sticky 버튼 마진(-28px)이 부모 padding(18px)과 불일치 — 가로 스크롤 흔들림 가능 (추정).
- **[P2-11]** document 터치 리스너 2벌 중복 + 느슨한 판정(dx<-60 위치 무관 드로어 닫힘).
- **[P2-12]** 프로세스: CHANGELOG beta.5~9 미기록 (본 QA에서 사후 복원 완료) + 뉴스 카드는 Freeze 정책과 충돌 — 정책 예외 여부 명시 필요.

## 이상 없음 확인
- index.html 쿼리 ↔ sw.js LOCAL_RESOURCES 전 항목 일치 / 중복 HTML id 없음 / 인라인 localStorage 키 오타 없음 / 인라인에서 초기화 실행 경로 없음 / PWA confirm() 문제는 커스텀 모달로 기대응.

---

# 실기기(Android PWA) QA 우선순위 제안

1. P1-4 뒤로가기(앱 종료 여부) → 2. P1-1 오프라인+쿼리 실행(흰 화면) → 3. P1-6 챗봇 키보드 가림 → 4. P1-5 엣지 스와이프 → 5. 계산 P0 3건 재현 확인(강의 수입/알바 이중 합산/60h 판정)
