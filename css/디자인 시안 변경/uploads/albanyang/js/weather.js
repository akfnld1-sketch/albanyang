// ══════════════════════════════════════════════════════════════
// weather.js — 홈 대시보드 (날씨 + 브리핑 + 금융 요약)
// v=20260701a
// ══════════════════════════════════════════════════════════════

// ── HomeStage: 사용자 진행 단계 관리 (단방향, 절대 내려가지 않음) ──
var HomeStage = (function(){
  var KEY = 'moneynyang_setup_stage';
  return {
    get: function(){
      try{ return Math.max(0, parseInt(localStorage.getItem(KEY)||'0')||0); }catch(e){ return 0; }
    },
    advance: function(toStage){
      var cur = this.get();
      if(toStage > cur && toStage >= 1 && toStage <= 3){
        try{ localStorage.setItem(KEY, String(toStage)); }catch(e){}
      }
    }
  };
})();


// ── WeatherProvider: Open-Meteo + BigDataCloud 호출·캐시 ──
var WeatherProvider = (function(){
  var CACHE_KEY = 'moneynyang_weather_v1';
  var TTL = 30 * 60 * 1000; // 30분

  var WMO = {
    0:{i:'☀️',t:'맑음'}, 1:{i:'🌤️',t:'구름 조금'}, 2:{i:'🌥️',t:'흐림'}, 3:{i:'☁️',t:'매우 흐림'},
    45:{i:'🌫️',t:'안개'}, 48:{i:'🌫️',t:'안개'},
    51:{i:'🌦️',t:'이슬비'}, 53:{i:'🌦️',t:'이슬비'}, 55:{i:'🌧️',t:'강한 이슬비'},
    61:{i:'🌧️',t:'비'}, 63:{i:'🌧️',t:'비'}, 65:{i:'🌧️',t:'폭우'},
    71:{i:'🌨️',t:'눈'}, 73:{i:'🌨️',t:'눈'}, 75:{i:'❄️',t:'폭설'},
    80:{i:'⛈️',t:'소나기'}, 81:{i:'⛈️',t:'소나기'}, 82:{i:'⛈️',t:'강한 소나기'},
    95:{i:'⛈️',t:'뇌우'}, 96:{i:'⛈️',t:'뇌우+우박'}, 99:{i:'⛈️',t:'강한 뇌우'}
  };

  function _pm(pm25){
    if(pm25===null||pm25===undefined) return null;
    if(pm25<15) return {text:'좋음',   color:'var(--green)' };
    if(pm25<35) return {text:'보통',   color:'var(--yellow)'};
    if(pm25<75) return {text:'나쁨',   color:'var(--red)'   };
                return {text:'매우나쁨',color:'#c0392b'     };
  }

  function _load(){
    try{
      var raw = localStorage.getItem(CACHE_KEY);
      if(!raw) return null;
      var d = JSON.parse(raw);
      if(Date.now()-d.ts > TTL) return null;
      return d;
    }catch(e){ return null; }
  }

  function _save(data){
    try{ localStorage.setItem(CACHE_KEY, JSON.stringify(data)); }catch(e){}
  }

  return {
    getCache: _load,
    fetch: function(onOk, onErr){
      var c = _load();
      if(c){ if(onOk) onOk(c); return; }
      if(!navigator.geolocation){ if(onErr) onErr('NO_GEO'); return; }
      navigator.geolocation.getCurrentPosition(
        function(pos){
          var lat = parseFloat(pos.coords.latitude.toFixed(4));
          var lon = parseFloat(pos.coords.longitude.toFixed(4));
          var wUrl = 'https://api.open-meteo.com/v1/forecast'
            +'?latitude='+lat+'&longitude='+lon
            +'&current=temperature_2m,apparent_temperature,weather_code,precipitation_probability'
            +'&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max'
            +'&timezone=Asia%2FSeoul&forecast_days=1';
          var aqUrl = 'https://air-quality-api.open-meteo.com/v1/air-quality'
            +'?latitude='+lat+'&longitude='+lon+'&current=pm2_5&timezone=Asia%2FSeoul';
          var geoUrl = 'https://api.bigdatacloud.net/data/reverse-geocode-client'
            +'?latitude='+lat+'&longitude='+lon+'&localityLanguage=ko';
          Promise.all([
            fetch(wUrl).then(function(r){ return r.ok?r.json():Promise.reject('w'); }),
            fetch(aqUrl).then(function(r){ return r.ok?r.json():null; }).catch(function(){return null;}),
            fetch(geoUrl).then(function(r){ return r.ok?r.json():null; }).catch(function(){return null;})
          ]).then(function(res){
            var w=res[0], aq=res[1], geo=res[2];
            var wm = WMO[w.current.weather_code]||{i:'🌡️',t:'날씨 정보'};
            var pm25 = (aq&&aq.current&&aq.current.pm2_5!==undefined)?Math.round(aq.current.pm2_5):null;
            var loc = geo?(geo.locality||geo.city||geo.principalSubdivision||''):'';
            var data = {
              icon:wm.i, text:wm.t,
              temp:Math.round(w.current.temperature_2m),
              feelsLike:Math.round(w.current.apparent_temperature),
              maxTemp:Math.round(w.daily.temperature_2m_max[0]),
              minTemp:Math.round(w.daily.temperature_2m_min[0]),
              rainPct:Math.round(w.current.precipitation_probability||w.daily.precipitation_probability_max[0]||0),
              pm25:pm25, pmLevel:_pm(pm25), location:loc, ts:Date.now()
            };
            _save(data);
            if(onOk) onOk(data);
          }).catch(function(e){ if(onErr) onErr(e); });
        },
        function(e){ if(onErr) onErr(e); },
        {timeout:10000, maximumAge:300000}
      );
    }
  };
})();


// ── WeatherBuilder: 원시 데이터 → 분석용 정규화 JSON ──
var WeatherBuilder = {
  build: function(raw){
    if(!raw) return null;
    return {
      icon:raw.icon, text:raw.text, temp:raw.temp,
      feelsLike:raw.feelsLike, maxTemp:raw.maxTemp, minTemp:raw.minTemp,
      rainPct:raw.rainPct, pm25:raw.pm25, pmLevel:raw.pmLevel, location:raw.location,
      isHot:   raw.temp>=30,
      isCold:  raw.temp<10,
      isRainy: raw.rainPct>=60,
      // 현재 실제로 비/눈이 내리는 중인지 — WMO 텍스트 기반 (예보 확률과 구분)
      isRainingNow: /비|소나기|뇌우|폭우/.test(raw.text||''),
      isSnowingNow: /눈|폭설/.test(raw.text||''),
      isBadPm: !!(raw.pmLevel&&(raw.pmLevel.text==='나쁨'||raw.pmLevel.text==='매우나쁨')),
      ts:raw.ts
    };
  }
};


// ── WeatherFormatter: JSON → HTML 카드 문자열 ──
var WeatherFormatter = {
  loading: function(){
    return '<div class="home-wx-state">📍 날씨 정보를 불러오는 중...</div>';
  },
  unavail: function(){
    return '<div class="home-wx-unavail">'
      +'<span class="hwx-unavail-ico">📍</span>'
      +'<div class="hwx-unavail-txt">위치 권한을 허용하면<br>날씨와 AI 브리핑이 연결돼요</div>'
      +'<button class="hwx-unavail-btn" onclick="WeatherProvider.fetch(function(d){var e=document.getElementById(\'home-wx-wrap\');if(e)e.innerHTML=WeatherFormatter.compact(WeatherBuilder.build(d));},function(){})">위치 허용 재시도</button>'
      +'</div>';
  },
  compact: function(d){
    if(!d) return WeatherFormatter.unavail();
    var pm = d.pmLevel
      ? '<span class="hwx-chip hwx-pm" style="color:'+d.pmLevel.color+'">미세먼지 '+d.pmLevel.text+'</span>'
      : '';
    return '<div class="home-wx-compact">'
      +'<span class="hwx-ci">'+d.icon+'</span>'
      +'<div class="hwx-meta">'
      +'<span class="hwx-ct">'+d.temp+'° <span class="hwx-cd">'+d.text+'</span></span>'
      +(d.location?'<span class="hwx-loc">📍 '+d.location+'</span>':'')
      +'</div>'
      +'<div class="hwx-side">'
      +'<span class="hwx-chip">강수 '+d.rainPct+'%</span>'
      +pm
      +'</div>'
      +'</div>';
  },
  full: function(d){
    if(!d) return WeatherFormatter.unavail();
    var pm = d.pmLevel
      ? '<div class="hwx-chip">미세먼지 <b style="color:'+d.pmLevel.color+'">'+d.pmLevel.text+'</b></div>'
      : '';
    return '<div class="home-wx-full">'
      +'<div class="hwx-row">'
      +'<div><div class="hwx-bi">'+d.icon+'</div>'
      +(d.location?'<div class="hwx-loc">📍 '+d.location+'</div>':'')+'</div>'
      +'<div class="hwx-rhs"><div class="hwx-bt">'+d.temp+'<span class="hwx-bu">°</span></div>'
      +'<div class="hwx-bd">'+d.text+'</div></div>'
      +'</div>'
      +'<div class="hwx-chips">'
      +'<div class="hwx-chip">체감 <b>'+d.feelsLike+'°</b></div>'
      +'<div class="hwx-chip">최고 <b>'+d.maxTemp+'°</b> / 최저 <b>'+d.minTemp+'°</b></div>'
      +'<div class="hwx-chip">강수 <b>'+d.rainPct+'%</b></div>'
      +pm
      +'</div>'
      +'</div>';
  }
};


// 실제 출근/근무 기록 여부 (employee·회사알바) — dayData에 status가 채워진 날짜가 있는지.
// 'public'(공휴일)은 leave.js가 자동으로 채워 넣는 시스템 마커이므로 사용자 입력으로 보지 않음.
// finalPay(예상 실수령액)는 이 출근 기록을 근거로 계산되므로, finalPay 표시 신뢰 여부는
// 반드시 이 함수로만 판단한다 — 예산 설정 등 다른 신호로는 finalPay를 신뢰할 수 없음.
function _hasAttendance(){
  try{
    if(typeof dayData!=='undefined'){
      return Object.keys(dayData).some(function(k){
        var d = dayData[k];
        return d && d.status && d.status!=='none' && d.status!=='public';
      });
    }
  }catch(e){}
  return false;
}

// Home 전체에서 "실제 데이터가 있는가"를 판정하는 단일 기준 (금융카드 노출 여부 등에 사용).
// getPayData()/getIncomeSummary()는 직업만 선택해도 기본급 가정으로 0보다 큰 값을
// 반환할 수 있어(미입력 상태에서도 finalPay>0) 신뢰할 수 없으므로 사용하지 않는다.
// 대신 사용자가 직접 남긴 원천 기록만 확인한다.
function _hasRealData(){
  // 1) 실제 출근/근무 기록
  if(_hasAttendance()) return true;

  // 2) 예산 설정 (고정비/변동비/커스텀 수입 — budgetState 직접 입력값)
  try{
    var bs = typeof budgetState!=='undefined' ? budgetState : null;
    if(bs&&!bs._loaded&&typeof budgetLoad==='function') budgetLoad();
    if(bs){
      var fixed = Object.values(bs.fixedExpenses||{}).reduce(function(s,v){return s+(parseInt(v)||0);},0);
      if(fixed>0 || (bs.variableExpenses||[]).length>0 || (bs.customIncome||0)>0) return true;
    }
  }catch(e){}

  // 3) 프리랜서·배달·시간제 알바·기타 수입 항목 (njob 데이터 — 이번달 기준)
  try{
    if(typeof njobLoad==='function' && typeof dk==='function'){
      var today=new Date(), y=today.getFullYear(), m=today.getMonth();
      var dim = new Date(y,m+1,0).getDate();
      for(var d=1; d<=dim; d++){
        var nd = njobLoad(dk(y,m,d));
        if((nd.alba&&nd.alba.length) || (nd.delivery&&nd.delivery.length) ||
           (nd.free&&nd.free.length) || (nd.etc&&nd.etc.length)) return true;
      }
    }
  }catch(e2){}

  return false;
}

// ── HomeDashboardBuilder: 금융·브리핑·목표 데이터 생성 ──
var HomeDashboardBuilder = {

  financial: function(){
    try{
      var today=new Date(), y=today.getFullYear(), m=today.getMonth();
      var income = typeof getIncomeSummary==='function' ? getIncomeSummary(y,m) : {total:0};
      var incTotal = income.total||0;
      var pay = typeof getPayData==='function' ? getPayData() : null;
      var finalPay = pay?(pay.finalPay||0):0;
      // 세전+세후 동시 표시 정책 — grossPay는 직장인 전용(getPayData 기반). 표시용으로만 전달
      var grossPay = pay?(pay.grossPay||0):0;
      // ★ getIncomeSummary()는 직장인의 경우 finalPay를 그대로 합산하는데, 출근 기록이
      //   없어도 finalPay는 기본급 가정으로 0보다 클 수 있다. "오늘 사용 가능"/"이번달 잔여"가
      //   "예상 실수령액"과 동일한 정책을 따르도록, 출근 기록 없는 직장인의 기여분은 incTotal에서 제외
      //   (assistant.js의 _budget()/report()와 동일 정책 — budget.js:849 employee=pd.finalPay 합산 구조 보정)
      var hasAtt = _hasAttendance();
      try{
        var selJobsFin = JSON.parse(localStorage.getItem('atm2_selectedJobs')||'[]');
        if(!hasAtt && selJobsFin.indexOf('employee')>=0) incTotal = Math.max(0, incTotal-finalPay);
        // ★ P0-2: getPayData()는 직장인 전용 계산 — 회사알바의 출근 기록이 hasAtt를 true로
        //   만들면 직장인 fallback(월 예상액)이 "예상 실수령액" 칸에 그대로 노출되던 문제.
        //   직장인이 아니면 getPayData 값을 버리고, 회사알바는 동일 기록 기반의
        //   getAlbaPaySummary(수입관리·생존관리와 같은 원천)로 대체(계산식 비변경, 표시값 선택만)
        if(selJobsFin.indexOf('employee')<0){
          finalPay = 0;
          grossPay = 0; // grossPay(세전)는 직장인 전용 — 회사알바는 기존 단일 표시 유지
          var subFin = '';
          try{ subFin = localStorage.getItem('atm2_albaSubtype')||''; }catch(e1b){}
          if(selJobsFin.indexOf('convenience')>=0 && subFin==='company' && typeof getAlbaPaySummary==='function'){
            var apFin = getAlbaPaySummary(y,m);
            if(apFin && apFin.finalPay>0) finalPay = apFin.finalPay;
          }
        }
      }catch(e1){}
      // v2.0: 연봉제 — 확정 계약값(연봉)이므로 출근 기록과 무관하게 신뢰 가능
      var salaryNet = 0, salaryGross = 0;
      try{
        var selJobsSal = JSON.parse(localStorage.getItem('atm2_selectedJobs')||'[]');
        if(selJobsSal.indexOf('salary')>=0 && typeof getSalaryPayData==='function'){
          var sdFin = getSalaryPayData();
          if(sdFin.configured){ salaryNet = sdFin.netPay||0; salaryGross = sdFin.monthly||0; }
        }
      }catch(eS){}
      var bs = typeof budgetState!=='undefined' ? budgetState : null;
      if(bs&&!bs._loaded&&typeof budgetLoad==='function') budgetLoad();
      var fixed = bs ? Object.values(bs.fixedExpenses||{}).reduce(function(s,v){return s+(parseInt(v)||0);},0) : 0;
      var ym = y+'-'+String(m+1).padStart(2,'0');
      var varItems = bs ? (bs.variableExpenses||[]).filter(function(e){return e.date&&e.date.startsWith(ym);}) : [];
      var varExp = varItems.reduce(function(s,e){return s+(parseInt(e.amount)||0);},0);
      var totalExp = fixed+varExp;
      var remain = incTotal-totalExp;
      var spendPct = incTotal>0 ? Math.round(totalExp/incTotal*100) : 0;
      var daysInMonth = new Date(y,m+1,0).getDate();
      var daysLeft = daysInMonth-today.getDate();
      var dailyBudget = daysLeft>0 ? Math.round(remain/daysLeft) : remain;
      var paydayDiff = null;
      try{
        var pd = parseInt(localStorage.getItem('atm2_payday')||'0')||0;
        if(pd>0){
          var pdate = new Date(y,m,pd);
          if(pdate<=today) pdate = new Date(y,m+1,pd);
          paydayDiff = Math.ceil((pdate-today)/(86400000));
        }
      }catch(e2){}
      // ★ finalPay는 직업 미선택 상태에서도 기본 시급 가정으로 계산되어 0보다 클 수 있어
      //   Home의 "사용자가 실제로 데이터를 입력했는지" 판단에는 직업 선택 여부를 함께 확인
      var hasJobs = false;
      try{ hasJobs = JSON.parse(localStorage.getItem('atm2_selectedJobs')||'[]').length>0; }catch(e3){}
      return {
        incTotal:incTotal, fixed:fixed, varExp:varExp, totalExp:totalExp,
        remain:remain, spendPct:spendPct, daysLeft:daysLeft, dailyBudget:dailyBudget,
        finalPay:finalPay, grossPay:grossPay, paydayDiff:paydayDiff,
        salaryNet:salaryNet, salaryGross:salaryGross, // v2.0 연봉제 월 실수령/세전
        isExceeded:remain<0,
        hasData:incTotal>0||fixed>0||varExp>0||(finalPay>0&&hasJobs), // 레거시 — Home에서는 hasRealData만 사용
        hasRealData:_hasRealData()||salaryNet>0, // 연봉 설정도 실데이터로 간주
        hasAttendance:hasAtt, // finalPay 표시 신뢰 여부 — 출근 기록 근거가 있을 때만 true
        hasIncomeData:incTotal>0 // 예산만 설정되고 실제 수입이 없는 경우와 구분 — "예산 초과" 등 수입 기반 판정 표시 여부
      };
    }catch(e){
      return {incTotal:0,remain:0,spendPct:0,daysLeft:0,dailyBudget:0,finalPay:0,grossPay:0,
              isExceeded:false,hasData:false,hasRealData:false,hasAttendance:false,hasIncomeData:false,paydayDiff:null};
    }
  },

  // 브리핑: 날씨 단락 → 사업장 단락(v3.3, N잡) → 금융 단락 → 희망적 마무리 단락
  briefing: function(w, fin, stage, quoteCat){
    var paras = [
      _briefWeather(w, fin),
      _briefCompanies(),
      _briefFinance(fin),
      _briefClosing(fin, quoteCat)
    ].filter(function(p){ return !!p; });
    return paras.join('\n\n');
  },

  // 목표: AI 브리핑과 연결된 오늘의 1줄 행동 제시
  goal: function(w, fin, stage){
    if(!fin || !fin.hasData) return '💡 오늘 하루도 계획적인 소비를 해봐요!';
    if(fin.isExceeded) return '⚠️ 오늘은 추가 지출을 멈춰보세요. 절약이 곧 회복이에요.';
    if(fin.dailyBudget>0) return '🛡️ 오늘은 '+_hN(fin.dailyBudget)+' 안에서 지출해보세요!';
    if(fin.incTotal===0&&fin.fixed>0) return '💰 이번달 수입을 입력하면 오늘 쓸 수 있는 금액이 계산돼요.';
    if(fin.remain>0) return '✅ 이번달 마무리 잘 해봐요! 남은 예산 '+_hN(fin.remain);
    return '💡 오늘 수입을 기록하면 정확한 목표를 드릴게요.';
  },

  actions: function(){
    var dflt = ['ask:report','ask:budgetDetail','nav:dash'];
    try{
      if(typeof AsstInsightEngine==='undefined') return dflt;
      var ins = AsstInsightEngine.analyze();
      if(!ins||!ins.length) return dflt;
      var out = [];
      ins.slice(0,3).forEach(function(i){ if(i.actions) out = out.concat(i.actions.slice(0,2)); });
      return out.length>=2 ? out.slice(0,3) : dflt;
    }catch(e){ return dflt; }
  }
};

function _hN(n){ return Math.abs(Math.round(n||0)).toLocaleString('ko-KR')+'원'; }

// ── 브리핑 단락 헬퍼 — 자연스러운 문장으로 구성, 각자 독립된 단락 반환 ──

// ══════════ v3.8: AI 비서 대시보드 헬퍼 (UI 전용 — 계산은 전부 기존 함수 재사용) ══════════

// ① Hero — 캐릭터가 먼저 반겨주고, 오늘 상황을 한 줄로
function _homeHero(){
  if(typeof MnCharacter==='undefined') return '';
  var nick = (typeof memName!=='undefined' && memName) ? memName+'님' : '';
  var h = new Date().getHours();
  var greet = h<11 ? '좋은 아침이에요' : (h<18 ? '좋은 오후예요' : '오늘 하루 수고했어요');
  greet += nick ? ', '+nick+'!' : '!';
  // 오늘 상황 한 줄 (근무 예정/근무 중/완료)
  var sub = '오늘도 한 달, 함께 관리해드릴게요.';
  var mood = 'welcome';
  try{
    if(typeof CompanyEngine!=='undefined'){
      var working = [], planned = [], done = [];
      CompanyEngine.companies().forEach(function(c){
        var st = CompanyEngine.todayState(c.wpId, c.empId);
        var rec = CompanyEngine.recOf(c.wpId, c.empId, new Date());
        if(st==='working') working.push(c.name);
        else if(st==='done') done.push(c.name);
        else if(rec && rec.start!==undefined && rec.start!==null) planned.push(c.name);
      });
      if(working.length){ sub = '지금 '+working.join('·')+' 근무 중이에요. 화이팅!'; mood='thinking'; }
      else if(planned.length){ sub = '오늘 '+planned.join('·')+' 근무가 예정되어 있어요.'; }
      else if(done.length){ sub = done.join('·')+' 근무를 마쳤어요. 수고했어요!'; mood='celebrate'; }
      else if(typeof SaoInitiativeEngine!=='undefined'){
        // 근태 상황이 없으면 오늘 가장 중요한 정보 1가지(날씨/월급/연속기록)를 Hero가 직접 말한다
        var top = SaoInitiativeEngine.first();
        if(top && top.text){
          sub = top.text.replace(/<br\s*\/?>/g, ' ');
          mood = SaoInitiativeEngine.moodOf ? SaoInitiativeEngine.moodOf(top.emoji) : 'welcome';
        }
      }
    }
  }catch(e){}
  return '<div class="mn-card mn-card--flat mn-fade-in" style="text-align:center;background:none;border:none;padding-bottom:4px;">'
    + MnCharacter.img(mood, 'lg', { animate:'pop' })
    + '<div style="font-size:var(--font-md);font-weight:800;color:var(--text);margin-top:8px;">'+greet+'</div>'
    + '<div style="font-size:var(--font-base);color:var(--text2);margin-top:3px;">'+sub+'</div>'
    + '</div>';
}

// ② 오늘의 핵심 — 오늘 총 예상수입 + 오늘 총 근무시간 (전 사업장, 공통 계산 함수)
function _homeTodayCore(){
  try{
    var jobs = (typeof loadSelectedJobs==='function') ? loadSelectedJobs() : [];
    if(jobs.indexOf('employee')<0 || typeof CompanyEngine==='undefined' || typeof _attV3DayEarnings!=='function') return '';
    var t = _attV3Today(), sumT = 0, sumH = 0, any = false, live = false;
    CompanyEngine.companies().forEach(function(c){
      var e = (c.wpId===activeWpId) ? _attV3DayEarnings(t)
        : CompanyEngine.runFor(c.wpId, c.empId, function(){ return _attV3DayEarnings(t); });
      if(e){ sumT += e.total||0; sumH += e.net||0; any = true; if(e.isLive) live = true; }
    });
    if(!any) return '';
    return '<div class="mn-card mn-card--accent">'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;text-align:center;">'
      + '<div><div class="mn-caption">💰 오늘 총 예상수입'+(live?' · 실시간':'')+'</div>'
      + '<div class="mn-amount" style="color:var(--green);margin-top:2px;">'+_hN(Math.round(sumT))+'</div></div>'
      + '<div style="border-left:1px solid var(--border);"><div class="mn-caption">⏰ 오늘 총 근무</div>'
      + '<div class="mn-amount" style="margin-top:2px;">'+(Math.round(sumH*10)/10)+'<span style="font-size:var(--font-base);">시간</span></div></div>'
      + '</div></div>';
  }catch(e){ return ''; }
}

// ⑥ 최근 기록 — 오늘 사업장별 근무 요약 (가볍게)
function _homeRecent(){
  try{
    if(typeof CompanyEngine==='undefined') return '';
    var t = new Date(), rows = [];
    CompanyEngine.companies().forEach(function(c){
      var rec = CompanyEngine.recOf(c.wpId, c.empId, t);
      if(!rec || rec.start===undefined || rec.start===null) return;
      var txt = '출근 '+fmtTime(rec.start) + ((rec.end!==undefined&&rec.end!==null) ? ' · 퇴근 '+fmtTime(rec.end) : ' · <span style="color:var(--accent);">근무 중</span>');
      rows.push('<div style="display:flex;justify-content:space-between;font-size:var(--font-base);padding:5px 0;">'
        + '<span style="color:var(--text2);">'+(c.wpId===activeWpId?'🏢':'📦')+' '+c.name+'</span><span style="color:var(--text);">'+txt+'</span></div>');
    });
    if(!rows.length) return '';
    return '<div class="mn-card"><div class="mn-h">📌 오늘 기록</div>'+rows.join('')+'</div>';
  }catch(e){ return ''; }
}

// v3.3: 사업장별 상황 단락 (N잡 — 사업장 2개 이상일 때만) — CompanyEngine 읽기 전용
function _briefCompanies(){
  try{
    if(typeof CompanyEngine==='undefined' || !CompanyEngine.isMulti()) return '';
    if(typeof _attV3DayEarnings!=='function') return '';
    var today = new Date();
    var worked = [], working = [], idle = [], sumT = 0;
    CompanyEngine.companies().forEach(function(c){
      var rec = CompanyEngine.recOf(c.wpId, c.empId, today);
      var st = CompanyEngine.todayState(c.wpId, c.empId);
      if(st==='working'){ working.push(c.name); }
      else if(st==='done'){ worked.push(c.name); }
      else { idle.push(c.name); }
      try{
        var e = (c.wpId===activeWpId)
          ? _attV3DayEarnings(_attV3Today())
          : CompanyEngine.runFor(c.wpId, c.empId, function(){ return _attV3DayEarnings(_attV3Today()); });
        if(e) sumT += e.total||0;
      }catch(e2){}
    });
    var parts = [];
    if(working.length) parts.push('지금 '+working.join('·')+' 근무 중이에요.');
    if(worked.length) parts.push(worked.join('·')+'는 오늘 근무를 마쳤어요.');
    if(idle.length) parts.push(idle.join('·')+'는 아직 기록이 없어요.');
    if(!parts.length) return '';
    var s = '🏢 '+parts.join(' ');
    if(sumT>0) s += ' 오늘 총 예상수입은 '+_hN(sumT)+'이에요.';
    return s;
  }catch(e){ return ''; }
}

function _briefWeather(w, fin){
  if(!w) return '오늘 하루도 좋은 하루 보내고 계신가요? 😊';
  var lines = [];
  if(w.isRainingNow || w.isSnowingNow || w.isRainy){
    // 현재 내리는 중 vs 이후 예보를 구분해 체감 기준으로 안내
    if(w.isSnowingNow){
      lines.push('🌨️ 현재 눈이 내리고 있어요. 길이 미끄러우니 조심하세요.');
    } else if(w.isRainingNow){
      lines.push('🌧️ 현재 비가 내리고 있어요.'+(w.isRainy?' 당분간 이어질 예정이니 우산을 꼭 챙기세요.':' 외출 시 우산을 챙기세요.'));
    } else {
      lines.push(w.icon+' 현재는 '+w.text+'이에요. 이후 비가 올 예정이니 우산을 챙겨두면 좋겠어요.');
    }
    try{
      var jobs = JSON.parse(localStorage.getItem('atm2_selectedJobs')||'[]');
      if(jobs.some(function(j){ return j==='delivery'||j==='personal_alba'||j==='company_alba'; }))
        lines.push('비 오는 날은 배달 수요가 늘어 수입에 도움이 될 수도 있어요.');
    }catch(e){}
  } else if(w.isHot){
    lines.push('🌡️ 오늘은 '+w.temp+'℃로 더운 날이에요.');
    if(fin&&fin.hasRealData&&fin.remain<100000&&fin.remain>=0) lines.push('냉방비·음료 지출이 늘 수 있으니 예산에 살짝 신경 써보세요.');
  } else if(w.isCold){
    lines.push('🧥 오늘은 '+w.temp+'℃로 쌀쌀해요. 따뜻하게 입고 나가보세요.');
  } else if(w.text==='맑음'){
    lines.push('☀️ 오늘은 맑고 활동하기 좋은 날입니다.');
  } else {
    lines.push(w.icon+' 오늘은 '+w.text+'인 하루예요.');
  }
  if(w.isBadPm) lines.push('😷 미세먼지가 '+w.pmLevel.text+' 수준이니 외출 시 마스크를 챙기는 게 좋겠어요.');
  return lines.join('\n');
}

function _briefFinance(fin){
  if(!fin || !fin.hasRealData){
    return '머니냥은 급여·예산·근태를 분석해 오늘 쓸 수 있는 돈을 알려드려요. 급여와 예산을 입력하면 더 정확하게 도와드릴 수 있어요.';
  }
  // 예산(고정비 등)만 설정되고 실제 수입이 없으면 remain이 항상 음수가 되어 "예산 초과"로
  // 잘못 보일 수 있으므로, 수입 데이터가 없을 때는 중립적인 안내로 분리(계산 자체는 변경 없음)
  if(!fin.hasIncomeData){
    return '수입을 입력하면 분석을 시작합니다.';
  }
  var lines = [];
  if(fin.isExceeded){
    if(fin.daysLeft>0){
      var recovery = Math.round(Math.abs(fin.remain)/fin.daysLeft);
      lines.push('이번 달 예산을 조금 초과했어요. 하지만 남은 '+fin.daysLeft+'일 동안 하루 '+_hN(recovery)+'씩만 줄이면 충분히 회복할 수 있어요.');
    } else {
      lines.push('이번 달 예산을 조금 초과했어요. 다음 달엔 조금 더 여유 있게 시작해봐요.');
    }
  } else if(fin.remain<50000){
    lines.push('남은 예산이 '+_hN(fin.remain)+'로 다소 빠듯하지만, 조금만 아끼면 목표를 지킬 수 있어요.');
  } else {
    lines.push('이번 달 예산도 안정적으로 관리되고 있어요.');
  }
  if(fin.paydayDiff!==null && fin.paydayDiff>=0 && fin.paydayDiff<=3){
    var paydayMsgs = {
      0: '오늘이 급여일이에요! 이번 달도 정말 잘 보내셨어요.',
      1: '내일이 급여일이에요! 이번 달 정말 수고하셨어요.',
      2: '급여일이 이틀 남았어요. 조금만 더 힘내봐요.',
      3: '급여일이 3일 남았어요. 이번 달 마무리를 슬슬 준비해볼까요?'
    };
    lines.push(paydayMsgs[fin.paydayDiff]);
  }
  return lines.join(' ');
}

function _briefClosing(fin, quoteCat){
  // 예산 초과 시에는 명언 카테고리와 무관하게 절약/회복 톤으로 통일 — financial 단락과 흐름을 맞춤
  // (실제 수입이 없는 예산-only 상태는 isExceeded가 true여도 "초과"로 다루지 않음 — financial 단락과 일관)
  if(fin && fin.hasIncomeData && fin.isExceeded){
    return '오늘은 작은 소비 하나만 줄여도 충분히 도움이 될 거예요. 😊';
  }
  // 예산이 안정적일 때는 절약 권유 문장을 쓰지 않음 (saving 매핑 의도적으로 제외)
  var map = {
    money:      '오늘처럼 잘 관리한 날엔 스스로에게 작은 칭찬도 해줘도 좋아요. 😊',
    work:       '오늘 하루도 수고한 당신, 정말 잘하고 있어요. 😊',
    ai:         '필요할 때 AI에게 가볍게 물어보며 하루를 조금 더 편하게 만들어보세요. 😊',
    motivation: '이번 주도 한 걸음씩, 무리하지 않게 이어가봐요. 😊',
    life:       '오늘 하루는 여유를 조금 더 챙겨도 괜찮아요. 😊'
  };
  if(quoteCat && map[quoteCat]) return map[quoteCat];
  return '오늘도 지금처럼만 이어가면 충분합니다. 😊';
}


// ── HomeQuotes: 오늘의 한 줄 — 사용자마다 무작위, 하루 동안 고정, 자정 경과 시 자동 갱신 ──
var HomeQuotes = (function(){
  var STORAGE_KEY = 'moneynyang_quote_v1';
  var HISTORY_KEY = 'moneynyang_quote_history_v1';
  var HISTORY_LIMIT = 14; // 최근 N일간 표시한 quoteId는 후보에서 제외
  var CATLOG_KEY = 'moneynyang_quote_catlog_v1';
  var CATLOG_LIMIT = 5; // 최근 N일간 선택된 카테고리 로그 — 균형 가드용
  var CAT_LABELS = {
    money:'돈', habit:'습관', success:'성공', motivation:'동기부여',
    work:'직장', ai:'AI 활용', saving:'절약 팁', finance:'금융 팁',
    life:'인생', moneynyang:'머니냥'
  };

  function _today(){
    var d = new Date();
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }

  function _allQuotes(){
    if(typeof QUOTE_DATA==='undefined') return [];
    var out = [];
    Object.keys(QUOTE_DATA).forEach(function(cat){
      (QUOTE_DATA[cat]||[]).forEach(function(q){ out.push({id:q.id, text:q.text, cat:cat}); });
    });
    return out;
  }

  function _findById(id){
    var all = _allQuotes();
    for(var i=0;i<all.length;i++){ if(all[i].id===id) return all[i]; }
    return null;
  }

  function _loadHistory(){
    try{
      var raw = localStorage.getItem(HISTORY_KEY);
      var hist = raw ? JSON.parse(raw) : [];
      return Array.isArray(hist) ? hist : [];
    }catch(e){ return []; }
  }

  function _saveHistory(hist){
    try{ localStorage.setItem(HISTORY_KEY, JSON.stringify(hist)); }catch(e){}
  }

  function _loadCatlog(){
    try{
      var raw = localStorage.getItem(CATLOG_KEY);
      var log = raw ? JSON.parse(raw) : [];
      return Array.isArray(log) ? log : [];
    }catch(e){ return []; }
  }

  function _saveCatlog(log){
    try{ localStorage.setItem(CATLOG_KEY, JSON.stringify(log)); }catch(e){}
  }

  // 오늘 상황에 맞는 우선 카테고리 결정 — 기존에 이미 계산/저장된 값만 읽음 (새 트래킹 없음)
  function _contextCategory(){
    try{
      var fin = (typeof HomeDashboardBuilder!=='undefined') ? HomeDashboardBuilder.financial() : null;
      if(fin && fin.isExceeded) return 'saving';

      var t = new Date();
      // financial().paydayDiff는 당일이면 항상 다음달로 계산되어 0이 될 수 없으므로(기존 계산 로직 유지 목적상
      // financial()은 그대로 두고) 월급일 여부만 별도로 직접 비교한다.
      try{
        var pd = parseInt(localStorage.getItem('atm2_payday')||'0')||0;
        if(pd>0 && pd===t.getDate()) return 'money';
      }catch(e3){}

      var k = t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0');
      if(typeof dayData!=='undefined' && dayData[k] && dayData[k].status==='work') return 'work';

      try{
        var mem = JSON.parse(localStorage.getItem('moneynyang_asst_mem')||'{}');
        if(mem.lastTs){
          var md = new Date(mem.lastTs);
          var mk = md.getFullYear()+'-'+String(md.getMonth()+1).padStart(2,'0')+'-'+String(md.getDate()).padStart(2,'0');
          if(mk===_today()) return 'ai';
        }
      }catch(e2){}

      var dow = t.getDay();
      if(dow===1) return 'motivation';
      if(dow===0||dow===6) return 'life';
    }catch(e){}
    return null;
  }

  // 최근 표시된 quoteId는 후보에서 제외 — 전체 풀이 소진되면(카테고리가 적을 때) 자동으로 전체 풀 사용
  // category가 주어지면 해당 카테고리 풀을 우선 사용 (역시 14일 히스토리 제외 로직은 동일하게 적용)
  function _pickRandom(category){
    var all = _allQuotes();
    if(!all.length) return null;
    var pool = category ? all.filter(function(q){ return q.cat===category; }) : all;
    if(!pool.length) pool = all; // 카테고리에 문구가 없는 비정상 상황 대비
    var hist = _loadHistory();
    var candidates = pool.filter(function(q){ return hist.indexOf(q.id)===-1; });
    if(!candidates.length) candidates = pool;
    var picked = candidates[Math.floor(Math.random()*candidates.length)];
    if(picked){
      hist.push(picked.id);
      var limit = Math.min(HISTORY_LIMIT, Math.max(0, all.length-1));
      if(hist.length>limit) hist = hist.slice(hist.length-limit);
      _saveHistory(hist);

      var catlog = _loadCatlog();
      catlog.push(picked.cat);
      if(catlog.length>CATLOG_LIMIT) catlog = catlog.slice(catlog.length-CATLOG_LIMIT);
      _saveCatlog(catlog);
    }
    return picked;
  }

  function getToday(){
    var today = _today();
    try{
      var raw = localStorage.getItem(STORAGE_KEY);
      if(raw){
        var saved = JSON.parse(raw);
        if(saved.date===today){
          var q = _findById(saved.quoteId);
          if(q) return q;
        }
      }
    }catch(e){}

    var ctxCat = _contextCategory();
    if(ctxCat){
      var catlog = _loadCatlog();
      var recentCount = catlog.filter(function(c){ return c===ctxCat; }).length;
      if(recentCount>=2) ctxCat = null; // 균형 가드 — 같은 카테고리 과다 반복 방지
    }

    var picked = _pickRandom(ctxCat);
    if(picked){
      try{ localStorage.setItem(STORAGE_KEY, JSON.stringify({date:today, quoteId:picked.id})); }catch(e){}
    }
    return picked;
  }

  return {
    getToday: getToday,
    render: function(){
      var q = getToday();
      if(!q) return '';
      var label = CAT_LABELS[q.cat]||q.cat;
      return '<div class="home-card home-quote">'
        +'<div class="home-quote-cat">✨ 오늘의 한 줄 · '+label+'</div>'
        +'<div class="home-quote-txt">“'+q.text+'”</div>'
        +'</div>';
    }
  };
})();


// ══════════════════════════════════════════
// renderHomePage: 홈 화면 전체 렌더링
// 입력을 강요하지 않는 "오늘의 브리핑" — Stage와 무관하게 항상 동일한 구성
// ══════════════════════════════════════════
function renderHomePage(){
  var page = document.getElementById('home-page');
  if(!page) return;

  // 기존 사용자 데이터 기반 Stage 자동 승급 (내부 추적용, UI에는 영향 없음)
  _homeAutoStage();

  var stage   = HomeStage.get();
  var fin     = HomeDashboardBuilder.financial();
  var wRaw    = WeatherProvider.getCache();
  var w       = WeatherBuilder.build(wRaw);
  var todayQuote = HomeQuotes.getToday();
  var briefing= HomeDashboardBuilder.briefing(w, fin, stage, todayQuote ? todayQuote.cat : null);

  // v3.8: AI 비서 대시보드 — 시선 흐름: ①캐릭터 인사 → ②오늘의 핵심 → ③AI 브리핑
  //       → ④오늘의 한마디 → ⑤빠른 실행 → (날씨/자산/금융/오늘 기록/명언/추천)
  var H = '<div class="home-content">';
  H += _homeHero();
  // v4.2.2-beta.8 (디자인 시안): 날씨를 상단으로, AI 브리핑이 바로 이어짐
  H += '<div id="home-wx-wrap" class="home-wx-wrap home-card">'
    +(wRaw ? WeatherFormatter.full(w) : WeatherFormatter.loading())+'</div>';
  H += '<div class="home-card"><div class="home-lbl" style="display:flex;align-items:center;gap:6px;">'
    +(typeof MnCharacter!=='undefined' ? MnCharacter.img('thinking','avatar') : '')+' AI 브리핑</div>'
    +'<div id="home-briefing" class="home-briefing-txt">'+briefing.replace(/\n/g,'<br>')+'</div>'
    +'</div>';
  H += _homeTodayCore();
  // v2.9: SAO Initiative Engine — 오늘의 한마디 (가장 중요한 정보 1개 선제 안내)
  if(typeof SaoInitiativeEngine!=='undefined'){ try{ H += SaoInitiativeEngine.bannerHtml(); }catch(e){} }
  H += _hQuick();
  // 💎 내 자산 카드 (직접 입력, assets.js)
  if(typeof renderHomeAssetCard==='function') H += renderHomeAssetCard();
  if(fin.hasRealData) H += _hFinancial(fin);
  H += _homeRecent();
  H += HomeQuotes.render();
  H += _hActions(fin);
  H += '</div>';
  page.innerHTML = H;

  // 날씨 비동기 로드 (캐시 미스 시에만)
  if(!wRaw){
    WeatherProvider.fetch(function(raw){
      var wd = WeatherBuilder.build(raw);
      var wxEl = document.getElementById('home-wx-wrap');
      if(wxEl) wxEl.innerHTML = WeatherFormatter.full(wd);
      var tq = HomeQuotes.getToday();
      var nb = HomeDashboardBuilder.briefing(wd, fin, stage, tq ? tq.cat : null);
      var be = document.getElementById('home-briefing');
      if(be) be.innerHTML = nb.replace(/\n/g,'<br>');
    }, function(){
      var wxEl = document.getElementById('home-wx-wrap');
      if(wxEl) wxEl.innerHTML = WeatherFormatter.unavail();
    });
  }
}

// 기존 데이터를 가진 사용자 자동 Stage 승급 (첫 실행 시 1회)
function _homeAutoStage(){
  var st = HomeStage.get();
  if(st<1){
    try{
      var j = JSON.parse(localStorage.getItem('atm2_selectedJobs')||'[]');
      if(j.length>0) HomeStage.advance(1);
    }catch(e){}
  }
  if(HomeStage.get()<2){
    try{
      var _today=new Date(), _y=_today.getFullYear(), _m=_today.getMonth();
      var inc = typeof getIncomeSummary==='function' ? getIncomeSummary(_y,_m) : {total:0};
      // 이번달 수입 없으면 이전달도 확인 (월초 알바·프리랜서 Stage 유지)
      if((inc.total||0)===0 && typeof getIncomeSummary==='function'){
        var _pm=_m===0?11:_m-1, _py=_m===0?_y-1:_y;
        inc = getIncomeSummary(_py, _pm);
      }
      if((inc.total||0)>0) HomeStage.advance(2);
    }catch(e){}
  }
  if(HomeStage.get()<3){
    try{
      var bs = typeof budgetState!=='undefined' ? budgetState : null;
      if(bs&&!bs._loaded&&typeof budgetLoad==='function') budgetLoad();
      if(bs){
        var fx = Object.values(bs.fixedExpenses||{}).reduce(function(s,v){return s+(parseInt(v)||0);},0);
        if(fx>0||(bs.customIncome||0)>0) HomeStage.advance(3);
      }
    }catch(e){}
  }
}


// ── 홈 내부 렌더 헬퍼 ──

function _hFinancial(fin){
  function cell(lbl, val, cls){
    return '<div class="hfin-cell"><div class="hfin-lbl">'+lbl+'</div>'
      +'<div class="hfin-val '+cls+'">'+val+'</div></div>';
  }
  // 카드 자체 노출 여부는 hasRealData(예산만 설정해도 카드는 보임)지만,
  // "오늘 사용 가능"/"이번달 잔여"/"이번달 지출률"/"예산 초과" 판정은 실제 수입(incTotal>0)이
  // 있을 때만 의미가 있다 — 예산만 설정하고 수입이 없으면 remain이 항상 음수가 되어
  // "예산 초과"로 잘못 보이는 문제를 방지(계산 자체는 그대로, 표시만 구분)
  var hasIncomeData = fin.hasIncomeData;
  // 말일(daysLeft<=0)에는 dailyBudget이 remain 전체와 같아져 "오늘 사용 가능"·"이번달 잔여"가
  // 동일 숫자로 중복 노출되므로, 그 경우엔 숫자 대신 의미 전달형 문구로 표시
  var isLastDay = fin.daysLeft<=0;
  var dayVal = !hasIncomeData?'수입 입력 후 계산':fin.isExceeded?'초과':(isLastDay&&fin.dailyBudget>0)?'잔여 전액 (말일)':fin.dailyBudget>0?_hN(fin.dailyBudget):'계산 중';
  var dayCls = !hasIncomeData?'hfin-w':fin.isExceeded?'hfin-r':(fin.dailyBudget>0&&fin.dailyBudget<10000)?'hfin-y':fin.dailyBudget>0?'hfin-g':'hfin-w';
  var remainVal = hasIncomeData?(fin.isExceeded?('-'+_hN(Math.abs(fin.remain))):_hN(fin.remain)):'수입 입력 후 계산';
  var remainCls = hasIncomeData?(fin.isExceeded?'hfin-r':fin.remain<50000?'hfin-y':'hfin-b'):'hfin-w';
  return '<div class="home-card"><div class="home-lbl">💰 이번달 금융 요약</div>'
    +'<div class="hfin-grid">'
    +cell('오늘 사용 가능', dayVal, dayCls)
    +cell('이번달 잔여', remainVal, remainCls)
    +_hPayCell(fin)
    +cell('이번달 지출률', hasIncomeData?fin.spendPct+'%':'—', hasIncomeData?(fin.spendPct>=90?'hfin-r':fin.spendPct>=70?'hfin-y':'hfin-g'):'hfin-w')
    +'</div></div>';
}

// 급여 셀 — 세전+세후 동시 표시(직장인, grossPay>0일 때만). "최저임금보다 적다" 오해 방지:
// 큰 금액은 세전(grossPay), 아래 보조 줄에 실수령 예상(finalPay). 회사알바 등 grossPay가
// 없는 직업군은 기존 단일 표시(예상 실수령액) 유지. 계산 비변경 — 표시만.
function _hPayCell(fin){
  // v2.0: 연봉제 — 확정 월급이므로 출근 기록 게이트 없이 표시.
  // 시급제 병행 시(출근 기록 있을 때만) 시급제 몫을 합산해 세전/세후 동시 표시
  if(fin.salaryNet>0){
    var _empOk = fin.hasAttendance && fin.finalPay>0;
    var _net = fin.salaryNet + (_empOk?fin.finalPay:0);
    var _gross = fin.salaryGross + ((_empOk&&fin.grossPay>0)?fin.grossPay:0);
    return '<div class="hfin-cell"><div class="hfin-lbl">이번달 예상 급여 <span style="opacity:.7;">(세전)</span></div>'
      +'<div class="hfin-val hfin-w">'+_hN(_gross)+'</div>'
      +'<div style="font-size:11px;color:var(--text3);margin-top:2px;">실수령 예상 <b style="color:var(--text2);">'+_hN(_net)+'</b></div>'
      +'</div>';
  }
  if(!(fin.hasAttendance&&fin.finalPay>0))
    return '<div class="hfin-cell"><div class="hfin-lbl">예상 실수령액</div>'
      +'<div class="hfin-val hfin-w">수입 입력 후 계산</div></div>';
  if(!(fin.grossPay>0))
    return '<div class="hfin-cell"><div class="hfin-lbl">예상 실수령액</div>'
      +'<div class="hfin-val hfin-w">'+_hN(fin.finalPay)+'</div></div>';
  return '<div class="hfin-cell"><div class="hfin-lbl">이번달 예상 급여 <span style="opacity:.7;">(세전)</span></div>'
    +'<div class="hfin-val hfin-w">'+_hN(fin.grossPay)+'</div>'
    +'<div style="font-size:11px;color:var(--text3);margin-top:2px;">실수령 예상 <b style="color:var(--text2);">'+_hN(fin.finalPay)+'</b></div>'
    +'</div>';
}

// jobtype.js의 getAttLabel()(applyJobTypeUI 내부)과 동일한 직업별 분기 기준을 복제 —
// jobtype.js는 export하지 않으므로 동일 기준만 재구현 (행동형 라벨로 조정)
function _hQuickWorkState(){
  var ws = null;
  try{ var raw = localStorage.getItem('atm2_workSession'); if(raw) ws = JSON.parse(raw); }catch(e){}
  if(ws) return 'working';
  var jobs = [];
  try{ jobs = JSON.parse(localStorage.getItem('atm2_selectedJobs')||'[]'); }catch(e){}
  if(jobs.indexOf('employee')>=0 && typeof dayData!=='undefined'){
    var t = new Date();
    var tk = t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0');
    var rec = dayData[tk];
    if(rec && rec.status && rec.status!=='none'){
      if(rec.start!==undefined && (rec.end===undefined || rec.end===null)) return 'working';
      if(rec.start!==undefined && rec.end!==undefined && rec.end!==null) return 'done';
    }
  }
  return 'idle';
}

function _hQuickTerms(){
  var jobs = [];
  try{ jobs = JSON.parse(localStorage.getItem('atm2_selectedJobs')||'[]'); }catch(e){}
  if(jobs.indexOf('employee')>=0 || jobs.indexOf('salary')>=0)
    return {startIcon:'☀️', startLabel:'출근하기', endIcon:'🌙', endLabel:'퇴근하기'};
  if(jobs.some(function(j){ return ['delivery','driver'].indexOf(j)>=0; }))
    return {startIcon:'🛵', startLabel:'운행 시작', endIcon:'🏁', endLabel:'운행 종료'};
  if(jobs.indexOf('freelancer')>=0)
    return {startIcon:'💻', startLabel:'작업 시작', endIcon:'✅', endLabel:'작업 종료'};
  if(jobs.some(function(j){ return ['convenience','shortAlba'].indexOf(j)>=0; }))
    return {startIcon:'📋', startLabel:'출근하기', endIcon:'🌙', endLabel:'퇴근하기'};
  return {startIcon:'📋', startLabel:'시작하기', endIcon:'🏁', endLabel:'종료하기'};
}

function _hQuick(){
  var state = _hQuickWorkState();
  var terms = _hQuickTerms();
  var startClick = "(function(){if(typeof _wsStart==='function'){_wsStart(typeof _wsMainJob==='function'?_wsMainJob():'employee');}else{showPage('att');}})()";
  var endClick = "(function(){if(typeof _wsActive==='function'&&_wsActive()){if(typeof _wsEnd==='function')_wsEnd();}else{showPage('att');}})()";

  var startDim = state!=='idle' ? 'opacity:.4;pointer-events:none;' : '';
  var endDim = state!=='working' ? 'opacity:.4;pointer-events:none;' : '';

  // v4.2.2-beta.8 (디자인 시안): 4버튼 — 출근/퇴근 크게 + 상태색, 지출/급여 작게
  var btns = [
    {i:terms.startIcon, l:terms.startLabel, o:startClick, s:startDim, c:'var(--green)',  big:true},
    {i:terms.endIcon,   l:terms.endLabel,   o:endClick,   s:endDim,   c:'var(--accent)', big:true},
    {i:'✏️', l:'지출 입력', o:"showPage('budget')", s:'', c:'var(--orange)', big:false},
    {i:'💰', l:'급여 확인', o:"showPage('sal')",    s:'', c:'#8c52d9',       big:false}
  ];
  var H = '<div class="home-card"><div class="home-lbl">⚡ 빠른 실행</div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">';
  btns.forEach(function(b){
    H += '<div style="'+b.s+'background:color-mix(in srgb, '+b.c+' 14%, var(--surface));'
      +'border:1px solid color-mix(in srgb, '+b.c+' 30%, var(--surface));'
      +'border-radius:'+(b.big?'16px':'14px')+';padding:'+(b.big?'16px 4px':'10px 4px')+';'
      +'text-align:center;cursor:pointer;min-height:44px;" onclick="'+b.o+'">'
      +'<div style="font-size:'+(b.big?'28px':'19px')+';margin-bottom:'+(b.big?'5px':'3px')+';">'+b.i+'</div>'
      +'<div style="font-size:'+(b.big?'15px':'12px')+';font-weight:'+(b.big?'900':'800')+';color:'+b.c+';">'+b.l+'</div></div>';
  });
  return H+'</div></div>';
}

var _HOME_ACT_LABELS = {
  'ask:report':'📊 이번달 리포트', 'ask:budgetDetail':'🛡️ 예산 상세',
  'ask:savingTip':'✨ 절약 팁',    'ask:otAnalysis':'📋 OT 분석',
  'ask:leaveCheck':'🌿 연차 확인', 'ask:nextGoal':'🎯 다음 목표',
  'ask:monthlyReport':'📋 월 리포트','ask:budgetCause':'🔍 지출 분석',
  'nav:dash':'📊 연간요약'
};

function _hActions(fin){
  // 무데이터(신규) 사용자에게는 데이터 기반 칩 대신 탐색형 칩 — 모두 기존 전역 함수 재사용
  if(fin && !fin.hasRealData){
    return '<div class="home-card"><div class="home-lbl">✨ 둘러보기</div><div class="home-act-chips">'
      +'<button class="home-act-chip" onclick="if(typeof reopenTutorial===\'function\')reopenTutorial();">🐱 머니냥 소개</button>'
      +'<button class="home-act-chip" onclick="if(typeof toggleAsst===\'function\')toggleAsst();">🤖 AI에게 물어보기</button>'
      +'<button class="home-act-chip" onclick="if(typeof askQuick===\'function\')askQuick(\'금융 상식 알려줘\');">💡 금융 상식</button>'
      +'</div></div>';
  }
  var acts = HomeDashboardBuilder.actions();
  var H = '<div class="home-card"><div class="home-lbl">✨ 오늘의 추천</div><div class="home-act-chips">';
  acts.forEach(function(ak){
    var lbl = _HOME_ACT_LABELS[ak]||ak;
    H += '<button class="home-act-chip" '
      +'onclick="if(typeof AsstActionDispatcher!==\'undefined\')AsstActionDispatcher.dispatch(\''+ak+'\');'
      +'if(typeof toggleAsst===\'function\'&&!asstOpen)toggleAsst();">'+lbl+'</button>';
  });
  return H+'</div></div>';
}


// ── 앱 로드 완료 후 홈 페이지 진입 ──
// init.js의 직업선택 모달(300ms setTimeout)보다 늦게 실행되어야 하므로 500ms 대기
window.addEventListener('load', function(){
  setTimeout(function(){
    if(typeof showPage==='function') showPage('home');
  }, 500);
});
