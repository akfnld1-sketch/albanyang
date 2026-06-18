// ════════════════════════════════════
// 머니냥 감정 이모지 시스템
// 파일: js/nyang-emoji.js
// ════════════════════════════════════

// ── 감정별 이미지 경로 매핑 ──
const NYANG_EMOJI = {
  환영인사: 'img/emoji/환영인사.png',
  생각중:   'img/emoji/생각중.png',
  수입돈:   'img/emoji/수입돈.png',
  격정경고: 'img/emoji/격정경고.png',
  흐음오류: 'img/emoji/흐음오류.png',
  칭찬축하: 'img/emoji/칭찬축하.png',
  모를때:   'img/emoji/모를때.png',
};

// ── 기본 이모지 (fallback) ──
const NYANG_DEFAULT = 'img/emoji/환영인사.png';

// ── 봇 응답 텍스트 → 감정 감지 ──
function detectEmotion(text) {
  if (!text) return NYANG_DEFAULT;

  // 수입/급여/돈 관련 → 수입돈
  if (/(실수령|급여|월급|수당|OT|야간|보험|세금|공제|시급|소득|수입|금액|원|💰)/i.test(text)) {
    return NYANG_EMOJI.수입돈;
  }

  // 경고/위험 → 격정경고
  if (/(경고|위험|주의|초과|위반|법정|부족|감소|줄었|🙀|😤|😢)/i.test(text)) {
    return NYANG_EMOJI.격정경고;
  }

  // 오류/모름 → 흐음오류
  if (/(오류|error|알 수 없|모르|이해|확인 필요|잘못|문제|😿)/i.test(text)) {
    return NYANG_EMOJI.흐음오류;
  }

  // 칭찬/축하 → 칭찬축하
  if (/(축하|잘하셨|훌륭|멋지|완료|달성|성공|👍|🎉|😄)/i.test(text)) {
    return NYANG_EMOJI.칭찬축하;
  }

  // 인사/처음 → 환영인사
  if (/(안녕|반가|처음|환영|좋은 아침|좋은 저녁|수고|😊|☀️|🌙)/i.test(text)) {
    return NYANG_EMOJI.환영인사;
  }

  // 모르겠다/도움말 → 모를때
  if (/(도움말|뭐|어떻게|모르겠|질문|물어|알려|알아봐|🐾)/i.test(text)) {
    return NYANG_EMOJI.모를때;
  }

  // 기본값 → 생각중 (일반 응답)
  return NYANG_EMOJI.생각중;
}

// ── 감정 이미지 HTML 생성 ──
function getNyangAvatarHtml(emotion) {
  const src = emotion || NYANG_DEFAULT;
  return `<img src="${src}" style="width:28px;height:28px;object-fit:cover;border-radius:50%;margin-top:2px;" alt="머니냥">`;
}

// ── 타이핑 말풍선용 이미지 HTML (로딩 중) ──
function getNyangTypingAvatarHtml() {
  return getNyangAvatarHtml(NYANG_EMOJI.생각중);
}
