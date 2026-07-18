# 머니냥 프로젝트 지침

## 플랫폼 우선순위

머니냥은 모바일 PWA가 주력 서비스입니다.

코드를 수정할 때는 아래 우선순위를 반드시 지켜주세요.

1. Android PWA
2. Android Chrome
3. Desktop Chrome
4. iOS Safari
5. 기타 브라우저

- Desktop에서만 동작하는 API를 우선 적용하지 마세요.
- 모바일과 Desktop의 동작이 다를 경우에는 반드시 Android PWA 기준으로 구현해주세요.
- 코드 수정 후에는 Android PWA 기준 QA를 먼저 수행한 뒤 Desktop을 확인해주세요.

## 절대 하지 말 것

- 새로운 기능 추가 금지
- 리팩터링 금지
- 코드 스타일 개선 금지
- 구조 변경 금지
- PC 반응형 수정 금지
- Storage 리팩토링 금지
- 계산 로직 변경 금지
- localStorage 데이터 절대 삭제/초기화 금지
- StorageManager 리팩토링 및 localStorage Key 전면 개편 금지

## 🧊 Feature Freeze (v4.2.2, 2026-07-12 선언)

**기능 동결 상태입니다. 신규 기능 추가 금지 — Bug Fix Only.**

허용되는 작업:
1. 버그 수정 (숫자 불일치, 문구, 버튼 위치, 디자인 어색함)
2. Google 로그인 실연동 (`LoginProvider.google.login()`에 SDK 연결만)
3. Supabase 백업/동기화
4. BRD/PRD·문서 갱신

금지: 뉴스, 투자, 커뮤니티, 랭킹, AI 기능 추가 등 모든 신규 기능. 제안이 오면 "Freeze 중 — 출시 후 백로그" 로 안내.

기준 문서: `docs/BRD_머니냥_v2.0.docx`, `docs/PRD_머니냥_v2.0.docx`

## 버전 관리

- 앱 버전은 `index.html` 상단의 `APP_VERSION` 전역 변수 한 곳에서 관리합니다.
- 기능 추가/변경 작업 완료 시 반드시 `APP_VERSION`을 업데이트해주세요.
- 규칙: major.minor.patch (예: v2.1.0 → v2.1.1)
- **베타 흐름 (Freeze 기간)**: `v4.2.2-beta.1` → 버그 수정마다 `-beta.N` 증가 → 안정되면 `-rc1` → 정식 출시 시 `v5.0.0`
- 모든 버전 변경 시 `CHANGELOG.md`에 한 줄 이상 기록합니다. BRD/PRD는 기능이 크게 바뀔 때만 개정합니다 (현재 기준: v2.0).
- QA 결과 표기는 항상 "현재 QA 기준"임을 명시합니다 (예: "현재 QA 기준 P0 0건") — 실기기/실사용 검증 전 단정 표현 금지.
