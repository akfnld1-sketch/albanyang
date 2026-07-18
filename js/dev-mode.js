// ══════════════════════════════════════════
// dev-mode.js — 🧪 개발자 모드 (v4.2.1)
// 출시 후 버그 조사용 QA 도구. 표시/진단 전용 — 계산 로직 무변경.
// 진입: 설정 → 개발자 모드 → QA 도구 열기
// ══════════════════════════════════════════
function _devPre(title, obj){
  var body = (typeof obj==='string') ? obj : JSON.stringify(obj, null, 2);
  return '<div style="font-size:13px;font-weight:800;color:var(--accent);margin:12px 0 4px;">'+title+'</div>'
    + '<pre style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:10px;font-size:11px;line-height:1.5;color:var(--text2);overflow-x:auto;max-height:220px;overflow-y:auto;white-space:pre-wrap;word-break:break-all;">'+body.replace(/</g,'&lt;')+'</pre>';
}

function showDevModePopup(){
  var old = document.getElementById('devmode-overlay');
  if(old){ old.remove(); return; }
  var ov = document.createElement('div');
  ov.id = 'devmode-overlay';
  ov.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.6);z-index:99995;display:flex;align-items:center;justify-content:center;padding:16px;';
  var btn = 'width:100%;margin-bottom:8px;padding:11px;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-size:14px;font-weight:700;cursor:pointer;font-family:\'Noto Sans KR\',sans-serif;text-align:left;';
  ov.innerHTML =
    '<div style="background:var(--surface);border-radius:16px;width:100%;max-width:520px;max-height:88vh;overflow-y:auto;padding:18px;box-sizing:border-box;">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">'
    + '<div style="font-size:16px;font-weight:800;color:var(--text);">🧪 개발자 모드 <span style="font-size:11px;color:var(--text3);">'+(typeof APP_VERSION!=='undefined'?APP_VERSION:'')+'</span></div>'
    + '<button onclick="document.getElementById(\'devmode-overlay\').remove()" style="background:none;border:none;font-size:18px;color:var(--text3);cursor:pointer;min-width:40px;min-height:40px;">✕</button></div>'
    // 🧪 개발 정보 — 버그 제보 시 "버전이 뭐예요?" 없이 이 블록 스크린샷 한 장이면 됨
    + '<div id="devmode-info" style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin-bottom:12px;font-size:12px;line-height:1.8;color:var(--text2);font-family:\'JetBrains Mono\',monospace;">'
    + 'App&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'+(typeof APP_VERSION!=='undefined'?APP_VERSION:'?')
    + '<br>Cache&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span id="devmode-cache">확인 중...</span>'
    + '<br>Build&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'+(document.lastModified||'-')
    + '<br>DB&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;v11 (다중 사업장)'
    + '<br>Design&nbsp;&nbsp;&nbsp;&nbsp;v1.0 · Character v1.0 · AttColor v1.1'
    + '<br>UA&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="font-size:10px;">'+navigator.userAgent.slice(0,60)+'…</span>'
    + '</div>'
    + '<button style="'+btn+'" onclick="_devShowWorkSession()">⏱ Work Session 보기</button>'
    + '<button style="'+btn+'" onclick="_devShowStorage()">💾 localStorage 보기</button>'
    + '<button style="'+btn+'" onclick="_devShowCalcLog()">🧮 계산 로그 (급여/사업장)</button>'
    + '<button style="'+btn+'" onclick="_devClearCache()">🗑 SW 캐시 삭제 + 새로고침</button>'
    + '<button style="'+btn+'" onclick="_devSeedDummy()">🌱 더미 데이터 생성 (오늘 9~18시 근무)</button>'
    + '<button style="'+btn+'color:var(--red);" onclick="document.getElementById(\'devmode-overlay\').remove();if(typeof resetAllData===\'function\')resetAllData();">⚠️ 전체 초기화</button>'
    + '<div id="devmode-out"></div>'
    + '</div>';
  document.body.appendChild(ov);
  ov.addEventListener('click', function(e){ if(e.target===ov) ov.remove(); });
  // 현재 SW 캐시 버전 비동기 확인
  if('caches' in window){
    caches.keys().then(function(keys){
      var el = document.getElementById('devmode-cache');
      if(!el) return;
      var mn = keys.filter(function(k){ return k.indexOf('moneynyang')>=0; });
      el.textContent = mn.length ? mn.join(', ').replace(/moneynyang-v1-cache-/g,'') : '(캐시 없음 — 로컬 파일 실행)';
    }).catch(function(){});
  } else {
    var el = document.getElementById('devmode-cache');
    if(el) el.textContent = '미지원';
  }
}

function _devOut(html){
  var el = document.getElementById('devmode-out');
  if(el) el.innerHTML = html;
}

function _devShowWorkSession(){
  var out = { 'atm2_workSession(메인)': null, '사업장별': {} };
  try{ out['atm2_workSession(메인)'] = JSON.parse(localStorage.getItem('atm2_workSession')||'null'); }catch(e){}
  Object.keys(localStorage).forEach(function(k){
    if(k.indexOf('atm2_workSession_')===0){
      try{ out['사업장별'][k] = JSON.parse(localStorage.getItem(k)); }catch(e){}
    }
  });
  _devOut(_devPre('Work Session', out));
}

function _devShowStorage(){
  var rows = [];
  var total = 0;
  Object.keys(localStorage).sort().forEach(function(k){
    var size = (localStorage.getItem(k)||'').length;
    total += size;
    rows.push(k + '  (' + (size>1024 ? (size/1024).toFixed(1)+'KB' : size+'B') + ')');
  });
  _devOut(_devPre('localStorage — '+rows.length+'개 키 · 총 '+(total/1024).toFixed(1)+'KB', rows.join('\n')));
}

function _devShowCalcLog(){
  var log = {};
  try{
    log.활성사업장 = { activeWpId: activeWpId, activeEmpId: activeEmpId, companyRate: companyRate, wt: wt, dayStart: dayStart, lunchBreak: lunchBreak };
    var pd = getPayData();
    log.getPayData = { grossPay: pd.grossPay, finalPay: pd.finalPay, basePay: pd.basePay, wDays: pd.wDays, totOT: pd.totOT, ins: pd.ins && pd.ins.total, tax: pd.tax && pd.tax.total };
    if(typeof CompanyEngine!=='undefined'){
      log.사업장 = CompanyEngine.companies().map(function(c){
        return { name: c.name, wpId: c.wpId, rate: c.emp.companyRate, hasRecords: CompanyEngine.hasRecords(c.wpId, c.empId), todayState: CompanyEngine.todayState(c.wpId, c.empId) };
      });
      log.getPayDataAll = CompanyEngine.getPayDataAll();
    }
    var t = new Date();
    if(typeof getIncomeSummary==='function') log.getIncomeSummary = getIncomeSummary(t.getFullYear(), t.getMonth());
  }catch(e){ log.error = String(e); }
  _devOut(_devPre('계산 로그', log));
}

function _devClearCache(){
  if(!('caches' in window)){ _devOut(_devPre('캐시', 'Cache API 미지원 환경입니다.')); return; }
  caches.keys().then(function(keys){
    return Promise.all(keys.map(function(k){ return caches.delete(k); })).then(function(){ return keys; });
  }).then(function(keys){
    if(typeof showToast==='function') showToast('🗑 캐시 '+keys.length+'개 삭제 — 새로고침합니다');
    setTimeout(function(){ location.reload(); }, 800);
  });
}

function _devSeedDummy(){
  try{
    var t = new Date();
    var key = (typeof dk==='function') ? dk(t.getFullYear(), t.getMonth(), t.getDate()) : null;
    if(!key || typeof dayData==='undefined'){ _devOut(_devPre('더미', '근태 모듈이 로드되지 않았습니다.')); return; }
    dayData[key] = { status:'work', start:9, end:18, note:'(더미)' };
    if(typeof _attV3Persist==='function') _attV3Persist();
    else if(typeof attSaveMonth==='function') attSaveMonth(activeWpId, activeEmpId, t.getFullYear(), t.getMonth(), dayData);
    if(typeof showToast==='function') showToast('🌱 오늘 9~18시 근무 더미가 생성되었습니다');
    _devOut(_devPre('더미 데이터', dayData[key]));
  }catch(e){ _devOut(_devPre('더미', String(e))); }
}
