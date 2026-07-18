// ══════════════════════════════════════════
// company-engine.js — v3.0 사업장(Company) 기반 시급제 다중 처리
//
// 원칙: employee 계산 엔진(getPayData 등)은 "하나"만 존재하고 절대 수정하지 않는다.
//       이 레이어가 사업장별로 전역 컨텍스트(시급/근무형태/근태 dayData)를 교체한 뒤
//       기존 엔진을 반복 호출하고, 끝나면 원래 컨텍스트로 복원한다.
//
// 저장 구조는 기존 v11 다중 사업장 스키마 그대로 사용:
//   atm2_workplaces / atm2_employees_{wpId} / atm2_att_{wpId}_{empId}_{y}_{mm}
// 신규 키: atm2_workSession_{wpId} (보조 사업장별 Work Session — 메인은 기존 키 유지)
// ══════════════════════════════════════════
var CompanyEngine = (function(){

  // ── 사업장 목록 (각 사업장의 첫 직원 = 1인용 앱 기준) ──
  function companies(){
    if(typeof wpList!=='function' || typeof empList!=='function') return [];
    return wpList().map(function(wp){
      var emps = empList(wp.id);
      if(!emps.length) return null;
      return { wpId: wp.id, empId: emps[0].id, name: wp.name || '내 사업장', emp: emps[0] };
    }).filter(Boolean);
  }
  function active(){
    return companies().filter(function(c){ return c.wpId===activeWpId; })[0] || null;
  }
  // 활성(메인) 외 보조 사업장들
  function extras(){
    return companies().filter(function(c){ return c.wpId!==activeWpId; });
  }
  function isMulti(){ return companies().length > 1; }

  // ── 컨텍스트 스왑 실행기 — 기존 엔진을 사업장 단위로 반복 호출하는 핵심 ──
  // 전역(companyRate/wt/dayStart/... )은 syncActiveEmpToGlobals()가 로드하고,
  // 종료 시 원래 활성 사업장 기준으로 재동기화해 완전 복원한다.
  function runFor(wpId, empId, fn){
    if(typeof syncActiveEmpToGlobals!=='function') return null;
    if(wpId===activeWpId && empId===activeEmpId) return fn();
    var snapWp = activeWpId, snapEmp = activeEmpId, snapDay = dayData;
    try{
      activeWpId = wpId; activeEmpId = empId;
      syncActiveEmpToGlobals();
      dayData = attLoadMonth(wpId, empId, curY, curM);
      return fn();
    } finally {
      activeWpId = snapWp; activeEmpId = snapEmp;
      try{ syncActiveEmpToGlobals(); }catch(e){}
      dayData = snapDay;
    }
  }

  // ── 해당 월에 실제 근무 기록이 있는가 (기록 없는 사업장의 "설정 기반 예상치" 합산 방지 게이트) ──
  function hasRecords(wpId, empId, y, m){
    try{
      var t = new Date();
      if(y===undefined){ y = t.getFullYear(); m = t.getMonth(); }
      var month = attLoadMonth(wpId, empId, y, m);
      return Object.values(month).some(function(v){ return v && v.status && v.status!=='none' && v.status!=='public'; });
    }catch(e){ return false; }
  }

  // ── 급여: 사업장별 기존 getPayData() 호출 → 합산 ──
  function getPayDataFor(wpId, empId){
    if(typeof getPayData!=='function') return null;
    return runFor(wpId, empId, function(){ return getPayData(); });
  }
  function getPayDataAll(){
    var total = 0, gross = 0, breakdown = [];
    companies().forEach(function(c){
      try{
        // 기록 없는 사업장은 합산 제외 — 초기화 직후/미사용 사업장이 최저시급 기본
        // 예상치(예: 1,911,665원)로 잡히는 버그 방지 (기존 _hasAttendance 정책과 동일)
        if(!hasRecords(c.wpId, c.empId)) return;
        var pd = getPayDataFor(c.wpId, c.empId);
        if(pd){
          total += pd.finalPay || 0;
          gross += pd.grossPay || 0;
          breakdown.push({ wpId:c.wpId, name:c.name, finalPay:pd.finalPay||0, grossPay:pd.grossPay||0 });
        }
      }catch(e){}
    });
    return { total: total, gross: gross, breakdown: breakdown, count: breakdown.length };
  }

  // ── 사업장별 근태 기록 (기존 attLoadMonth/attSaveMonth 그대로 사용) ──
  function recOf(wpId, empId, d){
    var month = attLoadMonth(wpId, empId, d.getFullYear(), d.getMonth());
    return month[dk(d.getFullYear(), d.getMonth(), d.getDate())] || null;
  }
  function setRec(wpId, empId, d, fields){
    var y = d.getFullYear(), m = d.getMonth();
    var month = attLoadMonth(wpId, empId, y, m);
    var key = dk(y, m, d.getDate());
    month[key] = Object.assign({}, month[key]||{}, fields);
    attSaveMonth(wpId, empId, y, m, month);
    return month[key];
  }

  // ── 사업장별 Work Session (보조 사업장 전용 — 메인은 기존 atm2_workSession) ──
  function _wsKey(wpId){ return 'atm2_workSession_'+wpId; }
  function wsOf(wpId){
    try{ return JSON.parse(localStorage.getItem(_wsKey(wpId))||'null'); }catch(e){ return null; }
  }
  function startWork(wpId, empId){
    var now = new Date();
    var nowH = Math.round((now.getHours()+now.getMinutes()/60)*100)/100;
    setRec(wpId, empId, now, { status:'work', start:nowH });
    try{ localStorage.setItem(_wsKey(wpId), JSON.stringify({ date: dk(now.getFullYear(),now.getMonth(),now.getDate()), startTime: Date.now() })); }catch(e){}
    return nowH;
  }
  function endWork(wpId, empId){
    var now = new Date();
    var nowH = Math.round((now.getHours()+now.getMinutes()/60)*100)/100;
    setRec(wpId, empId, now, { end:nowH });
    try{ localStorage.removeItem(_wsKey(wpId)); }catch(e){}
    return nowH;
  }
  // 오늘 상태: idle(미출근) / working(근무중) / done(퇴근완료)
  function todayState(wpId, empId){
    var rec = recOf(wpId, empId, new Date());
    if(!rec || !rec.status || rec.status==='none') return 'idle';
    if(rec.start!==undefined && rec.start!==null && (rec.end===undefined || rec.end===null)) return 'working';
    if(rec.end!==undefined && rec.end!==null) return 'done';
    return 'idle';
  }

  // ── 사업장 확보: 이름으로 찾고 없으면 생성 (위저드의 보조 시급제 등록용) ──
  function ensureWorkplace(name, empFields){
    var found = wpList().filter(function(w){ return w.name===name; })[0];
    var wpId = found ? found.id : wpCreate(name, '');
    var emps = empList(wpId);
    var empId = emps.length ? emps[0].id : empCreate(wpId, Object.assign({ name:'나', jobType:'employee' }, empFields||{}));
    return { wpId: wpId, empId: empId };
  }

  return {
    companies: companies, active: active, extras: extras, isMulti: isMulti,
    runFor: runFor, getPayDataFor: getPayDataFor, getPayDataAll: getPayDataAll,
    hasRecords: hasRecords,
    recOf: recOf, setRec: setRec, wsOf: wsOf,
    startWork: startWork, endWork: endWork, todayState: todayState,
    ensureWorkplace: ensureWorkplace
  };
})();
