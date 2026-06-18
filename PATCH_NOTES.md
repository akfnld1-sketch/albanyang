# 머니냥 버그 수정 패치 노트
생성일: 2026-06-14

## 수정된 파일 목록

| 파일 | 수정 항목 |
|---|---|
| `assistant.js` | Fix #19 |
| `init.js` | Fix #2, Fix #9 |
| `leave.js` | Fix #5, Fix #6, Fix #7, Fix #8, Fix #11, Fix #17, Fix #20, Fix #21, Fix #22+#27 |
| `ui.js` | Fix #10 |
| `storage.js` | Fix #3 |
| `notifications.js` | Fix #1 (주석 명시) |
| `render-salary.js` | Fix #23 |
| `sw.js` | Fix #13 |
| `manifest.json` | Fix #18 |

---

## 적용 방법
1. 아래 파일들을 프로젝트의 해당 경로에 덮어쓰기 합니다.
   - `js/assistant.js`
   - `js/init.js`
   - `js/leave.js`
   - `js/ui.js`
   - `js/storage.js`
   - `js/notifications.js`
   - `js/render-salary.js`
   - `sw.js`
   - `manifest.json`
2. 사용자 브라우저에서 강제 새로고침(Ctrl+Shift+R) 또는 캐시 삭제를 안내합니다.

---

## 상세 수정 내용

### 🔴 Fix #19 — AI 챗봇 주간 OT 계산 완전 불능 수정 (`assistant.js`)
- **문제**: `calcWeekOT()` 내 `lsLoad('att_data')` 잘못된 API 호출 → 항상 빈 객체 반환
- **수정**: `dayData` 전역 변수 직접 참조 + v11 구조(`start/end`) 대응 (구버전 `in/out` 폴백 포함)
- **영향**: AI 챗봇의 "이번 주 OT 감지" 기능 정상화

### 🔴 Fix #2 — 설정 페이지 `workType` 미정의 오류 (`init.js`)
- **문제**: `renderSettingsPage()`에서 `workType` 참조 → ReferenceError
- **수정**: `workType` → `wt` (leave.js의 실제 전역 변수명)
- **영향**: 설정 탭 → 근무형태 표시 정상화

### 🔴 Fix #3 — `SHIFT2` const 선언 → let으로 변경 (`storage.js`)
- **문제**: `const SHIFT2`인데 `init.js:updateCustomShift()`에서 프로퍼티 재할당
- **수정**: `const` → `let`으로 의도 명확화
- **영향**: Strict Mode 환경에서 잠재적 오류 방지

### 🔴 Fix #5 — localStorage 용량 초과 시 사용자 알림 (`leave.js`)
- **문제**: `QuotaExceededError` 발생 시 조용히 무시 → 데이터 유실
- **수정**: 저장 실패 감지 시 `showToast()` 경고 메시지 표시
- **영향**: 사용자가 저장 실패를 인지하고 백업/초기화 조치 가능

### 🟡 Fix #6 — `resetAllData()` N잡 인메모리 초기화 누락 (`leave.js`)
- **문제**: `flData`, `albaData`, `alarmList`, `chatHistory` 인메모리 변수 미초기화
- **수정**: 초기화 로직에 N잡 관련 변수 추가
- **영향**: 초기화 후 앱 재사용 시 이전 N잡 데이터 잔존 방지

### 🟡 Fix #7 — `manualPay` 참조 전 방어 코드 (`leave.js`)
- **문제**: `salary.js:671`에서 선언되는 `manualPay`를 `leave.js`의 `lsSave()`에서 참조
- **수정**: `typeof manualPay !== 'undefined'` 가드 추가
- **영향**: 초기 로드 중 `lsSave()` 호출 시 오류 방지

### 🟡 Fix #8 — `confirm()` 이중 호출 제거 (`leave.js`)
- **문제**: `resetAllData()` 내부와 호출부 모두 confirm 다이얼로그 표시
- **수정**: `skipConfirm` 파라미터 추가 → 외부 confirm이 있는 경우 내부 생략 가능
- **영향**: 사용자에게 확인 창이 1회만 표시됨
- **사용법**: 외부에서 confirm 후 호출 시 `resetAllData(true)` 사용

### 🟡 Fix #9 — 온보딩 keydown 이벤트 미해제 (`init.js`)
- **문제**: 온보딩 종료 후에도 `keydown` 이벤트 리스너가 남아 있음
- **수정**: 명명 함수(`_obKeyHandler`)로 분리 + `obClose()`에서 `removeEventListener` 호출
- **영향**: 메모리 누수 및 불필요한 이벤트 처리 제거

### 🟡 Fix #10 — `calcNight()` 소수점 시간 처리 오류 (`ui.js`)
- **문제**: 정수 루프로 소수점 근무시간(8.5시간 = 08:30) 처리 불정확
- **수정**: 30분 단위(0.5h 스텝) 누적 방식으로 변경
- **영향**: 야간수당 계산 정확도 향상

### 🟡 Fix #11 — `exportData()` null 안전 접근 (`leave.js`)
- **문제**: `document.getElementById('company-input').value` null 체크 없음
- **수정**: 옵셔널 체이닝 `?.` 추가
- **영향**: 특정 DOM 미로드 상태에서 TypeError 방지

### 🟡 Fix #17 — `flData` typeof 방어 (`leave.js`)
- **문제**: `lsSave()` 초기 호출 시 `flData` 미초기화 가능성
- **수정**: `typeof flData !== 'undefined'` 가드 추가
- **영향**: 초기화 순서 불일치 시 오류 방지

### 🟡 Fix #20 — `budgetLoad()` 순서 의존성 방어 (`leave.js`)
- **문제**: `lsLoad()` 내에서 `budgetState.paydayDay` 접근 시 `budgetLoad()` 미실행 상태 가능
- **수정**: `budgetLoad`가 아직 실행되지 않았다면 선행 호출
- **영향**: 급여일 복원 신뢰성 향상

### 🟡 Fix #21 — `autoApplyHolidays()` 저장 누락 (`leave.js`)
- **문제**: 공휴일 자동 적용 후 `lsSave()` 호출 없어 앱 종료 시 유실
- **수정**: 실제 변경이 있을 때만 `lsSave()` 호출
- **영향**: 공휴일 자동 표시 데이터 영구 저장 보장

### 🟡 Fix #22 + #27 — `resetAllData` 렌더링 함수 수정 (`leave.js`)
- **문제**: `renderSalary()` 호출 (N잡 모드 미고려, null 체크 없음)
- **수정**: `renderIncomePage()`로 교체 + 옵셔널 체이닝 추가
- **영향**: N잡 모드 사용자의 초기화 후 렌더링 오류 방지

### 🟡 Fix #23 — `updateManifest` 불필요한 Blob URL 생성 방지 (`render-salary.js`)
- **문제**: 렌더링마다 무조건 `updateManifest(null)` 호출 → Blob URL 생성
- **수정**: 로고가 있을 때만 조건부 호출
- **영향**: 메모리 효율 개선

### 🟢 Fix #13 — SW 캐시 버전 업데이트 (`sw.js`)
- `moneynyang-v1-cache-v9` → `moneynyang-v1-cache-v10`
- 버전 쿼리 파라미터 변경 파일들이 신규 캐시로 서빙됨

### 🟢 Fix #18 — manifest.json 아이콘 purpose 분리 (`manifest.json`)
- `"purpose": "any maskable"` → `"purpose": "any"`와 `"purpose": "maskable"` 별도 항목으로 분리
- 구버전 Chrome 호환성 향상

---

## 미수정 항목 (코드 외 조치 필요)

| 번호 | 항목 | 조치 방법 |
|---|---|---|
| #4 | 온보딩 차단 MutationObserver 경쟁 조건 | 스플래시 화면 제거 후 앱 구조 재설계 권장 |
| #12 | 급여일 단일 소스 통일 | 향후 리팩터링 시 `budgetState.paydayDay`를 마스터로 통합 |
| #14 | iOS Safari DataTransfer 제한 | iOS는 항상 텍스트 붙여넣기 경로만 사용하도록 분기 강화 필요 |
| #16 | 스플래시 이미지 base64 인라인 | `img/splash.jpg` 파일로 분리 권장 |
| #24 | `njobRefresh` 존재 여부 확인 | calendar-modes.js에서 `njobRefresh` 정의 확인 필요 |
| #25 | Formspree 엔드포인트 노출 | Formspree 대시보드에서 도메인 화이트리스트 설정 |
| #26 | 공휴일 데이터 검증 | 공공데이터포털 API 연동 또는 매년 수동 검증 |
