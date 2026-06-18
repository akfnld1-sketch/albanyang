// ════════════════════════════════════════════════════════
// 머니냥 튜토리얼 패치 안내 (tutorial_patch.js)
// ════════════════════════════════════════════════════════
//
// ① index.html — 스크립트 로드 순서
// ──────────────────────────────────
// assistant.js, nyang-emoji.js 등 기존 스크립트 뒤에 추가:
//
//   <script src="js/tutorial.js"></script>
//
//
// ② init.js — 앱 초기화 마지막 줄에 추가
// ──────────────────────────────────────
// 기존 init.js의 DOMContentLoaded 콜백 맨 끝:
//
//   // 튜토리얼 (최초 접속 시 자동 표시)
//   if (typeof initTutorial === 'function') initTutorial();
//
//
// ③ ui.js 또는 settings 렌더 함수 — 설정 화면에 버튼 삽입
// ──────────────────────────────────────────────────────────
// renderSettings() 함수 내 설정 목록 HTML 안에 아래 버튼 추가:
//
//   <!-- 튜토리얼 다시보기 -->
//   <div class="setting-row" onclick="reopenTutorial()" style="cursor:pointer;">
//     <div class="setting-icon">📖</div>
//     <div class="setting-info">
//       <div class="setting-label">튜토리얼 다시보기</div>
//       <div class="setting-desc">앱 사용법을 처음부터 다시 볼 수 있어요</div>
//     </div>
//     <div class="setting-arrow">›</div>
//   </div>
//
// ════════════════════════════════════════════════════════
//
// ── 설정 화면 "튜토리얼 다시보기" 행 독립 삽입 함수 ──
// (renderSettings()를 수정하기 어려운 경우 사용)
//
function injectTutorialSettingRow() {
  // 설정 컨테이너 찾기 (공통 class명 예시)
  const container = document.querySelector('.settings-list, #settings-list, .setting-section');
  if (!container) return;

  // 이미 삽입됐으면 스킵
  if (document.getElementById('tutorial-setting-row')) return;

  const row = document.createElement('div');
  row.id = 'tutorial-setting-row';
  row.className = 'setting-row';
  row.style.cssText = 'cursor:pointer;';
  row.onclick = () => {
    if (typeof reopenTutorial === 'function') reopenTutorial();
  };
  row.innerHTML = `
    <div class="setting-icon">📖</div>
    <div class="setting-info">
      <div class="setting-label" style="font-size:18px;font-weight:700;">튜토리얼 다시보기</div>
      <div class="setting-desc" style="font-size:16px;color:var(--text3);">앱 사용법을 처음부터 다시 볼 수 있어요</div>
    </div>
    <div class="setting-arrow" style="font-size:22px;color:var(--text3);">›</div>
  `;

  // 맨 아래에 추가
  container.appendChild(row);
}

// 설정 페이지 로드 감지 후 자동 삽입 (MutationObserver 사용)
(function() {
  const observer = new MutationObserver(() => {
    const container = document.querySelector('.settings-list, #settings-list, .setting-section');
    if (container && !document.getElementById('tutorial-setting-row')) {
      injectTutorialSettingRow();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
