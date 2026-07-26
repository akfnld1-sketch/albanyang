# Handoff: 머니냥 (MoneyNyang) 전면 리디자인 — 모바일 PWA + PC
**최종 확정본 (2026-07-25). 팔레트: 메인 #2563EB / 포인트 #F59E0B. 라이트 + 다크 4개 파일.**

## Overview
근태·수입·생존(예산)을 기록·예측하는 앱 **머니냥**의 UI/UX 전면 리디자인.
기존 앱(이모지 아이콘, 상단 탭바, 카드 나열식 홈)의 시각 언어를 버리고
**타임라인 중심 홈 + 스와이프 화면 전환 + 정보(날씨·브리핑) 화면 + 음성/챗봇 비서**로 재구성했다.

주 사용자층은 **20대~60대 알바생·프리랜서·직장인**이며, 시니어층도 한눈에 읽을 수 있도록
본문 최소 14px, 탭·버튼 등 터치 타깃 최소 44px을 지켰다.

## About the Design Files
이 번들의 `.dc.html` 파일들은 **HTML로 만든 디자인 레퍼런스(프로토타입)**다.
실제 동작하는 인터랙션(스와이프 전환, 달력 클릭 기록, 팝업, 챗봇/음성 토글)이 포함되어 있어
의도한 모양과 거동을 그대로 확인할 수 있지만, **프로덕션 코드로 그대로 복사해 넣을 대상은 아니다.**

작업 목표는 이 디자인을 **대상 코드베이스(albanyang: 바닐라 JS + PWA, `index.html` + `css/` + `js/` 41개 모듈)의
기존 구조와 패턴 위에서 재현**하는 것이다. 기존 계산 로직(급여·주휴·야간수당·생존점수·연차)은 유지하고
**뷰 레이어와 CSS만 교체**하는 방향을 권장한다.

## Fidelity
**High-fidelity (hifi).** 색상·타이포·간격·라운드·상태 색이 모두 확정값이다.
아래 디자인 토큰과 화면별 명세를 그대로 적용해 픽셀 단위로 재현할 것.

---

## 정보 구조 (IA)

기존 구조를 유지하되 **정보 화면을 홈 옆에 신설**했다.

| # | 화면 | 진입 |
|---|------|------|
| 0 | 홈 (오늘 타임라인) | 기본 |
| 1 | 정보 (날씨 + 브리핑) | 탭 / 헤더 종 아이콘 |
| 2 | 근태 | 탭 / 스와이프 |
| 3 | 수입 | 탭 / 스와이프 |
| 4 | 생존 | 탭 / 스와이프 |
| 5 | 연간 | 탭 / 스와이프 |
| 6 | 설정 | 헤더 톱니 아이콘 (탭에는 노출 안 함) |

오버레이(화면 위에 뜨는 것): **전체달력 팝업**, **챗봇 패널**, **음성 입력 바**.

---

## Screens / Views — 모바일 (`moneynyang-app.dc.html`)

공통 셸: 최대 폭 520px, 좌우 중앙 정렬, 배경 `#fbfaf6`, 최소 높이 100vh, `overflow:hidden`.

### 공통 헤더 (고정)
- 패딩 `16px 20px 6px`, `display:flex; justify-content:space-between; align-items:center`
- 좌: 냥이 아바타 31×31 원형 + "머니냥" 19px/900, `letter-spacing:-.02em`
- 우 (gap 12px):
  - 칩 "오늘 +86,200원" — 배경 `#eef1fb`, 글자 `#2a5bd7`, 13px/700, `padding:6px 12px`, `border-radius:999px`
  - 톱니 아이콘 23×23 → 클릭 시 설정 화면(idx 6). 현재 화면이면 stroke 텍스트1, 아니면 텍스트3
  - **알림 종은 없음.** 안 읽은 소식은 "정보" 탭 라벨 옆 빨간 점 6×6(`#DC2626`, 다크 `#F87171`)으로만 표시하고, 정보 화면에 들어가면 사라진다

### 탭 바
- `display:grid; grid-template-columns:repeat(6,1fr)`, 하단 보더 1px `#eae6d6`
- 라벨 15px, 활성 `#232014`/700, 비활성 `#9a947e`/400, `padding:12px 0`
- 인디케이터: 하단 절대배치 `width:16.6667%; height:3px; background:#232014; border-radius:3px`
  - `transform: translateX(idx*100%)` — **스와이프 드래그 중 실시간 추종**, 드래그 중 transition 없음, 놓으면 `.3s cubic-bezier(.25,.8,.35,1)`
  - 설정 화면(idx 6)일 때 `opacity:0`

### 스와이프 트랙 ★핵심 인터랙션
- 래퍼: `overflow:hidden; touch-action:pan-y; cursor:grab`
- 트랙: `display:flex; width:700%`(=7화면), 각 화면 `width:14.2857%; flex:none`
- `transform: translateX(calc(-idx*(100/7)% + dragPx))`
- 포인터 이벤트: `pointerdown` → `setPointerCapture`, 시작 X 저장, 트랙 실측 폭 저장
  `pointermove` → `drag = clientX - startX`, **양 끝에서는 `drag *= 0.3`(고무줄)**
  `pointerup`/`pointerleave` → `|drag| > 60px`이면 인접 화면으로 확정, 아니면 복귀. drag 리셋
- 실제 앱에서는 동일 로직을 `touchstart/touchmove/touchend`로 구현.
  **세로 스크롤과 충돌 방지**: 첫 이동에서 `|dx| > |dy|`일 때만 수평 스와이프로 확정(axis lock)하고
  그 경우에만 `preventDefault()`. `touch-action:pan-y`가 브라우저 측 방어선.

### 0. 홈 — 오늘 타임라인
사용자가 가장 먼저 봐야 하는 것은 **오늘 근무/출퇴근 상태**(사용자 지정).
- 날짜 제목 "7월 25일 토요일" 21px/900, `letter-spacing:-.02em`
- 타임라인: 좌측 레일(`display:flex; gap:14px`) + 우측 카드
  - 완료 노드: 원 12×12 `#2f9e6e` 채움 / 예정 노드: 원 12×12, 2.5px 보더 `#c9c2a8`, 배경 `#fbfaf6`
  - 노드 사이 세로 선: `width:2px; background:#e8e4d4; flex:1`
  - 시각 라벨 13px/700 — 완료 `#2f9e6e`, 예정 `#8b8672`
  - 카드: 배경 `#ffffff`, 보더 1px `#eae6d6`, `border-radius:16px`, `padding:14px 16px`
    - 사업장명 16px/700 + 금액 15px/900 (`#2a5bd7` 주간 / `#4b5bc4` 야간)
    - 서브 14px `#8b8672`
    - 주 CTA "지금 퇴근 기록": 전체폭, `min-height:46px`, `border-radius:12px`, 배경 `#232014`, 글자 `#fbfaf6` 15px/700
- 마지막 노드: 이번 달 요약 바 — 배경 `#232014`, 글자 `#fbfaf6`, `border-radius:16px`, `padding:14px 16px`
  좌 "예상 수입 · 근무" 14px opacity .75 / 우 "1,842,000원 · 112시간" 15px/900

### 1. 정보 — 날씨 + 브리핑 (신설)
- **날씨 카드**: `background: linear-gradient(140deg,#5a7fd6,#7a9be8)`, `border-radius:20px`, `padding:18px 20px`, 글자 `#fff`
  - 지역·요일 14px opacity .85 / 기온 36px/900 / 요약 14.5px
  - 우측 날씨 SVG 52×52 (stroke `#fff` 1.6)
  - 시간대 예보 4칸: `flex:1`, 배경 `rgba(255,255,255,.16)`, `border-radius:12px`, `padding:9px 0`, 13px
  - 하단 냥이 조언 바: 같은 반투명 배경, 아바타 24×24 + 13.5px/line-height 1.45
- **오늘의 브리핑** 카드(흰 카드, `padding:4px 16px`): 행마다 카테고리 칩 + 제목 14.5px/600 + 부제 12.5px `#9a947e`
  - 칩: 노동 `#eef1fb`/`#2a5bd7`, 지원금 `#e6f2ec`/`#2f9e6e`, 세금 `#f0ecfb`/`#7c5cff` — 12px/700, `padding:3px 9px`, `border-radius:999px`
  - 행 사이 1px `#f0ecdd` 구분선
  - 콘텐츠 원칙: **뉴스 + 내 상황 반영 코멘트**("내 시급 반영 시 월 +58,000원 예상")
- **내 소식**: 냥이 인사이트 카드(흰색) + 경고 카드(배경 `#f7efdc`, 글자 `#7a5413`, 경고 SVG stroke `#9a6a13`)

### 2. 근태
1. **주 단위 스트립** (최상단, 사업장 카드 위)
   - 헤더: "이번 주 (7월 19일~25일)" 15px/900 + 안내 13px `#8b8672`
   - `display:grid; grid-template-columns:repeat(7,1fr); gap:4px`
   - 각 칸: `padding:8px 0 7px`, `border-radius:11px`, 보더 1px `#eae6d6`, 배경 `#fbfaf6`
     - 요일 12px — 일 `#c94747`, 토 `#4b5bc4`, 평일 `#9a947e`
     - 날짜 15.5px/800
     - 상태 색점 6×6 원형
   - **오늘(25일)**: 배경/보더 `#232014`, 글자 `#fbfaf6`
   - **날짜 클릭 → 전체달력 팝업이 그 날짜 선택 상태로 열림**
2. "7월 전체달력 보기" 버튼 — 전체폭, `min-height:46px`, 보더 1.5px `#e0dbc8`, 배경 `#fbfaf6`, 14.5px/700
3. 사업장 카드 ×2 (메인/보조 칩, 근무 중 상태 `#2f9e6e`, 경과시간 24px/900, 금액 16px/900, CTA 50px)
4. 연차·월차 현황 — 게이지 `height:10px`, 트랙 `#f0ecdd`, 채움 `#3b82f6`, "잔여 10일"
5. 이번 달 근태 요약 — 상태별 색점 + 건수 4열 그리드

### 3. 수입
- 총 예상 수입 32px/900 + 전월 대비 칩(`#e6f2ec`/`#2f9e6e`)
- 사업장별 카드: 사업장명 16px/700 + 합계 17px/900, 내역 행(기본급/주휴·야간수당/공제) 14.5px
  - 공제는 `#c94747`, 표기 `−72,000원` (U+2212 마이너스)
- 급여명세서 비교 카드 — 실지급/차이 + 일치율 칩 98.7%

### 4. 생존
- 생존 점수 카드: 점수 38px/900 `#2f9e6e`, 게이지 `height:12px` 트랙 `#f0ecdd`, 하단 위험/주의/안전 라벨 12.5px `#9a947e`
- 수입/지출/남은 돈·버틸 날 리스트 (지출 `#c94747`, 남은 돈 `#2f9e6e`)
- 경고 배너: 배경 `#f7efdc`, 글자 `#7a5413`

### 5. 연간
- 총 수입 30px/900, 시간·전년 대비(`#2f9e6e`)
- 월별 수입 막대: `height:90px`, `gap:8px`, 지난달 `#e0dbc8`, 이번달 `#2a5bd7`, `border-radius:5px 5px 0 0`
- 사업장 비율 스택바 `height:12px` — `#2a5bd7` / `#b9c8f0`
- 배지 칩: 개근왕 `#eef1fb`/`#2a5bd7`, 칼출근 `#e6f2ec`/`#2f9e6e`, N잡러 `#f0ecfb`/`#7c5cff`

### 6. 설정
- 프로필 카드 (아바타 48, 이름 17px/900, 로그인 수단 13.5px)
- **직업 설정**: 시급제 / 알바 / 연봉제 / 배달·대리 / 프리랜서 — 선택 칩 `#232014`+`#fbfaf6`, 미선택 보더 1.5px `#e0dbc8` + `#9a947e`
  (기존 `js/jobtype.js`의 소득 계산 방식 분류를 그대로 따름)
- **근무 형태**: 주간/야간/2교대/3교대 4열 + 기본 출퇴근 시간(09:00~18:00) 수정
- **화면 밝기 · 글자 크기**: **밝게 / 어둡게 / 휴대폰 설정**, 보통/크게/아주 크게
  - "라이트/다크/시스템" 같은 용어는 쓰지 않는다(첫 사용자·시니어가 모른다)
  - 아래 안내문 필수: "'휴대폰 설정'을 고르면 휴대폰이 어두워질 때 앱도 같이 어두워져요"
- 리스트: 사업장 관리, 알림 토글, 급여명세서 비교, 튜토리얼 다시 보기, 문의하기
- 데이터: 백업(파일 저장) / 복원 / 전체 초기화(`#c94747`, "되돌릴 수 없음")
- 하단: 버전 "머니냥 v4.2.2" + 로그아웃

### 오버레이 A — 전체달력 팝업
- 딤: `position:fixed; inset:0; background:rgba(35,32,20,.45); z-index:40`, 딤 클릭 시 닫힘(내부는 `stopPropagation`)
- 시트: **`box-sizing:border-box`** + `width:min(440px,calc(100% - 32px))` (padding이 폭 밖으로 더해지면 390px 폰에서 잘린다), `max-height:88vh; overflow:auto`, 배경 `#fbfaf6`, `border-radius:22px`, `padding:20px`,
  `box-shadow:0 20px 50px rgba(35,32,20,.35)`
- 헤더: ‹ 이전달 / "2026년 7월 전체달력" 18px/900 / ✕
- **요일 헤더**: 일월화수목금토, 13px `#9a947e` (일 `#c94747`, 토 `#4b5bc4`)
- 날짜 그리드 `repeat(7,1fr)`, gap 3px, 1일 앞 3칸 `visibility:hidden`
  - 셀: `padding:10px 0 8px`, 15px, 배경 `#ffffff`, 보더 1px `#eae6d6`, `border-radius:10px`
  - 오늘(25) 배경 `#f0ecdd`, **선택 날짜** 배경/보더 `#232014` + 글자 `#fbfaf6`
  - 셀 하단 상태 색점 7×7
- **기록 패널**: "7월 N일 (요일)" 15.5px/900 + 상태 칩 8종
  - 칩 클릭 → 해당 날짜 상태 즉시 갱신 → 달력 색점·주 스트립 색점 동시 반영
  - 활성 칩 배경 `#232014` 글자 `#fbfaf6`, 비활성 흰 배경 + 보더 1px `#e0dbc8` + `#6a6552`
- 출근 09:00 ~ 퇴근 18:00 행 + "시간 수정"

### 하단 액션 바 (모바일, 고정 오버레이 아님 ★)
플로팅 버튼(FAB)은 콘텐츠를 덮으므로 쓰지 않는다. 앱 셸을 `height:100vh; display:flex; flex-direction:column`로 두고:
- 스와이프 트랙 래퍼: `flex:1; min-height:0; overflow-y:auto; overflow-x:hidden; touch-action:pan-y`
- 하단 바: `flex:none`, 상단 보더 1px, `padding:10px 16px 14px`, 좌측 페이지 점 / 우측 액션 버튼 2개
  - 마이크 48×48 원형 `#F59E0B`(켜짐 `#D97706`), 흰 마이크 SVG
  - 챗봇 48×48 원형 `#2563EB` + 냥이 아바타 30
- 이 구조면 어떤 스크롤 위치에서도 금액·CTA가 가려지지 않는다

PC는 FAB 대신 **상단 바 우측**에 마이크 44×44 + "냥이 비서" pill 버튼을 둔다.

### 오버레이 B — 챗봇 패널
- `position:fixed; left/right: max(16px, calc(50% - 244px)); bottom:88px; z-index:20`
- 흰 배경, 보더 1px `#eae6d6`, `border-radius:20px`, `padding:16px`, `box-shadow:0 14px 34px rgba(35,32,20,.22)`
- 헤더(아바타 28 + "머니냥 비서" 15px/900 + 닫기) / 냥이 말풍선(`#f4f1e6`, `border-radius:4px 14px 14px 14px`)
- 퀵리플라이 칩: "퇴근했어", "이번 달 얼마 벌었어?", "점심값 9천원 썼어" — 보더 1.5px `#e0dbc8`, 13.5px/600
- 입력 바: 배경 `#f4f1e6`, `border-radius:999px`, 우측 마이크 원형 38 `#2a5bd7`

### 오버레이 C — 음성 입력 바
- 챗봇과 같은 fixed 위치, `z-index:21`
- 배경 `#2a5bd7`, `border-radius:999px`, `padding:10px 10px 10px 20px`, `box-shadow:0 12px 30px rgba(42,91,215,.4)`
- 텍스트 "듣고 있어요… \"퇴근했어\" 처럼 말해보세요" 15px `#d5e0ff`/600
- 파형: 막대 5개 `width:3px`, 높이 10/18/12/20/9px, 색 `#9db8f5`·`#fff` 교차 (실제 앱에서는 입력 레벨에 연동)
- 우측 ✕ 원형 44 흰 배경

### 플로팅 버튼 (FAB)
- `position:fixed; right:max(16px, calc(50% - 244px)); bottom:88px; z-index:19`, 세로 배치 gap 12px
- 마이크 FAB 56×56 원형 `#2a5bd7` + 마이크 SVG(흰색), `box-shadow:0 8px 22px rgba(42,91,215,.4)`
- 챗봇 FAB 56×56 원형 `#232014` + 냥이 아바타 34, `box-shadow:0 8px 22px rgba(35,32,20,.35)`
- 챗봇/음성 중 하나가 열리면 FAB 그룹은 숨김(`display:none`), 둘은 상호 배타

---

## Screens / Views — PC (`moneynyang-pc.dc.html`)

같은 디자인 언어를 데스크톱 구조로 재편. 배경 `#f2f0e8`.

### 좌측 사이드바 (고정 236px)
- 배경 `#232014`, 글자 `#fbfaf6`, `padding:22px 16px`
- 로고: 아바타 34 + "머니냥" 20px/900
- 메뉴 7개: 각 항목 `display:flex; gap:12px; padding:12px 14px; border-radius:12px`, 15.5px
  - **SVG 아이콘 20×20 (stroke 1.8, linecap/linejoin round)** — 집·정보·달력·통화·하트·차트·톱니
  - 활성: 배경 `rgba(255,255,255,.12)`, 글자 `#fbfaf6`/700 / 비활성: `#b8b3a0`/500
- 하단: 이번 달 수입 요약 박스(`rgba(255,255,255,.08)`, `border-radius:14px`) + 프로필 행 + 설정 톱니

### 상단 바
- 배경 `#fbfaf6`, 하단 보더 1px `#e6e1cf`, `padding:20px 32px`
- 좌: 페이지 제목 22px/900 (홈은 "오늘의 대시보드") + 날짜·날씨 14px `#8b8672`
- 우: "오늘 +86,200원 예상" 칩, "● 근무 중 4:32" 칩(`#e6f2ec`/`#2f9e6e`), 알림 종

### 본문 그리드
- `padding:24px 32px 40px`, `gap:18px`
- **모든 그리드는 `repeat(auto-fit, minmax(Npx,1fr))`** — 창이 좁아지면 자동 스택 (홈 상단 420px, 하단 3열 300px, 수입 KPI 260px, 기타 380~400px)
- 카드: 배경 `#fbfaf6`, 보더 1px `#e6e1cf`, `border-radius:20px`, `padding:22px 24px`
- 강조 카드는 `#232014` 배경 + `#fbfaf6` 글자 (수입/연간 KPI, 월 목표)
- **행 내부 축소 방어**: 금액 span과 버튼에 `flex:none; white-space:nowrap`, 좌측 텍스트 블록에 `min-width:0`, 행에 `flex-wrap:wrap`
- 홈 대시보드 구성: (좌) 오늘 타임라인 / (우) 생존 점수·월 목표·냥이 조언 → 하단 3열: 주간 근태+전체달력 버튼 / 월별 수입 추이 / 오늘의 브리핑
- FAB·챗봇은 `right:28px; bottom:28px`(패널은 `bottom:100px`, 폭 360px)

---

## Interactions & Behavior

| 동작 | 트리거 | 결과 |
|------|--------|------|
| 화면 전환 | 좌우 스와이프(60px 임계) / 탭 클릭 | `idx` 변경, 트랙 translateX + 인디케이터 이동, `.3s cubic-bezier(.25,.8,.35,1)` |
| 고무줄 | 첫/끝 화면에서 바깥 방향 드래그 | 이동량 ×0.3 |
| 정보 진입 | 헤더 종 클릭 | `idx = 1` |
| 설정 진입 | 헤더 톱니 클릭 | `idx = 6`, 탭 인디케이터 `opacity:0` |
| 전체달력 열기 | "전체달력 보기" 버튼 / 주 스트립 날짜 클릭 | `calOpen = true` (+ 날짜 클릭 시 `calSel` 동시 설정) |
| 날짜 선택 | 달력 셀 클릭 | `calSel` 변경 → 기록 패널 제목·활성 칩 갱신 |
| 상태 기록 | 상태 칩 클릭 | `statusMap[calSel] = 상태` → 달력·주 스트립 색점 즉시 갱신 |
| 팝업 닫기 | ✕ / 딤 클릭 | `calOpen = false` (시트 클릭은 `stopPropagation`) |
| 챗봇 | 챗봇 FAB | `chatOpen` 토글, `micOn = false` |
| 음성 | 마이크 FAB | `micOn` 토글, `chatOpen = false` |

전환 외 애니메이션은 최소화(전환 `.3s`, 색·폭 변화 `.25s`).
호버는 PC에서만: 카드 보더 `#e6e1cf → #d5cfb8`, 버튼 밝기 소폭 변화.

### 반응형
- 모바일: 최대 520px 셸, 그 이상 화면에서는 중앙 정렬
- PC: 사이드바 236px 고정 + 본문 `auto-fit` 그리드. 약 1000px 미만에서 카드가 1열로 스택
- 접근성: 본문 최소 14px, 터치 타깃 최소 44px, 글자 크기 3단계(보통/크게/아주 크게) 설정 제공

## State Management

```
idx: 0..6            // 현재 화면
drag: number         // 스와이프 진행 픽셀 (드래그 중에만)
dragging: boolean    // 드래그 여부 (transition on/off 분기)
calOpen: boolean     // 전체달력 팝업
calSel: 1..31        // 선택 날짜
statusMap: { [일]: '정상'|'연차'|'반차'|'지각'|'조퇴'|'결근'|'휴일특근'|'야간' }
chatOpen: boolean
micOn: boolean
```

실제 앱 연동:
- `statusMap` → 기존 근태 저장 구조(`js/attendance-v3.js`)에 매핑. 상태 변경 시 예상 급여 재계산 트리거
- 날씨·브리핑은 신규 데이터 소스 필요(날씨 API + 큐레이션 콘텐츠). **브리핑 항목은 사용자 프로필(직업·시급)에 따라 코멘트가 달라진다** — 서버 측 개인화 필요
- 화면 인덱스는 URL 해시(`#home`, `#info`, …)에 반영해 PWA 뒤로가기와 새로고침 복원을 지원할 것

## Design Tokens

### Color — 라이트 (확정)
```
메인(브랜드/CTA)      #2563EB
포인트(강조/액션)      #F59E0B
포인트-텍스트         #B45309   ← 흰 배경 위 금액·칩 텍스트. #F59E0B는 대비 2.1:1로 텍스트 금지
포인트-소프트         #FEF3C7   칩·배지 배경
성공/안전            #22C55E (채움) / #15803D (텍스트)
경고                #F97316 (채움) / #9A3412 (텍스트) / #FFEDD5 (배경)
위험/지출            #EF4444 (채움) / #DC2626 (텍스트)
배경                #F8FAFC
body 바깥            #EAEEF4 (모바일) / #EEF2F8 (PC)
카드                #FFFFFF
카드 보더            #E2E8F0
보조 보더            #CBD5E1
구분선               #EEF2F7
말풍선·입력바         #F1F5F9
텍스트 1             #1E293B
텍스트 2             #475569
텍스트 3             #64748B
텍스트 4(placeholder) #94A3B8
사이드바 비활성        #A9BCE8
```

근태 상태 색: 정상 #15803D · 연차 #3b82f6 · 반차 #7c5cff · 지각 #e07a2e ·
조퇴 #d9a514 · 결근 #DC2626 · 휴일특근 #1f9e9e · 야간 #1E40AF

날씨 카드(정보): 배경 `linear-gradient(150deg,#e8f1fb,#f5f9fd)`, 보더 #d8e5f2,
텍스트 #1b3a5c, 보조 #5d7f9f, 아이콘 stroke #4b86c4, 내부 칩 #FFFFFF + 보더 #dfe9f4

### Color — 다크 (확정)
```
배경                #0F172A
body 바깥            #080D18 (모바일) / #0B1220 (PC)
카드                #1B2536
카드 보더            #2E3A4E
보조 보더            #3A4759
구분선               #2A3547
말풍선·입력바         #243044
텍스트 1             #E6EDF7
텍스트 2             #B7C2D4
텍스트 3             #93A1B5
텍스트 4             #7A8798
메인(브랜드/CTA)      #1D4ED8
포인트-텍스트         #FBBF24   ← 다크에서는 밝게 반전
포인트-소프트         #3A2C10
성공                #4ADE80 / 배경 #12301F
위험                #F87171
경고                #FDBA74 / 배경 #3A2413
연차 #60A5FA · 야간 #818CF8 · 반차 #A78BFA · 지각 #FB923C · 휴일특근 #2DD4BF · 조퇴 #FACC15
날씨 카드            linear-gradient(150deg,#1B2B44,#16233A), 보더 #2C3F5C, 텍스트 #DCE8F7
컬러 배경 위 텍스트     #EAF1FB
```

**색 역할 규칙 (중요)**
1. 블루 = 브랜드·CTA·월 요약 바·활성 탭 (구조)
2. 앰버 = 금액·마이크 버튼·탭 인디케이터·차트 강조 (주목)
3. 스카이 라이트 = 날씨 등 참고 정보 (가장 약함)
4. 채도 높은 원본색(#F59E0B, #22C55E, #EF4444)은 **채움 전용**. 텍스트는 반드시 파생 다크 값 사용

### Typography
- Font: **Noto Sans KR** (400/500/700/900), fallback `system-ui, sans-serif`
- 스케일(모바일): 32/30/24/21/19/17/16/15.5/15/14.5/14/13.5/13/12.5/12 px
- 굵기: 900 = 금액·제목, 700 = 라벨·버튼, 600 = 부제, 400 = 본문
- 큰 숫자·제목 `letter-spacing:-.02em`, 본문 `line-height:1.45~1.5`, `text-wrap:pretty`

### Spacing
4 / 6 / 8 / 10 / 12 / 14 / 16 / 18 / 20 / 22 / 24 / 32 px

### Radius
`4` 말풍선 꼬리 · `9~12` 셀·버튼 · `14` 사이드바 박스 · `16` 카드(모바일) ·
`20` 카드(PC)·패널 · `22` 시트 · `999` 칩·게이지

### Shadow
```
카드            없음 (보더로 구분)
액션 버튼(앰버)   0 4px 14px rgba(245,158,11,.32)
액션 버튼(블루)   0 4px 14px rgba(30,41,59,.3)   다크: rgba(0,0,0,.3)
챗봇 패널        0 14px 34px rgba(30,41,59,.22)
달력 시트        0 20px 50px rgba(30,41,59,.35)
음성 바         0 12px 30px rgba(245,158,11,.4)
딤              rgba(30,41,59,.45)  다크: rgba(0,0,0,.45)
```

### Motion
```
화면 전환     transform .3s cubic-bezier(.25,.8,.35,1)   (드래그 중 none)
색·폭 변화    .25s
```

## Assets
- **냥이 캐릭터**: `assets/nyang-hello.png`, `assets/nyang-think.png` (아바타/말풍선용, 원형 크롭 24~56px)
  — 절제된 사용: 헤더 로고, 챗봇, 조언 카드에만. 화면 전면 등장 없음
- **아이콘**: 모두 인라인 SVG (24 viewBox, `stroke-width` 1.6~2, `stroke-linecap:round`).
  이모지 아이콘(🏠📋💰)은 전부 제거 — 사용자 요청 사항.
  대상 코드베이스의 `img/icons/` 자산으로 대체 가능하나, 위 stroke 규격에 맞춰 통일할 것
- 이미지 플레이스홀더 없음. 날씨 아이콘도 SVG

## Files
| 파일 | 내용 |
|------|------|
| `moneynyang-app-final.dc.html` | **모바일 라이트 — 주 레퍼런스** (7화면 + 스와이프 + 오버레이) |
| `moneynyang-app-dark.dc.html` | 모바일 다크 |
| `moneynyang-pc-final.dc.html` | PC 라이트 (사이드바 + 다열 그리드) |
| `moneynyang-pc-dark.dc.html` | PC 다크 |
| `assets/nyang-*.png` | 냥이 캐릭터 이미지 |

브라우저에서 바로 열립니다(같은 폴더의 `support.js` 필요). 스와이프·달력 기록·팝업·챗봇이 실제로 동작하므로 거동을 직접 확인하며 구현하세요.

## 적용 순서 (권장)
1. **디자인 토큰을 CSS 변수로** — 위 색·간격·라운드·타이포를 `css/design-system.css`에 전면 교체
2. **셸 재구성** — 헤더 + 6탭 + 스와이프 트랙. 기존 화면 DOM을 트랙의 자식으로 이동
3. **화면별 뷰 교체** — 홈(타임라인) → 근태(주 스트립 + 달력 팝업) → 수입 → 생존 → 연간 → 설정.
   각 단계에서 기존 계산 함수의 반환값을 새 마크업에 바인딩만 하고 로직은 손대지 않는다
4. **정보 화면 신설** — 날씨 API 연동 + 브리핑 콘텐츠 소스
5. **오버레이 3종** — 전체달력 / 챗봇 / 음성
6. **다크 모드** — `moneynyang-*-dark.dc.html`의 값으로 토큰 반전. 설정의 "휴대폰 설정"은 `prefers-color-scheme` 연동

### 실무 팁
- 1단계에서 색을 **CSS 변수 한 곳**(`:root` / `[data-theme="dark"]`)에 정의하면 다크 모드가 자동으로 따라온다. 하드코딩 금지
- 화면 하나씩 교체하고 매번 실기기(안드로이드 크롬 + PWA 설치 상태)에서 확인
- 스와이프는 세로 스크롤과 충돌하기 쉬우니 **axis lock**(첫 이동에서 |dx|>|dy|일 때만 수평 확정)을 반드시 구현
- 좁은 폭 깨짐 방지: 금액·버튼에 `flex:none; white-space:nowrap`, 텍스트 블록에 `min-width:0`, 그리드는 `repeat(auto-fit,minmax(Npx,1fr))`

## 주의
- 기존 앱은 **Android PWA 우선**(`CLAUDE.md`). 스와이프는 PWA 표준 브라우저 뒤로가기 제스처와 겹칠 수 있으므로
  화면 0에서 오른쪽 스와이프는 고무줄만 적용하고 히스토리 이동은 하지 않는다
- 시니어 사용자 고려: 글자 크기 3단계가 **전 화면 레이아웃을 깨지 않고** 동작해야 한다(고정 px 높이 대신 `min-height` 사용)
- 금액 표기는 항상 천 단위 구분 + "원", 음수는 U+2212(`−`)
