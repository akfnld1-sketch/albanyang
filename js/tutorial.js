// ════════════════════════════════════════════════════════
// 머니냥 튜토리얼 시스템 v2.0
// 파일: js/tutorial.js
// 9단계 완성 + 날짜 클릭 체험 + 직장인 팝업 시뮬레이션
// ════════════════════════════════════════════════════════

const TUTORIAL_KEY     = 'moneynyang_tutorial_done';
const TUTORIAL_VERSION = '2';

let _tutorialIndex    = 0;
let _noShowChecked    = false;
let _waitingDateClick = false;

// ════════════════════════════════════════════════════════
// 단계 정의 (총 10개 항목 → 표시 9단계, 2-1은 2단계 연장)
// ════════════════════════════════════════════════════════
const TUTORIAL_STEPS = [
  // 1단계
  {
    step: 1, icon: '🐱', type: 'info',
    title: '머니냥에 오신 걸 환영해요!',
    desc: `<b>머니냥</b>은 직장인·알바생·N잡러를 위한<br>
<span style="color:var(--accent,#4f7cff)"><b>수입 · 근태 · 가계부</b></span> 올인원 관리 앱이에요.<br><br>
✅ 출퇴근·급여 자동계산<br>
✅ 알바·배달·프리랜서 수입관리<br>
✅ 가계부 & 연간 수입 분석<br><br>
지금부터 주요 기능을 하나씩 안내해 드릴게요 😊`,
    highlight: null, page: null,
  },
  // 2단계 — 날짜 클릭 유도
  {
    step: 2, icon: '📅', type: 'interact',
    title: '근태관리 — 날짜를 직접 눌러보세요!',
    desc: `<b>근태관리</b> 탭이 열렸어요.<br><br>
출퇴근 시간, 연차·반차·결근·조퇴를<br>날짜별로 기록할 수 있어요.<br><br>
<span style="font-size:17px;color:var(--text3,#aaa);">
💡 지금은 직장인 모드예요.<br>직종은 설정에서 언제든 바꿀 수 있어요!
</span>`,
    highlight: null, page: 'att',
    waitEvent: 'dateClick',
  },
  // 2-1단계 — 직장인 팝업 시뮬레이션
  {
    step: '2-1', icon: '🏢', type: 'demo',
    title: '직장인 출결 팝업이 열렸어요!',
    desc: `날짜를 누르면 이런 팝업이 열려요.<br><br>
📌 <b>입력 가능한 항목</b><br>
• <b>출근 시간</b> — 실제 출근 시각<br>
• <b>퇴근 시간</b> — 실제 퇴근 시각<br>
• <b>연차</b> — 유급휴가 1일 사용<br>
• <b>반차</b> — 오전/오후 반일 휴가<br>
• <b>결근</b> — 무단 불참 처리<br>
• <b>조퇴</b> — 중도 퇴근 기록<br><br>
OT·야간수당이 <span style="color:var(--accent,#4f7cff)"><b>자동 계산</b></span>돼요!`,
    highlight: null, page: null,
    showDemoPopup: true,
  },
  // 3단계
  {
    step: 3, icon: '💰', type: 'info',
    title: '수입관리 — 이번 달 얼마 벌었나요?',
    desc: `<b>수입관리</b> 탭에서 이번 달 급여를 확인해요.<br><br>
📊 <b>자동으로 보여주는 것들</b><br>
• 시급 × 근무시간 = 예상 급여<br>
• 야근수당 · OT 포함 자동 계산<br>
• 3.3% 세금 자동 공제 (프리랜서)<br><br>
수입을 직접 입력하거나<br>자동 집계 결과를 바로 확인하세요 💸`,
    highlight: 'btn-sal', page: 'sal',
  },
  // 4단계
  {
    step: 4, icon: '📊', type: 'info',
    title: '대시보드 — 연간 수입 한눈에!',
    desc: `<b>대시보드(연간요약)</b>에서<br>월별 · 연간 수입을 한눈에 봐요.<br><br>
📈 <b>확인할 수 있는 것들</b><br>
• 월별 수입 그래프<br>
• 연간 누적 수입 합계<br>
• 직종별 수입 비교<br><br>
꾸준히 기록할수록<br>내 수입 패턴이 보여요! 🎯`,
    highlight: 'btn-dash', page: 'dash',
  },
  // 5단계
  {
    step: 5, icon: '📒', type: 'info',
    title: '생존관리 — 가계부로 지출 파악!',
    desc: `<b>생존관리(가계부)</b> 탭에서<br>매일 쓴 돈을 기록해요.<br><br>
🛒 <b>지출 카테고리</b><br>
• 식비 · 교통 · 쇼핑 · 문화<br>
• 월세 · 보험 · 통신비 등<br>
• 나만의 항목 직접 추가 가능<br><br>
수입 - 지출 = <span style="color:var(--green,#3dd68c)"><b>실제 남는 돈</b></span><br>
매달 얼마나 모으는지 확인하세요 💡`,
    highlight: 'btn-budget', page: 'budget',
  },
  // 6단계
  {
    step: 6, icon: '🔄', type: 'info',
    title: '직업 변경 — 내 직종에 맞게 설정!',
    desc: `직종에 따라 앱 화면이 달라져요.<br><br>
👔 <b>선택 가능한 직종</b><br>
• 직장인 — 출퇴근·OT·연차<br>
• 알바 — 시급 × 근무시간<br>
• 배달/대리 — 건당 수입 합산<br>
• 프리랜서 — 프로젝트 단가<br>
• 추가수입 — 보험금·지원금 등<br><br>
💡 여러 직종을 <b>동시에 선택</b>할 수 있어요!<br>
설정 → <b>직업 변경</b>에서 바꿔보세요`,
    highlight: null, page: 'att',
  },
  // 7단계
  {
    step: 7, icon: '☰', type: 'info',
    title: 'SAO 메뉴 — 오른쪽에서 쓸어보세요!',
    desc: `화면 오른쪽 <b>☰ 버튼</b>을 누르거나<br>
오른쪽 가장자리에서 왼쪽으로 <b>쓸면</b><br>
빠른 메뉴가 열려요.<br><br>
⚡ <b>SAO 메뉴 기능</b><br>
• 직업 변경 바로가기<br>
• 이달 급여 빠른 확인<br>
• 설정 바로가기<br>
• 오늘 날짜 바로가기<br><br>
📱 <span style="color:var(--accent,#4f7cff)"><b>오른쪽 끝에서 왼쪽으로 쓸어보세요!</b></span>`,
    highlight: 'sao-handle', page: null,
  },
  // 8단계
  {
    step: 8, icon: '⚙️', type: 'info',
    title: '설정 — 내 정보를 입력해요',
    desc: `<b>설정</b>에서 기본 정보를 입력하면<br>자동계산이 훨씬 정확해져요.<br><br>
✏️ <b>설정 항목</b><br>
• 내 이름 (앱에 표시됨)<br>
• 시급 / 기본급<br>
• 근무 요일 · 시간<br>
• 직종 변경<br>
• 📖 튜토리얼 다시보기<br><br>
💡 설정은 언제든지 수정할 수 있어요.<br>
지금 바로 내 시급을 입력해 보세요! 😊`,
    highlight: null, page: null,
  },
  // 9단계
  {
    step: 9, icon: '💌', type: 'info',
    title: '피드백 & 문의 안내',
    desc: `사용하다 불편한 점이 있으면<br>언제든지 알려주세요!<br><br>
📬 <b>문의 방법</b><br>
• 앱 내 <b>피드백 보내기</b> 버튼<br>
• 카카오톡 채널 문의<br>
• 이메일 문의<br><br>
🎁 <b>버그 제보 · 기능 제안</b>은<br>
앱 발전에 큰 도움이 돼요!<br><br>
<span style="color:var(--accent,#4f7cff);font-weight:800;">
이제 머니냥을 시작해봐요 🐱💰
</span>`,
    highlight: null, page: null,
  },
];

const TOTAL_DISPLAY = 9;

// ════════════════════════════════════════════════════════
// 공개 API
// ════════════════════════════════════════════════════════
function shouldShowTutorial() {
  try { return localStorage.getItem(TUTORIAL_KEY) !== TUTORIAL_VERSION; }
  catch(e) { return true; }
}
function markTutorialDone() {
  try { localStorage.setItem(TUTORIAL_KEY, TUTORIAL_VERSION); } catch(e) {}
}

window.initTutorial = function() {
  // 구버전 key(moneynyang_tut_done)도 완료 처리된 경우 마이그레이션
  try {
    if (localStorage.getItem('moneynyang_tut_done') === '1') {
      localStorage.setItem(TUTORIAL_KEY, TUTORIAL_VERSION);
    }
  } catch(e) {}
  if (!shouldShowTutorial()) return;
  // ★ 구버전 4단계 온보딩 모달(atm2_onboarding_done)은 현재 코드 경로상 정상적으로
  //   열리지 않는 죽은 의존성이었음(obOpen()이 showJobTypeSelector(true)로 리다이렉트됨,
  //   2026-06-20 분석으로 확정) — 직업선택 완료(atm2_selectedJobs) 기준으로 게이트 변경.
  try {
    var jobs = localStorage.getItem('atm2_selectedJobs');
    if (!jobs || JSON.parse(jobs).length === 0) return;
  } catch(e) { return; }
  injectCSS();
  showTutorialPrompt();
};

window.reopenTutorial = function() {
  _noShowChecked = false;
  _tutorialIndex = 0;
  injectCSS();
  showTutorialPrompt();
};

// ════════════════════════════════════════════════════════
// 진입 팝업
// ════════════════════════════════════════════════════════
function showTutorialPrompt() {
  removeAll();
  const ov = makeOverlay('tutorial-prompt-overlay', 'center');
  ov.innerHTML = [
    '<div class="tut-card" style="text-align:center;max-width:400px;">',
    '<div style="font-size:68px;margin-bottom:14px;">🐱</div>',
    '<h2 class="tut-h2">머니냥 처음이신가요?</h2>',
    '<p class="tut-p" style="margin-bottom:28px;">',
    '앱 사용법을 단계별로<br>안내해 드릴게요!<br>',
    '<span style="font-size:17px;">(약 2분 소요)</span>',
    '</p>',
    '<button class="tut-btn-primary" onclick="startTutorial()">👍 네, 알려주세요!</button>',
    '<button class="tut-btn-ghost" onclick="skipTutorial()" style="margin-top:12px;">괜찮아요, 혼자 할게요</button>',
    '</div>',
  ].join('');
  document.body.appendChild(ov);
}

// ★ 기존 버그: markTutorialDone()을 호출하지 않아, "괜찮아요" 선택 후에도
//   캘린더가 재렌더링될 때마다(날짜 클릭, 월 이동 등) 진입 프롬프트가 계속 다시 뜨던 문제를
//   발견·수정. "다시 보지 않기" 체크와 동일하게 완료 처리해 자동 재실행을 막음
//   (설정 → 튜토리얼 다시보기는 reopenTutorial()이 별도 경로라 계속 가능).
window.skipTutorial  = function() { removeAll(); markTutorialDone(); };
window.startTutorial = function() { removeAll(); _tutorialIndex = 0; renderStep(); };

// ════════════════════════════════════════════════════════
// 단계 렌더 라우터
// ════════════════════════════════════════════════════════
function renderStep() {
  removeAll();
  const step = TUTORIAL_STEPS[_tutorialIndex];
  if (!step) { showFinish(); return; }

  // 페이지 이동
  if (step.page && typeof showPage === 'function') {
    try { showPage(step.page); } catch(e) {}
  }

  if (step.waitEvent === 'dateClick') {
    renderInteractStep(step);
    return;
  }
  if (step.showDemoPopup) {
    renderDemoPopup(step);
    return;
  }
  renderInfoStep(step);
  if (step.highlight) highlightElement(step.highlight);
}

// ── 일반 설명 단계 ──
function renderInfoStep(step) {
  const idx    = _tutorialIndex;
  const total  = TUTORIAL_STEPS.length;
  const isLast = idx === total - 1;
  const disp   = getDisplayNum(idx);

  const ov = makeOverlay('tutorial-step-overlay', 'bottom');
  ov.innerHTML = [
    '<div class="tut-sheet">',
    closeBtn(),
    dotsBar(idx, total),
    '<div style="text-align:center;font-size:17px;color:var(--text3,#888);margin-bottom:14px;font-weight:600;">' + disp + ' / ' + TOTAL_DISPLAY + ' 단계</div>',
    '<div style="text-align:center;margin-bottom:16px;">',
    '<div style="font-size:52px;margin-bottom:8px;">' + step.icon + '</div>',
    '<h3 class="tut-h3">' + step.title + '</h3>',
    '</div>',
    '<div class="tut-desc">' + step.desc + '</div>',
    '<div style="display:flex;gap:10px;margin-top:8px;">',
    (idx > 0 ? '<button class="tut-btn-ghost tut-flex1" onclick="tutPrev()">← 이전</button>' : '<div style="flex:1"></div>'),
    '<button class="tut-btn-primary tut-flex2" onclick="tutNext()">' + (isLast ? '🎉 완료!' : '다음 →') + '</button>',
    '</div>',
    '<div style="text-align:center;margin-top:14px;"><button class="tut-link" onclick="closeTutorial()">튜토리얼 나중에 보기</button></div>',
    '</div>',
  ].join('');
  document.body.appendChild(ov);
}

// ── 2단계: 날짜 클릭 유도 (시트가 달력 클릭을 통과시킴) ──
function renderInteractStep(step) {
  const idx   = _tutorialIndex;
  const total = TUTORIAL_STEPS.length;
  const disp  = getDisplayNum(idx);

  _waitingDateClick = true;

  // 오늘 날짜 셀에 깜빡이는 화살표 표시
  var todayCell = document.querySelector('.cal-day[data-today="1"], .cal-day.today');
  if (!todayCell) todayCell = document.querySelectorAll('.cal-day')[15];
  if (todayCell) {
    todayCell.style.outline = '3px solid var(--accent,#4f7cff)';
    todayCell.style.outlineOffset = '2px';
    todayCell.style.borderRadius = '10px';
    todayCell.dataset.tutHighlight = '1';
  }

  const ov = makeOverlay('tutorial-step-overlay', 'bottom');
  // 오버레이 자체는 pointer-events:none → 달력 클릭 통과
  ov.style.pointerEvents = 'none';
  ov.style.background    = 'rgba(0,0,0,0)'; // 배경 투명

  ov.innerHTML = [
    '<div class="tut-sheet" style="pointer-events:all;">',
    closeBtn(),
    dotsBar(idx, total),
    '<div style="text-align:center;font-size:17px;color:var(--text3,#888);margin-bottom:14px;font-weight:600;">' + disp + ' / ' + TOTAL_DISPLAY + ' 단계</div>',
    '<div style="text-align:center;margin-bottom:14px;">',
    '<div style="font-size:48px;margin-bottom:6px;">' + step.icon + '</div>',
    '<h3 class="tut-h3">' + step.title + '</h3>',
    '</div>',
    '<div class="tut-desc">' + step.desc + '</div>',
    // 날짜 클릭 힌트 배너
    '<div style="margin-top:12px;padding:14px 18px;border-radius:14px;',
    'background:rgba(79,124,255,.18);border:2.5px solid var(--accent,#4f7cff);',
    'text-align:center;font-size:20px;font-weight:800;color:var(--accent,#4f7cff);',
    'animation:tutPulseText 1.4s ease-in-out infinite;">',
    '👆 위 달력에서 날짜 하나를 눌러주세요!',
    '</div>',
    '<div style="text-align:center;margin-top:14px;"><button class="tut-link" style="pointer-events:all;" onclick="closeTutorial()">튜토리얼 나중에 보기</button></div>',
    '</div>',
  ].join('');

  document.body.appendChild(ov);
  attachDateClickListener();
}

// ── 2-1단계: 직장인 팝업 시뮬레이션 ──
function renderDemoPopup(step) {
  const idx   = _tutorialIndex;
  const total = TUTORIAL_STEPS.length;

  const ov = makeOverlay('tutorial-step-overlay', 'center');

  const today = new Date();
  const dateStr = (today.getMonth()+1) + '월 ' + today.getDate() + '일 (' +
    ['일','월','화','수','목','금','토'][today.getDay()] + ')';

  const typeLabels = ['연차','반차','결근','조퇴','정상출근','OT'];
  const typeBtns = typeLabels.map(function(t, i) {
    var isSel = (i === 4);
    return [
      '<div style="padding:11px 6px;border-radius:10px;text-align:center;',
      'font-size:18px;font-weight:700;',
      'background:' + (isSel ? 'var(--accent,#4f7cff)' : 'rgba(255,255,255,.06)') + ';',
      'color:' + (isSel ? '#fff' : 'var(--text2,#ccc)') + ';',
      'border:1.5px solid ' + (isSel ? 'var(--accent,#4f7cff)' : 'rgba(255,255,255,.1)') + ';',
      '">' + t + '</div>',
    ].join('');
  }).join('');

  ov.innerHTML = [
    '<div style="width:100%;max-width:480px;padding:0 12px;display:flex;flex-direction:column;gap:12px;">',

    // ── 시뮬 팝업 ──
    '<div style="background:var(--surface,#1e2235);border:2px solid var(--accent,#4f7cff);',
    'border-radius:20px;padding:22px 18px 18px;position:relative;',
    'box-shadow:0 8px 32px rgba(79,124,255,.3);">',

    '<div style="position:absolute;top:-15px;left:50%;transform:translateX(-50%);',
    'background:var(--accent,#4f7cff);color:#fff;',
    'font-size:15px;font-weight:800;padding:4px 18px;border-radius:20px;">',
    '📋 직장인 출결 팝업 (예시)</div>',

    '<div style="text-align:center;margin-bottom:14px;">',
    '<div style="font-size:20px;font-weight:800;color:var(--text,#fff);">' + dateStr + '</div>',
    '</div>',

    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">',
    '<div class="demo-time-box"><div class="demo-label">🟢 출근</div><div class="demo-value">09:00</div></div>',
    '<div class="demo-time-box"><div class="demo-label">🔴 퇴근</div><div class="demo-value">18:30</div></div>',
    '</div>',

    '<div style="font-size:16px;font-weight:700;color:var(--text3,#aaa);margin-bottom:8px;">출결 유형 선택</div>',
    '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px;">' + typeBtns + '</div>',

    '<div style="background:rgba(61,214,140,.1);border:1px solid rgba(61,214,140,.3);',
    'border-radius:10px;padding:10px 14px;font-size:17px;',
    'color:var(--green,#3dd68c);font-weight:700;">',
    '⏱ 근무: 8.5시간 &nbsp;|&nbsp; OT: 0.5h 자동 반영',
    '</div></div>',

    // ── 튜토리얼 설명 카드 ──
    '<div class="tut-sheet" style="border-radius:20px;padding:20px 18px 18px;">',
    dotsBar(idx, total),
    '<div style="text-align:center;margin-bottom:10px;">',
    '<div style="font-size:44px;margin-bottom:6px;">' + step.icon + '</div>',
    '<h3 class="tut-h3">' + step.title + '</h3>',
    '</div>',
    '<div class="tut-desc" style="font-size:18px;">' + step.desc + '</div>',
    '<button class="tut-btn-primary" style="margin-top:14px;" onclick="tutNext()">다음 →</button>',
    '<div style="text-align:center;margin-top:12px;"><button class="tut-link" onclick="closeTutorial()">튜토리얼 나중에 보기</button></div>',
    '</div>',

    '</div>',
  ].join('');

  document.body.appendChild(ov);
}

// ════════════════════════════════════════════════════════
// 완료 화면
// ════════════════════════════════════════════════════════
function showFinish() {
  removeAll();
  _noShowChecked = false;
  const ov = makeOverlay('tutorial-step-overlay', 'center');
  ov.innerHTML = [
    '<div class="tut-card" style="text-align:center;max-width:400px;">',
    '<div style="font-size:72px;margin-bottom:14px;">🎉</div>',
    '<h2 class="tut-h2">튜토리얼 완료!</h2>',
    '<p class="tut-p" style="margin-bottom:24px;">',
    '이제 머니냥을 마음껏<br>사용할 준비가 됐어요 🐱💰<br>',
    '<span style="font-size:17px;">궁금한 건 설정 → 튜토리얼 다시보기</span>',
    '</p>',

    // 다시 보지 않기 체크박스
    '<div id="tut-noshow-box" onclick="toggleNoShow()" style="',
    'display:flex;align-items:center;gap:14px;cursor:pointer;',
    'background:rgba(255,255,255,.05);',
    'border:1.5px solid rgba(255,255,255,.12);',
    'border-radius:14px;padding:16px 20px;margin-bottom:20px;',
    'transition:all .2s;user-select:none;',
    '">',
    '<div id="tutorial-checkbox" style="',
    'width:30px;height:30px;border-radius:8px;flex-shrink:0;',
    'border:2.5px solid var(--accent,#4f7cff);background:transparent;',
    'display:flex;align-items:center;justify-content:center;',
    'font-size:20px;font-weight:800;color:#fff;transition:all .2s;',
    '"></div>',
    '<span style="font-size:19px;font-weight:600;color:var(--text2,#ccc);text-align:left;line-height:1.5;">',
    '다음에 앱을 열어도<br>다시 보지 않기',
    '</span>',
    '</div>',

    '<button class="tut-btn-primary" onclick="finishTutorial()">🚀 시작하기!</button>',
    '</div>',
  ].join('');
  document.body.appendChild(ov);
}

// ════════════════════════════════════════════════════════
// 날짜 클릭 인터셉터
// ════════════════════════════════════════════════════════
function attachDateClickListener() {
  document.addEventListener('click', onCalendarDateClick, { capture: true });
}

function onCalendarDateClick(e) {
  if (!_waitingDateClick) return;

  // 날짜 셀 판별 — .cal-day 가 머니냥 달력의 실제 셀 class
  var target = e.target.closest('.cal-day, .calendar-day, [data-date], .day-cell, .att-day');
  if (!target) return;

  // 빈 셀 / 다른 달 / 비활성 제외
  if (
    target.classList.contains('other-month') ||
    target.classList.contains('empty') ||
    target.classList.contains('disabled') ||
    (target.dataset.date !== undefined && target.dataset.date === '')
  ) return;

  _waitingDateClick = false;
  document.removeEventListener('click', onCalendarDateClick, { capture: true });

  // 오늘 날짜 하이라이트 제거
  document.querySelectorAll('.cal-day[data-tut-highlight]').forEach(function(el) {
    el.style.outline = '';
    el.style.outlineOffset = '';
    delete el.dataset.tutHighlight;
  });

  // 앱의 기존 날짜 클릭 팝업이 열리도록 약간 대기 후 다음 단계로
  setTimeout(function() {
    _tutorialIndex++; // 2-1 단계
    renderStep();
  }, 800);
}

// ════════════════════════════════════════════════════════
// 내비게이션
// ════════════════════════════════════════════════════════
window.tutNext = function() {
  removeHighlight();
  _tutorialIndex++;
  if (_tutorialIndex >= TUTORIAL_STEPS.length) { showFinish(); return; }
  renderStep();
};
window.tutPrev = function() {
  removeHighlight();
  if (_tutorialIndex > 0) _tutorialIndex--;
  renderStep();
};
window.closeTutorial = function() {
  _waitingDateClick = false;
  document.removeEventListener('click', onCalendarDateClick, { capture: true });
  document.querySelectorAll('.cal-day[data-tut-highlight]').forEach(function(el) {
    el.style.outline = '';
    el.style.outlineOffset = '';
    delete el.dataset.tutHighlight;
  });
  removeAll();
};
window.toggleNoShow = function() {
  _noShowChecked = !_noShowChecked;
  var box  = document.getElementById('tutorial-checkbox');
  var wrap = document.getElementById('tut-noshow-box');
  if (box) {
    box.textContent     = _noShowChecked ? '✓' : '';
    box.style.background = _noShowChecked ? 'var(--accent,#4f7cff)' : 'transparent';
  }
  if (wrap) {
    wrap.style.background  = _noShowChecked ? 'rgba(79,124,255,.12)' : 'rgba(255,255,255,.05)';
    wrap.style.borderColor = _noShowChecked ? 'var(--accent,#4f7cff)' : 'rgba(255,255,255,.12)';
  }
};
window.finishTutorial = function() {
  if (_noShowChecked) markTutorialDone();
  removeAll();
  if (typeof showToast === 'function') showToast('🐱 머니냥과 함께 시작해봐요!');
};

// ════════════════════════════════════════════════════════
// 유틸
// ════════════════════════════════════════════════════════
function getDisplayNum(idx) {
  var step = TUTORIAL_STEPS[idx];
  if (step.step === '2-1') return '2';
  return typeof step.step === 'number' ? step.step : idx + 1;
}

function makeOverlay(id, pos) {
  var ov = document.createElement('div');
  ov.id = id;
  var align = pos === 'bottom' ? 'flex-end' : 'center';
  ov.style.cssText = [
    'position:fixed;inset:0;',
    'background:rgba(0,0,0,' + (pos === 'bottom' ? '.5' : '.65') + ');',
    'display:flex;align-items:' + align + ';justify-content:center;',
    'z-index:99998;',
    pos === 'bottom' ? 'padding:0;' : 'padding:16px;backdrop-filter:blur(5px);',
    'overflow-y:auto;',
  ].join('');
  return ov;
}

function dotsBar(idx, total) {
  var dots = TUTORIAL_STEPS.map(function(_, i) {
    return '<div style="' +
      'width:' + (i === idx ? 26 : 8) + 'px;height:8px;border-radius:4px;transition:all .3s;' +
      'background:' + (i === idx ? 'var(--accent,#4f7cff)' : i < idx ? 'rgba(79,124,255,.4)' : 'rgba(255,255,255,.15)') +
      ';"></div>';
  }).join('');
  return '<div style="display:flex;gap:5px;justify-content:center;margin-bottom:14px;">' + dots + '</div>';
}

function closeBtn() {
  return '<button onclick="closeTutorial()" style="' +
    'position:absolute;top:14px;right:16px;' +
    'background:none;border:none;color:var(--text3,#888);' +
    'font-size:28px;cursor:pointer;line-height:1;padding:4px;z-index:1;">✕</button>';
}

function highlightElement(id) {
  removeHighlight();
  var el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  var r = el.getBoundingClientRect();
  var p = document.createElement('div');
  p.id = 'tutorial-highlight';
  p.style.cssText = [
    'position:fixed;',
    'top:' + (r.top - 6) + 'px;left:' + (r.left - 6) + 'px;',
    'width:' + (r.width + 12) + 'px;height:' + (r.height + 12) + 'px;',
    'border:3px solid var(--accent,#4f7cff);border-radius:10px;',
    'box-shadow:0 0 0 4px rgba(79,124,255,.3);',
    'pointer-events:none;z-index:99997;',
    'animation:tutorialPulse 1.2s ease-in-out infinite;',
  ].join('');
  document.body.appendChild(p);
}

function removeHighlight() {
  var h = document.getElementById('tutorial-highlight');
  if (h) h.remove();
}

function removeAll() {
  ['tutorial-prompt-overlay', 'tutorial-step-overlay', 'tutorial-highlight'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.remove();
  });
  _waitingDateClick = false;
  document.removeEventListener('click', onCalendarDateClick, { capture: true });
}

function injectCSS() {
  if (document.getElementById('tutorial-style')) return;
  var s = document.createElement('style');
  s.id = 'tutorial-style';
  s.textContent = [
    '.tut-card{',
    'background:var(--surface,#1e2235);',
    'border:1px solid var(--border,rgba(255,255,255,.1));',
    'border-radius:24px;padding:36px 24px;width:100%;',
    'box-shadow:0 24px 64px rgba(0,0,0,.5);}',

    '.tut-sheet{',
    'background:var(--surface,#1e2235);',
    'border:1px solid var(--border,rgba(255,255,255,.1));',
    'border-radius:24px 24px 0 0;',
    'padding:26px 22px 34px;width:100%;max-width:520px;',
    'box-shadow:0 -12px 48px rgba(0,0,0,.4);position:relative;}',

    '.tut-h2{font-size:26px;font-weight:800;margin:0 0 10px;color:var(--text,#fff);line-height:1.3;}',
    '.tut-h3{font-size:23px;font-weight:800;color:var(--text,#fff);margin:0;line-height:1.3;}',
    '.tut-p{font-size:19px;color:var(--text3,#aaa);line-height:1.75;margin:0;}',

    '.tut-desc{',
    'font-size:19px;line-height:1.85;color:var(--text2,#ccc);',
    'background:rgba(255,255,255,.04);',
    'border-radius:14px;padding:16px 18px;',
    'border:1px solid rgba(255,255,255,.07);margin-bottom:8px;}',

    '.tut-btn-primary{',
    'display:block;width:100%;padding:15px;border-radius:13px;border:none;',
    'background:var(--accent,#4f7cff);color:#fff;',
    'font-size:21px;font-weight:800;cursor:pointer;',
    "font-family:'Noto Sans KR',sans-serif;",
    'box-shadow:0 4px 18px rgba(79,124,255,.4);transition:transform .15s;}',
    '.tut-btn-primary:active{transform:scale(.97);}',

    '.tut-btn-ghost{',
    'display:block;width:100%;padding:13px;border-radius:13px;',
    'border:1px solid rgba(255,255,255,.15);background:transparent;',
    'color:var(--text2,#ccc);font-size:19px;font-weight:600;cursor:pointer;',
    "font-family:'Noto Sans KR',sans-serif;transition:background .15s;}",
    '.tut-btn-ghost:active{background:rgba(255,255,255,.07);}',

    '.tut-link{',
    'background:none;border:none;color:var(--text3,#777);',
    'font-size:17px;cursor:pointer;',
    "font-family:'Noto Sans KR',sans-serif;text-decoration:underline;}",

    '.tut-flex1{flex:1;}',
    '.tut-flex2{flex:2;}',

    '.demo-time-box{',
    'background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);',
    'border-radius:12px;padding:12px;text-align:center;}',
    '.demo-label{font-size:15px;color:var(--text3,#aaa);margin-bottom:4px;font-weight:600;}',
    '.demo-value{font-size:24px;font-weight:800;color:var(--text,#fff);}',

    '@keyframes tutorialPulse{',
    '0%,100%{box-shadow:0 0 0 4px rgba(79,124,255,.3);}',
    '50%{box-shadow:0 0 0 12px rgba(79,124,255,.06);}}',

    '@keyframes tutPulseText{',
    '0%,100%{opacity:1;}',
    '50%{opacity:.55;}}',
  ].join('');
  document.head.appendChild(s);
}

// 로드 즉시 CSS 주입
injectCSS();
// ════════════════════════════════════════════════════════
