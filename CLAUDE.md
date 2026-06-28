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
