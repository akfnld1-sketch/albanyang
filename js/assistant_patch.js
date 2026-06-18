// ════════════════════════════════════
// assistant.js 수정 안내 (패치)
// ════════════════════════════════════
//
// 1. index.html (또는 메인 HTML)에 추가:
//    <script src="js/nyang-emoji.js"></script>
//    → assistant.js 보다 먼저 로드되어야 함
//
// ────────────────────────────────────
// 2. addBotMsg 함수 교체 (assistant.js)
// ────────────────────────────────────
// 기존 addBotMsg 함수 전체를 아래로 교체하세요.

function addBotMsg(text) {
  const msgs = document.getElementById('asst-msgs');
  const div = document.createElement('div');
  div.className = 'asst-msg bot';

  // 감정 감지 → 이모지 이미지 선택
  const emotionSrc = (typeof detectEmotion === 'function')
    ? detectEmotion(text)
    : 'img/emoji/환영인사.png';

  const avatarHtml = (typeof getNyangAvatarHtml === 'function')
    ? getNyangAvatarHtml(emotionSrc)
    : `<img src="${emotionSrc}" style="width:28px;height:28px;object-fit:cover;border-radius:50%;margin-top:2px;" alt="머니냥">`;

  div.innerHTML = `<div class="av">${avatarHtml}</div><div class="bubble">${text.replace(/\n/g, '<br>')}</div>`;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

// ────────────────────────────────────
// 3. addTyping 함수 교체 (assistant.js)
// ────────────────────────────────────
// 기존 addTyping 함수 전체를 아래로 교체하세요.

function addTyping() {
  const msgs = document.getElementById('asst-msgs');
  const div = document.createElement('div');
  div.id = 'asst-typing';
  div.className = 'asst-msg bot';

  // 로딩 중 → 생각중 이모지
  const typingAvatar = (typeof getNyangTypingAvatarHtml === 'function')
    ? getNyangTypingAvatarHtml()
    : `<img src="img/emoji/생각중.png" style="width:28px;height:28px;object-fit:cover;border-radius:50%;margin-top:2px;" alt="머니냥">`;

  div.innerHTML = `<div class="av">${typingAvatar}</div><div class="bubble" style="padding:12px 16px;">
    <span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>
  </div>`;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
  return div;
}

// ════════════════════════════════════
// 수정 요약
// ════════════════════════════════════
// - addBotMsg: base64 고정 이미지 → detectEmotion()으로 감정별 PNG 자동 선택
// - addTyping: base64 고정 이미지 → img/emoji/생각중.png 사용
// - onerror 핸들러로 이미지 로드 실패 시 환영인사.png로 fallback 처리
