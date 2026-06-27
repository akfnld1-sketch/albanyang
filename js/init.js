// ══════════════════════════════════════════
// 숫자 천단위 쉼표 — 전역 ko-KR 기본값 설정
// 11651.71 → 11,651.71 (소수점 포함 모든 숫자)
// ══════════════════════════════════════════
(function(){
  const _orig = Number.prototype.toLocaleString;
  Number.prototype.toLocaleString = function(locale, opts){
    if(locale === undefined){
      const n = Number(this);
      if(!Number.isInteger(n)){
        const dec = (n.toString().split('.')[1]||'').length;
        return _orig.call(this, 'ko-KR', {
          minimumFractionDigits: dec,
          maximumFractionDigits: dec
        });
      }
      return _orig.call(this, 'ko-KR');
    }
    return _orig.call(this, locale, opts);
  };
})();

// ★ 오늘 날짜 칸 자동 스크롤 제거 — 캘린더 첫 진입 시 메인 지표("예상 실수령액" 카드)가
//   화면 밖으로 밀려나는 문제가 있어 제거함. 오늘 칸은 .cal-day.today 클래스의 테두리
//   강조(css/main.css)로 스크롤 없이도 충분히 식별 가능하므로 하이라이트는 그대로 유지됨.

try { bgIdx = parseInt(localStorage.getItem('atm2_bgIdx')||'0')||0; } catch(e){}
applyBg(bgIdx, false);

function applyBg(idx, animate){
  const c = BG_COLORS[idx];
  const isDark = c.dark;
  const root = document.documentElement;

  // ★ data-theme으로 전환 — inline style이 [data-theme="dark"] 셀렉터를 덮어쓰는 문제 해결
  root.setAttribute('data-theme', isDark ? 'dark' : 'light');

  // 배경색만 직접 설정 (팔레트별 고유 배경)
  document.body.style.background = c.bg;
  document.body.style.color = '';  // CSS 변수로 제어

  // 기존 inline style 오버라이드 전부 제거 (충돌 방지)
  const cssVars = ['--surface','--surface2','--surface3','--border',
    '--text','--text2','--text3','--accent','--accent2',
    '--green','--yellow','--red','--cyan','--orange','--sat','--sun'];
  cssVars.forEach(v => root.style.removeProperty(v));

  // 사이드바·배너 inline style도 제거 (CSS 변수로 자동 반영)
  const sidebar = document.getElementById('sidebar');
  const banner  = document.getElementById('banner');
  if(sidebar){ sidebar.style.background=''; sidebar.style.borderRightColor=''; }
  if(banner) { banner.style.background='';  banner.style.borderBottomColor=''; }

  const ci = document.getElementById('company-input');
  if(ci) ci.style.color = '';

  if(animate) showBgToast(c.name, isDark);
  try { localStorage.setItem('atm2_bgIdx', idx); } catch(e){}
}

function showBgToast(name, isDark){
  let t = document.getElementById('bg-toast');
  if(!t){
    t = document.createElement('div');
    t.id = 'bg-toast';
    t.style.cssText = `
      position:fixed; bottom:24px; left:50%; transform:translateX(-50%);
      -webkit-backdrop-filter:blur(12px); backdrop-filter:blur(12px); border-radius:20px;
      padding:8px 20px; font-size:17px; font-weight:600;
      pointer-events:none; z-index:9999; opacity:0;
      transition:opacity .3s ease; white-space:nowrap;
    `;
    document.body.appendChild(t);
  }
  if(isDark){
    t.style.background = 'rgba(255,255,255,.13)';
    t.style.border     = '1px solid rgba(255,255,255,.2)';
    t.style.color      = '#fff';
  } else {
    t.style.background = 'rgba(0,0,0,.12)';
    t.style.border     = '1px solid rgba(0,0,0,.18)';
    t.style.color      = '#1a1a2e';
  }
  t.textContent = '🎨 ' + name;
  t.style.opacity = '1';
  clearTimeout(t._timer);
  t._timer = setTimeout(()=>{ t.style.opacity='0'; }, 1400);
}

// 배경색 탭 변경 기능 비활성화 (설정에서 수동 변경)
function toggleBgChange(){ /* 미사용 */ }

// ── 배경색 팔레트 렌더링 ──
function renderBgPalette(){
  const pal = document.getElementById('bg-palette');
  const nameEl = document.getElementById('bg-cur-name');
  if(!pal) return;
  pal.innerHTML = '';
  BG_COLORS.forEach((c, i) => {
    const btn = document.createElement('button');
    btn.title = c.name;
    btn.style.cssText = `width:100%;aspect-ratio:1;border-radius:6px;border:2px solid ${i===bgIdx?'var(--accent)':'var(--border)'};background:${c.bg};cursor:pointer;transition:border-color .15s;`;
    btn.onclick = () => {
      bgIdx = i;
      applyBg(i, true);
      renderBgPalette();
    };
    pal.appendChild(btn);
  });
  if(nameEl) nameEl.textContent = '현재: ' + BG_COLORS[bgIdx].name;
}

// ── 근무시간 커스텀 설정 ──
// 기본값 (2교대 12시간, 3교대 8시간)
let customShift = {
  day: { start: 9, end: 18 },
  night: { start: 22, end: 6 },
  shift2day: { start: 8, end: 20 },
  shift2night: { start: 20, end: 8 },
  shift3a: { start: 6, end: 14 },
  shift3b: { start: 14, end: 22 },
  shift3c: { start: 22, end: 6 }
};

function buildHourOpts(selId, curVal){
  const sel = document.getElementById(selId);
  if(!sel) return;
  sel.innerHTML = '';
  for(let h=0;h<24;h++){
    const opt = document.createElement('option');
    opt.value = h;
    opt.textContent = (h<10?'0':'')+h+':00';
    if(h === curVal) opt.selected = true;
    sel.appendChild(opt);
  }
}

function initCustomShiftSelects(){
  // 로컬스토리지에서 불러오기
  try {
    const saved = localStorage.getItem('atm2_customShift');
    if(saved) customShift = Object.assign(customShift, JSON.parse(saved));
  } catch(e){}
  buildHourOpts('custom-day-start', customShift.day.start);
  buildHourOpts('custom-day-end', customShift.day.end);
  buildHourOpts('custom-night-start', customShift.night.start);
  buildHourOpts('custom-night-end', customShift.night.end);
  buildHourOpts('custom-2shift-day-start', customShift.shift2day.start);
  buildHourOpts('custom-2shift-day-end', customShift.shift2day.end);
  buildHourOpts('custom-2shift-night-start', customShift.shift2night.start);
  buildHourOpts('custom-2shift-night-end', customShift.shift2night.end);
  buildHourOpts('custom-3a-start', customShift.shift3a.start);
  buildHourOpts('custom-3a-end', customShift.shift3a.end);
  buildHourOpts('custom-3b-start', customShift.shift3b.start);
  buildHourOpts('custom-3b-end', customShift.shift3b.end);
  buildHourOpts('custom-3c-start', customShift.shift3c.start);
  buildHourOpts('custom-3c-end', customShift.shift3c.end);
}

function updateCustomShift(){
  const g = id => { const el = document.getElementById(id); return el ? parseInt(el.value) : 0; };
  customShift.day         = { start: g('custom-day-start'),          end: g('custom-day-end')          };
  customShift.night       = { start: g('custom-night-start'),        end: g('custom-night-end')        };
  customShift.shift2day   = { start: g('custom-2shift-day-start'),   end: g('custom-2shift-day-end')   };
  customShift.shift2night = { start: g('custom-2shift-night-start'), end: g('custom-2shift-night-end') };
  customShift.shift3a     = { start: g('custom-3a-start'),           end: g('custom-3a-end')           };
  customShift.shift3b     = { start: g('custom-3b-start'),           end: g('custom-3b-end')           };
  customShift.shift3c     = { start: g('custom-3c-start'),           end: g('custom-3c-end')           };
  // 기존 변수에 반영
  dayStart   = customShift.day.start;
  nightStart = customShift.night.start;
  // 2교대 시간 반영
  if(typeof SHIFT2 !== 'undefined'){
    SHIFT2.day   = { s: customShift.shift2day.start,   e: customShift.shift2day.end   };
    SHIFT2.night = { s: customShift.shift2night.start, e: customShift.shift2night.end };
  }
  SHIFT3.A = { s: customShift.shift3a.start, e: customShift.shift3a.end };
  SHIFT3.B = { s: customShift.shift3b.start, e: customShift.shift3b.end };
  SHIFT3.C = { s: customShift.shift3c.start, e: customShift.shift3c.end };
  try { localStorage.setItem('atm2_customShift', JSON.stringify(customShift)); } catch(e){}
  updateLegend();
  renderCalendar();
  showToast('⏱ 근무시간 설정 저장됨');
}

function resetCustomShift(){
  customShift = {
    day: { start: 9, end: 18 },
    night: { start: 22, end: 6 },
    shift2day: { start: 8, end: 20 },
    shift2night: { start: 20, end: 8 },
    shift3a: { start: 6, end: 14 },
    shift3b: { start: 14, end: 22 },
    shift3c: { start: 22, end: 6 }
  };
  try { localStorage.removeItem('atm2_customShift'); } catch(e){}
  initCustomShiftSelects();
  updateCustomShift();
}

// ── 초기화 ──
(function(){
  renderBgPalette();
  initCustomShiftSelects();
})();


const asstBtnEl = document.getElementById('asst-btn');

// ── 출근/퇴근 버튼 함수 (실시간 한국 표준시) ──
function nowKSTStr(){
  // 한국 표준시 (UTC+9)
  const now = new Date();
  const kst = new Date(now.getTime() + (9*60 - now.getTimezoneOffset())*60000);
  const h = kst.getUTCHours();
  const m = kst.getUTCMinutes();
  return String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0');
}

function manualRecordAttendance(){
  const today = new Date();
  const y = today.getFullYear();
  const mo = today.getMonth();
  const d = today.getDate();
  if(y !== curY || mo !== curM){ curY=y; curM=mo; renderCalendar(); }
  const key = `${y}-${String(mo+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  if(dayData[key] && dayData[key].status === 'work' && dayData[key].start){
    if(!asstOpen) toggleAsst();
    addBotMsg(`오늘(${d}일)은 이미 출근(${(typeof fmtTime==='function')?fmtTime(dayData[key].start):dayData[key].start})이 기록되어 있어요! 🐱\n변경하려면 달력에서 날짜를 클릭해주세요.`);
    return;
  }
  const startTime = nowKSTStr();
  const [startH, startM] = startTime.split(':').map(Number);
  const startNum = startH + startM/60;
  const endNum = startNum + 8;
  const endH = Math.floor(endNum); const endM2 = Math.round((endNum-endH)*60);
  const endTime = String(endH).padStart(2,'0')+':'+String(endM2).padStart(2,'0');
  if(!dayData[key]) dayData[key]={};
  // ★ 캘린더 표준 형식(숫자, fmtTime()이 기대하는 형태)으로 저장 — 문자열로 저장하면
  //   캘린더 렌더링에서 NaN:NaN으로 표시되는 버그가 있었음(timeStrToNum 미정의 버그와 함께 발견·수정)
  dayData[key].status='work'; dayData[key].start=startNum; dayData[key].end=endNum;
  lsSave(); renderCalendar();
  if(!asstOpen) toggleAsst();
  addBotMsg(`✅ ${mo+1}월 ${d}일 출근 완료! 🐱\n⏰ 출근 시각: ${startTime}\n🏁 퇴근 예정: ${endTime} (자동 +8h)\n퇴근 시 퇴근 버튼을 눌러주세요!\n정확한 시간은 캘린더에서 수정할 수 있어요`);
}

function manualRecordLeave(){
  const today = new Date();
  const y = today.getFullYear();
  const mo = today.getMonth();
  const d = today.getDate();
  if(y !== curY || mo !== curM){ curY=y; curM=mo; renderCalendar(); }
  const key = `${y}-${String(mo+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  if(!dayData[key] || dayData[key].status !== 'work'){
    if(!asstOpen) toggleAsst();
    addBotMsg(`오늘(${d}일)에 출근 기록이 없어요! 🐱\n먼저 출근 버튼을 눌러주세요.`);
    return;
  }
  const leaveTime = nowKSTStr();
  const [leaveH, leaveM] = leaveTime.split(':').map(Number);
  dayData[key].end = leaveH + leaveM/60;
  lsSave(); renderCalendar();
  const startTime = (typeof fmtTime==='function') ? fmtTime(dayData[key].start) : '?';
  if(!asstOpen) toggleAsst();
  addBotMsg(`✅ ${mo+1}월 ${d}일 퇴근 완료! 🐱\n⏰ 출근: ${startTime} → 퇴근: ${leaveTime}\n오늘도 수고하셨어요! 🐾\n정확한 시간은 캘린더에서 수정할 수 있어요`);
}


// 머니냥 클릭 → 채팅 열기/닫기
if(asstBtnEl){
  asstBtnEl.addEventListener('click', ()=>{ toggleAsst(); });
}



// 페이지 로드 후 연차 정보 표시
(function(){
  if(hireDate){
    const hi = document.getElementById('hire-date-inp');
    if(hi) hi.value = hireDate;
    renderLeaveInfo();
  }
})();

// ══════════════════════════════════════════
// 첫 진입 — 직업유형 선택으로 대체
// (온보딩 슬라이드 제거됨)
// ══════════════════════════════════════════
var _obLsKey = 'atm2_onboarding_done'; // 하위호환 유지

// DOM 준비 후 이벤트 연결 및 자동 표시
// window.onload 사용 — 모든 스크립트 로드 완료 후 실행 보장
window.addEventListener('load', function(){

  // ── atm2_workType → wt 전역변수 동기화 ──
  try{
    var savedWT = localStorage.getItem('atm2_workType');
    if(savedWT && typeof wt !== 'undefined' && wt !== savedWT){
      wt = savedWT;
      if(typeof setWT === 'function') setWT(savedWT);
    }
    // atm2_workSubType → myShift3 동기화 (3교대)
    var savedSub = localStorage.getItem('atm2_workSubType');
    if(savedSub && savedWT === '3shift' && typeof myShift3 !== 'undefined'){
      if(['A','B','C'].indexOf(savedSub) >= 0) myShift3 = savedSub;
      else if(savedSub === 'day_fixed') myShift3 = 'A';
    }
    // atm2_workSubType → p2Sh 동기화 (2교대)
    if(savedSub && savedWT === '2shift' && typeof p2Sh !== 'undefined'){
      if(savedSub === 'day' || savedSub === 'night') p2Sh = savedSub;
      else if(savedSub === 'day_fixed') p2Sh = 'day';
    }
    // atm2_workSubType → p3Sh 동기화 (3교대)
    if(savedSub && savedWT === '3shift' && typeof p3Sh !== 'undefined'){
      if(['A','B','C'].indexOf(savedSub) >= 0) p3Sh = savedSub;
    }
    // 근무형태 뱃지 업데이트
    if(typeof updateWorkTypeBadge === 'function') updateWorkTypeBadge();
  }catch(e){}

  // ── 직업유형 첫 진입 체크 ──
  try{
    var jobs = localStorage.getItem('atm2_selectedJobs');
    var hasJobs = jobs && JSON.parse(jobs).length > 0;
    if(!hasJobs){
      setTimeout(function(){
        function proceedToJobSelect(){
          if(typeof showJobTypeSelector === 'function') showJobTypeSelector(true);
        }
        // ★ Fix #48: 직업선택 진입 전 화면 크기(일반/시니어) 선택 — 최초 1회만
        var uiModeSet = false;
        try{ uiModeSet = !!localStorage.getItem('atm2_uiMode'); }catch(e){}
        if(!uiModeSet && typeof showUiModeSelector === 'function'){
          showUiModeSelector(proceedToJobSelect);
        } else {
          proceedToJobSelect();
        }
      }, 300);
    } else {
      // 직업유형 있으면 UI 적용
      if(typeof applyJobTypeUI === 'function') applyJobTypeUI();
    }
  }catch(e){}
});

// 하위호환 — 온보딩 재열기 버튼이 있으면 직업유형으로 연결
function showOnboarding(){
  if(typeof showJobTypeSelector === 'function') showJobTypeSelector(true);
}
function obOpen(){
  if(typeof showJobTypeSelector === 'function') showJobTypeSelector(true);
}

// ══════════════════════════════════════════
// 설정 페이지
// ══════════════════════════════════════════
function renderSettingsPage(){
  const page = document.getElementById('settings-page');
  if(!page){ console.error('settings-page not found'); return; }

  const savedName    = localStorage.getItem('atm2_companyName') || '';
  const savedEmpName = localStorage.getItem('atm2_ob_empName')  || '';
  const savedWage    = localStorage.getItem('atm2_baseWage') || '10320';
  // ★ Fix #2: 전역 변수명은 'wt' (leave.js:4), 'workType'은 미정의
  const currentWT = typeof wt !== 'undefined' ? wt : localStorage.getItem('atm2_workType') || 'day';
  const currentAlarm = localStorage.getItem('atm2_alarmSound') || 'beep';
  const lunchVal = typeof lunchBreak !== 'undefined' ? lunchBreak : 1;

  // 근무형태별 시간/휴게 정보
  const wtInfo = {
    day: {
      label:'☀️ 주간고정근무', defaultTime:'09:00~18:00',
      breaks:[
        {id:'day_morning', label:'오전 휴식', default:15},
        {id:'day_lunch',   label:'점심시간', default:60},
        {id:'day_evening', label:'오후 휴식', default:15},
      ]
    },
    night: {
      label:'🌙 야간근무', defaultTime:'00:00~08:00',
      breaks:[
        {id:'night_morning', label:'오전 휴식', default:15},
        {id:'night_evening', label:'오후 휴식', default:15},
        {id:'night_snack',   label:'야식시간',  default:30},
      ]
    },
    '2shift': {
      label:'🔄 주야2교대', defaultTime:'주간 08:00~20:00 / 야간 20:00~08:00',
      breaks:[
        {id:'2s_day_morning', label:'[주간] 오전 휴식', default:15},
        {id:'2s_day_lunch',   label:'[주간] 점심시간', default:60},
        {id:'2s_day_evening', label:'[주간] 오후 휴식', default:15},
        {id:'2s_day_dinner',  label:'[주간] 저녁시간', default:30},
        {id:'2s_night_morning',label:'[야간] 오전 휴식',default:15},
        {id:'2s_night_evening',label:'[야간] 오후 휴식',default:15},
        {id:'2s_night_snack', label:'[야간] 야식시간',  default:30},
      ]
    },
    '3shift': {
      label:'⚙️ 주야3교대', defaultTime:'조간 07:00~15:00 / 석간 15:00~23:00 / 야간 23:00~07:00',
      breaks:[
        {id:'3s_a_morning', label:'[조간] 오전 휴식', default:15},
        {id:'3s_a_lunch',   label:'[조간] 점심시간', default:60},
        {id:'3s_a_evening', label:'[조간] 오후 휴식', default:15},
        {id:'3s_b_morning', label:'[석간] 오전 휴식', default:15},
        {id:'3s_b_evening', label:'[석간] 오후 휴식', default:15},
        {id:'3s_b_dinner',  label:'[석간] 저녁시간', default:30},
        {id:'3s_c_morning', label:'[야간] 오전 휴식', default:15},
        {id:'3s_c_evening', label:'[야간] 오후 휴식', default:15},
        {id:'3s_c_snack',   label:'[야간] 야식시간',  default:30},
      ]
    }
  };

  // 저장된 휴게시간 불러오기
  function getBreakVal(id, def){ 
    const v = localStorage.getItem('atm2_break_'+id);
    return v !== null ? parseInt(v) : def;
  }

  // 알람음 목록
  const alarmSounds = [
    {id:'beep',       label:'🔔 기본 비프음'},
    {id:'soft',       label:'🎵 부드러운 알림'},
    {id:'ding',       label:'🔔 딩동'},
    {id:'chime',      label:'🎶 차임벨'},
    {id:'bell',       label:'🔔 교회 종'},
    {id:'digital',    label:'📱 디지털 알림'},
    {id:'piano',      label:'🎹 피아노'},
    {id:'marimba',    label:'🎵 마림바'},
    {id:'glass',      label:'🥂 유리잔'},
    {id:'wood',       label:'🪘 나무 타악'},
    {id:'alert',      label:'⚠️ 경보음'},
    {id:'success',    label:'✅ 성공음'},
    {id:'notify',     label:'💬 카톡 스타일'},
    {id:'pop',        label:'🫧 팝'},
    {id:'tick',       label:'⏱️ 틱톡'},
    {id:'whistle',    label:'📯 휘파람'},
    {id:'horn',       label:'📣 호른'},
    {id:'xylophone',  label:'🎵 실로폰'},
    {id:'cuckoo',     label:'🕊️ 뻐꾸기'},
    {id:'rooster',    label:'🐓 닭 울음'},
  ];

  // ★ Fix #56: max-width를 인라인이 아니라 CSS(#settings-page > div)로 옮겨
  //   PC 미디어쿼리가 정상 적용되도록 함(2026-06-20). 모바일/태블릿 기본값(520px)은
  //   CSS 쪽에 그대로 정의해 시각적으로 동일하게 유지.
  let html = '<div style="padding:16px 20px 80px;margin:0 auto;">';
  html += '<h2 style="font-size:26px;font-weight:700;margin-bottom:16px;">⚙️ 설정</h2>';

  // ★ Fix #45: 설정 페이지 최상단에 사용설명서 버튼 — 신규 사용자 QA에서
  //   기존 위치(페이지 하단, 약 5스크롤 아래)는 거의 발견되지 않는 것으로 확인되어 이동(2026-06-20)
  html += `<button onclick="reopenTutorial()"
    style="width:100%;padding:12px;border-radius:8px;border:1px solid rgba(79,124,255,.3);
           background:rgba(79,124,255,.06);color:var(--accent);font-size:17px;font-weight:700;
           cursor:pointer;font-family:'Noto Sans KR';margin-bottom:8px;">🎯 앱 사용법 안내</button>`;
  html += `<button onclick="openManual()"
    style="width:100%;padding:12px;border-radius:8px;border:1px solid rgba(127,179,255,.3);
           background:rgba(127,179,255,.06);color:#7fb3ff;font-size:17px;font-weight:700;
           cursor:pointer;font-family:'Noto Sans KR';margin-bottom:8px;">📄 상세 설명서</button>`;

  // ★ Fix #49: 직업변경 버튼도 같은 발견성 문제(모바일에서 SAO메뉴 안에만 있어
  //   진입점이 거의 비가시 수준 — 멘토 1차 피드백 재검증에서 확인) — 설정 최상단에 추가(2026-06-20)
  html += `<button onclick="showJobTypeSelector(true)"
    style="width:100%;padding:12px;border-radius:8px;border:1px solid rgba(255,159,67,.3);
           background:rgba(255,159,67,.06);color:#ff9f43;font-size:17px;font-weight:700;
           cursor:pointer;font-family:'Noto Sans KR';margin-bottom:8px;">🛠️ 직업 설정 변경</button>`;

  // ★ Fix #49: 시니어모드 토글 — 페이지 하단(다크모드 자리)은 발견성 문제로 최상단 이동(2026-06-20)
  const seniorOn = isSeniorMode();
  html += `<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px 18px;margin-bottom:12px;">
    <div style="font-size:17px;font-weight:700;color:var(--text);margin-bottom:14px;">🔠 화면 크기</div>
    <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;">
      <div>
        <div style="font-size:17px;color:var(--text);">${seniorOn?'👴 시니어 모드':'👤 일반 모드'}</div>
        <div style="font-size:15px;color:var(--text3);">${seniorOn?'글자·버튼을 크게 표시 중':'기본 글자 크기로 표시 중'}</div>
      </div>
      <div onclick="toggleSeniorModeBtn(this)"
        id="senior-toggle-s"
        style="width:44px;height:24px;border-radius:12px;cursor:pointer;flex-shrink:0;
               background:${seniorOn?'var(--accent)':'var(--border)'};position:relative;transition:background .25s;">
        <span style="position:absolute;top:3px;left:${seniorOn?'22':'3'}px;width:18px;height:18px;border-radius:50%;
                     background:#fff;transition:left .25s;display:block;"></span>
      </div>
    </div>
  </div>`;

  // ── 기본 정보 ──
  const savedHireDate = hireDate || localStorage.getItem('atm2_hireDate') || '';
  // 연차 현황 미리 계산
  let leaveStatusHtml = '';
  if(savedHireDate){
    const al = (typeof calcAnnualLeave === 'function') ? calcAnnualLeave(savedHireDate) : null;
    if(al){
      const usedL = (typeof curY !== 'undefined') ? (() => {
        let u = 0;
        const dim = new Date(curY, curM+1, 0).getDate();
        for(let d=1;d<=dim;d++){
          const k = dk(curY,curM,d);
          const dd = dayData[k];
          if(!dd) continue;
          if(dd.status==='leave') u += 1;
          if(dd.status==='half')  u += 0.5;
        }
        return u;
      })() : 0;
      const totalL = (leaveOverride !== null && leaveOverride !== undefined) ? leaveOverride : al.totalLeave;
      const remainL = Math.max(0, totalL - usedL);
      leaveStatusHtml = `
        <div style="background:rgba(61,214,140,.08);border:1px solid rgba(61,214,140,.25);border-radius:8px;padding:10px 12px;margin-top:8px;">
          <div style="font-size:15px;font-weight:700;color:var(--green);margin-bottom:6px;">🌿 연차 현황</div>
          <div style="display:flex;gap:12px;flex-wrap:wrap;">
            <span style="font-size:16px;color:var(--text2);">총 연차 <b style="color:var(--text);">${totalL}일</b></span>
            <span style="font-size:16px;color:var(--text2);">이번달 사용 <b style="color:var(--red);">${usedL}일</b></span>
            <span style="font-size:16px;color:var(--text2);">잔여 <b style="color:var(--green);">${remainL}일</b></span>
          </div>
          ${al.nextInfo ? `<div style="font-size:15px;color:var(--text3);margin-top:4px;">📅 ${al.nextInfo}</div>` : ''}
        </div>`;
    }
  }

  const _roStyle = 'width:100%;background:var(--surface2);border:1px solid var(--border);color:var(--text3);border-radius:8px;padding:9px 12px;font-size:18px;font-family:\'Noto Sans KR\';outline:none;box-sizing:border-box;cursor:default;';
  const _rwStyle = 'width:100%;background:var(--surface2);border:1px solid var(--accent);color:var(--text);border-radius:8px;padding:9px 12px;font-size:18px;font-family:\'Noto Sans KR\';outline:none;box-sizing:border-box;';

  html += `<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px 18px;margin-bottom:12px;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
      <div style="font-size:17px;font-weight:700;color:var(--text);">📋 기본 정보</div>
      <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:14px;color:var(--accent);font-weight:600;">
        <input type="checkbox" id="set-basic-edit-toggle"
          onchange="toggleSettingsEdit(this.checked)"
          style="width:16px;height:16px;accent-color:var(--accent);cursor:pointer;">
        ✏️ 수정하기
      </label>
    </div>
    <div style="margin-bottom:10px;">
      <div style="font-size:16px;color:var(--text3);margin-bottom:5px;">사업장/회사명</div>
      <input id="set-company-name" type="text" value="${savedName}" placeholder="예: 주식회사 머니냥"
        readonly style="${_roStyle}">
    </div>
    <div style="margin-bottom:10px;">
      <div style="font-size:16px;color:var(--text3);margin-bottom:5px;">이름 (내 정보)</div>
      <input id="set-emp-name" type="text" value="${savedEmpName}" placeholder="예: 홍길동"
        readonly style="${_roStyle}">
    </div>
    <div style="margin-bottom:12px;">
      <div style="font-size:16px;color:var(--text3);margin-bottom:5px;">기본 시급 (원)</div>
      <input id="set-base-wage" type="number" value="${savedWage}" min="9860" step="10"
        readonly style="${_roStyle.replace('Noto Sans KR','JetBrains Mono')}">
      <div style="font-size:15px;color:var(--text3);margin-top:3px;">2026년 최저시급 10,320원</div>
    </div>
    <div style="margin-bottom:14px;">
      <div style="font-size:16px;color:var(--text3);margin-bottom:5px;">📅 입사일 <span style="font-size:14px;">(연차 자동 계산)</span></div>
      ${(()=>{
        const parts = savedHireDate ? savedHireDate.split('-') : ['','',''];
        const sy = parts[0]||'', sm = parts[1]||'', sd = parts[2]||'';
        const selStyle = `background:var(--surface2);border:1px solid var(--border);color:var(--text);
          border-radius:8px;padding:9px 8px;font-size:18px;font-family:'Noto Sans KR';
          outline:none;cursor:pointer;`;
        const nowY = new Date().getFullYear();
        const yOpts = `<option value="">년</option>` +
          Array.from({length:30},(_,i)=>nowY-i)
            .map(y=>`<option value="${y}" ${sy==y?'selected':''}>${y}년</option>`).join('');
        const mOpts = `<option value="">월</option>` +
          Array.from({length:12},(_,i)=>i+1)
            .map(m=>`<option value="${String(m).padStart(2,'0')}" ${sm==String(m).padStart(2,'0')?'selected':''}>${m}월</option>`).join('');
        const dOpts = `<option value="">일</option>` +
          Array.from({length:31},(_,i)=>i+1)
            .map(d=>`<option value="${String(d).padStart(2,'0')}" ${sd==String(d).padStart(2,'0')?'selected':''}>${d}일</option>`).join('');
        return `
        <div style="display:grid;grid-template-columns:2fr 1.2fr 1.2fr;gap:6px;margin-bottom:4px;">
          <select id="hire-y" style="${selStyle}" onchange="syncHireDate()">${yOpts}</select>
          <select id="hire-m" style="${selStyle}" onchange="syncHireDate()">${mOpts}</select>
          <select id="hire-d" style="${selStyle}" onchange="syncHireDate()">${dOpts}</select>
        </div>
        <input type="hidden" id="set-hire-date" value="${savedHireDate}">`;
      })()}
      ${leaveStatusHtml}
    </div>
    <button onclick="saveBasicSettings()"
      style="width:100%;padding:10px;border-radius:8px;border:none;background:var(--accent);
             color:#fff;font-size:17px;font-weight:700;cursor:pointer;font-family:'Noto Sans KR';">
      💾 저장</button>
  </div>`;

  // ── 근무 형태 선택 ──
  const wtBtns = Object.entries(wtInfo).map(([id, info]) => `
    <button onclick="setSettingsWT('${id}')" id="swt-${id}"
      style="padding:8px 10px;border-radius:8px;font-size:16px;font-weight:700;cursor:pointer;
             font-family:'Noto Sans KR';border:1.5px solid ${currentWT===id?'var(--accent)':'var(--border)'};
             background:${currentWT===id?'rgba(79,124,255,.1)':'var(--surface2)'};
             color:${currentWT===id?'var(--accent)':'var(--text2)'};">
      ${info.label.split(' ')[0]} ${info.label.split(' ').slice(1).join(' ')}
    </button>`).join('');

  const curInfo = wtInfo[currentWT] || wtInfo['day'];

  function renderBreaksHtml(info){
    return info.breaks.map(b => {
      const val = getBreakVal(b.id, b.default);
      return `<div style="display:flex;align-items:center;justify-content:space-between;
                          padding:6px 0;border-bottom:1px solid var(--border);">
        <span style="font-size:16px;color:var(--text2);">${b.label}</span>
        <div style="display:flex;align-items:center;gap:5px;">
          <input type="number" min="0" max="120" step="5" value="${val}"
            onchange="saveBreakVal('${b.id}', this.value)"
            style="width:55px;background:var(--surface);border:1px solid var(--border);color:var(--text);
                   border-radius:6px;padding:4px 6px;font-size:17px;font-family:'JetBrains Mono';
                   font-weight:700;text-align:center;outline:none;">
          <span style="font-size:15px;color:var(--text3);">분</span>
        </div>
      </div>`;
    }).join('');
  }

  html += `<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px 18px;margin-bottom:12px;">
    <div style="font-size:17px;font-weight:700;color:var(--text);margin-bottom:12px;">🕐 근무 형태</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:14px;">
      ${wtBtns}
    </div>
    <div id="wt-detail-box" style="background:var(--surface2);border-radius:10px;padding:12px 14px;">
      <div style="font-size:16px;font-weight:700;color:var(--accent);margin-bottom:4px;">${curInfo.label}</div>
      <div style="font-size:16px;color:var(--text3);margin-bottom:10px;">기본 시간: ${curInfo.defaultTime}</div>
      <div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:8px;">휴게시간 설정</div>
      ${renderBreaksHtml(curInfo)}
    </div>
  </div>`;

  // ── N잡 설정 ──
  (function(){
    let njobWages = {};
    try{ const r = localStorage.getItem('atm2_jobWages'); if(r) njobWages = JSON.parse(r); }catch(e){}

    const njobTypes = [
      { id:'convenience', icon:'🏪', label:'편의점 알바', unit:'시급' },
      { id:'shortAlba',   icon:'📋', label:'단기 알바',   unit:'시급' },
      { id:'delivery',    icon:'🛵', label:'배달',         unit:'건당 단가' },
      { id:'driver',      icon:'🚗', label:'대리기사',     unit:'건당 단가' },
      { id:'freelancer',  icon:'💻', label:'프리랜서',     unit:'건당 단가' },
    ];

    const rows = njobTypes.map(t => `
      <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border);">
        <span style="font-size:21px;flex-shrink:0;">${t.icon}</span>
        <div style="flex:1;">
          <div style="font-size:16px;font-weight:600;color:var(--text);">${t.label}</div>
          <div style="font-size:14px;color:var(--text3);">기본 ${t.unit}</div>
        </div>
        <input type="number" id="njob-wage-${t.id}" min="0" step="100"
          value="${njobWages[t.id] || (t.unit==='시급' ? 10320 : 0)}"
          style="width:100px;background:var(--surface2);border:1px solid var(--border);color:var(--text);
                 border-radius:7px;padding:6px 8px;font-size:17px;font-family:'JetBrains Mono';
                 font-weight:700;text-align:right;outline:none;">
        <span style="font-size:15px;color:var(--text3);flex-shrink:0;">원</span>
      </div>`).join('');

    html += `<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px 18px;margin-bottom:12px;">
      <div style="font-size:17px;font-weight:700;color:var(--text);margin-bottom:4px;">💼 N잡 기본 단가 설정</div>
      <div style="font-size:15px;color:var(--text3);margin-bottom:14px;">달력에서 기록 시 자동으로 적용되는 기본값</div>
      ${rows}
      <button onclick="saveNjobWages()"
        style="width:100%;margin-top:14px;padding:10px;border-radius:8px;border:none;
               background:var(--accent);color:#fff;font-size:17px;font-weight:700;
               cursor:pointer;font-family:'Noto Sans KR';">💾 저장</button>
    </div>`;
  })();


  // ── 급여일 설정 ──
  (function(){
    const savedPayday = localStorage.getItem('atm2_payday') || '';
    // 직종별 급여일 설정 로드
    let paydaySettings = {};
    try{ const r=localStorage.getItem('atm2_payday_settings'); if(r) paydaySettings=JSON.parse(r); }catch(e){}

    const DOW = ['일','월','화','수','목','금','토'];

    // 직종별 설정 행 생성
    function paydayRow(id, icon, label, defaultCfg){
      const cfg = paydaySettings[id] || defaultCfg;
      const typeA = cfg.type==='monthly'  ? 'selected' : '';
      const typeB = cfg.type==='weekly'   ? 'selected' : '';
      const typeC = cfg.type==='instant'  ? 'selected' : '';

      // 월 고정일
      const monthlyHtml = `<div id="pd-monthly-${id}" style="display:${cfg.type==='monthly'?'flex':'none'};align-items:center;gap:6px;margin-top:8px;">
        <span style="font-size:16px;color:var(--text2);">매월</span>
        <input type="number" id="pd-day-${id}" min="1" max="31" value="${cfg.day||25}"
          style="width:60px;background:var(--surface2);border:1px solid var(--border);color:var(--text);
                 border-radius:6px;padding:5px 8px;font-size:18px;font-family:'JetBrains Mono';font-weight:700;text-align:center;outline:none;">
        <span style="font-size:16px;color:var(--text2);">일 지급</span>
      </div>`;

      // 주급 방식 (마감 기준요일 + N일 후 지급)
      const weeklyDowOpts = DOW.map((d,i)=>`<option value="${i}" ${(cfg.cutDow||0)==i?'selected':''}>${d}요일</option>`).join('');
      const weeklyHtml = `<div id="pd-weekly-${id}" style="display:${cfg.type==='weekly'?'block':'none'};margin-top:8px;">
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
          <select id="pd-cutdow-${id}"
            style="background:var(--surface2);border:1px solid var(--border);color:var(--text);
                   border-radius:6px;padding:5px 8px;font-size:16px;font-family:'Noto Sans KR';outline:none;">
            ${weeklyDowOpts}
          </select>
          <span style="font-size:16px;color:var(--text3);">마감 →</span>
          <input type="number" id="pd-offset-${id}" min="0" max="14" value="${cfg.offset||4}"
            style="width:45px;background:var(--surface2);border:1px solid var(--border);color:var(--text);
                   border-radius:6px;padding:5px 6px;font-size:18px;font-family:'JetBrains Mono';font-weight:700;text-align:center;outline:none;">
          <span style="font-size:16px;color:var(--text2);">일 후 지급</span>
        </div>
        <div style="font-size:14px;color:var(--text3);margin-top:4px;">
          예: 토요일 마감 → 4일 후 = 수요일 지급 (쿠팡 방식)
        </div>
      </div>`;

      // 당일/익일
      const instantOpts = [
        {v:0,l:'당일 지급'},{v:1,l:'+1일 (익일)'},{v:2,l:'+2일'},{v:3,l:'+3일 (익주 초)'}
      ].map(o=>`<option value="${o.v}" ${(cfg.offset||0)==o.v?'selected':''}>${o.l}</option>`).join('');
      const instantHtml = `<div id="pd-instant-${id}" style="display:${cfg.type==='instant'?'flex':'none'};align-items:center;gap:6px;margin-top:8px;">
        <select id="pd-ioffset-${id}"
          style="flex:1;background:var(--surface2);border:1px solid var(--border);color:var(--text);
                 border-radius:6px;padding:7px 10px;font-size:17px;font-family:'Noto Sans KR';outline:none;">
          ${instantOpts}
        </select>
      </div>`;

      return `<div style="padding:10px 0;border-bottom:1px solid var(--border);">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
          <span style="font-size:21px;">${icon}</span>
          <span style="font-size:17px;font-weight:600;color:var(--text);flex:1;">${label}</span>
          <select id="pd-type-${id}" onchange="updatePaydayTypeUI('${id}')"
            style="background:var(--surface2);border:1px solid var(--border);color:var(--text);
                   border-radius:6px;padding:5px 8px;font-size:16px;font-family:'Noto Sans KR';outline:none;">
            <option value="monthly"  ${typeA}>월 고정일</option>
            <option value="weekly"   ${typeB}>주급 방식</option>
            <option value="instant"  ${typeC}>당일/익일</option>
          </select>
        </div>
        ${monthlyHtml}${weeklyHtml}${instantHtml}
      </div>`;
    }

    const rows =
      paydayRow('employee',    '🏢', '직장 급여',    {type:'monthly', day: savedPayday||25}) +
      paydayRow('convenience', '🏪', '편의점 알바',  {type:'monthly', day:25}) +
      paydayRow('shortAlba',   '📋', '단기 알바',    {type:'weekly',  cutDow:6, offset:4}) +
      paydayRow('delivery',    '🛵', '배달',          {type:'weekly',  cutDow:0, offset:3}) +
      paydayRow('driver',      '🚗', '대리기사',      {type:'instant', offset:0}) +
      paydayRow('freelancer',  '💻', '프리랜서',      {type:'monthly', day:15});

    html += `<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px 18px;margin-bottom:12px;">
      <div style="font-size:17px;font-weight:700;color:var(--text);margin-bottom:4px;">💰 급여일 설정</div>
      <div style="font-size:15px;color:var(--text3);margin-bottom:14px;">직종마다 다른 지급 방식 설정 → D-3·D-1·당일 알림</div>
      ${rows}
      <div style="padding:10px 0;border-bottom:1px solid var(--border);"></div>
      <button onclick="saveAllPaydaySettings()"
        style="width:100%;margin-top:14px;padding:10px;border-radius:8px;border:none;
               background:var(--accent);color:#fff;font-size:17px;font-weight:700;
               cursor:pointer;font-family:'Noto Sans KR';">💾 저장</button>
    </div>`;
  })();

  // ── 스마트 알림 + 알람음 ──
  const soundBtns = alarmSounds.map(s => `
    <button onclick="previewAndSelectAlarm('${s.id}', this)"
      style="padding:7px 10px;border-radius:8px;font-size:16px;cursor:pointer;
             font-family:'Noto Sans KR';border:1px solid ${currentAlarm===s.id?'var(--accent)':'var(--border)'};
             background:${currentAlarm===s.id?'rgba(79,124,255,.1)':'var(--surface2)'};
             color:${currentAlarm===s.id?'var(--accent)':'var(--text2)'};
             font-weight:${currentAlarm===s.id?'700':'400'};">
      ${s.label}
    </button>`).join('');

  html += `<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px 18px;margin-bottom:12px;">
    <div style="font-size:17px;font-weight:700;color:var(--text);margin-bottom:14px;">🔔 스마트 알림</div>
    <div id="smart-notif-toggles-s" style="margin-bottom:12px;"></div>
    <label style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);cursor:pointer;margin-bottom:12px;">
      <div>
        <div style="font-size:17px;font-weight:600;color:var(--text);">🔊 알림 소리 ON/OFF</div>
        <div style="font-size:15px;color:var(--text3);">선택한 알람음으로 알림</div>
      </div>
      <div onclick="toggleSoundNotifBtn(this)"
        id="sound-toggle-s"
        style="width:44px;height:24px;border-radius:12px;cursor:pointer;flex-shrink:0;
               background:var(--accent);position:relative;transition:background .25s;">
        <span style="position:absolute;top:3px;left:22px;width:18px;height:18px;border-radius:50%;
                     background:#fff;transition:left .25s;display:block;"></span>
      </div>
    </label>
    <div>
      <button onclick="(function(btn){var p=document.getElementById('alarm-sound-panel');var open=p.style.display==='none';p.style.display=open?'grid':'none';btn.textContent=open?'🔔 알람음 선택 (탭하면 미리듣기) ▲':'🔔 알람음 선택 (탭하면 미리듣기) ▼';})(this)"
        style="width:100%;padding:9px 12px;border-radius:8px;border:1px solid var(--border);
               background:var(--surface2);color:var(--text2);font-size:16px;font-weight:600;
               cursor:pointer;font-family:'Noto Sans KR';text-align:left;">
        🔔 알람음 선택 (탭하면 미리듣기) ▼ <span style="font-size:14px;color:var(--text3);">(현재: ${alarmSounds.find(s=>s.id===currentAlarm)?.label || '기본 비프음'})</span>
      </button>
      <div id="alarm-sound-panel" style="display:none;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px;">
        ${soundBtns}
      </div>
    </div>
  </div>`;

  // ★ Fix #49: 시니어모드 토글은 발견성 문제로 설정 페이지 최상단으로 이동(2026-06-20)

  // ── 데이터 관리 ──
  html += `<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px 18px;margin-bottom:12px;">
    <div style="font-size:17px;font-weight:700;color:var(--text);margin-bottom:14px;">💾 데이터 관리</div>
    <div style="font-size:15px;color:var(--text3);margin-bottom:10px;padding:8px 10px;background:rgba(255,209,102,.07);border-radius:7px;">
      💡 서버 연동 후에는 자동 저장으로 대체 예정
    </div>
    <div style="display:flex;flex-direction:column;gap:8px;">
      <button onclick="exportData()"
        style="width:100%;padding:10px 14px;border-radius:8px;border:1px solid var(--border);
               background:var(--surface2);color:var(--text);font-size:17px;font-weight:600;
               cursor:pointer;font-family:'Noto Sans KR';text-align:left;">📤 데이터 백업</button>
      <button onclick="document.getElementById('import-inp2').click()"
        style="width:100%;padding:10px 14px;border-radius:8px;border:1px solid var(--border);
               background:var(--surface2);color:var(--text);font-size:17px;font-weight:600;
               cursor:pointer;font-family:'Noto Sans KR';text-align:left;">📥 데이터 복원</button>
      <button onclick="showCustomConfirm('모든 데이터를 초기화할까요?\\n되돌릴 수 없어요!', resetAllData)"
        style="width:100%;padding:10px 14px;border-radius:8px;border:1px solid rgba(255,92,122,.3);
               background:none;color:var(--red);font-size:17px;font-weight:600;
               cursor:pointer;font-family:'Noto Sans KR';text-align:left;">🗑️ 전체 초기화</button>
    </div>
  </div>`;

  // ── 문의하기 ──
  html += `<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px 18px;margin-bottom:12px;">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
      <img src="data:image/png;base64,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" style="width:48px;height:48px;border-radius:50%;object-fit:cover;flex-shrink:0;" alt="머니냥">
      <div style="font-size:17px;font-weight:700;color:var(--text);">📬 문의하기</div>
    </div>
    <div style="font-size:16px;color:var(--text3);margin-bottom:12px;line-height:1.6;">버그 신고, 기능 건의, 사용 문의를 남겨주세요.<br>구글 폼으로 빠르게 접수할 수 있어요!</div>
    <button onclick="window.open('https://forms.gle/76PVM7ngu3r4fA3A7','_blank')"
      style="width:100%;padding:11px;border-radius:8px;border:none;background:var(--accent);
             color:#fff;font-size:17px;font-weight:700;cursor:pointer;font-family:'Noto Sans KR';">
      🐾 문의하기</button>
  </div>`;

  // ── 앱 정보 ──
  html += `<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px 18px;">
    <div style="font-size:17px;font-weight:700;color:var(--text);margin-bottom:12px;">ℹ️ 앱 정보</div>
    <div style="display:flex;flex-direction:column;gap:8px;font-size:17px;">
      <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);">
        <span style="color:var(--text2);">앱 이름</span><span style="font-weight:600;">머니냥</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:5px 0;">
        <span style="color:var(--text2);">버전</span><span style="font-weight:600;">v1.0.0</span>
      </div>
    </div>
  </div>`;

  html += '</div>';
  page.innerHTML = html;
  // 설정 탭 스마트 알림 토글 렌더 (smart-notif-toggles-s)
  setTimeout(_renderSettingsNotifToggles, 0);
}

// 설정 탭 전용 스마트 알림 토글 렌더 (notifications.js const TDZ 우회)
function _renderSettingsNotifToggles() {
  const wrap = document.getElementById('smart-notif-toggles-s');
  if (!wrap) return;
  const ITEMS = [
    { id:'budget',   emoji:'💸', label:'지출 예산 초과 + 잔고소진 알림',   desc:'변동지출 80%·100% 초과 / 잔고 소진 7일·3일·당일 경보' },
    { id:'overwork', emoji:'😓', label:'주간 과로 감지 알림',               desc:'이번주 40h·52h 초과 시 경고' },
    { id:'payday',   emoji:'💰', label:'급여일 D-3 / D-1 / D-day 알림',    desc:'급여일 3일 전·하루 전·당일' },
    { id:'commute',  emoji:'🚌', label:'출근 예정 알림',                    desc:'등록된 근무 시작 30분 전' },
  ];
  let cfg = {};
  try { const r = localStorage.getItem('atm2_smart_notif_cfg_v1'); cfg = r ? JSON.parse(r) : {}; } catch(e) {}
  ITEMS.forEach(i => { if(cfg[i.id] === undefined) cfg[i.id] = true; });
  wrap.innerHTML = ITEMS.map(item => `
    <label style="display:flex;align-items:center;justify-content:space-between;
      padding:9px 4px;border-bottom:1px solid var(--border);cursor:pointer;gap:8px;">
      <div style="flex:1;min-width:0;">
        <div style="font-size:17px;font-weight:600;color:var(--text);">${item.emoji} ${item.label}</div>
        <div style="font-size:15px;color:var(--text3);margin-top:2px;">${item.desc}</div>
      </div>
      <div class="smart-toggle ${cfg[item.id]?'on':''}"
           onclick="toggleSmartNotif('${item.id}',this)"
           style="flex-shrink:0;width:40px;height:22px;border-radius:11px;
             background:${cfg[item.id]?'var(--accent,#4f7cff)':'var(--border)'};
             position:relative;transition:background .25s;cursor:pointer;">
        <span style="position:absolute;top:3px;left:${cfg[item.id]?'20px':'3px'};
          width:16px;height:16px;border-radius:50%;background:#fff;
          box-shadow:0 1px 4px rgba(0,0,0,.2);transition:left .25s;display:block;"></span>
      </div>
    </label>`).join('');
}

// 설정 페이지에서 근무형태 선택
function setSettingsWT(wt){
  const wtInfo = {
    day: {
      label:'☀️ 주간고정근무', defaultTime:'09:00~18:00',
      breaks:[
        {label:'오전 휴식', time:'15분'},
        {label:'점심시간', time:'1시간'},
        {label:'오후 휴식', time:'15분'},
      ]
    },
    night: {
      label:'🌙 야간근무', defaultTime:'00:00~08:00',
      breaks:[
        {label:'오전 휴식', time:'15분'},
        {label:'오후 휴식', time:'15분'},
        {label:'야식시간', time:'30분'},
      ]
    },
    '2shift': {
      label:'🔄 주야2교대', defaultTime:'주간 08:00~20:00 / 야간 20:00~08:00',
      breaks:[
        {label:'[주간] 오전 휴식', time:'15분'},
        {label:'[주간] 점심시간', time:'1시간'},
        {label:'[주간] 오후 휴식', time:'15분'},
        {label:'[주간] 저녁시간', time:'30분'},
        {label:'[야간] 오전 휴식', time:'15분'},
        {label:'[야간] 오후 휴식', time:'15분'},
        {label:'[야간] 야식시간', time:'30분'},
      ]
    },
    '3shift': {
      label:'⚙️ 주야3교대', defaultTime:'조간 07:00~15:00 / 석간 15:00~23:00 / 야간 23:00~07:00',
      breaks:[
        {label:'[조간] 오전 휴식', time:'15분'},
        {label:'[조간] 점심시간', time:'1시간'},
        {label:'[조간] 오후 휴식', time:'15분'},
        {label:'[석간] 오전 휴식', time:'15분'},
        {label:'[석간] 오후 휴식', time:'15분'},
        {label:'[석간] 저녁시간', time:'30분'},
        {label:'[야간] 오전 휴식', time:'15분'},
        {label:'[야간] 오후 휴식', time:'15분'},
        {label:'[야간] 야식시간', time:'30분'},
      ]
    }
  };

  // 기존 근무형태 함수 호출
  if(typeof setWT === 'function') setWT(wt);

  // 버튼 스타일 업데이트
  Object.keys(wtInfo).forEach(id => {
    const btn = document.getElementById('swt-'+id);
    if(!btn) return;
    btn.style.borderColor = id===wt ? 'var(--accent)' : 'var(--border)';
    btn.style.background  = id===wt ? 'rgba(79,124,255,.1)' : 'var(--surface2)';
    btn.style.color       = id===wt ? 'var(--accent)' : 'var(--text2)';
    btn.style.fontWeight  = id===wt ? '700' : '400';
  });

  // 상세 박스 업데이트
  const info = wtInfo[wt] || wtInfo['day'];
  const box = document.getElementById('wt-detail-box');
  if(!box) return;
  const breaksHtml = info.breaks.map(b => {
    const val = (() => { const v=localStorage.getItem('atm2_break_'+b.id); return v!==null?parseInt(v):b.default; })();
    return `<div style="display:flex;align-items:center;justify-content:space-between;
                        padding:6px 0;border-bottom:1px solid var(--border);">
      <span style="font-size:16px;color:var(--text2);">${b.label}</span>
      <div style="display:flex;align-items:center;gap:5px;">
        <input type="number" min="0" max="120" step="5" value="${val}"
          onchange="saveBreakVal('${b.id}', this.value)"
          style="width:55px;background:var(--surface);border:1px solid var(--border);color:var(--text);
                 border-radius:6px;padding:4px 6px;font-size:17px;font-family:'JetBrains Mono';
                 font-weight:700;text-align:center;outline:none;">
        <span style="font-size:15px;color:var(--text3);">분</span>
      </div>
    </div>`;
  }).join('');
  box.innerHTML = `
    <div style="font-size:16px;font-weight:700;color:var(--accent);margin-bottom:4px;">${info.label}</div>
    <div style="font-size:16px;color:var(--text3);margin-bottom:10px;">기본 시간: ${info.defaultTime}</div>
    <div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:8px;">휴게시간 설정</div>
    ${breaksHtml}`;

  showToast('✅ ' + info.label.split(' ').slice(1).join(' ') + ' 설정됨');
}

// 휴게시간 저장
function saveBreakVal(id, val){
  localStorage.setItem('atm2_break_'+id, parseInt(val)||0);
  showToast('✅ 저장됨');
}

// 알람음 미리듣기 + 선택
function previewAndSelectAlarm(soundId, btn){
  // 버튼 스타일 업데이트
  document.querySelectorAll('[onclick^="previewAndSelectAlarm"]').forEach(b => {
    b.style.borderColor = 'var(--border)';
    b.style.background  = 'var(--surface2)';
    b.style.color       = 'var(--text2)';
    b.style.fontWeight  = '400';
  });
  btn.style.borderColor = 'var(--accent)';
  btn.style.background  = 'rgba(79,124,255,.1)';
  btn.style.color       = 'var(--accent)';
  btn.style.fontWeight  = '700';

  localStorage.setItem('atm2_alarmSound', soundId);
  playAlarmSound(soundId);
}

// 알람음 재생
function playAlarmSound(soundId){
  try{
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const sounds = {
      beep:      [[880,0.1],[880,0.1]],
      soft:      [[440,0.3]],
      ding:      [[1047,0.5]],
      chime:     [[523,0.2],[659,0.2],[784,0.4]],
      bell:      [[349,0.8]],
      digital:   [[1200,0.05],[1200,0.05],[1200,0.05]],
      piano:     [[523,0.3],[659,0.3]],
      marimba:   [[784,0.2],[1047,0.2],[1319,0.3]],
      glass:     [[1568,0.6]],
      wood:      [[200,0.1],[150,0.1]],
      alert:     [[440,0.1],[880,0.1],[440,0.1]],
      success:   [[523,0.15],[659,0.15],[784,0.15],[1047,0.3]],
      notify:    [[880,0.1],[1108,0.2]],
      pop:       [[600,0.08]],
      tick:      [[1000,0.05]],
      whistle:   [[2093,0.3]],
      horn:      [[196,0.4]],
      xylophone: [[1047,0.15],[1319,0.15],[1568,0.15]],
      cuckoo:    [[659,0.2],[523,0.3]],
      rooster:   [[523,0.1],[659,0.1],[784,0.1],[659,0.1],[523,0.2]],
    };
    const notes = sounds[soundId] || sounds['beep'];
    let time = ctx.currentTime;
    notes.forEach(([freq, dur]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = ['bell','glass','chime','piano','marimba'].includes(soundId) ? 'sine' : 'square';
      gain.gain.setValueAtTime(0.3, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
      osc.start(time);
      osc.stop(time + dur);
      time += dur + 0.05;
    });
  }catch(e){ console.log('알람음 재생 실패:', e); }
}

// 소리 토글 버튼
function toggleSoundNotifBtn(btn){
  const isOn = btn.style.background.includes('accent') || btn.style.background.includes('4f7cff') || btn.style.background.includes('var(--accent)');
  btn.style.background = isOn ? 'var(--border)' : 'var(--accent)';
  const knob = btn.querySelector('span');
  if(knob) knob.style.left = isOn ? '3px' : '22px';
  showToast(isOn ? '🔕 알림 소리 OFF' : '🔔 알림 소리 ON');
}

// 급여일 타입 변경 시 UI 토글
function updatePaydayTypeUI(id){
  const type = document.getElementById('pd-type-'+id)?.value;
  if(!type) return;
  const monthly = document.getElementById('pd-monthly-'+id);
  const weekly  = document.getElementById('pd-weekly-'+id);
  const instant = document.getElementById('pd-instant-'+id);
  if(monthly) monthly.style.display = type==='monthly' ? 'flex' : 'none';
  if(weekly)  weekly.style.display  = type==='weekly'  ? 'block': 'none';
  if(instant) instant.style.display = type==='instant' ? 'flex' : 'none';
}

// 전체 급여일 저장
function saveAllPaydaySettings(){
  const ids = ['employee','convenience','shortAlba','delivery','driver','freelancer'];
  let settings = {};
  ids.forEach(id => {
    const type = document.getElementById('pd-type-'+id)?.value || 'monthly';
    if(type === 'monthly'){
      settings[id] = { type, day: parseInt(document.getElementById('pd-day-'+id)?.value)||25 };
    } else if(type === 'weekly'){
      settings[id] = { type,
        cutDow: parseInt(document.getElementById('pd-cutdow-'+id)?.value)||6,
        offset: parseInt(document.getElementById('pd-offset-'+id)?.value)||4 };
    } else {
      settings[id] = { type,
        offset: parseInt(document.getElementById('pd-ioffset-'+id)?.value)||0 };
    }
  });
  try{ localStorage.setItem('atm2_payday_settings', JSON.stringify(settings)); }catch(e){}
  // 기존 직장인 급여일 호환성 유지 — atm2_payday + payDay_setting 동시 기록
  if(settings.employee?.day){
    savePayDaySetting(settings.employee.day);
    const el = document.getElementById('payday-input');
    if(el){ el.value = settings.employee.day; if(typeof savePayday==='function') savePayday(); }
  }
  showToast('✅ 급여일 설정 저장됨');
}

// 급여일 저장 (구버전 호환)
function savePaydayFromSettings(){
  const val = document.getElementById('payday-input-s')?.value;
  if(!val){ showToast('⚠️ 급여일을 입력해주세요'); return; }
  const paydayInp = document.getElementById('payday-input');
  if(paydayInp) paydayInp.value = val;
  // atm2_payday + payDay_setting 동시 기록 (leave.js 알림 계산 호환)
  savePayDaySetting(val);
  if(typeof savePayday === 'function') savePayday();
  else showToast('✅ 급여일 ' + val + '일 저장됨');
}


// ── N잡 기본 단가 저장 ──
function saveNjobWages(){
  const ids = ['convenience','shortAlba','delivery','driver','freelancer'];
  let wages = {};
  try{ const r = localStorage.getItem('atm2_jobWages'); if(r) wages = JSON.parse(r); }catch(e){}
  ids.forEach(id => {
    const el = document.getElementById('njob-wage-'+id);
    if(el) wages[id] = parseInt(el.value)||0;
  });
  saveJobWages(wages);
  showToast('✅ N잡 단가 설정 저장됨');
}

// ── Single Writer helpers ──
// 온보딩/설정에서 회사명·이름 저장 (atm2_companyName, atm2_ob_empName 의 단일 저장 진입점)
window.saveObInfo = function(co, name){
  try{ if(co)   localStorage.setItem('atm2_companyName', co);   }catch(e){}
  try{ if(name) localStorage.setItem('atm2_ob_empName',  name); }catch(e){}
};

// 급여일 저장 (payDay_setting + atm2_payday 의 단일 저장 진입점)
window.savePayDaySetting = function(val){
  try{ localStorage.setItem('atm2_payday',    String(val)); }catch(e){}
  try{ localStorage.setItem('payDay_setting', String(val)); }catch(e){}
};

// N잡 단가 저장 (atm2_jobWages 의 단일 저장 진입점)
window.saveJobWages = function(wages){
  try{ localStorage.setItem('atm2_jobWages', JSON.stringify(wages)); }catch(e){}
};

// ── 기본정보 ReadOnly 토글 ──
function toggleSettingsEdit(checked){
  const ids = ['set-company-name','set-emp-name','set-base-wage'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if(!el) return;
    el.readOnly = !checked;
    el.style.color  = checked ? 'var(--text)'  : 'var(--text3)';
    el.style.cursor = checked ? 'text' : 'default';
    el.style.borderColor = checked ? 'var(--accent)' : 'var(--border)';
  });
}

// ── 기본 설정 저장 (회사명 + 이름 + 시급 + 입사일) ──
function saveBasicSettings(){
  const name    = (document.getElementById('set-company-name')?.value||'').trim();
  const empName = (document.getElementById('set-emp-name')?.value||'').trim();
  const wage    = parseFloat(document.getElementById('set-base-wage')?.value||'10320');
  const hire    = document.getElementById('set-hire-date')?.value||'';

  // 회사명 + 이름 저장 (single writer: saveObInfo)
  saveObInfo(name, empName);
  if(name){
    const compEl = document.getElementById('company-name');
    if(compEl) compEl.textContent = name;
  }

  // 시급 저장
  if(wage >= 10320){
    localStorage.setItem('atm2_baseWage', String(wage));
    // 활성 직원에도 반영
    if(typeof activeWpId !== 'undefined' && activeWpId && activeEmpId){
      hourlyRate   = wage;
      companyRate  = wage;
      empUpdate(activeWpId, activeEmpId, { hourlyRate: wage, companyRate: wage });
      if(typeof renderSalaryIfVisible === 'function') renderSalaryIfVisible();
    }
  } else {
    showToast('⚠️ 시급은 최저시급(10,320원) 이상이어야 합니다'); return;
  }

  // 입사일 저장
  if(hire){
    hireDate = hire;
    localStorage.setItem('atm2_hireDate', hire);
    // 활성 직원에도 반영
    if(typeof activeWpId !== 'undefined' && activeWpId && activeEmpId){
      empUpdate(activeWpId, activeEmpId, { hireDate: hire });
      const hi = document.getElementById('hire-date-inp');
      if(hi) hi.value = hire;
    }
  }

  lsSave();
  showToast('✅ 설정이 저장됐습니다!');
  // 저장 후 ReadOnly로 복원 (renderSettingsPage가 재렌더링하므로 체크박스 자동 초기화됨)
  renderSettingsPage();
}

// ── 입사일 셀렉트 → hidden input 동기화 + 연차 현황 갱신 ──
function syncHireDate(){
  const y = document.getElementById('hire-y')?.value||'';
  const m = document.getElementById('hire-m')?.value||'';
  const d = document.getElementById('hire-d')?.value||'';
  const hidden = document.getElementById('set-hire-date');
  // 사이드바 hire-date-inp도 동기화
  const sideInp = document.getElementById('hire-date-inp');
  if(y && m && d){
    const val = `${y}-${m}-${d}`;
    if(hidden) hidden.value = val;
    if(sideInp) sideInp.value = val;
    hireDate = val;
    // 연차 현황 즉시 갱신
    renderSettingsPage();
  } else {
    if(hidden) hidden.value = '';
    if(sideInp) sideInp.value = '';
  }
}

// ── 사이드바 입사일 셀렉트 초기화 ──
function initSidebarHireSelects(){
  const sy = document.getElementById('sb-hire-y');
  const sm = document.getElementById('sb-hire-m');
  const sd = document.getElementById('sb-hire-d');
  if(!sy||!sm||!sd) return;

  const nowY = new Date().getFullYear();
  const parts = hireDate ? hireDate.split('-') : ['','',''];
  const cy=parts[0]||'', cm=parts[1]||'', cd=parts[2]||'';

  // 년 옵션
  let yHtml = '<option value="">년</option>';
  for(let y=nowY;y>=nowY-40;y--)
    yHtml += `<option value="${y}" ${cy==y?'selected':''}>${y}년</option>`;
  sy.innerHTML = yHtml;

  // 월 옵션
  let mHtml = '<option value="">월</option>';
  for(let m=1;m<=12;m++){
    const mv = String(m).padStart(2,'0');
    mHtml += `<option value="${mv}" ${cm==mv?'selected':''}>${m}월</option>`;
  }
  sm.innerHTML = mHtml;

  // 일 옵션
  let dHtml = '<option value="">일</option>';
  for(let d=1;d<=31;d++){
    const dv = String(d).padStart(2,'0');
    dHtml += `<option value="${dv}" ${cd==dv?'selected':''}>${d}일</option>`;
  }
  sd.innerHTML = dHtml;
}

function syncSidebarHire(){
  const y = document.getElementById('sb-hire-y')?.value||'';
  const m = document.getElementById('sb-hire-m')?.value||'';
  const d = document.getElementById('sb-hire-d')?.value||'';
  if(y && m && d){
    const val = `${y}-${m}-${d}`;
    const hidden = document.getElementById('hire-date-inp');
    if(hidden) hidden.value = val;
    hireDate = val;
    lsSave();
    if(typeof renderLeaveInfo === 'function') renderLeaveInfo();
    // 설정 페이지 셀렉트도 동기화
    const hy = document.getElementById('hire-y');
    const hm = document.getElementById('hire-m');
    const hdd = document.getElementById('hire-d');
    if(hy) hy.value = y;
    if(hm) hm.value = m;
    if(hdd) hdd.value = d;
  }
}

// ★ AI 어시스턴트 버블 초기화 (모든 전역변수 준비 후 실행)
if(typeof initAsstBubble === "function") initAsstBubble();



// ══════════════════════════════════════════
// ★ UI 가이드 오버레이 시스템
// ══════════════════════════════════════════

var _uigStep = 0;
var _uigSteps = [];
var _uigFingerTimer = null;

// 가이드 단계 정의
function _buildUigSteps(){
  return [
    {
      targetId: 'banner-logo',
      title:    '🏢 회사 로고 영역',
      desc:     '여기를 탭하면 회사 로고나\n원하는 이미지로 바꿀 수 있어요!',
      tailPos:  'top',   // 말풍선 꼬리 위치
      bubbleY:  'below', // 말풍선을 아래에 표시
    },
    {
      targetId: 'company-input',
      title:    '✏️ 회사명 입력',
      desc:     '회사 이름이나 직장명을\n여기에 입력하세요',
      tailPos:  'top',
      bubbleY:  'below',
    },
    {
      targetId: 'sb-emp-avatar',
      title:    '📸 내 프로필 사진',
      desc:     '이 동그라미를 탭하면\n프로필 사진을 바꿀 수 있어요!',
      tailPos:  'top',
      bubbleY:  'below',
    },
    {
      targetId: 'sb-emp-name',
      title:    '👤 내 이름 표시',
      desc:     '온보딩에서 입력한\n내 이름이 여기 표시돼요',
      tailPos:  'top',
      bubbleY:  'below',
    },
  ];
}

// 가이드 시작
function uigStart(){
  _uigSteps = _buildUigSteps();
  _uigStep  = 0;
  // 배경 오버레이 표시
  var ov = document.getElementById('ui-guide-overlay');
  if(ov){ ov.style.display='block'; ov.style.opacity='0'; ov.style.transition='opacity .3s'; }
  var spot   = document.getElementById('uig-spotlight');
  var finger = document.getElementById('uig-finger');
  var bubble = document.getElementById('uig-bubble');
  if(spot)  { spot.style.opacity='0';   spot.style.transition='all .45s cubic-bezier(.34,1.56,.64,1)'; }
  if(finger){ finger.style.opacity='0'; }
  if(bubble){ bubble.style.opacity='0'; bubble.style.transform='scale(0.85)'; }
  // 렌더 후 페이드인
  setTimeout(function(){
    if(ov) ov.style.opacity='1';
    setTimeout(function(){ uigShow(_uigStep); }, 150);
  }, 60);
}

// 특정 단계 표시
function uigShow(idx){
  var steps = _uigSteps;
  if(idx >= steps.length){ uigFinish(); return; }
  var step   = steps[idx];
  var target = document.getElementById(step.targetId);
  if(!target){ _uigStep++; uigShow(_uigStep); return; }

  var rect   = target.getBoundingClientRect();
  var pad    = 10;
  var BW     = 250; // 말풍선 너비

  // ── 스포트라이트 ──
  var spot = document.getElementById('uig-spotlight');
  if(spot){
    spot.style.display = 'block';
    spot.style.left    = (rect.left   - pad) + 'px';
    spot.style.top     = (rect.top    - pad) + 'px';
    spot.style.width   = (rect.width  + pad*2) + 'px';
    spot.style.height  = (rect.height + pad*2) + 'px';
  }

  // ── 손가락 ──
  var finger = document.getElementById('uig-finger');
  if(finger){
    var fx = rect.left + rect.width * 0.5;
    var fy = rect.top  + rect.height * 0.5 - 34;
    finger.style.display   = 'block';
    finger.style.opacity   = '1';
    finger.style.left      = fx + 'px';
    finger.style.top       = fy + 'px';
    finger.style.transform = 'translate(-50%,-50%) rotate(-20deg) scale(1)';
    uigFingerTap(finger, fx, fy);
  }

  // ── 말풍선 위치 ──
  var bubble = document.getElementById('uig-bubble');
  var tail   = document.getElementById('uig-tail');
  if(bubble){
    // X 위치
    var bx = rect.left;
    if(bx + BW > window.innerWidth - 12) bx = window.innerWidth - BW - 12;
    if(bx < 10) bx = 10;

    // Y 위치: 요소 아래 우선, 넘치면 위
    var byBelow = rect.bottom + pad + 14;
    var byAbove = rect.top    - pad - 14 - 160; // 말풍선 높이 약 160
    var useBelow = (byBelow + 170 <= window.innerHeight);
    var by = useBelow ? byBelow : byAbove;

    bubble.style.display   = 'block';
    bubble.style.left      = bx + 'px';
    bubble.style.top       = by + 'px';
    bubble.style.opacity   = '1';
    bubble.style.transform = 'scale(1)';

    // 꼬리 방향
    if(tail){
      if(useBelow){
        // 말풍선이 아래 → 꼬리는 위 ▲
        tail.style.borderBottom = '11px solid white';
        tail.style.borderTop    = 'none';
        tail.style.top          = '-11px';
        tail.style.bottom       = 'auto';
      } else {
        // 말풍선이 위 → 꼬리는 아래 ▼
        tail.style.borderTop    = '11px solid white';
        tail.style.borderBottom = 'none';
        tail.style.bottom       = '-11px';
        tail.style.top          = 'auto';
      }
      // 꼬리 X: 요소 중앙 기준
      var tailX = (rect.left + rect.width/2) - bx - 9;
      tailX = Math.max(12, Math.min(tailX, BW - 30));
      tail.style.left = tailX + 'px';
    }
  }

  // ── 텍스트 업데이트 ──
  var badge = document.getElementById('uig-step-badge');
  var title = document.getElementById('uig-title');
  var desc  = document.getElementById('uig-desc');
  var nBtn  = document.getElementById('uig-next-btn');
  if(badge) badge.textContent = (idx+1) + ' / ' + steps.length;
  if(title) title.textContent = step.title;
  if(desc)  desc.innerHTML = step.desc.replace(/\n/g,'<br>');
  if(nBtn)  nBtn.textContent = (idx+1 < steps.length) ? '다음 →' : '완료 ✅';
}

// 손가락 탭 애니메이션 (위→아래 반복)
function uigFingerTap(finger, fx, fy){
  if(_uigFingerTimer) clearInterval(_uigFingerTimer);
  var phase = 0;
  _uigFingerTimer = setInterval(function(){
    phase++;
    if(phase % 2 === 1){
      // 아래로 탭
      finger.style.top       = (fy + 14) + 'px';
      finger.style.transform = 'translate(-50%,-50%) rotate(-15deg) scale(0.88)';
      finger.style.filter    = 'drop-shadow(0 1px 4px rgba(0,0,0,.4))';
    } else {
      // 원래 위치로
      finger.style.top       = fy + 'px';
      finger.style.transform = 'translate(-50%,-50%) rotate(-20deg) scale(1)';
      finger.style.filter    = 'drop-shadow(0 2px 8px rgba(0,0,0,.5))';
    }
  }, 700);
}

// 다음 단계
function uigNext(){
  _uigStep++;
  if(_uigStep >= _uigSteps.length){
    uigFinish();
  } else {
    var bubble = document.getElementById('uig-bubble');
    var finger = document.getElementById('uig-finger');
    if(bubble){ bubble.style.opacity='0'; bubble.style.transform='scale(0.88)'; }
    if(finger){ finger.style.opacity='0.2'; }
    if(_uigFingerTimer){ clearInterval(_uigFingerTimer); _uigFingerTimer=null; }
    setTimeout(function(){ uigShow(_uigStep); }, 280);
  }
}

// 건너뛰기
function uigSkip(){
  uigFinish();
}

// ══════════════════════════════════════════
// 데이터 백업 / 복원 / 전체 초기화
// ══════════════════════════════════════════

function exportData(){
  try {
    const backup = {};
    for(let i = 0; i < localStorage.length; i++){
      const k = localStorage.key(i);
      if(k && k.startsWith('atm2_')){
        backup[k] = localStorage.getItem(k);
      }
    }
    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], {type:'application/json'});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const date = new Date().toISOString().slice(0,10);
    a.href     = url;
    a.download = `moneynyang_backup_${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
    if(typeof showToast === 'function') showToast('💾 백업 파일이 다운로드되었습니다!');
  } catch(e) {
    alert('백업 중 오류가 발생했습니다: ' + e.message);
  }
}

function importData(event){
  const file = event.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = function(e){
    try {
      const data = JSON.parse(e.target.result);
      showCustomConfirm('현재 데이터를 덮어쓰고 복원할까요?\n백업 파일의 데이터로 교체됩니다!', function(){
        // [S3 버그 수정] v11_migrated 플래그를 먼저 제거해 구버전 백업도 마이그레이션이 재실행되도록 보장
        localStorage.removeItem('atm2_v11_migrated');

        let count = 0;
        Object.keys(data).forEach(k => {
          if(k.startsWith('atm2_')){
            const v = data[k];
            localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
            count++;
          }
        });

        // [v10 하위호환] atm2_selectedJobs 없고 atm2_jobType 있으면 자동 변환
        if(!data['atm2_selectedJobs'] && data['atm2_jobType']){
          var jt = data['atm2_jobType'];
          var jobs = jt === 'employee' ? ['employee']
                   : jt === 'multi'    ? []
                   : (jt ? [jt] : []);
          if(jobs.length > 0){
            localStorage.setItem('atm2_selectedJobs', JSON.stringify(jobs));
          }
        }

        // [atm2_ 외 키] 로고·급여일 설정 별도 복원
        if(data['companyLogo']) localStorage.setItem('companyLogo', data['companyLogo']);
        if(data['payDay_setting']) localStorage.setItem('payDay_setting', data['payDay_setting']);

        if(typeof showToast === 'function') showToast(`✅ ${count}개 항목 복원 완료! 앱을 새로고침합니다.`);
        setTimeout(() => location.reload(), 1200);
      });
    } catch(err) {
      alert('복원 실패: 올바른 백업 파일인지 확인해주세요.\n' + err.message);
    }
    event.target.value = '';
  };
  reader.readAsText(file);
}

function resetAllData(){
  showCustomConfirm('⚠️ 모든 데이터를 초기화할까요?\n\n근태 기록, 급여 설정 등 저장된 모든 데이터가 삭제됩니다.\n이 작업은 되돌릴 수 없습니다.', function(){
    // atm2_ 로 시작하는 모든 키 삭제
    const keys = [];
    for(let i = 0; i < localStorage.length; i++){
      const k = localStorage.key(i);
      if(k && k.startsWith('atm2_')) keys.push(k);
    }
    keys.forEach(k => localStorage.removeItem(k));
    if(typeof showToast === 'function') showToast('🗑️ 모든 데이터가 초기화되었습니다. 앱을 새로고침합니다.');
    setTimeout(() => location.reload(), 1200);
  });
}

// 가이드 종료
function uigFinish(){
  if(_uigFingerTimer){ clearInterval(_uigFingerTimer); _uigFingerTimer=null; }
  var ov     = document.getElementById('ui-guide-overlay');
  var spot   = document.getElementById('uig-spotlight');
  var bubble = document.getElementById('uig-bubble');
  var finger = document.getElementById('uig-finger');

  // 페이드아웃
  if(ov)    { ov.style.opacity='0'; }
  if(spot)  { spot.style.opacity='0'; }
  if(bubble){ bubble.style.opacity='0'; bubble.style.transform='scale(0.85)'; }
  if(finger){ finger.style.opacity='0'; finger.style.transform='translate(-50%,-50%) rotate(-20deg) scale(0.7)'; }

  setTimeout(function(){
    if(ov)    ov.style.display    = 'none';
    if(spot)  spot.style.display  = 'none';
    if(bubble)bubble.style.display= 'none';
    if(finger)finger.style.display= 'none';
    // 완료 토스트
    if(typeof showToast==='function') showToast('🎉 이제 자유롭게 사용해보세요!');
    // localStorage에 완료 표시
    try{ localStorage.setItem('atm2_ui_guide_done','1'); }catch(e){}
  }, 380);
}

// ══════════════════════════════════════════
// 시니어 모드 (UI 접근성 모드) — Fix #48 (2026-06-20)
// body.senior-mode 클래스 기반. 계산 로직/캘린더 그리드는 절대 건드리지 않음.
// zoom·transform:scale 대신, 대상 컨테이너 내부 요소의 실제 font-size·padding을
// 각자의 현재 값 기준으로 비율 확대해 원래의 크기 위계(제목/본문 차이)를 유지함.
// ══════════════════════════════════════════
const SENIOR_MODE_KEY   = 'atm2_uiMode';
const SENIOR_SCALE       = 1.18; // 15~20% 확대 범위의 중간값
// ★ 적용 대상: 설정/생존관리/날짜입력팝업/사용설명서/직업선택/모드선택/튜토리얼.
//   캘린더(.cal-grid/.cal-day)는 의도적으로 제외 — _scaleSubtree()의 closest 체크로 이중 보호.
const SENIOR_TARGET_SELECTORS = [
  '#settings-page', '#budget-page', '#popup', '#manual-overlay',
  '#job-type-overlay', '#ui-mode-overlay',
  '#tutorial-prompt-overlay', '#tutorial-step-overlay', // 튜토리얼(누락 수정)
];
let _seniorObservers = [];
let _seniorBodyObserver = null;

function isSeniorMode(){
  try { return localStorage.getItem(SENIOR_MODE_KEY) === 'senior'; } catch(e) { return false; }
}

// ★ Fix #53: 폰트 누적 확대 근본 수정(2026-06-20).
//   기존에는 매번 getComputedStyle()을 다시 읽어 1.18배 했는데, disable 시
//   style.removeProperty()가 padding 같은 shorthand 속성과 충돌해 원본이 아닌
//   다른 값으로 떨어지는 경우가 있었고, 그 어긋난 값을 기준으로 다음 enable이 또
//   1.18배를 적용해 토글을 반복할수록 값이 누적 확대되는 문제가 있었음.
//   → 원본 크기를 요소별로 "최초 1회만" data attribute에 캐시해두고, 이후 모든
//   계산은 항상 이 캐시된 원본 기준으로만 수행 — 토글을 몇 번 반복해도
//   "원본 × 1.18"만 나오도록 구조적으로 누적 자체가 불가능하게 함.
function _captureBase(el){
  if(el.dataset.seniorBaseCaptured) return;
  const cs = window.getComputedStyle(el);
  el.dataset.seniorBaseFs = parseFloat(cs.fontSize) || 0;
  const tag = el.tagName;
  if(tag === 'BUTTON' || tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA'){
    el.dataset.seniorBasePt = parseFloat(cs.paddingTop) || 0;
    el.dataset.seniorBasePb = parseFloat(cs.paddingBottom) || 0;
  }
  el.dataset.seniorBaseCaptured = '1';
}

function _scaleEl(el){
  if(!el) return;
  // 캘린더 그리드/날짜 셀은 절대 확대하지 않음(이중 안전장치)
  if(el.closest && el.closest('.cal-grid, .cal-day')) return;
  _captureBase(el);
  if(el.dataset.seniorScaled) return; // 이미 적용됨 — 중복 적용 방지

  const baseFs = parseFloat(el.dataset.seniorBaseFs);
  if(baseFs) el.style.setProperty('font-size', (baseFs * SENIOR_SCALE).toFixed(1) + 'px', 'important');

  const tag = el.tagName;
  if(tag === 'BUTTON' || tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA'){
    const basePt = parseFloat(el.dataset.seniorBasePt);
    const basePb = parseFloat(el.dataset.seniorBasePb);
    if(basePt) el.style.setProperty('padding-top', (basePt * SENIOR_SCALE).toFixed(1) + 'px', 'important');
    if(basePb) el.style.setProperty('padding-bottom', (basePb * SENIOR_SCALE).toFixed(1) + 'px', 'important');
    // ★ 입사일(년/월/일) 같은 grid/flex 다단 배치에서 폰트 확대로 select/input이
    //   부모 셀 폭을 넘쳐 잘리는 문제 방지 — min-width:0으로 셀 폭에 맞춰 줄어들게 함
    if(tag === 'SELECT' || tag === 'INPUT' || tag === 'TEXTAREA'){
      el.style.setProperty('min-width', '0', 'important');
    }
  }
  el.dataset.seniorScaled = '1';
}

// 카드형 컨테이너(패딩이 있는 div)의 내부 여백만 살짝 확대 — 깊은 중첩까지
// 침투하면 flex/grid 레이아웃이 깨질 위험이 있어 "직계 자식" 레벨로만 한정.
// (동일하게 원본 패딩을 최초 1회만 캐시해 누적 방지)
function _scaleCardPadding(root){
  if(!root || !root.children) return;
  Array.from(root.children).forEach(function(child){
    if(child.tagName !== 'DIV') return;
    if(child.closest && child.closest('.cal-grid, .cal-day')) return;
    if(child.dataset.seniorCardScaled){ _scaleCardPadding(child); return; }

    if(child.dataset.seniorCardBasePt === undefined){
      const cs = window.getComputedStyle(child);
      child.dataset.seniorCardBasePt = parseFloat(cs.paddingTop) || 0;
      child.dataset.seniorCardBasePb = parseFloat(cs.paddingBottom) || 0;
      child.dataset.seniorCardBasePl = parseFloat(cs.paddingLeft) || 0;
      child.dataset.seniorCardBasePr = parseFloat(cs.paddingRight) || 0;
    }
    const basePt = parseFloat(child.dataset.seniorCardBasePt);
    if(basePt > 4){
      const basePb = parseFloat(child.dataset.seniorCardBasePb);
      const basePl = parseFloat(child.dataset.seniorCardBasePl);
      const basePr = parseFloat(child.dataset.seniorCardBasePr);
      child.style.setProperty('padding-top',    (basePt * 1.12).toFixed(1) + 'px', 'important');
      child.style.setProperty('padding-bottom', (basePb * 1.12).toFixed(1) + 'px', 'important');
      child.style.setProperty('padding-left',   (basePl * 1.12).toFixed(1) + 'px', 'important');
      child.style.setProperty('padding-right',  (basePr * 1.12).toFixed(1) + 'px', 'important');
      child.dataset.seniorCardScaled = '1';
    }
    _scaleCardPadding(child); // 카드 내부의 하위 카드(있다면)도 동일하게 처리
  });
}

// 입사일(년/월/일) 같은 고정 비율 grid 폼은 폰트 확대 시 select가 셀 폭을 넘쳐
// 잘릴 수 있어, 시니어모드에서는 세로 1열 스택으로 바꿔 넘침을 방지함.
function _fixFormGridOverflow(root){
  if(!root || !root.querySelectorAll) return;
  root.querySelectorAll('#hire-y, #hire-m, #hire-d').forEach(function(sel){
    const grid = sel.parentElement;
    if(grid && !grid.dataset.seniorGridFixed){
      grid.style.setProperty('grid-template-columns', '1fr', 'important');
      grid.style.setProperty('gap', '8px', 'important');
      grid.dataset.seniorGridFixed = '1';
    }
  });
}

function _scaleSubtree(root){
  if(!root) return;
  if(root.closest && root.closest('.cal-grid, .cal-day')) return;
  // ★ Fix #53b: CSS에 `select{font-size:max(16px,1em)!important}`처럼 부모 폰트(1em)에
  //   의존하는 규칙이 있어, 부모 컨테이너를 먼저 스케일한 뒤 자식을 처리하면 자식의
  //   "원본"을 측정하는 시점에 이미 부모가 커진 상태라 em 기반 값이 부풀려진 채로
  //   캡처되는 문제가 있었음(누적 확대의 진짜 근본 원인). 캡처(1단계)와 실제 적용
  //   (2단계)을 완전히 분리해, 트리 전체가 "원본 상태일 때" 먼저 모든 원본 값을
  //   캐시하고, 그 다음에야 스케일을 적용하도록 순서를 보장함(2026-06-20).
  _captureBase(root);
  root.querySelectorAll('*').forEach(_captureBase);
  _scaleEl(root);
  root.querySelectorAll('*').forEach(_scaleEl);
  _scaleCardPadding(root);
  _fixFormGridOverflow(root);
}

function _watchTarget(root){
  // ★ 같은 root에 중복으로 옵저버가 쌓이는 것을 방지(메모리 누수 방지)
  if(root.dataset && root.dataset.seniorWatched) { _scaleSubtree(root); return; }
  _scaleSubtree(root);
  const mo = new MutationObserver(function(){
    // 튜토리얼처럼 반복 생성/제거되는 동적 오버레이가 DOM에서 빠지면 스스로 정리(누수 방지)
    if(!root.isConnected){ mo.disconnect(); return; }
    _scaleSubtree(root);
  });
  mo.observe(root, { childList:true, subtree:true });
  _seniorObservers.push(mo);
  if(root.dataset) root.dataset.seniorWatched = '1';
}

function enableSeniorScaling(){
  SENIOR_TARGET_SELECTORS.forEach(function(sel){
    document.querySelectorAll(sel).forEach(_watchTarget);
  });
  // ★ 직업선택/모드선택 오버레이처럼 나중에 동적으로 생성되는 대상도 자동 감지
  if(!_seniorBodyObserver){
    _seniorBodyObserver = new MutationObserver(function(mutations){
      if(!isSeniorMode()) return;
      mutations.forEach(function(m){
        m.addedNodes.forEach(function(node){
          if(node.nodeType !== 1) return;
          SENIOR_TARGET_SELECTORS.forEach(function(sel){
            if(node.matches && node.matches(sel)) _watchTarget(node);
          });
        });
      });
    });
    _seniorBodyObserver.observe(document.body, { childList:true });
  }
}

function disableSeniorScaling(){
  _seniorObservers.forEach(function(mo){ mo.disconnect(); });
  _seniorObservers = [];
  if(_seniorBodyObserver){ _seniorBodyObserver.disconnect(); _seniorBodyObserver = null; }
  // ★ Fix #53: removeProperty 대신 캐시된 원본 값으로 "정확히 복원" —
  //   removeProperty는 padding 같은 shorthand와 충돌해 원본이 아닌 다른 값(0 등)으로
  //   떨어질 수 있어, 다음 재적용 시 그 값을 기준으로 또 확대되며 누적되는 원인이었음.
  document.querySelectorAll('[data-senior-scaled]').forEach(function(el){
    const baseFs = el.dataset.seniorBaseFs;
    if(baseFs !== undefined) el.style.setProperty('font-size', baseFs + 'px');
    const tag = el.tagName;
    if(tag === 'BUTTON' || tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA'){
      const basePt = el.dataset.seniorBasePt, basePb = el.dataset.seniorBasePb;
      if(basePt !== undefined) el.style.setProperty('padding-top', basePt + 'px');
      if(basePb !== undefined) el.style.setProperty('padding-bottom', basePb + 'px');
    }
    el.style.removeProperty('min-height'); // 원래 없던 속성이므로 완전히 제거
    el.style.removeProperty('min-width');
    delete el.dataset.seniorScaled;
  });
  document.querySelectorAll('[data-senior-card-scaled]').forEach(function(el){
    const pt = el.dataset.seniorCardBasePt, pb = el.dataset.seniorCardBasePb;
    const pl = el.dataset.seniorCardBasePl, pr = el.dataset.seniorCardBasePr;
    if(pt !== undefined) el.style.setProperty('padding-top', pt + 'px');
    if(pb !== undefined) el.style.setProperty('padding-bottom', pb + 'px');
    if(pl !== undefined) el.style.setProperty('padding-left', pl + 'px');
    if(pr !== undefined) el.style.setProperty('padding-right', pr + 'px');
    delete el.dataset.seniorCardScaled;
  });
  document.querySelectorAll('[data-senior-grid-fixed]').forEach(function(el){
    el.style.removeProperty('grid-template-columns');
    el.style.removeProperty('gap');
    delete el.dataset.seniorGridFixed;
  });
  document.querySelectorAll('[data-senior-watched]').forEach(function(el){
    delete el.dataset.seniorWatched;
  });
}

function applyUiMode(mode){
  try { localStorage.setItem(SENIOR_MODE_KEY, mode); } catch(e){}
  document.body.classList.toggle('senior-mode', mode === 'senior');
  // ★ 항상 먼저 원복 후 필요시 재적용 — 중복 호출이 와도 폰트가 누적 확대되지 않도록 구조적으로 방지
  disableSeniorScaling();
  if(mode === 'senior') enableSeniorScaling();
}

// 앱 시작 시 저장된 모드 즉시 재적용(새로고침 후 유지)
(function(){
  if(isSeniorMode()){
    document.body.classList.add('senior-mode');
    enableSeniorScaling();
  }
})();

// 설정 페이지 토글 핸들러
function toggleSeniorModeBtn(btn){
  const newMode = isSeniorMode() ? 'normal' : 'senior';
  applyUiMode(newMode);
  setTimeout(function(){
    renderSettingsPage();
    showToast(newMode === 'senior' ? '👴 시니어 모드 ON' : '👤 일반 모드 ON');
  }, 100);
}

// ── 모드 선택 화면 (최초 1회, 직업선택 진입 직전) ──
function showUiModeSelector(onDone){
  // 두 부트스트랩 경로(스플래시 클릭 / window.load)가 동시에 호출될 수 있어 중복 방지
  if(document.getElementById('ui-mode-overlay')) return;
  if(typeof _removeAllPopups === 'function') _removeAllPopups();
  const ov = _makeOverlay('ui-mode-overlay');
  const modal = _makeModal(460);

  const hdr = document.createElement('div');
  hdr.style.cssText = 'text-align:center;margin-bottom:20px;';
  hdr.innerHTML = '<div style="font-size:44px;margin-bottom:8px;">🔠</div>'
    + '<h2 style="font-size:24px;font-weight:700;margin-bottom:6px;color:var(--text,#fff);">화면 크기를 선택해주세요</h2>'
    + '<div style="font-size:14px;font-weight:700;color:var(--accent,#4f7cff);margin-bottom:8px;">이번 달 받을 돈과, 월급날까지 버틸 수 있는지 미리 알 수 있어요</div>'
    + '<div style="font-size:15px;color:var(--text3,#aaa);line-height:1.6;">설정에서 언제든 다시 바꿀 수 있어요</div>';
  modal.appendChild(hdr);

  function makeModeCard(mode, icon, title, lines){
    const card = document.createElement('div');
    card.style.cssText = 'background:var(--surface2,#2a2a3a);border:1.5px solid var(--border,rgba(255,255,255,.1));border-radius:14px;padding:16px 18px;cursor:pointer;transition:border-color .2s;display:flex;align-items:flex-start;gap:14px;margin-bottom:10px;';
    card.innerHTML = '<div style="font-size:34px;flex-shrink:0;">'+icon+'</div>'
      + '<div><div style="font-size:18px;font-weight:800;color:var(--text,#fff);margin-bottom:4px;">'+title+'</div>'
      + '<div style="font-size:14px;color:var(--text3,#aaa);line-height:1.6;">'+lines.join('<br>')+'</div></div>';
    card.addEventListener('mouseover', function(){ this.style.borderColor = 'var(--accent,#4f7cff)'; });
    card.addEventListener('mouseout',  function(){ this.style.borderColor = 'var(--border,rgba(255,255,255,.1))'; });
    card.addEventListener('click', function(){
      applyUiMode(mode);
      ov.remove();
      if(typeof onDone === 'function') onDone();
    });
    return card;
  }

  modal.appendChild(makeModeCard('normal', '👤', '일반 모드', [
    '일반 글자 크기',
    '더 많은 정보를 한 화면에 표시',
    '20~50대 사용자 추천',
  ]));
  modal.appendChild(makeModeCard('senior', '👴', '시니어 모드', [
    '글자와 버튼을 더 크게 표시',
    '가독성과 터치 편의성 강화',
    '50대 이상 사용자 추천',
  ]));

  ov.appendChild(modal);
  document.body.appendChild(ov);
}
