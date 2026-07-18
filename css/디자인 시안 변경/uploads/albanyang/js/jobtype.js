// ══════════════════════════════════════════
// 직업 유형 선택 & 모드 전환
// v13: 팝업 DOM 생성/삭제 방식으로 통일
// ══════════════════════════════════════════

// v2.0: 분류 기준을 "고용 형태" → "소득 계산 방식"으로 전환 (BRD/PRD v1.2)
//  - employee: 레이블 "직장인"→"시급제" (ID는 저장 데이터 호환을 위해 유지)
//  - salary: 연봉제 신규 (연봉÷12 → 4대보험/세금 → 실수령액)
//  - driver: delivery로 통합 (LEGACY_MAP에서 변환)
//  - 모든 유형 복수 선택 허용 (단독 선택 제약 폐지)
const JOB_TYPES = {
  employee:   { icon:'🏢', name:'시급제',     desc:'출퇴근·OT 기록<br>시급 기반 급여·연차 자동계산', calcType:'hourly',   color:'var(--accent)'  },
  salary:     { icon:'💼', name:'연봉제',     desc:'연봉 입력 → 월급·4대보험<br>세금·실수령액 자동계산', calcType:'salary',   color:'var(--accent2)' },
  convenience:{ icon:'💪', name:'알바',       desc:'편의점·쿠팡·물류 등<br>시급 × 근무시간 자동계산', calcType:'hourly',   color:'var(--orange)' },
  delivery:   { icon:'🛵', name:'배달/대리',  desc:'배달·대리기사 등<br>건당 수입 일별 합산',     calcType:'perCase',  color:'var(--yellow)'  },
  freelancer: { icon:'💻', name:'프리랜서',   desc:'프로젝트 단가<br>3.3% 세금계산',       calcType:'project',  color:'var(--green)'   },
  shortAlba:  { icon:'📋', name:'단기알바',   desc:'날짜별 시급 기록<br>다양한 단기 업무',  calcType:'hourly',   color:'var(--cyan)'    },
  etc:        { icon:'➕', name:'추가수입',   desc:'보험금·정부지원금 등<br>일시적 수입 직접 입력', calcType:'manual',   color:'var(--text2)'   },
};

// ── 유틸: 팝업 생성/삭제 헬퍼 ──
function _removeAllPopups() {
  ['job-type-overlay','albatype-overlay','worktype-overlay','shift-sub-overlay','income-wizard-overlay','salary-setup-overlay'].forEach(function(id){
    var el = document.getElementById(id);
    if(el) el.remove();
  });
}

function _makeOverlay(id) {
  // 기존 동일 id 제거
  var old = document.getElementById(id);
  if(old) old.remove();
  var ov = document.createElement('div');
  ov.id = id;
  // backdrop-filter 제거: Android PWA에서 GPU compositing layer가 touch hit-test를 방해하는 케이스 방지
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;z-index:99999;padding:16px;';
  return ov;
}

function _makeModal(maxW) {
  var m = document.createElement('div');
  m.style.cssText = 'background:var(--surface,#1e2235);border:1px solid var(--border,rgba(255,255,255,.1));border-radius:20px;padding:28px 22px;max-width:'+(maxW||440)+'px;width:100%;max-height:92vh;overflow-y:auto;box-shadow:0 24px 64px rgba(0,0,0,.5);';
  return m;
}

function _makeCard(icon, name, desc, accentColor, onClick) {
  var card = document.createElement('div');
  card.style.cssText = 'background:var(--surface2,#2a2a3a);border:1.5px solid var(--border,rgba(255,255,255,.1));border-radius:14px;padding:14px 16px;cursor:pointer;transition:border-color .2s;display:flex;align-items:flex-start;gap:12px;margin-bottom:8px;';
  card.innerHTML = '<div style="font-size:28px;flex-shrink:0;margin-top:2px;">'+icon+'</div>'
    + '<div><div style="font-size:17px;font-weight:800;color:var(--text,#fff);margin-bottom:3px;">'+name+'</div>'
    + '<div style="font-size:14px;color:var(--text3,#aaa);line-height:1.5;">'+desc+'</div></div>';
  card.addEventListener('mouseover', function(){ this.style.borderColor = accentColor || 'var(--accent,#4f7cff)'; });
  card.addEventListener('mouseout',  function(){ this.style.borderColor = 'var(--border,rgba(255,255,255,.1))'; });
  // pointerup: Android에서 touchmove 발생 시 click이 취소되는 문제 방지
  // 400ms cooldown으로 중복 실행(pointerup→click 연속 발사) 차단
  var _t = 0;
  card.addEventListener('pointerup', function(e){
    var now = Date.now(); if(now - _t < 400) return; _t = now;
    onClick(e);
  });
  return card;
}

function _makeRowCard(icon, name, time, accentColor, onClick) {
  var card = document.createElement('div');
  card.style.cssText = 'background:var(--surface2,#2a2a3a);border:1.5px solid var(--border,rgba(255,255,255,.1));border-radius:14px;padding:16px;cursor:pointer;transition:border-color .2s;display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px;';
  card.innerHTML = '<div style="display:flex;align-items:center;gap:12px;">'
    + '<div style="font-size:28px;">'+icon+'</div>'
    + '<div style="font-size:18px;font-weight:800;color:var(--text,#fff);">'+name+'</div></div>'
    + '<div style="font-size:14px;color:var(--text3,#aaa);font-weight:600;">'+time+'</div>';
  card.addEventListener('mouseover', function(){ this.style.borderColor = accentColor || 'var(--accent,#4f7cff)'; });
  card.addEventListener('mouseout',  function(){ this.style.borderColor = 'var(--border,rgba(255,255,255,.1))'; });
  var _t = 0;
  card.addEventListener('pointerup', function(e){
    var now = Date.now(); if(now - _t < 400) return; _t = now;
    onClick(e);
  });
  return card;
}

// ══════════════════════════════════════════
// localStorage 유틸
// ══════════════════════════════════════════
// v2.0: legacy 유형 정규화 (driver→delivery, 구 shortAlba 저장값→convenience)
var JOB_LEGACY_MAP = { driver:'delivery' };
function normalizeJobs(jobs){
  return jobs.map(function(j){ return JOB_LEGACY_MAP[j]||j; })
    .filter(function(j){ return !!JOB_TYPES[j]; })
    .filter(function(v,i,a){ return a.indexOf(v)===i; });
}

function loadSelectedJobs(){
  try{
    var raw = localStorage.getItem('atm2_selectedJobs');
    if(raw) return normalizeJobs(JSON.parse(raw));
  }catch(e){}
  if(typeof jobType !== 'undefined' && jobType && jobType !== 'multi'){
    return normalizeJobs(jobType === 'employee' ? ['employee'] : [jobType]);
  }
  return [];
}

// v2.0: 단독 선택 강제 로직 제거 — 모든 조합 허용 (N잡)
function saveSelectedJobs(jobs){
  jobs = normalizeJobs(jobs);
  try{ localStorage.setItem('atm2_selectedJobs', JSON.stringify(jobs)); }catch(e){}
  if(jobs.length === 1){
    jobType = jobs[0];
  } else {
    jobType = 'multi';
  }
  localStorage.setItem('atm2_jobType', jobType);
}

// ══════════════════════════════════════════
// 직업유형 선택 팝업
// ══════════════════════════════════════════
function showJobTypeSelector(forceShow){
  // v2.1: 17개 직업군 기반 수익원 위저드로 위임 (income-wizard.js)
  if(typeof showIncomeWizard === 'function'){ showIncomeWizard(); return; }
  // 기존 팝업 전부 제거
  _removeAllPopups();

  var currentJobs = loadSelectedJobs();
  var isChanging = currentJobs.length > 0;
  var tempSelected = normalizeJobs(currentJobs);

  var ov = _makeOverlay('job-type-overlay');
  // 직종 선택됐고 forceShow 아니면 배경 클릭으로 닫기
  ov.addEventListener('click', function(e){
    if(e.target === ov && loadSelectedJobs().length > 0) ov.remove();
  });

  function render(){
    ov.innerHTML = '';

    // ── 모달: flex-column — 내용 영역만 스크롤, 확인 버튼은 항상 하단 고정 ──
    var modal = document.createElement('div');
    modal.style.cssText = 'background:var(--surface,#1e2235);border:1px solid var(--border,rgba(255,255,255,.1));border-radius:20px;max-width:520px;width:100%;max-height:calc(92vh - env(safe-area-inset-bottom,0px));overflow:hidden;box-shadow:0 24px 64px rgba(0,0,0,.5);display:flex;flex-direction:column;';

    // 닫기 버튼 (변경 모드일 때)
    if(isChanging){
      var closeBtn = document.createElement('button');
      closeBtn.innerHTML = '✕';
      closeBtn.style.cssText = 'position:absolute;top:14px;right:16px;background:none;border:none;color:var(--text3);font-size:26px;cursor:pointer;';
      closeBtn.addEventListener('click', function(){ ov.remove(); });
      modal.style.position = 'relative';
      modal.appendChild(closeBtn);
    }

    // ── 스크롤 영역: 헤더 + 카드 선택 영역 ──
    var scrollArea = document.createElement('div');
    scrollArea.style.cssText = 'flex:1 1 auto;overflow-y:auto;min-height:0;padding:28px 22px 12px;-webkit-overflow-scrolling:touch;';

    // 헤더
    var hdr = document.createElement('div');
    hdr.style.cssText = 'text-align:center;margin-bottom:20px;';
    hdr.innerHTML = '<div style="font-size:44px;margin-bottom:8px;">'+(isChanging?'🔄':'👋')+'</div>'
      + '<h2 style="font-size:26px;font-weight:700;margin-bottom:6px;">'+(isChanging?'직종 변경':'나는 어떻게 일하고 있나요?')+'</h2>'
      + (isChanging?'':'<div style="font-size:14px;font-weight:700;color:var(--accent);margin-bottom:8px;">선택하면 이번 달 받을 돈과, 월급날까지 버틸 수 있는지 미리 알 수 있어요</div>')
      + '<div style="font-size:17px;color:var(--text3);line-height:1.6;">해당하는 직종을 <b>모두 선택</b>하세요<br>'
      + '<span style="color:var(--accent);font-weight:600;">모든 직종 동시 선택 가능 (N잡 지원)</span></div>';
    scrollArea.appendChild(hdr);

    // ── 직장 근무 섹션: 시급제·연봉제 — v2.0부터 복수 선택 허용 ──
    var sec1Lbl = document.createElement('div');
    sec1Lbl.style.cssText = 'font-size:15px;font-weight:700;color:var(--text3);margin-bottom:8px;';
    sec1Lbl.textContent = '📌 직장 근무 (복수 선택 가능)';
    scrollArea.appendChild(sec1Lbl);

    ['employee','salary'].forEach(function(type){
      var info = JOB_TYPES[type];
      var sel = tempSelected.indexOf(type) >= 0;
      var card = document.createElement('div');
      card.style.cssText = 'border:1.5px solid '+(sel?info.color:'var(--border,rgba(255,255,255,.1))')+';background:'+(sel?'rgba(79,124,255,.12)':'var(--surface2,#2a2a3a)')+';border-radius:14px;padding:14px 16px;cursor:pointer;transition:all .2s;display:flex;align-items:center;gap:12px;margin-bottom:8px;';
      card.innerHTML = '<span style="font-size:28px;">'+info.icon+'</span>'
        + '<div><div style="font-size:17px;font-weight:800;color:var(--text,#fff);">'+info.name+'</div>'
        + '<div style="font-size:14px;color:var(--text3,#aaa);">'+info.desc.replace(/<br>/g,', ')+'</div></div>'
        + (sel ? '<div style="margin-left:auto;flex-shrink:0;font-size:14px;font-weight:700;color:'+info.color+';">✓ 선택됨</div>' : '');
      var _et = 0;
      card.addEventListener('pointerup', function(e){
        var now = Date.now(); if(now - _et < 400) return; _et = now;
        var idx = tempSelected.indexOf(type);
        if(idx>=0) tempSelected.splice(idx,1);
        else tempSelected.push(type);
        render();
      });
      scrollArea.appendChild(card);
    });
    var secGap = document.createElement('div');
    secGap.style.cssText = 'height:8px;';
    scrollArea.appendChild(secGap);

    // N잡 섹션
    var sec2Lbl = document.createElement('div');
    sec2Lbl.style.cssText = 'font-size:15px;font-weight:700;color:var(--text3);margin-bottom:8px;';
    sec2Lbl.textContent = '💼 알바 · 부업 · 프리랜서 (복수 선택 가능)';
    scrollArea.appendChild(sec2Lbl);

    var grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:16px;';
    ['convenience','delivery','freelancer','etc'].forEach(function(type){
      var info = JOB_TYPES[type];
      var sel = tempSelected.indexOf(type) >= 0;
      var card = document.createElement('div');
      // v2.0: 직장 근무(시급제/연봉제)와 자유롭게 조합 가능 — 배타 로직 없음
      card.style.cssText = 'border:1.5px solid '+(sel?info.color:'var(--border,rgba(255,255,255,.1))')+';background:'+(sel?'rgba(0,0,0,.08)':'var(--surface2,#2a2a3a)')+';border-radius:14px;padding:14px;cursor:pointer;opacity:1;transition:all .2s;';
      card.innerHTML = '<div style="font-size:26px;margin-bottom:4px;">'+info.icon+'</div>'
        + '<div style="font-size:16px;font-weight:800;color:var(--text,#fff);margin-bottom:3px;">'+info.name+'</div>'
        + '<div style="font-size:12px;color:var(--text3,#aaa);line-height:1.4;">'+info.desc+'</div>'
        + (sel?'<div style="margin-top:6px;font-size:13px;font-weight:700;color:'+info.color+';">✓ 선택됨</div>':'');
      var _ct = 0;
      card.addEventListener('pointerup', function(e){
        var now = Date.now(); if(now - _ct < 400) return; _ct = now;
        var idx = tempSelected.indexOf(type);
        if(idx>=0) tempSelected.splice(idx,1);
        else tempSelected.push(type);
        render();
      });
      grid.appendChild(card);
    });
    scrollArea.appendChild(grid);

    // 선택된 직종 요약
    if(tempSelected.length > 0){
      var summary = document.createElement('div');
      summary.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:4px;';
      summary.innerHTML = '<span style="font-size:15px;color:var(--text3);">선택됨:</span>';
      tempSelected.forEach(function(t){
        var info = JOB_TYPES[t];
        var tag = document.createElement('span');
        tag.style.cssText = 'display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:20px;font-size:15px;font-weight:600;background:rgba(79,124,255,.1);color:var(--accent);border:1px solid rgba(79,124,255,.2);';
        tag.textContent = (info?info.icon+' '+info.name:t);
        summary.appendChild(tag);
      });
      scrollArea.appendChild(summary);
    }

    modal.appendChild(scrollArea);

    // ── 하단 고정 영역: 확인 버튼 (항상 화면에 보임) ──
    var footerArea = document.createElement('div');
    footerArea.style.cssText = 'flex-shrink:0;padding:10px 22px 18px;background:var(--surface,#1e2235);border-top:1px solid var(--border,rgba(255,255,255,.1));border-radius:0 0 20px 20px;';

    var confirmBtn = document.createElement('button');
    var _btnBg = tempSelected.length>0 ? 'var(--accent)' : 'var(--border)';
    var _btnColor = tempSelected.length>0 ? '#fff' : 'var(--text3)';
    var _btnCursor = tempSelected.length>0 ? 'pointer' : 'not-allowed';
    confirmBtn.style.cssText = 'width:100%;padding:14px;border-radius:10px;border:none;background:'+_btnBg+';color:'+_btnColor+';font-size:20px;font-weight:700;cursor:'+_btnCursor+';font-family:"Noto Sans KR",sans-serif;transition:all .2s;';
    confirmBtn.textContent = tempSelected.length>0 ? '✅ 선택 완료 ('+tempSelected.length+'개 직종)' : '직종을 선택해주세요';
    confirmBtn.addEventListener('click', function(){
      if(tempSelected.length === 0){ showToast('⚠️ 직종을 하나 이상 선택해주세요'); return; }
      saveSelectedJobs(tempSelected);
      ov.remove(); // 완전 제거
      applyJobTypeUI();

      // v2.0: 후속 설정 팝업 우선순위 — 시급제 근무형태 > 연봉제 연봉설정 > 알바 종류
      if(tempSelected.includes('employee')){
        setTimeout(function(){ showWorkTypeSelector('employee'); }, 200);
        return;
      }
      if(tempSelected.includes('salary')){
        if(typeof showSalarySetupPopup === 'function'){
          setTimeout(function(){ showSalarySetupPopup(); }, 200);
          return;
        }
      }
      if(tempSelected.includes('convenience')){
        setTimeout(function(){ showAlbaTypeSelector(); }, 200);
        return;
      }
      if(tempSelected.length === 1 && tempSelected[0] === 'freelancer'){
        // ★ 프리랜서 단독 선택은 renderCalendar()를 거치지 않는 유일한 경로라
        //   별도로 튜토리얼 트리거 필요(다른 경로는 모두 renderCalendar()에서 공통 처리됨)
        if(typeof initTutorial === 'function'){ try{ initTutorial(); }catch(e){} }
      } else {
        renderCalendar();
      }
      showPage('home');
      var names = tempSelected.map(function(t){ return (JOB_TYPES[t]?JOB_TYPES[t].icon+' '+JOB_TYPES[t].name:t); }).join(', ');
      showToast('✅ ' + names);
      if(typeof HomeStage!=='undefined') HomeStage.advance(1);
      if(typeof showJobSelectedGuide==='function') showJobSelectedGuide();
    });
    footerArea.appendChild(confirmBtn);

    var tip = document.createElement('div');
    tip.style.cssText = 'font-size:15px;color:var(--text3);text-align:center;margin-top:8px;';
    tip.textContent = '💡 상단 뱃지를 탭하면 언제든 변경 가능';
    footerArea.appendChild(tip);

    modal.appendChild(footerArea);
    ov.appendChild(modal);
  }

  render();
  document.body.appendChild(ov);
}

function selectJobType(type){
  saveSelectedJobs([type]);
  _removeAllPopups();
  applyJobTypeUI();
  if(type !== 'freelancer'){ renderCalendar(); }
  showPage('home');
  var info = JOB_TYPES[type] || {};
  showToast((info.icon||'') + ' ' + (info.name||type) + ' 모드');
}

// ══════════════════════════════════════════
// applyJobTypeUI
// ══════════════════════════════════════════
function applyJobTypeUI(){
  var selectedJobs = loadSelectedJobs();
  var albaSubtype = '';
  try{ albaSubtype = localStorage.getItem('atm2_albaSubtype')||''; }catch(e){}
  var isAlbaCompany = selectedJobs.indexOf('convenience')>=0 && albaSubtype === 'company';
  // ★ "회사알바"는 실제로는 renderIncomeCalc()/renderDash() 등에서 직장인으로 처리되지 않고
  //   알바용 화면이 그대로 렌더링되므로, 탭 라벨(급여관리/대시보드)·주간토글은 진짜 직장인 기준으로만 판단.
  //   (이전에는 isAlbaCompany도 포함되어 "회사알바"인데 "급여관리/대시보드"라는 직장인 용어가 노출되는 불일치가 있었음)
  var isTrueEmployee = selectedJobs.indexOf('employee')>=0 || jobType === 'employee';
  var isEmployee = isTrueEmployee;
  // ★ 사이드바(근무형태 설정)는 직장인 + 회사알바 모두 wt(근무형태) 값을 사용하므로 둘 다 필요 — 별도 기준
  var showSidebar = isTrueEmployee || isAlbaCompany;

  var salBtn  = document.getElementById('btn-sal');
  var dashBtn = document.getElementById('btn-dash');
  var mobSal  = document.getElementById('mob-btn-sal');
  var mobDash = document.getElementById('mob-btn-dash');
  var attBtn  = document.getElementById('btn-att');
  var mobAtt  = document.getElementById('mob-btn-att');
  var sidebar    = document.getElementById('sidebar');
  var weekToggle = document.querySelector('.week-toggle-wrap');

  function getAttLabel(){
    return { icon:'📅', text:'근태관리' };
  }
  var attLabel = getAttLabel();

  if(attBtn){
    var tabIcon = attBtn.querySelector('.tab-icon');
    if(tabIcon) tabIcon.textContent = attLabel.icon;
    var nodes = attBtn.childNodes;
    for(var i=nodes.length-1;i>=0;i--){
      if(nodes[i].nodeType===3){ nodes[i].textContent=' '+attLabel.text; break; }
    }
  }
  if(mobAtt){
    var spans = mobAtt.querySelectorAll('span');
    if(spans.length>=2){ spans[0].textContent=attLabel.icon; spans[spans.length-1].textContent=attLabel.text; }
    else if(spans.length===1){ spans[0].textContent=attLabel.text; }
  }

  if(isEmployee){
    // ★ Fix #46: 탭 라벨 "급여관리" → "수입관리"로 통일(2026-06-20).
    //   페이지 제목(salary.js)은 직종 무관 항상 "수입관리"라 직장인 모드에서만
    //   탭과 제목이 달라지는 불일치가 있었음 — 직장+알바+배달+프리랜서 수입을
    //   모두 합산해 보여주는 화면 성격상 "수입관리"가 더 적합해 탭을 제목에 맞춤.
    if(salBtn)  { salBtn.style.display='';  salBtn.textContent='💰 수입관리'; }
    if(dashBtn) { dashBtn.style.display=''; dashBtn.textContent='📊 연간요약'; }
    if(mobSal)  { mobSal.style.display='';  mobSal.querySelector('span:last-child').textContent='수입관리'; }
    if(mobDash) { mobDash.style.display=''; mobDash.querySelector('span:last-child').textContent='연간요약'; }
    if(weekToggle) weekToggle.style.display='';
  } else {
    if(salBtn)  { salBtn.style.display='';  salBtn.textContent='🧮 수입관리'; }
    if(dashBtn) { dashBtn.style.display=''; dashBtn.textContent='📊 연간요약'; }
    if(mobSal)  { mobSal.style.display='';  mobSal.querySelector('span:last-child').textContent='수입관리'; }
    if(mobDash) { mobDash.style.display=''; mobDash.querySelector('span:last-child').textContent='연간요약'; }
    if(weekToggle) weekToggle.style.display='none';
  }

  // ★ 사이드바/햄버거 버튼: PC에서 #sidebar/#mob-sidebar-btn에 display:flex!important가 걸려있어
  //   인라인 style.display로는 숨길 수 없으므로, body 클래스 + 더 높은 명시도의 CSS로 우회 처리(main.css)
  if(sidebar) sidebar.style.display = showSidebar ? '' : 'none'; // 모바일 등 !important가 없는 환경 대비 유지
  document.body.classList.toggle('sidebar-disabled', !showSidebar);

  var budgetBtn = document.getElementById('btn-budget');
  var mobBudget = document.getElementById('mob-btn-budget');
  if(budgetBtn) budgetBtn.style.display='';
  if(mobBudget) mobBudget.style.display='';

  updateJobBadge();
  _applyJobModeClasses(selectedJobs, selectedJobs.indexOf('employee')>=0);
}

// 직업 모드에 따라 body 클래스 설정 — CSS/JS 분기 훅
// v2.0: jm-salary(연봉제) 추가, 모든 조합 허용
function _applyJobModeClasses(jobs, isEmployee){
  var isSalary = jobs.indexOf('salary')>=0;
  var isAlba = jobs.some(function(j){ return ['convenience','shortAlba'].indexOf(j)>=0; });
  var isDelivery = jobs.some(function(j){ return ['delivery','driver'].indexOf(j)>=0; });
  var isFreelancer = jobs.indexOf('freelancer')>=0;

  ['jm-employee','jm-salary','jm-alba','jm-delivery','jm-freelancer','jm-njob'].forEach(function(c){
    document.body.classList.remove(c);
  });
  if(isEmployee) document.body.classList.add('jm-employee');
  if(isSalary) document.body.classList.add('jm-salary');
  if(jobs.length > 1){ document.body.classList.add('jm-njob'); return; }
  // 단독 선택 시 유형별 클래스
  if(isDelivery) document.body.classList.add('jm-delivery');
  else if(isFreelancer) document.body.classList.add('jm-freelancer');
  else if(isAlba) document.body.classList.add('jm-alba');
  else if(!isEmployee && !isSalary) document.body.classList.add('jm-njob');
}

function updateJobBadge(){
  var badge = document.getElementById('job-type-badge');
  if(badge) badge.remove();
}

// ══════════════════════════════════════════
// 근무형태 선택 팝업
// ══════════════════════════════════════════
var WORK_TYPES = [
  { id:'day',    icon:'☀️', name:'주간 고정', desc:'오전~오후 고정 출퇴근<br>예) 9시~18시' },
  { id:'night',  icon:'🌙', name:'야간 고정', desc:'야간 고정 근무<br>예) 22시~07시' },
  { id:'shift2', icon:'🔄', name:'2교대',     desc:'주간↔야간 번갈아 근무' },
  { id:'shift3', icon:'⚡', name:'3교대',     desc:'주간·저녁·야간 순환 근무' },
];

function showWorkTypeSelector(forWho){
  _removeAllPopups();
  var isAlba = (forWho === 'alba_company');

  var ov = _makeOverlay('worktype-overlay');
  var modal = _makeModal(440);

  var hdr = document.createElement('div');
  hdr.style.cssText = 'text-align:center;margin-bottom:22px;';
  hdr.innerHTML = '<div style="font-size:48px;margin-bottom:10px;">'+(isAlba?'💪':'🏢')+'</div>'
    + '<h2 style="font-size:22px;font-weight:800;color:var(--text,#fff);margin-bottom:6px;">근무 형태를 선택해 주세요</h2>'
    + '<p style="font-size:16px;color:var(--text3,#aaa);line-height:1.6;">'+(isAlba?'회사 알바':'직장')+' 근무 패턴을 선택하면<br>출퇴근 기본값이 자동 설정돼요</p>';
  modal.appendChild(hdr);

  WORK_TYPES.forEach(function(wt){
    var card = _makeCard(wt.icon, wt.name, wt.desc, 'var(--accent,#4f7cff)', function(){
      ov.remove();
      if(wt.id==='shift2'){ setTimeout(function(){ showShift2SubSelector(); }, 150); return; }
      if(wt.id==='shift3'){ setTimeout(function(){ showShift3SubSelector(); }, 150); return; }
      applyWorkType(wt.id, null);
    });
    modal.appendChild(card);
  });

  var skipBtn = document.createElement('button');
  skipBtn.textContent = '나중에 설정할게요';
  skipBtn.style.cssText = 'width:100%;padding:12px;border-radius:12px;border:1px solid var(--border,rgba(255,255,255,.15));background:transparent;color:var(--text3,#888);font-size:16px;cursor:pointer;';
  skipBtn.addEventListener('click', function(){ ov.remove(); renderCalendar(); });
  modal.appendChild(skipBtn);

  ov.appendChild(modal);
  document.body.appendChild(ov);
}

window.selectWorkType = function(wtId){
  _removeAllPopups();
  if(wtId==='shift2'){ setTimeout(function(){ showShift2SubSelector(); }, 150); return; }
  if(wtId==='shift3'){ setTimeout(function(){ showShift3SubSelector(); }, 150); return; }
  applyWorkType(wtId, null);
};

function applyWorkType(wtId, subId){
  try{
    localStorage.setItem('atm2_workType', wtId);
    if(subId) localStorage.setItem('atm2_workSubType', subId);
    else localStorage.removeItem('atm2_workSubType');
  }catch(e){}
  if(typeof setWT === 'function') setWT(wtId);
  if(wtId==='3shift' && subId){
    if(typeof myShift3 !== 'undefined') myShift3 = (subId==='day_fixed'?'A':subId);
    try{ localStorage.setItem('atm2_myShift3', subId); }catch(e){}
  }
  var labelMap = {
    day:'☀️ 주간 고정', night:'🌙 야간 고정',
    '2shift_day':'🔄 2교대 주간조', '2shift_night':'🔄 2교대 야간조', '2shift_day_fixed':'🔄 2교대 통상조',
    '3shift_A':'⚡ 3교대 A조', '3shift_B':'⚡ 3교대 B조', '3shift_C':'⚡ 3교대 C조', '3shift_day_fixed':'⚡ 통상조(주간)',
  };
  var key = subId ? wtId+'_'+subId : wtId;
  showToast('✅ ' + (labelMap[key]||key) + ' 설정됨');
  if(typeof HomeStage!=='undefined') HomeStage.advance(1);
  if(typeof showJobSelectedGuide==='function') showJobSelectedGuide();
  if(typeof applyJobTypeUI==='function') applyJobTypeUI();
  if(typeof updateWorkTypeBadge==='function') updateWorkTypeBadge();
  if(typeof renderCalendar==='function') renderCalendar();
  showPage('home');
}

// ── 2교대 서브 선택 ──
function showShift2SubSelector(){
  _removeAllPopups();
  var ov = _makeOverlay('shift-sub-overlay');
  var modal = _makeModal(420);

  var hdr = document.createElement('div');
  hdr.style.cssText = 'text-align:center;margin-bottom:18px;';
  hdr.innerHTML = '<div style="font-size:44px;margin-bottom:8px;">🔄</div>'
    + '<h2 style="font-size:20px;font-weight:800;color:var(--text);margin-bottom:4px;">2교대 — 내 조를 선택해 주세요</h2>'
    + '<p style="font-size:15px;color:var(--text3);">날짜 기록 시 자동으로 적용돼요</p>';
  modal.appendChild(hdr);

  [{id:'day',time:'07:00 ~ 19:00',icon:'☀️',name:'주간조'},
   {id:'night',time:'19:00 ~ 07:00',icon:'🌙',name:'야간조'},
   {id:'day_fixed',time:'주간 고정',icon:'👔',name:'통상조'}
  ].forEach(function(o){
    var card = _makeRowCard(o.icon, o.name, o.time, 'var(--orange,#ff9f43)', function(){
      ov.remove();
      applyWorkType('2shift', o.id);
    });
    modal.appendChild(card);
  });

  var backBtn = document.createElement('button');
  backBtn.textContent = '← 뒤로';
  backBtn.style.cssText = 'width:100%;padding:11px;border-radius:11px;border:1px solid var(--border);background:transparent;color:var(--text3);font-size:15px;cursor:pointer;margin-top:4px;';
  backBtn.addEventListener('click', function(){ ov.remove(); showWorkTypeSelector('employee'); });
  modal.appendChild(backBtn);

  ov.appendChild(modal);
  document.body.appendChild(ov);
}

// ── 3교대 서브 선택 ──
function showShift3SubSelector(){
  _removeAllPopups();
  var ov = _makeOverlay('shift-sub-overlay');
  var modal = _makeModal(420);

  var hdr = document.createElement('div');
  hdr.style.cssText = 'text-align:center;margin-bottom:16px;';
  hdr.innerHTML = '<div style="font-size:44px;margin-bottom:8px;">⚡</div>'
    + '<h2 style="font-size:20px;font-weight:800;color:var(--text);margin-bottom:4px;">3교대 — 내 조를 선택해 주세요</h2>'
    + '<p style="font-size:15px;color:var(--text3);">날짜 기록 시 자동으로 적용돼요</p>';
  modal.appendChild(hdr);

  [{id:'A',time:'07:00 ~ 15:00',icon:'🌅',name:'A조'},
   {id:'B',time:'15:00 ~ 23:00',icon:'🌆',name:'B조'},
   {id:'C',time:'23:00 ~ 07:00',icon:'🌙',name:'C조'},
   {id:'day_fixed',time:'주간 고정',icon:'👔',name:'통상조'}
  ].forEach(function(o){
    var card = _makeRowCard(o.icon, o.name, o.time, 'var(--yellow,#ffd166)', function(){
      ov.remove();
      applyWorkType('3shift', o.id);
    });
    modal.appendChild(card);
  });

  var backBtn = document.createElement('button');
  backBtn.textContent = '← 뒤로';
  backBtn.style.cssText = 'width:100%;padding:11px;border-radius:11px;border:1px solid var(--border);background:transparent;color:var(--text3);font-size:15px;cursor:pointer;margin-top:4px;';
  backBtn.addEventListener('click', function(){ ov.remove(); showWorkTypeSelector('employee'); });
  modal.appendChild(backBtn);

  ov.appendChild(modal);
  document.body.appendChild(ov);
}

window.applyShift2Sub = function(subId){ applyWorkType('2shift', subId); };
window.applyShift3Sub = function(subId){ applyWorkType('3shift', subId); };
window.skipWorkType = function(){ var o=document.getElementById('worktype-overlay'); if(o)o.remove(); renderCalendar(); showPage('home'); };

// ══════════════════════════════════════════
// 알바 세부카테고리 선택 팝업
// ══════════════════════════════════════════
var ALBA_SUBTYPES = [
  { id:'company', icon:'🏢', name:'회사 알바',  desc:'일반 사무·생산직 등<br>→ 근무형태 선택 (주간/야간/교대)' },
  { id:'cvs',     icon:'🏪', name:'편의점',      desc:'시간당 알바<br>날짜별 시간 직접 입력' },
  { id:'cafe',    icon:'☕', name:'카페',         desc:'시간당 알바<br>날짜별 시간 직접 입력' },
  { id:'coupang', icon:'📦', name:'쿠팡 / 택배', desc:'시간당 알바<br>날짜별 시간 직접 입력' },
  { id:'other',   icon:'➕', name:'기타 알바',   desc:'그 외 시간제 알바<br>날짜별 시간 직접 입력' },
];

function showAlbaTypeSelector(){
  _removeAllPopups();

  var ov = _makeOverlay('albatype-overlay');
  var modal = _makeModal(440);

  var hdr = document.createElement('div');
  hdr.style.cssText = 'text-align:center;margin-bottom:20px;';
  hdr.innerHTML = '<div style="font-size:48px;margin-bottom:10px;">💪</div>'
    + '<h2 style="font-size:22px;font-weight:800;color:var(--text,#fff);margin-bottom:6px;">알바 종류를 선택해 주세요</h2>'
    + '<p style="font-size:16px;color:var(--text3,#aaa);line-height:1.6;">알바 종류에 따라 기록 방식이 달라져요</p>';
  modal.appendChild(hdr);

  ALBA_SUBTYPES.forEach(function(st){
    var card = _makeCard(st.icon, st.name, st.desc, 'var(--orange,#ff9f43)', function(){
      try{ localStorage.setItem('atm2_albaSubtype', st.id); }catch(e){}
      ov.remove();
      if(st.id === 'company'){
        setTimeout(function(){ showWorkTypeSelector('alba_company'); }, 150);
      } else {
        applyJobTypeUI();
        var labels = { cvs:'편의점', cafe:'카페', coupang:'쿠팡/택배', other:'기타알바' };
        showToast('✅ ' + (labels[st.id]||st.id) + ' 알바 설정됨');
        if(typeof HomeStage!=='undefined') HomeStage.advance(1);
        if(typeof showJobSelectedGuide==='function') showJobSelectedGuide();
        renderCalendar();
        showPage('home');
      }
    });
    modal.appendChild(card);
  });

  var skipBtn = document.createElement('button');
  skipBtn.textContent = '나중에 설정할게요';
  skipBtn.style.cssText = 'width:100%;padding:12px;border-radius:12px;border:1px solid var(--border,rgba(255,255,255,.15));background:transparent;color:var(--text3,#888);font-size:16px;cursor:pointer;margin-top:4px;';
  skipBtn.addEventListener('click', function(){ ov.remove(); renderCalendar(); showPage('home'); });
  modal.appendChild(skipBtn);

  ov.appendChild(modal);
  document.body.appendChild(ov);
}

window.selectAlbaType = function(subtypeId){
  try{ localStorage.setItem('atm2_albaSubtype', subtypeId); }catch(e){}
  _removeAllPopups();
  if(subtypeId === 'company'){
    setTimeout(function(){ showWorkTypeSelector('alba_company'); }, 150);
  } else {
    applyJobTypeUI();
    var labels = { cvs:'편의점', cafe:'카페', coupang:'쿠팡/택배', other:'기타알바' };
    showToast('✅ ' + (labels[subtypeId]||subtypeId) + ' 알바 설정됨');
    if(typeof HomeStage!=='undefined') HomeStage.advance(1);
    if(typeof showJobSelectedGuide==='function') showJobSelectedGuide();
    renderCalendar();
    showPage('home');
  }
};

window.skipAlbaType = function(){
  _removeAllPopups();
  renderCalendar();
  showPage('home');
};

// ── 근무형태 뱃지 ──
function updateWorkTypeBadge(){
  var wtId  = '';
  var subId = '';
  try{ wtId = localStorage.getItem('atm2_workType')||'day'; subId = localStorage.getItem('atm2_workSubType')||''; }catch(e){}
  var badge = document.getElementById('work-type-badge');
  if(!badge) return;
  var map = {
    'day':'☀️ 주간고정','night':'🌙 야간고정',
    '2shift_day':'🔄 주간조','2shift_night':'🔄 야간조','2shift_day_fixed':'🔄 통상조',
    '3shift_A':'⚡ A조','3shift_B':'⚡ B조','3shift_C':'⚡ C조','3shift_day_fixed':'⚡ 통상조',
  };
  var key = subId ? wtId+'_'+subId : wtId;
  badge.textContent = map[key]||'근무형태';
  badge.style.display='inline-block';
}

function reopenWorkTypeSelector(){
  if(typeof showWorkTypeSelector==='function') showWorkTypeSelector('employee');
}

window.addEventListener('load', function(){
  setTimeout(function(){
    if(typeof updateWorkTypeBadge==='function') updateWorkTypeBadge();
  }, 800);
});
// ══════════════════════════════════════════
