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
// ★ Fix #44: 튜토리얼 진행 중 여부 플래그. renderStep()이 step.page로 showPage()를
//   호출하면 renderCalendar()가 재실행되며 initTutorial()도 같이 트리거되는데,
//   이때 이미 removeAll()로 오버레이가 지워진 뒤라 DOM 존재 체크로는 막을 수 없어
//   별도 플래그로 "진행 중" 상태를 추적함(2026-06-20).
let _tutorialActive   = false;
// ★ Fix #52: "다시 보지 않기"를 체크하지 않고 튜토리얼을 끝내거나 건너뛰면, 같은 세션
//   안에서 탭/페이지 이동(renderCalendar→initTutorial())마다 시작 프롬프트가 계속 다시
//   떠서 "방금 끝냈는데 왜 또?"라는 혼란을 줌. localStorage 영구 플래그(다음 실행 시
//   재노출 여부)와는 별도로, "이번 세션에 이미 한 번 보여줬다"는 세션 한정 플래그를 둬서
//   최초 1회 흐름만 유지(2026-06-20). 설정의 "튜토리얼 다시보기"는 이 플래그와 무관하게 항상 동작.
let _tutorialShownThisSession = false;

// ════════════════════════════════════════════════════════
// 단계 정의 (총 10개 항목 → 표시 9단계, 2-1은 2단계 연장)
// ════════════════════════════════════════════════════════
// ★ 2026-06-20 콘텐츠 압축: 9단계(약 3분47초 소요 실측) → 5단계로 축소.
//   제거: 환영 단계(진입 프롬프트가 이미 환영 역할), 직장인 팝업 데모(가장 길고
//   인터랙션 대기시간까지 더해져 비효율적), SAO 메뉴 단계, 피드백 단계.
//   각 단계는 문단형 설명 대신 1~2문장으로 압축해 1분 이내 완료를 목표로 함.
//   모두 type:'info'로 단순화(인터랙티브 날짜클릭/데모팝업 단계 제거) —
//   renderInteractStep()/renderDemoPopup()/attachDateClickListener()는 더 이상
//   호출되지 않지만 코드는 그대로 보존(향후 복원 가능하도록 삭제하지 않음).
const TUTORIAL_STEPS = [
  // 1단계 — 직업 선택
  {
    step: 1, icon: '🔄', type: 'info',
    title: '직업 유형 선택',
    desc: `직업 유형에 맞춰 이번 달 예상 수입을 계산해드려요.`,
    highlight: null, page: null,
  },
  // 2단계 — 날짜 입력
  {
    step: 2, icon: '📅', type: 'info',
    title: '근무 기록하기',
    desc: `날짜를 탭해 출퇴근을 기록하세요.<br>기록할수록 이번 달 받을 돈이 더 정확하게 계산돼요.`,
    highlight: null, page: 'att',
  },
  // 3단계 — 예상 실수령액
  {
    step: 3, icon: '💰', type: 'info',
    title: '수입 확인하기',
    desc: `기록한 근무를 바탕으로 예상 실수령액을 자동 계산해드려요.<br>4대보험·세금·수당까지 반영돼요.`,
    highlight: 'btn-sal', page: 'sal',
  },
  // 4단계 — 생존관리
  {
    step: 4, icon: '🛡️', type: 'info',
    title: '이번 달 버틸 수 있나요?',
    desc: `수입과 지출을 비교해 다음 월급날까지 잔고가 버티는지 알 수 있어요.<br>이게 머니냥의 핵심 기능이에요.`,
    highlight: 'btn-budget', page: 'budget',
  },
  // 5단계 — 설정
  {
    step: 5, icon: '⚙️', type: 'info',
    title: '설정',
    desc: `백업, 복원, 직업 변경, 튜토리얼 다시보기를 사용할 수 있습니다.<br>자세한 사용법은 설정 → 사용설명서에서 확인할 수 있습니다.`,
    highlight: null, page: null,
  },
];

const TOTAL_DISPLAY = 5;

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
  // ★ Fix #44: 튜토리얼이 이미 진행 중이면 재실행 안 함(아래 _tutorialActive 선언부 참고)
  if (_tutorialActive) return;
  // ★ Fix #52: 이번 세션에 이미 한 번 보여줬으면(완료/건너뛰기 불문) 탭 이동 등으로
  //   다시 트리거되어도 재노출하지 않음 — 신규 사용자 최초 1회 흐름만 유지
  if (_tutorialShownThisSession) return;
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
  _tutorialShownThisSession = true;
  const ov = makeOverlay('tutorial-prompt-overlay', 'center');
  ov.innerHTML = [
    '<div class="tut-card" style="text-align:center;max-width:400px;">',
    '<div style="font-size:68px;margin-bottom:14px;">🐱</div>',
    '<h2 class="tut-h2">머니냥 처음이신가요?</h2>',
    '<p class="tut-p" style="margin-bottom:28px;">',
    '이번 달 받을 돈과,<br>월급날까지 버틸 수 있는지<br>미리 알아보는 법을 알려드릴게요!<br>',
    '<span style="font-size:17px;">(약 1분 소요)</span>',
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
window.skipTutorial  = function() { removeAll(); markTutorialDone(); _tutorialActive = false; };
window.startTutorial = function() { removeAll(); _tutorialIndex = 0; _tutorialActive = true; renderStep(); };

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
  _tutorialActive = false;
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
  _tutorialActive = false;
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
    pos === 'bottom' ? 'padding:0;' : 'padding:16px;-webkit-backdrop-filter:blur(5px);backdrop-filter:blur(5px);',
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
