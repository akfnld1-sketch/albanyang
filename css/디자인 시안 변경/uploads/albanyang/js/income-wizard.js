// ══════════════════════════════════════════
// 수익원 선택 위저드 (v2.1)
// 17개 직업군 → 세부직업 → 직업군별 맞춤 급여/수입형태
// 메인수익원 → 보조수익원(반복 가능) → 추가수익 — 한 팝업 내 아코디언 진행
// 내부적으로는 기존 계산 엔진(JOB_TYPES id)으로 매핑:
//   employee(시급제) / salary(월급·연봉제) / delivery(건별) /
//   shortAlba(일당) / freelancer(프로젝트) / etc(직접입력·수동)
// ══════════════════════════════════════════

// ── 직업군 정의 ──
// group: 3단계에서 보여줄 수입형태 세트 (INCOME_FORM_GROUPS 키)
var INCOME_CATEGORIES = [
  { id:'office',      icon:'🏢', name:'사무직일반',  subs:['사무','경리','인사','총무','개발자','디자이너'], group:'wage' },
  { id:'production',  icon:'🏭', name:'생산직',      subs:['제조업','조립','오퍼레이터','품질검사'],          group:'wage' },
  { id:'field',       icon:'👷', name:'현장직',      subs:['건설','설비','용접','전기','배관'],               group:'wage' },
  { id:'professional',icon:'⚖️', name:'전문직',      subs:['의사','약사','변호사','회계사','세무사'],          group:'wage' },
  { id:'education',   icon:'📚', name:'교육직',      subs:['교사','교수','강사'],                             group:'wage' },
  { id:'civil',       icon:'🏛️', name:'공무원',      subs:['국가직','지방직','군무원'],                       group:'wage' },
  { id:'safety',      icon:'🚨', name:'공공안전직',  subs:['경찰','소방관','군인'],                           group:'wage' },
  { id:'medical',     icon:'🏥', name:'보건의료직',  subs:['간호사','물리치료사','임상병리사'],               group:'wage' },
  { id:'logistics',   icon:'🚛', name:'운송·물류직', subs:['기사','택배','물류','지게차'],                    group:'wage' },
  { id:'service',     icon:'🍽️', name:'서비스직',    subs:['음식점','호텔','카페','미용'],                    group:'wage' },
  { id:'sales',       icon:'🛒', name:'판매·영업직', subs:['판매사원','보험설계사','영업'],                   group:'sales' },
  { id:'freelance',   icon:'💼', name:'프리랜서',    subs:['디자이너','작가','개발자','영상편집'],            group:'freelance' },
  { id:'self',        icon:'🏪', name:'자영업',      subs:['개인사업자','소상공인'],                          group:'self' },
  { id:'platform',    icon:'🛵', name:'플랫폼 노동', subs:['배달','대리운전','라이더'],                       group:'platform' },
  { id:'it',          icon:'💻', name:'IT·기술직',   subs:['개발자','AI 엔지니어','보안'],                    group:'wage' },
  { id:'art',         icon:'🎨', name:'예술·문화직', subs:['음악','미술','배우','유튜버'],                    group:'art' },
  { id:'none',        icon:'🌱', name:'무직',        subs:[],                                                 group:'none' },
];

// ── 직업군 그룹별 수입/급여 형태 정의 ──
// engine: 매핑되는 기존 계산 엔진(JOB_TYPES id), payUnit: salary 엔진일 때 입력 단위
var INCOME_FORM_GROUPS = {
  wage: {
    title:'급여 형태를 선택하세요',
    forms:[
      { id:'hourly',  label:'시급제', desc:'출퇴근 기록으로 급여 자동계산',        engine:'employee' },
      { id:'monthly', label:'월급제', desc:'월급 입력 → 4대보험·세금 자동계산',    engine:'salary', payUnit:'monthly' },
      { id:'annual',  label:'연봉제', desc:'연봉 입력 → 월급·실수령액 자동계산',   engine:'salary', payUnit:'annual' },
    ]
  },
  freelance: {
    title:'수입 형태를 선택하세요',
    forms:[
      { id:'project',  label:'프로젝트 단위', desc:'프로젝트 단가 기록, 3.3% 세금계산', engine:'freelancer' },
      { id:'percase',  label:'건별 수익',     desc:'건당 수입을 일별로 합산',           engine:'delivery' },
      { id:'retainer', label:'월 고정 계약',  desc:'매월 고정 계약금 기록',             engine:'freelancer' },
      { id:'manual',   label:'직접 입력',     desc:'수입이 생길 때마다 직접 기록',      engine:'etc' },
    ]
  },
  sales: {
    title:'수입 형태를 선택하세요',
    forms:[
      { id:'baseinc',  label:'기본급 + 인센티브', desc:'기본급은 월급으로, 인센티브는 추가수입으로 기록', engine:'salary', payUnit:'monthly', extraEtc:true },
      { id:'inccenter',label:'인센티브 중심',     desc:'매월 달라지는 수입을 직접 기록',                   engine:'etc' },
      { id:'monthly',  label:'월급제',            desc:'월급 입력 → 4대보험·세금 자동계산',                engine:'salary', payUnit:'monthly' },
      { id:'manual',   label:'직접 입력',         desc:'수입이 생길 때마다 직접 기록',                     engine:'etc' },
    ]
  },
  art: {
    title:'수입 형태를 선택하세요',
    forms:[
      { id:'ad',      label:'광고 수익',     desc:'광고·조회수 수익을 직접 기록',      engine:'etc' },
      { id:'project', label:'프로젝트',      desc:'프로젝트 단가 기록, 3.3% 세금계산', engine:'freelancer' },
      { id:'percase', label:'건별 수익',     desc:'건당 수입을 일별로 합산',           engine:'delivery' },
      { id:'manual',  label:'직접 입력',     desc:'수입이 생길 때마다 직접 기록',      engine:'etc' },
    ]
  },
  platform: {
    title:'수입 형태를 선택하세요',
    forms:[
      { id:'percase',  label:'건별 수익',    desc:'배달·운행 건당 수입 일별 합산',   engine:'delivery' },
      { id:'daily',    label:'일당',         desc:'날짜별로 하루 수입 기록',         engine:'shortAlba' },
      { id:'retainer', label:'월 고정 계약', desc:'매월 고정 계약금 기록',           engine:'freelancer' },
      { id:'manual',   label:'직접 입력',    desc:'수입이 생길 때마다 직접 기록',    engine:'etc' },
    ]
  },
  self: {
    title:'수입 형태를 선택하세요',
    forms:[
      { id:'monthlyavg', label:'월 수입 직접 입력', desc:'매월 순수입을 직접 기록',   engine:'etc' },
      { id:'percase',    label:'건별 수익',         desc:'건당 수입을 일별로 합산',   engine:'delivery' },
      { id:'manual',     label:'직접 입력',         desc:'수입이 생길 때마다 직접 기록', engine:'etc' },
    ]
  },
  none: { title:'', forms:[] },
};

function _iwCatById(id){
  for(var i=0;i<INCOME_CATEGORIES.length;i++) if(INCOME_CATEGORIES[i].id===id) return INCOME_CATEGORIES[i];
  return null;
}

// ── 프로필 저장/로드 ──
function loadIncomeProfile(){
  try{
    var raw = localStorage.getItem('atm2_incomeProfile');
    if(raw) return JSON.parse(raw);
  }catch(e){}
  return null;
}
function saveIncomeProfile(profile){
  try{ localStorage.setItem('atm2_incomeProfile', JSON.stringify(profile)); }catch(e){}
}

// ══════════════════════════════════════════
// 위저드 본체
// ══════════════════════════════════════════
function showIncomeWizard(){
  if(typeof _removeAllPopups === 'function') _removeAllPopups();
  var old = document.getElementById('income-wizard-overlay');
  if(old) old.remove();

  var existing = loadIncomeProfile();
  var isChanging = !!existing || (typeof loadSelectedJobs==='function' && loadSelectedJobs().length>0);

  // state: main/sides 각 항목 = { cat, sub, form } (form = {id,label,engine,payUnit})
  // step: 최초 사용자만 1(인사)→2(닉네임)→3(수익원)→4(완료), 변경 모드는 3 고정
  var state = {
    step: isChanging ? 3 : 1,
    nick: (typeof memName !== 'undefined' && memName) ? memName : '',
    main: { cat:null, sub:null, form:null },
    sides: [],
    sideOpen: null,   // 진행 중인 보조수익원 { cat, sub, form }
    sideAsked: false, // 보조수익원 질문에 답했는지
    extra: null,      // 추가수익 관리 여부 (null=미응답)
    extraTypes: [],   // 선택한 추가수익 항목들
  };

  // 추가수익 항목 프리셋
  var EXTRA_TYPES = ['보험지급액','환급금 (세금·보험)','정부지원금','상여금·보너스','이자·배당','중고거래 수입'];

  var ov = document.createElement('div');
  ov.id = 'income-wizard-overlay';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;z-index:99999;padding:16px;';
  if(isChanging){
    ov.addEventListener('click', function(e){ if(e.target === ov) ov.remove(); });
  }

  // ── 공용 스타일 ──
  var S = {
    secLbl: 'font-size:15px;font-weight:800;color:var(--accent,#4f7cff);margin:14px 0 8px;',
    doneRow: 'display:flex;align-items:center;gap:8px;background:rgba(79,124,255,.08);border:1px solid rgba(79,124,255,.25);border-radius:12px;padding:10px 12px;margin-bottom:6px;cursor:pointer;',
    qTitle: 'font-size:17px;font-weight:800;color:var(--text,#fff);margin-bottom:10px;',
    radio: 'display:flex;align-items:flex-start;gap:10px;border:1.5px solid var(--border,rgba(255,255,255,.1));background:var(--surface2,#2a2a3a);border-radius:12px;padding:12px 14px;margin-bottom:7px;cursor:pointer;transition:border-color .15s;',
    chip: 'display:inline-block;border:1.5px solid var(--border,rgba(255,255,255,.1));background:var(--surface2,#2a2a3a);border-radius:20px;padding:8px 14px;font-size:15px;font-weight:600;color:var(--text,#fff);cursor:pointer;',
  };

  function _tap(el, fn){
    var _t = 0;
    el.addEventListener('pointerup', function(e){
      var now = Date.now(); if(now - _t < 400) return; _t = now;
      fn(e);
    });
  }

  // ── 완료된 답변 요약 행 (탭하면 다시 열기) ──
  function doneRow(icon, label, value, onRedo){
    var row = document.createElement('div');
    row.style.cssText = S.doneRow;
    row.innerHTML = '<span style="font-size:18px;">'+icon+'</span>'
      + '<span style="font-size:15px;color:var(--text3,#aaa);flex-shrink:0;">'+label+'</span>'
      + '<b style="font-size:15px;color:var(--text,#fff);flex:1;">'+value+'</b>'
      + '<span style="font-size:13px;color:var(--accent,#4f7cff);font-weight:700;">변경</span>';
    _tap(row, onRedo);
    return row;
  }

  // ── 하나의 수익원 flow(3단계) 렌더 — src를 직접 수정 ──
  // done(): 3단계 완료 시 호출
  function renderSourceFlow(container, src, roleLabel, done){
    // Step 1: 직업군
    if(!src.cat){
      var q1 = document.createElement('div');
      q1.style.cssText = S.qTitle;
      q1.textContent = roleLabel + ' 직업군을 선택하세요';
      container.appendChild(q1);
      var grid = document.createElement('div');
      grid.style.cssText = 'display:grid;grid-template-columns:repeat(2,1fr);gap:7px;';
      INCOME_CATEGORIES.forEach(function(cat){
        var card = document.createElement('div');
        card.style.cssText = 'border:1.5px solid var(--border,rgba(255,255,255,.1));background:var(--surface2,#2a2a3a);border-radius:12px;padding:11px 12px;cursor:pointer;display:flex;align-items:center;gap:8px;';
        card.innerHTML = '<span style="font-size:21px;">'+cat.icon+'</span>'
          + '<div><div style="font-size:15px;font-weight:800;color:var(--text,#fff);">'+cat.name+'</div>'
          + (cat.subs.length ? '<div style="font-size:11px;color:var(--text3,#888);line-height:1.3;">'+cat.subs.slice(0,3).join('·')+(cat.subs.length>3?' 외':'')+'</div>' : '')
          + '</div>';
        _tap(card, function(){
          src.cat = cat.id; src.sub = null; src.form = null;
          if(cat.id === 'none'){ src.sub = '-'; src.form = { id:'none', label:'무직', engine:null }; done(); }
          render();
        });
        grid.appendChild(card);
      });
      container.appendChild(grid);
      return false;
    }

    var cat = _iwCatById(src.cat);
    container.appendChild(doneRow(cat.icon, '직업군', cat.name, function(){
      src.cat = null; src.sub = null; src.form = null; render();
    }));
    if(src.cat === 'none') return true; // 무직: 후속 질문 없음

    // Step 2: 세부직업
    if(!src.sub){
      var q2 = document.createElement('div');
      q2.style.cssText = S.qTitle;
      q2.textContent = '세부 직업을 선택하세요';
      container.appendChild(q2);
      var wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:7px;margin-bottom:10px;';
      cat.subs.forEach(function(sub){
        var chip = document.createElement('span');
        chip.style.cssText = S.chip;
        chip.textContent = sub;
        _tap(chip, function(){ src.sub = sub; render(); });
        wrap.appendChild(chip);
      });
      container.appendChild(wrap);
      // 직접 입력
      var row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:7px;';
      var inp = document.createElement('input');
      inp.type = 'text';
      inp.placeholder = '없으면 직접 입력 (예: 요양보호사)';
      inp.style.cssText = 'flex:1;background:var(--surface2,#2a2a3a);border:1px solid var(--border,rgba(255,255,255,.15));color:var(--text,#fff);border-radius:10px;padding:10px 12px;font-size:15px;outline:none;font-family:"Noto Sans KR",sans-serif;';
      var okBtn = document.createElement('button');
      okBtn.textContent = '확인';
      okBtn.style.cssText = 'padding:10px 16px;border-radius:10px;border:none;background:var(--accent,#4f7cff);color:#fff;font-size:15px;font-weight:700;cursor:pointer;font-family:"Noto Sans KR",sans-serif;';
      function submitCustom(){
        var v = (inp.value||'').trim();
        if(!v){ if(typeof showToast==='function') showToast('⚠️ 직업명을 입력해주세요'); return; }
        src.sub = v; render();
      }
      okBtn.addEventListener('click', submitCustom);
      inp.addEventListener('keydown', function(e){ if(e.key==='Enter'){ e.preventDefault(); submitCustom(); } });
      row.appendChild(inp); row.appendChild(okBtn);
      container.appendChild(row);
      return false;
    }

    container.appendChild(doneRow('🔖', '세부직업', src.sub, function(){
      src.sub = null; src.form = null; render();
    }));

    // Step 3: 직업군별 맞춤 수입/급여 형태
    var grp = INCOME_FORM_GROUPS[cat.group] || INCOME_FORM_GROUPS.none;
    if(!src.form){
      var q3 = document.createElement('div');
      q3.style.cssText = S.qTitle;
      q3.textContent = grp.title;
      container.appendChild(q3);
      grp.forms.forEach(function(f){
        var card = document.createElement('div');
        card.style.cssText = S.radio;
        card.innerHTML = '<span style="font-size:17px;color:var(--text3,#888);margin-top:1px;">○</span>'
          + '<div><div style="font-size:16px;font-weight:800;color:var(--text,#fff);">'+f.label+'</div>'
          + '<div style="font-size:13px;color:var(--text3,#aaa);line-height:1.4;">'+f.desc+'</div></div>';
        _tap(card, function(){
          src.form = { id:f.id, label:f.label, engine:f.engine, payUnit:f.payUnit||null, extraEtc:!!f.extraEtc };
          done(); render();
        });
        container.appendChild(card);
      });
      return false;
    }

    container.appendChild(doneRow('💰', '수입 형태', src.form.label, function(){
      src.form = null; render();
    }));
    return true; // flow 완료
  }

  function mainDone(){ return !!(state.main.cat && state.main.sub && state.main.form); }

  // ── 전체 렌더 ──
  function render(){
    ov.innerHTML = '';
    var modal = document.createElement('div');
    modal.style.cssText = 'background:var(--surface,#1e2235);border:1px solid var(--border,rgba(255,255,255,.1));border-radius:20px;max-width:520px;width:100%;max-height:calc(92vh - env(safe-area-inset-bottom,0px));overflow:hidden;box-shadow:0 24px 64px rgba(0,0,0,.5);display:flex;flex-direction:column;position:relative;';

    if(isChanging){
      var closeBtn = document.createElement('button');
      closeBtn.innerHTML = '✕';
      closeBtn.style.cssText = 'position:absolute;top:12px;right:14px;background:none;border:none;color:var(--text3);font-size:24px;cursor:pointer;z-index:2;';
      closeBtn.addEventListener('click', function(){ ov.remove(); });
      modal.appendChild(closeBtn);
    }

    var scroll = document.createElement('div');
    scroll.style.cssText = 'flex:1 1 auto;overflow-y:auto;min-height:0;padding:26px 20px 12px;-webkit-overflow-scrolling:touch;';

    // ═══ STEP 1: AI 고양이 인사 ═══
    if(state.step === 1){
      var s1 = document.createElement('div');
      s1.style.cssText = 'text-align:center;padding:18px 4px 8px;';
      s1.innerHTML = '<div style="margin-bottom:12px;"><img src="img/emoji/환영인사.png" alt="머니냥" style="width:84px;height:84px;object-fit:cover;border-radius:50%;"></div>'
        + '<h2 style="font-size:23px;font-weight:800;margin-bottom:12px;color:var(--text,#fff);">안녕하세요!</h2>'
        + '<div style="font-size:15px;color:var(--text,#ddd);line-height:1.7;">오늘도 정말 고생 많으셨어요.<br><br>열심히 일해서 번 소중한 수입,<br>이번 달도 무사히 버틸 수 있도록<br>제가 꼼꼼하게 관리해드릴게요.</div>'
        + '<div style="font-size:14px;color:var(--text3,#aaa);line-height:1.6;margin-top:14px;">그러려면 먼저 몇 가지만 알려주세요.<br>금방 끝나요. 😊</div>';
      scroll.appendChild(s1);
    }

    // ═══ STEP 2: 닉네임 ═══
    if(state.step === 2){
      var s2 = document.createElement('div');
      s2.style.cssText = 'text-align:center;padding:14px 4px 4px;';
      s2.innerHTML = '<div style="margin-bottom:10px;"><img src="img/emoji/모를때.png" alt="머니냥" style="width:72px;height:72px;object-fit:cover;border-radius:50%;"></div>'
        + '<h2 style="font-size:21px;font-weight:800;margin-bottom:8px;color:var(--text,#fff);">제가 뭐라고 불러드리면 될까요?</h2>'
        + '<div style="font-size:14px;color:var(--text3,#aaa);margin-bottom:16px;">닉네임 또는 이름을 입력해 주세요.</div>';
      scroll.appendChild(s2);
      var nickInp = document.createElement('input');
      nickInp.type = 'text';
      nickInp.id = 'iw-nick-input';
      nickInp.maxLength = 12;
      nickInp.placeholder = '예: 현우, 알바냥';
      nickInp.value = state.nick || '';
      nickInp.style.cssText = 'width:100%;box-sizing:border-box;background:var(--surface2,#2a2a3a);border:1.5px solid var(--accent,#4f7cff);color:var(--text,#fff);border-radius:12px;padding:13px 14px;font-size:17px;text-align:center;outline:none;font-family:"Noto Sans KR",sans-serif;';
      nickInp.addEventListener('input', function(){ state.nick = nickInp.value; });
      nickInp.addEventListener('keydown', function(e){ if(e.key==='Enter'){ e.preventDefault(); goNext(); } });
      scroll.appendChild(nickInp);
      var nickHint = document.createElement('div');
      nickHint.style.cssText = 'font-size:13px;color:var(--text3,#888);margin-top:12px;text-align:center;';
      nickHint.textContent = '💬 언제든지 설정에서 변경할 수 있어요.';
      var nickHint2 = document.createElement('div');
      nickHint2.style.cssText = 'font-size:13px;color:var(--text3,#888);margin-top:4px;text-align:center;';
      nickHint2.textContent = '입력하지 않아도 괜찮아요.';
      scroll.appendChild(nickHint);
      scroll.appendChild(nickHint2);
    }

    // ═══ STEP 4: 완료 ═══
    if(state.step === 4){
      var s4 = document.createElement('div');
      s4.style.cssText = 'text-align:center;padding:18px 4px 8px;';
      s4.innerHTML = '<div style="margin-bottom:12px;"><img src="img/emoji/칭찬축하.png" alt="머니냥" style="width:84px;height:84px;object-fit:cover;border-radius:50%;"></div>'
        + '<h2 style="font-size:23px;font-weight:800;margin-bottom:12px;color:var(--text,#fff);">감사합니다! 🎉</h2>'
        + '<div style="font-size:15px;color:var(--text,#ddd);line-height:1.7;">이제부터는<br>이번 달도 무사히 버틸 수 있도록<br>제가 함께 관리해드릴게요.</div>'
        + '<div style="font-size:14px;color:var(--text3,#aaa);line-height:1.6;margin-top:14px;">수입과 지출이 바뀔 때마다<br>예상 잔액과 생존 가능성을<br>계속 계산해드리겠습니다.<br><br>궁금한 점은 언제든 저를 눌러 물어봐 주세요.</div>';
      scroll.appendChild(s4);
    }

    // ═══ STEP 3 헤더 (수익원 등록) ═══
    if(state.step === 3){
    var hdr = document.createElement('div');
    hdr.style.cssText = 'text-align:center;margin-bottom:14px;';
    var nick3 = (state.nick||'').trim();
    hdr.innerHTML = (isChanging
        ? '<div style="font-size:40px;margin-bottom:6px;">🔄</div>'
        : '<div style="margin-bottom:6px;"><img src="img/emoji/수입돈.png" alt="머니냥" style="width:64px;height:64px;object-fit:cover;border-radius:50%;"></div>')
      + '<h2 style="font-size:23px;font-weight:800;margin-bottom:4px;color:var(--text,#fff);">'+(isChanging?'수익원 변경':(nick3? nick3+'님, 반가워요! 😊':'반가워요! 😊'))+'</h2>'
      + '<div style="font-size:14px;color:var(--text3,#aaa);line-height:1.5;">'+(isChanging?'직업에 맞춰 수입 관리 방식을 자동으로 설정해 드려요':'이제 정확한 계산을 위해<br><b>수익원</b>을 알려주세요.<br><br>입력해주신 정보를 바탕으로 이번 달<br>생존 가능성과 예상 수입을 계산해드릴게요.')+'</div>'
      + (isChanging?'':'<div style="font-size:12px;color:var(--text3,#777);margin-top:8px;">💡 건너뛰어도 괜찮아요. 직업 설정 변경에서 언제든 설정할 수 있어요.</div>');
    scroll.appendChild(hdr);

    // ═══ 섹션 1: 메인수익원 ═══
    var lbl1 = document.createElement('div');
    lbl1.style.cssText = S.secLbl;
    lbl1.innerHTML = '1️⃣ 메인수익원 <span style="font-weight:600;color:var(--text3,#888);font-size:13px;">— 주 수입의 기본</span>';
    scroll.appendChild(lbl1);
    var mainBox = document.createElement('div');
    renderSourceFlow(mainBox, state.main, '메인수익원', function(){});
    scroll.appendChild(mainBox);

    // ═══ 섹션 2: 보조수익원 (메인 완료 후) ═══
    if(mainDone()){
      var lbl2 = document.createElement('div');
      lbl2.style.cssText = S.secLbl;
      lbl2.innerHTML = '2️⃣ 보조수익원 <span style="font-weight:600;color:var(--text3,#888);font-size:13px;">— 투잡·쓰리잡 등 추가 수익 활동</span>';
      scroll.appendChild(lbl2);

      // 확정된 보조수익원 목록
      state.sides.forEach(function(side, idx){
        var c = _iwCatById(side.cat) || {icon:'💼',name:side.cat};
        scroll.appendChild(doneRow(c.icon, '보조 '+(idx+1), c.name+' · '+side.sub+' · '+side.form.label, function(){
          state.sides.splice(idx,1); state.sideAsked = false; render();
        }));
      });

      if(state.sideOpen){
        // 진행 중인 보조수익원 flow
        var sideBox = document.createElement('div');
        var finished = renderSourceFlow(sideBox, state.sideOpen, '보조수익원', function(){
          // 완료 → 목록에 확정
          if(state.sideOpen && state.sideOpen.cat !== 'none'){
            state.sides.push(state.sideOpen);
          }
          state.sideOpen = null;
          state.sideAsked = true;
        });
        scroll.appendChild(sideBox);
        if(!finished){
          var cancelBtn = document.createElement('button');
          cancelBtn.textContent = '취소';
          cancelBtn.style.cssText = 'width:100%;padding:9px;border-radius:10px;border:1px solid var(--border,rgba(255,255,255,.15));background:transparent;color:var(--text3,#888);font-size:14px;cursor:pointer;margin-top:6px;';
          cancelBtn.addEventListener('click', function(){ state.sideOpen = null; render(); });
          scroll.appendChild(cancelBtn);
        }
      } else {
        var btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;gap:8px;';
        var addBtn = document.createElement('button');
        addBtn.textContent = '➕ 보조수익원 추가';
        addBtn.style.cssText = 'flex:1;padding:11px;border-radius:11px;border:1.5px dashed var(--accent,#4f7cff);background:rgba(79,124,255,.06);color:var(--accent,#4f7cff);font-size:15px;font-weight:700;cursor:pointer;font-family:"Noto Sans KR",sans-serif;';
        addBtn.addEventListener('click', function(){
          state.sideOpen = { cat:null, sub:null, form:null };
          render();
        });
        btnRow.appendChild(addBtn);
        if(!state.sideAsked && state.sides.length === 0){
          var noBtn = document.createElement('button');
          noBtn.textContent = '없어요';
          noBtn.style.cssText = 'flex:0 0 90px;padding:11px;border-radius:11px;border:1px solid var(--border,rgba(255,255,255,.15));background:transparent;color:var(--text3,#888);font-size:15px;cursor:pointer;font-family:"Noto Sans KR",sans-serif;';
          noBtn.addEventListener('click', function(){ state.sideAsked = true; render(); });
          btnRow.appendChild(noBtn);
        }
        scroll.appendChild(btnRow);
      }
    }

    // ═══ 섹션 3: 추가수익 (보조 질문 응답 후) ═══
    var sideSettled = mainDone() && !state.sideOpen && (state.sideAsked || state.sides.length > 0);
    if(sideSettled){
      var lbl3 = document.createElement('div');
      lbl3.style.cssText = S.secLbl;
      lbl3.innerHTML = '3️⃣ 추가수익 <span style="font-weight:600;color:var(--text3,#888);font-size:13px;">— 보험지급액·환급금 등 일시적 수입</span>';
      scroll.appendChild(lbl3);

      if(state.extra === null){
        var q = document.createElement('div');
        q.style.cssText = S.qTitle;
        q.textContent = '일시적 수입도 함께 관리할까요?';
        scroll.appendChild(q);
        var exRow = document.createElement('div');
        exRow.style.cssText = 'display:flex;gap:8px;';
        [{v:true,label:'네, 관리할래요'},{v:false,label:'아니요'}].forEach(function(o){
          var b = document.createElement('button');
          b.textContent = o.label;
          b.style.cssText = 'flex:1;padding:11px;border-radius:11px;border:1.5px solid '+(o.v?'var(--accent,#4f7cff)':'var(--border,rgba(255,255,255,.15))')+';background:'+(o.v?'rgba(79,124,255,.08)':'transparent')+';color:'+(o.v?'var(--accent,#4f7cff)':'var(--text3,#888)')+';font-size:15px;font-weight:700;cursor:pointer;font-family:"Noto Sans KR",sans-serif;';
          b.addEventListener('click', function(){ state.extra = o.v; state.extraTypes = []; render(); });
          exRow.appendChild(b);
        });
        scroll.appendChild(exRow);
      } else if(state.extra === false){
        scroll.appendChild(doneRow('➕', '추가수익', '관리 안 함', function(){
          state.extra = null; state.extraTypes = []; render();
        }));
      } else {
        // 관리함 → 어떤 추가수익인지 항목 선택 (복수 선택 + 직접 입력)
        scroll.appendChild(doneRow('➕', '추가수익', '관리함', function(){
          state.extra = null; state.extraTypes = []; render();
        }));
        var q2 = document.createElement('div');
        q2.style.cssText = S.qTitle;
        q2.textContent = '어떤 추가수익인가요? (모두 선택)';
        scroll.appendChild(q2);
        var typeWrap = document.createElement('div');
        typeWrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:7px;margin-bottom:10px;';
        // 프리셋 + 사용자가 직접 입력한 항목
        var allTypes = EXTRA_TYPES.slice();
        state.extraTypes.forEach(function(t){ if(allTypes.indexOf(t) < 0) allTypes.push(t); });
        allTypes.forEach(function(t){
          var sel = state.extraTypes.indexOf(t) >= 0;
          var chip = document.createElement('span');
          chip.style.cssText = S.chip + (sel ? 'border-color:var(--accent,#4f7cff);background:rgba(79,124,255,.12);color:var(--accent,#4f7cff);' : '');
          chip.textContent = (sel ? '✓ ' : '') + t;
          _tap(chip, function(){
            var i = state.extraTypes.indexOf(t);
            if(i >= 0) state.extraTypes.splice(i,1);
            else state.extraTypes.push(t);
            render();
          });
          typeWrap.appendChild(chip);
        });
        scroll.appendChild(typeWrap);
        // 직접 입력
        var exInpRow = document.createElement('div');
        exInpRow.style.cssText = 'display:flex;gap:7px;';
        var exInp = document.createElement('input');
        exInp.type = 'text';
        exInp.placeholder = '없으면 직접 입력 (예: 경조사비)';
        exInp.style.cssText = 'flex:1;background:var(--surface2,#2a2a3a);border:1px solid var(--border,rgba(255,255,255,.15));color:var(--text,#fff);border-radius:10px;padding:10px 12px;font-size:15px;outline:none;font-family:"Noto Sans KR",sans-serif;';
        var exOk = document.createElement('button');
        exOk.textContent = '추가';
        exOk.style.cssText = 'padding:10px 16px;border-radius:10px;border:none;background:var(--accent,#4f7cff);color:#fff;font-size:15px;font-weight:700;cursor:pointer;font-family:"Noto Sans KR",sans-serif;';
        function addCustomExtra(){
          var v = (exInp.value||'').trim();
          if(!v){ if(typeof showToast==='function') showToast('⚠️ 항목명을 입력해주세요'); return; }
          if(state.extraTypes.indexOf(v) < 0) state.extraTypes.push(v);
          render();
        }
        exOk.addEventListener('click', addCustomExtra);
        exInp.addEventListener('keydown', function(e){ if(e.key==='Enter'){ e.preventDefault(); addCustomExtra(); } });
        exInpRow.appendChild(exInp); exInpRow.appendChild(exOk);
        scroll.appendChild(exInpRow);
      }
    }
    } // end step 3

    modal.appendChild(scroll);

    // ═══ 하단 고정 버튼 ═══
    // 추가수익 '관리함'이면 항목을 1개 이상 선택해야 완료 가능
    var ready = sideSettled && (state.extra === false || (state.extra === true && state.extraTypes.length > 0));

    function goNext(){
      if(state.step === 2){
        // 닉네임은 필수가 아님 — 비어 있으면 이름 없이 진행
        state.nick = (state.nick||'').trim();
      }
      if(state.step === 3 && !ready) return;
      state.step++;
      render();
    }

    function mkBtn(label, primary, enabled, onTap){
      var b = document.createElement('button');
      b.textContent = label;
      b.style.cssText = (primary
        ? 'flex:1;padding:14px;border-radius:10px;border:none;background:'+(enabled?'var(--accent,#4f7cff)':'var(--border,rgba(255,255,255,.15))')+';color:'+(enabled?'#fff':'var(--text3,#888)')+';font-size:18px;font-weight:700;cursor:'+(enabled?'pointer':'not-allowed')+';'
        : 'flex:0 0 92px;padding:14px;border-radius:10px;border:1px solid var(--border,rgba(255,255,255,.15));background:transparent;color:var(--text3,#aaa);font-size:16px;font-weight:600;cursor:pointer;')
        + 'font-family:"Noto Sans KR",sans-serif;';
      b.addEventListener('click', onTap);
      return b;
    }

    var footer = document.createElement('div');
    footer.style.cssText = 'flex-shrink:0;padding:10px 20px 16px;background:var(--surface,#1e2235);border-top:1px solid var(--border,rgba(255,255,255,.1));';

    if(!isChanging){
      var stepInd = document.createElement('div');
      stepInd.style.cssText = 'display:flex;justify-content:center;gap:6px;margin-bottom:10px;';
      for(var si=1;si<=4;si++){
        var dot = document.createElement('div');
        dot.style.cssText = 'width:'+(si===state.step?'18px':'6px')+';height:6px;border-radius:3px;background:'+(si===state.step?'var(--accent,#4f7cff)':'var(--border,rgba(255,255,255,.2))')+';transition:all .2s;';
        stepInd.appendChild(dot);
      }
      footer.appendChild(stepInd);
    }

    var btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:8px;';

    if(isChanging){
      btnRow.appendChild(mkBtn(ready ? '✅ 설정 완료' : '질문에 답해주세요', true, ready, function(){
        if(!ready) return;
        finishWizard(state);
        ov.remove();
      }));
    } else if(state.step === 1){
      btnRow.appendChild(mkBtn('건너뛰기', false, true, function(){ state.nick = ''; state.step = 3; render(); }));
      btnRow.appendChild(mkBtn('다음', true, true, goNext));
    } else if(state.step === 2){
      btnRow.appendChild(mkBtn('이전', false, true, function(){ state.step = 1; render(); }));
      btnRow.appendChild(mkBtn('건너뛰기', false, true, function(){ state.nick = ''; state.step = 3; render(); }));
      btnRow.appendChild(mkBtn('다음', true, true, goNext));
    } else if(state.step === 3){
      btnRow.appendChild(mkBtn('이전', false, true, function(){ state.step = 2; render(); }));
      btnRow.appendChild(mkBtn('건너뛰기', false, true, function(){ state.step = 4; render(); }));
      btnRow.appendChild(mkBtn(ready ? '다음' : '질문에 답해주세요', true, ready, goNext));
    } else { // step 4
      btnRow.appendChild(mkBtn('이전', false, true, function(){ state.step = 3; render(); }));
      btnRow.appendChild(mkBtn('✅ 완료', true, true, function(){
        _iwSaveNick((state.nick||'').trim());
        finishWizard(state);
        ov.remove();
      }));
    }
    footer.appendChild(btnRow);
    modal.appendChild(footer);
    ov.appendChild(modal);

    // 닉네임 단계면 입력창 포커스
    if(state.step === 2){
      setTimeout(function(){ var i = document.getElementById('iw-nick-input'); if(i) i.focus(); }, 60);
    }
  }

  render();
  document.body.appendChild(ov);
}

// ── 닉네임 저장 (AI 비서 memName + 직원 프로필 name 연동) ──
function _iwSaveNick(nick){
  if(!nick) return;
  try{
    if(typeof memName !== 'undefined') memName = nick;
    if(typeof empUpdate === 'function' && typeof activeWpId !== 'undefined' && activeWpId && activeEmpId){
      empUpdate(activeWpId, activeEmpId, { name: nick });
    }
    if(typeof memSave === 'function' && typeof activeWpId !== 'undefined' && activeWpId && activeEmpId){
      memSave(activeWpId, activeEmpId, { name: nick, payday: (typeof memPayday!=='undefined'?memPayday:null), company: (typeof memCompany!=='undefined'?memCompany:null), jobTitle: (typeof memJobTitle!=='undefined'?memJobTitle:null), hourlyRate: (typeof memHourlyRate!=='undefined'?memHourlyRate:null), onboardingDone: (typeof onboardingDone!=='undefined'?onboardingDone:false) });
    }
    if(typeof updateEmpSwitcher === 'function') updateEmpSwitcher();
  }catch(e){}
}

// ── 위저드 완료 → 엔진 매핑 + 저장 + 후속 팝업 ──
function finishWizard(state){
  var sources = [state.main].concat(state.sides);
  var engines = [];
  var salaryPayUnit = null;

  var employeeCount = 0;
  sources.forEach(function(s){
    if(!s.form || !s.form.engine) return;
    if(engines.indexOf(s.form.engine) < 0) engines.push(s.form.engine);
    if(s.form.engine === 'salary' && s.form.payUnit && !salaryPayUnit) salaryPayUnit = s.form.payUnit;
    if(s.form.extraEtc && engines.indexOf('etc') < 0) engines.push('etc');
    // v3.0: 시급제(employee) 소스가 2개 이상이면 2번째부터 별도 사업장으로 등록
    //       (하나의 employee 엔진이 CompanyEngine을 통해 사업장 단위로 반복 계산)
    if(s.form.engine === 'employee'){
      employeeCount++;
      if(employeeCount >= 2 && typeof CompanyEngine !== 'undefined'){
        try{
          var cat = _iwCatById(s.cat);
          var coName = (cat ? cat.name : '보조 사업장') + (s.sub && s.sub!=='-' ? ' ('+s.sub+')' : '');
          var co = CompanyEngine.ensureWorkplace(coName, { name: (state.nick||'나') });
          s.wpId = co.wpId;   // 프로필에 사업장 매핑 저장
        }catch(e){}
      }
    }
  });
  if(state.extra && engines.indexOf('etc') < 0) engines.push('etc');
  if(engines.length === 0) engines.push('etc'); // 무직 단독 → 최소 수동입력으로 생존관리 사용 가능

  // 프로필 저장 (표시용 메타)
  saveIncomeProfile({
    main: { cat: state.main.cat, sub: state.main.sub, form: state.main.form },
    sides: state.sides.map(function(s){ return { cat:s.cat, sub:s.sub, form:s.form, wpId:s.wpId||null }; }),
    extra: !!state.extra,
    extraTypes: state.extra ? (state.extraTypes || []) : [],
    savedAt: new Date().toISOString(),
  });
  // 월급제/연봉제 입력 단위 (설정 화면에서 사용)
  try{
    if(salaryPayUnit) localStorage.setItem('atm2_salaryPayUnit', salaryPayUnit);
  }catch(e){}

  if(typeof saveSelectedJobs === 'function') saveSelectedJobs(engines);
  if(typeof applyJobTypeUI === 'function') applyJobTypeUI();

  // 후속 설정 팝업 (기존 v2.0 우선순위 유지)
  if(engines.indexOf('employee') >= 0 && typeof showWorkTypeSelector === 'function'){
    setTimeout(function(){ showWorkTypeSelector('employee'); }, 200);
    return;
  }
  if(engines.indexOf('salary') >= 0 && typeof showSalarySetupPopup === 'function'){
    setTimeout(function(){ showSalarySetupPopup(); }, 200);
    return;
  }
  if(typeof renderCalendar === 'function' && !(engines.length===1 && engines[0]==='freelancer')) renderCalendar();
  if(engines.length===1 && engines[0]==='freelancer' && typeof initTutorial==='function'){ try{ initTutorial(); }catch(e){} }
  showPage('home');
  var mainCat = _iwCatById(state.main.cat);
  if(typeof showToast === 'function') showToast('✅ ' + (mainCat?mainCat.icon+' '+mainCat.name:'수익원') + ' 설정 완료');
  if(typeof HomeStage !== 'undefined') HomeStage.advance(1);
  if(typeof showJobSelectedGuide === 'function') showJobSelectedGuide();
}
