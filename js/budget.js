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

      // localStorage 저장 (192px 리사이즈 후 약 30KB)
      try{
        localStorage.setItem('companyLogo', b64);
        if(typeof activeWpId!=='undefined' && activeWpId) wpUpdate(activeWpId,{logo:b64});
      }catch(err){ showToast('⚠️ 저장 공간 부족으로 로고를 저장하지 못했어요'); }
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
  // 이번 달이면 오늘 칸으로 부드럽게 스크롤
  const _now = new Date();
  if(curY===_now.getFullYear() && curM===_now.getMonth()){
    setTimeout(()=>{
      const _td = document.querySelector('.cal-day.today');
      if(_td) _td.scrollIntoView({behavior:'smooth', block:'nearest'});
    }, 80);
  }
}

function renderStats(wDays,lDays,absDays,totOT,satH,sunH){
  const twd = countWD(curY,curM);
  // 실수령액 계산
  let netPay = 0, basePay = 0, totAllow = 0, totDeduct = 0;
  try {
    const pd = getPayData();
    if(pd){ netPay=pd.netPay||0; basePay=pd.basePay||0; totAllow=pd.totAllow||0; totDeduct=pd.totDeduct||0; }
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
      <div style="flex:2;min-width:200px;background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px 20px;position:relative;overflow:hidden;">
        <div style="font-size:11px;color:var(--text3);font-weight:600;letter-spacing:.5px;margin-bottom:6px;">예상 실수령액</div>
        <div style="font-size:28px;font-weight:900;font-family:'JetBrains Mono';color:var(--green);line-height:1.1;">
          ${netPay > 0 ? netPay.toLocaleString() + '<span style="font-size:14px;font-weight:600;margin-left:2px;">원</span>' : '<span style="font-size:16px;color:var(--text3);">급여 정보 없음</span>'}
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
  const nMult = 1.5;   // 야간: ×1.5 전액 (salary.js 야간수당 계산과 동일 배율)

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
