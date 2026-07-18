// ══════════════════════════════════════════
// 근태관리 v3 — "오늘 브리핑 + 생존관리 중심" (P2: 전 엔진)
// 철학: 오늘의 노동이 이번 달 생존에 어떤 영향을 주는지 보여주는 화면.
// 보상 원칙: 수입 증가가 아니라 "생존이 좋아졌다"를 고양이 비서의 말로 전한다.
// 뷰만 교체 — localStorage 스키마·계산 엔진(calcNetHours/getPayData/
// getSalaryPayData/calcZeroBalanceDate 등)은 기존 것을 그대로 호출한다.
// 롤백: localStorage atm2_attV3 = 'off' 로 즉시 기존 달력 화면 복귀.
// ══════════════════════════════════════════

var _attV3Sel = null;          // 선택된 날짜 (Date). null = 오늘
var _attV3MonthCache = {};     // 'y-m' → 타월 dayData (attLoadMonth 캐시)
var _attV3PopupOpen = false;   // 월간 팝업 열림 → 레거시 렌더 통과
var _attV3DeltaShownFor = '';  // 생존 델타 피드백 하루 1회 (dateKey)
var _attV3DetailOpen = false;  // 브리핑 상세 펼침
var _attV3SurvSnap = null;     // 기록 직전 생존 스냅샷 (델타 계산용)

// ── Work Session 엔진 (공통 임시 세션 — localStorage 단일 키) ──
function _wsGet(){
  try{ var s = localStorage.getItem('atm2_workSession'); return s ? JSON.parse(s) : null; }catch(e){ return null; }
}
function _wsStart(jobType){
  var now = new Date();
  var nowH = Math.round((now.getHours()+now.getMinutes()/60)*4)/4;
  var key = _attV3Key(now);
  localStorage.setItem('atm2_workSession', JSON.stringify({
    startTime: Date.now(), startH: nowH, date: key, jobType: jobType||'employee'
  }));
  var t = _wsTerms(jobType);
  if(typeof showToast==='function') showToast(t.startIcon+' '+t.start+' '+fmtTime(nowH));
  if(jobType==='employee' || jobType==='salary'){
    var dk = _attV3Key(now);
    if(typeof dayData!=='undefined'){ dayData[dk] = { status:'work', start:nowH, note:'' }; _attV3Persist(); }
  }
  renderAttV3();
}
function _wsEnd(){
  var ws = _wsGet();
  if(!ws) return;
  var now = new Date();
  var nowH = Math.round((now.getHours()+now.getMinutes()/60)*4)/4;
  var elapsed = nowH - ws.startH;
  if(elapsed < 0) elapsed += 24;
  localStorage.removeItem('atm2_workSession');
  var jobs = _attV3Jobs();
  var hasEmp = jobs.indexOf('employee')>=0 || jobs.indexOf('salary')>=0;
  if(hasEmp && (ws.jobType==='employee' || ws.jobType==='salary')){
    var dk = ws.date;
    if(typeof dayData!=='undefined' && dayData[dk]){
      _attV3SurvSnap = _attV3SurvSnapshot();
      dayData[dk].end = nowH;
      _attV3Persist();
      renderAttV3();
      _attV3CelebrateSurvival(_attV3Today());
      return;
    }
  }
  // 비시급제: 기존 팝업 열기
  var sel = _attV3SelDate();
  _attV3OpenEditor(sel);
  renderAttV3();
}
function _wsActive(){
  var ws = _wsGet();
  if(!ws) return null;
  var elapsed = (Date.now() - ws.startTime) / 3600000;
  return { startH: ws.startH, elapsed: elapsed, jobType: ws.jobType, date: ws.date };
}
function _wsElapsedStr(){
  var ws = _wsActive();
  if(!ws) return '';
  var h = Math.floor(ws.elapsed);
  var m = Math.floor((ws.elapsed - h)*60);
  return h+'시간 '+m+'분';
}

// ── 직업별 용어 맵 ──
function _wsTerms(jobType){
  if(jobType==='employee'||jobType==='salary') return { start:'출근', end:'퇴근', startIcon:'☀️', endIcon:'🌙', action:'출근하기', pastAction:'기록하기', futureAction:'미리 기록하기', metric:'근무시간', income:'수입' };
  if(jobType==='delivery'||jobType==='driver') return { start:'운행 시작', end:'운행 종료', startIcon:'🛵', endIcon:'🏁', action:'운행 시작하기', pastAction:'운행 기록하기', futureAction:'미리 기록하기', metric:'운행시간', income:'운행 수입' };
  if(jobType==='freelancer') return { start:'작업 시작', end:'작업 종료', startIcon:'💻', endIcon:'✅', action:'작업 시작하기', pastAction:'작업 기록하기', futureAction:'미리 기록하기', metric:'작업시간', income:'작업 수입' };
  if(jobType==='convenience'||jobType==='shortAlba') return { start:'출근', end:'퇴근', startIcon:'☀️', endIcon:'🌙', action:'출근하기', pastAction:'기록하기', futureAction:'미리 기록하기', metric:'근무시간', income:'수입' };
  return { start:'영업 시작', end:'영업 종료', startIcon:'🏪', endIcon:'🔒', action:'영업 시작하기', pastAction:'기록하기', futureAction:'미리 기록하기', metric:'영업시간', income:'매출' };
}
function _wsMainJob(){
  var jobs = _attV3Jobs();
  if(jobs.indexOf('employee')>=0) return 'employee';
  if(jobs.indexOf('salary')>=0) return 'salary';
  if(jobs.indexOf('delivery')>=0) return 'delivery';
  if(jobs.indexOf('freelancer')>=0) return 'freelancer';
  if(jobs.indexOf('convenience')>=0) return 'convenience';
  if(jobs.indexOf('etc')>=0) return 'etc';
  return 'employee';
}

var _wsStaleChecked = false;
function _wsCheckStale(){
  if(_wsStaleChecked) return;
  _wsStaleChecked = true;
  var ws = _wsGet();
  if(!ws) return;
  var elapsedH = (Date.now() - ws.startTime) / 3600000;
  if(elapsedH < 16) return;
  var t = _wsTerms(ws.jobType);
  var overlay = document.createElement('div');
  overlay.id = 'attv3-stale-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.6);z-index:99999;display:flex;align-items:center;justify-content:center;padding:24px;';
  var startDate = new Date(ws.startTime);
  var dateStr = (startDate.getMonth()+1)+'월 '+startDate.getDate()+'일 '+fmtTime(ws.startH);
  overlay.innerHTML =
    '<div style="background:var(--card,#23263a);border-radius:20px;padding:28px 24px;max-width:340px;width:100%;text-align:center;">'
    + '<div style="font-size:40px;margin-bottom:12px;">⏰</div>'
    + '<div style="font-size:16px;font-weight:800;color:var(--text,#eee);margin-bottom:8px;">'+t.start+'이 아직 진행 중이에요</div>'
    + '<div style="font-size:13px;color:var(--text3,#999);margin-bottom:20px;">'+dateStr+'에 시작한 '+t.metric+'이<br>아직 종료되지 않았어요. ('+Math.floor(elapsedH)+'시간 경과)</div>'
    + '<button id="attv3-stale-end" style="width:100%;padding:14px 0;border-radius:14px;border:none;background:var(--accent,#4f7cff);color:#fff;font-size:16px;font-weight:800;cursor:pointer;font-family:\'Noto Sans KR\',sans-serif;min-height:48px;margin-bottom:10px;">'+t.endIcon+' '+t.end+' 기록하기</button>'
    + '<button id="attv3-stale-continue" style="width:100%;padding:14px 0;border-radius:14px;border:none;background:transparent;color:var(--text3,#999);font-size:14px;font-weight:700;cursor:pointer;font-family:\'Noto Sans KR\',sans-serif;min-height:44px;">계속 진행</button>'
    + '</div>';
  document.body.appendChild(overlay);
  document.getElementById('attv3-stale-end').addEventListener('click', function(){
    overlay.remove();
    localStorage.removeItem('atm2_workSession');
    var d = new Date(ws.startTime);
    var sel = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    _attV3Select(sel);
    _attV3OpenEditor(sel);
  });
  document.getElementById('attv3-stale-continue').addEventListener('click', function(){
    overlay.remove();
  });
}

function attV3Enabled(){
  try{ if(localStorage.getItem('atm2_attV3') === 'off') return false; }catch(e){}
  return true;
}

function _attV3Jobs(){
  return (typeof loadSelectedJobs==='function') ? loadSelectedJobs() : [];
}

// ── 최근 근무기록 (PC용, 최근 5건) ──
function _attV3RecentRecords(){
  var today = _attV3Today();
  var results = [];
  var WD = ['일','월','화','수','목','금','토'];
  for(var i=1; i<=30 && results.length<5; i++){
    var d = new Date(today); d.setDate(today.getDate()-i);
    var rec = _attV3Rec(d);
    var nj = _attV3NjobDay(d);
    if(!rec && !nj.any) continue;
    var label = (d.getMonth()+1)+'/'+d.getDate()+' ('+WD[d.getDay()]+')';
    var detail = '', amount = 0;
    if(rec && rec.status){
      var st = rec.status;
      if(st==='leave'){ detail='🌿 연차'; }
      else if(st==='half'){ detail='🌗 반차'; }
      else if(st==='absent'){ detail='결근'; }
      else {
        if(rec.start!==undefined && rec.end!==undefined && rec.end!==null){
          detail = fmtTime(rec.start)+' ~ '+fmtTime(rec.end);
        } else if(rec.start!==undefined){ detail = fmtTime(rec.start)+' ~'; }
      }
    }
    var e = _attV3DayEarnings(d);
    if(e) amount = e.total;
    if(!amount && nj.total) amount = nj.total;
    if(nj.any && !rec){ detail = nj.deliveryN ? '🛵 '+nj.deliveryCount+'건' : (nj.freeN ? '💻 '+nj.freeN+'건' : (nj.albaN ? '⏰ '+nj.albaN+'건' : '기타')); }
    results.push({ label:label, detail:detail, amount:amount });
  }
  return results;
}

// renderCalendar() 최상단(budget.js·calendar-modes.js 래퍼)에서 호출
function attV3ShouldRender(){
  if(!attV3Enabled()) return false;
  if(_attV3PopupOpen) return false; // 팝업 안에서는 레거시 달력 렌더
  return _attV3Jobs().length > 0;   // P2: 직업 선택된 모든 엔진
}

function _attV3Today(){ var t=new Date(); return new Date(t.getFullYear(),t.getMonth(),t.getDate()); }
function _attV3SelDate(){ return _attV3Sel || _attV3Today(); }
function _attV3Key(d){ return dk(d.getFullYear(), d.getMonth(), d.getDate()); }
function _attV3IsToday(d){ var t=_attV3Today(); return d.getTime()===t.getTime(); }
function _attV3Won(n){ return Math.round(n).toLocaleString('ko-KR')+'원'; }
function _attV3Nick(){ return (typeof memName!=='undefined' && memName) ? memName+'님' : ''; }

// ── 타월 포함 일 기록 조회 (현재 월은 전역 dayData, 타월은 attLoadMonth 캐시) ──
function _attV3Rec(d){
  var y=d.getFullYear(), m=d.getMonth();
  if(typeof curY!=='undefined' && y===curY && m===curM){
    return (typeof dayData!=='undefined' && dayData) ? (dayData[_attV3Key(d)]||null) : null;
  }
  var ck = y+'-'+m;
  if(!(ck in _attV3MonthCache)){
    var data = null;
    try{
      if(typeof attLoadMonth==='function' && typeof activeWpId!=='undefined' && activeWpId && activeEmpId){
        data = attLoadMonth(activeWpId, activeEmpId, y, m) || {};
      }
    }catch(e){ data = {}; }
    _attV3MonthCache[ck] = data || {};
  }
  return _attV3MonthCache[ck][_attV3Key(d)] || null;
}
function attV3InvalidateCache(){ _attV3MonthCache = {}; }

// ── N잡(알바/배달/프리/기타) 하루 수입 집계 — 기존 njob 데이터 구조 그대로 읽기 ──
function _attV3NjobDay(d){
  var out = { alba:0, albaN:0, delivery:0, deliveryN:0, deliveryCount:0, free:0, freeN:0, etc:0, etcN:0, total:0, any:false };
  try{
    var raw = localStorage.getItem('atm2_njob_'+_attV3Key(d));
    if(!raw) return out;
    var nj = JSON.parse(raw);
    (nj.alba||[]).forEach(function(it){ out.alba += it.amount || Math.round((it.wage||0)*(it.hours||0)); out.albaN++; });
    (nj.delivery||[]).forEach(function(it){ out.delivery += (it.count||0)*(it.price||0); out.deliveryN++; out.deliveryCount += (it.count||0); });
    (nj.free||[]).forEach(function(it){
      var g = (typeof freeItemAmount==='function') ? freeItemAmount(it) : ((it.count||0)*(it.price||0));
      out.free += g; out.freeN++;
    });
    (nj.etc||[]).forEach(function(it){ out.etc += it.amount||0; out.etcN++; });
    out.total = out.alba + out.delivery + out.free + out.etc;
    out.any = (out.albaN+out.deliveryN+out.freeN+out.etcN) > 0;
  }catch(e){}
  return out;
}

// ── 그날에 어떤 기록이든 있는가 (주간 스트립 점) ──
function _attV3HasAny(d){
  var rec = _attV3Rec(d);
  if(rec && rec.status && rec.status!=='none') return true;
  return _attV3NjobDay(d).any;
}

// ── 시급제: 선택일 확정/실시간 수익 ──
// v3.4: 공통 함수(calcDayEarningsShared, salary.js)에 위임 — 전 화면 단일 계산 경로
function _attV3DayEarnings(d){
  if(typeof calcDayEarningsShared!=='function') return null;
  return calcDayEarningsShared(_attV3Rec(d), d);
}

// ── 월급제: 이번 달 일할 누적 (매일 자라는 숫자 — 월급제 사용자가 매일 열 이유) ──
function _attV3SalaryAccrued(){
  try{
    if(typeof getSalaryPayData!=='function') return null;
    var sd = getSalaryPayData();
    if(!sd || !sd.configured || !sd.netPay) return null;
    var t = new Date();
    var dim = new Date(t.getFullYear(), t.getMonth()+1, 0).getDate();
    return { accrued: Math.round(sd.netPay * t.getDate() / dim), netPay: sd.netPay };
  }catch(e){ return null; }
}

// ── 급여일 D-n ──
function _attV3Dday(){
  var payday = 0;
  try{ payday = parseInt(localStorage.getItem('atm2_payday'))||0; }catch(e){}
  if(!(payday>=1 && payday<=31)) return null;
  var t=_attV3Today();
  var pd = new Date(t.getFullYear(), t.getMonth(), Math.min(payday, new Date(t.getFullYear(),t.getMonth()+1,0).getDate()));
  if(pd < t) pd = new Date(t.getFullYear(), t.getMonth()+1, Math.min(payday, new Date(t.getFullYear(),t.getMonth()+2,0).getDate()));
  return Math.round((pd - t)/86400000);
}

// ══════════════════════════════════════════
// Hero Number — 오늘의 돈 (화면에서 가장 먼저 보이는 숫자)
// ══════════════════════════════════════════
function _attV3HeroNumber(d){
  var jobs = _attV3Jobs();
  var isToday = _attV3IsToday(d);
  var rec = _attV3Rec(d);
  var nj = _attV3NjobDay(d);
  var hasEmp = jobs.indexOf('employee')>=0;
  var hasSalary = jobs.indexOf('salary')>=0;
  var empAmount = 0, empLabel = '';

  // v3.1.1: 사업장 2개 이상이면 Hero도 전 사업장 합산 (CompanyEngine 반복 호출 재사용)
  if(hasEmp && typeof CompanyEngine!=='undefined' && CompanyEngine.isMulti()){
    var sumT = 0, sumH = 0, anyLive = false, recCnt = 0, coLines = [];
    CompanyEngine.companies().forEach(function(c){
      try{
        var e = (c.wpId===activeWpId)
          ? _attV3DayEarnings(d)
          : CompanyEngine.runFor(c.wpId, c.empId, function(){ return _attV3DayEarnings(d); });
        if(e){
          sumT += e.total||0; sumH += e.net||0; if(e.isLive) anyLive = true; recCnt++;
          coLines.push(c.name+' '+_attV3Won(e.total||0));
        }
      }catch(e2){}
    });
    if(recCnt > 0 || nj.total > 0){
      sumT += nj.total || 0;
      if(nj.total > 0) coLines.push('N잡 '+_attV3Won(nj.total));
      var subParts = ['오늘 총 근무 '+(Math.round(sumH*10)/10)+'시간', '사업장 '+CompanyEngine.companies().length+'곳 합산'];
      return { amount: sumT,
               label: anyLive ? '오늘 총 예상수입 · 실시간' : '오늘 총 예상수입',
               sub: coLines.join(' · ')+'<br>'+subParts.join(' · ') };
    }
    // 오늘 기록이 하나도 없으면 아래 기존 흐름(안내 문구)으로
  }

  if(hasEmp && rec && rec.status && rec.status!=='none'){
    if(rec.status==='leave') return { amount:null, label:'연차', sub:'🌿 쉬는 것도 생존의 힘이에요' };
    if(rec.status==='half') return { amount:null, label:'반차', sub:'🌗 남은 하루도 잘 챙기세요' };
    if(rec.status==='absent') return { amount:null, label:'결근', sub:'몸이 먼저예요' };
    var e = _attV3DayEarnings(d);
    if(e && e.isLive){ empAmount = e.total; empLabel = '실시간 수입 · '+e.net+'시간 근무 중'; }
    else if(e){ empAmount = e.total; empLabel = '확정 수입 · '+e.net+'시간'+(e.ot>0?' (연장 '+e.ot+'h)':''); }
  } else if(hasEmp && isToday){
    var et = _wsTerms('employee');
    var ws = _wsActive();
    if(ws && ws.jobType==='employee') return { amount:null, label:et.metric+' 중', sub:_wsElapsedStr()+' 경과' };
    return { amount:null, label:null, sub:et.start+'을 기록하면 예상 '+et.income+'이 표시돼요' };
  }

  if(hasSalary && !empAmount){
    var acc = _attV3SalaryAccrued();
    if(acc) return { amount:acc.accrued, label:'이달 누적 실수령', sub:'월급 '+_attV3Won(acc.netPay)+' 중' };
  }

  var total = empAmount + nj.total;
  if(total > 0){
    var sources = [];
    if(empAmount) sources.push('시급제');
    if(nj.deliveryN) sources.push('배달 '+nj.deliveryCount+'건');
    if(nj.albaN) sources.push('알바 '+nj.albaN+'건');
    if(nj.freeN) sources.push('작업 '+nj.freeN+'건');
    if(nj.etcN) sources.push('기타 '+nj.etcN+'건');
    var sub = sources.length>1 ? sources.join(' + ') : empLabel||sources[0]||'';
    return { amount:total, label: (empAmount && _attV3DayEarnings(d) && _attV3DayEarnings(d).isLive) ? '실시간 수입' : '확정 수입', sub:sub };
  }

  var mj = _wsMainJob();
  var mt = _wsTerms(mj);
  var ws = _wsActive();
  if(isToday && ws) return { amount:null, label:mt.metric+' 중', sub:_wsElapsedStr()+' 경과' };
  if(isToday) return { amount:null, label:null, sub:mt.start+'을 기록하면 여기에 오늘 '+mt.income+'이 표시돼요' };
  if(d < _attV3Today()) return { amount:null, label:null, sub:'기록하면 '+mt.income+'이 표시돼요' };
  return { amount:null, label:null, sub:'아직 오지 않은 날이에요' };
}

// ══════════════════════════════════════════
// 브리핑 문장 (고양이 비서의 격려·공감 — 2줄 이내, 설명 아닌 동료의 말)
// v2.4.1: 상태별 랜덤 문구 + 컨텍스트(날씨·주간 기록·급여일) 한 줄
// ══════════════════════════════════════════

// 날짜+상태 시드 → 같은 날·같은 상태에선 문구 고정(재렌더 깜빡임 방지), 날이 바뀌면 변경
function _attV3Seed(d, salt){
  var s = _attV3Key(d)+salt, h=0;
  for(var i=0;i<s.length;i++){ h=(h*31+s.charCodeAt(i))>>>0; }
  return h;
}
function _attV3Pick(d, salt, arr){ return arr[_attV3Seed(d, salt)%arr.length]; }

// SAO 컨텍스트 한 줄 — v2.5: SAO Context Engine(sao-engine.js)에 위임
// 우선순위(날씨→연속기록→급여일→기념일)와 문구 선택은 엔진이 담당
function _attV3Context(d){
  try{
    if(typeof SaoEngine!=='undefined') return SaoEngine.extraLine(d);
  }catch(e){}
  return '';
}

// 브리핑 아바타 — 텍스트 이모지 대신 머니냥 캐릭터 이미지(img/emoji) 사용
function _attV3BriefAvatar(br){
  var map = {
    '😺':'환영인사.png', '😸':'칭찬축하.png', '🐱':'모를때.png',
    '💪':'생각중.png',  '🌿':'환영인사.png', '🌗':'환영인사.png',
    '⏰':'걱정경고.png', '🏃':'걱정경고.png', '🌞':'칭찬축하.png'
  };
  var f = map[br.emoji];
  if(!f) return br.emoji;
  return '<img src="img/emoji/'+f+'" style="width:32px;height:32px;object-fit:cover;border-radius:50%;" alt="머니냥">';
}

function _attV3Briefing(d){
  var jobs = _attV3Jobs();
  var isToday = _attV3IsToday(d);
  var isPast = d < _attV3Today();
  var nick = _attV3Nick();
  var rec = _attV3Rec(d);
  var nj = _attV3NjobDay(d);
  var dday = _attV3Dday();
  var hasEmp = jobs.indexOf('employee')>=0;
  var hasSalary = jobs.indexOf('salary')>=0;
  var hasDelivery = jobs.some(function(j){ return j==='delivery'||j==='driver'; });
  var hasFree = jobs.indexOf('freelancer')>=0;
  var hasAlba = jobs.some(function(j){ return j==='convenience'||j==='shortAlba'; });

  if(hasEmp && rec && rec.status && rec.status!=='none'){
    // 연차 — 급여 차감 없는 유급 휴가 (리드 랜덤 + 핵심 설명 고정)
    if(rec.status==='leave') return { emoji:'🌿', text: _attV3Pick(d,'leave',[
      '오늘은 연차로 쉬는 날이에요. 충분히 쉬는 것도 중요해요!',
      '오늘은 휴식의 날이네요. 재충전하고 다시 힘내요!',
      '연차 잘 쓰셨어요. 쉼표가 있어야 문장이 완성되는 법이죠.'
    ])+'<br>연차는 법으로 보장된 유급 휴가라 쉬어도 급여가 깎이지 않아요. 푹 쉬는 것도 이번 달을 버티는 힘이에요!' };
    // 반차 — 하루의 절반 유급
    if(rec.status==='half') return { emoji:'🌗', text: _attV3Pick(d,'half',[
      '오늘은 반차예요. 남은 반나절도 잘 챙기세요!',
      '반차로 숨 고르는 날이네요. 짧은 쉼도 소중해요.',
      '반차 잘 쓰셨어요. 병원이나 개인 일정, 무사히 마치셨길!'
    ])+'<br>연차 하루를 반으로 나눠 쓰는 제도라 반나절(4시간)은 유급으로 처리돼요.' };
    // 결근 — 무급 + 주휴수당 영향 (위로 톤 유지, 랜덤 없이 신중하게)
    if(rec.status==='absent') return { emoji:'🐱', text:'오늘은 결근으로 기록됐어요. 결근은 연차와 달리 무급이라 하루치 급여가 빠지고, 그 주의 주휴수당에도 영향을 줄 수 있어요.<br>몸이 아파서 못 나가신 거라면, 급여보다 회복이 먼저예요. 괜찮으셨길 바라요.' };
    // 휴일근무 — 가산수당
    if(rec.status==='sat_work' || rec.status==='sun_work' || rec.status==='holiday'){
      return { emoji:'🌞', text: _attV3Pick(d,'holiday',[
        '쉬는 날인데도 일하셨네요, 정말 수고 많으셨어요!',
        '휴일 출근이라니, 오늘의 노력은 두 배로 값져요!',
        '주말에도 달리셨군요. 머니냥이 대신 박수 쳐드릴게요!'
      ])+'<br>휴일근무 시간은 평일과 다르게 가산되어 계산되니, 오늘 수고한 만큼 급여에 더해져요.'+_attV3Context(d) };
    }
    var e = _attV3DayEarnings(d);
    // 지각 — 주간근무 + 기준시각보다 늦은 출근 (30분 단위 올림 공제)
    var isLate = (typeof wt!=='undefined' && wt==='day')
      && (rec.status==='work' || rec.status==='early')
      && rec.start!==undefined && typeof dayStart!=='undefined' && rec.start > dayStart;
    if(isLate && e && e.isLive){
      var lateMin = Math.ceil((rec.start - dayStart) / 0.5) * 0.5 * 60 | 0;
      return { emoji:'⏰', text:'출근이 기준 시각보다 조금 늦으셨네요. 지각은 늦은 시간만큼(30분 단위 올림, 오늘 약 '+lateMin+'분) 기본급에서 빠지도록 계산돼요.<br>이미 반영해서 예상 수입을 보여드리고 있으니, 남은 시간 힘내세요!' };
    }
    // 조퇴 — 부족분 공제
    if(rec.status==='early' && e && !e.isLive){
      return { emoji:'🏃', text:'오늘은 조퇴로 기록됐어요. 몸이 안 좋거나 급한 일로 정규 시간보다 일찍 퇴근했을 때 사용하는 상태예요.<br>일한 시간만큼만 급여로 계산되고, 못 채운 시간은 공제돼요. 오늘 실근무 '+e.net+'시간으로 반영했어요.' };
    }
    // 출근(근무 중) — 실시간 계산 안내
    if(e && e.isLive) return { emoji:'💪', text: _attV3Pick(d,'live',[
      '지금 근무 중이에요! 오늘도 차곡차곡 수입을 쌓는 중이에요.',
      '열심히 일하고 계시네요! 머니냥이 옆에서 계산 중이에요.',
      '근무 시간이 실시간으로 기록되고 있어요. 오늘도 화이팅!',
      '출근 기록 완료, 지금부터는 머니냥이 알아서 계산할게요.'
    ])+'<br>일이 끝나면 퇴근하기를 눌러주세요. 그래야 오늘 수입이 확정돼요.'+_attV3Context(d) };
    // 퇴근(연장 포함) — 확정 안내
    if(e && e.ot>0) return { emoji:'😸', text: _attV3Pick(d,'otdone',[
      '퇴근 완료! 연장근무 '+e.ot+'시간까지, 정말 수고 많으셨어요.',
      '오늘은 연장 '+e.ot+'시간까지 달리셨네요. 진짜 대단해요!',
      '연장근무까지 마치고 퇴근! 오늘 하루 꽉 채우셨어요.'
    ])+'<br>8시간을 넘긴 시간은 1.5배로 가산돼서 이번 달 급여에 바로 반영됐어요. 푹 쉬세요!'+_attV3Context(d) };
    if(e) return { emoji:'😸', text: _attV3Pick(d,'done',[
      '퇴근 완료! 오늘도 수고 많으셨어요.',
      '오늘 수입이 확정되었습니다. 푹 쉬세요!',
      '오늘도 한 걸음 전진했어요. 편안한 저녁 보내세요.',
      '기록 완료! 오늘 번 만큼 이번 달이 든든해졌어요.'
    ])+'<br>퇴근이 기록되면 근무시간이 확정되고, 그만큼의 수입이 이번 달 급여에 더해져요.'+_attV3Context(d) };
  }

  if(nj.any) return { emoji:'😸', text:'수고 많으셨어요! 기록이 쌓일수록 이번 달이 든든해져요.' };

  // Work Session 진행 중
  var ws = _wsActive();
  if(ws && isToday){
    var wsT = _wsTerms(ws.jobType);
    return { emoji:'💪', text:'지금 '+wsT.metric+' 중이에요! 시작이 기록된 순간부터 시간과 예상 '+wsT.income+'을 자동으로 계산하고 있어요.<br>끝나면 '+wsT.end+' 버튼을 눌러주세요. 그래야 오늘 '+wsT.income+'이 확정돼요.' };
  }

  if(isToday){
    var hour = new Date().getHours();
    var greet = hour<11 ? '좋은 아침이에요' : (hour<18 ? '오늘도 화이팅이에요' : '오늘 하루 수고하셨어요');
    var tail = nick ? ', '+nick+'!' : '!';
    if(hasSalary && !hasEmp){
      var acc = _attV3SalaryAccrued();
      if(acc && dday!==null) return { emoji:'😺', text: greet+tail+' 월급날까지 D-'+dday+', 잘 가고 있어요.' };
      if(acc) return { emoji:'😺', text: greet+tail+' 오늘도 무사히 한 걸음!' };
      return { emoji:'😺', text: greet+tail+' 설정에서 월급을 입력하면 매일 얼마나 벌고 있는지 보여드릴게요.' };
    }
    if(hasDelivery) return { emoji:'😺', text: greet+tail+' 한 건 한 건이 이번 달의 힘이 돼요.' };
    if(hasFree) return { emoji:'😺', text: greet+tail+' 오늘 작업이 있다면 기록해 주세요.' };
    if(hasAlba) return { emoji:'😺', text: greet+tail+' 오늘 일한 알바가 있으면 기록해 주세요.' };
    if(hasEmp) return { emoji:'😺', text: greet+tail+' '+_attV3Pick(d,'idle',[
      '오늘 근무를 시작하셨다면 출근하기를 눌러주세요.',
      '출근을 기록하면 자동으로 계산을 시작할게요.',
      '오늘도 차곡차곡 수입을 쌓아볼까요?',
      '머니냥이 오늘도 함께할게요. 출근하면 알려주세요!',
      '오늘의 목표를 향해 출발! 출근 버튼으로 시작해요.'
    ])+'<br>출근 시간이 기록되면 근무시간과 예상 수입이 자동으로 계산돼요.'+_attV3Context(d) };
    return { emoji:'😺', text: greet+tail+' 기록하면 이번 달 생존이 좋아져요.' };
  }
  if(isPast) return { emoji:'🐱', text:'기록이 없는 날이에요. 지금 남겨도 바로 반영돼요!' };
  return { emoji:'🐱', text:'아직 오지 않은 날이에요. 연차를 미리 적어둘 수 있어요.' };
}

// ══════════════════════════════════════════
// v3.1: 사업장 목록 — 메인/보조를 동일 레벨 카드로 표시 (배지로만 구분)
// CompanyEngine/계산 엔진/Work Session/localStorage 구조 무변경 — UI 레이어만
// ══════════════════════════════════════════
var _ATTV3_WT_LBL = { day:'주간', night:'야간', '3shift':'3교대', alba:'알바' };

// 사업장 1개 카드 (메인/보조 동일 UI)
// v3.9: 근태 Hero — 캐릭터 한 줄 안내 (오늘일 때만, MnCharacter 단일 경로)
function _attV3CharHero(sel){
  try{
    if(typeof MnCharacter==='undefined' || !_attV3IsToday(sel)) return '';
    var jobs = _attV3Jobs();
    if(jobs.indexOf('employee')<0) return '';
    var mood = 'welcome', msg = '오늘 근무를 시작하면 출근을 눌러주세요.';
    if(typeof CompanyEngine!=='undefined'){
      var working = [], done = [];
      CompanyEngine.companies().forEach(function(c){
        var st = CompanyEngine.todayState(c.wpId, c.empId);
        if(st==='working') working.push(c.name);
        else if(st==='done') done.push(c.name);
      });
      if(working.length){ mood='thinking'; msg='현재 '+working.join('·')+' 근무 중입니다.'; }
      else if(done.length===CompanyEngine.companies().length && done.length>0){ mood='celebrate'; msg='오늘 근무를 모두 마쳤어요. 수고했어요!'; }
      else if(done.length){ mood='celebrate'; msg=done.join('·')+' 근무를 마쳤어요!'; }
    }
    return '<div style="display:flex;align-items:center;gap:10px;padding:2px 4px 10px;">'
      + MnCharacter.img(mood, 'sm')
      + '<div style="font-size:var(--font-base);font-weight:700;color:var(--text);">'+msg+'</div>'
      + '</div>';
  }catch(e){ return ''; }
}

function _attV3CoCard(c, isMain, sel){
  var isToday = _attV3IsToday(sel);
  var rate = c.emp.companyRate || c.emp.hourlyRate || 0;
  var wtLbl = _ATTV3_WT_LBL[c.emp.wt] || '주간';
  var rec, state;
  if(isMain){
    rec = _attV3Rec(sel);
    var wsm = _wsActive();
    state = (rec && rec.start!==undefined && rec.start!==null)
      ? ((rec.end===undefined||rec.end===null) ? 'working' : 'done') : 'idle';
    if(state==='idle' && wsm && isToday) state = 'working';
  } else {
    rec = CompanyEngine.recOf(c.wpId, c.empId, sel);
    state = CompanyEngine.todayState(c.wpId, c.empId);
  }
  // 오늘 근무 / 수입 (공통 계산 함수 단일 경로)
  var earn = null;
  try{
    if(rec && rec.start!==undefined && rec.start!==null){
      earn = isMain ? _attV3DayEarnings(sel)
        : CompanyEngine.runFor(c.wpId, c.empId, function(){
            return calcDayEarningsShared(rec, sel, { wsKey: 'atm2_workSession_'+c.wpId });
          });
    }
  }catch(e){}
  var isLiveNow = isToday && state==='working';

  // ── 본문: 근무 중이면 강조 블록, 아니면 요약 그리드 ──
  var body;
  if(isLiveNow){
    // 시간·수입 모두 공통 계산 함수(earn) 기준 — 다른 화면과 숫자 일치 (주간고정 9시 인정 정책 포함)
    var netH = earn ? earn.net : 0;
    var hh = Math.floor(netH), mm = Math.round((netH%1)*60);
    body = '<div style="background:var(--mn-good-soft);border-radius:var(--mn-r-sm);padding:12px;text-align:center;margin-bottom:2px;">'
      + '<div style="font-size:var(--font-sm);font-weight:800;color:var(--mn-success);">🟢 근무 중</div>'
      + '<div style="font-size:var(--font-lg);font-weight:800;color:var(--text);margin-top:3px;">'+hh+'시간 '+mm+'분</div>'
      + '<div style="font-size:var(--font-base);color:var(--mn-success);font-weight:700;margin-top:2px;">예상수입 '+_attV3Won(earn?earn.total:0)+'</div>'
      + '</div>';
  } else {
    var workStr = earn ? (earn.net+'시간') : '-';
    var incomeStr = earn ? _attV3Won(earn.total) : '-';
    body = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;font-size:var(--font-sm);color:var(--text2);">'
      + '<div>오늘 근무 <b style="color:var(--text);">'+workStr+'</b></div>'
      + '<div>오늘 수입 <b style="color:var(--mn-success);">'+incomeStr+'</b></div>'
      + '</div>';
  }

  // ── 출근/퇴근: 화면에서 가장 큰 액션 버튼 (오늘만) ──
  var btns = '';
  if(isToday){
    var act = isMain ? 'data-co-main="' : 'data-co-wp="';
    btns = '<div style="display:flex;gap:10px;margin-top:12px;">'
      + '<button '+act+'start|'+c.wpId+'|'+c.empId+'" class="mn-btn mn-btn--primary mn-btn--lg" style="flex:1;'+(state!=='idle'?'opacity:.3;pointer-events:none;':'')+'">☀️ 출근</button>'
      + '<button '+act+'end|'+c.wpId+'|'+c.empId+'" class="mn-btn mn-btn--secondary mn-btn--lg" style="flex:1;'+(state==='working'?'background:var(--mn-brand);color:#fff;border:none;':'')+(state!=='working'?'opacity:.3;pointer-events:none;':'')+'">🌙 퇴근</button>'
      + '</div>';
  }
  var badge = isMain
    ? '<span class="mn-badge mn-badge--main" style="margin-left:7px;">메인</span>'
    : '<span class="mn-badge mn-badge--sub" style="margin-left:7px;">보조</span>';
  // v3.9: ⚙️ 상시 노출 제거 — 카드 탭(버튼 제외)으로 수정 팝업 진입
  return '<div class="attv3-co-card mn-card'+(isLiveNow?' mn-card--good':'')+'" data-co-open="'+c.wpId+'|'+c.empId+'" style="cursor:pointer;">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">'
    + '<div style="font-size:var(--font-md);font-weight:800;color:var(--text);">'+(isMain?'🏢':'📦')+' '+c.name+badge+'</div>'
    + '<div class="mn-caption">'+rate.toLocaleString('ko-KR')+'원 · '+wtLbl+' <span style="opacity:.6;">›</span></div>'
    + '</div>'
    + body
    + btns
    + '</div>';
}

// 사업장 목록 전체 (2개 이상일 때 기록 카드 자리를 대체)
function _attV3CompanyListHtml(sel){
  try{
    if(typeof CompanyEngine==='undefined' || !CompanyEngine.isMulti()) return null;
    var h = '<div style="display:flex;justify-content:space-between;align-items:center;margin:2px 4px 8px;">'
      + '<span style="font-size:12px;font-weight:700;color:var(--text3,#999);">🏢 내 사업장</span>'
      + '<button id="attv3-co-manage" style="background:none;border:none;font-size:12px;font-weight:700;color:var(--accent,#4f7cff);cursor:pointer;padding:4px 6px;">관리 ›</button></div>';
    CompanyEngine.companies().forEach(function(c){
      h += _attV3CoCard(c, c.wpId===activeWpId, sel);
    });
    return h;
  }catch(e){ return null; }
}

// ══════════════════════════════════════════
// v3.3: 사업장 관리 팝업 — 순서 변경(↑↓) / 메인 변경 / 추가 / 삭제 / 수정
// CompanyEngine·계산 엔진 무변경: wpSave(순서)·switchEmployee(메인)·wpDelete(삭제) 등 기존 CRUD만 사용
// ══════════════════════════════════════════
function _attV3CompanyManagePopup(){
  var old = document.getElementById('attv3-comgr-overlay');
  if(old) old.remove();
  var ov = document.createElement('div');
  ov.id = 'attv3-comgr-overlay';
  ov.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.55);z-index:99990;display:flex;align-items:center;justify-content:center;padding:20px;';
  document.body.appendChild(ov);
  ov.addEventListener('click', function(e){ if(e.target===ov) ov.remove(); });

  function paint(){
    var cs = CompanyEngine.companies();
    var ico = 'background:none;border:1px solid var(--border,rgba(255,255,255,.15));border-radius:8px;color:var(--text2,#b8bdd4);cursor:pointer;font-size:13px;min-width:34px;min-height:34px;';
    var rows = '';
    cs.forEach(function(c, i){
      var isMain = c.wpId===activeWpId;
      rows += '<div style="display:flex;align-items:center;gap:8px;padding:10px 0;border-bottom:1px solid var(--border,rgba(255,255,255,.08));">'
        + '<div style="flex:1;min-width:0;">'
        + '<div style="font-size:14px;font-weight:800;color:var(--text,#eee);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+(isMain?'🏢':'📦')+' '+c.name
        + (isMain?' <span style="font-size:10px;background:var(--accent,#4f7cff);color:#fff;border-radius:5px;padding:1px 6px;">메인</span>':'')+'</div>'
        + '<div style="font-size:11px;color:var(--text3,#999);">시급 '+((c.emp.companyRate||0).toLocaleString('ko-KR'))+'원 · '+(_ATTV3_WT_LBL[c.emp.wt]||'주간')+'</div>'
        + '</div>'
        + '<button data-mg-up="'+i+'" style="'+ico+(i===0?'opacity:.3;pointer-events:none;':'')+'">↑</button>'
        + '<button data-mg-dn="'+i+'" style="'+ico+(i===cs.length-1?'opacity:.3;pointer-events:none;':'')+'">↓</button>'
        + '<button data-mg-edit="'+i+'" style="'+ico+'">✏️</button>'
        + (isMain
          ? '<button style="'+ico+'opacity:.3;pointer-events:none;">⭐</button>'
          : '<button data-mg-main="'+i+'" title="메인으로" style="'+ico+'">⭐</button>')
        + (cs.length>1 && !isMain
          ? '<button data-mg-del="'+i+'" style="'+ico+'color:var(--red,#ff5c7a);">🗑️</button>'
          : '<button style="'+ico+'opacity:.3;pointer-events:none;">🗑️</button>')
        + '</div>';
    });
    ov.innerHTML =
      '<div style="background:var(--surface,#1e2235);border-radius:16px;width:100%;max-width:460px;max-height:86vh;overflow-y:auto;padding:20px;box-sizing:border-box;">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">'
      + '<div style="font-size:17px;font-weight:800;color:var(--text,#eee);">🏢 사업장 관리</div>'
      + '<button id="comgr-close" style="background:none;border:none;font-size:18px;color:var(--text3,#999);cursor:pointer;min-width:40px;min-height:40px;">✕</button></div>'
      + '<div style="font-size:12px;color:var(--text3,#999);margin-bottom:8px;">↑↓ 순서 변경 · ⭐ 메인 지정 · ✏️ 수정 · 🗑️ 삭제 (메인은 삭제 불가 — 먼저 다른 사업장을 메인으로 지정)</div>'
      + rows
      + '<button id="comgr-add" style="width:100%;margin-top:14px;padding:12px 0;border-radius:12px;border:1px dashed var(--accent,#4f7cff);background:rgba(79,124,255,.08);color:var(--accent,#4f7cff);font-size:15px;font-weight:700;cursor:pointer;font-family:\'Noto Sans KR\',sans-serif;min-height:48px;">＋ 사업장 추가</button>'
      + '</div>';

    document.getElementById('comgr-close').addEventListener('click', function(){ ov.remove(); renderAttV3(); });
    // 순서 변경 (wpList 배열 순서 = 표시 순서)
    function move(i, dir){
      var list = wpList();
      var j = i + dir;
      if(j<0 || j>=list.length) return;
      var tmp = list[i]; list[i] = list[j]; list[j] = tmp;
      wpSave(list);
      paint();
    }
    ov.querySelectorAll('[data-mg-up]').forEach(function(b){ b.addEventListener('click', function(){ move(parseInt(b.getAttribute('data-mg-up')), -1); }); });
    ov.querySelectorAll('[data-mg-dn]').forEach(function(b){ b.addEventListener('click', function(){ move(parseInt(b.getAttribute('data-mg-dn')), +1); }); });
    // 메인 변경 — 기존 switchEmployee 재사용 (활성 사업장 영속화 포함)
    ov.querySelectorAll('[data-mg-main]').forEach(function(b){
      b.addEventListener('click', function(){
        var c = CompanyEngine.companies()[parseInt(b.getAttribute('data-mg-main'))];
        if(!c) return;
        switchEmployee(c.wpId, c.empId);
        if(typeof showToast==='function') showToast('⭐ '+c.name+'을(를) 메인 사업장으로 지정했습니다');
        paint();
      });
    });
    // 수정 — 기존 수정 팝업 재사용
    ov.querySelectorAll('[data-mg-edit]').forEach(function(b){
      b.addEventListener('click', function(){
        var c = CompanyEngine.companies()[parseInt(b.getAttribute('data-mg-edit'))];
        if(c) _attV3CompanyEditPopup(c.wpId, c.empId);
      });
    });
    // 삭제 — 근태/WorkSession/급여기록 함께 삭제됨을 확인 후 진행 (기존 wpDelete가 관련 키 정리)
    ov.querySelectorAll('[data-mg-del]').forEach(function(b){
      b.addEventListener('click', function(){
        var c = CompanyEngine.companies()[parseInt(b.getAttribute('data-mg-del'))];
        if(!c) return;
        var doDelete = function(){
          try{ localStorage.removeItem('atm2_workSession_'+c.wpId); }catch(e){}
          wpDelete(c.wpId);
          if(typeof showToast==='function') showToast('🗑️ '+c.name+' 사업장이 삭제되었습니다');
          paint();
        };
        var msg = '⚠️ "'+c.name+'" 사업장을 삭제할까요?\n\n이 사업장의 근태 기록, 진행 중 근무(Work Session), 급여 기록이 모두 삭제됩니다.\n이 작업은 되돌릴 수 없습니다.';
        if(typeof showCustomConfirm==='function') showCustomConfirm(msg, doDelete);
        else if(confirm(msg)) doDelete();
      });
    });
    // 추가
    document.getElementById('comgr-add').addEventListener('click', function(){
      var name = prompt('새 사업장 이름을 입력하세요', '');
      if(!name || !name.trim()) return;
      var co = CompanyEngine.ensureWorkplace(name.trim(), {});
      if(typeof showToast==='function') showToast('＋ '+name.trim()+' 사업장이 추가되었습니다');
      paint();
      _attV3CompanyEditPopup(co.wpId, co.empId);
    });
  }
  paint();
}

function _attV3BindCompanyListEvents(host){
  if(typeof CompanyEngine==='undefined') return;
  // 메인 사업장: 기존 Work Session 흐름 그대로 (_wsStart/_wsEnd)
  host.querySelectorAll('[data-co-main]').forEach(function(btn){
    btn.addEventListener('click', function(){
      var act = btn.getAttribute('data-co-main').split('|')[0];
      if(act==='start') _wsStart(_wsMainJob());
      else _wsEnd();
    });
  });
  // 보조 사업장: CompanyEngine
  host.querySelectorAll('[data-co-wp]').forEach(function(btn){
    btn.addEventListener('click', function(){
      var p = btn.getAttribute('data-co-wp').split('|');
      if(p[0]==='start'){ CompanyEngine.startWork(p[1], p[2]); if(typeof showToast==='function') showToast('☀️ 출근이 기록되었습니다'); }
      else { CompanyEngine.endWork(p[1], p[2]); if(typeof showToast==='function') showToast('🌙 퇴근이 기록되었습니다. 수고하셨어요!'); }
      renderAttV3();
    });
  });
  // v3.9: 카드 탭 → 사업장 수정 (출근/퇴근 버튼 클릭은 제외)
  host.querySelectorAll('[data-co-open]').forEach(function(card){
    card.addEventListener('click', function(e){
      if(e.target.closest('button')) return;
      var p = card.getAttribute('data-co-open').split('|');
      _attV3CompanyEditPopup(p[0], p[1]);
    });
  });
}

// ── 사업장 수정 팝업 (수정만 — 삭제 없음) ──
function _attV3CompanyEditPopup(wpId, empId){
  var wp = wpGet(wpId), emp = empGet(wpId, empId);
  if(!wp || !emp) return;
  var old = document.getElementById('attv3-coedit-overlay');
  if(old) old.remove();
  var inp = 'width:100%;box-sizing:border-box;padding:11px 12px;border-radius:10px;border:1px solid var(--border,rgba(255,255,255,.15));background:var(--bg,#161927);color:var(--text,#eee);font-size:15px;font-family:\'Noto Sans KR\',sans-serif;';
  var lbl = 'display:block;font-size:13px;font-weight:700;color:var(--text2,#b8bdd4);margin:12px 0 5px;';
  var wtOpts = ['day','night','3shift'].map(function(v){
    return '<option value="'+v+'"'+(emp.wt===v?' selected':'')+'>'+_ATTV3_WT_LBL[v]+'</option>';
  }).join('');
  var ov = document.createElement('div');
  ov.id = 'attv3-coedit-overlay';
  ov.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.55);z-index:99990;display:flex;align-items:center;justify-content:center;padding:20px;';
  ov.innerHTML =
    '<div style="background:var(--surface,#1e2235);border-radius:16px;width:100%;max-width:420px;max-height:86vh;overflow-y:auto;padding:20px;box-sizing:border-box;">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;">'
    + '<div style="font-size:17px;font-weight:800;color:var(--text,#eee);">⚙️ 사업장 수정</div>'
    + '<button id="coedit-close" style="background:none;border:none;font-size:18px;color:var(--text3,#999);cursor:pointer;min-width:40px;min-height:40px;">✕</button></div>'
    + '<label style="'+lbl+'">사업장명</label><input id="coedit-name" type="text" maxlength="20" value="'+(wp.name||'')+'" style="'+inp+'">'
    + '<label style="'+lbl+'">직업</label><input id="coedit-job" type="text" maxlength="20" value="'+(emp.jobTitle||'')+'" placeholder="예: 생산직, 물류" style="'+inp+'">'
    + '<label style="'+lbl+'">시급 (원)</label><input id="coedit-rate" type="number" min="0" step="10" value="'+(emp.companyRate||emp.hourlyRate||0)+'" style="'+inp+'">'
    + '<label style="'+lbl+'">근무형태</label><select id="coedit-wt" style="'+inp+'">'+wtOpts+'</select>'
    + '<label style="'+lbl+'">휴게시간 (시간)</label><input id="coedit-break" type="number" min="0" max="4" step="0.5" value="'+(emp.lunchBreak!==undefined?emp.lunchBreak:1)+'" style="'+inp+'">'
    + '<label style="'+lbl+'">급여일 (일)</label><input id="coedit-payday" type="number" min="1" max="31" value="'+(emp.payday||parseInt(localStorage.getItem('atm2_payday'))||'')+'" placeholder="예: 25" style="'+inp+'">'
    + '<button id="coedit-save" style="width:100%;margin-top:18px;padding:13px 0;border-radius:12px;border:none;background:var(--accent,#4f7cff);color:#fff;font-size:16px;font-weight:800;cursor:pointer;font-family:\'Noto Sans KR\',sans-serif;min-height:48px;">저장</button>'
    + '</div>';
  document.body.appendChild(ov);
  ov.addEventListener('click', function(e){ if(e.target===ov) ov.remove(); });
  document.getElementById('coedit-close').addEventListener('click', function(){ ov.remove(); });
  document.getElementById('coedit-save').addEventListener('click', function(){
    var name = document.getElementById('coedit-name').value.trim() || wp.name;
    var job = document.getElementById('coedit-job').value.trim();
    var rate = Math.max(0, parseInt(document.getElementById('coedit-rate').value)||0);
    var wtv = document.getElementById('coedit-wt').value;
    var brk = Math.max(0, parseFloat(document.getElementById('coedit-break').value)||0);
    var pdv = parseInt(document.getElementById('coedit-payday').value)||null;
    wpUpdate(wpId, { name: name });
    empUpdate(wpId, empId, { jobTitle: job, companyRate: rate, hourlyRate: rate, wt: wtv, lunchBreak: brk, payday: pdv });
    // 메인 사업장이면 전역 동기화 (+ 급여일은 앱 전역 D-day에 반영)
    if(wpId===activeWpId){
      try{ syncActiveEmpToGlobals(); }catch(e){}
      if(pdv>=1 && pdv<=31){
        try{ localStorage.setItem('atm2_payday', String(pdv)); }catch(e){}
        try{ if(typeof budgetState!=='undefined'){ budgetState.paydayDay = pdv; if(typeof budgetSave==='function') budgetSave(); } }catch(e){}
      }
    }
    ov.remove();
    if(typeof showToast==='function') showToast('✅ 사업장 정보가 저장되었습니다');
    renderAttV3();
  });
}

// ── 근무 기록 카드 (Hero 바로 아래, 항상 펼침) ──
function _attV3RecordCard(d){
  var rec = _attV3Rec(d);
  var nj = _attV3NjobDay(d);
  var isToday = _attV3IsToday(d);
  var jobs = _attV3Jobs();
  var hasEmp = jobs.indexOf('employee')>=0;
  var lines = [];

  if(hasEmp && rec && rec.status && rec.status!=='none'){
    if(rec.status==='leave') return { html:'<div style="font-size:14px;color:var(--text,#eee);">🌿 연차'+(rec.note?' · '+rec.note:'')+'</div>', hasRecord:true };
    if(rec.status==='half') return { html:'<div style="font-size:14px;color:var(--text,#eee);">🌗 반차</div>', hasRecord:true };
    if(rec.status==='absent') return { html:'<div style="font-size:14px;color:var(--text,#eee);">결근'+(rec.note?' · '+rec.note:'')+'</div>', hasRecord:true };

    var et = _wsTerms(hasEmp?'employee':'salary');
    var row1 = '';
    if(rec.start!==undefined) row1 += '<span>'+et.start+' <b>'+fmtTime(rec.start)+'</b></span>';
    if(rec.end!==undefined && rec.end!==null) row1 += '<span style="margin-left:20px;">'+et.end+' <b>'+fmtTime(rec.end)+'</b></span>';
    else if(isToday) row1 += '<span style="margin-left:20px;">'+et.end+' <b style="color:var(--accent,#4f7cff);">'+et.metric+' 중</b></span>';
    if(row1) lines.push('<div style="font-size:14px;color:var(--text,#eee);">'+row1+'</div>');

    if(rec.breakStart && rec.breakEnd) lines.push('<div style="font-size:12px;color:var(--text3,#999);">휴게 '+rec.breakStart+'~'+rec.breakEnd+'</div>');

    var e = _attV3DayEarnings(d);
    if(e && !e.isLive){
      var statusLabel = rec.status==='early'?'조퇴 · ':'';
      lines.push('<div style="font-size:12px;color:var(--text3,#999);">'+statusLabel+'실근무 '+e.net+'시간'+(e.ot>0?' · 연장 '+e.ot+'시간':'')+'</div>');
    }
    if(rec.shift){ var sl={A:'A조',B:'B조',C:'C조',day:'주간',night:'야간'}; lines.push('<div style="font-size:12px;color:var(--text3,#999);">'+(sl[rec.shift]||rec.shift)+'</div>'); }
    if(rec.note && rec.status!=='leave' && rec.status!=='absent') lines.push('<div style="font-size:12px;color:var(--text3,#999);">📝 '+rec.note+'</div>');
  }

  if(nj.any){
    if(lines.length) lines.push('<div style="border-top:1px solid var(--border,rgba(255,255,255,.1));margin:6px 0;"></div>');
    if(nj.deliveryN) lines.push('<div style="font-size:14px;color:var(--text,#eee);">🛵 배달 '+nj.deliveryCount+'건 · '+_attV3Won(nj.delivery)+'</div>');
    if(nj.albaN) lines.push('<div style="font-size:14px;color:var(--text,#eee);">⏰ 알바 '+nj.albaN+'건 · '+_attV3Won(nj.alba)+'</div>');
    if(nj.freeN) lines.push('<div style="font-size:14px;color:var(--text,#eee);">💻 작업 '+nj.freeN+'건 · '+_attV3Won(nj.free)+'</div>');
    if(nj.etcN) lines.push('<div style="font-size:14px;color:var(--text,#eee);">➕ 기타 '+nj.etcN+'건 · '+_attV3Won(nj.etc)+'</div>');
  }

  // Work Session 진행 중이면 경과시간 표시 (기존 기록보다 우선)
  var ws = _wsActive();
  if(ws && isToday){
    var t = _wsTerms(ws.jobType);
    return { html:
      '<div style="text-align:center;padding:8px 0;">'
      + '<div style="font-size:13px;color:var(--accent,#4f7cff);font-weight:700;margin-bottom:4px;">'+t.startIcon+' '+t.start+' '+fmtTime(ws.startH)+'</div>'
      + '<div id="attv3-ws-timer" style="font-size:24px;font-weight:900;color:var(--text,#eee);margin-bottom:8px;">'+_wsElapsedStr()+' 경과</div>'
      + '<button id="attv3-ws-end" style="padding:14px 32px;border-radius:14px;border:none;background:var(--red,#ff5c7a);color:#fff;font-size:16px;font-weight:800;cursor:pointer;font-family:\'Noto Sans KR\',sans-serif;min-height:48px;">'
      + t.endIcon+' '+t.end+'</button>'
      + '</div>', hasRecord:false, isSession:true };
  }

  if(!lines.length){
    var isPast = d < _attV3Today();
    var isFuture = !isToday && !isPast;
    var mj = _wsMainJob();
    var t = _wsTerms(mj);
    var ctaLabel, ctaIcon, ctaSub;
    if(isToday){ ctaIcon=t.startIcon; ctaLabel=t.action; ctaSub='오늘 '+t.start+'을 기록해볼까요?'; }
    else if(isPast){ ctaIcon='✏️'; ctaLabel=t.pastAction; ctaSub='기록하면 '+t.income+'에 바로 반영돼요'; }
    else { ctaIcon='📝'; ctaLabel=t.futureAction; ctaSub='연차나 일정을 미리 적어둘 수 있어요'; }
    return { html:
      '<div style="text-align:center;padding:8px 0;">'
      + '<div style="font-size:13px;color:var(--text3,#999);margin-bottom:10px;">'+ctaSub+'</div>'
      + '<button id="attv3-record-cta" style="padding:14px 32px;border-radius:14px;border:none;background:var(--accent,#4f7cff);color:#fff;font-size:16px;font-weight:800;cursor:pointer;font-family:\'Noto Sans KR\',sans-serif;min-height:48px;">'
      + ctaIcon+' '+ctaLabel+'</button>'
      + '</div>', hasRecord:false };
  }

  lines.push('<div style="text-align:right;margin-top:4px;"><button id="attv3-record-edit" style="background:none;border:none;color:var(--accent,#4f7cff);font-size:12px;font-weight:700;cursor:pointer;padding:4px 0;font-family:\'Noto Sans KR\',sans-serif;">✏️ 수정</button></div>');
  return { html: lines.join(''), hasRecord:true };
}

// ── 미니 월 달력 (컴팩트, 탐색용) ──
function _attV3MiniCal(sel){
  var y = sel.getFullYear(), m = sel.getMonth();
  var first = new Date(y,m,1).getDay();
  var dim = new Date(y,m+1,0).getDate();
  var today = _attV3Today();
  var h = '<div id="attv3-minicalpanel" style="cursor:pointer;">';
  h += '<div style="display:flex;align-items:center;justify-content:space-between;padding:0 2px 4px;">'
     + '<span style="font-size:11px;font-weight:700;color:var(--text3,#999);">📅 '+(m+1)+'월 전체 보기</span>'
     + '<span style="font-size:12px;color:var(--accent,#4f7cff);">▸</span></div>';
  // v1.1: 상태 범례 (PC 사이드바 달력 상단)
  if(typeof mnAttLegendHtml==='function') h += mnAttLegendHtml();
  h += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:0;text-align:center;">';
  for(var b=0;b<first;b++) h += '<div></div>';
  for(var d=1;d<=dim;d++){
    var dd = new Date(y,m,d);
    var isT = dd.getTime()===today.getTime();
    var isSel = dd.getTime()===sel.getTime();
    var has = _attV3HasAny(dd);
    var rec = _attV3Rec(dd);
    var isLeave = rec && (rec.status==='leave'||rec.status==='half');
    // v3.9.1: 근태 상태 색상 시스템 — 전 화면 공용 맵(mnAttColor)
    var dotC = (typeof mnAttColor==='function' && rec) ? (mnAttColor(rec)||'transparent') : 'transparent';
    if(dotC==='transparent' && has) dotC = 'var(--mn-att-work, var(--green,#3dd68c))';
    if(dotC==='transparent' && dd<today) dotC = 'var(--border,rgba(255,255,255,.15))';
    var bg = 'transparent';
    if(isT) bg = 'var(--accent,#4f7cff)';
    else if(isSel) bg = 'rgba(79,124,255,.25)';
    h += '<div data-attv3-calday="'+y+'-'+m+'-'+d+'" style="padding:1px 0;line-height:1;text-align:center;cursor:pointer;">'
       + '<span class="attv3-mcday" style="font-size:8px;width:14px;height:14px;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;background:'+bg+';color:'+(isT?'#fff':'var(--text3,#999)')+';">'+d+'</span>'
       + (dotC!=='transparent'?'<div class="attv3-mcdot" style="width:3px;height:3px;border-radius:50%;background:'+dotC+';margin:0 auto;"></div>':'')
       + '</div>';
  }
  h += '</div></div>';
  return h;
}

// ── 풀 캘린더 팝업 (미니 달력 터치 시 확대) ──
function _attV3FullCalPopup(sel){
  var existing = document.getElementById('attv3-fullcal-overlay');
  if(existing) existing.remove();
  var y = sel.getFullYear(), m = sel.getMonth();
  var first = new Date(y,m,1).getDay();
  var dim = new Date(y,m+1,0).getDate();
  var today = _attV3Today();
  var WD = ['일','월','화','수','목','금','토'];

  var h = '<div style="display:flex;justify-content:space-between;align-items:center;padding:0 4px 12px;">';
  h += '<button id="attv3-fc-prev" style="background:none;border:none;font-size:18px;color:var(--text,#eee);cursor:pointer;padding:8px 12px;min-width:44px;min-height:44px;">◀</button>';
  h += '<span style="font-size:16px;font-weight:800;color:var(--text,#eee);">'+y+'년 '+(m+1)+'월</span>';
  h += '<button id="attv3-fc-next" style="background:none;border:none;font-size:18px;color:var(--text,#eee);cursor:pointer;padding:8px 12px;min-width:44px;min-height:44px;">▶</button>';
  h += '</div>';
  h += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;text-align:center;">';
  for(var w=0;w<7;w++) h += '<div style="font-size:12px;color:var(--text3,#999);padding:4px 0;font-weight:600;">'+WD[w]+'</div>';
  for(var b=0;b<first;b++) h += '<div></div>';
  for(var d=1;d<=dim;d++){
    var dd = new Date(y,m,d);
    var isT = dd.getTime()===today.getTime();
    var isSel = dd.getTime()===sel.getTime();
    var has = _attV3HasAny(dd);
    var rec = _attV3Rec(dd);
    // v1.1: 색 + 아이콘 이중 표기 (색맹·흑백 대응) — 공용 상태 시스템 단일 경로
    var dot = '';
    var stKey = (typeof mnAttStatusKey==='function') ? mnAttStatusKey(rec) : null;
    if(stKey){
      dot = '<div style="font-size:9px;line-height:1;margin-top:2px;color:'+MN_ATT_COLORS[stKey]+';">'
        + MN_ATT_ICONS[stKey]
        + '<span class="mn-att-cell-txt" style="font-size:9px;font-weight:700;margin-left:1px;">'+MN_ATT_LABELS[stKey]+'</span></div>';
    }
    else if(has) dot = '<div style="width:5px;height:5px;border-radius:50%;background:var(--mn-att-work);margin:2px auto 0;"></div>';
    else if(dd<today) dot = '<div style="width:5px;height:5px;border-radius:50%;background:var(--border,rgba(255,255,255,.15));margin:2px auto 0;"></div>';
    else dot = '<div style="height:11px;"></div>';
    var numSt = '';
    if(isT) numSt = 'background:var(--accent,#4f7cff);color:#fff;border-radius:50%;width:32px;height:32px;display:inline-flex;align-items:center;justify-content:center;font-weight:800;';
    else if(isSel) numSt = 'border:2px solid var(--accent,#4f7cff);border-radius:50%;width:32px;height:32px;display:inline-flex;align-items:center;justify-content:center;font-weight:700;color:var(--text,#eee);';
    else numSt = 'color:var(--text,#eee);display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;';
    h += '<div data-attv3-fc="'+y+'-'+m+'-'+d+'" style="padding:2px 0;cursor:pointer;"><span style="font-size:14px;'+numSt+'">'+d+'</span>'+dot+'</div>';
  }
  h += '</div>';
  // v1.1: 상태 범례 — 처음 봐도 색·아이콘 의미를 바로 이해
  if(typeof mnAttLegendHtml==='function') h += mnAttLegendHtml();

  var overlay = document.createElement('div');
  overlay.id = 'attv3-fullcal-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:flex-end;justify-content:center;';
  var sheet = document.createElement('div');
  sheet.style.cssText = 'background:var(--bg,#181a20);border-radius:20px 20px 0 0;padding:20px 16px 32px;width:100%;max-width:420px;max-height:70vh;overflow-y:auto;';
  sheet.innerHTML = '<div style="width:36px;height:4px;border-radius:2px;background:var(--border,rgba(255,255,255,.2));margin:0 auto 16px;"></div>' + h;
  overlay.appendChild(sheet);
  document.body.appendChild(overlay);

  overlay.addEventListener('click', function(e){ if(e.target===overlay) overlay.remove(); });
  sheet.querySelectorAll('[data-attv3-fc]').forEach(function(cell){
    cell.addEventListener('click', function(){
      var p = cell.getAttribute('data-attv3-fc').split('-');
      overlay.remove();
      _attV3Select(new Date(+p[0],+p[1],+p[2]));
    });
  });
  var prev = document.getElementById('attv3-fc-prev');
  var next = document.getElementById('attv3-fc-next');
  if(prev) prev.addEventListener('click', function(e){ e.stopPropagation(); overlay.remove(); _attV3FullCalPopup(new Date(y,m-1,1)); });
  if(next) next.addEventListener('click', function(e){ e.stopPropagation(); overlay.remove(); _attV3FullCalPopup(new Date(y,m+1,1)); });
}

// ── 생존 스냅샷/카드 ──
function _attV3Survival(){
  var out = { ready:false };
  try{
    if(typeof calcZeroBalanceDate!=='function') return out;
    var z = calcZeroBalanceDate();
    out.z = z;
    out.ready = !!(z && z.riskLevel!=='nodata' && z.varTotal>0);
    out.dday = _attV3Dday();
  }catch(e){}
  return out;
}

// ══════════════════════════════════════════
// 렌더
// ══════════════════════════════════════════
function renderAttV3(){
  _wsCheckStale();
  var page = document.getElementById('att-page');
  if(!page) return;
  var host = document.getElementById('att-v3');
  if(!host){
    host = document.createElement('div');
    host.id = 'att-v3';
    page.insertBefore(host, page.firstChild);
  }
  var calArea = document.getElementById('cal-area');
  var todayPanel = document.getElementById('today-panel');
  if(calArea) calArea.style.display = 'none';
  if(todayPanel) todayPanel.style.display = 'none';
  host.style.display = 'block';

  var jobs = _attV3Jobs();
  var hasEmp = jobs.indexOf('employee')>=0;
  var sel = _attV3SelDate();
  var today = _attV3Today();
  var WD = ['일','월','화','수','목','금','토'];

  // ── 주간 스트립 ──
  var weekStart = new Date(sel); weekStart.setDate(sel.getDate() - sel.getDay());
  var weekNo = Math.floor((sel.getDate() + new Date(sel.getFullYear(),sel.getMonth(),1).getDay() - 1)/7)+1;
  var weekLabel = sel.getFullYear()+'년 '+(sel.getMonth()+1)+'월 '+['첫째','둘째','셋째','넷째','다섯째','여섯째'][weekNo-1]+'주';

  // 미기록 표시 자격: 시급제 + 최근 14일 안에 기록이 1개라도 있는 사용자만, 최대 2개
  // (기록이 아예 없는 신규 사용자에게 빚 목록처럼 보이지 않도록)
  var missedBudget = 0;
  if(hasEmp){
    var anyRecent = false;
    for(var b=1;b<=14;b++){
      var bd = new Date(today); bd.setDate(today.getDate()-b);
      if(_attV3HasAny(bd)){ anyRecent = true; break; }
    }
    if(anyRecent) missedBudget = 2;
  }

  var stripCells = '';
  for(var i=6;i>=0;i--){} // (역순 스캔용 자리 — 아래에서 정방향 생성, 미기록은 최근일 우선)
  var missedFlags = {};
  if(missedBudget > 0){
    for(var mb=1; mb<=7 && missedBudget>0; mb++){
      var md = new Date(today); md.setDate(today.getDate()-mb);
      if(md < weekStart) break;
      if(md.getDay()===0 || md.getDay()===6) continue;
      if(!_attV3HasAny(md)){ missedFlags[_attV3Key(md)] = true; missedBudget--; }
    }
  }
  for(var i=0;i<7;i++){
    var d = new Date(weekStart); d.setDate(weekStart.getDate()+i);
    var has = _attV3HasAny(d);
    var isT = _attV3IsToday(d);
    var isSel = d.getTime()===sel.getTime();
    var missed = !!missedFlags[_attV3Key(d)];
    var numStyle;
    if(isT){
      numStyle = 'width:34px;height:34px;margin:0 auto;border-radius:50%;background:var(--accent,#4f7cff);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;';
    } else {
      numStyle = 'width:34px;height:34px;margin:0 auto;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:600;color:'
        + (d.getMonth()!==sel.getMonth() ? 'var(--text3,#777)' : 'var(--text,#eee)') + ';'
        + (isSel ? 'border:2px solid var(--accent,#4f7cff);' : '');
    }
    var rec = _attV3Rec(d);
    // v3.9.1: 근태 상태 색상 시스템 — 전 화면 공용 맵 / v1.1: 색+아이콘 이중 표기
    var stKey0 = (typeof mnAttStatusKey==='function') ? mnAttStatusKey(rec) : null;
    var under = has
      ? (stKey0
          ? '<div style="font-size:8px;line-height:1;margin-top:2px;color:'+MN_ATT_COLORS[stKey0]+';">'+MN_ATT_ICONS[stKey0]+'</div>'
          : '<div style="width:5px;height:5px;border-radius:50%;background:var(--mn-att-work);margin:3px auto 0;"></div>')
      : (missed ? '<div style="font-size:9px;color:var(--yellow,#ffd166);font-weight:700;margin-top:1px;">기록?</div>'
                : '<div style="height:8px;"></div>');
    stripCells += '<div data-attv3-day="'+d.getFullYear()+'-'+d.getMonth()+'-'+d.getDate()+'" style="cursor:pointer;text-align:center;padding:2px 0;">'
      + '<div style="font-size:11px;color:'+(i===0?'var(--red,#ff5c7a)':(i===6?'var(--accent,#4f7cff)':'var(--text3,#999)'))+';margin-bottom:3px;">'+WD[i]+'</div>'
      + '<div style="'+numStyle+'">'+d.getDate()+'</div>'+under+'</div>';
  }

  // ── Hero Number ──
  var hero = _attV3HeroNumber(sel);
  var selLabel = (sel.getMonth()+1)+'월 '+sel.getDate()+'일 ('+WD[sel.getDay()]+')'+(_attV3IsToday(sel)?' · 오늘':'');
  var heroHtml;
  if(hero.amount !== null){
    heroHtml = '<div style="font-size:13px;color:var(--text3,#999);font-weight:600;">'+selLabel+(hero.label?' · '+hero.label:'')+'</div>'
      + '<div style="font-size:36px;font-weight:900;color:var(--text,#eee);letter-spacing:-1px;margin:4px 0 2px;'+'">'+_attV3Won(hero.amount)+'</div>'
      + (hero.sub ? '<div style="font-size:12px;color:var(--text3,#999);">'+hero.sub+'</div>' : '');
  } else if(hero.label){
    heroHtml = '<div style="font-size:13px;color:var(--text3,#999);font-weight:600;">'+selLabel+'</div>'
      + '<div style="font-size:28px;font-weight:800;color:var(--text,#eee);margin:4px 0 2px;">'+hero.label+'</div>'
      + (hero.sub ? '<div style="font-size:12px;color:var(--text3,#999);">'+hero.sub+'</div>' : '');
  } else {
    heroHtml = '<div style="font-size:13px;color:var(--text3,#999);font-weight:600;">'+selLabel+'</div>'
      + '<div style="font-size:14px;color:var(--text3,#999);margin-top:6px;line-height:1.5;">'+hero.sub+'</div>';
  }

  // ── 근무 기록 카드 ──
  var recCard = _attV3RecordCard(sel);

  // ── 브리핑 ──
  var br = _attV3Briefing(sel);

  // ── 생존 카드 ──
  var sv = _attV3Survival();
  var svHtml;
  if(sv.ready){
    var pctLeft = Math.max(0, Math.min(100, 100 - sv.z.spentPct));
    var barColor = sv.z.riskLevel==='safe' ? 'var(--green,#3dd68c)' : (sv.z.riskLevel==='warning' ? 'var(--yellow,#ffd166)' : 'var(--red,#ff5c7a)');
    svHtml =
      '<div style="display:flex;justify-content:space-between;font-size:13px;color:var(--text3,#aaa);margin-bottom:6px;">'
      + '<span>'+(sv.dday!==null && sv.dday!==undefined ? '월급날까지 <b style="color:var(--text,#eee);">D-'+sv.dday+'</b>' : '이번 달 생존 상태')+'</span>'
      + '<span>'+sv.z.riskLabel+'</span></div>'
      + '<div style="height:8px;border-radius:4px;background:var(--border,rgba(255,255,255,.12));overflow:hidden;">'
      + '<div id="attv3-gauge-bar" style="width:'+pctLeft+'%;height:100%;background:'+barColor+';transition:width .6s ease;"></div></div>'
      + '<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text3,#999);margin-top:6px;">'
      + '<span>예산 잔여 '+pctLeft+'%</span>'
      + '<span>잔고 소진 예상: '+sv.z.date+'</span></div>'
      + '<div id="attv3-delta" style="display:none;font-size:13px;color:var(--green,#3dd68c);font-weight:700;margin-top:8px;line-height:1.5;"></div>';
  } else {
    svHtml = '<div style="display:flex;gap:10px;align-items:flex-start;">'
      + '<span style="font-size:20px;flex-shrink:0;">😺</span>'
      + '<div style="font-size:13px;color:var(--text3,#aaa);line-height:1.6;">지출을 알려주시면, 오늘 번 돈으로 <b style="color:var(--text,#eee);">이번 달을 버틸 수 있는지</b>까지 제가 계산해드릴게요.</div></div>'
      + '<button id="attv3-goto-budget" style="width:100%;margin-top:10px;padding:11px;border-radius:10px;min-height:44px;border:1px solid var(--accent,#4f7cff);background:rgba(79,124,255,.08);color:var(--accent,#4f7cff);font-size:14px;font-weight:700;cursor:pointer;font-family:\'Noto Sans KR\',sans-serif;">🛡️ 1분 만에 지출 입력하기</button>';
  }

  // ── 미니 월 달력 ──
  var miniCalHtml = _attV3MiniCal(sel);

  // ── 빅버튼 (근무 중=퇴근 버튼만 유지) ──
  var viewingToday = _attV3IsToday(sel);
  var todayRec = _attV3Rec(today);
  var showBigBtn = false, btnMode='', btnLabel='';
  if(hasEmp && viewingToday && !_wsActive() && todayRec && todayRec.start!==undefined && (todayRec.end===undefined || todayRec.end===null)
     && ['work','early','sat_work','sun_work','holiday'].indexOf(todayRec.status||'')>=0){
    showBigBtn = true; btnMode='out'; btnLabel='🌙 퇴근 완료';
  }

  host.innerHTML =
    '<div class="attv3-wrap" style="margin:0 auto;padding:0 12px;">'
    // ① 주간 라벨
    + '<div style="display:flex;align-items:center;justify-content:center;gap:4px;padding:2px 0 4px;">'
    + '<span style="font-size:14px;font-weight:800;color:var(--text,#eee);">'+weekLabel+'</span>'
    + '<span onclick="if(typeof showHelpPopup===\'function\')showHelpPopup(\'att\')" style="display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:50%;background:rgba(79,124,255,.12);color:var(--accent,#4f7cff);font-size:14px;font-weight:800;cursor:pointer;margin-left:4px;">?</span>'
    + '</div>'
    // ② 주간 스트립 + ◀▶
    + '<div style="display:flex;align-items:center;gap:0;">'
    + '<button id="attv3-week-prev" style="background:none;border:none;color:var(--text3,#999);font-size:16px;cursor:pointer;padding:8px;min-width:44px;min-height:44px;">◀</button>'
    + '<div id="attv3-strip" style="flex:1;display:grid;grid-template-columns:repeat(7,1fr);gap:2px;padding:0 2px;">'+stripCells+'</div>'
    + '<button id="attv3-week-next" style="background:none;border:none;color:var(--text3,#999);font-size:16px;cursor:pointer;padding:8px;min-width:44px;min-height:44px;">▶</button>'
    + '</div>'
    + '<div id="attv3-swipe">'
    // v3.9: 근태 Hero — 홈과 이어지는 캐릭터 안내 (같은 AI가 계속 안내)
    + _attV3CharHero(sel)
    // v2.9: SAO Initiative Engine — 오늘의 한마디 (홈과 동일 엔진)
    + ((typeof SaoInitiativeEngine!=='undefined') ? SaoInitiativeEngine.bannerHtml() : '')
    // ③ Hero Number (전체 폭, 배경 카드)
    + '<div class="attv3-hero" style="text-align:center;padding:16px 0 14px;background:var(--surface,#1e2235);border:1px solid var(--border,rgba(255,255,255,.1));border-radius:var(--radius,12px);margin-bottom:10px;">'+heroHtml+'</div>'
    // ④ PC 2열 본문: 좌=달력, 우=카드들
    + '<div class="attv3-body">'
    // 좌측: 월 달력
    + '<div class="attv3-cal-col" style="background:var(--surface,#1e2235);border:1px solid var(--border,rgba(255,255,255,.1));border-radius:var(--radius,12px);padding:6px 10px 4px;">'
    + miniCalHtml
    // 모바일 전용: 미니 달력 대신 전체 달력 버튼 (CSS로 표시 전환)
    + '<button id="attv3-open-fullcal" class="attv3-fullcal-btn" style="display:none;width:100%;padding:13px 0;border-radius:10px;border:1px solid var(--accent,#4f7cff);background:rgba(79,124,255,.08);color:var(--accent,#4f7cff);font-size:15px;font-weight:700;cursor:pointer;font-family:\'Noto Sans KR\',sans-serif;min-height:48px;">📅 '+(sel.getMonth()+1)+'월 전체 달력 보기</button>'
    + '</div>'
    // 우측: CTA → 기록 → 브리핑 → 생존
    + '<div class="attv3-cards-col">'
    // v3.1: 사업장 2개 이상이면 기록 카드 대신 동일 레벨 사업장 목록 카드
    + (_attV3CompanyListHtml(sel) !== null
        ? _attV3CompanyListHtml(sel)
        : '<div id="attv3-record" style="background:var(--surface,#1e2235);border:1px solid var(--border,rgba(255,255,255,.1));border-radius:var(--radius,12px);padding:12px 14px;margin-bottom:10px;'
          + (!recCard.hasRecord?'border-style:dashed;':'')+'">'+recCard.html+'</div>'
          // v3.3: 단일 사업장에서도 언제든 추가/관리 가능
          + ((typeof CompanyEngine!=='undefined' && _attV3Jobs().indexOf('employee')>=0)
             ? '<div style="text-align:right;margin:-4px 4px 8px;"><button id="attv3-co-manage" style="background:none;border:none;font-size:12px;color:var(--text3,#999);cursor:pointer;padding:4px 6px;">＋ 사업장 추가·관리</button></div>'
             : ''))
    // v4.2.2-beta.8 (디자인 시안 5a): 퇴근 후 다른 일 바로 추가
    + _attV3AddJobBtnHtml(sel)
    + '<div id="attv3-brief" style="display:flex;gap:10px;align-items:center;padding:0 4px 10px;">'
    + '<div style="width:32px;height:32px;border-radius:50%;background:rgba(79,124,255,.14);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;overflow:hidden;">'+_attV3BriefAvatar(br)+'</div>'
    + '<div style="font-size:13px;line-height:1.5;color:var(--text3,#aaa);">'+br.text+'</div>'
    + '</div>'
    + '<div id="attv3-survival" style="background:var(--surface,#1e2235);border:1px solid var(--border,rgba(255,255,255,.1));border-radius:var(--radius,12px);padding:12px 14px;'+(sv.ready?'cursor:pointer;':'')+'">'+svHtml+'</div>'
    + '</div>'
    + '</div>'
    + '</div>'
    // ⑧ 퇴근 버튼 (근무 중일 때만)
    + (showBigBtn ? '<div style="padding:0 0 8px;"><button id="attv3-big" style="width:100%;padding:16px 0;border-radius:14px;border:none;background:var(--accent,#4f7cff);color:#fff;font-size:18px;font-weight:800;cursor:pointer;font-family:\'Noto Sans KR\',sans-serif;min-height:52px;">'+btnLabel+'</button></div>' : '')
    + '</div>';

  // ── 이벤트 ──
  _attV3BindCompanyListEvents(host);   // v3.1: 사업장 목록 출근/퇴근/수정
  // v3.3: 사업장 관리 팝업 진입
  var coManage = document.getElementById('attv3-co-manage');
  if(coManage) coManage.addEventListener('click', function(){ _attV3CompanyManagePopup(); });
  // v4.2.2-beta.8 (시안 5a): 퇴근 후 "오늘 다른 일 추가" → 기존 사업장 관리 팝업 재사용
  var addJob = document.getElementById('attv3-add-job');
  if(addJob) addJob.addEventListener('click', function(){
    if(typeof _attV3CompanyManagePopup==='function') _attV3CompanyManagePopup();
    else if(typeof openAddWpModal==='function') openAddWpModal();
  });
  host.querySelectorAll('[data-attv3-day]').forEach(function(cell){
    cell.addEventListener('click', function(){
      var p = cell.getAttribute('data-attv3-day').split('-');
      _attV3Select(new Date(+p[0], +p[1], +p[2]));
    });
  });
  // 주간 스트립 ◀▶
  var wprev = document.getElementById('attv3-week-prev');
  var wnext = document.getElementById('attv3-week-next');
  if(wprev) wprev.addEventListener('click', function(){
    var d = new Date(sel); d.setDate(d.getDate()-7); _attV3Select(d);
  });
  if(wnext) wnext.addEventListener('click', function(){
    var d = new Date(sel); d.setDate(d.getDate()+7); _attV3Select(d);
  });
  // 미니 달력 터치 → 풀 캘린더 팝업
  var mcPanel = document.getElementById('attv3-minicalpanel');
  if(mcPanel){
    var isPC = window.innerWidth >= 768;
    if(isPC){
      mcPanel.querySelectorAll('[data-attv3-calday]').forEach(function(cell){
        cell.addEventListener('click', function(e){
          e.stopPropagation();
          var p = cell.getAttribute('data-attv3-calday').split('-');
          _attV3Select(new Date(+p[0], +p[1], +p[2]));
        });
      });
    } else {
      mcPanel.addEventListener('click', function(){ _attV3FullCalPopup(sel); });
    }
  }
  // 모바일 전체 달력 버튼 → 기존 풀 캘린더 팝업 재사용
  var fullCalBtn = document.getElementById('attv3-open-fullcal');
  if(fullCalBtn) fullCalBtn.addEventListener('click', function(){ _attV3FullCalPopup(sel); });
  // 기록 카드 CTA / 수정 링크 / 세션 종료
  var recCta = document.getElementById('attv3-record-cta');
  if(recCta) recCta.addEventListener('click', function(){
    if(_attV3IsToday(sel)){ _wsStart(_wsMainJob()); }
    else { _attV3OpenEditor(sel); }
  });
  var wsEndBtn = document.getElementById('attv3-ws-end');
  if(wsEndBtn) wsEndBtn.addEventListener('click', function(){ _wsEnd(); });
  var recEdit = document.getElementById('attv3-record-edit');
  if(recEdit) recEdit.addEventListener('click', function(){ _attV3OpenEditor(sel); });
  // 생존 카드
  var gotoBudget = document.getElementById('attv3-goto-budget');
  if(gotoBudget) gotoBudget.addEventListener('click', function(e){
    e.stopPropagation();
    if(typeof showPage==='function'){ showPage('budget'); if(typeof setMobActive==='function') setMobActive('budget'); }
  });
  var svEl = document.getElementById('attv3-survival');
  if(svEl && sv.ready) svEl.addEventListener('click', function(){
    if(typeof showPage==='function'){ showPage('budget'); if(typeof setMobActive==='function') setMobActive('budget'); }
  });
  // 퇴근 버튼 (근무 중일 때만 표시)
  var big = document.getElementById('attv3-big');
  if(big && showBigBtn) big.addEventListener('click', function(){ _attV3BigAction(btnMode); });

  _attV3BindSwipe();

  // Work Session 경과시간 라이브 업데이트
  if(_wsActive()){
    clearInterval(window._attV3WsTimer);
    window._attV3WsTimer = setInterval(function(){
      var el = document.getElementById('attv3-ws-timer');
      if(el) el.textContent = _wsElapsedStr()+' 경과';
      else clearInterval(window._attV3WsTimer);
    }, 30000);
  }

  if(viewingToday && (btnMode==='out' || _wsActive())){
    clearTimeout(window._attV3LiveTimer);
    window._attV3LiveTimer = setTimeout(function(){
      if(document.getElementById('att-v3') && document.getElementById('att-page').style.display!=='none') renderAttV3();
    }, 60000);
  }
}

// ── 날짜 선택 (월 경계 시 전역 월 데이터 로드 — changeMonth와 동일 절차) ──
function _attV3Select(d){
  if(typeof curY!=='undefined' && (d.getFullYear()!==curY || d.getMonth()!==curM)){
    try{
      if(typeof activeWpId!=='undefined' && activeWpId && activeEmpId && typeof attSaveMonth==='function')
        attSaveMonth(activeWpId, activeEmpId, curY, curM, dayData);
      curY = d.getFullYear(); curM = d.getMonth();
      if(typeof lsLoadMonth==='function') lsLoadMonth(curY, curM);
      attV3InvalidateCache();
    }catch(e){}
  }
  _attV3Sel = d;
  _attV3DetailOpen = false;
  renderAttV3();
}

// ── 빅버튼 동작 ──
function _attV3BigAction(mode){
  var today = _attV3Today();
  var key = _attV3Key(today);
  var now = new Date();
  var nowH = Math.round((now.getHours()+now.getMinutes()/60)*4)/4; // 15분 단위

  if(mode==='in'){
    if(!_attV3IsToday(_attV3SelDate())) _attV3Select(today);
    dayData[key] = { status:'work', start: nowH, note:'' };
    _attV3Persist();
    if(typeof showToast==='function') showToast('☀️ 출근 '+fmtTime(nowH)+' — 오늘도 화이팅이에요!');
    renderAttV3();
    return;
  }
  if(mode==='out'){
    var rec = dayData[key];
    if(!rec){ renderAttV3(); return; }
    _attV3SurvSnap = _attV3SurvSnapshot();  // 기록 전 생존 상태
    rec.end = nowH;
    _attV3Persist();
    renderAttV3();
    _attV3CelebrateSurvival(today);
    return;
  }
  _attV3OpenEditor(_attV3SelDate());
}

// ── 엔진별 기존 기록 팝업 열기 (레거시 입력 UI 재사용) ──
function _attV3OpenEditor(d){
  if(typeof curY!=='undefined' && (d.getFullYear()!==curY || d.getMonth()!==curM)) _attV3Select(d);
  var key = _attV3Key(d);
  var jobs = _attV3Jobs();
  var hasEmp = jobs.indexOf('employee')>=0;
  var hasDel = jobs.some(function(j){ return j==='delivery'||j==='driver'; });
  var hasAl = jobs.some(function(j){ return j==='convenience'||j==='shortAlba'; });
  var hasFr = jobs.indexOf('freelancer')>=0;
  var hasEtc = jobs.indexOf('etc')>=0;

  if(hasEmp || jobs.indexOf('salary')>=0){
    if(typeof openPopup==='function'){ openPopup(key, d.getDate()); return; }
  }
  if(hasFr && !hasDel && !hasAl && !hasEtc){
    if(typeof openFlPopup==='function'){ openFlPopup(key, d.getDate()); return; }
  }
  if(hasEtc && !hasDel && !hasAl && !hasFr){
    if(typeof openEtcDayPopup==='function'){ openEtcDayPopup(key, d.getDate()); return; }
  }
  if(typeof openAlbaPopup==='function'){ openAlbaPopup(key, d.getDate()); return; }
  if(typeof openPopup==='function') openPopup(key, d.getDate());
}

// ── 저장 공통 (기존 저장 경로만 사용) ──
function _attV3Persist(){
  try{ if(typeof lsSave==='function') lsSave(); }catch(e){}
  try{
    if(typeof attSaveMonth==='function' && typeof activeWpId!=='undefined' && activeWpId && activeEmpId)
      attSaveMonth(activeWpId, activeEmpId, curY, curM, dayData);
  }catch(e){}
  attV3InvalidateCache();
  try{ if(typeof updateTodayPanel==='function') updateTodayPanel(); }catch(e){}
}

// ── 생존 스냅샷 (기록 전/후 비교용) ──
function _attV3SurvSnapshot(){
  try{
    if(typeof calcZeroBalanceDate!=='function') return null;
    var z = calcZeroBalanceDate();
    return { daysLeft: z.daysLeft, date: z.date, avail: z.availableBudget, spentPct: z.spentPct, nodata: (z.riskLevel==='nodata'||!z.varTotal) };
  }catch(e){ return null; }
}

// ── 퇴근 순간: 수입 카운트업 + "생존이 좋아졌다" 델타 (고양이 화법, 하루 1회) ──
function _attV3CelebrateSurvival(d){
  var e = _attV3DayEarnings(d);
  var earned = e ? e.total : _attV3NjobDay(d).total;
  // 금액 카운트업 (결과 표시)
  var el = document.getElementById('attv3-earn-num');
  if(el && earned){
    var target = earned, t0 = null, DUR = 900;
    function step(ts){
      if(!t0) t0 = ts;
      var p = Math.min(1, (ts-t0)/DUR);
      el.textContent = _attV3Won(target*(1-Math.pow(1-p,3)));
      if(p<1) requestAnimationFrame(step);
      else el.textContent = _attV3Won(target);
    }
    requestAnimationFrame(step);
  }

  var key = _attV3Key(d);
  if(_attV3DeltaShownFor === key) return; // 하루 1회
  _attV3DeltaShownFor = key;

  // 생존 델타 — 수입이 아니라 "생존이 좋아졌다"를 우선으로 말한다
  var after = _attV3SurvSnapshot();
  var before = _attV3SurvSnap; _attV3SurvSnap = null;
  var msg;
  if(after && !after.nodata && before && !before.nodata){
    if(after.daysLeft!==null && before.daysLeft!==null && after.daysLeft > before.daysLeft){
      var gain = after.daysLeft - before.daysLeft;
      msg = '😺 오늘 기록 덕분에 <b>버틸 수 있는 날이 +'+gain+'일</b> 늘었어요! (잔고 소진 예상 '+before.date+' → '+after.date+')';
    } else if(after.avail > before.avail){
      msg = '😺 오늘 기록으로 이번 달을 <b>조금 더 여유롭게</b> 보낼 수 있게 됐어요. 수고 많으셨어요!';
    } else {
      msg = '😺 오늘도 이번 달 생존에 한 걸음 보탰어요. 정말 수고하셨어요!';
    }
  } else if(after && !after.nodata){
    msg = '😺 오늘도 이번 달 생존에 한 걸음 보탰어요. 정말 수고하셨어요!';
  } else {
    msg = '😺 오늘도 수고하셨어요! 지출을 알려주시면, 오늘 번 돈으로 며칠을 더 버틸 수 있는지도 말씀드릴게요.';
  }
  var delta = document.getElementById('attv3-delta');
  if(delta){ delta.innerHTML = msg; delta.style.display = 'block'; }
  else if(typeof showToast==='function'){ showToast(msg.replace(/<[^>]+>/g,'')); }
}

// ── 월간 달력 팝업 (레거시 달력 DOM 재사용) ──
function attV3OpenMonthPopup(){
  var calArea = document.getElementById('cal-area');
  if(!calArea) return;
  _attV3PopupOpen = true;

  var ov = document.createElement('div');
  ov.id = 'attv3-month-overlay';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;z-index:9998;padding:12px;';
  var box = document.createElement('div');
  box.style.cssText = 'background:var(--bg,#161a2a);border:1px solid var(--border,rgba(255,255,255,.1));border-radius:18px;max-width:640px;width:100%;max-height:90vh;overflow-y:auto;padding:14px;-webkit-overflow-scrolling:touch;';
  var closeRow = document.createElement('div');
  closeRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;';
  closeRow.innerHTML = '<span style="font-size:15px;font-weight:800;color:var(--text,#eee);">📅 월 전체 보기</span>';
  var xBtn = document.createElement('button');
  xBtn.textContent = '✕';
  xBtn.style.cssText = 'background:none;border:none;color:var(--text3,#999);font-size:22px;cursor:pointer;';
  closeRow.appendChild(xBtn);
  box.appendChild(closeRow);

  try{
    if(_attV3Jobs().indexOf('employee')>=0 && typeof getPayData==='function'){
      var pd = getPayData();
      if(pd && pd.finalPay){
        var sum = document.createElement('div');
        sum.style.cssText = 'font-size:13px;color:var(--text3,#aaa);margin-bottom:8px;';
        sum.innerHTML = '이번 달 예상 실수령 <b style="color:var(--green,#3dd68c);">'+_attV3Won(pd.finalPay)+'</b>';
        box.appendChild(sum);
      }
    }
  }catch(e){}

  var placeholder = document.createElement('div');
  placeholder.id = 'attv3-cal-placeholder';
  calArea.parentNode.insertBefore(placeholder, calArea);
  calArea.style.display = 'block';
  box.appendChild(calArea);
  ov.appendChild(box);
  document.body.appendChild(ov);

  try{ if(typeof renderCalendar==='function') renderCalendar(); }catch(e){}

  function close(){
    _attV3PopupOpen = false;
    var ph = document.getElementById('attv3-cal-placeholder');
    if(ph && calArea){ ph.parentNode.insertBefore(calArea, ph); ph.remove(); }
    calArea.style.display = 'none';
    ov.remove();
    renderAttV3();
  }
  xBtn.addEventListener('click', close);
  ov.addEventListener('click', function(e){ if(e.target===ov) close(); });

  calArea.addEventListener('click', function pick(e){
    var cell = e.target.closest ? e.target.closest('.cal-day:not(.empty)') : null;
    if(!cell) return;
    var dn = cell.querySelector('.dn');
    if(!dn) return;
    e.stopPropagation(); e.preventDefault();
    var dayNum = parseInt(dn.textContent);
    if(dayNum){
      calArea.removeEventListener('click', pick, true);
      close();
      _attV3Select(new Date(curY, curM, dayNum));
    }
  }, true);
}

// ── 좌우 스와이프 = 어제/내일 ──
function _attV3BindSwipe(){
  var area = document.getElementById('attv3-swipe');
  if(!area) return;
  var sx=0, sy=0, tracking=false;
  area.addEventListener('touchstart', function(e){
    if(e.touches.length!==1) return;
    sx = e.touches[0].clientX; sy = e.touches[0].clientY; tracking = true;
  }, {passive:true});
  area.addEventListener('touchend', function(e){
    if(!tracking) return; tracking = false;
    var dx = e.changedTouches[0].clientX - sx;
    var dy = e.changedTouches[0].clientY - sy;
    if(Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy)*1.5) return;
    var sel = _attV3SelDate();
    var nd = new Date(sel); nd.setDate(sel.getDate() + (dx<0 ? 1 : -1));
    _attV3Select(nd);
  }, {passive:true});
}


// ══════════════════════════════════════════
// v4.2.2-beta.8 (디자인 시안 5a): 퇴근 후 "오늘 다른 일 추가" 버튼
// 오늘 메인 근무를 퇴근 완료한 직장인에게만 노출 — 기존 사업장 관리
// 팝업(_attV3CompanyManagePopup)을 여는 진입점일 뿐, 저장 구조 무변경.
// ══════════════════════════════════════════
function _attV3AddJobBtnHtml(sel){
  try{
    if(!_attV3IsToday(sel)) return '';
    if(_attV3Jobs().indexOf('employee')<0) return '';
    var rec = _attV3Rec(_attV3Today());
    var done = rec && rec.start!==undefined && rec.end!==undefined && rec.end!==null;
    if(!done) return '';
    return '<button id="attv3-add-job" style="width:100%;margin:0 0 10px;padding:13px 0;border-radius:12px;border:2px dashed var(--accent,#4f7cff);background:rgba(79,124,255,.06);color:var(--accent,#4f7cff);font-size:14px;font-weight:800;cursor:pointer;font-family:\'Noto Sans KR\',sans-serif;min-height:48px;">＋ 오늘 다른 일 추가 (알바·프리랜서)</button>';
  }catch(e){ return ''; }
}
