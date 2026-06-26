// 프리랜서 모드 - 달력 스케줄 팝업
// ══════════════════════════════════════════
const FL_TYPES = {
  meeting:  {label:'📅 미팅',    cls:'type-meeting'},
  deadline: {label:'🔥 마감',    cls:'type-deadline'},
  work:     {label:'💼 작업',    cls:'type-work'},
  personal: {label:'🧘 개인',    cls:'type-personal'},
  etc:      {label:'📌 기타',    cls:'type-etc'}
};

function openFlPopup(key, d){
  editKey = key;
  const items = flData[key] || [];
  const dateLabel = `${curY}년 ${curM+1}월 ${d}일`;

  let overlay = document.getElementById('fl-popup');
  if(!overlay){
    overlay = document.createElement('div');
    overlay.id = 'fl-popup';
    overlay.className = 'overlay';
    overlay.style.display = 'none';
    overlay.onclick = e=>{ if(e.target===overlay) closeFlPopup(); };
    document.body.appendChild(overlay);
  }

  const itemsHtml = items.map((item,i)=>`
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px 12px 10px;margin-bottom:8px;position:relative;"
         class="${item.alarmTime?'alarm-active':''}">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
        <span style="font-size:16px;font-weight:700;padding:2px 8px;border-radius:6px;background:rgba(79,124,255,.15);color:var(--accent);">
          ${FL_TYPES[item.type]?.label||'📌 기타'}
        </span>
        ${item.alarmTime?`<span style="font-size:14px;color:var(--yellow);">🔔 ${item.alarmTime}</span>`:''}
        <button onclick="deleteFlItem('${key}',${i})" style="margin-left:auto;background:none;border:none;color:var(--red);font-size:21px;cursor:pointer;line-height:1;">✕</button>
      </div>
      <div style="font-size:18px;font-weight:700;color:var(--text);margin-bottom:3px;">${item.title}</div>
      ${item.note?`<div style="font-size:16px;color:var(--text2);line-height:1.5;">${item.note}</div>`:''}
    </div>`).join('');

  overlay.innerHTML = `
    <div class="popup" style="width:400px;padding:22px 20px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
        <h3 style="font-size:21px;margin:0;">💻 ${dateLabel}</h3>
        <button onclick="closeFlPopup()" style="background:none;border:none;color:var(--text2);font-size:23px;cursor:pointer;">✕</button>
      </div>

      <!-- 등록된 스케줄 -->
      <div id="fl-items-list" style="max-height:220px;overflow-y:auto;margin-bottom:14px;">
        ${items.length?itemsHtml:'<div style="text-align:center;padding:20px;color:var(--text3);font-size:17px;">등록된 스케줄 없음</div>'}
      </div>

      <!-- 새 스케줄 추가 폼 -->
      <div style="background:rgba(79,124,255,.05);border:1px solid rgba(79,124,255,.2);border-radius:12px;padding:14px;">
        <div style="font-size:16px;font-weight:700;color:var(--accent);margin-bottom:10px;">+ 새 스케줄 추가</div>

        <!-- 유형 선택 -->
        <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:10px;" id="fl-type-btns">
          ${Object.entries(FL_TYPES).map(([k,v])=>`
            <button onclick="selFlType('${k}')" id="flt-${k}"
              style="padding:5px 10px;border-radius:6px;border:1px solid var(--border);
                     background:${k==='work'?'rgba(79,124,255,.2)':'var(--surface2)'};
                     color:${k==='work'?'var(--accent)':'var(--text2)'};
                     font-size:16px;font-weight:600;cursor:pointer;font-family:'Noto Sans KR';
                     transition:all .15s;">${v.label}</button>`).join('')}
        </div>

        <!-- 제목 -->
        <input id="fl-title-inp" type="text" placeholder="제목 (예: 클라이언트 미팅, 프로젝트 마감)"
          style="width:100%;background:var(--surface2);border:1px solid var(--border);color:var(--text);
                 border-radius:8px;padding:10px 12px;font-size:18px;font-family:'Noto Sans KR';outline:none;
                 margin-bottom:8px;">

        <!-- 메모 -->
        <textarea id="fl-note-inp" placeholder="메모 (선택사항)"
          style="width:100%;background:var(--surface2);border:1px solid var(--border);color:var(--text);
                 border-radius:8px;padding:10px 12px;font-size:17px;font-family:'Noto Sans KR';outline:none;
                 resize:none;height:56px;margin-bottom:8px;"></textarea>

        <!-- 알람 시간 -->
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
          <span style="font-size:17px;color:var(--text2);">🔔 알람</span>
          <input id="fl-alarm-inp" type="time"
            style="background:var(--surface2);border:1px solid var(--border);color:var(--text);
                   border-radius:6px;padding:6px 10px;font-size:17px;font-family:'Noto Sans KR';outline:none;flex:1;">
          <span style="font-size:15px;color:var(--text3);">시간 선택 (선택사항)</span>
        </div>

        <button onclick="addFlItem('${key}')"
          style="width:100%;padding:11px;border-radius:8px;border:none;
                 background:var(--accent);color:#fff;font-size:18px;font-weight:700;
                 cursor:pointer;font-family:'Noto Sans KR';">+ 추가</button>
      </div>

      <button onclick="closeFlPopup()" style="width:100%;margin-top:10px;padding:10px;border-radius:8px;
        border:1px solid var(--border);background:var(--surface2);color:var(--text2);
        font-size:18px;cursor:pointer;font-family:'Noto Sans KR';">닫기</button>
    </div>`;

  overlay.style.display = 'flex';
  // work 타입 기본 선택
  window._flSelType = 'work';
}

function selFlType(t){
  window._flSelType = t;
  Object.keys(FL_TYPES).forEach(k=>{
    const btn = document.getElementById('flt-'+k);
    if(!btn) return;
    btn.style.background = k===t?'rgba(79,124,255,.2)':'var(--surface2)';
    btn.style.color = k===t?'var(--accent)':'var(--text2)';
    btn.style.borderColor = k===t?'var(--accent)':'var(--border)';
  });
}

function addFlItem(key){
  const title = (document.getElementById('fl-title-inp').value||'').trim();
  if(!title){ showToast('⚠️ 제목을 입력해주세요'); return; }
  const note = (document.getElementById('fl-note-inp').value||'').trim();
  const alarmTime = document.getElementById('fl-alarm-inp').value || '';
  const type = window._flSelType || 'work';

  if(!flData[key]) flData[key] = [];
  const item = { id: Date.now(), type, title, note, alarmTime };
  flData[key].push(item);

  // 알람 등록
  if(alarmTime){
    registerAlarm(key, alarmTime, `📅 ${title}`);
  }
  lsSave();
  renderCalendar();
  closeFlPopup();
  showToast('✅ 스케줄 추가됨');
}

function deleteFlItem(key, idx){
  if(!flData[key]) return;
  flData[key].splice(idx, 1);
  if(flData[key].length === 0) delete flData[key];
  lsSave();
  renderCalendar();
  closeFlPopup();
}

function closeFlPopup(){
  const o = document.getElementById('fl-popup');
  if(o) o.style.display = 'none';
}

// ══════════════════════════════════════════
// 알바 모드 - 날짜별 알바 입력 팝업
// ══════════════════════════════════════════
function openAlbaPopup(key, d){
  editKey = key;
  const items = albaData[key] || [];
  const dateLabel = `${curY}년 ${curM+1}월 ${d}일`;

  let overlay = document.getElementById('alba-popup');
  if(!overlay){
    overlay = document.createElement('div');
    overlay.id = 'alba-popup';
    overlay.className = 'overlay';
    overlay.style.display = 'none';
    overlay.onclick = e=>{ if(e.target===overlay) closeAlbaPopup(); };
    document.body.appendChild(overlay);
  }

  const fmtWon = n => n ? n.toLocaleString('ko-KR')+'원' : '0원';
  const calcPay = item => {
    if(!item.startH || !item.endH) return 0;
    let h = item.endH - item.startH;
    if(h < 0) h += 24;
    return Math.round(h * (item.wage||0));
  };

  const itemsHtml = items.map((item,i)=>{
    const pay = calcPay(item);
    const hrs = item.endH && item.startH ? (()=>{let h=item.endH-item.startH;if(h<0)h+=24;return h;})() : 0;
    return `
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:8px;position:relative;"
           class="${item.alarmTime?'alarm-active':''}">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
          <span style="font-size:18px;font-weight:700;color:var(--text);flex:1;">${item.name||'알바'}</span>
          ${item.alarmTime?`<span style="font-size:14px;color:var(--yellow);">🔔 ${item.alarmTime}</span>`:''}
          <button onclick="deleteAlbaItem('${key}',${i})" style="background:none;border:none;color:var(--red);font-size:21px;cursor:pointer;line-height:1;">✕</button>
        </div>
        <div style="font-size:16px;color:var(--text2);display:flex;gap:12px;flex-wrap:wrap;">
          ${item.startH!==undefined?`<span>⏰ ${pad2(item.startH)}:00 ~ ${pad2(item.endH)}:00 (${hrs}h)</span>`:''}
          ${item.wage?`<span>💰 시급 ${item.wage.toLocaleString()}원</span>`:''}
          ${pay>0?`<span style="color:var(--green);font-weight:700;">= ${fmtWon(pay)}</span>`:''}
        </div>
        ${item.note?`<div style="font-size:16px;color:var(--text3);margin-top:4px;">${item.note}</div>`:''}
      </div>`;
  }).join('');

  // 총 수입 계산
  const totalPay = items.reduce((s,it)=>s+calcPay(it),0);
  const tax33 = Math.round(totalPay * 0.033);
  const afterTax = totalPay - tax33;

  overlay.innerHTML = `
    <div class="popup" style="width:400px;padding:22px 20px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
        <h3 style="font-size:21px;margin:0;">⏰ ${dateLabel}</h3>
        <button onclick="closeAlbaPopup()" style="background:none;border:none;color:var(--text2);font-size:23px;cursor:pointer;">✕</button>
      </div>

      <!-- 합계 + 3.3% 세금 -->
      ${totalPay>0?`<div style="background:rgba(61,214,140,.1);border:1px solid rgba(61,214,140,.3);border-radius:10px;padding:12px 14px;margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <span style="font-size:17px;color:var(--text2);">오늘 급여 합계</span>
          <span style="font-size:21px;font-weight:700;color:var(--text);">${fmtWon(totalPay)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <span style="font-size:16px;color:var(--red);">3.3% 원천징수 공제</span>
          <span style="font-size:17px;font-weight:600;color:var(--red);">-${fmtWon(tax33)}</span>
        </div>
        <div style="border-top:1px solid rgba(61,214,140,.3);margin-top:4px;padding-top:6px;display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:17px;font-weight:700;color:var(--text2);">실수령 (세후)</span>
          <span style="font-size:23px;font-weight:700;color:var(--green);">${fmtWon(afterTax)}</span>
        </div>
        <div style="font-size:14px;color:var(--text3);margin-top:4px;">※ 3.3% = 소득세 3% + 지방소득세 0.3% (프리랜서/알바 원천징수)</div>
      </div>`:''}

      <!-- 등록된 알바 목록 -->
      <div style="max-height:200px;overflow-y:auto;margin-bottom:14px;">
        ${items.length?itemsHtml:'<div style="text-align:center;padding:18px;color:var(--text3);font-size:17px;">등록된 알바 없음</div>'}
      </div>

      <!-- 새 알바 추가 폼 -->
      <div style="background:rgba(255,140,66,.05);border:1px solid rgba(255,140,66,.25);border-radius:12px;padding:14px;">
        <div style="font-size:16px;font-weight:700;color:var(--orange);margin-bottom:10px;">+ 알바 추가</div>

        <input id="alba-name-inp" type="text" placeholder="알바명 (예: 편의점, 카페, 배달)"
          style="width:100%;background:var(--surface2);border:1px solid var(--border);color:var(--text);
                 border-radius:8px;padding:10px 12px;font-size:18px;font-family:'Noto Sans KR';outline:none;margin-bottom:8px;">

        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px;">
          <div>
            <div style="font-size:15px;color:var(--text3);margin-bottom:3px;">출근 시간</div>
            <select id="alba-start-inp" style="width:100%;background:var(--surface2);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:7px 8px;font-size:17px;font-family:'Noto Sans KR';">
              ${Array.from({length:24},(_,h)=>`<option value="${h}">${pad2(h)}:00</option>`).join('')}
            </select>
          </div>
          <div>
            <div style="font-size:15px;color:var(--text3);margin-bottom:3px;">퇴근 시간</div>
            <select id="alba-end-inp" style="width:100%;background:var(--surface2);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:7px 8px;font-size:17px;font-family:'Noto Sans KR';">
              ${Array.from({length:24},(_,h)=>`<option value="${h}" ${h===18?'selected':''}>${pad2(h)}:00</option>`).join('')}
            </select>
          </div>
          <div>
            <div style="font-size:15px;color:var(--text3);margin-bottom:3px;">시급 (원)</div>
            <input id="alba-wage-inp" type="number" value="" id="alba-wage-inp" min="0" step="100"
              style="width:100%;background:var(--surface2);border:1px solid var(--border);color:var(--text);
                     border-radius:6px;padding:7px 8px;font-size:17px;font-family:'Noto Sans KR';outline:none;text-align:right;">
          </div>
        </div>

        <textarea id="alba-note-inp" placeholder="메모 (선택사항)"
          style="width:100%;background:var(--surface2);border:1px solid var(--border);color:var(--text);
                 border-radius:8px;padding:9px 12px;font-size:17px;font-family:'Noto Sans KR';outline:none;
                 resize:none;height:48px;margin-bottom:8px;"></textarea>

        <!-- 알람 -->
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
          <span style="font-size:17px;color:var(--text2);">🔔 알람</span>
          <input id="alba-alarm-inp" type="time"
            style="background:var(--surface2);border:1px solid var(--border);color:var(--text);
                   border-radius:6px;padding:6px 10px;font-size:17px;font-family:'Noto Sans KR';outline:none;flex:1;">
          <span style="font-size:15px;color:var(--text3);">출근 알람 시간</span>
        </div>

        <button onclick="addAlbaItem('${key}')"
          style="width:100%;padding:11px;border-radius:8px;border:none;
                 background:var(--orange);color:#fff;font-size:18px;font-weight:700;
                 cursor:pointer;font-family:'Noto Sans KR';">+ 추가</button>
      </div>

      <button onclick="closeAlbaPopup()" style="width:100%;margin-top:10px;padding:10px;border-radius:8px;
        border:1px solid var(--border);background:var(--surface2);color:var(--text2);
        font-size:18px;cursor:pointer;font-family:'Noto Sans KR';">닫기</button>
    </div>`;

  overlay.style.display = 'flex';
  // 기본 출근시간 9시로 맞춤
  const startSel = document.getElementById('alba-start-inp');
  if(startSel) startSel.value = '9';
}

function addAlbaItem(key){
  const name = (document.getElementById('alba-name-inp').value||'').trim();
  if(!name){ showToast('⚠️ 알바명을 입력해주세요'); return; }
  const startH = parseInt(document.getElementById('alba-start-inp').value)||0;
  const endH   = parseInt(document.getElementById('alba-end-inp').value)||18;
  const wageEl = document.getElementById('alba-wage-inp'); if(wageEl && !wageEl.value) wageEl.value = CURRENT_MIN_WAGE;
  const wage   = parseInt(document.getElementById('alba-wage-inp').value)||CURRENT_MIN_WAGE;
  const note   = (document.getElementById('alba-note-inp').value||'').trim();
  const alarmTime = document.getElementById('alba-alarm-inp').value || '';

  if(!albaData[key]) albaData[key] = [];
  albaData[key].push({ id:Date.now(), name, startH, endH, wage, note, alarmTime });

  if(alarmTime) registerAlarm(key, alarmTime, `⏰ ${name} 알바 시작`);
  lsSave();
  renderCalendar();
  closeAlbaPopup();
  showToast('✅ 알바 추가됨');
}

function deleteAlbaItem(key, idx){
  if(!albaData[key]) return;
  albaData[key].splice(idx, 1);
  if(albaData[key].length===0) delete albaData[key];
  lsSave();
  renderCalendar();
  closeAlbaPopup();
}

function closeAlbaPopup(){
  const o = document.getElementById('alba-popup');
  if(o) o.style.display = 'none';
}

// ══════════════════════════════════════════
// 알람 시스템 (Web Notifications + Interval)
// ══════════════════════════════════════════
function registerAlarm(dateKey, timeStr, label){
  // 기존 같은 날짜+시간 중복 제거
  alarmList = alarmList.filter(a => !(a.key===dateKey && a.time===timeStr && a.label===label));
  alarmList.push({ key: dateKey, time: timeStr, label, fired: false });
  lsSave();
  requestNotifPermission();
}

function requestNotifPermission(){
  if(!('Notification' in window)) return;
  if(Notification.permission === 'default'){
    Notification.requestPermission().then(()=>{
      // 권한 변경 후 설정 화면의 권한 배너 즉시 갱신
      if(typeof renderSmartNotifPanel === 'function') renderSmartNotifPanel();
    });
  } else {
    // 이미 granted/denied 상태인 경우도 배너 상태 동기화
    if(typeof renderSmartNotifPanel === 'function') renderSmartNotifPanel();
  }
}

function startAlarmTick(){
  if(_alarmTick) return;
  _alarmTick = setInterval(checkAlarms, 30000); // 30초마다 체크
  checkAlarms(); // 즉시 1회 체크
}

function checkAlarms(){
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${pad2(now.getMonth()+1)}-${pad2(now.getDate())}`;
  const nowTime = pad2(now.getHours())+':'+pad2(now.getMinutes());

  alarmList.forEach((alarm, idx) => {
    if(alarm.fired) return;
    if(alarm.key !== todayKey) return;
    if(alarm.time !== nowTime) return;

    // 알람 발동!
    alarmList[idx].fired = true;
    fireAlarm(alarm.label, alarm.key);
  });
}

function fireAlarm(label, dateKey){
  // 브라우저 알림
  if('Notification' in window && Notification.permission === 'granted'){
    new Notification('📅 일정 알람', {
      body: label,
      icon: localStorage.getItem('companyLogo') || '',
      badge: '',
      tag: 'atm-alarm-' + dateKey
    });
  }
  // 인앱 토스트 (항상 표시)
  let t = document.getElementById('_alarm-toast');
  if(!t){
    t = document.createElement('div');
    t.id = '_alarm-toast';
    t.style.cssText = `position:fixed;top:80px;left:50%;transform:translateX(-50%);
      background:linear-gradient(135deg,#4f7cff,#9b7cff);color:#fff;
      padding:14px 24px;border-radius:16px;font-size:20px;font-weight:700;
      z-index:9999;box-shadow:0 8px 32px rgba(79,124,255,.4);
      font-family:'Noto Sans KR';text-align:center;max-width:90vw;
      border:1px solid rgba(255,255,255,.3);`;
    document.body.appendChild(t);
  }
  t.innerHTML = `🔔 알람<br><span style="font-size:17px;font-weight:400;opacity:.9;">${label}</span>`;
  t.style.display = 'block';
  t.style.opacity = '1';
  clearTimeout(t._timer);
  t._timer = setTimeout(()=>{ t.style.opacity='0'; setTimeout(()=>t.style.display='none',400); }, 5000);
  // 진동 (모바일)
  if('vibrate' in navigator) navigator.vibrate([200,100,200]);
  playNotifSound('alarm');
  lsSave();
}

// ══════════════════════════════════════════
// 달력 렌더 오버라이드 (프리랜서/알바 모드)
// ══════════════════════════════════════════
const _origRenderCalendar = renderCalendar;
renderCalendar = function(){
  if(jobType === 'freelancer'){
    renderFlCalendar();
  } else if(jobType === 'alba'){
    renderAlbaCalendar();
  } else {
    _origRenderCalendar();
  }
};

function renderFlCalendar(){
  const today = new Date();
  document.getElementById('month-title').textContent = `${curY}년 ${curM+1}월`;
  const grid = document.getElementById('calendar');
  grid.innerHTML = '';
  ['일','월','화','수','목','금','토'].forEach(d=>{
    const h=document.createElement('div');
    h.className='cal-hdr'; h.textContent=d; grid.appendChild(h);
  });
  const firstDay = new Date(curY,curM,1).getDay();
  for(let i=0;i<firstDay;i++){
    const e=document.createElement('div'); e.className='cal-day empty'; grid.appendChild(e);
  }
  const dim = new Date(curY,curM+1,0).getDate();
  // 월별 스케줄 수 집계
  let totalItems=0, totalAlarm=0;
  for(let d=1;d<=dim;d++){
    const key=dk(curY,curM,d);
    const items = flData[key]||[];
    totalItems += items.length;
    if(items.some(it=>it.alarmTime)) totalAlarm++;
    const dow = new Date(curY,curM,d).getDay();
    const isToday = today.getFullYear()===curY&&today.getMonth()===curM&&today.getDate()===d;
    const el=document.createElement('div');
    el.className='cal-day'+(isToday?' today':'')+(dow===0?' is-sun':'')+(dow===6?' is-sat':'');
    if(items.some(it=>it.alarmTime)) el.classList.add('alarm-active');
    el.onclick=()=>openPopup(key,d);
    let html=`<div class="dn">${d}</div>`;
    const hName=HOLIDAYS[key];
    if(hName) html+=`<div style="font-size:11px;color:var(--orange);margin-bottom:2px;">${hName}</div>`;
    items.slice(0,3).forEach(item=>{
      const cls = FL_TYPES[item.type]?.cls||'type-etc';
      html+=`<div class="fl-chip ${cls}${item.alarmTime?' has-alarm':''}">${item.title}</div>`;
    });
    if(items.length>3) html+=`<div style="font-size:11px;color:var(--text3);">+${items.length-3}개 더</div>`;
    el.innerHTML=html;
    grid.appendChild(el);
  }
  // stats-row: 프리랜서용
  document.getElementById('stats-row').innerHTML=`
    <div class="stat-card"><div class="lbl">이번달 일정</div><div class="val" style="color:var(--accent)">${totalItems}</div></div>
    <div class="stat-card"><div class="lbl">알람 설정</div><div class="val" style="color:var(--yellow)">${totalAlarm}개</div></div>
    <div class="stat-card" onclick="showAlarmManager()" style="cursor:pointer;">
      <div class="lbl">🔔 알람 관리</div>
      <div class="val" style="font-size:18px;color:var(--green);">보기</div>
    </div>`;
}

function renderAlbaCalendar(){
  const today = new Date();
  document.getElementById('month-title').textContent = `${curY}년 ${curM+1}월`;
  const grid = document.getElementById('calendar');
  grid.innerHTML = '';
  ['일','월','화','수','목','금','토'].forEach(d=>{
    const h=document.createElement('div');
    h.className='cal-hdr'; h.textContent=d; grid.appendChild(h);
  });
  const firstDay = new Date(curY,curM,1).getDay();
  for(let i=0;i<firstDay;i++){
    const e=document.createElement('div'); e.className='cal-day empty'; grid.appendChild(e);
  }
  const dim = new Date(curY,curM+1,0).getDate();
  let totalPay=0, workDays=0, totalHrs=0;
  // ★ 회사알바(dayData)/N잡알바(njobLoad)도 캘린더 그리드(일별 표시 + 알바일수/총근무시간/
  //   이번달 수입)에 반영 — 기존엔 레거시 albaData만 보고 있어 회사알바·N잡으로 입력해도
  //   캘린더에 전혀 표시되지 않던 문제를 해소. getAlbaPaySummary()/getAlbaMonthlyAggregate()/
  //   renderNjobYearlySummary()는 전혀 참조하지 않고, 이 함수 내부 표시용 집계만 별도로 계산.
  const companyWorkStates = ['work','early','half','sat_work','sun_work','holiday'];
  for(let d=1;d<=dim;d++){
    const key=dk(curY,curM,d);
    const items = albaData[key]||[];
    const legacyPay = items.reduce((s,it)=>{
      let h=it.endH-it.startH; if(h<0)h+=24;
      return s+Math.round(h*(it.wage||0));
    },0);
    const legacyHrs = items.reduce((s,it)=>{
      let h=it.endH-it.startH; if(h<0)h+=24; return s+h;
    },0);

    // 회사알바(dayData) — 직장인과 동일한 net-hours 계산(calcNetHours)에 hourlyRate를 곱한 단순 시급
    let companyHrs = 0, companyPay = 0, companyLabel = '';
    const cdata = (typeof dayData !== 'undefined') ? dayData[key] : null;
    if(cdata && cdata.status){
      if(companyWorkStates.includes(cdata.status)){
        companyHrs = calcNetHours(cdata.start, cdata.end, cdata.status, cdata.shift);
        companyPay = Math.round(companyHrs * hourlyRate);
        companyLabel = '회사알바';
      } else if(cdata.status === 'leave'){
        companyHrs = 8;
        companyPay = Math.round(8 * hourlyRate);
        companyLabel = '회사알바(연차)';
      }
    }

    // N잡알바(njobLoad)
    const njobData = (typeof njobLoad === 'function') ? njobLoad(key) : {alba:[]};
    const njobItems = njobData.alba || [];
    const njobPay = njobItems.reduce((s,it)=>{
      const amt = (it.amount != null) ? it.amount : Math.round((it.wage||0) * (it.hours||0));
      return s + amt;
    }, 0);
    const njobHrs = njobItems.reduce((s,it)=> s + (it.hours||0), 0);

    const dayPay = legacyPay + companyPay + njobPay;
    const dayHrs = legacyHrs + companyHrs + njobHrs;
    const hasAnyWork = items.length>0 || companyHrs>0 || njobItems.length>0;
    if(hasAnyWork){ workDays++; totalPay+=dayPay; totalHrs+=dayHrs; }

    const dow = new Date(curY,curM,d).getDay();
    const isToday = today.getFullYear()===curY&&today.getMonth()===curM&&today.getDate()===d;
    const el=document.createElement('div');
    el.className='cal-day'+(isToday?' today':'')+(dow===0?' is-sun':'')+(dow===6?' is-sat':'');
    if(items.some(it=>it.alarmTime)) el.classList.add('alarm-active');
    el.onclick=()=>openPopup(key,d);
    let html=`<div class="dn">${d}</div>`;
    const hName=HOLIDAYS[key];
    if(hName) html+=`<div style="font-size:11px;color:var(--orange);margin-bottom:2px;">${hName}</div>`;

    // 칩 표시: 레거시 + 회사알바 + N잡 통합(최대 2개만 보이고 나머지는 +N으로 요약)
    const chips = [];
    items.forEach(item=>{
      const hrs=(()=>{let h=item.endH-item.startH;if(h<0)h+=24;return h;})();
      chips.push({text:`${item.name||'알바'} ${hrs}h`, hasAlarm: !!item.alarmTime});
    });
    if(companyHrs>0) chips.push({text:`${companyLabel} ${companyHrs}h`, hasAlarm:false});
    njobItems.forEach(item=>{
      chips.push({text:`${item.name||'알바'} ${item.hours||0}h`, hasAlarm:false});
    });
    chips.slice(0,2).forEach(c=>{
      html+=`<div class="alba-chip${c.hasAlarm?' has-alarm':''}">${c.text}</div>`;
    });
    if(chips.length>2) html+=`<div style="font-size:11px;color:var(--text3);">+${chips.length-2}</div>`;
    if(dayPay>0) html+=`<div style="font-size:12px;color:var(--green);font-weight:700;margin-top:1px;">${Math.round(dayPay/1000)}천원</div>`;
    el.innerHTML=html;
    grid.appendChild(el);
  }
  // stats-row: 알바용 (기존 "이번달 수입" 카드는 그대로 유지)
  // ★ "예상 실수령액"(근로소득 기준, 연장·야간·4대보험·세금 반영)을 기준값으로 명확히 표시하고,
  //   "3.3% 공제후"(사업소득 가정 시 참고용)는 보조 정보로 구분해 두 숫자가 혼동되지 않도록 함
  let albaPaySummaryHtml = '';
  try{
    const s = (typeof getAlbaPaySummary === 'function') ? getAlbaPaySummary(curY, curM) : null;
    if(s){
      const fp = s.finalPay;
      // ★ 주휴수당 포함 사실 표시 + 진행중 주(확정 전) 보조 안내
      const hasWeekly = (s.weeklyHolidayPay || 0) > 0;
      const hasProgressWeek = (s.weeklyHolidayDetail || []).some(d => d.isFutureWeek);
      const weeklyBadge = hasWeekly ? ' <span style="font-size:10px;color:#7fffd4;">(주휴수당 포함)</span>' : '';
      // ★ 통계카드는 폭이 좁아 긴 문구를 넣으면 글자 단위로 줄바꿈되며 카드가 비정상적으로
      //   길어지는 레이아웃 깨짐이 있었음 — 카드 안은 짧은 축약 문구만, 전체 설명은
      //   카드 클릭 시 열리는 상세팝업(showAlbaPayDetail)에 그대로 유지.
      const progressNotice = hasProgressWeek
        ? `<div style="font-size:10px;color:#ffc850;margin-top:2px;white-space:nowrap;">⏳ 확정 전(자세히)</div>`
        : '';
      albaPaySummaryHtml = `
    <div class="stat-card" onclick="showAlbaPayDetail()" style="cursor:pointer;border:1.5px solid var(--green);position:relative;">
      <div style="position:absolute;top:-8px;right:8px;font-size:10px;font-weight:800;background:var(--green);color:#06281c;padding:2px 6px;border-radius:8px;">★ 기준</div>
      <div class="lbl">💰 예상 실수령액 <span style="font-size:10px;color:var(--text3);">(근로소득)</span>${weeklyBadge}</div>
      <div class="val" style="color:var(--green);font-size:20px;">${fp>=10000?Math.round(fp/10000)+'만':fp.toLocaleString()}원</div>
      ${progressNotice}
    </div>`;
    }
  }catch(e){ albaPaySummaryHtml = ''; }

  document.getElementById('stats-row').innerHTML=`
    <div class="stat-card"><div class="lbl">알바 일수</div><div class="val" style="color:var(--accent)">${workDays}일</div></div>
    <div class="stat-card"><div class="lbl">총 근무시간</div><div class="val" style="color:var(--yellow)">${totalHrs}h</div></div>
    <div class="stat-card"><div class="lbl">이번달 수입(총액)</div><div class="val" style="color:var(--text);font-size:20px;">${totalPay>=10000?Math.round(totalPay/10000)+'만':totalPay.toLocaleString()}원</div></div>
    ${albaPaySummaryHtml}
    <div class="stat-card" style="opacity:.75;">
      <div class="lbl">💼 사업소득 가정 시 <span style="font-size:10px;color:var(--text3);">(참고, 3.3% 공제)</span></div>
      <div class="val" style="color:var(--text2);font-size:16px;">${(()=>{const a=Math.round(totalPay*0.967);return a>=10000?Math.round(a/10000)+'만':a.toLocaleString()})()}원</div>
    </div>
    <div class="stat-card" onclick="showAlarmManager()" style="cursor:pointer;">
      <div class="lbl">🔔 알람 관리</div><div class="val" style="font-size:18px;">보기</div>
    </div>`;
}

// ── 예상 실수령액 상세 팝업 (총급여→연장→야간→4대보험→세금→실수령액 단계별 표시) ──
function showAlbaPayDetail(){
  if(typeof getAlbaPaySummary !== 'function') return;
  const s = getAlbaPaySummary(curY, curM);
  let overlay = document.getElementById('alba-pay-detail-popup');
  if(!overlay){
    overlay = document.createElement('div');
    overlay.id = 'alba-pay-detail-popup';
    overlay.className = 'overlay';
    overlay.style.display = 'none';
    overlay.onclick = e=>{ if(e.target===overlay) overlay.style.display='none'; };
    document.body.appendChild(overlay);
  }
  const weeklyHolidayPay = s.weeklyHolidayPay || 0;
  // ★ 기본급(연장·야간·주휴수당 모두 제외) + 연장 + 야간 + 주휴수당 = 총급여 검산이 가능하도록
  //   regPay에서 weeklyHolidayPay도 함께 제외
  const regPay = Math.max(0, s.grossPay - s.otPay - s.nightPay - weeklyHolidayPay);
  // 일반알바/N잡(추정치 정책 A안) 기여가 있으면 안내문구 노출
  const hasGeneralWeekly = (s.weeklyHolidayDetail || []).some(d => d.source === 'general');
  const hasProgressWeek = (s.weeklyHolidayDetail || []).some(d => d.isFutureWeek);
  overlay.innerHTML = `
    <div class="popup" style="width:380px;padding:22px 20px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
        <h3 style="font-size:20px;margin:0;">💰 예상 실수령액 상세</h3>
        <button onclick="document.getElementById('alba-pay-detail-popup').style.display='none'"
          style="background:none;border:none;color:var(--text2);font-size:22px;cursor:pointer;">✕</button>
      </div>
      <div style="font-size:15px;line-height:2.0;color:var(--text2);">
        <div>기본급(연장·야간·주휴수당 제외) &nbsp; ${fmt(regPay)}</div>
        <div>+ 연장수당(8h 초과분 ×0.5 가산) &nbsp; ${fmt(s.otPay)}</div>
        <div>+ 야간수당(22~06시 ×0.5 가산) &nbsp; ${fmt(s.nightPay)}</div>
        <div>+ 🌟 주휴수당(주 15h↑·개근 시) &nbsp; ${fmt(weeklyHolidayPay)}</div>
        <div style="border-top:1px solid var(--border);margin:6px 0;padding-top:6px;font-weight:700;color:var(--text);">= 총급여 &nbsp; ${fmt(s.grossPay)}</div>
        <div>- 4대보험(국민연금·건강·장기요양·고용) &nbsp; ${fmt(s.ins.total)}</div>
        <div>- 세금(소득세+지방소득세) &nbsp; ${fmt(s.tax.total)}</div>
        <div style="border-top:1px solid var(--border);margin:6px 0;padding-top:6px;font-weight:800;color:#7fffd4;font-size:18px;">= 최종 실수령액 &nbsp; ${fmt(s.finalPay)}</div>
      </div>
      ${hasProgressWeek ? `<div style="font-size:13px;color:#ffc850;margin-top:10px;padding:8px 10px;background:rgba(255,200,80,.08);border-radius:8px;">⏳ 이번 주는 진행중이라 주휴수당이 아직 확정되지 않았습니다.</div>` : ''}
      ${hasGeneralWeekly ? `<div style="font-size:13px;color:#ffc850;margin-top:8px;padding:8px 10px;background:rgba(255,200,80,.08);border-radius:8px;">※ 일반알바/N잡 주휴수당은 예정근무 정보가 없어 실근무시간 기준으로 추정 계산됩니다.</div>` : ''}
      <div style="font-size:12px;color:var(--text3);margin-top:14px;line-height:1.6;">
        ⚠️ 4대보험은 알바(직장)별 월 60시간 이상 근무 시 국민연금·건강보험·장기요양보험을 적용한 참고값이며,
        고용보험은 근무 실적이 있으면 별도 기준으로 계산됩니다. 실제 가입 여부·공제액은 사업장 정책에 따라 다를 수 있습니다.
      </div>
      <button onclick="document.getElementById('alba-pay-detail-popup').style.display='none'"
        style="width:100%;margin-top:14px;padding:12px;border-radius:10px;border:1px solid var(--border);
               background:var(--surface2);color:var(--text2);font-size:16px;cursor:pointer;font-family:'Noto Sans KR';">닫기</button>
    </div>`;
  overlay.style.display = 'flex';
}

// ══════════════════════════════════════════
// 알람 관리 팝업
// ══════════════════════════════════════════
function showAlarmManager(){
  let overlay = document.getElementById('alarm-mgr-popup');
  if(!overlay){
    overlay = document.createElement('div');
    overlay.id = 'alarm-mgr-popup';
    overlay.className = 'overlay';
    overlay.style.display = 'none';
    overlay.onclick = e=>{ if(e.target===overlay) overlay.style.display='none'; };
    document.body.appendChild(overlay);
  }

  const upcoming = alarmList
    .filter(a=>!a.fired)
    .sort((a,b)=>a.key>b.key?1:a.key<b.key?-1:a.time>b.time?1:-1);
  const fired = alarmList.filter(a=>a.fired);

  const listHtml = upcoming.length ? upcoming.map((a,i)=>`
    <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--surface2);
                border:1px solid var(--border);border-radius:8px;margin-bottom:6px;">
      <span style="font-size:26px;">🔔</span>
      <div style="flex:1;">
        <div style="font-size:17px;font-weight:700;color:var(--text);">${a.label}</div>
        <div style="font-size:15px;color:var(--text3);">${a.key} · ${a.time}</div>
      </div>
      <button onclick="removeAlarm(${alarmList.indexOf(a)})" style="background:none;border:none;color:var(--red);font-size:21px;cursor:pointer;">✕</button>
    </div>`).join('')
    : '<div style="text-align:center;padding:20px;color:var(--text3);font-size:17px;">등록된 알람 없음</div>';

  overlay.innerHTML = `
    <div class="popup" style="width:380px;padding:22px 20px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
        <h3 style="font-size:21px;margin:0;">🔔 알람 관리</h3>
        <button onclick="document.getElementById('alarm-mgr-popup').style.display='none'"
          style="background:none;border:none;color:var(--text2);font-size:23px;cursor:pointer;">✕</button>
      </div>
      <div style="font-size:16px;font-weight:700;color:var(--accent);margin-bottom:8px;">
        예정된 알람 (${upcoming.length}개)
      </div>
      <div style="max-height:280px;overflow-y:auto;margin-bottom:12px;">${listHtml}</div>
      ${fired.length?`<div style="font-size:15px;color:var(--text3);margin-bottom:8px;">완료된 알람 ${fired.length}개</div>`:''}
      <div style="display:flex;gap:8px;">
        <button onclick="clearFiredAlarms()" style="flex:1;padding:9px;border-radius:8px;border:1px solid var(--border);
          background:var(--surface2);color:var(--text2);font-size:17px;cursor:pointer;font-family:'Noto Sans KR';">
          완료 알람 정리</button>
        <button onclick="document.getElementById('alarm-mgr-popup').style.display='none'"
          style="flex:1;padding:9px;border-radius:8px;border:1px solid var(--border);
          background:var(--surface2);color:var(--text2);font-size:17px;cursor:pointer;font-family:'Noto Sans KR';">
          닫기</button>
      </div>
    </div>`;
  overlay.style.display = 'flex';
}

function removeAlarm(idx){
  alarmList.splice(idx,1);
  lsSave();
  showAlarmManager(); // 새로고침
}

function clearFiredAlarms(){
  alarmList = alarmList.filter(a=>!a.fired);
  lsSave();
  showAlarmManager();
}


// ══════════════════════════════════════════

// ══════════════════════════════════════════
// N잡 달력 통합 — 직장인 날짜 팝업에 알바/배달/프리 섹션 추가
// ══════════════════════════════════════════

// N잡 데이터 키: atm2_njob_YYYY-MM-DD
function njobKey(key){ return 'atm2_njob_'+key; }

// 프리랜서 항목(프로젝트/강의) 금액 계산
function freeItemAmount(it){
  if(it.type === 'lecture') return it.fee || 0;
  return (it.count||0) * (it.price||0);
}

function njobLoad(key){
  try{ const r=localStorage.getItem(njobKey(key)); if(r){
    const d=JSON.parse(r);
    if(!d.etc) d.etc=[];
    return d;
  }}catch(e){}
  return { alba:[], delivery:[], free:[], etc:[] };
}

function njobSave(key, data){
  try{ localStorage.setItem(njobKey(key), JSON.stringify(data)); }catch(e){}
  renderCalendar();
  njobRefresh(key);
}

// 선택한 직종에 따라 어떤 N잡 섹션을 보여줄지 결정
function getVisibleNjobSections(){
  const selectedJobs = loadSelectedJobs ? loadSelectedJobs() : [];
  const result = { alba:false, delivery:false, free:false, etc:false };

  // 직장인을 선택했다면(단독 선택 규칙) N잡 섹션은 전부 숨김 — 직장인 인터페이스만 노출
  if(selectedJobs.includes('employee')){
    return result;
  }

  // ★ 회사알바(convenience + albaSubtype:'company')는 직장인과 동일한 dayData 기반
  //   출퇴근 UI를 써야 하므로, N잡 "알바" 섹션(시급·시작·종료 직접입력 폼)은 노출하지 않음.
  //   일반알바(convenience + albaSubtype이 'company'가 아닌 모든 경우)는 기존 그대로 유지.
  let albaSubtype = '';
  try{ albaSubtype = localStorage.getItem('atm2_albaSubtype')||''; }catch(e){}
  const isAlbaCompany = selectedJobs.includes('convenience') && albaSubtype === 'company';

  selectedJobs.forEach(j=>{
    if(['convenience','shortAlba'].includes(j) && !(j==='convenience' && isAlbaCompany)) result.alba = true;
    if(['delivery','driver'].includes(j))       result.delivery = true;
    if(j === 'freelancer')                      result.free = true;
    if(j === 'etc')                             result.etc = true;
  });

  // 마이그레이션 전 등 아무 직종도 선택 안 됐으면 기존처럼 전부 표시
  if(selectedJobs.length === 0){
    result.alba = result.delivery = result.free = result.etc = true;
  }

  return result;
}

// 팝업 열릴 때 N잡 섹션 초기화
function initNjobSection(key){
  const selectedJobs = loadSelectedJobs ? loadSelectedJobs() : [];
  const sec = document.getElementById('njob-section');
  if(!sec) return;

  // 기존 데이터 로드 (직장인이라도 이미 입력된 N잡 기록이 있으면 보여줌)
  const data = njobLoad(key);

  // 선택한 직종에 맞는 섹션만 표시 (기존 기록이 있으면 직종 무관하게 표시)
  const albaWrap = document.getElementById('njob-alba-wrap');
  const deliveryWrap = document.getElementById('njob-delivery-wrap');
  const freeWrap = document.getElementById('njob-free-wrap');
  const vis = getVisibleNjobSections();

  const showAlba     = vis.alba     || data.alba.length > 0;
  const showDelivery = vis.delivery || data.delivery.length > 0;
  const showFree     = vis.free     || data.free.length > 0;
  const showEtc      = vis.etc      || (data.etc||[]).length > 0;

  if(albaWrap) albaWrap.style.display = showAlba ? 'block' : 'none';
  if(deliveryWrap) deliveryWrap.style.display = showDelivery ? 'block' : 'none';
  if(freeWrap) freeWrap.style.display = showFree ? 'block' : 'none';

  // etc 섹션 동적 생성 (보여줄 때만)
  let etcWrap = document.getElementById('njob-etc-wrap');
  if(!etcWrap && showEtc){
    if(sec){
      etcWrap = document.createElement('div');
      etcWrap.id = 'njob-etc-wrap';
      etcWrap.innerHTML = buildEtcSectionHTML(key);
      sec.appendChild(etcWrap);
    }
  }
  if(etcWrap) etcWrap.style.display = showEtc ? 'block' : 'none';

  // N잡 섹션 전체 표시 여부 (직장인 + 기록 없음이면 섹션 자체를 숨김)
  const anyVisible = showAlba || showDelivery || showFree || showEtc;
  sec.style.display = anyVisible ? 'block' : 'none';

  // 시급 자동세팅
  const wageKey='atm2_jobWages'; let wages={};
  try{ const r=localStorage.getItem(wageKey); if(r) wages=JSON.parse(r); }catch(e){}
  const albaWageEl = document.getElementById('njob-alba-wage');
  if(albaWageEl){
    const j = selectedJobs.find(j=>['convenience','shortAlba'].includes(j));
    albaWageEl.value = wages[j] || 10320;
  }

  njobRefresh(key);
  njobBindPreviews();
}

function njobRefresh(key){
  const data = njobLoad(key);

  // 알바 목록 렌더
  const albaList = document.getElementById('njob-alba-items');
  if(albaList){
    albaList.innerHTML = data.alba.map((it,i)=>{
      const amt = it.amount || Math.round((it.wage||0)*(it.hours||0));
      const timeStr = it.startTime ? `${it.startTime}~${it.endTime}` : `${it.hours}시간`;
      const detailStr = it.detail || `${it.wage.toLocaleString()}원/h`;
      const nightBadge = it.nightHours > 0
        ? `<span style="font-size:14px;padding:1px 5px;border-radius:4px;background:rgba(79,124,255,.15);color:var(--accent);margin-left:4px;">야간포함</span>` : '';
      return `
      <div style="display:flex;align-items:center;justify-content:space-between;
                  padding:7px 10px;background:var(--surface);border:1px solid var(--border);
                  border-radius:8px;margin-bottom:5px;">
        <div style="flex:1;min-width:0;">
          <div style="font-size:17px;font-weight:700;color:var(--text);">${it.name||'알바'}${nightBadge}</div>
          <div style="font-size:15px;color:var(--text3);">${timeStr} · ${detailStr}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
          <span style="font-size:17px;font-weight:700;color:var(--green);">+${amt.toLocaleString()}원</span>
          <button onclick="deleteNjobItem('${key}','alba',${i})"
            style="background:none;border:none;color:var(--text3);font-size:18px;cursor:pointer;">✕</button>
        </div>
      </div>`;
    }).join('') || '<div style="font-size:16px;color:var(--text3);text-align:center;padding:8px;">기록 없음</div>';
    const badge = document.getElementById('njob-alba-badge');
    if(badge) badge.textContent = data.alba.length>0?`(${data.alba.length}건)`:'';
  }

  // 배달/대리 목록 렌더
  const delivList = document.getElementById('njob-delivery-items');
  if(delivList){
    delivList.innerHTML = data.delivery.map((it,i)=>`
      <div style="display:flex;align-items:center;justify-content:space-between;
                  padding:7px 10px;background:var(--surface);border:1px solid var(--border);
                  border-radius:8px;margin-bottom:5px;">
        <div>
          <div style="font-size:17px;font-weight:700;color:var(--text);">${it.name||'배달'}</div>
          <div style="font-size:15px;color:var(--text3);">${it.count}건 × ${it.price.toLocaleString()}원</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:17px;font-weight:700;color:var(--green);">+${(it.count*it.price).toLocaleString()}원</span>
          <button onclick="deleteNjobItem('${key}','delivery',${i})"
            style="background:none;border:none;color:var(--text3);font-size:18px;cursor:pointer;">✕</button>
        </div>
      </div>`).join('') || '<div style="font-size:16px;color:var(--text3);text-align:center;padding:8px;">기록 없음</div>';
    const badge = document.getElementById('njob-delivery-badge');
    if(badge) badge.textContent = data.delivery.length>0?`(${data.delivery.length}건)`:'';
  }

  // 프리랜서 목록 렌더 (프로젝트 + 강의)
  const freeList = document.getElementById('njob-free-items');
  if(freeList){
    freeList.innerHTML = data.free.map((it,i)=>{
      const amt = freeItemAmount(it);
      if(it.type === 'lecture'){
        const timeStr = (it.startTime && it.endTime) ? `${it.startTime}~${it.endTime}` : '';
        const orgStr = it.org ? ` · ${it.org}` : '';
        return `
        <div style="display:flex;align-items:center;justify-content:space-between;
                    padding:7px 10px;background:var(--surface);border:1px solid var(--border);
                    border-radius:8px;margin-bottom:5px;">
          <div style="flex:1;min-width:0;">
            <div style="font-size:17px;font-weight:700;color:var(--text);">🎤 ${it.name||'강의'}${orgStr}</div>
            <div style="font-size:15px;color:var(--text3);">${timeStr}</div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
            <span style="font-size:17px;font-weight:700;color:var(--green);">+${amt.toLocaleString()}원</span>
            <button onclick="deleteNjobItem('${key}','free',${i})"
              style="background:none;border:none;color:var(--text3);font-size:18px;cursor:pointer;">✕</button>
          </div>
        </div>`;
      }
      return `
      <div style="display:flex;align-items:center;justify-content:space-between;
                  padding:7px 10px;background:var(--surface);border:1px solid var(--border);
                  border-radius:8px;margin-bottom:5px;">
        <div>
          <div style="font-size:17px;font-weight:700;color:var(--text);">${it.name||'외주'}</div>
          <div style="font-size:15px;color:var(--text3);">${it.count}건 × ${it.price.toLocaleString()}원</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:17px;font-weight:700;color:var(--green);">+${amt.toLocaleString()}원</span>
          <button onclick="deleteNjobItem('${key}','free',${i})"
            style="background:none;border:none;color:var(--text3);font-size:18px;cursor:pointer;">✕</button>
        </div>
      </div>`;
    }).join('') || '<div style="font-size:16px;color:var(--text3);text-align:center;padding:8px;">기록 없음</div>';
    const badge = document.getElementById('njob-free-badge');
    if(badge) badge.textContent = data.free.length>0?`(${data.free.length}건)`:'';
  }

  // 추가수익(etc) 목록 렌더
  const etcList = document.getElementById('njob-etc-items');
  if(etcList){
    const ETC_ICONS = {insurance:'🏥',gov:'🏛️',tax:'💸',platform:'📱',sale:'🛍️',finance:'📈',reward:'🎁',transfer:'💌',other:'✨'};
    etcList.innerHTML = (data.etc||[]).map((it,i)=>`
      <div style="display:flex;align-items:center;justify-content:space-between;
                  padding:7px 10px;background:var(--surface);border:1px solid var(--border);
                  border-radius:8px;margin-bottom:5px;">
        <div style="flex:1;min-width:0;">
          <div style="font-size:17px;font-weight:700;color:var(--text);">${ETC_ICONS[it.cat]||'✨'} ${it.name}</div>
          <div style="font-size:15px;color:var(--text3);">${it.memo||''}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
          <span style="font-size:17px;font-weight:700;color:var(--green);">+${(it.amount||0).toLocaleString()}원</span>
          <button onclick="deleteNjobItem('${key}','etc',${i})"
            style="background:none;border:none;color:var(--text3);font-size:18px;cursor:pointer;">✕</button>
        </div>
      </div>`).join('') || '<div style="font-size:16px;color:var(--text3);text-align:center;padding:8px;">기록 없음</div>';
    const badge = document.getElementById('njob-etc-badge');
    if(badge) badge.textContent = (data.etc||[]).length>0?`(${data.etc.length}건)`:'';
  }

  // 오늘 N잡 합계
  const albaTotal = data.alba.reduce((s,it)=>s+(it.amount||Math.round((it.wage||0)*(it.hours||0))),0);
  const delivTotal = data.delivery.reduce((s,it)=>s+(it.count*it.price),0);
  const freeTotal = data.free.reduce((s,it)=>s+freeItemAmount(it),0);
  const etcTotal  = (data.etc||[]).reduce((s,it)=>s+(it.amount||0),0);
  const total = albaTotal + delivTotal + freeTotal + etcTotal;
  const totalBar = document.getElementById('njob-total-bar');
  const totalVal = document.getElementById('njob-total-val');
  if(totalBar) totalBar.style.display = total>0?'flex':'none';
  if(totalVal) totalVal.textContent = '+'+total.toLocaleString()+'원';
}

function njobBindPreviews(){
  // 알바 미리보기
  const albaW = document.getElementById('njob-alba-wage');
  const albaH = document.getElementById('njob-alba-hours');
  const albaPrev = document.getElementById('njob-alba-preview');
  [albaW, albaH].forEach(el=>{
    if(el) el.addEventListener('input',()=>{
      const w=parseInt(albaW?.value)||0, h=parseFloat(albaH?.value)||0;
      if(albaPrev){ if(w>0&&h>0){albaPrev.style.display='block';albaPrev.textContent=`${w.toLocaleString()}원 × ${h}시간 = ${Math.round(w*h).toLocaleString()}원`;}else albaPrev.style.display='none';}
    });
  });
  // 배달 미리보기
  const delivC = document.getElementById('njob-delivery-count');
  const delivP = document.getElementById('njob-delivery-price');
  const delivPrev = document.getElementById('njob-delivery-preview');
  [delivC, delivP].forEach(el=>{
    if(el) el.addEventListener('input',()=>{
      const c=parseInt(delivC?.value)||0, p=parseInt(delivP?.value)||0;
      if(delivPrev){ if(c>0&&p>0){delivPrev.style.display='block';delivPrev.textContent=`${c}건 × ${p.toLocaleString()}원 = ${(c*p).toLocaleString()}원`;}else delivPrev.style.display='none';}
    });
  });
  // 프리 미리보기
  const freeC = document.getElementById('njob-free-count');
  const freeP = document.getElementById('njob-free-price');
  const freePrev = document.getElementById('njob-free-preview');
  [freeC, freeP].forEach(el=>{
    if(el) el.addEventListener('input',()=>{
      const c=parseInt(freeC?.value)||0, p=parseInt(freeP?.value)||0;
      if(freePrev){ if(c>0&&p>0){freePrev.style.display='block';freePrev.textContent=`${c}건 × ${p.toLocaleString()}원 = ${(c*p).toLocaleString()}원`;}else freePrev.style.display='none';}
    });
  });
  // 강의 입력 시간 → 빈 강의료 자동 안내 없음 (강의료는 직접 입력)
}

function toggleNjobSec(type){
  const body = document.getElementById(`njob-${type}-body`);
  const arr = document.getElementById(`njob-${type}-arr`);
  if(!body) return;
  const open = body.style.display==='none';
  body.style.display = open?'block':'none';
  if(arr) arr.textContent = open?'▲':'▼';
}

function clearNjobInput(type){
  const ids = {
    alba: ['njob-alba-name', 'njob-alba-break'],
    delivery: ['njob-delivery-name', 'njob-delivery-count', 'njob-delivery-price'],
    free: ['njob-free-name', 'njob-free-count', 'njob-free-price',
           'njob-lecture-name', 'njob-lecture-org', 'njob-lecture-start', 'njob-lecture-end', 'njob-lecture-fee'],
    etc: ['njob-etc-name', 'njob-etc-amount', 'njob-etc-memo']
  };
  (ids[type]||[]).forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.value = '';
  });
  if(type === 'free'){
    const count = document.getElementById('njob-free-count');
    if(count) count.value = '1';
  }
  const prev = document.getElementById(`njob-${type}-preview`);
  if(prev) prev.style.display = 'none';
}

function addNjobAlba(){
  const key = editKey;
  const name = (document.getElementById('njob-alba-name')?.value||'').trim();
  const wage = parseInt(document.getElementById('njob-alba-wage')?.value)||0;
  const hours = parseFloat(document.getElementById('njob-alba-hours')?.value)||0;
  if(!name){showToast('⚠️ 알바명을 입력해주세요');return;}
  if(wage<=0){showToast('⚠️ 시급을 입력해주세요');return;}
  if(hours<=0){showToast('⚠️ 근무시간을 입력해주세요');return;}
  const data = njobLoad(key);
  data.alba.push({id:Date.now(), name, wage, hours});
  njobSave(key, data);
  // 시급 저장
  const selectedJobs = loadSelectedJobs?loadSelectedJobs():[];
  const j = selectedJobs.find(j=>['convenience','shortAlba'].includes(j));
  if(j){ let wages={};try{const r=localStorage.getItem('atm2_jobWages');if(r)wages=JSON.parse(r);}catch(e){} wages[j]=wage; if(typeof saveJobWages==='function') saveJobWages(wages); else try{localStorage.setItem('atm2_jobWages',JSON.stringify(wages));}catch(e){} }
  document.getElementById('njob-alba-name').value='';
  document.getElementById('njob-alba-hours').value='';
  document.getElementById('njob-alba-preview').style.display='none';
  showToast(`✅ ${name} +${Math.round(wage*hours).toLocaleString()}원 추가됨`);
}

function addNjobDelivery(){
  const key = editKey;
  const name = (document.getElementById('njob-delivery-name')?.value||'').trim();
  const count = parseInt(document.getElementById('njob-delivery-count')?.value)||0;
  const price = parseInt(document.getElementById('njob-delivery-price')?.value)||0;
  if(!name){showToast('⚠️ 배달앱명을 입력해주세요');return;}
  if(count<=0){showToast('⚠️ 건수를 입력해주세요');return;}
  if(price<=0){showToast('⚠️ 건당 단가를 입력해주세요');return;}
  const data = njobLoad(key);
  data.delivery.push({id:Date.now(), name, count, price});
  njobSave(key, data);
  document.getElementById('njob-delivery-name').value='';
  document.getElementById('njob-delivery-count').value='';
  document.getElementById('njob-delivery-price').value='';
  document.getElementById('njob-delivery-preview').style.display='none';
  showToast(`✅ ${name} ${count}건 +${(count*price).toLocaleString()}원 추가됨`);
}

// 프리랜서 입력 유형 전환 (프로젝트 / 강의)
function setFreeType(type){
  const projBtn = document.getElementById('njob-free-type-project');
  const lecBtn  = document.getElementById('njob-free-type-lecture');
  const projBlock = document.getElementById('njob-free-project-block');
  const lecBlock  = document.getElementById('njob-free-lecture-block');
  const isLecture = type === 'lecture';
  if(projBlock) projBlock.style.display = isLecture ? 'none' : 'block';
  if(lecBlock)  lecBlock.style.display  = isLecture ? 'block' : 'none';
  if(projBtn){
    projBtn.style.background = isLecture ? 'var(--surface)' : 'var(--accent2)';
    projBtn.style.color      = isLecture ? 'var(--text2)' : '#fff';
    projBtn.style.borderColor= isLecture ? 'var(--border)' : 'var(--accent2)';
  }
  if(lecBtn){
    lecBtn.style.background = isLecture ? 'var(--accent2)' : 'var(--surface)';
    lecBtn.style.color      = isLecture ? '#fff' : 'var(--text2)';
    lecBtn.style.borderColor= isLecture ? 'var(--accent2)' : 'var(--border)';
  }
}

// 강의 일정 추가
function addNjobLecture(){
  const key = editKey;
  const name = (document.getElementById('njob-lecture-name')?.value||'').trim();
  const org  = (document.getElementById('njob-lecture-org')?.value||'').trim();
  const startTime = document.getElementById('njob-lecture-start')?.value || '';
  const endTime   = document.getElementById('njob-lecture-end')?.value || '';
  const fee = parseInt(document.getElementById('njob-lecture-fee')?.value)||0;
  if(!name){showToast('⚠️ 강의명을 입력해주세요');return;}
  if(fee<=0){showToast('⚠️ 강의료를 입력해주세요');return;}
  const data = njobLoad(key);
  data.free.push({id:Date.now(), type:'lecture', name, org, startTime, endTime, fee});
  njobSave(key, data);
  document.getElementById('njob-lecture-name').value='';
  document.getElementById('njob-lecture-org').value='';
  document.getElementById('njob-lecture-start').value='';
  document.getElementById('njob-lecture-end').value='';
  document.getElementById('njob-lecture-fee').value='';
  showToast(`✅ ${name} 강의 +${fee.toLocaleString()}원 추가됨`);
}

function addNjobFree(){
  const key = editKey;
  const name = (document.getElementById('njob-free-name')?.value||'').trim();
  const count = parseInt(document.getElementById('njob-free-count')?.value)||1;
  const price = parseInt(document.getElementById('njob-free-price')?.value)||0;
  if(!name){showToast('⚠️ 프로젝트명을 입력해주세요');return;}
  if(price<=0){showToast('⚠️ 단가를 입력해주세요');return;}
  const data = njobLoad(key);
  data.free.push({id:Date.now(), name, count, price});
  njobSave(key, data);
  document.getElementById('njob-free-name').value='';
  document.getElementById('njob-free-count').value='1';
  document.getElementById('njob-free-price').value='';
  document.getElementById('njob-free-preview').style.display='none';
  showToast(`✅ ${name} +${(count*price).toLocaleString()}원 추가됨`);
}

function deleteNjobItem(key, type, idx){
  const data = njobLoad(key);
  if(data[type]) data[type].splice(idx,1);
  njobSave(key, data);
  showToast('🗑️ 삭제됨');
}

// ── 달력 날짜에 N잡 수입 표시 ──
function njobDayTotal(key){
  const data = njobLoad(key);
  const a = data.alba.reduce((s,it)=>s+(it.amount||Math.round((it.wage||0)*(it.hours||0))),0);
  const d = data.delivery.reduce((s,it)=>s+(it.count*it.price),0);
  const f = data.free.reduce((s,it)=>s+freeItemAmount(it),0);
  return a+d+f;
}
// ══════════════════════════════════════════

// ══════════════════════════════════════════
// 날짜 팝업 — 아코디언 방식 직종별 기록
// ══════════════════════════════════════════

function initDayJobTabs(key){
  const selectedJobs = loadSelectedJobs ? loadSelectedJobs() : [];
  // ★ 회사알바(convenience + albaSubtype:'company')는 직장인과 동일한 dayData 기반
  //   출퇴근 UI(직장 근태 아코디언, 출근/퇴근 sticky 버튼)를 사용해야 함 — 이전엔 이 판정이
  //   없어 회사알바도 N잡 알바 입력 폼(시급·시작·종료 직접입력)으로만 저장되어 dayData에
  //   전혀 도달하지 못했음(주휴수당/기본급 계산이 입구 없이 만들어진 상태였음).
  let _albaSubtype = '';
  try{ _albaSubtype = localStorage.getItem('atm2_albaSubtype')||''; }catch(e){}
  const isAlbaCompany = selectedJobs.includes('convenience') && _albaSubtype === 'company';
  const isEmployee = selectedJobs.includes('employee') || selectedJobs.length === 0 || isAlbaCompany;

  // 선택한 직종에 맞는 섹션만 표시 (기록이 있으면 직종 무관하게 표시)
  const vis = getVisibleNjobSections();
  const data = njobLoad(key);
  const wrapVis = {
    'njob-alba-wrap':     vis.alba     || data.alba.length > 0,
    'njob-delivery-wrap': vis.delivery || data.delivery.length > 0,
    'njob-free-wrap':     vis.free     || data.free.length > 0,
    'njob-etc-wrap':      vis.etc      || (data.etc||[]).length > 0,
  };

  // 보여줄 N잡 섹션이 하나도 없으면(직장인 + N잡 기록 없음) 섹션 전체 숨김
  const njobSec = document.getElementById('njob-section');
  const anyVisible = Object.values(wrapVis).some(Boolean);
  if(njobSec) njobSec.style.display = anyVisible ? 'block' : 'none';

  Object.entries(wrapVis).forEach(([id, show])=>{
    const el = document.getElementById(id);
    if(el) el.style.display = show ? 'block' : 'none';
  });

  // 직장 근태 아코디언: 직장인이 아니면 숨김 (기존 근태 기록이 있으면 유지)
  const empHdr  = document.getElementById('employee-acc-hdr');
  const empBody = document.getElementById('employee-acc-body');
  const saved = (typeof dayData !== 'undefined') ? dayData[key] : null;
  const hasAttRecord = saved && saved.status && saved.status !== 'none';
  const showEmpSec = isEmployee || hasAttRecord;
  if(empHdr)  empHdr.style.display  = showEmpSec ? '' : 'none';
  if(empBody && !showEmpSec) empBody.style.display = 'none';

  // 기록 있는 섹션 자동 펼침
  // ★ 알바는 기록이 없어도 "선택된 직종"이면 항상 자동 펼침 — 회사알바(주간/야간/2교대/3교대)
  //   선택 후 처음 날짜를 클릭했을 때 알바명·시급·출근·퇴근 입력란이 바로 보이도록 함
  if(data.alba.length > 0 || vis.alba) autoOpenNjobSec('alba');
  if(data.delivery.length > 0) autoOpenNjobSec('delivery');
  if(data.free.length > 0)     autoOpenNjobSec('free');
  if((data.etc||[]).length > 0) autoOpenNjobSec('etc');

  // 직장 기록 있으면 직장 섹션도 자동 펼침 (기존 팝업 로직이 처리)

  // ★ 알바 시급 자동세팅 — 원래 initNjobSection()에 있던 로직인데 그 함수가 어디서도
  //   호출되지 않아 죽은 코드였음(input에 value가 채워지지 않고 placeholder만 남아,
  //   사용자가 "이미 입력됨"으로 착각하고 그대로 추가를 누르면 실패하는 문제의 원인).
  //   openPopup() → initDayJobTabs()로 이어지는 실제 흐름에 연결.
  try{
    const albaWageEl = document.getElementById('njob-alba-wage');
    if(albaWageEl && !albaWageEl.value){
      const wageKey='atm2_jobWages'; let wages={};
      try{ const r=localStorage.getItem(wageKey); if(r) wages=JSON.parse(r); }catch(e){}
      const j = selectedJobs.find(j=>['convenience','shortAlba'].includes(j));
      albaWageEl.value = wages[j] || 10320;
    }
  }catch(e){}

  // ★ 표시 전용 — 입력폼/저장/급여계산 로직에는 영향 없음
  renderPopupStatusBadge();
}

// 날짜 팝업 상단에 현재 선택된 근무형태·직종을 표시(표시 전용, 저장/계산 로직 비변경)
function renderPopupStatusBadge(){
  const el = document.getElementById('p-status-badge');
  if(!el) return;

  // ★ 직업변경 후 이전 알바 배지가 남는 문제 수정: selectedJobs(현재 선택된 직종) 기준으로
  //   알바 직종이 실제로 선택되어 있을 때만 회사알바/편의점 등 배지를 표시.
  //   직장인 모드(selectedJobs에 'employee' 포함)에서는 albaSubtype 값이 남아있어도 절대 표시하지 않음.
  const selectedJobs = (typeof loadSelectedJobs==='function') ? loadSelectedJobs() : [];
  const isEmployeeMode = selectedJobs.includes('employee');
  const isAlbaJobSelected = selectedJobs.some(j=>['convenience','shortAlba'].includes(j));

  let wtId = '', subId = '', albaSub = '';
  try{
    wtId    = localStorage.getItem('atm2_workType') || '';
    subId   = localStorage.getItem('atm2_workSubType') || '';
    albaSub = localStorage.getItem('atm2_albaSubtype') || '';
  }catch(e){}

  const wtLabelMap = {
    day:   '☀️ 주간고정',
    night: '🌙 야간고정',
    '2shift': subId==='day' ? '🔄 2교대 주간조' : subId==='night' ? '🔄 2교대 야간조'
              : subId==='day_fixed' ? '🔄 2교대 통상조' : '🔄 2교대',
    '3shift': (subId==='A'||subId==='B'||subId==='C') ? `⚡ 3교대 ${subId}조`
              : subId==='day_fixed' ? '⚡ 3교대 통상조' : '⚡ 3교대',
  };
  const albaSubLabelMap = {
    company:'🏢 회사알바', cvs:'🏪 편의점', cafe:'☕ 카페', coupang:'📦 쿠팡', other:'➕ 기타알바'
  };

  const wtLabel   = wtLabelMap[wtId] || '';
  const albaLabel = (!isEmployeeMode && isAlbaJobSelected) ? (albaSubLabelMap[albaSub] || '') : '';

  if(!wtLabel && !albaLabel){ el.style.display='none'; el.innerHTML=''; return; }

  el.innerHTML = `
    <div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;">
      ${wtLabel ? `<span style="display:inline-block;padding:4px 10px;border-radius:20px;
            background:rgba(79,124,255,.1);border:1px solid rgba(79,124,255,.25);
            color:var(--accent);font-size:12px;font-weight:700;white-space:nowrap;">${wtLabel}</span>` : ''}
      ${albaLabel ? `<span style="display:inline-block;padding:4px 10px;border-radius:20px;
            background:rgba(61,214,140,.1);border:1px solid rgba(61,214,140,.25);
            color:var(--green);font-size:12px;font-weight:700;white-space:nowrap;">${albaLabel}</span>` : ''}
    </div>`;
  el.style.display = 'block';
}

function autoOpenNjobSec(type){
  const body = document.getElementById('njob-'+type+'-body');
  const arr  = document.getElementById('njob-'+type+'-arr');
  const hdr  = body?.previousElementSibling;
  if(!body) return;
  body.style.display = 'block';
  if(arr) arr.textContent = '▲';
  if(hdr) hdr.style.borderRadius = '10px 10px 0 0';
}
// ══════════════════════════════════════════

// ── 전체 저장 버튼 (입력된 내용 한번에 저장) ──
function saveNjobAll(){
  const key = editKey;
  if(!key){ showToast('⚠️ 날짜를 선택해주세요'); return; }

  let saved = false;
  const data = njobLoad(key);
  const now = Date.now();

  // ── 알바: 시작/종료 시간 기반 계산 (addNjobAlba와 동일 로직) ──
  const albaName = (document.getElementById('njob-alba-name')?.value||'').trim();
  const albaWage = parseInt(document.getElementById('njob-alba-wage')?.value)||0;
  const startStr = document.getElementById('njob-alba-start')?.value || '09:00';
  const endStr   = document.getElementById('njob-alba-end')?.value   || '18:00';
  if(albaName && albaWage > 0){
    const [sh,sm] = startStr.split(':').map(Number);
    const [eh,em] = endStr.split(':').map(Number);
    let startMin = sh*60+sm, endMin = eh*60+em;
    if(endMin <= startMin) endMin += 24*60;

    const totalMin   = endMin - startMin;
    const breakMin   = parseInt(document.getElementById('njob-alba-break')?.value)||0;
    const workMin    = Math.max(0, totalMin - breakMin);
    const totalHours = Math.round(workMin/60*10)/10;

    // 야간 계산
    let rawNightMin = 0, cur = startMin;
    while(cur < endMin){ const h=Math.floor(cur/60)%24; if(h>=22||h<6) rawNightMin++; cur++; }
    const nightBreak = Math.min(breakMin, rawNightMin);
    const dayBreak   = breakMin - nightBreak;
    const nightMin   = Math.max(0, rawNightMin - nightBreak);
    const dayMin     = Math.max(0, (totalMin - rawNightMin) - dayBreak);
    const dayHours   = Math.round(dayMin/60*10)/10;
    const nightHours = Math.round(nightMin/60*10)/10;

    const extraNight = parseInt(document.getElementById('njob-alba-extra-night')?.value)||0;
    const extraOver  = parseInt(document.getElementById('njob-alba-extra-over')?.value)||0;
    const extraOther = parseInt(document.getElementById('njob-alba-extra-other')?.value)||0;
    const extraMeal  = parseInt(document.getElementById('njob-alba-extra-meal')?.value)||0;
    const extraTotal = extraNight + extraOver + extraOther + extraMeal;

    // 연장근로(1일 8h 초과) 가산 — addNjobAlba()와 동일한 방식(야간 가산과 동일 구조로 0.5배 추가)
    const otHours = Math.round(Math.max(0, totalHours - 8) * 10) / 10;
    const basePay = Math.round(totalHours*albaWage) + Math.round(nightHours*albaWage*0.5) + Math.round(otHours*albaWage*0.5);
    const amount  = basePay + extraTotal;
    let detail = `${totalHours}시간`;
    if(nightHours > 0) detail += ` (야간 ${nightHours}h×1.5)`;
    if(otHours > 0) detail += ` (연장 ${otHours}h×1.5)`;
    if(extraTotal > 0) detail += ` + 추가수당 ${extraTotal.toLocaleString()}원`;

    data.alba.push({
      id:now+1, name:albaName, wage:albaWage, hours:totalHours,
      startTime:startStr, endTime:endStr,
      dayHours, nightHours, otHours, amount, detail,
      extraNight, extraOver, extraOther, extraMeal
    });
    saved = true;

    // 시급 자동저장
    const wk='atm2_jobWages'; let wages={};
    try{const r=localStorage.getItem(wk);if(r)wages=JSON.parse(r);}catch(e){}
    wages['convenience'] = albaWage;
    if(typeof saveJobWages==='function') saveJobWages(wages); else try{localStorage.setItem('atm2_jobWages',JSON.stringify(wages));}catch(e){}
  }

  // ── 배달 저장 ──
  const delivName = (document.getElementById('njob-delivery-name')?.value||'').trim();
  const delivCount = parseInt(document.getElementById('njob-delivery-count')?.value)||0;
  const delivPrice = parseInt(document.getElementById('njob-delivery-price')?.value)||0;
  if(delivName && delivCount > 0 && delivPrice > 0){
    data.delivery.push({id:now+2, name:delivName, count:delivCount, price:delivPrice});
    clearNjobInput('delivery');
    saved = true;
  }

  // ── 프리랜서 프로젝트 저장 ──
  const freeName  = (document.getElementById('njob-free-name')?.value||'').trim();
  const freeCount = parseInt(document.getElementById('njob-free-count')?.value)||1;
  const freePrice = parseInt(document.getElementById('njob-free-price')?.value)||0;
  if(freeName && freePrice > 0){
    data.free.push({id:now+3, name:freeName, count:freeCount, price:freePrice});
    clearNjobInput('free');
    saved = true;
  }

  // ── 프리랜서 강의 저장 ──
  const lecName  = (document.getElementById('njob-lecture-name')?.value||'').trim();
  const lecOrg   = (document.getElementById('njob-lecture-org')?.value||'').trim();
  const lecStart = document.getElementById('njob-lecture-start')?.value || '';
  const lecEnd   = document.getElementById('njob-lecture-end')?.value   || '';
  const lecFee   = parseInt(document.getElementById('njob-lecture-fee')?.value)||0;
  if(lecName && lecFee > 0){
    data.free.push({id:now+4, type:'lecture', name:lecName, org:lecOrg, startTime:lecStart, endTime:lecEnd, fee:lecFee});
    clearNjobInput('free');
    saved = true;
  }

  // ── 추가수익(etc) 저장 ──
  if(!data.etc) data.etc = [];
  const etcCat    = document.getElementById('njob-etc-cat')?.value || 'other';
  const etcName   = (document.getElementById('njob-etc-name')?.value||'').trim();
  const etcAmount = parseInt(document.getElementById('njob-etc-amount')?.value)||0;
  const etcMemo   = (document.getElementById('njob-etc-memo')?.value||'').trim();
  if(etcName && etcAmount > 0){
    data.etc.push({id:now+5, cat:etcCat, name:etcName, amount:etcAmount, memo:etcMemo});
    clearNjobInput('etc');
    saved = true;
  }

  // ── 저장 실행 ──
  if(saved){
    njobSave(key, data);
    njobRefresh(key);
    // 알바 입력 초기화
    const albaNameEl = document.getElementById('njob-alba-name');
    if(albaNameEl) albaNameEl.value = '';
    const albaPrev = document.getElementById('njob-alba-preview');
    if(albaPrev) albaPrev.style.display = 'none';
    document.querySelectorAll('.alba-type-btn').forEach(b=>{
      b.style.background='var(--surface)'; b.style.borderColor='var(--border)';
      b.style.color='var(--text2)'; b.style.fontWeight='400';
    });
    showToast('✅ 저장됐어요!');
    closePopup();       // 저장 후 팝업 닫기
    renderCalendar();
  } else {
    showToast('⚠️ 입력된 내용이 없어요');
  }
}

// ══════════════════════════════════════════
// 알바 시간 자동 계산 (야간수당 포함)
// 야간: 22:00 ~ 06:00 → 시급 × 1.5
// ══════════════════════════════════════════

// 휴게시간 빠른선택
function setBreak(min){
  const inp = document.getElementById('njob-alba-break');
  if(inp){ inp.value = min; }
  // 버튼 스타일 토글
  document.querySelectorAll('.break-btn').forEach(btn=>{
    const isSelected = btn.textContent.includes(min === 0 ? '없음' : min === 30 ? '30분' : '1시간');
    btn.style.background = isSelected ? 'rgba(79,124,255,.15)' : 'var(--surface)';
    btn.style.borderColor = isSelected ? 'var(--accent)' : 'var(--border)';
    btn.style.color = isSelected ? 'var(--accent)' : 'var(--text2)';
    btn.style.fontWeight = isSelected ? '700' : '400';
  });
  calcAlbaAuto();
}

function setBreak(min){
  const inp = document.getElementById('njob-alba-break');
  if(inp){ inp.value = min; }
  document.querySelectorAll('.break-btn').forEach(btn=>{
    const isSelected = (min===0&&btn.textContent.includes('없음'))||(min===30&&btn.textContent.includes('30'))||(min===60&&btn.textContent.includes('1시간'));
    btn.style.background = isSelected ? 'rgba(79,124,255,.15)' : 'var(--surface)';
    btn.style.borderColor = isSelected ? 'var(--accent)' : 'var(--border)';
    btn.style.color = isSelected ? 'var(--accent)' : 'var(--text2)';
    btn.style.fontWeight = isSelected ? '700' : '400';
  });
  calcAlbaAuto();
}

function selectAlbaType(name){
  // 버튼 스타일 토글
  document.querySelectorAll('.alba-type-btn').forEach(btn=>{
    const isSelected = btn.textContent.includes(name) && name !== '';
    btn.style.background = isSelected ? 'rgba(255,140,66,.15)' : 'var(--surface)';
    btn.style.borderColor = isSelected ? 'var(--orange)' : 'var(--border)';
    btn.style.color = isSelected ? 'var(--orange)' : 'var(--text2)';
    btn.style.fontWeight = isSelected ? '700' : '400';
  });
  // 이름 자동입력 (직접입력 제외)
  const nameInp = document.getElementById('njob-alba-name');
  if(nameInp && name !== '') nameInp.value = name;

  // 쿠팡/택배 선택 시 추가수당 필드 표시
  const extraWrap = document.getElementById('njob-alba-extra-wrap');
  if(extraWrap){
    const isCoupangOrDelivery = name === '쿠팡' || name === '택배';
    extraWrap.style.display = isCoupangOrDelivery ? 'block' : 'none';
    if(!isCoupangOrDelivery){
      // 다른 카테고리 선택 시 추가수당 초기화
      ['njob-alba-extra-night','njob-alba-extra-over','njob-alba-extra-other','njob-alba-extra-meal']
        .forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
    }
  }
  if(name !== '') calcAlbaAuto();
}

function calcAlbaAuto(){
  const wage = parseInt(document.getElementById('njob-alba-wage')?.value)||0;
  const startStr = document.getElementById('njob-alba-start')?.value||'09:00';
  const endStr   = document.getElementById('njob-alba-end')?.value||'18:00';
  const prev     = document.getElementById('njob-alba-preview');
  const detail   = document.getElementById('njob-alba-preview-detail');
  const total    = document.getElementById('njob-alba-preview-total');

  if(!prev||!detail||!total) return;
  if(wage <= 0){ prev.style.display='none'; return; }

  const [sh,sm] = startStr.split(':').map(Number);
  const [eh,em] = endStr.split(':').map(Number);

  let startMin = sh*60+sm;
  let endMin   = eh*60+em;
  if(endMin <= startMin) endMin += 24*60; // 익일

  const totalMin      = endMin - startMin;
  const totalHoursRaw = totalMin / 60;

  // ── 휴게시간: 사용자 직접 입력 ──
  const breakMin = parseInt(document.getElementById('njob-alba-break')?.value)||0;
  const workMin  = Math.max(0, totalMin - breakMin);
  const totalHours = workMin / 60;

  // 야간 시간 계산 (22:00~06:00) - 실근무 시간 기준으로 정확히 계산
  // 방법: 휴게시간을 야간 구간 초반에서 차감
  let rawNightMin = 0;
  let cur = startMin;
  while(cur < endMin){
    const h = Math.floor(cur/60) % 24;
    if(h >= 22 || h < 6) rawNightMin++;
    cur++;
  }
  // 휴게시간은 야간 구간에서 먼저 차감 (야간 근무 시작 직후 휴게 가정)
  const nightBreak   = Math.min(breakMin, rawNightMin);
  const dayBreak     = breakMin - nightBreak;
  const nightMin     = Math.max(0, rawNightMin - nightBreak);
  const rawDayMin    = totalMin - rawNightMin;
  const dayMin       = Math.max(0, rawDayMin - dayBreak);

  const dayHours   = Math.round(dayMin/60*10)/10;
  const nightHours = Math.round(nightMin/60*10)/10;

  const dayPay   = Math.round(dayHours * wage);
  const nightPay = Math.round(nightHours * wage * 1.5);

  // 쿠팡/택배 추가수당
  const extraNight = parseInt(document.getElementById('njob-alba-extra-night')?.value)||0;
  const extraOver  = parseInt(document.getElementById('njob-alba-extra-over')?.value)||0;
  const extraOther = parseInt(document.getElementById('njob-alba-extra-other')?.value)||0;
  const extraMeal  = parseInt(document.getElementById('njob-alba-extra-meal')?.value)||0;
  const extraTotal = extraNight + extraOver + extraOther + extraMeal;

  const totalPay = dayPay + nightPay + extraTotal;

  let detailHtml = '';
  if(breakMin > 0)   detailHtml += `⏸ 휴게 ${breakMin}분 공제 (실근무 ${Math.round(totalHours*10)/10}시간)<br>`;
  if(dayHours > 0)   detailHtml += `주간 ${dayHours}시간 × ${wage.toLocaleString()}원 = ${dayPay.toLocaleString()}원<br>`;
  if(nightHours > 0) detailHtml += `야간 ${nightHours}시간 × ${Math.round(wage*1.5).toLocaleString()}원(×1.5) = ${nightPay.toLocaleString()}원<br>`;
  if(extraNight > 0) detailHtml += `야간고정수당 +${extraNight.toLocaleString()}원<br>`;
  if(extraOver > 0)  detailHtml += `약정초과수당 +${extraOver.toLocaleString()}원<br>`;
  if(extraOther > 0) detailHtml += `기타수당 +${extraOther.toLocaleString()}원<br>`;
  if(extraMeal > 0)  detailHtml += `식대 +${extraMeal.toLocaleString()}원<br>`;
  detailHtml += `총 ${Math.round(totalHoursRaw*10)/10}시간 (휴게 ${breakMin}분 제외)`;

  detail.innerHTML = detailHtml;
  total.textContent = '+'+totalPay.toLocaleString()+'원';
  prev.style.display = 'block';
}

// addNjobAlba 함수 오버라이드 — 시간 기반으로 재계산
const _origAddNjobAlba = typeof addNjobAlba !== 'undefined' ? addNjobAlba : null;

function addNjobAlba(){
  const key = editKey;
  const name = (document.getElementById('njob-alba-name')?.value||'').trim();
  const wage = parseInt(document.getElementById('njob-alba-wage')?.value)||0;
  const startStr = document.getElementById('njob-alba-start')?.value||'09:00';
  const endStr   = document.getElementById('njob-alba-end')?.value||'18:00';

  if(!name){ showToast('⚠️ 알바명을 입력해주세요'); return; }
  if(wage <= 0){ showToast('⚠️ 시급을 입력해주세요'); return; }

  const [sh,sm] = startStr.split(':').map(Number);
  const [eh,em] = endStr.split(':').map(Number);
  let startMin = sh*60+sm;
  let endMin   = eh*60+em;
  if(endMin <= startMin) endMin += 24*60;

  const totalMin    = endMin - startMin;
  const totalHoursRaw = totalMin / 60;

  // ── 휴게시간: 사용자 직접 입력 ──
  const breakMin   = parseInt(document.getElementById('njob-alba-break')?.value)||0;
  const workMin    = Math.max(0, totalMin - breakMin);
  const totalHours = Math.round(workMin/60*10)/10;

  // 야간 계산 - 휴게시간 야간 구간에서 먼저 차감
  let rawNightMin2 = 0;
  let cur2 = startMin;
  while(cur2 < endMin){ const h=Math.floor(cur2/60)%24; if(h>=22||h<6) rawNightMin2++; cur2++; }
  const nightBreak2 = Math.min(breakMin, rawNightMin2);
  const dayBreak2   = breakMin - nightBreak2;
  const nightMin    = Math.max(0, rawNightMin2 - nightBreak2);
  const dayMin      = Math.max(0, (totalMin - rawNightMin2) - dayBreak2);
  const dayHours    = Math.round(dayMin/60*10)/10;
  const nightHours  = Math.round(nightMin/60*10)/10;
  // 추가수당 (쿠팡/택배)
  const extraNight = parseInt(document.getElementById('njob-alba-extra-night')?.value)||0;
  const extraOver  = parseInt(document.getElementById('njob-alba-extra-over')?.value)||0;
  const extraOther = parseInt(document.getElementById('njob-alba-extra-other')?.value)||0;
  const extraMeal  = parseInt(document.getElementById('njob-alba-extra-meal')?.value)||0;
  const extraTotal = extraNight + extraOver + extraOther + extraMeal;

  // 연장근로(1일 8h 초과) 가산 — 기존 1배 베이스에 0.5배를 "추가 가산"하는 방식으로 계산해
  // 야간수당(0.5배 가산)과 동일한 구조로 처리, 야간·연장이 겹쳐도 중복 없이 각각 0.5배씩만 추가됨
  // (기존 식 dayHours*wage + nightHours*wage*1.5 는 otHours=0일 때와 결과가 100% 동일함)
  const otHours = Math.round(Math.max(0, totalHours - 8) * 10) / 10;
  const basePay = Math.round(totalHours*wage) + Math.round(nightHours*wage*0.5) + Math.round(otHours*wage*0.5);
  const amount  = basePay + extraTotal;

  let detail = `${totalHours}시간`;
  if(nightHours > 0) detail += ` (야간 ${nightHours}h×1.5)`;
  if(otHours > 0) detail += ` (연장 ${otHours}h×1.5)`;
  if(extraTotal > 0) detail += ` + 추가수당 ${extraTotal.toLocaleString()}원`;

  const data = njobLoad(key);
  data.alba.push({
    id:Date.now(), name, wage, hours:totalHours,
    startTime:startStr, endTime:endStr,
    dayHours, nightHours, otHours, amount, detail,
    extraNight, extraOver, extraOther, extraMeal
  });
  njobSave(key, data);

  // 시급 저장
  const wk='atm2_jobWages'; let wages={};
  try{const r=localStorage.getItem(wk);if(r)wages=JSON.parse(r);}catch(e){}
  wages['convenience']=wage;
  if(typeof saveJobWages==='function') saveJobWages(wages); else try{localStorage.setItem('atm2_jobWages',JSON.stringify(wages));}catch(e){}

  // 입력 초기화
  document.getElementById('njob-alba-name').value='';
  document.getElementById('njob-alba-start').value='09:00';
  document.getElementById('njob-alba-end').value='18:00';
  const prev=document.getElementById('njob-alba-preview');
  if(prev) prev.style.display='none';
  document.querySelectorAll('.alba-type-btn').forEach(b=>{
    b.style.background='var(--surface)';b.style.borderColor='var(--border)';
    b.style.color='var(--text2)';b.style.fontWeight='400';
  });

  showToast(`✅ ${name} +${amount.toLocaleString()}원 추가됨`);
  renderCalendar();
}
// ══════════════════════════════════════════

// ── 배달·대리 카테고리 선택 + 자동계산 ──
function selectDeliveryType(name){
  document.querySelectorAll('.delivery-type-btn').forEach(btn=>{
    const isSelected = btn.textContent.includes(name) && name !== '';
    btn.style.background = isSelected ? 'rgba(255,209,102,.15)' : 'var(--surface)';
    btn.style.borderColor = isSelected ? 'var(--yellow)' : 'var(--border)';
    btn.style.color = isSelected ? 'var(--yellow)' : 'var(--text2)';
    btn.style.fontWeight = isSelected ? '700' : '400';
  });
  const nameInp = document.getElementById('njob-delivery-name');
  if(nameInp && name !== '') nameInp.value = name;
  calcDeliveryAuto();
}

function calcDeliveryAuto(){
  const count = parseInt(document.getElementById('njob-delivery-count')?.value)||0;
  const price = parseInt(document.getElementById('njob-delivery-price')?.value)||0;
  const prev  = document.getElementById('njob-delivery-preview');
  const detail= document.getElementById('njob-delivery-preview-detail');
  const total = document.getElementById('njob-delivery-preview-total');
  if(!prev) return;
  if(count>0 && price>0){
    prev.style.display='block';
    if(detail) detail.textContent = `${count}건 × ${price.toLocaleString()}원`;
    if(total)  total.textContent  = `+${(count*price).toLocaleString()}원`;
  } else {
    prev.style.display='none';
  }
}


// ══════════════════════════════════════════
// 추가수익(etc) 섹션 HTML 생성 및 관련 함수
// ══════════════════════════════════════════
const ETC_CATEGORIES = [
  { id:'insurance', icon:'🏥', label:'보험/합의금',  desc:'실손보험금·사고합의금·자동차보험' },
  { id:'gov',       icon:'🏛️', label:'정부지원금',   desc:'청년수당·고용장려금·긴급복지·국민취업지원' },
  { id:'tax',       icon:'💸', label:'세금환급',     desc:'연말정산·종합소득세·부가세 환급' },
  { id:'platform',  icon:'📱', label:'플랫폼정산',   desc:'쿠팡파트너스·블로그·유튜브 AdSense' },
  { id:'sale',      icon:'🛍️', label:'중고판매',     desc:'당근마켓·번개장터·개인 거래' },
  { id:'finance',   icon:'📈', label:'금융수익',     desc:'이자·배당금·적금 만기' },
  { id:'reward',    icon:'🎁', label:'경품/상금',    desc:'공모전·이벤트 당첨·앱 리워드' },
  { id:'transfer',  icon:'💌', label:'사례비/송금',  desc:'재능기부 답례·지인 사례금' },
  { id:'other',     icon:'✨', label:'기타',         desc:'인세·특허료·콘텐츠 판매 등' },
];

function buildEtcSectionHTML(key){
  const catOptions = ETC_CATEGORIES.map(c=>
    `<option value="${c.id}">${c.icon} ${c.label}</option>`
  ).join('');
  const catBtns = ETC_CATEGORIES.map(c=>`
    <button class="etc-cat-btn" onclick="selectEtcCat('${c.id}',this)" data-cat="${c.id}"
      style="display:inline-flex;align-items:center;gap:4px;padding:5px 9px;border-radius:8px;
             border:1px solid var(--border);background:var(--surface);color:var(--text2);
             font-size:15px;font-weight:600;cursor:pointer;font-family:'Noto Sans KR';
             transition:all .15s;white-space:nowrap;">
      ${c.icon} ${c.label}
    </button>`).join('');

  return `
  <div style="margin-top:10px;">
    <div id="njob-etc-hdr" onclick="toggleNjobSec('etc')"
      style="display:flex;align-items:center;justify-content:space-between;
             padding:11px 14px;background:var(--surface);border:1px solid var(--border);
             border-radius:10px;cursor:pointer;user-select:none;">
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:21px;">✨</span>
        <span style="font-size:17px;font-weight:700;color:var(--text);">추가 수익</span>
        <span id="njob-etc-badge" style="font-size:15px;color:var(--text3);"></span>
      </div>
      <span id="njob-etc-arr" style="font-size:16px;color:var(--text3);">▼</span>
    </div>
    <div id="njob-etc-body" style="display:none;border:1px solid var(--border);border-top:none;
         border-radius:0 0 10px 10px;padding:12px 12px 14px;background:var(--surface);">
      <div id="njob-etc-items" style="margin-bottom:10px;"></div>
      <div style="background:rgba(61,214,140,.05);border:1px solid rgba(61,214,140,.2);
                  border-radius:10px;padding:12px;">
        <div style="font-size:15px;font-weight:700;color:#3dd68c;margin-bottom:8px;">+ 추가수익 기록</div>
        <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px;">
          ${catBtns}
        </div>
        <div id="njob-etc-cat-desc" style="display:none;font-size:15px;color:var(--text3);
          margin-bottom:8px;padding:4px 8px;background:rgba(255,255,255,.04);border-radius:6px;"></div>
        <select id="njob-etc-cat" style="display:none;">${catOptions}</select>
        <input id="njob-etc-name" type="text"
          placeholder="수익명 (예: 실손보험금, 청년수당, 쿠팡파트너스)"
          style="width:100%;background:var(--surface2);border:1px solid var(--border);color:var(--text);
                 border-radius:8px;padding:9px 12px;font-size:17px;font-family:'Noto Sans KR';
                 outline:none;margin-bottom:8px;box-sizing:border-box;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <input id="njob-etc-amount" type="number" min="0" step="1000"
            placeholder="금액 (원)" oninput="updateEtcPreview()"
            style="flex:1;background:var(--surface2);border:1px solid var(--border);color:var(--text);
                   border-radius:8px;padding:9px 12px;font-size:18px;font-family:'JetBrains Mono';
                   outline:none;text-align:right;font-weight:700;min-width:0;">
          <span style="font-size:17px;color:var(--text2);flex-shrink:0;">원</span>
        </div>
        <div id="njob-etc-preview" style="display:none;text-align:right;font-size:18px;
          font-weight:700;color:#3dd68c;margin-bottom:8px;"></div>
        <textarea id="njob-etc-memo" placeholder="메모 (선택 — 예: 2024년 귀속 환급, 1차 지급)"
          style="width:100%;background:var(--surface2);border:1px solid var(--border);color:var(--text);
                 border-radius:8px;padding:8px 12px;font-size:16px;font-family:'Noto Sans KR';
                 outline:none;resize:none;height:40px;margin-bottom:10px;box-sizing:border-box;"></textarea>
        <button onclick="addNjobEtc('${key}')"
          style="width:100%;padding:10px;border-radius:8px;border:none;
                 background:#3dd68c;color:#0f1318;font-size:18px;font-weight:700;
                 cursor:pointer;font-family:'Noto Sans KR';">+ 추가</button>
        <div style="margin-top:8px;font-size:14px;color:var(--text3);line-height:1.8;">
          ℹ️ 보험금·정부지원금은 일반적으로 비과세<br>
          플랫폼정산·공모전 상금은 기타/사업소득 → 5월 종합소득세 신고 필요
        </div>
      </div>
    </div>
  </div>`;
}

function selectEtcCat(catId, btn){
  document.querySelectorAll('.etc-cat-btn').forEach(b=>{
    b.style.background='var(--surface)'; b.style.borderColor='var(--border)'; b.style.color='var(--text2)';
  });
  btn.style.background='rgba(61,214,140,.15)';
  btn.style.borderColor='#3dd68c';
  btn.style.color='#3dd68c';
  const sel = document.getElementById('njob-etc-cat');
  if(sel) sel.value = catId;
  const cat = ETC_CATEGORIES.find(c=>c.id===catId);
  const desc = document.getElementById('njob-etc-cat-desc');
  if(desc && cat){ desc.textContent=cat.desc; desc.style.display='block'; }
  const nameInp = document.getElementById('njob-etc-name');
  if(nameInp && !nameInp.value){
    const ex={insurance:'실손보험금, 자동차보험 합의금',gov:'청년수당, 고용장려금',
      tax:'연말정산 환급',platform:'쿠팡파트너스 정산, 유튜브 AdSense',
      sale:'당근마켓 판매',finance:'적금 만기 이자, 배당금',
      reward:'공모전 상금, 이벤트 당첨',transfer:'재능기부 답례, 사례비',other:'기타 수입'};
    nameInp.placeholder = `수익명 (예: ${ex[catId]||'기타 수입'})`;
  }
}

function updateEtcPreview(){
  const amtEl = document.getElementById('njob-etc-amount');
  const prev  = document.getElementById('njob-etc-preview');
  if(!amtEl||!prev) return;
  const amt = parseInt(amtEl.value)||0;
  if(amt>0){ prev.textContent='+'+amt.toLocaleString()+'원'; prev.style.display='block'; }
  else { prev.style.display='none'; }
}

function addNjobEtc(key){
  const catId  = document.getElementById('njob-etc-cat')?.value || 'other';
  const name   = (document.getElementById('njob-etc-name')?.value||'').trim();
  const amount = parseInt(document.getElementById('njob-etc-amount')?.value)||0;
  const memo   = (document.getElementById('njob-etc-memo')?.value||'').trim();
  if(!name){ showToast('⚠️ 수익명을 입력해주세요'); return; }
  if(amount<=0){ showToast('⚠️ 금액을 입력해주세요'); return; }
  const data = njobLoad(key);
  if(!data.etc) data.etc=[];
  data.etc.push({id:Date.now(), cat:catId, name, amount, memo});
  njobSave(key, data);
  clearNjobInput('etc');
  const prev = document.getElementById('njob-etc-preview');
  if(prev) prev.style.display='none';
  document.querySelectorAll('.etc-cat-btn').forEach(b=>{
    b.style.background='var(--surface)'; b.style.borderColor='var(--border)'; b.style.color='var(--text2)';
  });
  const descEl = document.getElementById('njob-etc-cat-desc');
  if(descEl) descEl.style.display='none';
  const cat = ETC_CATEGORIES.find(c=>c.id===catId);
  showToast(`✅ ${cat?.icon||'✨'} ${name} +${amount.toLocaleString()}원`);
  renderCalendar();
}

// ══════════════════════════════════════════
// 추가수입(etc) 전용 달력
// ══════════════════════════════════════════
function renderEtcCalendar(){
  const today = new Date();
  document.getElementById('month-title').textContent = `${curY}년 ${curM+1}월`;
  const grid = document.getElementById('calendar');
  grid.innerHTML = '';

  // 요일 헤더
  ['일','월','화','수','목','금','토'].forEach(d=>{
    const h = document.createElement('div');
    h.className = 'cal-hdr'; h.textContent = d; grid.appendChild(h);
  });

  const firstDay = new Date(curY, curM, 1).getDay();
  for(let i = 0; i < firstDay; i++){
    const e = document.createElement('div'); e.className = 'cal-day empty'; grid.appendChild(e);
  }

  const dim = new Date(curY, curM+1, 0).getDate();
  let totalAmt = 0, totalCount = 0;

  for(let d = 1; d <= dim; d++){
    const key = dk(curY, curM, d);
    const data = njobLoad(key);
    const etcItems = data.etc || [];
    const dayAmt = etcItems.reduce((s, it) => s + (it.amount||0), 0);
    const dow = new Date(curY, curM, d).getDay();
    const isToday = today.getFullYear()===curY && today.getMonth()===curM && today.getDate()===d;

    if(etcItems.length > 0){ totalCount += etcItems.length; totalAmt += dayAmt; }

    const el = document.createElement('div');
    el.className = 'cal-day' + (isToday?' today':'') + (dow===0?' is-sun':'') + (dow===6?' is-sat':'');
    el.onclick = () => openEtcDayPopup(key, d);

    let html = `<div class="dn">${d}</div>`;
    const hName = HOLIDAYS[key];
    if(hName) html += `<div style="font-size:11px;color:var(--orange);margin-bottom:2px;">${hName}</div>`;

    etcItems.slice(0, 2).forEach(it => {
      html += `<div style="font-size:12px;color:#3dd68c;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">✨ ${it.name||'추가수익'}</div>`;
    });
    if(etcItems.length > 2) html += `<div style="font-size:11px;color:var(--text3);">+${etcItems.length-2}건</div>`;
    if(dayAmt > 0) html += `<div style="font-size:12px;color:#3dd68c;font-weight:700;margin-top:1px;">${dayAmt>=10000?Math.round(dayAmt/10000)+'만':dayAmt.toLocaleString()}원</div>`;

    el.innerHTML = html;
    grid.appendChild(el);
  }

  // 통계 행
  document.getElementById('stats-row').innerHTML = `
    <div class="stat-card"><div class="lbl">이번달 건수</div><div class="val" style="color:var(--accent)">${totalCount}건</div></div>
    <div class="stat-card"><div class="lbl">이번달 수입</div><div class="val" style="color:#3dd68c;font-size:20px;">${totalAmt>=10000?Math.round(totalAmt/10000)+'만':totalAmt.toLocaleString()}원</div></div>`;
}

// 추가수입(etc) 날짜 팝업
function openEtcDayPopup(key, d){
  editKey = key;
  let overlay = document.getElementById('etc-day-popup');
  if(!overlay){
    overlay = document.createElement('div');
    overlay.id = 'etc-day-popup';
    overlay.className = 'overlay';
    overlay.onclick = e => { if(e.target===overlay) overlay.style.display='none'; };
    document.body.appendChild(overlay);
  }

  function render(){
    const data = njobLoad(key);
    const etcItems = data.etc || [];
    const total = etcItems.reduce((s,it)=>s+(it.amount||0),0);

    const catOptions = ETC_CATEGORIES.map(c=>`<option value="${c.id}">${c.icon} ${c.label}</option>`).join('');
    const catBtns = ETC_CATEGORIES.map(c=>`
      <button class="etc-cat-btn" onclick="selectEtcCat('${c.id}',this)" data-cat="${c.id}"
        style="display:inline-flex;align-items:center;gap:4px;padding:5px 9px;border-radius:8px;
               border:1px solid var(--border);background:var(--surface);color:var(--text2);
               font-size:15px;font-weight:600;cursor:pointer;font-family:'Noto Sans KR';
               transition:all .15s;white-space:nowrap;">
        ${c.icon} ${c.label}
      </button>`).join('');

    const itemsHTML = etcItems.length > 0
      ? etcItems.map((it,i)=>`
          <div style="display:flex;justify-content:space-between;align-items:center;
                      padding:8px 10px;background:rgba(61,214,140,.06);border-radius:8px;margin-bottom:6px;">
            <div>
              <div style="font-size:17px;font-weight:600;color:var(--text);">✨ ${it.name||'추가수익'}</div>
              ${it.memo?`<div style="font-size:15px;color:var(--text3);">${it.memo}</div>`:''}
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-size:18px;font-weight:700;color:#3dd68c;">+${(it.amount||0).toLocaleString()}원</span>
              <button onclick="deleteNjobEtcByIdx('${key}',${i})"
                style="background:none;border:none;color:var(--text3);font-size:21px;cursor:pointer;padding:2px;">✕</button>
            </div>
          </div>`).join('')
      : `<div style="text-align:center;color:var(--text3);font-size:17px;padding:16px 0;">아직 기록이 없어요</div>`;

    overlay.innerHTML = `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:20px;
                  padding:24px 20px;max-width:420px;width:96%;max-height:90vh;overflow-y:auto;
                  box-shadow:0 24px 64px rgba(0,0,0,.45);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <div style="font-size:21px;font-weight:700;color:var(--text);">✨ ${curY}년 ${curM+1}월 ${d}일 추가수익</div>
          <button onclick="document.getElementById('etc-day-popup').style.display='none'"
            style="background:none;border:none;color:var(--text3);font-size:26px;cursor:pointer;">✕</button>
        </div>
        ${total>0?`<div style="text-align:right;font-size:17px;font-weight:700;color:#3dd68c;margin-bottom:12px;">합계 +${total.toLocaleString()}원</div>`:''}
        <div style="margin-bottom:16px;">${itemsHTML}</div>
        <div style="background:rgba(61,214,140,.05);border:1px solid rgba(61,214,140,.2);border-radius:10px;padding:12px;">
          <div style="font-size:15px;font-weight:700;color:#3dd68c;margin-bottom:8px;">+ 추가수익 기록</div>
          <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px;">${catBtns}</div>
          <div id="njob-etc-cat-desc" style="display:none;font-size:15px;color:var(--text3);
            margin-bottom:8px;padding:4px 8px;background:rgba(255,255,255,.04);border-radius:6px;"></div>
          <select id="njob-etc-cat" style="display:none;">${catOptions}</select>
          <input id="njob-etc-name" type="text" placeholder="수익명 (예: 실손보험금, 청년수당)"
            style="width:100%;background:var(--surface2);border:1px solid var(--border);color:var(--text);
                   border-radius:8px;padding:9px 12px;font-size:17px;font-family:'Noto Sans KR';
                   outline:none;margin-bottom:8px;box-sizing:border-box;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
            <input id="njob-etc-amount" type="number" min="0" step="1000"
              placeholder="금액 (원)" oninput="updateEtcPreview()"
              style="flex:1;background:var(--surface2);border:1px solid var(--border);color:var(--text);
                     border-radius:8px;padding:9px 12px;font-size:18px;font-family:'JetBrains Mono';
                     outline:none;text-align:right;font-weight:700;min-width:0;">
            <span style="font-size:17px;color:var(--text2);flex-shrink:0;">원</span>
          </div>
          <div id="njob-etc-preview" style="display:none;text-align:right;font-size:18px;font-weight:700;color:#3dd68c;margin-bottom:8px;"></div>
          <textarea id="njob-etc-memo" placeholder="메모 (선택)"
            style="width:100%;background:var(--surface2);border:1px solid var(--border);color:var(--text);
                   border-radius:8px;padding:8px 12px;font-size:16px;font-family:'Noto Sans KR';
                   outline:none;resize:none;height:40px;margin-bottom:10px;box-sizing:border-box;"></textarea>
          <button onclick="addNjobEtcFromPopup('${key}')"
            style="width:100%;padding:10px;border-radius:8px;border:none;
                   background:#3dd68c;color:#0f1318;font-size:18px;font-weight:700;
                   cursor:pointer;font-family:'Noto Sans KR';">+ 추가</button>
        </div>
      </div>`;
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
  }

  render();

  // 팝업 내 추가 버튼 전용 함수
  window.addNjobEtcFromPopup = function(k){
    const catId  = document.getElementById('njob-etc-cat')?.value || 'other';
    const name   = (document.getElementById('njob-etc-name')?.value||'').trim();
    const amount = parseInt(document.getElementById('njob-etc-amount')?.value)||0;
    const memo   = (document.getElementById('njob-etc-memo')?.value||'').trim();
    if(!name){ showToast('⚠️ 수익명을 입력해주세요'); return; }
    if(amount <= 0){ showToast('⚠️ 금액을 입력해주세요'); return; }
    const data = njobLoad(k);
    if(!data.etc) data.etc = [];
    data.etc.push({ id:Date.now(), cat:catId, name, amount, memo });
    njobSave(k, data);
    const cat = ETC_CATEGORIES.find(c=>c.id===catId);
    showToast(`✅ ${cat?.icon||'✨'} ${name} +${amount.toLocaleString()}원`);
    render(); // 팝업 갱신
  };

  // 삭제 함수
  window.deleteNjobEtcByIdx = function(k, idx){
    const data = njobLoad(k);
    if(!data.etc) return;
    data.etc.splice(idx, 1);
    njobSave(k, data);
    render();
  };
}
// ══════════════════════════════════════════
