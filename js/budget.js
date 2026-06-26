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
    if(shift==='day')   return {lunch:L, dinner:D, snack:0};  // 주간조: 점심+저녁
    if(shift==='night') return {lunch:0, dinner:0, snack:S};  // 야간조: 야식만
    return {lunch:L, dinner:0, snack:0};
  }
  if(wt==='3shift'){
    if(shift==='A') return {lunch:L, dinner:0, snack:0};  // A조(06~14): 점심
    if(shift==='B') return {lunch:0, dinner:D, snack:0};  // B조(14~22): 저녁
    if(shift==='C') return {lunch:0, dinner:0, snack:S};  // C조(22~06): 야식
    return {lunch:L, dinner:0, snack:0};
  }
  return {lunch:L, dinner:0, snack:0};
}

// calcEffectiveStart: 급여 계산용 시작 시간 보정
// 출근 기록은 실제 출근 시각 그대로 저장, 계산만 업무시작(dayStart) 기준으로 보정
// 예) dayStart=9, 출근=8.5 → 계산은 9부터 (조기출근 무시, 정시부터 계산)
// 예) dayStart=9, 출근=9.5 → 그대로 9.5 (지각은 지각시간부터 계산)

// calcNetHours: 휴게시간 공제 후 실 근무시간
// - 반차: 4h 고정
// - public: 무급휴가 → 0h
// - 주간(day): effStart(업무시작 기준) → 퇴근 시간까지 raw 계산, 점심1h 공제
//   OT(8h 초과)있으면 저녁0.5h 추가 공제
// 예) 출근=8.5(08:30), dayStart=9, 퇴근=18 → effStart=9, raw=9h, -점심1h=8h
// 예) 출근=8.5(08:30), dayStart=9, 퇴근=20.5 → effStart=9, raw=11.5h, -점심1h-저녁0.5h=10h
// 예) 출근=8.5(08:30), dayStart=9, 퇴근=14 → effStart=9, raw=5h, -점심1h=4h (조퇴, -4h 공제)

/**
 * calcNight: 22:00~06:00 구간 시간 계산
 * 모든 근무 상태(work, early, sat_work, sun_work, holiday, public)에 적용
 */

// ══════════════════════════════════════════
// 내 프로필 사진 / 이름 (사이드바 직원 카드)
// ══════════════════════════════════════════

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

      // localStorage 저장 (ui.js #3이 budget.js #5보다 먼저 로드되므로 항상 사용 가능)
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

// 근무유형 버튼 클릭 시 해당 인라인 아코디언 열기

// 사이드바 sb-emp-sub의 근무형태 부분만 업데이트

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

// 해당 월의 토요일 목록

// 해당 월의 주차별 토/일 날짜 목록

// ══════════════════════════════════════════
// 주별 토/일 특근 토글
// ══════════════════════════════════════════
// satToggle key: "YYYY-MM-WN-sat" / "YYYY-MM-WN-sun"

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

function renderCalendar(){
  // ★ 직업선택(온보딩) 완료 후 캘린더가 처음 그려지는 모든 경로(직장인/회사알바/
  //   일반알바/복수직종/프리랜서)가 공통으로 이 함수에 모이므로, 튜토리얼 자동 실행
  //   트리거를 여기 한 곳에 둠. initTutorial() 내부에서 이미 완료/미선택 여부를
  //   가볍게 체크해 조용히 return하므로 반복 호출(날짜 클릭, 월 이동마다)에도 안전.
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
  // 범례: N잡 직종 선택 사용자에게만 표시
  const _hasNjobJobs = _jobs.some(j=>['convenience','shortAlba','delivery','driver','freelancer'].includes(j));
  let _legEl = document.getElementById('njob-cal-legend');
  if(!_legEl){
    _legEl = document.createElement('div');
    _legEl.id = 'njob-cal-legend';
    _legEl.className = 'njob-cal-legend';
    grid.parentNode.insertBefore(_legEl, grid);
  }
  _legEl.style.display = _hasNjobJobs ? '' : 'none';
  _legEl.innerHTML = '<span class="njob-dot"></span> N잡 기록 있음 &middot; 날짜를 탭하면 상세 확인';
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

    // N잡 데이터 존재 여부 (도트 표시용) — N잡 직종 선택 시에만 체크
    let _hasNjobDot = false;
    if(_hasNjobJobs){
      try{
        const _njRaw = localStorage.getItem('atm2_njob_'+key);
        if(_njRaw){ const _nj=JSON.parse(_njRaw); _hasNjobDot=(_nj.alba||[]).length>0||(_nj.delivery||[]).length>0||(_nj.free||[]).length>0; }
      }catch(e){}
    }
    let html=`<div class="dn">${d}${_hasNjobDot?'<span class="njob-dot"></span>':''}</div>`;
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
    // N잡 기록 있는 셀 테두리 강조 (도트는 .dn 안에 이미 삽입됨)
    if(_hasNjobDot) el.style.borderColor = 'rgba(255,140,66,.4)';

    el.innerHTML=html;
    grid.appendChild(el);
  }
  renderWeekSatRow();
  renderStats(wDays,lDays,absDays,totOT,satH,sunH);
  // ★ 사이드바 이번달 요약 갱신
  setTimeout(updateSbSummary, 0);
  // ★ 오늘 칸 자동 스크롤 제거 — 캘린더 진입 시 메인 지표("예상 실수령액" 카드)가
  //   화면 밖으로 밀려나는 문제가 있어 제거함. 오늘 칸은 .cal-day.today 클래스의
  //   테두리 강조(css/main.css)로 스크롤 없이도 충분히 식별 가능.
}

function renderStats(wDays,lDays,absDays,totOT,satH,sunH){
  const twd = countWD(curY,curM);
  // 실수령액 계산
  // ★ "예상 실수령액" 라벨이 세후를 의미하므로 finalPay(4대보험·세금 차감 후) 참조로
  //   통일(이전엔 pd.netPay=grossPay, 세전 — 수입관리 페이지의 finalPay와 값이 달라
  //   같은 달인데도 화면마다 다른 금액이 보이는 용어 불일치였음)
  // ★ Income Gateway: 히어로카드는 직업유형과 무관하게 항상 직장인 전용 계산(getPayData)만
  //   보여주던 버그가 있었음 — 직업유형에 맞는 합산 수입(getIncomeSummary)으로 교체.
  //   기본급/공제 미니정보는 직장인일 때만 의미가 있으므로 직장인 선택 시에만 채움.
  let netPay = 0, basePay = 0, totAllow = 0, totDeduct = 0;
  try {
    const _selJobsHero = (typeof loadSelectedJobs==='function') ? loadSelectedJobs() : [];
    if(_selJobsHero.indexOf('employee')>=0){
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

  document.getElementById('stats-row').innerHTML = `
    <div style="width:100%;display:flex;gap:10px;flex-wrap:wrap;">

      <!-- 히어로: 예상 실수령 -->
      <div style="flex:2;min-width:200px;align-self:flex-start;background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px 20px;position:relative;">
        <div style="font-size:11px;color:var(--text3);font-weight:600;letter-spacing:.5px;margin-bottom:6px;">${wDays > 0 ? '예상 실수령액' : (netPay > 0 ? '기록 전 예상 실수령액' : '예상 실수령액')}
          <span style="font-weight:400;opacity:.85;">· 기록할수록 더 정확해져요</span>
        </div>
        <div style="font-size:28px;font-weight:900;font-family:'JetBrains Mono';color:var(--green);line-height:1.1;">
          ${netPay > 0 ? netPay.toLocaleString() + '<span style="font-size:14px;font-weight:600;margin-left:2px;">원</span>' : '<span style="font-size:15px;color:var(--text3);">아직 기록이 없어요</span>'}
        </div>
        ${netPay === 0 ? `<div style="font-size:13px;color:var(--accent);font-weight:600;margin-top:8px;">출근을 기록하면 월급날까지 버틸 수 있는지 알 수 있어요 👆</div>` : ''}
        ${prevPay > 0 && netPay > 0 ? `<div style="font-size:11px;margin-top:5px;color:${diffColor};">${diffSign}${diff.toLocaleString()}원 <span style="color:var(--text3);">전월 대비</span></div>` : ''}
        <div style="margin-top:10px;">
          <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text3);margin-bottom:3px;">
            <span>이번달 진행</span><span>${progress}%</span>
          </div>
          <div style="height:4px;background:var(--surface3);border-radius:2px;overflow:hidden;">
            <div style="height:100%;width:${progress}%;background:var(--accent);border-radius:2px;transition:width .6s ease;"></div>
          </div>
        </div>
        ${netPay > 0 ? `<div style="font-size:12px;font-weight:700;color:var(--accent);margin-top:10px;">이 돈으로 다음 월급날까지 버틸 수 있을까요?</div>` : ''}
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

// ══════════════════════════════════════════
// 팝업
// ══════════════════════════════════════════
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

// Q&A 도움말 렌더
var _qaCurrentCat = typeof _qaCurrentCat !== 'undefined' ? _qaCurrentCat : '전체';
var _qaCurrentSearch = typeof _qaCurrentSearch !== 'undefined' ? _qaCurrentSearch : '';

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

// 검색 필터

// 카테고리 필터

// 필터 적용

// Q&A에서 머니냥으로 연결

// ── 팝업 퀵 저장 함수들 ──

// 현재 한국 시간 → 분 단위 정밀도 소수 (예: 19:16 → 19 + 16/60 = 19.2666...)
// ★ 표시는 반드시 fmtTime() 사용
// 소수 시간 → HH:MM 문자열 (예: 19.2666 → "19:16")

// 연차·결근·공휴일·초기화: 시간 불필요, 즉시 저장

// 반차·조퇴·휴일근무·토요특근·일요특근: 현재시각 출근으로, end=+반차4h/나머지8h

// 출근 버튼: 현재시각 → start, end=start+8h

// 퇴근 버튼: 현재시각 → end (출근 기록 없으면 경고)

// 비고에서 시간 자동 추출 (예: "출근 09:15", "퇴근 18:30")

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

// ══════════════════════════════════════════
// 🛡️ 생존관리(가계부) — budgetState / 1~4단계
// ── leave.js/freelance.js/notifications.js가 이미 참조하던
//    budgetState/budgetLoad/calcZeroBalanceDate를 여기서 신규 정의함
// ══════════════════════════════════════════

let budgetState = {
  _loaded: false,
  fixedExpenses: { loan:0, telecom:0, insurance:0, rent:0, maintenance:0, transport:0, living:0, other:0 },
  variableExpenses: [],   // [{id, cat, amount, date:'YYYY-MM-DD', memo}]
  savingsGoal: 0,
  emergencyFund: 0,       // "현재잔고" — notifications.js가 이미 참조하는 필드명 그대로 재사용
  bankSavings: 0,
  customIncome: 0,        // 생존관리 화면에서 직접 입력하는 기타수입
  paydayDay: 0,
  warningPct: 80,
};

function budgetLoad(){
  try{
    const raw = localStorage.getItem('atm2_budgetState');
    if(raw){
      const saved = JSON.parse(raw);
      Object.assign(budgetState, saved);
    }
  }catch(e){}
  // 누락 필드 기본값 보강(과거 저장본/하위호환)
  if(!budgetState.fixedExpenses) budgetState.fixedExpenses = { loan:0, telecom:0, insurance:0, rent:0, maintenance:0, transport:0, living:0, other:0 };
  if(!budgetState.variableExpenses) budgetState.variableExpenses = [];
  budgetState._loaded = true;
  return budgetState;
}

function budgetSave(){
  try{ localStorage.setItem('atm2_budgetState', JSON.stringify(budgetState)); }catch(e){}
}

// ════════════════════════════════════════════════════════
// Income Gateway — 모든 화면의 수입 집계는 이 함수 하나만 거쳐야 함.
// selectedJobs 검증을 이 함수 안에서만 수행하고, 각 직종별 원시 계산기
// (getPayData/getAlbaPaySummary 등)는 공식을 그대로 유지한 채 "호출할지
// 말지"만 여기서 결정한다. 화면에서 금액이 필요하면 항상 getIncomeSummary()를
// 호출할 것 — getPayData()/getAlbaPaySummary()를 직접 호출하지 말 것.
// ════════════════════════════════════════════════════════
function getIncomeSummary(y, m){
  let employee=0, alba=0, freelancer=0, etc=0;

  const selectedJobs = (typeof loadSelectedJobs==='function') ? loadSelectedJobs() : [];
  let albaSubtype = '';
  try{ albaSubtype = localStorage.getItem('atm2_albaSubtype')||''; }catch(e){}
  const isAlbaCompany = selectedJobs.indexOf('convenience')>=0 && albaSubtype === 'company';
  const isEmployee = selectedJobs.indexOf('employee')>=0;
  const isAlba = selectedJobs.some(j=>['convenience','shortAlba'].indexOf(j)>=0) || isAlbaCompany;
  const isDelivery = selectedJobs.some(j=>['delivery','driver'].indexOf(j)>=0);
  const isFreelancer = selectedJobs.indexOf('freelancer')>=0;

  try{
    if(isEmployee && typeof getPayData==='function'){
      const isCurMonth = (typeof curY!=='undefined' && typeof curM!=='undefined' && y===curY && m===curM);
      const pd = isCurMonth ? getPayData() : ((typeof getPayDataForMonth==='function') ? getPayDataForMonth(y,m) : null);
      if(pd) employee = pd.finalPay || 0;
    }
  }catch(e){}

  try{
    if(isAlba && typeof getAlbaPaySummary==='function'){
      alba = getAlbaPaySummary(y, m).finalPay || 0;
    }
  }catch(e){}

  try{
    const dim = new Date(y, m+1, 0).getDate();
    for(let d=1; d<=dim; d++){
      const key = (typeof dk==='function') ? dk(y,m,d) : `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      if(typeof njobLoad !== 'function') break;
      const nd = njobLoad(key);
      if(isFreelancer){
        (nd.free||[]).forEach(it=>{
          const gross = (typeof freeItemAmount==='function') ? freeItemAmount(it) : ((it.count||0)*(it.price||0));
          freelancer += Math.round(gross * 0.967); // 3.3% 원천징수(사업소득)
        });
      }
      if(isDelivery){
        (nd.delivery||[]).forEach(it=>{ etc += (it.count||0)*(it.price||0); });
      }
      // 기타(etc) 항목은 특정 직종에 종속되지 않는 자유 입력 수입이라 직업유형과 무관하게 포함
      (nd.etc||[]).forEach(it=>{ etc += it.amount||0; });
    }
  }catch(e){}

  try{
    const incKey = `atm2_income_${y}_${String(m+1).padStart(2,'0')}`;
    const raw = localStorage.getItem(incKey);
    if(raw){
      const items = JSON.parse(raw);
      items.forEach(it=>{
        const amt = parseInt(it.amount)||0;
        const net = (it.platformNet!=null) ? parseInt(it.platformNet) : Math.round(amt*0.967);
        if(it.jobType === 'freelancer'){ if(isFreelancer) freelancer += net; }
        else if(it.jobType === 'employee'){ /* 직장 수입은 employee 변수에서만 집계 */ }
        else if(it.jobType && ['convenience','shortAlba'].indexOf(it.jobType)>=0){ if(isAlba) alba += net; }
        else if(it.jobType && ['delivery','driver'].indexOf(it.jobType)>=0){ if(isDelivery) etc += net; }
        else { etc += net; } // 직종 미지정/기타 항목은 자유 입력으로 간주
      });
    }
  }catch(e){}

  etc += (budgetState && budgetState.customIncome || 0);

  return { employee, alba, freelancer, etc, total: employee+alba+freelancer+etc, selectedJobs };
}

// ── 잔고 소진일 예측 (4단계) ──
function calcZeroBalanceDate(){
  if(!budgetState._loaded) budgetLoad();
  const today = new Date();
  const y=today.getFullYear(), m=today.getMonth(), d=today.getDate();

  const income = getIncomeSummary(y, m);
  const fixedTotal = Object.values(budgetState.fixedExpenses||{}).reduce((s,v)=>s+(parseInt(v)||0),0);
  const ymPrefix = `${y}-${String(m+1).padStart(2,'0')}`;
  const monthVar = (budgetState.variableExpenses||[]).filter(e=>e.date && e.date.startsWith(ymPrefix));
  const varTotal = monthVar.reduce((s,e)=>s+(parseInt(e.amount)||0),0);

  const availableBudget = income.total - fixedTotal - (budgetState.savingsGoal||0);
  const avgDailySpend = d>0 ? varTotal/d : 0;
  const currentBalance = budgetState.emergencyFund || 0;

  let dateStr, daysLeft;
  if(avgDailySpend <= 0){
    dateStr = '지출 기록이 쌓이면 표시돼요'; daysLeft = null;
  } else {
    daysLeft = Math.floor(currentBalance / avgDailySpend);
    if(daysLeft < 0){ dateStr = '이미 부족해요'; }
    else{
      const zeroDate = new Date(today); zeroDate.setDate(zeroDate.getDate() + daysLeft);
      dateStr = `${zeroDate.getMonth()+1}월 ${zeroDate.getDate()}일`;
    }
  }

  // 위험도(사용설명서 기준): 안전(<80%) / 주의(80%+) / 위험(85%+) / 초위험(100%+)
  const spentPct = availableBudget>0 ? Math.round((varTotal/availableBudget)*100) : (varTotal>0?100:0);
  let riskLevel = 'safe', riskLabel = '✅ 안전';
  if(varTotal===0){ riskLevel='nodata'; riskLabel='지출 기록이 쌓이면 분석이 시작돼요'; }
  else if(spentPct>=100){ riskLevel='danger_high'; riskLabel='🚨 초위험'; }
  else if(spentPct>=85){ riskLevel='danger'; riskLabel='🔥 위험'; }
  else if(spentPct>=80){ riskLevel='warning'; riskLabel='⚠️ 주의'; }

  return { date:dateStr, daysLeft, avgDailySpend:Math.round(avgDailySpend), currentBalance,
           availableBudget, varTotal, fixedTotal, spentPct, riskLevel, riskLabel };
}

// ── 2단계: 고정지출 저장 ──
function saveBudgetFixedExpenses(){
  if(!budgetState._loaded) budgetLoad();
  const ids = ['loan','telecom','insurance','rent','maintenance','transport','living','other'];
  ids.forEach(id=>{
    const el = document.getElementById('bdg-fixed-'+id);
    if(el) budgetState.fixedExpenses[id] = parseInt(el.value)||0;
  });
  budgetSave();
  if(typeof showToast==='function') showToast('✅ 고정지출 저장됨');
  renderBudgetPage();
}

// ── 3단계: 변동지출 추가/삭제 ──
function addBudgetVariableExpense(){
  if(!budgetState._loaded) budgetLoad();
  const cat = document.getElementById('bdg-var-cat')?.value || 'etc';
  const amount = parseInt(document.getElementById('bdg-var-amount')?.value)||0;
  const date = document.getElementById('bdg-var-date')?.value || new Date().toISOString().slice(0,10);
  const memo = (document.getElementById('bdg-var-memo')?.value || '').trim();
  if(amount<=0){ if(typeof showToast==='function') showToast('⚠️ 금액을 입력해주세요'); return; }
  budgetState.variableExpenses.push({ id:Date.now(), cat, amount, date, memo });
  budgetSave();
  if(typeof showToast==='function') showToast('✅ 지출 추가됨');
  renderBudgetPage();
}

function deleteBudgetVariableExpense(id){
  if(!budgetState._loaded) budgetLoad();
  budgetState.variableExpenses = budgetState.variableExpenses.filter(e=>e.id!==id);
  budgetSave();
  renderBudgetPage();
}

// ── 4단계: 현재잔고/저축목표/기타수입 저장 ──
function saveBudgetSettings(){
  if(!budgetState._loaded) budgetLoad();
  budgetState.emergencyFund = parseInt(document.getElementById('bdg-current-balance')?.value)||0;
  budgetState.savingsGoal   = parseInt(document.getElementById('bdg-savings-goal')?.value)||0;
  budgetState.customIncome  = parseInt(document.getElementById('bdg-custom-income')?.value)||0;
  budgetSave();
  if(typeof showToast==='function') showToast('✅ 저장됨');
  renderBudgetPage();
}

// ── 1단계: 생존관리 메인 렌더 ──
const BDG_FIXED_LABELS = { loan:'대출', telecom:'통신비', insurance:'보험', rent:'월세', maintenance:'관리비', transport:'교통비', living:'생활비', other:'기타' };
const BDG_VAR_CATS = { food:'🍚 식비', cafe:'☕ 카페', shopping:'🛍️ 쇼핑', medical:'🏥 병원', hobby:'🎮 취미', etc:'➕ 기타' };

function renderBudgetPage(){
  if(!budgetState._loaded) budgetLoad();
  const page = document.getElementById('budget-page');
  if(!page) return;

  const today = new Date();
  const y = today.getFullYear(), m = today.getMonth();
  const income = getIncomeSummary(y, m);
  const fixedTotal = Object.values(budgetState.fixedExpenses).reduce((s,v)=>s+(parseInt(v)||0),0);
  const ymPrefix = `${y}-${String(m+1).padStart(2,'0')}`;
  const monthVar = (budgetState.variableExpenses||[]).filter(e=>e.date && e.date.startsWith(ymPrefix));
  const varTotal = monthVar.reduce((s,e)=>s+(parseInt(e.amount)||0),0);
  const totalExpense = fixedTotal + varTotal;
  const remain = income.total - totalExpense;
  const zb = calcZeroBalanceDate();

  const riskBg = { nodata:'var(--surface2)', safe:'rgba(61,214,140,.1)', warning:'rgba(255,209,102,.1)', danger:'rgba(255,159,67,.12)', danger_high:'rgba(255,92,122,.12)' }[zb.riskLevel];
  const riskBorder = { nodata:'var(--border)', safe:'rgba(61,214,140,.3)', warning:'rgba(255,209,102,.35)', danger:'rgba(255,159,67,.35)', danger_high:'rgba(255,92,122,.35)' }[zb.riskLevel];

  // 카테고리별 변동지출 합계(3단계)
  const catTotals = {};
  monthVar.forEach(e=>{ catTotals[e.cat] = (catTotals[e.cat]||0) + (parseInt(e.amount)||0); });

  const varListHtml = monthVar.slice().reverse().map(e=>`
    <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-bottom:1px solid var(--border);">
      <div style="font-size:13px;color:var(--text);">${BDG_VAR_CATS[e.cat]||e.cat} <span style="color:var(--text3);font-size:11px;">${e.date}</span>${e.memo?` · ${e.memo}`:''}</div>
      <div style="display:flex;align-items:center;gap:8px;">
        <div style="font-size:13px;font-weight:700;color:var(--red);">-${e.amount.toLocaleString()}원</div>
        <button onclick="deleteBudgetVariableExpense(${e.id})" style="background:none;border:none;color:var(--text3);font-size:14px;cursor:pointer;">✕</button>
      </div>
    </div>`).join('') || `<div style="padding:14px;text-align:center;color:var(--text3);font-size:13px;">이번 달 변동지출 기록 없음</div>`;

  const catBarHtml = Object.keys(BDG_VAR_CATS).map(cat=>{
    const amt = catTotals[cat]||0;
    const pct = varTotal>0 ? Math.round(amt/varTotal*100) : 0;
    if(amt<=0) return '';
    return `<div style="margin-bottom:6px;">
      <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text2);margin-bottom:2px;">
        <span>${BDG_VAR_CATS[cat]}</span><span>${amt.toLocaleString()}원 (${pct}%)</span>
      </div>
      <div style="height:6px;background:var(--surface2);border-radius:4px;overflow:hidden;">
        <div style="height:100%;width:${pct}%;background:var(--accent);"></div>
      </div>
    </div>`;
  }).join('');

  page.innerHTML = `
    <div class="budget-container">

      <div style="font-size:15px;font-weight:700;color:var(--accent);padding:0 2px 10px;">이번 달 받을 돈과 지출을 비교해서, 월급날까지 버틸 수 있는지 확인해보세요</div>

      <!-- 경고 배너(4단계) — 항상 전체 폭 -->
      <div style="background:${riskBg};border:1px solid ${riskBorder};border-radius:12px;padding:14px;margin-bottom:14px;">
        <div style="font-size:15px;font-weight:800;margin-bottom:8px;">${zb.riskLevel==='nodata' ? '📭 ' + zb.riskLabel : zb.riskLabel + ` (이번달 가용예산의 ${zb.spentPct}% 사용)`}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px;color:var(--text2);">
          <div>💰 현재잔고<br><b style="font-size:15px;color:var(--text);">${zb.currentBalance.toLocaleString()}원</b></div>
          <div>📉 일평균지출<br><b style="font-size:15px;color:var(--text);">${zb.avgDailySpend.toLocaleString()}원</b></div>
          <div>🚨 예상소진일<br><b style="font-size:15px;color:var(--red);">${zb.date}</b></div>
          <div>⏳ 남은 일수<br><b style="font-size:15px;color:var(--text);">${zb.daysLeft!=null?zb.daysLeft+'일':'-'}</b></div>
        </div>
      </div>

      <!-- ★ 노트북/데스크탑(1025px+)에서는 2단 그리드로 배치, 그 이하는 세로 1열(기존과 동일) -->
      <div class="budget-grid">

        <!-- 1단계: 수입/지출/남은금액 -->
        <div class="budget-card">
          <div style="font-size:14px;font-weight:700;margin-bottom:10px;">📊 이번달 수입·지출</div>
          <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--text2);margin-bottom:4px;"><span>🏢 직장인수입</span><b style="color:var(--text);">${income.employee.toLocaleString()}원</b></div>
          <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--text2);margin-bottom:4px;"><span>💪 알바수입${income.alba>0?' <span style="font-size:10px;color:var(--text3);">(주휴수당 포함 가능)</span>':''}</span><b style="color:var(--text);">${income.alba.toLocaleString()}원</b></div>
          <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--text2);margin-bottom:4px;"><span>💻 프리랜서수입</span><b style="color:var(--text);">${income.freelancer.toLocaleString()}원</b></div>
          <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--text2);margin-bottom:8px;"><span>➕ 기타수입</span><b style="color:var(--text);">${income.etc.toLocaleString()}원</b></div>
          <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:700;border-top:1px solid var(--border);padding-top:8px;margin-bottom:6px;"><span>총수입</span><span style="color:var(--green);">${income.total.toLocaleString()}원</span></div>
          <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:700;margin-bottom:6px;"><span>총지출</span><span style="color:var(--red);">${totalExpense.toLocaleString()}원</span></div>
          <div style="display:flex;justify-content:space-between;font-size:17px;font-weight:800;border-top:1px solid var(--border);padding-top:8px;"><span>남은금액</span><span style="color:${remain>=0?'var(--accent)':'var(--red)'};">${remain.toLocaleString()}원</span></div>
        </div>

        <!-- 4단계: 잔고/저축목표/기타수입 설정 (1단계와 같은 행에 배치) -->
        <div class="budget-card">
          <div style="font-size:14px;font-weight:700;margin-bottom:10px;">🎯 잔고·저축 설정</div>
          <div style="margin-bottom:8px;">
            <div style="font-size:11px;color:var(--text3);margin-bottom:3px;">💰 현재 잔고</div>
            <input id="bdg-current-balance" class="budget-input" type="number" min="0" value="${budgetState.emergencyFund||0}">
          </div>
          <div style="margin-bottom:8px;">
            <div style="font-size:11px;color:var(--text3);margin-bottom:3px;">🎯 월 저축 목표</div>
            <input id="bdg-savings-goal" class="budget-input" type="number" min="0" value="${budgetState.savingsGoal||0}">
          </div>
          <div style="margin-bottom:10px;">
            <div style="font-size:11px;color:var(--text3);margin-bottom:3px;">➕ 기타수입 직접입력</div>
            <input id="bdg-custom-income" class="budget-input" type="number" min="0" value="${budgetState.customIncome||0}">
          </div>
          <button onclick="saveBudgetSettings()" style="width:100%;padding:11px;border-radius:10px;border:none;
            background:var(--accent);color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:'Noto Sans KR';">💾 저장</button>
        </div>

        <!-- 2단계: 고정지출 -->
        <div class="budget-card">
          <div style="font-size:14px;font-weight:700;margin-bottom:10px;">⚙️ 고정지출 설정 <span style="font-size:12px;color:var(--text3);">(합계 ${fixedTotal.toLocaleString()}원)</span></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
            ${Object.keys(BDG_FIXED_LABELS).map(id=>`
              <div>
                <div style="font-size:11px;color:var(--text3);margin-bottom:3px;">${BDG_FIXED_LABELS[id]}</div>
                <input id="bdg-fixed-${id}" class="budget-input" type="number" min="0" step="1000" value="${budgetState.fixedExpenses[id]||0}">
              </div>`).join('')}
          </div>
          <button onclick="saveBudgetFixedExpenses()" style="width:100%;padding:11px;border-radius:10px;border:none;
            background:var(--accent);color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:'Noto Sans KR';">💾 고정지출 저장</button>
        </div>

        <!-- 3단계: 변동지출 -->
        <div class="budget-card">
          <div style="font-size:14px;font-weight:700;margin-bottom:10px;">🧾 변동지출 <span style="font-size:12px;color:var(--text3);">(이번달 ${varTotal.toLocaleString()}원)</span></div>
          ${catBarHtml}
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0;">
            <select id="bdg-var-cat" class="budget-input">
              ${Object.keys(BDG_VAR_CATS).map(c=>`<option value="${c}">${BDG_VAR_CATS[c]}</option>`).join('')}
            </select>
            <input id="bdg-var-amount" class="budget-input" type="number" min="0" placeholder="금액">
            <input id="bdg-var-date" class="budget-input" type="date" value="${today.toISOString().slice(0,10)}">
            <input id="bdg-var-memo" class="budget-input" type="text" placeholder="메모(선택)">
          </div>
          <button onclick="addBudgetVariableExpense()" style="width:100%;padding:11px;border-radius:10px;border:none;
            background:var(--green);color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:'Noto Sans KR';margin-bottom:8px;">+ 지출 입력</button>
          <div style="max-height:220px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;">${varListHtml}</div>
        </div>

      </div>
    </div>`;
}
