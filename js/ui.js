// ── Single Writer: companyLogo 저장 진입점 ──
window.saveCompanyLogo = function(b64){
  try{
    localStorage.setItem('companyLogo', b64);
    if(typeof activeWpId!=='undefined' && activeWpId) wpUpdate(activeWpId,{logo:b64});
  }catch(err){ if(typeof showToast==='function') showToast('⚠️ 저장 공간 부족으로 로고를 저장하지 못했어요'); }
};

// ══════════════════════════════════════════
// 범용 토스트 (배경색 토스트와 별개)
// ══════════════════════════════════════════

// ══════════════════════════════════════════
// 핵심 시간 계산 유틸
// ══════════════════════════════════════════
/**
 * calcHours: start, end 기반 실제 근무시간
 * ★ start === end → 0 (입력 오류 방지)
 * ★ start > end → 익일 근무 (야간 등)
 */
function calcHours(start, end){
  if(start===null||start===undefined||end===null||end===undefined) return 0;
  if(start===end) return 0;
  return end>start ? end-start : (24-start)+end;
}

/**
 * getBreaks: 근무형태·시작시간 기준으로 점심/야식 공제 결정
 *
 * ┌─────────────┬────────┬──────┬──────────────────────────────┐
 * │ 근무형태     │ 점심   │ 야식 │ 조건                          │
 * ├─────────────┼────────┼──────┼──────────────────────────────┤
 * │ 주간(day)   │  1h   │  -   │ 항상                          │
 * │ 야간(night) │  -    │ 0.5h │ 항상                          │
 * │ 2교대 주간조│  1h   │ 0.5h │ 12h 근무 → 둘 다              │
 * │ 2교대 야간조│  -    │ 0.5h │ 야간이라 점심 없음             │
 * │ 3교대 A조   │  1h   │  -   │ 06~14시, 낮 근무              │
 * │ 3교대 B조   │  -    │ 0.5h │ 14~22시, 야식 시간대           │
 * │ 3교대 C조   │  -    │ 0.5h │ 22~06시, 야식 시간대           │
 * │ sat/sun_work│  1h   │  -   │ 주간 특근 기본                 │
 * │ holiday/pub │  1h   │  -   │ 주간 기본                     │
 * └─────────────┴────────┴──────┴──────────────────────────────┘
 *
 * @returns {lunch: number, dinner: number}
 */
function getBreaks(start, status, shift){
  // ──────────────────────────────────────────────
  // 휴게시간 규칙 (점심 1h / 저녁 0.5h / 야식 0.5h)
  //
  //  근무형태    │ 점심 │ 저녁 │ 야식 │ 비고
  //  주간(day)  │  1h  │  -   │  -   │ OT시 저녁 별도(calcNetHours)
  //  야간(night)│  -   │  -   │ 0.5h │
  //  2교대 주간 │  1h  │ 0.5h │  -   │ 12h → 점심+저녁
  //  2교대 야간 │  -   │  -   │ 0.5h │
  //  3교대 A조  │  1h  │  -   │  -   │ 06~14 주간
  //  3교대 B조  │  -   │ 0.5h │  -   │ 14~22 석간
  //  3교대 C조  │  -   │  -   │ 0.5h │ 22~06 야간
  //  토/일특근  │  1h  │  -   │  -   │ 주간 기본
  //  휴일근무   │  1h  │  -   │  -   │ 야간출근이면 야식
  // ──────────────────────────────────────────────

  // 반환 헬퍼: {lunch, dinner, snack} → dinner=저녁, snack=야식
  const L = lunchBreak;       // 점심 1h
  const D = DINNER_BREAK;     // 저녁 0.5h
  const S = DINNER_BREAK;     // 야식 0.5h (저녁과 시간 동일, 표시만 다름)

  // 비근무 상태
  if(['half','leave','absent','public'].includes(status)) return {lunch:0, dinner:0, snack:0};

  // 휴일근무: 시작시간으로 주간/야간 판단
  if(status==='holiday'){
    const isNight = (start >= 18 || start < 6);
    return isNight ? {lunch:0, dinner:0, snack:S} : {lunch:L, dinner:0, snack:0};
  }

  // 토/일 특근: 주간 → 점심만
  if(status==='sat_work' || status==='sun_work'){
    return {lunch:L, dinner:0, snack:0};
  }

  // 근무형태별
  if(wt==='day'){
    return {lunch:L, dinner:0, snack:0};  // OT 저녁은 calcNetHours에서 별도 처리
  }
  if(wt==='night'){
    return {lunch:0, dinner:0, snack:S};  // 야간: 야식만
  }
  if(wt==='2shift'){
    if(shift==='day')       return {lunch:L, dinner:D, snack:0};  // 주간조: 점심+저녁
    if(shift==='night')     return {lunch:0, dinner:0, snack:S};  // 야간조: 야식만
    if(shift==='day_fixed') return {lunch:L, dinner:0, snack:0};  // 통상조: 주간고정(점심만)
    return {lunch:L, dinner:0, snack:0};
  }
  if(wt==='3shift'){
    if(shift==='A')         return {lunch:L, dinner:0, snack:0};  // A조(07~15): 점심
    if(shift==='B')         return {lunch:0, dinner:D, snack:0};  // B조(15~23): 저녁
    if(shift==='C')         return {lunch:0, dinner:0, snack:S};  // C조(23~07): 야식
    if(shift==='day_fixed') return {lunch:L, dinner:0, snack:0};  // 통상조: 주간고정(점심만)
    return {lunch:L, dinner:0, snack:0};
  }
  return {lunch:L, dinner:0, snack:0};
}

// calcEffectiveStart: 급여 계산용 시작 시간 보정
// 출근 기록은 실제 출근 시각 그대로 저장, 계산만 업무시작(dayStart) 기준으로 보정
// 예) dayStart=9, 출근=8.5 → 계산은 9부터 (조기출근 무시, 정시부터 계산)
// 예) dayStart=9, 출근=9.5 → 그대로 9.5 (지각은 지각시간부터 계산)
function calcEffectiveStart(start, status){
  if(start===null||start===undefined) return start;
  if(wt==='day'){
    if(['work','early','sat_work','sun_work','holiday'].includes(status)){
      return (start < dayStart) ? dayStart : start;
    }
  }
  if(wt==='night'){
    if(status==='work'||status==='early'){
      if(start < nightStart && start >= (nightStart - 2)) return nightStart;
    }
  }
  return start;
}

// calcNetHours: 휴게시간 공제 후 실 근무시간
// - 반차: 4h 고정
// - public: 무급휴가 → 0h
// - 주간(day): effStart(업무시작 기준) → 퇴근 시간까지 raw 계산, 점심1h 공제
//   OT(8h 초과)있으면 저녁0.5h 추가 공제
// 예) 출근=8.5(08:30), dayStart=9, 퇴근=18 → effStart=9, raw=9h, -점심1h=8h
// 예) 출근=8.5(08:30), dayStart=9, 퇴근=20.5 → effStart=9, raw=11.5h, -점심1h-저녁0.5h=10h
// 예) 출근=8.5(08:30), dayStart=9, 퇴근=14 → effStart=9, raw=5h, -점심1h=4h (조퇴, -4h 공제)
function calcNetHours(start, end, status, shift){
  if(status==='half') return 4;
  if(status==='public') return 0;
  const effStart = calcEffectiveStart(start, status);
  const raw = calcHours(effStart, end);
  if(raw <= 0) return 0;
  if(wt==='day' && (status==='work' || status==='early')){
    // 4h 이하 근무: 점심 공제 없음 (근로기준법 - 4시간 이하 시 휴게 의무 없음)
    if(raw <= 4) return raw;
    const afterLunch = raw - lunchBreak;
    // 8h 초과 시 저녁 공제 (effStart 기준 업무시간 8h 초과)
    if(afterLunch > 8){
      return Math.max(0, afterLunch - DINNER_BREAK);
    }
    return Math.max(0, afterLunch);
  }
  if(raw <= 4) return raw;
  const {lunch, dinner, snack} = getBreaks(effStart, status, shift);
  return Math.max(0, raw - lunch - dinner - (snack||0));
}

/**
 * calcNight: 22:00~06:00 구간 시간 계산
 * 모든 근무 상태(work, early, sat_work, sun_work, holiday, public)에 적용
 */
function calcNight(start, end){
  const total = calcHours(start, end);
  if(total<=0) return 0;
  // ★ Fix #10: 소수점 시간(예: 8.5 = 08:30) 처리 — 30분 단위로 누적
  let n=0;
  const steps = Math.round(total * 2); // 30분 단위 총 스텝 수
  let h = start;
  for(let i=0; i<steps; i++){
    if(h>=22 || h<6) n += 0.5;
    h = (h + 0.5) % 24;
  }
  // 정수 반환 (0.5h 단위 반올림)
  return Math.round(n * 2) / 2;
}

// ══════════════════════════════════════════
// 내 프로필 사진 / 이름 (사이드바 직원 카드)
// ══════════════════════════════════════════
function handleEmpAvatar(e){
  const f=e.target.files[0]; if(!f) return;
  const reader=new FileReader();
  reader.onload=ev=>{
    const img=new Image();
    img.onload=()=>{
      const canvas=document.createElement('canvas');
      canvas.width=96; canvas.height=96;
      const ctx=canvas.getContext('2d');
      const s=Math.max(96/img.width,96/img.height);
      const w=img.width*s, h=img.height*s;
      ctx.drawImage(img,(96-w)/2,(96-h)/2,w,h);
      const b64=canvas.toDataURL('image/jpeg',0.85);

      try{
        if(typeof activeWpId!=='undefined' && activeWpId && activeEmpId){
          empUpdate(activeWpId, activeEmpId, {avatar:b64});
        }
      }catch(err){ showToast('⚠️ 저장 공간 부족으로 사진을 저장하지 못했어요'); }
      updateEmpSwitcher();
    };
    img.src=ev.target.result;
  };
  reader.readAsDataURL(f);
}

function editEmpName(){
  const curEmp = (typeof empGet==='function') ? (empGet(activeWpId, activeEmpId) || {}) : {};
  const cur = curEmp.name || '';
  const name = prompt('이름(또는 닉네임)을 입력하세요', cur);
  if(name === null) return; // 취소
  const trimmed = name.trim();
  try{
    if(activeWpId && activeEmpId) empUpdate(activeWpId, activeEmpId, {name: trimmed});
    if(trimmed) memName = trimmed;
  }catch(err){}
  updateEmpSwitcher();
  showToast(trimmed ? `✅ ${trimmed}님으로 변경했어요` : '이름이 초기화됐어요');
}

// ══════════════════════════════════════════
// 로고
// ══════════════════════════════════════════
function handleLogo(e){
  const f=e.target.files[0]; if(!f) return;
  const reader=new FileReader();
  reader.onload=ev=>{
    // ★ 원본 저장 대신 192×192 리사이즈 후 저장 (localStorage 쿼터 보호)
    const img=new Image();
    img.onload=()=>{
      const canvas=document.createElement('canvas');
      canvas.width=192; canvas.height=192;
      const ctx=canvas.getContext('2d');
      ctx.fillStyle='#0d1117';
      ctx.fillRect(0,0,192,192);
      const s=Math.min(192/img.width,192/img.height);
      const w=img.width*s, h=img.height*s;
      ctx.drawImage(img,(192-w)/2,(192-h)/2,w,h);
      const b64=canvas.toDataURL('image/png');

      // 배너 이미지 표시
      const logoImg=document.getElementById('logo-img');
      if(logoImg){ logoImg.src=b64; logoImg.style.display='block'; }
      document.getElementById('logo-ph').style.display='none';

      // favicon / apple-touch-icon 업데이트
      const favicon=document.getElementById('favicon-link');
      if(favicon){ favicon.href=b64; }
      const appleIcon=document.getElementById('apple-icon-link');
      if(appleIcon){ appleIcon.href=b64; }

      // PWA manifest 동적 생성
      updateManifest(b64);

      // localStorage 저장 (single writer: saveCompanyLogo)
      saveCompanyLogo(b64);
    };
    img.src=ev.target.result;
  };
  reader.readAsDataURL(f);
}

// ══════════════════════════════════════════
// 근무형태
// ══════════════════════════════════════════
// ── 아코디언 토글 ──
function toggleAcc(id){
  const body  = document.getElementById('acc-body-'+id);
  const item  = document.getElementById('acc-'+id);
  if(!body || !item) return;
  const isOpen = item.classList.contains('open');
  // 열려있으면 닫기, 닫혀있으면 열기 (다른 것은 닫지 않음 — 동시 열기 허용)
  if(isOpen){
    body.style.display = 'none';
    item.classList.remove('open');
  } else {
    body.style.display = 'block';
    item.classList.add('open');
  }
}

// 근무유형 버튼 클릭 시 해당 인라인 아코디언 열기
function openAccForWT(t){
  const ids = ['day','night','2shift','3shift'];
  ids.forEach(id => {
    const body = document.getElementById('wta-body-' + id);
    if(body) body.style.display = (id === t) ? 'block' : 'none';
  });
}

function setWT(t){
  wt = t;
  document.querySelectorAll('.wt-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('wt-' + t);
  if(btn) btn.classList.add('active');
  openAccForWT(t);
  updateLegend(); renderCalendar(); lsSave();
  // ★ 사이드바 근무형태 텍스트 업데이트
  updateSidebarWTSub(t);
}

// 사이드바 sb-emp-sub의 근무형태 부분만 업데이트
function updateSidebarWTSub(t){
  const subEl = document.getElementById('sb-emp-sub');
  if(!subEl) return;
  const labels = {
    day:    '주간근무',
    night:  '야간근무',
    '2shift':'2교대',
    '3shift':'3교대'
  };
  const wtLabel = labels[t] || '주간근무';
  // 회사명이 있으면 "회사명 · 근무형태", 없으면 "○ 근무형태"
  let companyName = '';
  try{ companyName = localStorage.getItem('atm2_companyName') || ''; }catch(e){}
  if(companyName){
    subEl.textContent = companyName + ' · ' + wtLabel;
  } else {
    subEl.textContent = '○ ' + wtLabel;
  }
}

function setMyShift3(k){
  myShift3 = k;
  p3Sh = k;  // 팝업 기본값도 동기화
  updateLegend();
  lsSave();
  showToast(`📍 ${k}조로 설정했습니다. 날짜 클릭 시 ${k}조가 자동 선택됩니다.`);
}
function updateLegend(){
  const el=document.getElementById('shift-legend');
  if(wt==='day'){
    el.innerHTML=`<div class="legend-dot"><i style="background:var(--accent)"></i>주간 ${pad2(dayStart)}:00 ~ ${pad2((dayStart+8)%24)}:00 (8h)</div>`;
  } else if(wt==='night'){
    el.innerHTML=`<div class="legend-dot"><i style="background:var(--cyan)"></i>야간 ${pad2(nightStart)}:00 ~ ${pad2((nightStart+8)%24)}:00 (8h)</div>`;
  } else if(wt==='2shift'){
    el.innerHTML=`
      <div class="legend-dot"><i style="background:var(--accent)"></i>주간조 08~20</div>
      <div class="legend-dot"><i style="background:var(--cyan)"></i>야간조 20~08</div>`;
  } else if(wt==='3shift'){
    const colors3 = {A:'var(--accent)', B:'var(--accent2)', C:'var(--cyan)'};
    const myBtns = ['A','B','C'].map(k=>{
      const isMine = myShift3===k;
      const col = colors3[k];
      return `<button onclick="setMyShift3('${k}')"
        style="flex:1;padding:8px 4px;border-radius:8px;
               border:2px solid ${isMine?col:'var(--border)'};
               background:${isMine?col.replace(')',',0.15)').replace('var(','rgba(').replace('--accent)','79,124,255,0.15)').replace('--accent2)','124,92,255,0.15)').replace('--cyan)','61,214,214,0.15)'):'transparent'};
               color:${isMine?col:'var(--text3)'};
               font-size:13px;font-weight:800;cursor:pointer;font-family:'Noto Sans KR';transition:all .2s;line-height:1.5;">
        ${k}조<br><span style="font-size:9px;opacity:.75;">${pad2(SHIFT3[k].s)}~${pad2(SHIFT3[k].e)}</span>
      </button>`;
    }).join('');
    el.innerHTML=`
      <div style="font-size:10px;color:var(--text3);padding:0 8px 6px;font-weight:700;">📍 내 소속 조 선택</div>
      <div style="display:flex;gap:5px;padding:0 8px 10px;">${myBtns}</div>
      <div class="legend-dot"><i style="background:var(--accent)"></i>A조 ${pad2(SHIFT3.A.s)}~${pad2(SHIFT3.A.e)}</div>
      <div class="legend-dot"><i style="background:var(--accent2)"></i>B조 ${pad2(SHIFT3.B.s)}~${pad2(SHIFT3.B.e)}</div>
      <div class="legend-dot"><i style="background:var(--cyan)"></i>C조 ${pad2(SHIFT3.C.s)}~${pad2(SHIFT3.C.e)}</div>
      <div style="font-size:10px;color:var(--text3);padding:8px 8px 4px;font-weight:700;">⏱ 교대조 시간 설정</div>
      <div style="padding:0 2px;">${shift3Row('A')} ${shift3Row('B')} ${shift3Row('C')}</div>`;
  } else {
    el.innerHTML='';
  }
}

function shift3Row(label){
  const t = SHIFT3[label];
  const colors = {A:'var(--accent)',B:'var(--accent2)',C:'var(--cyan)'};
  const selStyle = `background:var(--surface2);border:1px solid var(--border);color:var(--text);border-radius:5px;padding:3px 4px;font-size:11px;font-family:'JetBrains Mono';font-weight:700;outline:none;cursor:pointer;width:48px;`;
  let opts = '';
  for(let i=0;i<24;i++){
  opts+=`<option value="${i}">${pad2(i)}:00</option>`;
  opts+=`<option value="${i+0.5}">${pad2(i)}:30</option>`;
}
  // 출근 select
  let sOpts='', eOpts='';
  for(let i=0;i<24;i++){

  // 출근시간
  sOpts+=`<option value="${i}">${pad2(i)}:00</option>`;
  sOpts+=`<option value="${i+0.5}">${pad2(i)}:30</option>`;

  // 퇴근시간
  eOpts+=`<option value="${i}">${pad2(i)}:00</option>`;
  eOpts+=`<option value="${i+0.5}">${pad2(i)}:30</option>`;

}
  return `<div style="margin-bottom:6px;">
    <span style="font-size:11px;font-weight:700;color:${colors[label]};display:inline-block;width:20px;">${label}</span>
    <select style="${selStyle}" onchange="SHIFT3['${label}'].s=parseInt(this.value);if(customShift)customShift['shift3'+('${label}'.toLowerCase())].start=parseInt(this.value);updateLegend();lsSave()">${sOpts}</select>
    <span style="font-size:10px;color:var(--text3);margin:0 2px;">~</span>
    <select style="${selStyle}" onchange="SHIFT3['${label}'].e=parseInt(this.value);if(customShift)customShift['shift3'+('${label}'.toLowerCase())].end=parseInt(this.value);updateLegend();lsSave()">${eOpts}</select>
  </div>`;
}

// ══════════════════════════════════════════
// 주차 유틸
// ══════════════════════════════════════════
function pad2(n){ return String(n).padStart(2,'0'); }
function dk(y,m,d){ return `${y}-${pad2(m+1)}-${pad2(d)}`; }
function weekOfMonth(y,m,d){
  return Math.ceil((d + new Date(y,m,1).getDay()) / 7);
}
function satK(y,m,w){ return `${y}-${pad2(m+1)}-W${w}`; }

// 해당 월의 토요일 목록
function getSatDays(y,m){
  const dim=new Date(y,m+1,0).getDate();
  const sats=[];
  for(let d=1;d<=dim;d++){
    if(new Date(y,m,d).getDay()===6) sats.push({d, w:weekOfMonth(y,m,d)});
  }
  return sats;
}

// 해당 월의 주차별 토/일 날짜 목록
function getWeekendDays(y,m){
  const dim=new Date(y,m+1,0).getDate();
  const weeks={};
  for(let d=1;d<=dim;d++){
    const dow=new Date(y,m,d).getDay();
    if(dow===0||dow===6){
      const w=weekOfMonth(y,m,d);
      if(!weeks[w]) weeks[w]={w, sat:null, sun:null};
      if(dow===6) weeks[w].sat=d;
      if(dow===0) weeks[w].sun=d;
    }
  }
  return Object.values(weeks).sort((a,b)=>a.w-b.w);
}

// ══════════════════════════════════════════
// 주별 토/일 특근 토글
// ══════════════════════════════════════════
// satToggle key: "YYYY-MM-WN-sat" / "YYYY-MM-WN-sun"
function weekKey(y,m,w,type){ return `${y}-${pad2(m+1)}-W${w}-${type}`; }

function applyDayToggle(y,m,d,type,isOn){
  const key=dk(y,m,d);
  if(isOn){
    if(!dayData[key]||!dayData[key].status||dayData[key].status==='none'){
      dayData[key]={status:type==='sat'?'sat_work':'sun_work', start:8, end:17, note:''};
    }
  } else {
    const st = type==='sat'?'sat_work':'sun_work';
    if(dayData[key]&&dayData[key].status===st) delete dayData[key];
  }
}

function toggleWeekDay(y,m,w,type){
  const k=weekKey(y,m,w,type);
  satToggle[k]=!satToggle[k];
  const isOn=satToggle[k];
  const dim=new Date(y,m+1,0).getDate();
  const dow=type==='sat'?6:0;
  for(let d=1;d<=dim;d++){
    if(new Date(y,m,d).getDay()===dow && weekOfMonth(y,m,d)===w){
      applyDayToggle(y,m,d,type,isOn);
    }
  }
  lsSave(); renderCalendar();
}

function toggleAllWeekend(){
  const weeks=getWeekendDays(curY,curM);
  const allOn=weeks.every(wk=>{
    const sk=weekKey(curY,curM,wk.w,'sat');
    const nk=weekKey(curY,curM,wk.w,'sun');
    return (!wk.sat||satToggle[sk])&&(!wk.sun||satToggle[nk]);
  });
  weeks.forEach(wk=>{
    ['sat','sun'].forEach(type=>{
      if((type==='sat'&&wk.sat)||(type==='sun'&&wk.sun)){
        const k=weekKey(curY,curM,wk.w,type);
        satToggle[k]=!allOn;
        const dim=new Date(curY,curM+1,0).getDate();
        const dow=type==='sat'?6:0;
        for(let d=1;d<=dim;d++){
          if(new Date(curY,curM,d).getDay()===dow&&weekOfMonth(curY,curM,d)===wk.w){
            applyDayToggle(curY,curM,d,type,!allOn);
          }
        }
      }
    });
  });
  lsSave(); renderCalendar();
}

function renderWeekSatRow(){
  const row=document.getElementById('week-sat-row');
  const weeks=getWeekendDays(curY,curM);
  row.innerHTML='';
  weeks.forEach(({w,sat,sun})=>{
    const satOn=sat?!!satToggle[weekKey(curY,curM,w,'sat')]:false;
    const sunOn=sun?!!satToggle[weekKey(curY,curM,w,'sun')]:false;

    // ── 주차 근무시간 합계 계산 ──
    let weekH = 0;
    const dim = new Date(curY,curM+1,0).getDate();
    for(let d=1;d<=dim;d++){
      if(weekOfMonth(curY,curM,d)!==w) continue;
      const k=dk(curY,curM,d);
      const dd=dayData[k];
      if(!dd||!dd.status) continue;
      weekH += calcNetHours(dd.start,dd.end,dd.status,dd.shift);
    }
    const isOT = weekH > 40;
    const weekHStr = weekH > 0 ? `${Math.round(weekH*10)/10}h${isOT?` <span style="color:var(--orange);font-size:9px;">OT</span>`:''}` : '';

    const card=document.createElement('div');
    card.className='week-card';
    card.innerHTML=`<div class="wk-label">${w}주 ${weekHStr?`<span style="font-size:10px;color:${isOT?'var(--orange)':'var(--text3)'};font-family:'JetBrains Mono';">${weekHStr}</span>`:''}</div><div class="day-btns"></div>`;
    const btns=card.querySelector('.day-btns');

    if(sat){
      const sb=document.createElement('button');
      sb.className='day-tog'+(satOn?' sat-on':'');
      sb.innerHTML=`<span class="d-date">${sat}(토)</span><div class="d-dot">${satOn?'✓':'+'}</div>`;
      sb.onclick=()=>toggleWeekDay(curY,curM,w,'sat');
      btns.appendChild(sb);
    }
    if(sun){
      const nb=document.createElement('button');
      nb.className='day-tog'+(sunOn?' sun-on':'');
      nb.innerHTML=`<span class="d-date">${sun}(일)</span><div class="d-dot">${sunOn?'✓':'+'}</div>`;
      nb.onclick=()=>toggleWeekDay(curY,curM,w,'sun');
      btns.appendChild(nb);
    }
    row.appendChild(card);
  });
}

// ══════════════════════════════════════════
// 달력
// ══════════════════════════════════════════
function changeMonth(d){
  // ★ v11: 이동 전 현재 월 저장
  if(activeWpId && activeEmpId) attSaveMonth(activeWpId, activeEmpId, curY, curM, dayData);
  curM+=d;
  if(curM>11){curM=0;curY++;}
  if(curM<0){curM=11;curY--;}
  lsLoadMonth(curY,curM); // ★ 해당 월 데이터 로드
  renderCalendar();
}

function renderCalendar(){
  // ★ budget.js의 renderCalendar()와 동일 사유로 추가(이 정의는 로드순서상 budget.js에
  //   쉐도잉되는 비활성 버전이지만, 일관성을 위해 동일하게 둠)
  if(typeof initTutorial === 'function'){ try{ initTutorial(); }catch(e){} }
  // ── 직종 분기 ──
  const _jobs = (typeof loadSelectedJobs==='function') ? loadSelectedJobs() : [];
  if(!_jobs.includes('employee') && _jobs.length > 0){
    const hasAlba     = _jobs.some(j=>['convenience','shortAlba'].includes(j));
    const hasDelivery = _jobs.some(j=>['delivery','driver'].includes(j));
    const hasFree     = _jobs.includes('freelancer');
    const hasEtc      = _jobs.includes('etc');
    // etc 단독
    if(hasEtc && !hasAlba && !hasDelivery && !hasFree){
      if(typeof renderEtcCalendar==='function') renderEtcCalendar();
      return;
    }
    // 프리랜서 단독
    if(hasFree && !hasAlba && !hasDelivery && !hasEtc){
      if(typeof renderFlCalendar==='function') renderFlCalendar();
      return;
    }
    // 알바/배달 or 복수 N잡
    if(typeof renderAlbaCalendar==='function'){
      renderAlbaCalendar();
      return;
    }
  }
  document.getElementById('month-title').textContent=`${curY}년 ${MO_KO[curM]}`;
  const grid=document.getElementById('calendar');
  grid.innerHTML='';
  // 헤더: 일월화수목금토 (일요일 시작)
  [{t:'일',cls:'h-sun'},{t:'월',cls:''},{t:'화',cls:''},{t:'수',cls:''},{t:'목',cls:''},{t:'금',cls:''},
   {t:'토',cls:'h-sat'}].forEach(d=>{
    const h=document.createElement('div');
    h.className='cal-hdr'+(d.cls?' '+d.cls:'');
    h.textContent=d.t; grid.appendChild(h);
  });
  // 일요일 시작 빈칸 계산 (일=0, 월=1, ..., 토=6)
  const rawDow=new Date(curY,curM,1).getDay(); // 0=일
  const firstDow=rawDow;                        // 0=일, 6=토 그대로
  const dim=new Date(curY,curM+1,0).getDate();
  const today=new Date();
  for(let i=0;i<firstDow;i++){ const e=document.createElement('div');e.className='cal-day empty';grid.appendChild(e); }

  // 통계 집계
  let wDays=0,lDays=0,absDays=0,totOT=0,satH=0,sunH=0;

  for(let d=1;d<=dim;d++){
    const key=dk(curY,curM,d);
    const data=dayData[key]||null;
    const dow=new Date(curY,curM,d).getDay();
    const isToday=today.getFullYear()===curY&&today.getMonth()===curM&&today.getDate()===d;
    const isSun=dow===0, isSat=dow===6;
    const w=weekOfMonth(curY,curM,d);
    const satOn=isSat&&!!satToggle[weekKey(curY,curM,w,'sat')];
    const sunOn=isSun&&!!satToggle[weekKey(curY,curM,w,'sun')];

    const el=document.createElement('div');
    el.className='cal-day'+(isToday?' today':'')+(isSun?' is-sun':'')+(isSat?' is-sat':'')+(satOn?' sat-on':'')+(sunOn?' sun-on':'');
    el.onclick=()=>openPopup(key,d);

    if(data){
      const s=data.status;
      const net=calcNetHours(data.start,data.end,s,data.shift);
      if(s==='work'||s==='early') wDays++;
      if(s==='half'){wDays++;}
      if(s==='leave') lDays++;
      if(s==='absent') absDays++;
      if(s==='work'||s==='early') totOT+=Math.max(0,net-8);
      if(s==='sat_work') satH+=net;
      if(s==='sun_work') sunH+=net;
    }

    let html=`<div class="dn">${d}</div>`;
    // 공휴일 DB 표시 (status 없어도 날짜 이름 표시)
    const hName = HOLIDAYS[key];
    if(hName && (!data||!data.status||data.status==='none')){
      html+=`<div style="font-size:8px;color:var(--orange);margin-bottom:2px;line-height:1.2;">${hName}</div>`;
    }
    if(data&&data.status&&data.status!=='none'){
      const s=data.status;
      html+=`<div class="ds ${ST_CLS[s]||''}">${ST_LBL[s]||s}</div>`;
      const net=calcNetHours(data.start,data.end,s,data.shift);
      const showT=['work','early','half','sat_work','sun_work','holiday','public'].includes(s);
      if(showT&&data.start!==undefined){
        if(data.end!==undefined&&data.end!==data.start){
          // 조기출근 시 effStart(dayStart) 기준으로 공제 계산
          const effSt = calcEffectiveStart(data.start, s);
          const rawNet = calcHours(effSt, data.end);
          const {lunch:lb, dinner:db, snack:sb} = (s!=='half'&&rawNet>4) ? getBreaks(effSt,s,data.shift) : {lunch:0,dinner:0,snack:0};
          const totalBreak = lb+db;
          const breakTxt = totalBreak>0 ? `-${totalBreak}h` : '';
          const netRounded = Math.round(net*10)/10;
          // 조기출근 표시
          const isEarlyArr = wt==='day' && data.start < dayStart && ['work','early'].includes(s);
          html+=`<div class="dt" style="font-size:11px;"><span style="color:var(--green);font-weight:700;">출</span> ${fmtTime(data.start)}${isEarlyArr?`<span style="font-size:9px;color:var(--text3);">(${pad2(dayStart)}시↑)</span>`:''}</div>`;
          html+=`<div class="dt" style="font-size:11px;"><span style="color:var(--red);font-weight:700;">퇴</span> ${fmtTime(data.end)} <span style="color:var(--text3);">(${netRounded}h${breakTxt})</span></div>`;
        } else {
          html+=`<div class="dt" style="color:var(--yellow);">${fmtTime(data.start)} 출근</div>`;
          html+=`<div class="dt" style="color:var(--text3);font-size:10px;">퇴근 미기록</div>`;
          // 퇴근 미기록 경고 배지 (오늘 이전 날짜만)
          const isPast = new Date(curY,curM,d) < new Date(today.getFullYear(),today.getMonth(),today.getDate());
          if(isPast) html+=`<div style="position:absolute;bottom:3px;left:3px;font-size:9px;background:rgba(255,209,102,.85);color:#7a5800;padding:1px 4px;border-radius:3px;font-weight:700;">⚠ 퇴근?</div>`;
          if(isPast) el.style.borderColor='rgba(255,209,102,.6)';
        }
      }
      if((s==='work'||s==='early')&&net>8) html+=`<div class="ot-b">OT+${Math.round((net-8)*10)/10}h</div>`;
      // ── 지각 배지 (주간근무 + 출근 늦음) ──
      if(wt==='day' && (s==='work'||s==='early') && data.start!==undefined && data.start > dayStart){
        const lateRaw = data.start - dayStart;
        const lateRnd = Math.ceil(lateRaw / 0.5) * 0.5;
        html+=`<div style="position:absolute;top:3px;left:3px;font-size:9px;background:rgba(255,92,122,.85);color:#fff;padding:1px 4px;border-radius:3px;font-weight:700;">지각${lateRnd*60|0}분</div>`;
      }
      // ── 조퇴 공제 배지 ──
      if(s==='early' && net > 0 && net < 8){
        const shortage = Math.round((8 - net) * 10) / 10;
        html+=`<div style="font-size:9px;color:var(--red);margin-top:1px;">-${shortage}h 공제</div>`;
      }
      if(s==='sat_work'&&net>0) html+=`<div class="ot-b" style="background:var(--sat)">특근${net}h</div>`;
      if(s==='sun_work'&&net>0) html+=`<div class="ot-b" style="background:var(--sun)">특근${net}h</div>`;
      if(data.shift){
        const sc={A:'#4f7cff',B:'#7c5cff',C:'#3dd6d6',day:'#4f7cff',night:'#3dd6d6'};
        const sl={A:'A조',B:'B조',C:'C조',day:'주간',night:'야간'};
        html+=`<div class="sh-b" style="background:${sc[data.shift]};color:#fff">${sl[data.shift]}</div>`;
      }
      if(data.note){
        if(['leave','absent'].includes(s)){
          html+=`<div style="font-size:9px;color:var(--green);margin-top:2px;font-weight:600;
                             line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"
                      title="${data.note}">📝 ${data.note}</div>`;
        } else {
          html+=`<div style="font-size:9px;color:var(--yellow);margin-top:1px;">📝</div>`;
        }
      }
    }
    // ── N잡 데이터 달력 표시 (아이콘만) ──
    try{
      const njRaw = localStorage.getItem('atm2_njob_'+key);
      if(njRaw){
        const nj = JSON.parse(njRaw);
        const hasAlba     = (nj.alba||[]).length > 0;
        const hasDelivery = (nj.delivery||[]).length > 0;
        const hasFree     = (nj.free||[]).length > 0;
        const hasNight    = (nj.alba||[]).some(it=>it.nightHours>0);

        if(hasAlba || hasDelivery || hasFree){
          let icons = '';
          if(hasAlba)     icons += hasNight ? '⏰🌙' : '⏰';
          if(hasDelivery) icons += '🛵';
          if(hasFree)     icons += '💻';
          html += `<div style="font-size:11px;margin-top:2px;line-height:1.2;">${icons}</div>`;
          el.style.borderColor = 'rgba(255,140,66,.4)';
        }
      }
    }catch(e){}

    el.innerHTML=html;
    grid.appendChild(el);
  }
  renderWeekSatRow();
  renderStats(wDays,lDays,absDays,totOT,satH,sunH);
  // ★ 사이드바 이번달 요약 갱신
  setTimeout(updateSbSummary, 0);
  // ★ 오늘 칸 자동 스크롤 제거(budget.js의 renderCalendar()와 동일 사유) —
  //   오늘 칸은 .cal-day.today 클래스 강조로 스크롤 없이도 식별 가능.
}

function renderStats(wDays,lDays,absDays,totOT,satH,sunH){
  const twd = countWD(curY,curM);
  // 실수령액 계산
  // ★ budget.js의 renderStats()와 동일 사유로 finalPay 참조로 통일(이전엔 netPay=grossPay)
  // ★ Income Gateway: 직업유형과 무관하게 직장인 전용 계산만 보여주던 버그 수정
  let netPay = 0, basePay = 0, totAllow = 0, totDeduct = 0;
  try {
    const _selJobsHero2 = (typeof loadSelectedJobs==='function') ? loadSelectedJobs() : [];
    if(_selJobsHero2.indexOf('employee')>=0){
      const pd = getPayData();
      if(pd){ netPay=pd.finalPay||0; basePay=pd.basePay||0; totAllow=pd.totAllow||0; totDeduct=pd.totDeduct||0; }
    } else if(typeof getIncomeSummary==='function'){
      const summary = getIncomeSummary(curY, curM);
      netPay = summary.total || 0;
    }
  } catch(e){}

  // 이번달 진행률
  const today = new Date();
  const isCurMonth = (today.getFullYear()===curY && today.getMonth()===curM);
  const passedDays = isCurMonth ? today.getDate() : new Date(curY,curM+1,0).getDate();
  const totalDays  = new Date(curY,curM+1,0).getDate();
  const progress   = Math.round((passedDays/totalDays)*100);

  // 예상 실수령 vs 전월
  const prevYM = curM===0 ? `${curY-1}_11` : `${curY}_${String(curM-1).padStart(2,'0')}`;
  const prevPay = parseInt(localStorage.getItem(`pay_prev_${curY}_${curM}`) || '0');
  const diff = netPay - prevPay;
  const diffSign = diff > 0 ? '+' : '';
  const diffColor = diff >= 0 ? 'var(--green)' : 'var(--red)';

  // 힌트 카드: 튜토리얼 건너뛴 신규 사용자에게 한 번만 표시
  const _hintKey = 'moneynyang_start_hint_dismissed';
  const _skipDone = localStorage.getItem('moneynyang_tutorial_done') === '2' || localStorage.getItem('atm2_onboarding_done') === '1';
  const _hintDismissed = localStorage.getItem(_hintKey);
  const _hintCard = (!_hintDismissed && _skipDone) ? `
    <div id="start-hint-card" style="width:100%;background:linear-gradient(135deg,rgba(79,124,255,.12),rgba(79,124,255,.05));border:1px solid rgba(79,124,255,.3);border-radius:14px;padding:14px 16px;margin-bottom:8px;position:relative;">
      <button onclick="localStorage.setItem('${_hintKey}','1');document.getElementById('start-hint-card')?.remove();"
        style="position:absolute;top:8px;right:10px;background:none;border:none;color:var(--text3);font-size:18px;cursor:pointer;line-height:1;">✕</button>
      <div style="font-size:13px;font-weight:700;color:var(--accent);margin-bottom:8px;">👋 머니냥 시작하는 법</div>
      <div style="font-size:12px;color:var(--text2);line-height:1.9;">
        ① 설정에서 <b>시급·급여일</b>을 입력하세요<br>
        ② 날짜를 눌러 <b>오늘 출근</b>을 기록하세요<br>
        ③ 기록할수록 <b>예상 실수령액</b>이 자동 계산됩니다
      </div>
      <button onclick="if(typeof startTutorial==='function')startTutorial();else if(typeof uigStart==='function')uigStart();"
        style="margin-top:10px;padding:6px 14px;border-radius:20px;border:1px solid var(--accent);background:none;color:var(--accent);font-size:12px;font-weight:700;cursor:pointer;font-family:'Noto Sans KR';">📖 사용법 보기</button>
    </div>` : '';

  // 계산 근거 한 줄 생성
  const _selJobsHero3 = (typeof loadSelectedJobs==='function') ? loadSelectedJobs() : [];
  let _calcBasis = '';
  if(_selJobsHero3.indexOf('employee')>=0 && hourlyRate > 0){
    const _pd2 = (function(){ try{ return getPayData(); }catch(e){ return null; } })();
    const _bh = (_pd2 && _pd2.BASE_HOURS) ? _pd2.BASE_HOURS : 209;
    const _parts = [`시급 ${hourlyRate.toLocaleString()}원 × ${_bh}h`];
    if(lDays > 0) _parts.push(`연차 ${lDays}일`);
    if(_pd2 && (_pd2.insWH||_pd2.ins) && (_pd2.insWH||_pd2.ins).total > 0) _parts.push('공제 반영');
    _calcBasis = _parts.join(' · ');
  }

  document.getElementById('stats-row').innerHTML = _hintCard + `
    <div style="width:100%;display:flex;gap:10px;flex-wrap:wrap;">

      <!-- 히어로: 예상 실수령 -->
      <div style="flex:2;min-width:200px;align-self:flex-start;background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px 20px;position:relative;">
        <div style="font-size:11px;color:var(--text3);font-weight:600;letter-spacing:.5px;margin-bottom:6px;padding-right:110px;">예상 실수령액
          <span style="font-weight:400;opacity:.85;">· 기록할수록 더 정확해져요</span>
        </div>
        <div style="font-size:28px;font-weight:900;font-family:'JetBrains Mono';color:var(--green);line-height:1.1;">
          ${netPay > 0 ? netPay.toLocaleString() + '<span style="font-size:14px;font-weight:600;margin-left:2px;">원</span>' : '<span style="font-size:15px;color:var(--text3);">날짜를 눌러 근무를 기록하면 예상 급여가 표시돼요</span>'}
        </div>
        ${prevPay > 0 && netPay > 0 ? `<div style="font-size:11px;margin-top:5px;color:${diffColor};">${diffSign}${diff.toLocaleString()}원 <span style="color:var(--text3);">전월 대비</span></div>` : ''}
        <div style="margin-top:10px;">
          <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text3);margin-bottom:3px;">
            <span>이번달 진행</span><span>${progress}%</span>
          </div>
          <div style="height:4px;background:var(--surface3);border-radius:2px;overflow:hidden;">
            <div style="height:100%;width:${progress}%;background:var(--accent);border-radius:2px;transition:width .6s ease;"></div>
          </div>
        </div>
        ${_calcBasis ? `<div style="font-size:11px;color:var(--text3);margin-top:8px;line-height:1.5;">${_calcBasis}</div>` : ''}
        <div style="font-size:12px;font-weight:700;color:var(--accent);margin-top:10px;">이 돈으로 다음 월급날까지 버틸 수 있을까요?</div>
        <div style="position:absolute;top:12px;right:14px;font-size:10px;color:var(--text3);text-align:right;line-height:1.6;">
          <div>기본급 <b style="color:var(--text2);font-family:'JetBrains Mono';">${basePay > 0 ? (basePay).toLocaleString() : '—'}</b></div>
          <div>공제 <b style="color:var(--red);font-family:'JetBrains Mono';">${totDeduct > 0 ? '-'+totDeduct.toLocaleString() : '—'}</b></div>
        </div>
      </div>

      <!-- 서브 카드들 -->
      <div style="flex:3;min-width:280px;display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">

        <div class="stat-card" style="border-left:3px solid var(--accent);">
          <div class="lbl">근무일수</div>
          <div class="val" style="color:var(--accent);">${wDays}<span style="font-size:11px;color:var(--text3);font-weight:400;">/${twd}</span></div>
          <div style="font-size:10px;color:var(--text3);margin-top:2px;">총 근무일</div>
        </div>

        <div class="stat-card" onclick="toggleLeavePanel()" style="cursor:pointer;border-left:3px solid var(--green);" title="연차 현황 보기">
          <div class="lbl">연차 사용 <span style="font-size:9px;color:var(--accent);">▶</span></div>
          <div class="val" style="color:var(--green);">${lDays}<span style="font-size:11px;color:var(--text3);font-weight:400;">일</span></div>
          <div style="font-size:10px;color:var(--text3);margin-top:2px;">탭 → 현황</div>
        </div>

        <div class="stat-card" style="border-left:3px solid var(--yellow);">
          <div class="lbl">총 OT</div>
          <div class="val" style="color:var(--yellow);">${Math.round(totOT*10)/10}<span style="font-size:11px;color:var(--text3);font-weight:400;">h</span></div>
          <div style="font-size:10px;color:var(--text3);margin-top:2px;">연장근무</div>
        </div>

        ${absDays > 0 ? `
        <div class="stat-card" style="border-left:3px solid var(--red);">
          <div class="lbl">결근</div>
          <div class="val" style="color:var(--red);">${absDays}<span style="font-size:11px;color:var(--text3);font-weight:400;">일</span></div>
          <div style="font-size:10px;color:var(--text3);margin-top:2px;">공제 주의</div>
        </div>` : ''}

        ${satH > 0 ? `
        <div class="stat-card" style="border-left:3px solid var(--sat);">
          <div class="lbl">토요특근</div>
          <div class="val" style="color:var(--sat);">${satH}<span style="font-size:11px;color:var(--text3);font-weight:400;">h</span></div>
          <div style="font-size:10px;color:var(--text3);margin-top:2px;">×1.5 수당</div>
        </div>` : ''}

        ${sunH > 0 ? `
        <div class="stat-card" style="border-left:3px solid var(--sun);">
          <div class="lbl">일요특근</div>
          <div class="val" style="color:var(--sun);">${sunH}<span style="font-size:11px;color:var(--text3);font-weight:400;">h</span></div>
          <div style="font-size:10px;color:var(--text3);margin-top:2px;">×2.0 수당</div>
        </div>` : ''}

      </div>
    </div>`;
}

function countWD(y,m){
  const dim=new Date(y,m+1,0).getDate(); let c=0;
  for(let d=1;d<=dim;d++){const dw=new Date(y,m,d).getDay();if(dw!==0&&dw!==6)c++;}
  return c;
}

// ══════════════════════════════════════════
// 팝업
// ══════════════════════════════════════════
function defTimes(status){
  if(status==='sat_work'||status==='sun_work') return {s:dayStart, e:(dayStart+8)%24};
  if(status==='holiday'||status==='public')   return {s:dayStart, e:(dayStart+8)%24};
  if(status==='half'){
    // 야간고정 근무자는 반차 기본 시간도 야간 시작 기준으로 계산
    if(wt==='night') return {s:nightStart, e:(nightStart+4)%24};
    return {s:dayStart, e:(dayStart+4)%24};
  }
  if(wt==='3shift'){
    var _sh3 = (p3Sh==='day_fixed') ? 'A' : p3Sh;
    return SHIFT3 && SHIFT3[_sh3] ? {s:SHIFT3[_sh3].s, e:SHIFT3[_sh3].e} : {s:7, e:15};
  }
  if(wt==='2shift'){
    var _sh2 = (p2Sh==='day_fixed') ? 'day' : p2Sh;
    return (typeof SHIFT2 !== 'undefined' && SHIFT2 && SHIFT2[_sh2])
      ? {s:SHIFT2[_sh2].s, e:SHIFT2[_sh2].e}
      : (_sh2==='night' ? {s:19, e:7} : {s:7, e:19});
  }
  if(wt==='night')  return {s:nightStart, e:(nightStart+8)%24};
  // ★ 주간고정 기본값: 단순히 +8h가 아니라 점심시간(lunchBreak)까지 더한 "정상퇴근시각"으로 맞춤.
  //   updatePrev()의 normalEndH(=dayStart+8+lunchBreak) 기준과 일치시켜, 신규/빈 날짜를 처음 열었을 때
  //   사용자가 아무것도 안 바꿔도 "조퇴 공제"가 잘못 표시되던 문제를 근본적으로 해소.
  return {s:dayStart, e:(dayStart+8+lunchBreak)%24};
}

function openPopup(key,d){
  editKey=key;
  const saved=dayData[key];
  pSt=saved?.status||'work';
  // 저장된 교대 서브타입 복원 (초기 접속 시)
  var _storedSub = '';
  try{ _storedSub = localStorage.getItem('atm2_workSubType')||''; }catch(e){}
  var _defaultP2 = (wt==='2shift' && _storedSub && _storedSub!=='day_fixed') ? _storedSub : 'day';
  var _defaultP3 = (wt==='3shift' && _storedSub && ['A','B','C'].indexOf(_storedSub)>=0) ? _storedSub : myShift3||'A';
  p2Sh = saved?.shift || _defaultP2;
  p3Sh = saved?.shift || _defaultP3;
  document.getElementById('p-title').textContent=`📅 ${curY}년 ${curM+1}월 ${d}일`;
  const noteEl=document.getElementById('p-note');
  noteEl.value=saved?.note||'';
  const noteCount = document.getElementById('note-char-count');
  if(noteCount) noteCount.textContent = (saved?.note||'').length + '/200';

  // 교대 선택 표시/숨김
  // 통상조(고정)면 조 선택 불필요
  var _subType2 = '';
  var _subType3 = '';
  try{ _subType2 = localStorage.getItem('atm2_workSubType')||''; }catch(e){}
  _subType3 = _subType2;
  var _show2row = wt==='2shift' && (!_subType2 || _subType2==='');
  var _show3row = wt==='3shift' && (!_subType3 || ['A','B','C'].indexOf(_subType3)<0 ? false : _subType3==='');
  // 순환교대(기록마다 조 선택)이면 버튼 표시, 고정조면 숨김
  var _is2fixed = wt==='2shift' && (_subType2==='day'||_subType2==='night'||_subType2==='day_fixed');
  var _is3fixed = wt==='3shift' && (_subType3==='A'||_subType3==='B'||_subType3==='C'||_subType3==='day_fixed');
  document.getElementById('shift2-row').style.display = (wt==='2shift' && !_is2fixed) ? 'block' : 'none';
  document.getElementById('shift3-row').style.display = (wt==='3shift' && !_is3fixed) ? 'block' : 'none';
  // 고정조 안내 표시
  var _s2fix = document.getElementById('shift2-fixed-info');
  var _s3fix = document.getElementById('shift3-fixed-info');
  if(_s2fix){
    if(wt==='2shift' && _is2fixed){
      var _lbl2 = document.getElementById('shift2-fixed-label');
      if(_lbl2) _lbl2.textContent = _subType2==='day'?'☀️ 주간 고정조 — 자동 적용':_subType2==='night'?'🌙 야간 고정조 — 자동 적용':'👔 통상조(주간) — 자동 적용';
      _s2fix.style.display='block';
    } else { _s2fix.style.display='none'; }
  }
  if(_s3fix){
    if(wt==='3shift' && _is3fixed){
      var _lbl3 = document.getElementById('shift3-fixed-label');
      var _lblMap3 = {A:'⚡ A조 고정',B:'⚡ B조 고정',C:'⚡ C조 고정',day_fixed:'👔 통상조(주간)'};
      if(_lbl3) _lbl3.textContent = (_lblMap3[_subType3]||'고정조') + ' — 자동 적용';
      _s3fix.style.display='block';
      // 고정조면 p3Sh 자동 설정
      if(_subType3==='day_fixed') p3Sh='A';
      else p3Sh=_subType3;
    } else { _s3fix.style.display='none'; }
  }
  if(wt==='2shift' && _is2fixed){ p2Sh = _subType2==='day_fixed'?'day':_subType2; }
  if(wt==='3shift'){
    try{
      ['A','B','C'].forEach(k=>{
        const el=document.getElementById('sh3-'+k+'-time');
        if(el && typeof SHIFT3!=='undefined' && SHIFT3[k])
          el.textContent=pad2(SHIFT3[k].s)+'~'+pad2(SHIFT3[k].e);
      });
    }catch(e){}
  }
  try{ syncSh(); }catch(e){}

  // 소형 버튼 선택 상태 반영
  document.querySelectorAll('.s-opt-sm').forEach(e=>e.classList.toggle('sel',e.dataset.s===pSt));

  // 기존 기록 현황 표시
  const cur=document.getElementById('p-current');
  if(saved && saved.status && saved.status!=='none'){
    const stMap={work:'✅ 출근',leave:'🌿 연차',half:'⏰ 반차',early:'🚶 조퇴',
                 absent:'❌ 결근',holiday:'🌙 휴일근무',public:'🏛️ 공휴일',
                 sat_work:'🔵 토요특근',sun_work:'🔴 일요특근'};
    let txt=`현재: <b>${stMap[saved.status]||saved.status}</b>`;
    if(saved.start!==undefined){
      txt+=` &nbsp;|&nbsp; 출근 <b>${fmtTime(saved.start)}</b> → 퇴근 <b>${fmtTime(saved.end)}</b>`;
    }
    cur.innerHTML=txt;
    cur.style.display='block';
  } else {
    cur.style.display='none';
  }

  // 힌트 배너 초기화
  const hint = document.getElementById('half-early-hint');
  if(hint) hint.style.display='none';

  // 출근/퇴근 대형 버튼 항상 표시
  const ci=document.getElementById('btn-checkin');
  const co=document.getElementById('btn-checkout');
  if(ci) ci.style.display='';
  if(co) co.style.display='';

  // 저장 버튼 초기화
  const saveBtn=document.getElementById('time-save-btn');
  if(saveBtn) saveBtn.style.display='none';

  // 기존 기록이 반차/조퇴/특근인 경우 → 시간 섹션 자동 전개
  if(saved && ['half','early','sat_work','sun_work','holiday'].includes(saved.status)){
    selStAndTime(saved.status);
  } else {
    // work 기록 있으면 시간 편집 섹션도 표시
    if(saved && saved.status==='work') pSt='work';
    renderTimeSec();
  }

  // 비고에 시간 패턴 있으면 자동추출 버튼 표시
  updateParseRow();

  // 직장 섹션: 항상 펼침
  try{
    const empBody = document.getElementById('employee-acc-body');
    if(empBody) empBody.style.display = 'block';
  }catch(e){}

  // N잡 아코디언 초기화
  try{
    if(typeof initDayJobTabs === 'function') initDayJobTabs(key);
    if(typeof njobRefresh === 'function') njobRefresh(key);
    if(typeof njobBindPreviews === 'function') njobBindPreviews();
  }catch(e){}

  // 팝업 표시 — 항상 마지막에 실행 보장
  document.getElementById('popup').style.display='flex';
}

function updateParseRow(){
  const note=document.getElementById('p-note').value;
  const hasTime=/출근\s*\d{1,2}[:：시]\d{2}|퇴근\s*\d{1,2}[:：시]\d{2}/i.test(note);
  document.getElementById('p-parse-row').style.display=hasTime?'block':'none';
}

function selSt(s){ pSt=s; document.querySelectorAll('.s-opt-sm').forEach(e=>e.classList.toggle('sel',e.dataset.s===s)); }
function selShift2(s){ p2Sh=s; syncSh(); renderTimeSec(); }
function selShift3(s){ p3Sh=s; syncSh(); renderTimeSec(); }

// ── 반차/조퇴/특근: 상태 선택 + 시간 섹션 표시 (팝업 유지) ──
function selStAndTime(type){
  pSt = type;
  document.querySelectorAll('.s-opt-sm').forEach(e=>e.classList.toggle('sel', e.dataset.s===type));

  // 힌트 배너 표시 (반차/조퇴만)
  const hint = document.getElementById('half-early-hint');
  const hintLabel = document.getElementById('half-early-hint-label');
  if(hint){
    const isHalfEarly = (type==='half'||type==='early');
    hint.style.display = isHalfEarly ? 'block' : 'none';
    if(hintLabel){
      hintLabel.textContent = type==='half' ? '반차' : type==='early' ? '조퇴' : '';
    }
  }

  // 출근/퇴근 대형 버튼은 항상 유지 (숨기지 않음)
  const ci = document.getElementById('btn-checkin');
  const co = document.getElementById('btn-checkout');
  if(ci) ci.style.display = '';
  if(co) co.style.display = '';

  renderTimeSec();
}

function syncSh(){
  document.querySelectorAll('#shift2-row .sh-btn').forEach(b=>b.classList.toggle('sel',(p2Sh==='day'&&b.textContent.includes('주간'))||(p2Sh==='night'&&b.textContent.includes('야간'))));
  const m3={'A조':'A','B조':'B','C조':'C'};
  document.querySelectorAll('#shift3-row .sh-btn').forEach(b=>b.classList.toggle('sel',m3[b.textContent]===p3Sh));
}

function buildSel(id,val){
  let h=`<select class="t-sel" id="${id}" onchange="updatePrev()">`;

  for(let i=0;i<24;i++){

    const h0 = i;
    const h30 = i + 0.5;

    h += `<option value="${h0}" ${val===h0?'selected':''}>${pad2(i)}:00</option>`;
    h += `<option value="${h30}" ${val===h30?'selected':''}>${pad2(i)}:30</option>`;

  }

  return h+'</select>';
}

function renderTimeSec(){
  const ts=document.getElementById('time-sec');
  const tc=document.getElementById('time-container');
  const need=['work','early','half','sat_work','sun_work','holiday','public'].includes(pSt);
  ts.style.display=need?'block':'none';
  if(!need){tc.innerHTML='';document.getElementById('calc-prev').style.display='none';return;}

  const saved=dayData[editKey];
  const def=defTimes(pSt);
  const sv=saved?.start!==undefined?saved.start:def.s;
  const ev=saved?.end  !==undefined?saved.end  :def.e;

  let sL='출근시간',eL='퇴근시간';
  if(pSt==='sat_work'){sL='토요출근';eL='토요퇴근';}
  else if(pSt==='sun_work'){sL='일요출근';eL='일요퇴근';}
  else if(pSt==='holiday'||pSt==='public'){sL='근무시작';eL='근무종료';}
  else if(pSt==='half'){sL='출근시간';eL='반차종료';}
  else if(wt==='night'&&pSt==='work'){sL='야간시작';eL='야간종료';}

  tc.innerHTML=`<div class="time-row"><label>${sL}</label>${buildSel('t-start',sv)}</div>
                <div class="time-row"><label>${eL}</label>${buildSel('t-end',ev)}</div>`;

  // 반차/조퇴/특근은 저장 버튼 표시 (출근/퇴근 대형버튼 대신)
  const saveBtn = document.getElementById('time-save-btn');
  const needSaveBtn = ['half','early','sat_work','sun_work','holiday'].includes(pSt);
  if(saveBtn){
    saveBtn.style.display = needSaveBtn ? 'block' : 'none';
    const labelMap = {half:'⏰ 반차 저장', early:'🚶 조퇴 저장',
                      sat_work:'🔵 토요특근 저장', sun_work:'🔴 일요특근 저장', holiday:'🌙 휴일근무 저장'};
    saveBtn.textContent = labelMap[pSt] || '✅ 저장';
  }

  updatePrev();
}

function updatePrev(){
  const se=document.getElementById('t-start');
  const ee=document.getElementById('t-end');
  const pv=document.getElementById('calc-prev');
  if(!se||!ee){pv.style.display='none';return;}
  const s=parseFloat(se.value), e=parseFloat(ee.value);
  // 팝업에서 현재 교대조(p2Sh/p3Sh) 반영
  const curShift = wt==='2shift'?p2Sh : wt==='3shift'?p3Sh : null;
  // 급여 계산용 보정 시작 시간 (조기출근 시 dayStart로 보정)
  const effS = calcEffectiveStart(s, pSt);
  const raw=calcHours(effS, e);
  const net=calcNetHours(s,e,pSt,curShift);  // 내부에서 effStart 자동 적용
  const nightH=calcNight(effS, e);
  const ot=Math.max(0,net-8);

  // 조기출근 여부 표시
  const earlyArrival = (wt==='day' && s < dayStart && ['work','early'].includes(pSt));
  const effStr = earlyArrival ? `<span style="color:var(--text3);font-size:10px;">(업무시작 ${dayStart}:00 기준)</span>` : '';

  // 재직시간 / 공제 / 실근무 표시용
  // raw = calcHours(effS, e) = 조기출근 보정 후 체류시간 (점심 포함)
  // 재직 = raw, 실근무 = raw - 점심 = net
  let deductTxt='';
  if(wt==='day' && (pSt==='work'||pSt==='early')){
    const afterLunch = raw - lunchBreak;
    const dinnerUsed = afterLunch > 8 ? DINNER_BREAK : 0;
    const stayH = Math.round(raw * 10) / 10;  // raw 자체가 재직(점심 포함 체류)
    deductTxt = `재직 ${stayH}h - 점심 ${lunchBreak}h${dinnerUsed > 0 ? ` - 저녁 ${dinnerUsed}h` : ''} = 실근무 ${net}h`;
  } else {
    const {lunch:lbUsed, dinner:dbUsed, snack:sbUsed} = (pSt!=='half'&&raw>4) ? getBreaks(effS,pSt,curShift) : {lunch:0,dinner:0,snack:0};
    if(lbUsed + dbUsed + (sbUsed||0) > 0){
      const stayH2 = Math.round(raw * 10) / 10;
      deductTxt = `재직 ${stayH2}h`
        + (lbUsed > 0 ? ` - 점심 ${lbUsed}h` : '')
        + (dbUsed > 0 ? ` - 저녁 ${dbUsed}h` : '')
        + ((sbUsed||0) > 0 ? ` - 저녁·야식 ${sbUsed}h` : '')
        + ` = 실근무 ${net}h`;
    }
  }
  const oMult = 1.5;   // 연장: ×1.5 전액
  const hMult = 2.0;   // 휴일: ×2.0 전액
  const nMult = 0.5;   // 야간: ×0.5 가산분만 (기본 1배는 normalH/OT에 포함됨, getPayData와 동일 배율)

  if(s===e){pv.style.display='block';pv.innerHTML='⚠️ 시작·종료 시간이 같습니다. 근무시간이 0으로 처리됩니다.';return;}

  // public = 법정공휴일(무급휴가) 안내
  if(pSt==='public'){
    pv.style.display='block';
    pv.innerHTML='📅 <b>법정공휴일 (무급휴가)</b><br>근무하지 않는 날로 처리됩니다.<br><span style="color:var(--red)">기본급 8h 공제</span>';
    return;
  }

  const baseAmt = Math.min(net,8) * hourlyRate;

  // 조기출근 표시 (08:30 출근 → 09:00부터 계산)
  const earlyArrTxt = earlyArrival
    ? `<div style="font-size:11px;color:var(--text3);margin-bottom:3px;">⏰ 출근: ${pad2(Math.floor(s))}:${s%1?'30':'00'} → 업무시작 <b style="color:var(--yellow)">${pad2(dayStart)}:00</b> 기준 계산 (조기출근 무급)</div>` : '';

  // 지각 표시
  let lateTxt = '';
  if(wt==='day' && (pSt==='work'||pSt==='early') && s > dayStart){
    const lateRaw = s - dayStart;
    const lateRnd = Math.ceil(lateRaw / 0.5) * 0.5;
    lateTxt = `<div style="font-size:11px;color:var(--red);margin-bottom:3px;">⚠️ 지각 ${Math.round(lateRaw*60)}분 → 30분 단위 올림 <b>${lateRnd*60|0}분 공제</b> (-${fmt(lateRnd*hourlyRate)})</div>`;
  }

  // 조퇴 공제 표시
  let earlyLeaveTxt = '';
  {
    const normalEndH = dayStart + 8 + lunchBreak;  // 정상퇴근 시각 (예: 9+8+1=18)
    // 조퇴 조건: 주간근무 + 실퇴근이 정상퇴근보다 이름 + 실근무 8h 미달
    const isEarlyLeave = (pSt==='early'||pSt==='work') && wt==='day'
                       && net > 0 && net < 8
                       && e < normalEndH;
    if(isEarlyLeave){
      const shortage = Math.round((8 - net) * 10) / 10;
      const normalEndHH = pad2(Math.floor(normalEndH));
      const normalEndMM = normalEndH % 1 ? '30' : '00';
      const actualEndH  = Math.floor(e);
      const actualEndMM = e % 1 ? '30' : '00';
      earlyLeaveTxt = `<div style="font-size:11px;color:var(--red);margin-bottom:3px;">📉 실퇴근 ${pad2(actualEndH)}:${actualEndMM} → 정상퇴근 ${normalEndHH}:${normalEndMM} 대비 <b>${shortage}h 조퇴</b> → 공제 -${fmt(shortage*companyRate)}</div>`;
    }
  }

  let lines=[`${earlyArrTxt}${lateTxt}${earlyLeaveTxt}<b>실근무: ${net}h</b>${deductTxt ? `<br><span style="color:var(--text3);font-size:11px;">└ ${deductTxt}</span>` : ''}`];
  lines.push(`기본급: ${Math.min(net,8)}h × ${hourlyRate.toLocaleString()} = <b style="color:var(--green)">${fmt(baseAmt)}</b> <span style="color:var(--text3);font-size:10px;">(소정근로 ${dayStart}시 출근·${pad2(dayStart+8+lunchBreak)}시 퇴근 기준)</span>`);
  if(pSt==='work'||pSt==='early'){
    lines.push(`연장수당: OT ${ot}h × ${companyRate.toLocaleString()} × ${oMult} = <b style="color:var(--yellow)">${fmt(ot*companyRate*oMult)}</b>`);
  }
  if(nightH>0) lines.push(`야간수당: ${nightH}h × ${companyRate.toLocaleString()} × ${nMult} = <b style="color:var(--cyan)">${fmt(nightH*companyRate*nMult)}</b>`);
  if(pSt==='sat_work') lines.push(`토요특근: ${net}h × ${companyRate.toLocaleString()} × 1.5 = <b style="color:var(--sat)">${fmt(net*companyRate*1.5)}</b>`);
  if(pSt==='sun_work') lines.push(`일요특근: ${net}h × ${companyRate.toLocaleString()} × 2.0 = <b style="color:var(--sun)">${fmt(net*companyRate*2.0)}</b>`);
  if(pSt==='holiday') lines.push(`휴일수당: ${net}h × ${companyRate.toLocaleString()} × ${hMult} = <b style="color:var(--accent2)">${fmt(net*companyRate*hMult)}</b>`);
  pv.style.display='block';
  pv.innerHTML=lines.join('<br>');
}

function closePopup(){ document.getElementById('popup').style.display='none'; }
function openManual(){
  document.getElementById('manual-overlay').style.display='flex';
  switchManTab(0); // 열 때마다 첫 탭으로
}
function closeManual(){ document.getElementById('manual-overlay').style.display='none'; }

function switchManTab(idx){
  const total = 7;
  for(let i=0;i<total;i++){
    const tab   = document.getElementById('mtab-'+i);
    const panel = document.getElementById('man-panel-'+i);
    if(tab)   tab.classList.toggle('active', i===idx);
    if(panel) panel.style.display = i===idx ? 'block' : 'none';
  }
  // Q&A 탭 열릴 때 목록 렌더
  if(idx === 6) renderQAList(ALBA_QA);
}

// Q&A 도움말 렌더
var _qaCurrentCat = '전체';
var _qaCurrentSearch = '';

function renderQAList(items){
  const list = document.getElementById('qa-list');
  const count = document.getElementById('qa-count');
  if(!list) return;
  count.textContent = `${items.length}개`;

  const catIcon = {근태:'📋',급여:'💰',세금:'💸',가계부:'💳',현실고민:'😤',앱사용법:'📱'};

  list.innerHTML = items.map((item, idx) => `
    <div style="border:1px solid var(--border);border-radius:10px;overflow:hidden;background:var(--surface);">
      <button onclick="toggleQA(${idx})"
        style="width:100%;text-align:left;background:none;border:none;padding:12px 14px;
               cursor:pointer;display:flex;align-items:center;gap:8px;font-family:'Noto Sans KR';">
        <span style="font-size:14px;flex-shrink:0;">${catIcon[item.cat]||'❓'}</span>
        <span style="font-size:12px;font-weight:700;color:var(--text);flex:1;line-height:1.4;">${item.q}</span>
        <span id="qa-arrow-${idx}" style="font-size:11px;color:var(--text3);flex-shrink:0;">▼</span>
      </button>
      <div id="qa-ans-${idx}" style="display:none;padding:0 14px 12px;font-size:12px;
           color:var(--text2);line-height:1.8;border-top:1px solid var(--border);padding-top:10px;">
        ${item.a.replace(/\n/g,'<br>')}
        <div style="margin-top:8px;">
          <button onclick="askAlbayang('${item.q.replace(/'/g,'\\\'')}')"
            style="font-size:11px;padding:4px 10px;border-radius:6px;border:none;
                   background:rgba(79,124,255,.15);color:var(--accent);cursor:pointer;
                   font-family:'Noto Sans KR';font-weight:700;">
            🐱 머니냥에게 직접 물어보기
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

// Q&A 아코디언 토글
function toggleQA(idx){
  const ans = document.getElementById('qa-ans-'+idx);
  const arrow = document.getElementById('qa-arrow-'+idx);
  if(!ans) return;
  const open = ans.style.display === 'block';
  ans.style.display = open ? 'none' : 'block';
  ans.style.paddingTop = open ? '' : '10px';
  if(arrow) arrow.textContent = open ? '▼' : '▲';
}

// 검색 필터
function filterQA(keyword){
  _qaCurrentSearch = keyword.trim();
  applyQAFilter();
}

// 카테고리 필터
function filterQACat(cat){
  _qaCurrentCat = cat;
  // 버튼 스타일 업데이트
  document.querySelectorAll('.qa-cat-btn').forEach(btn => {
    const isActive = btn.dataset.cat === cat;
    btn.style.background = isActive ? 'var(--accent)' : 'var(--surface2)';
    btn.style.color = isActive ? '#fff' : 'var(--text2)';
    btn.style.borderColor = isActive ? 'var(--accent)' : 'var(--border)';
  });
  applyQAFilter();
}

// 필터 적용
function applyQAFilter(){
  let filtered = ALBA_QA;
  if(_qaCurrentCat !== '전체'){
    filtered = filtered.filter(item => item.cat === _qaCurrentCat);
  }
  if(_qaCurrentSearch){
    const kw = _qaCurrentSearch.replace(/\s/g,'').toLowerCase();
    filtered = filtered.filter(item =>
      item.q.replace(/\s/g,'').toLowerCase().includes(kw) ||
      item.a.replace(/\s/g,'').toLowerCase().includes(kw)
    );
  }
  renderQAList(filtered);
}

// Q&A에서 머니냥으로 연결
function askAlbayang(question){
  closeManual();
  // 머니냥 열기
  if(!asstOpen) toggleAsst();
  // 잠깐 후 메시지 전송
  setTimeout(()=>{
    const inp = document.getElementById('asst-input');
    if(inp){ inp.value = question; }
    addUserMsg(question);
    const reply = callClaude(question);
    Promise.resolve(reply).then(r => addBotMsg(r));
  }, 300);
}

function saveDay(){
  if(pSt==='none'){ delete dayData[editKey]; closePopup(); renderCalendar(); lsSave(); updateTodayPanel(); return; }
  const note=document.getElementById('p-note').value;
  const se=document.getElementById('t-start');
  const ee=document.getElementById('t-end');
  const entry={status:pSt,note};
  if(se) entry.start=parseFloat(se.value);
  if(ee) entry.end=parseFloat(ee.value);
  if(wt==='2shift'&&pSt==='work') entry.shift=p2Sh;
  if(wt==='3shift'&&pSt==='work') entry.shift=p3Sh;
  dayData[editKey]=entry;
  closePopup(); renderCalendar(); lsSave();
  if(document.getElementById('salary-page').style.display!=='none') renderSalary();
  updateTodayPanel();
}

// ── 팝업 퀵 저장 함수들 ──

// 현재 한국 시간 → 분 단위 정밀도 소수 (예: 19:16 → 19 + 16/60 = 19.2666...)
// ★ 표시는 반드시 fmtTime() 사용
function kstNow(){
  const now=new Date();
  const kst=new Date(now.getTime()+9*3600*1000);
  return kst.getUTCHours() + kst.getUTCMinutes()/60;
}
function kstNowStr(){
  const now=new Date();
  const kst=new Date(now.getTime()+9*3600*1000);
  return pad2(kst.getUTCHours())+':'+pad2(kst.getUTCMinutes());
}
// 소수 시간 → HH:MM 문자열 (예: 19.2666 → "19:16")
function fmtTime(v){
  if(v===undefined||v===null) return '--:--';
  const h=Math.floor(v);
  const m=Math.round((v - h)*60);
  return pad2(h)+':'+pad2(m===60?0:m);
}

// 연차·결근·공휴일·초기화: 시간 불필요, 즉시 저장
function quickSave(type){
  const note=document.getElementById('p-note').value;
  if(type==='none'){
    delete dayData[editKey];
  } else {
    dayData[editKey]={status:type, note};
  }
  closePopup(); renderCalendar(); lsSave();
  if(document.getElementById('salary-page').style.display!=='none') renderSalary();
  updateTodayPanel();
}

// 반차·조퇴·휴일근무·토요특근·일요특근: 현재시각 출근으로, end=+반차4h/나머지8h
function quickSaveTime(type){
  const note=document.getElementById('p-note').value;
  const s=kstNow();
  const entry={status:type, start:s, note};
  // end는 퇴근 버튼으로 따로 기록 (자동계산 제거)
  if(wt==='2shift') entry.shift=p2Sh;
  if(wt==='3shift') entry.shift=p3Sh;
  dayData[editKey]=entry;
  closePopup(); renderCalendar(); lsSave();
  if(document.getElementById('salary-page').style.display!=='none') renderSalary();
  updateTodayPanel();
  showToast(`✅ ${type==='half'?'반차':type==='early'?'조퇴':'근무'} 기록 완료 (${kstNowStr()})`);
}

// 출근 버튼: 현재시각 → start, end=start+8h
function quickCheckIn(){
  const note=document.getElementById('p-note').value;
  const saved=dayData[editKey]||{};
  const s=kstNow();
  const entry=Object.assign({}, saved, {status:'work', start:s, note});
  delete entry.end; // 퇴근 전까지 end 없음
  if(wt==='2shift') entry.shift=p2Sh;
  if(wt==='3shift') entry.shift=p3Sh;
  dayData[editKey]=entry;
  closePopup(); renderCalendar(); lsSave();
  if(document.getElementById('salary-page').style.display!=='none') renderSalary();
  updateTodayPanel();
  showToast(`✅ 출근 기록 완료 (${kstNowStr()})`);
}

// 퇴근 버튼: 현재시각 → end (출근 기록 없으면 경고)
function quickCheckOut(){
  const note=document.getElementById('p-note').value;
  const saved=dayData[editKey];
  if(!saved || saved.status!=='work'){
    showToast('⚠️ 먼저 출근 기록이 필요합니다');
    return;
  }
  const e=kstNow();
  saved.end=e;
  saved.note=note;
  dayData[editKey]=saved;
  closePopup(); renderCalendar(); lsSave();
  if(document.getElementById('salary-page').style.display!=='none') renderSalary();
  updateTodayPanel();
  showToast(`🔴 퇴근 기록 완료 (${kstNowStr()})`);
}

// 비고에서 시간 자동 추출 (예: "출근 09:15", "퇴근 18:30")
function parseNoteTime(){
  const note=document.getElementById('p-note').value;
  const inM  = note.match(/출근\s*(\d{1,2})[:：시](\d{2})/i);
  const outM = note.match(/퇴근\s*(\d{1,2})[:：시](\d{2})/i);
  if(!inM && !outM){ showToast('⚠️ 비고에서 출퇴근 시간을 찾을 수 없습니다'); return; }
  const saved=dayData[editKey]||{};
  let s=saved.start, e=saved.end;
  if(inM)  s=parseInt(inM[1]) + parseInt(inM[2])/60;
  if(outM) e=parseInt(outM[1])+ parseInt(outM[2])/60;
  if(s===undefined) s=kstNow();
  // e가 없으면 end 저장 안 함
  const entry=Object.assign({}, saved, {status:'work', start:s, note});
  if(e!==undefined) entry.end=e; else delete entry.end;
  if(wt==='2shift') entry.shift=p2Sh;
  if(wt==='3shift') entry.shift=p3Sh;
  // ★ dayData에 먼저 저장 → lsSave → 팝업 닫기 → 달력 렌더
  dayData[editKey]=entry;
  lsSave();
  closePopup();
  renderCalendar();
  if(document.getElementById('salary-page').style.display!=='none') renderSalary();
  showToast(`📝 자동 기입 완료: 출근 ${fmtTime(s)} → 퇴근 ${fmtTime(e)}`);
}

// 간단 토스트 메시지
// ── PWA Manifest 동적 생성 ──
function updateManifest(iconBase64){
  let link = document.getElementById('manifest-link');
  if(!iconBase64){
    if(!link){ link=document.createElement('link'); link.id='manifest-link'; link.rel='manifest'; document.head.appendChild(link); }
    if(link._prevUrl) URL.revokeObjectURL(link._prevUrl);
    link.href = 'manifest.json?v=20260611-fix3';
    link._prevUrl = null;
    return;
  }
  const companyName = '머니냥 - 내 돈 관리';
  const manifest = {
    name: companyName,
    short_name: '머니냥',
    description: '알바생·프리랜서·직장인을 위한 AI 수입·생존관리 앱',
    start_url: '.',
    display: 'standalone',
    background_color: '#0d1117',
    theme_color: '#0d1117',
    orientation: 'portrait',
    icons: iconBase64 ? [
      { src: iconBase64, sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: iconBase64, sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
    ] : [
      { src: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="%230d1117"/><text y=".9em" font-size="80" x="10">📋</text></svg>', sizes: 'any', type: 'image/svg+xml' }
    ]
  };
  const blob = new Blob([JSON.stringify(manifest)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  if(!link){ link=document.createElement('link'); link.id='manifest-link'; link.rel='manifest'; document.head.appendChild(link); }
  if(link._prevUrl) URL.revokeObjectURL(link._prevUrl);
  link.href = url;
  link._prevUrl = url;
}

// ── PWA 설치 안내 ──
let _deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e)=>{
  e.preventDefault();
  _deferredPrompt = e;
  // 설치 안내 버튼 표시
  const btn = document.getElementById('pwa-install-btn');
  if(btn) btn.style.display = 'flex';
  const iconBtn = document.getElementById('app-icon-btn');
  if(iconBtn) iconBtn.style.display = 'flex';
  showPwaInstallNudge();
});
window.addEventListener('appinstalled', ()=>{
  showToast('✅ 앱이 홈 화면에 설치되었습니다!');
  const btn = document.getElementById('pwa-install-btn');
  if(btn) btn.style.display = 'none';
});

function installPWA(){
  hidePwaInstallNudge();
  const hasCustomIcon = !!localStorage.getItem('companyLogo');
  if(_deferredPrompt){
    // 커스텀 아이콘이 없으면 기본 아이콘으로 manifest 갱신 후 설치
    if(!hasCustomIcon) updateManifest(null);
    _deferredPrompt.prompt();
    _deferredPrompt.userChoice.then((choice)=>{
      if(choice.outcome === 'accepted'){
        showToast('✅ 홈 화면에 설치되었어요! 아이콘은 배너 로고를 탭해서 변경할 수 있어요 🐱');
      }
      _deferredPrompt=null;
    });
  } else {
    // iOS 안내
    showToast('📱 Safari에서 공유(↑) → 홈 화면에 추가를 눌러주세요');
  }
}

// ── 앱 아이콘 변경 (설정 탭용) ──
function changeAppIcon(){
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = (e) => {
    const f = e.target.files[0];
    if(!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const b64 = ev.target.result;
      // 캔버스로 192x192 정사각형 리사이즈
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 192; canvas.height = 192;
        const ctx = canvas.getContext('2d');
        // 배경 채우기
        ctx.fillStyle = '#0d1117';
        ctx.fillRect(0,0,192,192);
        // 이미지를 중앙에 fit
        const s = Math.min(192/img.width, 192/img.height);
        const w = img.width*s, h = img.height*s;
        ctx.drawImage(img, (192-w)/2, (192-h)/2, w, h);
        const resized = canvas.toDataURL('image/png');
        // 저장 & 적용 (single writer: saveCompanyLogo)
        saveCompanyLogo(resized);
        // 배너 로고도 업데이트
        const logoImg = document.getElementById('logo-img');
        const logoPh = document.getElementById('logo-ph');
        if(logoImg){ logoImg.src = resized; logoImg.style.display='block'; }
        if(logoPh)  logoPh.style.display='none';
        // favicon / apple-touch-icon
        const favicon = document.getElementById('favicon-link');
        const appleIcon = document.getElementById('apple-icon-link');
        if(favicon)   favicon.href = resized;
        if(appleIcon) appleIcon.href = resized;
        // manifest 업데이트
        updateManifest(resized);
        showToast('✅ 앱 아이콘이 변경되었어요! 다시 설치하면 새 아이콘이 적용돼요 🐱');
      };
      img.src = b64;
    };
    reader.readAsDataURL(f);
  };
  input.click();
}

function isPwaStandalone(){
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function isMobileViewport(){
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth <= 768;
}

function hidePwaInstallNudge(){
  const el = document.getElementById('pwa-install-nudge');
  if(el) el.remove();
  // 배너 표시로 확보했던 하단 여백도 함께 해제
  document.body.classList.remove('has-pwa-nudge');
}

function showPwaInstallNudge(){
  if(isPwaStandalone() || !isMobileViewport()) return;
  if(document.getElementById('pwa-install-nudge')) return;
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const hasIcon = !!localStorage.getItem('companyLogo');
  const nudge = document.createElement('div');
  nudge.id = 'pwa-install-nudge';
  nudge.style.cssText = 'position:fixed;left:12px;right:12px;bottom:calc(var(--mob-nav-h,0px) + var(--safe-bottom,0px) + 12px);z-index:1200;background:var(--surface);border:1px solid var(--accent);border-radius:12px;padding:12px 14px;box-shadow:0 12px 36px rgba(0,0,0,.35);display:flex;gap:10px;align-items:center;';
  nudge.innerHTML = 
    '<div style="font-size:22px;line-height:1;">📲</div>' +
    '<div style="flex:1;min-width:0;">' +
      '<div style="font-size:13px;font-weight:800;color:var(--text);">머니냥 앱으로 설치하기</div>' +
      '<div style="font-size:11px;color:var(--text3);line-height:1.5;margin-top:2px;">' +
        (isIOS ? 'Safari 공유(↑) → 홈 화면에 추가를 눌러주세요.' : '설치하면 홈 화면에서 앱처럼 바로 열 수 있어요.') +
        (!hasIcon ? '<br>🖼️ <span onclick="changeAppIcon()" style="color:var(--accent);cursor:pointer;text-decoration:underline;">아이콘 먼저 설정</span>하면 홈 화면에 예쁘게 표시돼요!' : '') +
      '</div>' +
    '</div>' +
    (!isIOS ? '<button onclick="installPWA()" style="padding:8px 10px;border-radius:8px;border:none;background:var(--accent);color:#fff;font-size:12px;font-weight:800;font-family:\'Noto Sans KR\';cursor:pointer;">설치</button>' : '') +
    '<button onclick="hidePwaInstallNudge()" aria-label="닫기" style="width:28px;height:28px;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text2);font-size:14px;cursor:pointer;">×</button>';
  document.body.appendChild(nudge);
  // ★ 배너가 화면 하단에 고정(position:fixed)되어 페이지 하단의 저장 버튼 등과 겹치는 문제 방지:
  //   배너 높이만큼 본문 하단 여백을 확보해, 스크롤해도 버튼이 배너 아래로 가려지지 않도록 함
  document.body.classList.add('has-pwa-nudge');
}

window.addEventListener('load', ()=>{
  setTimeout(()=>{
    if(!_deferredPrompt && isMobileViewport() && !isPwaStandalone()){
      showPwaInstallNudge();
    }
  }, 1200);
});

// ══════════════════════════════════════════
// 급여명세서 출력 (새 창 HTML)
// ══════════════════════════════════════════
function printPayslip(){
  const d = getPayData();
  const company = document.getElementById('company-name')?.textContent || '회사명';
  const ym = `${curY}년 ${curM+1}월`;
  const today = new Date();
  const kst = new Date(today.getTime() + 9*3600*1000);
  const issueDate = `${kst.getUTCFullYear()}년 ${kst.getUTCMonth()+1}월 ${kst.getUTCDate()}일`;

  function f(n){ return Math.round(n).toLocaleString('ko-KR'); }
  function row(label, val, color='#333', note=''){
    return `<tr>
      <td style="padding:7px 12px;font-size:13px;color:#555;border-bottom:1px solid #eee;">${label}</td>
      <td style="padding:7px 12px;font-size:13px;text-align:right;font-weight:600;color:${color};border-bottom:1px solid #eee;">${val}원${note?'<span style="font-size:10px;color:#999;font-weight:400;margin-left:4px;">'+note+'</span>':''}</td>
    </tr>`;
  }

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>급여명세서 - ${ym}</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:'Malgun Gothic','Apple SD Gothic Neo','Noto Sans KR',sans-serif; background:#f5f5f5; padding:20px; }
  .wrap { max-width:600px; margin:0 auto; background:#fff; border:1px solid #ddd; border-radius:8px; overflow:hidden; }
  .head { background:linear-gradient(135deg,#1a2035 0%,#2d4a7a 100%); color:#fff; padding:24px 28px; }
  .head h1 { font-size:22px; font-weight:700; margin-bottom:4px; }
  .head .sub { font-size:13px; opacity:.8; }
  .meta { display:flex; justify-content:space-between; padding:14px 28px; background:#f8f9fb; border-bottom:2px solid #e0e0e0; font-size:12px; color:#666; }
  .section { padding:0 0 4px; }
  .sec-title { padding:10px 16px 8px; font-size:12px; font-weight:700; color:#fff; letter-spacing:.5px; }
  .sec-income .sec-title { background:#2d7a4a; }
  .sec-allow  .sec-title { background:#2d5a8a; }
  .sec-deduct .sec-title { background:#8a3d2d; }
  .sec-ins    .sec-title { background:#6a3d8a; }
  .sec-tax    .sec-title { background:#5a5a2d; }
  table { width:100%; border-collapse:collapse; }
  .total-row { background:#1a2035; color:#fff; }
  .total-row td { padding:14px 16px; font-size:15px; font-weight:700; }
  .total-row .amt { font-size:20px; color:#7fffd4; text-align:right; }
  .notice { padding:12px 16px; background:#fffde7; border-top:1px solid #f0e68c; font-size:10px; color:#777; line-height:1.7; }
  .seal { text-align:right; padding:14px 24px 18px; font-size:12px; color:#555; }
  @media print {
    body { background:#fff; padding:0; }
    .wrap { border:none; border-radius:0; box-shadow:none; }
    .no-print { display:none !important; }
  }
</style>
</head>
<body>
<div class="wrap">

  <!-- 헤더 -->
  <div class="head">
    <h1>💰 급여 명세서</h1>
    <div class="sub">${ym} &nbsp;|&nbsp; 발행일: ${issueDate}</div>
  </div>

  <!-- 기본정보 -->
  <div class="meta">
    <span>🏢 사업장명: <b>${company}</b></span>
    <span>📅 지급연월: <b>${ym}</b></span>
    <span>⏱ 근무일수: <b>${d.wDays}일</b></span>
    ${(()=>{ const lr=calcAnnualLeave(hireDate); return lr ? `<span>🌿 연차: <b>${lr.totalLeave}일</b>(근속 ${lr.yearsInt>0?lr.yearsInt+'년 ':''}${lr.diffMonths%12>0?lr.diffMonths%12+'개월':''})</span>` : ''; })()}
  </div>

  <!-- 근무 현황 -->
  <div class="section sec-income">
    <div class="sec-title">📋 근무 현황</div>
    <table>
      ${row('정규 근무시간', f(d.normalH)+'h', '#333')}
      ${d.totOT > 0 ? row('연장 근무시간(OT)', f(d.totOT)+'h', '#e67e00') : ''}
      ${d.nightH > 0 ? row('야간 근무시간', f(d.nightH)+'h', '#2980b9') : ''}
      ${d.satH > 0   ? row('토요특근시간', f(d.satH)+'h', '#2980b9') : ''}
      ${d.sunH > 0   ? row('일요특근시간', f(d.sunH)+'h', '#c0392b') : ''}
      ${d.lDays > 0  ? row('연차 사용', d.lDays+'일', '#888') : ''}
      ${d.halfDays > 0 ? row('반차 사용', d.halfDays+'회', '#888') : ''}
      ${d.absDays > 0 ? row('결근', d.absDays+'일', '#c0392b') : ''}
    </table>
  </div>

  <!-- 지급 항목 -->
  <div class="section sec-allow">
    <div class="sec-title">💵 지급 항목</div>
    <table>
      ${row('기본급', f(d.basePay), '#1a7a3a', `(시급 ${hourlyRate.toLocaleString()}원 × 209h)`)}
      ${d.aOT > 0     ? row('연장수당(OT)', f(d.aOT), '#e67e00', '×1.5') : ''}
      ${d.aNight > 0  ? row('야간수당', f(d.aNight), '#2980b9', '×0.5') : ''}
      ${d.aHoliday > 0 ? row('휴일근무수당', f(d.aHoliday), '#8e44ad', '×2.0') : ''}
      ${d.aSat > 0    ? row('토요특근수당', f(d.aSat), '#2980b9', '×1.5') : ''}
      ${d.aSun > 0    ? row('일요특근수당', f(d.aSun), '#c0392b', '×2.0') : ''}
      ${d.aWeeklyManual > 0 ? row('주휴수당', f(d.aWeeklyManual), '#1a7a3a') : ''}
      ${d.perfAmt > 0 ? row('개근수당', f(d.perfAmt), '#1a7a3a') : ''}
      <tr style="background:#f0f7f0;">
        <td style="padding:8px 12px;font-size:13px;font-weight:700;color:#1a7a3a;">지급 합계</td>
        <td style="padding:8px 12px;font-size:14px;text-align:right;font-weight:700;color:#1a7a3a;">${f(d.basePay + d.totAllow)}원</td>
      </tr>
    </table>
  </div>

  <!-- 근태 공제 -->
  ${d.totDeduct > 0 ? `
  <div class="section sec-deduct">
    <div class="sec-title">📉 근태 공제</div>
    <table>
      ${d.dAbsent > 0 ? row('결근 공제', f(d.dAbsent), '#c0392b') : ''}
      ${d.dEarly > 0  ? row('조퇴 공제', f(d.dEarly), '#e67e00') : ''}
      ${d.dHalf > 0   ? row('반차 공제', f(d.dHalf), '#e67e00') : ''}
      <tr style="background:#fff5f5;">
        <td style="padding:8px 12px;font-size:13px;font-weight:700;color:#c0392b;">공제 합계</td>
        <td style="padding:8px 12px;font-size:14px;text-align:right;font-weight:700;color:#c0392b;">-${f(d.totDeduct)}원</td>
      </tr>
    </table>
  </div>` : ''}

  <!-- 4대보험 -->
  <div class="section sec-ins">
    <div class="sec-title">🛡️ 4대보험 공제 (2025년 기준)</div>
    <table>
      ${row('국민연금 (4.5%)', f(d.ins.np), '#6a3d8a')}
      ${row('건강보험 (3.545%)', f(d.ins.hi), '#6a3d8a')}
      ${row('장기요양보험 (건보료×12.95%)', f(d.ins.ltc), '#6a3d8a')}
      ${row('고용보험 (0.9%)', f(d.ins.ei), '#6a3d8a')}
      <tr style="background:#f5f0fa;">
        <td style="padding:8px 12px;font-size:13px;font-weight:700;color:#6a3d8a;">4대보험 합계</td>
        <td style="padding:8px 12px;font-size:14px;text-align:right;font-weight:700;color:#6a3d8a;">-${f(d.ins.total)}원</td>
      </tr>
    </table>
  </div>

  <!-- 세금 -->
  <div class="section sec-tax">
    <div class="sec-title">🧾 소득세 공제</div>
    <table>
      ${row('근로소득세 (간이세액표)', f(d.tax.income), '#5a5a2d')}
      ${row('지방소득세 (소득세×10%)', f(d.tax.local), '#5a5a2d')}
      <tr style="background:#fafaf0;">
        <td style="padding:8px 12px;font-size:13px;font-weight:700;color:#5a5a2d;">세금 합계</td>
        <td style="padding:8px 12px;font-size:14px;text-align:right;font-weight:700;color:#5a5a2d;">-${f(d.tax.total)}원</td>
      </tr>
    </table>
  </div>

  <!-- 실수령액 -->
  <table>
    <tr class="total-row">
      <td>💰 예상 실수령액</td>
      <td class="amt">${f(d.finalPay)}원</td>
    </tr>
  </table>

  <!-- 면책 공지 -->
  <div class="notice">
    ⚠️ 본 명세서는 <b>참고용</b>입니다. 실제 지급 급여와 차이가 발생할 수 있으며, 4대보험은 법정 요율 기준 자동 산출값으로
    사업장별 기준월액·보수총액 정산 등에 따라 실제 공제액과 다를 수 있습니다.
    근로소득세는 간이세액표(부양가족 1인) 기준이며, 연말정산 결과와 다를 수 있습니다.
    정확한 급여는 회사 급여담당자 또는 4대보험 포털(EDI)에서 확인하세요.
  </div>

  <!-- 발행 -->
  <div class="seal">
    발행: ${company} &nbsp;|&nbsp; ${issueDate}
  </div>

  <!-- 출력 버튼 -->
  <div class="no-print" style="text-align:center;padding:14px;background:#f5f5f5;border-top:1px solid #ddd;">
    <button onclick="window.print()" style="padding:10px 32px;background:#1a2035;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">🖨️ 인쇄 / PDF 저장</button>
  </div>

</div>
</body>
</html>`;

  const w = window.open('', '_blank', 'width=660,height=850');
  w.document.write(html);
  w.document.close();
}

function showToast(msg){
  let t=document.getElementById('_toast');
  if(!t){
    t=document.createElement('div');
    t.id='_toast';
    t.style.cssText='position:fixed;bottom:24px;left:50%;transform:translateX(-50%);'+
      'background:rgba(30,35,55,.95);border:1px solid rgba(255,255,255,.15);'+
      'color:#fff;padding:10px 20px;border-radius:12px;font-size:14px;z-index:9999;'+
      'font-family:"Noto Sans KR";pointer-events:none;transition:opacity .3s;';
    document.body.appendChild(t);
  }
  t.textContent=msg; t.style.opacity='1';
  clearTimeout(t._timer);
  t._timer=setTimeout(()=>{ t.style.opacity='0'; }, 2500);
}

// ══════════════════════════════════════════
// 페이지 전환
// ══════════════════════════════════════════
function showPage(p){
  document.getElementById('att-page').style.display      = p==='att'      ?'block':'none';
  document.getElementById('salary-page').style.display   = p==='sal'      ?'block':'none';
  document.getElementById('dash-page').style.display     = p==='dash'     ?'block':'none';
  document.getElementById('budget-page').style.display   = p==='budget'   ?'block':'none';
  const settingsEl = document.getElementById('settings-page');
  if(settingsEl) settingsEl.style.display = p==='settings' ? 'block' : 'none';
  // ★ main-tab active 처리
  ['att','sal','dash','budget','settings'].forEach(id=>{
    const btn=document.getElementById('btn-'+id);
    if(btn) btn.classList.toggle('active', p===id);
  });
  // ★ 모바일 하단 탭 동기화
  setMobActive(p);
  if(p==='sal')      renderIncomePage();
  if(p==='settings'){
    const sp = document.getElementById('settings-page');
    if(sp) sp.style.display = 'block';
    renderSettingsPage();
  }
  if(p==='dash')     renderDash();
  if(p==='budget')   renderBudgetPage();
  if(p==='att'){
    renderCalendar();
    setTimeout(updateTodayPanel, 100);
  }
}


// ══════════════════════════════════════════

// ── 직장 섹션 아코디언 토글 ──
function toggleEmployeeSec(){
  // 아코디언 제거됨 — 항상 펼침 상태 유지
}

// 팝업 열릴 때 직장 기록 있으면 자동 펼침
function autoOpenEmployeeSec(){
  const body = document.getElementById('employee-acc-body');
  const arr  = document.getElementById('employee-acc-arr');
  const hdr  = document.getElementById('employee-acc-hdr');
  if(!body) return;
  body.style.display = 'block';
  if(arr) arr.textContent = '▲';
  if(hdr) hdr.style.borderRadius = '10px 10px 0 0';
}

// ══════════════════════════════════════════
// PC 오늘 패널 업데이트
// ══════════════════════════════════════════
function updateTodayPanel(){
  const panel = document.getElementById('today-panel-content');
  const titleEl = document.getElementById('today-panel-title');
  const njobEl = document.getElementById('today-njob-summary');
  if(!panel) return;

  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth()+1).padStart(2,'0');
  const d = String(today.getDate()).padStart(2,'0');
  const key = `${y}-${m}-${d}`;
  const wks = ['일','월','화','수','목','금','토'];
  const wd = wks[today.getDay()];

  if(titleEl) titleEl.textContent = `📅 ${parseInt(m)}월 ${parseInt(d)}일 ${wd}요일`;

  // 직장 근태 데이터
  const saved = dayData && dayData[key];
  let html = '';

  if(saved && saved.status && saved.status !== 'none'){
    const statusLabels = {
      work:'출근', leave:'연차', half:'반차', absent:'결근',
      holiday:'휴일근무', pholi:'공휴일근무', satot:'토요특근', sunot:'일요특근'
    };
    const label = statusLabels[saved.status] || saved.status;
    const color = saved.status==='work'?'var(--accent)':saved.status==='leave'?'var(--green)':'var(--yellow)';

    html += `<div style="background:var(--surface2);border-radius:10px;padding:12px 14px;margin-bottom:10px;">
      <div style="font-size:12px;font-weight:700;color:${color};margin-bottom:6px;">🏢 직장 · ${label}</div>`;

    if(saved.start || saved.end){
      html += `<div style="font-size:13px;color:var(--text);margin-bottom:4px;">
        ${saved.start||'?'} → ${saved.end||'?'}
      </div>`;
    }
    if(saved.ot){
      html += `<div style="font-size:12px;color:var(--yellow);">OT ${saved.ot}h</div>`;
    }
    html += '</div>';
  } else {
    html += `<div style="padding:10px 0;font-size:12px;color:var(--text3);">직장 기록 없음</div>`;
  }

  panel.innerHTML = html;

  // N잡 요약
  if(njobEl){
    try{
      const nj = JSON.parse(localStorage.getItem('atm2_njob_'+key)||'{}');
      const alba = (nj.alba||[]);
      const deliv = (nj.delivery||[]);
      const free = (nj.free||[]);
      const total = alba.reduce((s,it)=>s+(it.amount||Math.round((it.wage||0)*(it.hours||0))),0)
                  + deliv.reduce((s,it)=>s+(it.count||0)*(it.price||0),0)
                  + free.reduce((s,it)=>s+(it.count||0)*(it.price||0),0);

      if(total > 0){
        let njHtml = `<div style="background:rgba(61,214,140,.08);border:1px solid rgba(61,214,140,.2);
                                  border-radius:10px;padding:10px 12px;">
          <div style="font-size:12px;font-weight:700;color:var(--green);margin-bottom:6px;">💼 N잡 수입</div>`;
        if(alba.length>0) njHtml += `<div style="font-size:12px;color:var(--text2);">⏰ 알바 ${alba.length}건</div>`;
        if(deliv.length>0) njHtml += `<div style="font-size:12px;color:var(--text2);">🛵 배달 ${deliv.length}건</div>`;
        if(free.length>0) njHtml += `<div style="font-size:12px;color:var(--text2);">💻 프리 ${free.length}건</div>`;
        njHtml += `<div style="font-size:14px;font-weight:700;color:var(--green);margin-top:6px;">+${total.toLocaleString()}원</div>`;
        njHtml += '</div>';
        njobEl.innerHTML = njHtml;
      } else {
        njobEl.innerHTML = '';
      }
    }catch(e){ njobEl.innerHTML=''; }
  }
}

// ════════════════════════════════════════
// 연차/결근 사유 입력 팝업
// ════════════════════════════════════════
let _leaveNoteType = 'leave';

const LEAVE_QUICK = {
  leave:  ['개인 사정', '병원 방문', '가족 행사', '여행', '경조사', '피로 회복', '기타'],
  absent: ['질병/몸살', '개인 사정', '가족 돌봄', '교통 사고', '기타'],
  half:   ['병원 방문', '개인 사정', '오전 반차', '오후 반차', '가족 행사', '기타'],
  early:  ['병원 방문', '몸이 아파서', '가족 돌봄', '개인 사정', '기타']
};

function openLeaveNotePopup(type) {
  _leaveNoteType = type;
  const overlay = document.getElementById('leave-note-overlay');
  if (!overlay) return;

  // 사유/날짜/퀵리스트 채우기는 근무형태(wt)와 무관한 부가 정보이므로,
  // 여기서 예외가 나도 사유 입력 팝업 자체는 항상 열리도록 분리 처리
  try {
    const titleMap = {
      leave: '🌿 연차 사유 입력',
      absent: '❌ 결근 사유 입력',
      half: '⏰ 반차 사유 입력',
      early: '🚶 조퇴 사유 입력'
    };
    const titleEl = document.getElementById('leave-note-title');
    if (titleEl) titleEl.textContent = titleMap[type] || '📝 사유 입력';

    const dateEl = document.getElementById('leave-note-date');
    if (dateEl && editKey) {
      const [y, m, d] = editKey.split('-');
      dateEl.textContent = `${y}년 ${parseInt(m)}월 ${parseInt(d)}일`;
    }

    const saved = dayData ? dayData[editKey] : null;
    const noteInput = document.getElementById('leave-note-input');
    if (noteInput) {
      noteInput.value = saved?.note || '';
      noteInput.style.borderColor = 'var(--border)';
    }

    const quickEl = document.getElementById('leave-quick-reasons');
    if (quickEl && noteInput) {
      quickEl.innerHTML = '';
      (LEAVE_QUICK[type] || []).forEach(reason => {
        const btn = document.createElement('button');
        btn.textContent = reason;
        btn.style.cssText = 'padding:7px 14px;border-radius:20px;border:1px solid var(--border);background:var(--surface2);color:var(--text2);font-size:13px;cursor:pointer;font-family:\'Noto Sans KR\';font-weight:600;transition:all .15s;';
        btn.onclick = () => {
          noteInput.value = reason;
          noteInput.style.borderColor = 'var(--accent)';
          quickEl.querySelectorAll('button').forEach(b => {
            b.style.background = 'var(--surface2)';
            b.style.color = 'var(--text2)';
            b.style.borderColor = 'var(--border)';
          });
          btn.style.background = 'rgba(79,124,255,.12)';
          btn.style.color = 'var(--accent)';
          btn.style.borderColor = 'var(--accent)';
        };
        quickEl.appendChild(btn);
      });
    }

    if (noteInput) setTimeout(() => noteInput.focus(), 100);
  } catch (e) {
    console.error('openLeaveNotePopup: 사유 입력 보조 정보 채우기 실패', e);
  }

  overlay.style.display = 'flex';
}

function closeLeaveNotePopup() {
  const overlay = document.getElementById('leave-note-overlay');
  if (overlay) overlay.style.display = 'none';
}

function saveLeaveWithNote() {
  const note = (document.getElementById('leave-note-input').value || '').trim();
  closeLeaveNotePopup();

  if (_leaveNoteType === 'half' || _leaveNoteType === 'early') {
    // 반차/조퇴: 사유 임시 저장 후 시간 설정 UI로 이동
    if (!dayData[editKey]) dayData[editKey] = {};
    dayData[editKey].note = note;
    selStAndTime(_leaveNoteType);
    const label = _leaveNoteType === 'half' ? '반차' : '조퇴';
    if (note) showToast(`📝 ${label} 사유 저장됨 — 아래에서 시간을 설정해주세요`);
  } else {
    // 연차/결근: 바로 저장 후 팝업 닫기
    dayData[editKey] = { status: _leaveNoteType, note };
    closePopup();
    renderCalendar();
    lsSave();
    if (document.getElementById('salary-page').style.display !== 'none') renderSalary();
    const labelMap = { leave: '연차', absent: '결근' };
    showToast(`✅ ${labelMap[_leaveNoteType] || '기록'} 완료${note ? ' — ' + note : ''}`);
  }
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    const ov = document.getElementById('leave-note-overlay');
    if (ov && ov.style.display === 'flex') closeLeaveNotePopup();
  }
});


// ════════════════════════════════════════
// 이날 기록 초기화 — 2단계 확인
// ════════════════════════════════════════
function confirmResetDay() {
  const [y, m, d] = editKey.split('-');
  const dateEl = document.getElementById('reset-confirm-date');
  if(dateEl) dateEl.textContent = y+'년 '+parseInt(m)+'월 '+parseInt(d)+'일';
  const ov = document.getElementById('reset-confirm-overlay');
  if(ov) ov.style.display = 'flex';
}

function closeResetConfirm() {
  const ov = document.getElementById('reset-confirm-overlay');
  if(ov) ov.style.display = 'none';
}

function doResetDay() {
  closeResetConfirm();
  quickSave('none');
  showToast('🗑️ 기록이 초기화됐어요');
}

// ════════════════════════════════════════
// 범용 확인 모달 — window.confirm() 대체(2026-06-21)
// Android/iPhone의 PWA(standalone) 환경에서 네이티브 confirm()이
// 다이얼로그를 그리지 않고 무시되는 경우가 있어, 파괴적 작업의 확인
// UI를 전부 이 커스텀 모달로 통일함. 각 호출부의 메시지·콜백(실제
// 실행되는 동작)은 그대로 유지 — 확인 UI만 교체.
// ════════════════════════════════════════
let _genericConfirmCallback = null;

function showCustomConfirm(message, onConfirm) {
  const ov    = document.getElementById('generic-confirm-overlay');
  const msg   = document.getElementById('generic-confirm-msg');
  const okBtn = document.getElementById('generic-confirm-ok-btn');
  if (!ov || !msg || !okBtn) {
    // 모달 마크업이 없는 예외 상황에서도 동작은 막히지 않게 하는 안전망
    if (typeof onConfirm === 'function') onConfirm();
    return;
  }
  msg.textContent = message;
  _genericConfirmCallback = onConfirm;
  okBtn.onclick = function () {
    const cb = _genericConfirmCallback;
    closeGenericConfirm();
    if (typeof cb === 'function') cb();
  };
  ov.style.display = 'flex';
}

function closeGenericConfirm() {
  const ov = document.getElementById('generic-confirm-overlay');
  if (ov) ov.style.display = 'none';
  _genericConfirmCallback = null;
}
