// ══════════════════════════════════════════════════════════════
// 머니냥 리디자인 셸 v7 (redesign-v6.js — v6을 흡수·확장)
// 2026-07-25 design_handoff_moneynyang_redesign/README.md 적용 2단계
//
//  [모바일 ≤768px — 새 셸]
//   ① 셸: 헤더(냥 아바타+머니냥 / 오늘 칩 / 톱니) + 6탭(홈·정보·근태·수입·생존·연간)
//      + 스와이프 트랙(7화면) + 하단 액션 바(페이지 점 + 마이크 + 챗봇)
//      — 셸은 height:100dvh flex-column, 하단 바는 흐름 안(고정 플로팅 아님)
//   ② 스와이프: Pointer Events + axis lock(|dx|>|dy| 첫 판정 시에만 수평 확정)
//      + 양끝 고무줄(×0.3, 화면0 오른쪽은 히스토리 이동 없음) + 60px 임계
//   ③ showPage(p) 전면 교체: display 토글 → idx 매핑 + translateX.
//      render-on-show 유지 — 탭 클릭/스와이프/해시 어느 경로든 진입 시 렌더 호출
//   ④ URL 해시(#home…#settings) 반영 — PWA 뒤로가기·새로고침 복원
//   ⑤ 알림 종 없음 — "정보" 탭 라벨 옆 빨간 점(6px)으로만 표시
//
//  [데스크톱 >768px — 기존 유지 (PC는 추후 사이드바 레이아웃으로 일괄 전환)]
//   기존 v6 패치 유지: 상단 탭에 "정보" 추가 + showPage('info') 지원
//
//  [공통 — v6에서 흡수]
//   정보 화면(날씨+브리핑+뉴스), 정보 탭 빨간 점, 홈 타임라인, 음성 인식/명령
//
// 원칙: 계산 로직 무접촉. 이 파일 <script> 한 줄만 빼면 구 셸로 복구.
// ══════════════════════════════════════════════════════════════
(function(){
  'use strict';

  // 모바일 여부는 init() 시점에 판정한다 — 스크립트 파싱 시점에는 뷰포트가
  // 아직 확정되지 않은 환경(프리뷰/웹뷰 초기화)이 있어 오판할 수 있다
  var MOB = false;

  // ══════════════════════════════════════════
  // 정보 화면 (README §1) — 날씨 카드 + 오늘의 브리핑 + 내 소식
  //  데이터는 기존 소스만 사용: WeatherProvider(위치 기반 날씨),
  //  home-news.js(경제 뉴스 RSS), HomeDashboardBuilder(브리핑·재무).
  //  ※ README의 "시간대 예보 4칸"은 시간별 예보 데이터가 필요해 이번 차수 범위 밖 —
  //    같은 자리에 현재 데이터(체감/최고·최저/강수/미세먼지) 4칸을 넣어 레이아웃을 확정하고,
  //    시간별 API 연결 시 이 칸만 교체하면 되도록 구조를 맞춰 둔다.
  // ══════════════════════════════════════════

  // 날씨 SVG 아이콘 (24 viewBox, stroke 1.6, round) — 이모지 아이콘 제거 규칙
  function _wxSvg(text){
    var t = String(text||'');
    var p;
    if(/뇌우|천둥/.test(t))            p = '<path d="M6 16a4 4 0 0 1 .6-8 5.5 5.5 0 0 1 10.5 1.5A3.5 3.5 0 0 1 17 16H6z"/><path d="M13 18l-2.5 4h4L12 26"/>';
    else if(/폭설|눈/.test(t))         p = '<path d="M6 15a4 4 0 0 1 .6-8 5.5 5.5 0 0 1 10.5 1.5A3.5 3.5 0 0 1 17 15H6z"/><path d="M9 19v.01M12 21v.01M15 19v.01"/>';
    else if(/비|소나기|폭우/.test(t))  p = '<path d="M6 14a4 4 0 0 1 .6-8 5.5 5.5 0 0 1 10.5 1.5A3.5 3.5 0 0 1 17 14H6z"/><path d="M9 18l-1 3M13 18l-1 3M17 18l-1 3"/>';
    else if(/흐림|구름많음/.test(t))   p = '<path d="M6 17a4.5 4.5 0 0 1 .7-9 6 6 0 0 1 11.4 1.6A4 4 0 0 1 18 17H6z"/>';
    else if(/구름|약간/.test(t))       p = '<circle cx="8.5" cy="8.5" r="3.2"/><path d="M10 18a4 4 0 0 1 .6-8 5.5 5.5 0 0 1 10 1.4A3.4 3.4 0 0 1 20 18H10z"/>';
    else                                p = '<circle cx="12" cy="12" r="4.5"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4"/>';
    return '<svg class="mn-wx-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" '
      + 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+p+'</svg>';
  }

  // 냥이 조언 — 기존 날씨 플래그에서 파생 (새 데이터 소스 없음)
  function _wxAdvice(w){
    if(!w) return '';
    if(w.isRainingNow || w.isRainy) return '오늘은 우산 챙기세요. 출퇴근길 조심하시고요!';
    if(w.isSnowingNow)              return '눈길이에요. 평소보다 일찍 나서는 게 안전해요.';
    if(w.isBadPm)                   return '미세먼지가 안 좋아요. 마스크 챙기시는 걸 추천드려요.';
    if(w.isHot)                     return '더운 날이에요. 물 자주 마시고 무리하지 마세요.';
    if(w.isCold)                    return '많이 추워요. 따뜻하게 입고 나가세요!';
    return '오늘도 좋은 하루 되세요. 기록은 제가 챙길게요!';
  }

  function _wxCardHtml(w){
    if(!w) return '';
    var wd = ['일','월','화','수','목','금','토'][new Date().getDay()];
    var cells = [
      {l:'체감',    v:(w.feelsLike!=null? w.feelsLike+'°' : '-')},
      {l:'최고/최저', v:((w.maxTemp!=null?w.maxTemp:'-')+'° / '+(w.minTemp!=null?w.minTemp:'-')+'°')},
      {l:'강수',    v:((w.rainPct!=null?w.rainPct:0)+'%')},
      {l:'미세먼지', v:(w.pmLevel? w.pmLevel.text : '-')}
    ];
    return '<div class="mn-wx-card">'
      +'<div class="mn-wx-top">'
      +'<div class="mn-wx-main">'
      +'<div class="mn-wx-loc">'+(w.location? w.location+' · ' : '')+wd+'요일</div>'
      +'<div class="mn-wx-temp">'+(w.temp!=null?w.temp:'-')+'°</div>'
      +'<div class="mn-wx-sum">'+(w.text||'')+'</div>'
      +'</div>'
      + _wxSvg(w.text)
      +'</div>'
      +'<div class="mn-wx-cells">'
      + cells.map(function(c){ return '<div class="mn-wx-cell"><span>'+c.l+'</span><b>'+c.v+'</b></div>'; }).join('')
      +'</div>'
      +'<div class="mn-wx-advice">'
      + (typeof MnCharacter!=='undefined' ? MnCharacter.img('hello','avatar') : '')
      +'<span>'+_wxAdvice(w)+'</span></div>'
      +'</div>';
  }

  function _wxSkeleton(){
    return '<div class="mn-wx-card mn-wx-skel">'
      +'<div class="mn-sk mn-sk-line" style="width:40%"></div>'
      +'<div class="mn-sk mn-sk-temp"></div>'
      +'<div class="mn-sk mn-sk-line" style="width:55%"></div>'
      +'<div class="mn-wx-cells">'
      +'<div class="mn-sk mn-sk-cell"></div><div class="mn-sk mn-sk-cell"></div>'
      +'<div class="mn-sk mn-sk-cell"></div><div class="mn-sk mn-sk-cell"></div>'
      +'</div></div>';
  }

  function _wxFail(){
    return '<div class="mn-wx-card mn-wx-fail">'
      +'<div class="mn-wx-fail-t">날씨를 불러오지 못했어요</div>'
      +'<div class="mn-wx-fail-s">위치를 허용하면 오늘 날씨와 냥이 조언을 볼 수 있어요.</div>'
      +'<button class="mn-wx-retry" onclick="mnInfoRetryWeather()">다시 시도</button>'
      +'</div>';
  }

  window.mnInfoRetryWeather = function(){
    var wx = document.getElementById('info-wx-wrap');
    if(wx) wx.innerHTML = _wxSkeleton();
    try{
      WeatherProvider.fetch(function(raw){
        var el = document.getElementById('info-wx-wrap');
        if(el) el.innerHTML = _wxCardHtml(WeatherBuilder.build(raw));
      }, function(){
        var el = document.getElementById('info-wx-wrap');
        if(el) el.innerHTML = _wxFail();
      });
    }catch(e){
      if(wx) wx.innerHTML = _wxFail();
    }
  };

  // 브리핑 행 카테고리 칩 — 제목 키워드로 분류 (표시 전용)
  function _briefCat(title){
    var t = String(title||'');
    if(/최저임금|근로|노동|고용|알바|주휴|임금/.test(t)) return {k:'노동', c:'labor'};
    if(/지원금|보조금|수당|바우처|복지|청년/.test(t))     return {k:'지원금', c:'grant'};
    if(/세금|연말정산|소득세|공제|국세/.test(t))          return {k:'세금', c:'tax'};
    return {k:'경제', c:'econ'};
  }

  function renderInfoPage(){
    var page = document.getElementById('info-page');
    if(!page) return;

    var wRaw = null, w = null;
    try{ wRaw = WeatherProvider.getCache(); w = WeatherBuilder.build(wRaw); }catch(e){}

    var H = '<div class="home-content mn-info">';
    H += '<div class="mn-info-date">'+_todayLabel()+'</div>';

    // ① 날씨 카드 (캐시 있으면 즉시, 없으면 스켈레톤 → 비동기 채움)
    H += '<div id="info-wx-wrap">' + (w ? _wxCardHtml(w) : _wxSkeleton()) + '</div>';

    // ② 오늘의 브리핑 (경제 뉴스 → 카테고리 칩 + 제목 + 부제 행)
    H += '<div class="mn-card mn-brief"><div class="mn-h">오늘의 브리핑</div>'
      +  '<div id="mn-brief-rows">'+_briefSkeletonRows()+'</div></div>';

    // ③ 내 소식 — 냥이 인사이트 + (필요 시) 경고 카드
    var briefing = '', fin = null;
    try{
      var stage = HomeStage.get();
      fin = HomeDashboardBuilder.financial();
      var tq = HomeQuotes.getToday();
      briefing = HomeDashboardBuilder.briefing(w, fin, stage, tq ? tq.cat : null);
    }catch(e){}
    H += '<div class="mn-card"><div class="mn-h">'
      + (typeof MnCharacter!=='undefined' ? MnCharacter.img('thinking','avatar') : '')
      + ' 내 소식</div>'
      + '<div id="info-briefing" class="home-briefing-txt">'+String(briefing||'기록이 쌓이면 알려드릴 소식이 생겨요.').replace(/\n/g,'<br>')+'</div>'
      + '</div>';
    if(fin && fin.isExceeded){
      H += '<div class="mn-warn-card">이번 달 지출이 수입을 넘었어요. 생존관리에서 남은 예산을 확인해보세요.</div>';
    }
    H += '</div>';
    page.innerHTML = H;

    if(!w) mnInfoRetryWeather();
    _fillBriefRows();
    _markInfoSeen();
  }

  function _briefSkeletonRows(){
    var r = '';
    for(var i=0;i<3;i++) r += '<div class="mn-brief-row"><div class="mn-sk mn-sk-chip"></div>'
      +'<div style="flex:1;min-width:0;"><div class="mn-sk mn-sk-line" style="width:80%"></div>'
      +'<div class="mn-sk mn-sk-line" style="width:40%;margin-top:6px;"></div></div></div>';
    return r;
  }

  // 뉴스 소스를 브리핑 행으로 — home-news.js의 캐시/네트워크 경로를 그대로 재사용
  //  · 캐시 있음: renderHomeNewsCard()가 완성된 행 HTML을 "반환값"으로 준다 (DOM은 안 건드림)
  //  · 캐시 없음: 반환값은 로딩 문구뿐이고, 잠시 뒤 비동기로 #home-news-list를 채운다
  //  두 경로를 모두 처리한다.
  function _briefRowsFrom(container){
    var links = container.querySelectorAll('a');
    if(!links.length) return '';
    var rows = '';
    [].slice.call(links, 0, 4).forEach(function(a){
      var divs = a.querySelectorAll('div');
      var title = (divs[0] ? divs[0].textContent : a.textContent) || '';
      var sub   = divs[1] ? divs[1].textContent : '';
      var cat = _briefCat(title);
      var href = a.getAttribute('href') || '#';
      rows += '<a class="mn-brief-row" href="'+href+'" target="_blank" rel="noopener">'
        + '<span class="mn-brief-chip '+cat.c+'">'+cat.k+'</span>'
        + '<span class="mn-brief-txt"><b>'+title+'</b><i>'+sub+'</i></span></a>';
    });
    return rows;
  }

  function _briefFail(box){
    box.innerHTML = '<div class="mn-brief-empty">소식을 불러오지 못했어요.'
      + '<button class="mn-wx-retry" onclick="mnInfoRetryBrief()">다시 시도</button></div>';
  }

  function _fillBriefRows(){
    var box = document.getElementById('mn-brief-rows');
    if(!box) return;
    if(typeof renderHomeNewsCard !== 'function'){ _briefFail(box); return; }

    // 비동기 경로 대비: home-news.js가 채울 대상(#home-news-list)을 미리 붙여둔다
    var tmp = document.getElementById('home-news-list');
    var owned = false;
    if(!tmp){
      tmp = document.createElement('div');
      tmp.id = 'home-news-list';
      tmp.style.display = 'none';
      document.body.appendChild(tmp);
      owned = true;
    }

    var html = '';
    try{ html = renderHomeNewsCard() || ''; }catch(e){}

    // ① 캐시 경로 — 반환된 HTML에 이미 기사 링크가 들어있다
    var parsed = document.createElement('div');
    parsed.innerHTML = html;
    var rows = _briefRowsFrom(parsed);
    if(rows){ box.innerHTML = rows; if(owned) tmp.remove(); return; }

    // ② 네트워크 경로 — #home-news-list가 채워질 때까지 대기
    var tries = 0;
    (function poll(){
      tries++;
      var r = _briefRowsFrom(tmp);
      if(r){ box.innerHTML = r; if(owned) tmp.remove(); return; }
      if(/못했어요|없어요/.test(tmp.textContent||'') || tries > 40){
        _briefFail(box); if(owned) tmp.remove(); return;
      }
      setTimeout(poll, 250);
    })();
  }

  window.mnInfoRetryBrief = function(){
    var box = document.getElementById('mn-brief-rows');
    if(box) box.innerHTML = _briefSkeletonRows();
    try{ localStorage.removeItem('mn.newsCache'); }catch(e){}
    _fillBriefRows();
  };

  function _todayLabel(){
    var d = new Date();
    var wd = ['일','월','화','수','목','금','토'][d.getDay()];
    return (d.getMonth()+1)+'.'+d.getDate()+' '+wd;
  }

  function ensureInfoPage(){
    if(document.getElementById('info-page')) return;
    var home = document.getElementById('home-page');
    if(!home) return;
    var el = document.createElement('div');
    el.id = 'info-page';
    el.style.display = 'none';
    home.parentNode.insertBefore(el, home.nextSibling);
  }

  // ── 정보 탭 빨간 점: 하루 한 번, 정보 탭을 열면 사라짐 (알림 종 대체) ──
  var DOT_KEY = 'mn.infoSeenDate';
  function _todayKey(){ var d=new Date(); return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); }
  function _markInfoSeen(){
    try{ localStorage.setItem(DOT_KEY, _todayKey()); }catch(e){}
    _syncInfoDot();
  }
  function _syncInfoDot(){
    var seen = null;
    try{ seen = localStorage.getItem(DOT_KEY); }catch(e){}
    var show = (seen !== _todayKey());
    ['mn-info-dot','mn-info-dot-desk','mn-info-dot-pc'].forEach(function(id){
      var dot = document.getElementById(id);
      if(dot) dot.style.display = show ? 'inline-block' : 'none';
    });
  }

  // ══════════════════════════════════════════
  // 홈 타임라인 (v6 흡수 — 계산은 기존 엔진 호출만)
  // ══════════════════════════════════════════
  function _fmtWon(n){ try{ return Number(n||0).toLocaleString('ko-KR'); }catch(e){ return n; } }
  function _fmtT(v){
    try{ if(typeof fmtTime==='function') return fmtTime(v); }catch(e){}
    return v;
  }
  function _todayISO(){
    var d=new Date();
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }

  // 오늘 예상수입 합계 (전 사업장 — 기존 계산 함수 반환값만 사용)
  function _todayEarn(){
    var sum=0, live=false;
    try{
      if(typeof CompanyEngine!=='undefined' && typeof _attV3DayEarnings==='function'){
        var t=_attV3Today();
        CompanyEngine.companies().forEach(function(c){
          var e=(c.wpId===activeWpId)?_attV3DayEarnings(t)
            :CompanyEngine.runFor(c.wpId,c.empId,function(){return _attV3DayEarnings(t);});
          if(e){ sum+=e.total||0; if(e.isLive) live=true; }
        });
      }
    }catch(e){}
    return {sum:Math.round(sum), live:live};
  }

  // 타임라인 행: 좌측 레일(노드 12×12 + 세로선) + 우측(시각 라벨 + 카드)
  // done=완료(성공 채움) / todo=예정(보더 노드)
  function _tlRow(time, done, inner, isLast){
    return '<div class="mn-tl-row">'
      +'<div class="mn-tl-rail"><span class="mn-tl-node '+(done?'done':'todo')+'"></span>'
      +(isLast?'':'<span class="mn-tl-line"></span>')+'</div>'
      +'<div class="mn-tl-body">'
      +(time?'<div class="mn-tl-time '+(done?'done':'todo')+'">'+time+'</div>':'')
      + inner
      +'</div></div>';
  }
  function _tlCard(html){
    return '<div class="mn-tl-card">'+html+'</div>';
  }

  // ══════════════════════════════════════════
  // HOME v2 히어로 카드 (HOME_V2_SPEC §2) — 상태에 따라 카드가 통째로 바뀐다.
  //  상태: working(근무 중) / pre(출근 전) / late(예정 시각 지남) / done(오늘 완료) / none(일정 없음)
  //  금액은 전부 기존 함수 반환값 바인딩 — 새 계산 없음.
  //  ※ "지금까지" 금액은 헤더 칩과 **같은 _todayEarn()** 을 쓴다 (명세 §7 / 검증 3).
  // ══════════════════════════════════════════

  // 예정 근무 시간대 — 설정(근무 형태·커스텀 시프트) 값 바인딩만
  // ★ 2교대·3교대는 오늘의 조를 "오늘 기록에 저장된 조 → 고정조/현재 소속 조" 순으로 정해
  //   그 조의 시작·종료 시각을 쓴다. 예전에는 근무 형태와 무관하게 주간(09~18)으로만
  //   계산해서 교대 근무자에게 틀린 시간을 보여줬다.
  function _shiftPlan(){
    var s = 9, e = 18, sh;   // sh: calcNetHours 휴게 공제에 넘길 조
    try{
      var t  = (typeof wt !== 'undefined') ? wt : 'day';
      var cs = (typeof customShift !== 'undefined' && customShift) ? customShift : null;
      var recShift = null;   // 오늘 기록에 저장된 조 (있으면 최우선)
      try{
        var d = new Date();
        var key = (typeof dk === 'function') ? dk(d.getFullYear(), d.getMonth(), d.getDate()) : null;
        var r = (key && typeof dayData !== 'undefined') ? dayData[key] : null;
        if(r && r.shift) recShift = r.shift;
      }catch(err){}
      if(t === '2shift'){
        sh = recShift || ((typeof p2Sh !== 'undefined' && p2Sh) ? p2Sh : 'day');
        if(sh === 'day_fixed') sh = 'day';
        var c2 = cs && (sh === 'night' ? cs.shift2night : cs.shift2day);
        if(c2){ s = c2.start; e = c2.end; }
        else if(typeof SHIFT2 !== 'undefined' && SHIFT2[sh]){ s = SHIFT2[sh].s; e = SHIFT2[sh].e; }
      } else if(t === '3shift'){
        sh = recShift || ((typeof myShift3 !== 'undefined' && myShift3) ? myShift3 : 'A');
        if(sh === 'day_fixed') sh = 'A';
        var c3 = cs && cs[{A:'shift3a', B:'shift3b', C:'shift3c'}[sh]];
        if(c3){ s = c3.start; e = c3.end; }
        else if(typeof SHIFT3 !== 'undefined' && SHIFT3[sh]){ s = SHIFT3[sh].s; e = SHIFT3[sh].e; }
      } else if(t === 'night'){
        if(cs && cs.night){ s = cs.night.start; e = cs.night.end; }
        else if(typeof nightStart !== 'undefined'){ s = nightStart; e = (nightStart + 8) % 24; }
      } else {
        if(cs && cs.day){ s = cs.day.start; e = cs.day.end; }
        else if(typeof dayStart !== 'undefined'){ s = dayStart; e = dayStart + 9; }
      }
    }catch(err){}
    var span = e - s; if(span <= 0) span += 24;
    var net = span;
    try{ if(typeof calcNetHours === 'function'){ var n = calcNetHours(s, e, 'work', sh); if(n > 0) net = n; } }catch(err){}
    return { start:s, end:e, span:span, net:net };
  }

  function _hhmm(h){
    try{ if(typeof fmtTime === 'function') return fmtTime(h); }catch(e){}
    var hh = Math.floor(h), mm = Math.round((h - hh) * 60);
    return (hh<10?'0':'')+hh+':'+(mm<10?'0':'')+mm;
  }
  function _durStr(hours){
    if(hours < 0) hours = 0;
    var h = Math.floor(hours), m = Math.floor((hours - h) * 60);
    return h > 0 ? (h+'시간 '+m+'분') : (m+'분');
  }
  function _nowH(){
    var d = new Date();
    return d.getHours() + d.getMinutes()/60;
  }

  // 오늘 기록 수집 (근무 중 / 완료 건수 / 사업장명)
  function _todayRecs(){
    var d = new Date(), working = null, done = 0, any = false;
    try{
      if(typeof CompanyEngine !== 'undefined'){
        CompanyEngine.companies().forEach(function(c){
          var rec = null;
          try{ rec = CompanyEngine.recOf(c.wpId, c.empId, d); }catch(e){}
          if(!rec || rec.start === undefined || rec.start === null) return;
          any = true;
          if(rec.end === undefined || rec.end === null){
            if(!working) working = { name:c.name, start:rec.start };
          } else done++;
        });
      }
    }catch(e){}
    // 폴백: CompanyEngine 경로로 아무것도 못 읽으면 현재 사업장 기록(dayData)을 직접 본다.
    // (단일 사업장·엔진 미초기화 상태에서 완료/근무 중 상태를 놓치지 않도록)
    if(!any){
      try{
        var key = (typeof dk === 'function') ? dk(d.getFullYear(), d.getMonth(), d.getDate()) : null;
        var r = (key && typeof dayData !== 'undefined') ? dayData[key] : null;
        if(r && r.start !== undefined && r.start !== null &&
           r.status && r.status !== 'none' && r.status !== 'public'){
          any = true;
          if(r.end === undefined || r.end === null) working = { name:_mainWpName(), start:r.start };
          else done++;
        }
      }catch(e){}
    }
    return { working:working, done:done, any:any };
  }

  function _mainWpName(){
    try{
      if(typeof CompanyEngine !== 'undefined'){
        var cs = CompanyEngine.companies();
        for(var i=0;i<cs.length;i++) if(cs[i].wpId === activeWpId) return cs[i].name;
        if(cs.length) return cs[0].name;
      }
    }catch(e){}
    try{ var el = document.getElementById('company-input'); if(el && el.value) return el.value; }catch(e){}
    return '내 사업장';
  }

  // 오늘 등록된 근무 일정이 있는지 — 기존 저장 구조 조회만
  function _hasTodayPlan(){
    var d = new Date(), key = null;
    try{ key = (typeof dk === 'function') ? dk(d.getFullYear(), d.getMonth(), d.getDate()) : null; }catch(e){}
    var jobs = [];
    try{ jobs = (typeof loadSelectedJobs === 'function') ? loadSelectedJobs() : []; }catch(e){}
    // 시급제·연봉제: 평일이면 근무 예정으로 본다 (주말은 특근 토글이 켜져 있을 때만)
    if(jobs.indexOf('employee') >= 0 || jobs.indexOf('salary') >= 0){
      var dow = d.getDay();
      if(dow !== 0 && dow !== 6) return true;
      try{
        var w = weekOfMonth(d.getFullYear(), d.getMonth(), d.getDate());
        var k = weekKey(d.getFullYear(), d.getMonth(), w, dow === 6 ? 'sat' : 'sun');
        if(satToggle && satToggle[k]) return true;
      }catch(e){}
    }
    if(key){
      try{ if(typeof albaData !== 'undefined' && (albaData[key]||[]).length) return true; }catch(e){}
      try{
        if(typeof njobLoad === 'function'){
          var nj = njobLoad(key);
          if(nj && ((nj.alba||[]).length || (nj.etc||[]).length)) return true;
        }
      }catch(e){}
      try{ if(typeof flData !== 'undefined' && (flData[key]||[]).length) return true; }catch(e){}
    }
    return false;
  }

  // 오늘 예정 금액 — **명시적으로 저장된 금액만** 사용한다 (새 계산 금지).
  // 저장된 금액이 없으면 0을 돌려주고, 화면에서는 예상 금액 문구를 생략한다.
  function _todayPlannedStoredAmount(){
    var sum = 0, d = new Date(), key = null;
    try{ key = (typeof dk === 'function') ? dk(d.getFullYear(), d.getMonth(), d.getDate()) : null; }catch(e){}
    if(!key) return 0;
    try{
      if(typeof njobLoad === 'function'){
        var nj = njobLoad(key);
        (nj && nj.alba || []).forEach(function(it){ if(it && it.amount != null) sum += it.amount; });
        (nj && nj.etc  || []).forEach(function(it){ if(it && it.amount != null) sum += it.amount; });
      }
    }catch(e){}
    return sum;
  }

  var SVG_OUT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 5H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h4M14 8l4 4-4 4M18 12h-8"/></svg>';
  var SVG_IN  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 5h4a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-4M10 8l-4 4 4 4M6 12h8"/></svg>';

  var HERO_START = "(function(){if(typeof _wsStart==='function'){_wsStart(typeof _wsMainJob==='function'?_wsMainJob():'employee');}else{showPage('att');}})();setTimeout(function(){if(typeof renderHomePage==='function')renderHomePage();},300)";
  var HERO_END   = "(function(){if(typeof _wsActive==='function'&&_wsActive()){if(typeof _wsEnd==='function')_wsEnd();}else{showPage('att');}})();setTimeout(function(){if(typeof renderHomePage==='function')renderHomePage();},300)";

  function _heroState(){
    var earn = _todayEarn();            // 헤더 칩과 동일 소스
    var recs = _todayRecs();
    var plan = _shiftPlan();
    var ws = null;
    try{ ws = _wsActive(); }catch(e){}

    if(recs.working || ws){
      var startH = recs.working ? recs.working.start : (ws ? ws.startH : plan.start);
      var elapsed = ws ? ws.elapsed : (_nowH() - startH);
      if(elapsed < 0) elapsed += 24;
      return { kind:'working', name:(recs.working ? recs.working.name : _mainWpName()),
               startH:startH, elapsed:elapsed, plan:plan, earn:earn };
    }
    if(recs.done > 0) return { kind:'done', earn:earn };
    if(!_hasTodayPlan()) return { kind:'none', earn:earn };
    // ★ 시작 시각이 지났다고 무조건 "지남"으로 두면, 밤 11시에 "아침 9시에서 14시간 지남"
    //   같은 쓸모없는 안내가 된다. 오늘 근무 시간대(start~end) 안일 때만 "지남"으로 보고,
    //   그 시간대까지 지났으면 다음 출근(내일)까지의 카운트다운으로 넘긴다.
    var nowH = _nowH();
    var diff = plan.start - nowH;
    if(diff > 0) return { kind:'pre', name:_mainWpName(), plan:plan, until:diff,
                          planned:_todayPlannedStoredAmount(), earn:earn };
    var endH = plan.end; if(endH <= plan.start) endH += 24;   // 야간근무 대응
    if(nowH < endH) return { kind:'late', name:_mainWpName(), plan:plan, over:-diff,
                             planned:_todayPlannedStoredAmount(), earn:earn };
    return { kind:'pre', name:_mainWpName(), plan:plan, until:(24 - nowH + plan.start),
             tomorrow:true, planned:0, earn:earn };
  }

  // 날씨 힌트 (출근 전 상태 — 날씨 데이터 있을 때만)
  function _heroWxHint(){
    var w = null;
    try{ w = WeatherBuilder.build(WeatherProvider.getCache()); }catch(e){}
    if(!w) return '';
    var msg = '';
    if(w.isRainingNow || w.isRainy) msg = '출근길에 비가 와요. 우산 챙기세요';
    else if(w.isSnowingNow)         msg = '눈이 와요. 평소보다 일찍 나서세요';
    else if(w.isBadPm)              msg = '미세먼지가 안 좋아요. 마스크 챙기세요';
    else if(w.isCold)               msg = '많이 추워요. 따뜻하게 입고 나가세요';
    else if(w.isHot)                msg = '더운 날이에요. 물 챙기세요';
    if(!msg) return '';
    return '<div class="mn-hero-wx">'+_wxSvg(w.text)+'<span>'+msg+'</span></div>';
  }

  function _heroHtml(){
    var s = _heroState();

    // ── 2-A. 근무 중 ──
    if(s.kind === 'working'){
      var net = s.plan.net;
      var pct = net > 0 ? Math.min(100, Math.round(s.elapsed / net * 1000)/10) : 0;
      var over = s.elapsed - net;
      var rightLabel = over > 0
        ? '<span class="mn-hero-over">+'+_durStr(over)+' 초과</span>'
        : '<span>'+_hhmm(s.plan.end)+' 퇴근 예정</span>';
      return '<div class="mn-hero mn-hero--work">'
        +'<div class="mn-hero-status"><i></i>근무 중 · '+s.name+'</div>'
        +'<div class="mn-hero-num" id="mn-hero-elapsed">'+_durStr(s.elapsed)+'</div>'
        +'<div class="mn-hero-sub">'+_hhmm(s.startH)+' 출근 · 지금까지 <b>'+_fmtWon(s.earn.sum)+'원</b></div>'
        +'<div class="mn-hero-gauge"><i id="mn-hero-gauge" style="width:'+pct+'%"></i></div>'
        +'<div class="mn-hero-gauge-lbl"><span>'+(Math.round(net*10)/10)+'시간 예정</span>'+rightLabel+'</div>'
        +'<button class="mn-hero-cta mn-hero-cta--light" onclick="'+HERO_END.replace(/"/g,'&quot;')+'">'
        + SVG_OUT +'지금 퇴근 기록</button>'
        +'</div>';
    }

    // ── 2-B. 오늘 근무 완료 ──
    if(s.kind === 'done'){
      return '<div class="mn-hero mn-hero--plain">'
        +'<div class="mn-hero-label">오늘 근무 완료</div>'
        +'<div class="mn-hero-num mn-hero-num--amt">오늘 +'+_fmtWon(s.earn.sum)+'원</div>'
        +'<div class="mn-hero-sub2">오늘도 수고하셨어요.</div>'
        +'<a class="mn-hero-link" onclick="showPage(\'att\')">근태 기록 보기</a>'
        +'</div>';
    }

    // ── 2-B. 근무 일정 없음 ──
    if(s.kind === 'none'){
      return '<div class="mn-hero mn-hero--plain">'
        +'<div class="mn-hero-label">오늘 일정</div>'
        // 숫자가 아니라 문장이 들어가는 자리 — 44px은 375px에서 넘치므로 텍스트 크기를 쓴다
        +'<div class="mn-hero-num mn-hero-num--text">근무 일정이 없어요</div>'
        +'<div class="mn-hero-sub2">근무를 등록하면 예상 수입을 계산해드릴게요.</div>'
        +'<button class="mn-hero-cta mn-hero-cta--blue" onclick="showPage(\'att\')">'
        + SVG_IN +'근무 등록하기</button>'
        +'</div>';
    }

    // ── 2-B. 출근 전 / 예정 시각 지남 ──
    // 지남 상태에서는 **어느 근무인지 헷갈리지 않도록 예정 시각을 함께** 보여준다.
    var isLate = (s.kind === 'late');
    var amtTxt = s.planned > 0 ? ' · 예상 <b>'+_fmtWon(s.planned)+'원</b>' : '';
    var subTxt = isLate
      ? s.name+' · '+_hhmm(s.plan.start)+' 출근 예정이었어요'+amtTxt
      : s.name+' · '+(s.tomorrow ? '내일 ' : '')+_hhmm(s.plan.start)+' 시작'+amtTxt;
    return '<div class="mn-hero mn-hero--plain">'
      +'<div class="mn-hero-label">'+(isLate ? '출근 시간이 지났어요' : '다음 근무까지')+'</div>'
      // 숫자 자리는 44px 고정이라 문자열이 길면 375px에서 줄바꿈된다 —
      // "지남"은 라벨("출근 시간이 지났어요")이 이미 전달하므로 숫자에는 넣지 않는다
      +'<div class="mn-hero-num">'+_durStr(isLate ? s.over : s.until)+'</div>'
      +'<div class="mn-hero-sub2">'+subTxt+'</div>'
      + _heroWxHint()
      +'<button class="mn-hero-cta mn-hero-cta--blue" onclick="'+HERO_START.replace(/"/g,'&quot;')+'">'
      + SVG_IN +'출근 도장 찍기</button>'
      +'</div>';
  }

  // ══════════════════════════════════════════
  // HOME v2 ② "오늘 남은 일" (HOME_V2_SPEC §3)
  //  · 남은 근무 — 오늘 예정 중 아직 시작 시각이 지나지 않은 알바/N잡 + 프리랜서 일정
  //  · 미기록 유도 — 오늘 지출 기록이 0건일 때만
  //  · 남은 일이 0건이면 섹션 전체를 렌더하지 않는다 (검증 4 — 빈 카드 금지)
  //  금액은 저장된 값이 있을 때만 표기 (임의 추정 금지)
  // ══════════════════════════════════════════
  var SVG_CHEV = '<svg class="mn-todo-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';

  function _todayTodos(){
    var out = [], d = new Date(), nowH = _nowH(), key = null;
    try{ key = (typeof dk === 'function') ? dk(d.getFullYear(), d.getMonth(), d.getDate()) : null; }catch(e){}

    if(key){
      // 알바(레거시) — 시작 시각이 아직 안 지난 건만 "남은 근무"
      try{
        (typeof albaData !== 'undefined' ? (albaData[key]||[]) : []).forEach(function(it){
          if(it.startH === undefined || it.startH === null || it.startH <= nowH) return;
          out.push({ title: it.name || '알바', sub: _hhmm(it.startH)+' 시작', tap:"showPage('att')" });
        });
      }catch(e){}
      // N잡 — 저장된 금액이 있으면 함께 표기
      try{
        if(typeof njobLoad === 'function'){
          var nj = njobLoad(key);
          (nj && nj.alba || []).forEach(function(it){
            if(it.startH !== undefined && it.startH !== null && it.startH <= nowH) return;
            var parts = [];
            if(it.startH !== undefined && it.startH !== null) parts.push(_hhmm(it.startH)+' 시작');
            else if(it.hours) parts.push(it.hours+'시간 예정');
            if(it.amount != null) parts.push('예상 '+_fmtWon(it.amount)+'원');
            out.push({ title: it.name || '알바', sub: parts.join(' · ') || '오늘 예정', tap:"showPage('att')" });
          });
        }
      }catch(e){}
      // 프리랜서 일정 — 오늘 할 일 성격이라 그대로 남은 일로 노출
      try{
        (typeof flData !== 'undefined' ? (flData[key]||[]) : []).forEach(function(it){
          out.push({ title: it.title || '일정',
                     sub: it.alarmTime ? (it.alarmTime+' 알림') : '오늘 일정',
                     tap:"showPage('att')" });
        });
      }catch(e){}
    }

    // 미기록 유도 — 오늘 지출 기록이 0건일 때만 (시그넛 없음, 탭 시 마이크)
    try{
      if(typeof budgetState !== 'undefined'){
        if(!budgetState._loaded && typeof budgetLoad === 'function') budgetLoad();
        var tISO = _todayISO();
        var cnt = (budgetState.variableExpenses||[]).filter(function(e){ return e.date === tISO; }).length;
        if(cnt === 0){
          out.push({ title:'오늘 지출 기록 안 했어요',
                     sub:'마이크로 "점심 9천원" 이라고 말해도 돼요',
                     tap:'mnOpenVoice()', noChev:true });
        }
      }
    }catch(e){}

    return out;
  }

  // 마이크(음성 바) 열기 — 남은 일 행에서 호출
  window.mnOpenVoice = function(){
    var vb = document.getElementById('mn-voice-bar');
    var mic = document.getElementById('mn-ab-mic');
    if(!vb){ if(typeof showPage==='function') showPage('budget'); return; }
    vb.classList.add('open');
    if(mic) mic.classList.add('on');
    var inp = document.getElementById('mn-voice-input');
    if(inp) setTimeout(function(){ inp.focus(); }, 50);
  };

  function _todoListHtml(){
    var items = _todayTodos();
    if(!items.length) return '';        // 검증 4: 0건이면 섹션 자체를 만들지 않는다
    return '<div class="mn-todo">'
      +'<div class="mn-todo-h">오늘 남은 일</div>'
      + items.map(function(it){
          return '<div class="mn-todo-row" onclick="'+String(it.tap).replace(/"/g,'&quot;')+'">'
            +'<span class="mn-todo-node"></span>'
            +'<span class="mn-todo-txt"><b>'+it.title+'</b><i>'+it.sub+'</i></span>'
            + (it.noChev ? '' : SVG_CHEV)
            +'</div>';
        }).join('')
      +'</div>';
  }

  // 경과 시간·게이지 1분 갱신 (근무 중일 때만)
  var _heroTimer = null;
  function _startHeroTimer(){
    if(_heroTimer) return;
    _heroTimer = setInterval(function(){
      var el = document.getElementById('mn-hero-elapsed');
      if(!el) return;                       // 근무 중 히어로가 화면에 없으면 아무것도 안 함
      var s = _heroState();
      if(s.kind !== 'working'){ if(typeof renderHomePage==='function') renderHomePage(); return; }
      el.textContent = _durStr(s.elapsed);
      var g = document.getElementById('mn-hero-gauge');
      if(g && s.plan.net > 0) g.style.width = Math.min(100, Math.round(s.elapsed/s.plan.net*1000)/10) + '%';
      updateTodayChip();
    }, 60000);
  }

  // 홈 = 오늘 타임라인 (README 홈 명세 — 기존 계산 함수 반환값 바인딩만)
  function renderTimelineHome(){
    var page = document.getElementById('home-page');
    if(!page) return false;
    var d = new Date();
    var wd = ['일','월','화','수','목','금','토'][d.getDay()];

    // 이번 달 요약 바 (③단계에서 명세 형태로 정리)
    var sumBar = '';
    try{
      var fin = HomeDashboardBuilder.financial();
      if(fin && fin.hasRealData && fin.incTotal>0){
        sumBar = '<div class="mn-month-bar" onclick="showPage(\'sal\')">'
          +'<span class="mn-month-lbl">이번 달 예상 수입</span>'
          +'<span class="mn-month-val">'+_fmtWon(fin.incTotal)+'원</span>'
          +'</div>';
      }
    }catch(e){}

    var H = '<div class="home-content mn-home">';
    H += '<div class="mn-home-date">'+(d.getMonth()+1)+'월 '+d.getDate()+'일 '+wd+'요일</div>';
    // ① 히어로 카드 (상태에 따라 통째로 교체)
    H += _heroHtml();
    // ② "오늘 남은 일" — 0건이면 섹션 자체가 렌더되지 않는다
    H += _todoListHtml();
    // ③ 월 요약 바
    H += sumBar;
    // HOME v2 §1: 빠른 실행 4버튼·내 자산 카드는 홈에서 제거(기능은 각 화면으로 이동 완료).
    //   출근/퇴근 → 히어로 CTA + 근태 화면 / 지출 입력 → 생존관리 / 급여 확인 → 수입 탭 /
    //   내 자산 → 생존관리(이번 차수에 추가). 삭제가 아니라 이동이다.
    H += '</div>';
    page.innerHTML = H;
    _startHeroTimer();
    return true;
  }

  // 홈에서 날씨/브리핑/뉴스 카드 제거 (정보 탭으로 이동)
  function stripHomeCards(){
    var home = document.getElementById('home-page');
    if(!home) return;
    var wx = home.querySelector('#home-wx-wrap');
    if(wx) wx.remove();
    var br = home.querySelector('#home-briefing');
    if(br){ var c = br.closest('.home-card'); if(c) c.remove(); }
    var nw = home.querySelector('#home-news-list');
    if(nw){ var c2 = nw.closest('.home-card'); if(c2) c2.remove(); }
  }

  function patchRenderHome(){
    if(typeof window.renderHomePage !== 'function' || window.renderHomePage.__mnV6tl) return;
    var legacy = window.renderHomePage;
    window.renderHomePage = function(){
      var ok = false;
      try{ ok = renderTimelineHome(); }catch(e){ ok = false; }
      if(!ok){ legacy(); stripHomeCards(); }
      updateTodayChip();
    };
    window.renderHomePage.__mnV6tl = true;
  }

  // ══════════════════════════════════════════
  // 음성 입력 (v6 흡수 — 출근/퇴근 명령 + 머니냥 챗 전달)
  // ══════════════════════════════════════════
  function ensureVoiceBar(){
    if(document.getElementById('mn-voice-bar')) return;
    var bar = document.createElement('div');
    bar.id = 'mn-voice-bar';
    // 파형 5개 막대 — 실제 마이크 입력 레벨에만 연동한다(고정 애니메이션 금지).
    // 레벨을 못 읽으면 파형을 아예 표시하지 않아 "듣고 있다"는 거짓 신호를 주지 않는다.
    bar.innerHTML =
      '<div id="mn-voice-wave" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>'
      +'<input id="mn-voice-input" placeholder="말하듯이 입력… (예: 점심 9,500원)" autocomplete="off">'
      +'<button id="mn-voice-mic" title="음성 입력">🎙️</button>';
    document.body.appendChild(bar);
    var st = document.createElement('style');
    st.textContent =
      '#mn-voice-bar{position:fixed;left:12px;right:12px;bottom:calc(var(--mob-nav-h,60px) + var(--safe-bottom,0px) + 10px);z-index:850;display:none;gap:8px;align-items:center;}'
      // 새 셸: 하단 액션 바 위에 뜨고, 마이크 버튼으로만 열린다
      +'body.mn-shell #mn-voice-bar{bottom:calc(74px + var(--safe-bottom,0px));display:none;}'
      +'body.mn-shell #mn-voice-bar.open{display:flex;}'
      +'@media (min-width:769px){#mn-voice-bar{left:auto;right:24px;bottom:88px;width:360px;}}'
      +'#mn-voice-input{flex:1;background:var(--surface);border:1px solid var(--border);color:var(--text);border-radius:999px;padding:13px 18px;font-size:13px;font-family:\'Noto Sans KR\',sans-serif;outline:none;box-shadow:var(--mn-shadow-2,0 2px 8px rgba(0,0,0,.08));min-height:44px;}'
      +'#mn-voice-input:focus{border-color:var(--accent);}'
      +'#mn-voice-mic{width:48px;height:48px;border-radius:50%;border:none;background:var(--mn-point,#F59E0B);color:#fff;font-size:19px;cursor:pointer;flex:none;box-shadow:var(--mn-shadow-amber,0 4px 14px rgba(245,158,11,.32));}'
      +'#mn-voice-mic.rec{background:#D97706;}'
      // 파형: 기본 숨김 → 실제 레벨을 읽을 수 있을 때만 .live로 표시
      +'#mn-voice-wave{display:none;align-items:center;gap:3px;flex:none;height:44px;padding:0 12px;'
      +'background:var(--mn-primary,#2563EB);border-radius:999px;box-shadow:var(--mn-shadow-blue);}'
      +'#mn-voice-wave.live{display:flex;}'
      +'#mn-voice-wave i{display:block;width:3px;border-radius:2px;height:4px;background:#9db8f5;transition:height .08s linear;}'
      +'#mn-voice-wave i:nth-child(2n){background:#fff;}'
      // 구 셸(데스크톱)에서는 로그인 후 항상 표시 (기존 동작 유지)
      // 구 데스크톱(PC 셸 이전)에서만 상시 노출. PC 셸에서는 상단 바 마이크로 여닫는다
      +'body.mn-home-visible:not(.mn-shell):not(.mn-pc) #mn-voice-bar{display:flex;}'
      +'body.mn-pc #mn-voice-bar{display:none;}'
      +'body.mn-pc #mn-voice-bar.open{display:flex;}';
    document.head.appendChild(st);

    var inp = document.getElementById('mn-voice-input');
    var mic = document.getElementById('mn-voice-mic');
    inp.addEventListener('keydown', function(ev){
      if(ev.key==='Enter'){ ev.preventDefault(); handleVoiceText(inp.value); inp.value=''; }
    });
    mic.addEventListener('click', function(){ startVoice(mic, inp); });
  }

  function handleVoiceText(text){
    text = (text||'').trim();
    if(!text) return;
    var t = text.replace(/\s/g,'');
    if(t==='출근'||t==='출근했어'||t==='출근이야'){
      try{ if(typeof _wsStart==='function'){ _wsStart(typeof _wsMainJob==='function'?_wsMainJob():'employee'); if(typeof renderHomePage==='function') setTimeout(renderHomePage,300); if(typeof showToast==='function') showToast('☀️ 출근 도장 완료!'); return; } }catch(e){}
    }
    if(t==='퇴근'||t==='퇴근했어'||t==='퇴근이야'){
      try{ if(typeof _wsActive==='function'&&_wsActive()&&typeof _wsEnd==='function'){ _wsEnd(); if(typeof renderHomePage==='function') setTimeout(renderHomePage,300); if(typeof showToast==='function') showToast('🌙 퇴근 도장 완료! 오늘 수입이 확정됐어요'); return; } }catch(e){}
    }
    try{
      var ai = document.getElementById('asst-input');
      if(ai){
        ai.value = text;
        if(typeof toggleAsst==='function' && typeof asstOpen!=='undefined' && !asstOpen) toggleAsst();
        if(typeof sendAsst==='function') setTimeout(sendAsst, 150);
        return;
      }
    }catch(e){}
    if(typeof showToast==='function') showToast('💬 "'+text+'" — 처리할 수 없었어요');
  }

  // ── 파형 레벨 미터 (실제 마이크 입력에만 연동) ──
  // getUserMedia/AudioContext를 못 쓰면(비보안 컨텍스트·권한 거부·미지원) 파형을
  // 표시하지 않는다 — 고정 애니메이션은 "듣고 있다"는 거짓 신호가 되므로 금지.
  var _meter = null;
  function _startMeter(){
    var wave = document.getElementById('mn-voice-wave');
    if(!wave) return;
    if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return;
    navigator.mediaDevices.getUserMedia({audio:true}).then(function(stream){
      var ctx = new AC();
      var src = ctx.createMediaStreamSource(stream);
      var an  = ctx.createAnalyser();
      an.fftSize = 256; an.smoothingTimeConstant = 0.7;
      src.connect(an);
      var buf = new Uint8Array(an.frequencyBinCount);
      var bars = wave.querySelectorAll('i');
      var raf = null;
      wave.classList.add('live');
      var band = Math.floor(buf.length / bars.length);
      function tick(){
        an.getByteFrequencyData(buf);
        for(var i=0;i<bars.length;i++){
          var sum = 0;
          for(var j=i*band;j<(i+1)*band;j++) sum += buf[j];
          var lvl = (sum/band)/255;                      // 0~1
          bars[i].style.height = Math.max(4, Math.round(4 + lvl*22)) + 'px';
        }
        raf = requestAnimationFrame(tick);
      }
      tick();
      _meter = { stop: function(){
        if(raf) cancelAnimationFrame(raf);
        wave.classList.remove('live');
        try{ stream.getTracks().forEach(function(t){ t.stop(); }); }catch(e){}
        try{ ctx.close(); }catch(e){}
      }};
    }).catch(function(){ /* 권한 거부·비보안 컨텍스트 → 파형 없이 진행 */ });
  }
  function _stopMeter(){
    if(_meter){ try{ _meter.stop(); }catch(e){} _meter = null; }
    var wave = document.getElementById('mn-voice-wave');
    if(wave) wave.classList.remove('live');
  }

  var _rec = null;

  // 인식 중지 (음성 바를 닫을 때)
  function stopVoice(){
    if(_rec){ try{ _rec.stop(); }catch(e){} _rec = null; }
    var mic = document.getElementById('mn-voice-mic');
    if(mic) mic.classList.remove('rec');
    _stopMeter();
    _restorePh(document.getElementById('mn-voice-input'));
  }

  function startVoice(mic, inp){
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if(!SR){ if(typeof showToast==='function') showToast('이 브라우저는 음성 인식을 지원하지 않아요 — 입력창에 적어주세요'); inp.focus(); return; }
    // 음성 인식·마이크는 보안 컨텍스트(https 또는 localhost)에서만 동작한다.
    // 파일(file://)로 열면 조용히 실패해 "말해도 인식이 안 된다"로 보이므로 이유를 알린다.
    if(window.isSecureContext === false){
      if(typeof showToast==='function') showToast('음성 인식은 https 주소에서만 돼요 — 지금은 입력창에 적어주세요');
      inp.focus(); return;
    }
    if(_rec){ stopVoice(); return; }
    var r = new SR();
    r.lang = 'ko-KR'; r.interimResults = false; r.maxAlternatives = 1;
    mic.classList.add('rec');
    inp.placeholder = '듣고 있어요… "퇴근했어" 처럼 말해보세요';
    _startMeter();
    r.onresult = function(ev){
      var text = ev.results[0][0].transcript;
      inp.value = text;
      setTimeout(function(){ handleVoiceText(text); inp.value=''; }, 200);
    };
    // 실패 원인을 구분해 알려준다 (조용히 끝나면 사용자는 앱이 고장난 줄 안다)
    r.onerror = function(ev){
      var e = ev && ev.error, msg = '🎙️ 음성을 인식하지 못했어요 — 다시 시도해주세요';
      if(e === 'not-allowed' || e === 'service-not-allowed')
        msg = '🎙️ 마이크 권한이 필요해요 — 브라우저 설정에서 허용해주세요';
      else if(e === 'no-speech')  msg = '🎙️ 소리가 들리지 않았어요 — 다시 말씀해주세요';
      else if(e === 'network')    msg = '🎙️ 네트워크가 필요해요 — 연결 후 다시 시도해주세요';
      else if(e === 'audio-capture') msg = '🎙️ 마이크를 찾지 못했어요';
      if(typeof showToast==='function') showToast(msg);
    };
    r.onend = function(){ mic.classList.remove('rec'); _rec = null; _stopMeter(); _restorePh(inp); };
    _rec = r;
    try{ r.start(); }catch(e){ mic.classList.remove('rec'); _rec = null; _stopMeter(); _restorePh(inp); }
  }
  function _restorePh(inp){
    if(inp) inp.placeholder = '말하듯이 입력… (예: 점심 9,500원)';
  }

  // ══════════════════════════════════════════
  // 모바일 셸 v7 — 헤더 + 6탭 + 스와이프 트랙 + 하단 액션 바
  // ══════════════════════════════════════════
  var NAMES = ['home','info','att','sal','budget','dash','settings'];
  var IDX = {home:0, info:1, att:2, sal:3, budget:4, dash:5, settings:6};
  var TABS = [
    {p:'home',   label:'홈'},
    {p:'info',   label:'정보'},
    {p:'att',    label:'근태'},
    {p:'sal',    label:'수입'},
    {p:'budget', label:'생존'},
    {p:'dash',   label:'연간'}
  ];
  var cur = 0;

  function _avatarImg(size){
    var src = 'img/emoji/환영인사.png';
    return '<img src="'+src+'" alt="머니냥" style="width:'+size+'px;height:'+size+'px;border-radius:50%;object-fit:cover;background:#fff;">';
  }

  function buildShell(){
    var app  = document.getElementById('app');
    var main = document.getElementById('main');
    if(!app || !main) return false;

    // ── 헤더 (알림 종 없음 — 정보 탭 빨간 점으로 대체) ──
    var hd = document.createElement('div');
    hd.id = 'mn-header';
    hd.innerHTML =
      // ★ 삼선(햄버거): 캐릭터 왼쪽 — 기존 왼쪽 드로어(#sidebar)를 연다.
      //   sidebar-disabled 직종(일반알바·프리랜서 등)에서는 CSS로 숨긴다.
      '<div id="mn-hd-brand">'
      +'<button id="mn-hd-menu" aria-label="설정 메뉴" onclick="toggleDrawer()">'
      +'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/></svg>'
      +'</button>'
      +_avatarImg(31)+'<span>머니냥</span></div>'
      +'<div id="mn-hd-right">'
      +'<span id="mn-today-chip" onclick="showPage(\'home\')">오늘 0원</span>'
      +'<button id="mn-hd-gear" aria-label="설정" onclick="showPage(\'settings\')">'
      +'<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>'
      +'</button></div>';
    document.body.insertBefore(hd, app);

    // ── 6탭 + 인디케이터 ──
    var tabs = document.createElement('div');
    tabs.id = 'mn-tabs';
    tabs.innerHTML = TABS.map(function(t){
      return '<button class="mn-tab" id="mn-tab-'+t.p+'" onclick="showPage(\''+t.p+'\')">'+t.label
        + (t.p==='info' ? '<span id="mn-info-dot"></span>' : '') + '</button>';
    }).join('') + '<span id="mn-tab-ind"></span>';
    document.body.insertBefore(tabs, app);

    // ── 스와이프 트랙: 기존 화면 div 7개를 트랙의 자식으로 이동 ──
    var track = document.createElement('div');
    track.id = 'mn-track';
    NAMES.forEach(function(p){
      var el = document.getElementById(_pageId(p));
      if(!el){ el = document.createElement('div'); el.id = _pageId(p); }
      el.classList.add('mn-screen');
      el.style.display = 'block';   // display 토글 → translateX 방식으로 전환
      track.appendChild(el);
    });
    main.appendChild(track);

    // ── 하단 액션 바 (흐름 안 — 고정 플로팅 아님, 콘텐츠를 덮지 않는다) ──
    var ab = document.createElement('div');
    ab.id = 'mn-actionbar';
    ab.innerHTML =
      '<div id="mn-dots">'+TABS.map(function(t,i){ return '<span class="mn-dot" data-i="'+i+'"></span>'; }).join('')+'</div>'
      +'<div id="mn-ab-btns">'
      +'<button id="mn-ab-mic" aria-label="음성 입력">'
      +'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>'
      +'</button>'
      +'<button id="mn-ab-chat" aria-label="머니냥 비서">'+_avatarImg(30)+'</button>'
      +'</div>';
    document.body.appendChild(ab);

    // 액션 바 동작: 마이크 = 음성 바 토글 / 챗봇 = 기존 어시스턴트 열기
    document.getElementById('mn-ab-mic').addEventListener('click', function(){
      var vb = document.getElementById('mn-voice-bar');
      if(!vb) return;
      var open = vb.classList.toggle('open');
      this.classList.toggle('on', open);
      // ★ 바만 열고 끝내면 "음성 모드로 바꿨는데 말해도 인식이 안 된다"가 된다.
      //   열 때 바로 듣기 시작하고, 닫을 때 중지한다.
      var inp = document.getElementById('mn-voice-input');
      var mic2 = document.getElementById('mn-voice-mic');
      if(open){ if(mic2 && inp) startVoice(mic2, inp); }
      else { stopVoice(); }
    });
    document.getElementById('mn-ab-chat').addEventListener('click', function(){
      var vb = document.getElementById('mn-voice-bar');
      if(vb) vb.classList.remove('open');
      var mi = document.getElementById('mn-ab-mic'); if(mi) mi.classList.remove('on');
      try{ if(typeof toggleAsst==='function') toggleAsst(); }catch(e){}
    });

    document.body.classList.add('mn-shell');
    return true;
  }

  function _pageId(p){
    return {home:'home-page', info:'info-page', att:'att-page', sal:'salary-page',
            budget:'budget-page', dash:'dash-page', settings:'settings-page'}[p];
  }

  // ── 진입 시 렌더 (render-on-show 유지 — 탭/스와이프/해시 공통 경로) ──
  function renderFor(p){
    try{
      if(p==='home'    && typeof renderHomePage==='function')     renderHomePage();
      if(p==='info')                                              renderInfoPage();
      if(p==='sal'     && typeof renderIncomePage==='function')   renderIncomePage();
      if(p==='settings'&& typeof renderSettingsPage==='function') renderSettingsPage();
      if(p==='dash'    && typeof renderDash==='function')         renderDash();
      if(p==='budget'  && typeof renderBudgetPage==='function')   renderBudgetPage();
      if(p==='att'){
        ensureAttUI();   // 모바일 셸: 주 스트립 + 전체달력 시트 (셸 아니면 no-op)
        if(typeof renderCalendar==='function') renderCalendar();
        if(typeof updateTodayPanel==='function') setTimeout(updateTodayPanel, 100);
      }
    }catch(e){}
  }

  function _setTrack(idx, dragPx, animate){
    var track = document.getElementById('mn-track');
    var ind = document.getElementById('mn-tab-ind');
    if(!track) return;
    track.style.transition = animate ? '' : 'none';
    track.style.transform = 'translateX(calc(' + (-idx*100/7) + '% + ' + (dragPx||0) + 'px))';
    if(ind){
      ind.style.transition = animate ? '' : 'none';
      var w = track.parentNode.clientWidth || 1;
      var pos = Math.min(5, idx) - (dragPx||0)/w;   // 드래그 중 실시간 추종
      ind.style.transform = 'translateX(' + (pos*100) + '%)';
      ind.style.opacity = (idx===6 && !dragPx) ? '0' : '1';   // 설정 화면: 인디케이터 숨김
    }
  }

  function shellGo(p, fromHash){
    var idx = IDX[p];
    if(idx===undefined) idx = 0, p = 'home';
    cur = idx;
    _setTrack(idx, 0, true);
    // 탭 active + 페이지 점
    TABS.forEach(function(t){
      var b = document.getElementById('mn-tab-'+t.p);
      if(b) b.classList.toggle('active', t.p===p);
    });
    // 구 데스크톱 탭(.main-tab)의 active도 동기화 — 숨겨져 있지만 어시스턴트가
    // getCurrentPageId()로 이걸 읽어 화면별 컨텍스트·추천 질문을 만든다.
    // (동기화하지 않으면 셸에서 챗봇이 항상 '홈' 기준으로 답함)
    document.querySelectorAll('.main-tab').forEach(function(b){
      b.classList.toggle('active', b.id === 'btn-'+p);
    });
    document.querySelectorAll('#mn-dots .mn-dot').forEach(function(d,i){
      d.classList.toggle('active', i===Math.min(5,idx) && idx<6);
    });
    // URL 해시 반영 (PWA 뒤로가기·새로고침 복원). cur를 먼저 갱신했으므로
    // hashchange 핸들러는 같은 화면이면 no-op — 무한루프 없음
    if(!fromHash){
      try{ if(location.hash !== '#'+p) location.hash = p; }catch(e){}
    }
    renderFor(p);
    _syncInfoDot();
    updateTodayChip();
  }

  // ── 스와이프 (Pointer Events + ★axis lock★) ──
  // 세로 스크롤과의 충돌 방지가 핵심: 첫 이동에서 |dx|>|dy|일 때만 수평으로
  // 확정(axis lock)하고, 수평 확정 전에는 아무것도 하지 않아 세로 스크롤을
  // 방해하지 않는다. 래퍼/화면의 touch-action:pan-y가 브라우저 측 방어선.
  function bindSwipe(){
    var wrap = document.getElementById('main');
    if(!wrap) return;
    var sx=0, sy=0, drag=0, axis=null, active=false, pid=null;

    wrap.addEventListener('pointerdown', function(ev){
      if(ev.pointerType==='mouse' && ev.button!==0) return;
      active=true; axis=null; drag=0; sx=ev.clientX; sy=ev.clientY; pid=ev.pointerId;
    });

    wrap.addEventListener('pointermove', function(ev){
      if(!active || ev.pointerId!==pid) return;
      var dx = ev.clientX - sx, dy = ev.clientY - sy;
      if(axis===null){
        if(Math.abs(dx)<6 && Math.abs(dy)<6) return;      // 판정 전 데드존
        axis = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';   // ★ axis lock: 최초 1회만 판정
        if(axis==='h'){ try{ wrap.setPointerCapture(pid); }catch(e){} }
      }
      if(axis!=='h') return;                              // 세로 = 화면 자체 스크롤에 양보
      drag = dx;
      // 양 끝 고무줄 ×0.3 — 화면0 오른쪽 스와이프는 고무줄만, 히스토리 이동 없음
      if((cur===0 && dx>0) || (cur===5 && dx<0) || cur===6) drag = dx*0.3;
      _setTrack(cur, drag, false);
    });

    function finish(ev){
      if(!active || (pid!==null && ev.pointerId!==pid)) return;
      active=false;
      if(axis!=='h'){ axis=null; return; }
      axis=null;
      var target = cur;
      if(cur===6){
        if(drag>60) target = 5;                            // 설정에서는 오른쪽 스와이프로만 복귀
      } else {
        if(drag<-60 && cur<5) target = cur+1;
        if(drag> 60 && cur>0) target = cur-1;
      }
      drag=0;
      if(target!==cur) shellGo(NAMES[target]);
      else _setTrack(cur, 0, true);                        // 임계 미달 → 복귀
    }
    wrap.addEventListener('pointerup', finish);
    wrap.addEventListener('pointercancel', finish);
  }

  // ══════════════════════════════════════════
  // 근태 화면 (모바일 셸): 주 단위 스트립 + 전체달력 시트
  //  - 기존 달력(#cal-area)을 시트 오버레이로 이동 — 달력 JS는 id 기반이라 무수정 동작
  //  - 주 스트립 날짜 클릭 → 시트가 그 날짜 기록 팝업과 함께 열림
  // ══════════════════════════════════════════
  var ATT_DOT = { work:'--mn-att-work', early:'--mn-att-early', half:'--mn-att-half',
    leave:'--mn-att-leave', absent:'--mn-att-absent', holiday:'--mn-att-holiday',
    public:'--mn-att-holiday', sat_work:'--mn-att-holiday', sun_work:'--mn-att-holiday' };

  function _attStatusVar(data){
    if(!data || !data.status || data.status==='none') return null;
    if(data.shift==='night') return '--mn-att-night';
    return ATT_DOT[data.status] || null;
  }

  // 모바일 v3 화면: "N월 전체 달력 보기" 버튼을 주간 스트립 바로 아래로 옮긴다.
  //  기본 위치는 화면 맨 아래라 주간 스트립에서 달력으로 넘어가는 흐름이 끊긴다.
  function _mvFullCalBtn(){
    var btn = document.getElementById('attv3-open-fullcal');
    var cell = document.querySelector('[data-attv3-day]');
    if(!btn || !cell) return;
    // 스트립 행 → 스트립을 감싼 블록까지 올라가 그 다음 자리에 넣는다
    var anchor = cell.parentNode;
    if(anchor && anchor.parentNode && anchor.parentNode.id !== 'att-v3') anchor = anchor.parentNode;
    if(!anchor || !anchor.parentNode) return;
    if(btn.previousElementSibling === anchor) return;   // 이미 제자리
    btn.style.display = 'block';
    btn.style.margin = '10px 0 0';
    anchor.parentNode.insertBefore(btn, anchor.nextSibling);
  }

  function _attV3Active(){
    try{ return typeof attV3ShouldRender==='function' && attV3ShouldRender(); }
    catch(e){ return false; }
  }

  function ensureAttUI(){
    if(!shellBuilt) return;
    // 근태 v3(직장인·회사알바)는 자체 주간 스트립 + 월 전체달력 팝업을 이미 제공하며
    // (attendance-v3.js — #cal-area를 팝업으로 옮겼다 되돌리는 구조), 토큰은 1단계에서
    // 이미 반영됨. 여기서 또 만들면 중복 UI + #cal-area 이동 충돌 → 건너뛴다.
    // ★ v3가 자체 주간 스트립을 그리는 상태에서 내 스트립이 남아 있으면
    //   주 단위 달력이 위·아래로 두 개 보인다(직업 선택 등으로 v3가 나중에
    //   켜진 경우 발생). v3 스트립이 있으면 내 것을 걷어낸다.
    if(document.querySelector('[data-attv3-day]')){
      var dup = document.getElementById('mn-week-strip-wrap');
      if(dup) dup.remove();
    }
    if(_attV3Active()){ _mvFullCalBtn(); return; }
    // v3가 아닌 모든 달력(레거시 직장인 / 알바·배달 / 프리랜서 / 기타수익)에 적용.
    // 전부 #cal-area 안의 #calendar 그리드에 렌더하고 renderCalendar()가 직군 분기하므로
    // 시트·스트립은 공통으로 동작한다 (2026-07-25 차수: 알바/배달/프리랜서 지원 추가)
    var page = document.getElementById('att-page');
    var cal  = document.getElementById('cal-area');
    if(!page) return;
    // 전체달력 시트: cal-area를 오버레이로 이동
    if(!document.getElementById('mn-cal-sheet') && cal){
      var ov = document.createElement('div');
      ov.id = 'mn-cal-sheet';
      ov.innerHTML = '<div id="mn-cal-sheet-box">'
        +'<button id="mn-cal-close" aria-label="달력 닫기">✕</button>'
        +'<div id="mn-cal-sheet-body"></div></div>';
      document.body.appendChild(ov);
      document.getElementById('mn-cal-sheet-body').appendChild(cal);
      ov.addEventListener('click', function(ev){ if(ev.target===ov) mnCloseCal(); });
      document.getElementById('mn-cal-close').addEventListener('click', mnCloseCal);
    }
    // 주 스트립 + 전체달력 버튼
    if(!document.getElementById('mn-week-strip')){
      var wrap = document.createElement('div');
      wrap.id = 'mn-week-strip-wrap';
      wrap.innerHTML =
        '<div id="mn-week-hdr"><span id="mn-week-title"></span>'
        +'<span id="mn-week-hint">날짜를 누르면 기록할 수 있어요</span></div>'
        +'<div id="mn-week-strip"></div>'
        +'<button id="mn-cal-open-btn" onclick="mnOpenCal()"></button>';
      page.insertBefore(wrap, page.firstChild);
    }
    renderAttWeekStrip();
  }

  // 주 스트립 색점 — 직군별 기록 소스를 순서대로 확인 (표시용 읽기만, 계산 무접촉)
  //  직장인 상태색 → 알바/N잡(초록=일했음) → 프리랜서 일정(파랑) → 기타수익(초록)
  function _stripDotVar(d){
    var key = null;
    try{ key = (typeof dk==='function') ? dk(d.getFullYear(), d.getMonth(), d.getDate()) : null; }catch(e){}
    if(!key) return null;
    try{
      var dd = (typeof dayData!=='undefined') ? dayData[key] : null;
      var v = _attStatusVar(dd);
      if(v) return v;
    }catch(e){}
    try{ if(typeof albaData!=='undefined' && (albaData[key]||[]).length) return '--mn-att-work'; }catch(e){}
    try{
      if(typeof njobLoad==='function'){
        var nj = njobLoad(key);
        if(nj && (nj.alba||[]).length) return '--mn-att-work';
        if(nj && (nj.etc||[]).length)  return '--mn-att-work';
      }
    }catch(e){}
    try{ if(typeof flData!=='undefined' && (flData[key]||[]).length) return '--mn-att-leave'; }catch(e){}
    return null;
  }

  function renderAttWeekStrip(){
    var strip = document.getElementById('mn-week-strip');
    if(!strip) return;
    var today = new Date();
    var sun = new Date(today); sun.setDate(today.getDate()-today.getDay());   // 일요일 시작
    var names = ['일','월','화','수','목','금','토'];
    var cells = '', first = null, last = null;
    for(var i=0;i<7;i++){
      var d = new Date(sun); d.setDate(sun.getDate()+i);
      if(i===0) first = new Date(d);
      if(i===6) last  = new Date(d);
      var dotVar = _stripDotVar(d);
      var isToday = d.toDateString()===today.toDateString();
      var wdCls = i===0 ? 'sun' : (i===6 ? 'sat' : '');
      cells += '<button class="mn-ws-cell'+(isToday?' today':'')+'" '
        +'onclick="mnOpenCal('+d.getFullYear()+','+d.getMonth()+','+d.getDate()+')">'
        +'<span class="mn-ws-wd '+wdCls+'">'+names[i]+'</span>'
        +'<span class="mn-ws-day">'+d.getDate()+'</span>'
        +'<span class="mn-ws-dot" style="'+(dotVar?'background:var('+dotVar+')':'opacity:0')+'"></span>'
        +'</button>';
    }
    strip.innerHTML = cells;
    var t = document.getElementById('mn-week-title');
    if(t) t.textContent = '이번 주 ('+(first.getMonth()+1)+'월 '+first.getDate()+'일~'
      +(last.getMonth()+1)+'월 '+last.getDate()+'일)';
    var b = document.getElementById('mn-cal-open-btn');
    if(b) b.textContent = (today.getMonth()+1)+'월 전체달력 보기';
  }

  // 전체달력 시트 열기/닫기 (인라인 onclick에서 쓰므로 전역 노출)
  window.mnOpenCal = function(y, m, d){
    ensureAttUI();
    var ov = document.getElementById('mn-cal-sheet');
    if(!ov) return;
    try{
      if(y!==undefined && typeof curY!=='undefined'){ curY = y; curM = m; }
      if(typeof renderCalendar==='function') renderCalendar();
    }catch(e){}
    ov.classList.add('open');
    // 날짜 지정 시: 렌더된 해당 날짜 셀을 프로그래매틱 클릭 — 직군별 자체 핸들러
    // (openPopup / openEtcDayPopup 등)에 그대로 위임되어 모드가 달라도 동작
    if(y!==undefined){
      try{
        var cells = document.querySelectorAll('#calendar .cal-day:not(.empty)');
        for(var i=0;i<cells.length;i++){
          var dn = cells[i].querySelector('.dn');
          if(dn && parseInt(dn.textContent,10)===d){ cells[i].click(); break; }
        }
      }catch(e){}
    }
  };
  window.mnCloseCal = function(){
    var ov = document.getElementById('mn-cal-sheet');
    if(ov) ov.classList.remove('open');
    // 시트 안에서 기록하고 닫았을 때 주 스트립 색점이 즉시 반영되도록 갱신
    // (저장 경로는 renderCalendar 래핑으로도 갱신되지만, 저장 없이 닫는 경우와
    //  직군별 자체 저장 경로까지 확실히 덮기 위해 닫을 때 한 번 더)
    try{ renderAttWeekStrip(); }catch(e){}
  };

  // ══════════════════════════════════════════
  // 설정: 화면 밝기 (밝게/어둡게/휴대폰 설정) + 글자 크기 (보통/크게/아주 크게)
  //  - "라이트/다크/시스템" 용어는 쓰지 않는다 (README — 첫 사용자·시니어 배려)
  //  - 밝기는 data-theme 한 곳으로 적용. 구 배경색 팔레트(applyBg)보다 늦게
  //    적용되어 우선한다. '휴대폰 설정'은 prefers-color-scheme 연동
  // ══════════════════════════════════════════
  var BRIGHT_KEY = 'mn.brightness';
  var FONT_KEY   = 'mn.fontScale';
  var _sysMq = null;

  function _applyTheme(dark){
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    // 구 배경색 팔레트가 body에 칠한 인라인 배경 제거 — 토큰 --bg가 보이게
    try{ document.body.style.background = ''; }catch(e){}
  }

  window.mnSetBrightness = function(mode, silent){
    try{ localStorage.setItem(BRIGHT_KEY, mode); }catch(e){}
    if(mode === 'system'){
      try{ localStorage.removeItem('atm2_theme'); }catch(e){}
      try{
        if(!_sysMq && window.matchMedia){
          _sysMq = window.matchMedia('(prefers-color-scheme: dark)');
          var onSys = function(){
            var cur = null;
            try{ cur = localStorage.getItem(BRIGHT_KEY); }catch(e){}
            if(cur === 'system') _applyTheme(_sysMq.matches);
          };
          try{ _sysMq.addEventListener('change', onSys); }
          catch(e){ _sysMq.addListener(onSys); }
        }
        _applyTheme(_sysMq ? _sysMq.matches : false);
      }catch(e){ _applyTheme(false); }
    } else {
      try{ localStorage.setItem('atm2_theme', mode); }catch(e){}
      _applyTheme(mode === 'dark');
    }
    _syncBrightnessChips();
    if(!silent && typeof showToast === 'function'){
      showToast(mode==='system' ? '🌗 휴대폰 설정을 따라가요' : (mode==='dark' ? '🌙 어둡게 바꿨어요' : '☀️ 밝게 바꿨어요'));
    }
  };

  window.mnSetFontScale = function(v, silent){
    try{ localStorage.setItem(FONT_KEY, v); }catch(e){}
    // data-fs 속성으로 적용 — init.js가 인라인 --ui-scale을 지우므로 인라인만으로는 무력화된다
    document.documentElement.setAttribute('data-fs', v);
    document.documentElement.style.setProperty('--ui-scale', v);
    _syncBrightnessChips();
    if(!silent && typeof showToast === 'function') showToast('🔠 글자 크기를 바꿨어요');
  };

  function _syncBrightnessChips(){
    var bright = 'light', fs = '1.2';
    try{ bright = localStorage.getItem(BRIGHT_KEY) || bright; }catch(e){}
    try{ fs = localStorage.getItem(FONT_KEY) || fs; }catch(e){}
    // atm2_theme만 있는 기존 사용자: 그 값을 현재 상태로 표시
    try{ if(!localStorage.getItem(BRIGHT_KEY) && localStorage.getItem('atm2_theme')==='dark') bright='dark'; }catch(e){}
    document.querySelectorAll('#mn-bright-chips .mn-set-chip').forEach(function(b){
      b.classList.toggle('active', b.getAttribute('data-v')===bright);
    });
    document.querySelectorAll('#mn-font-chips .mn-set-chip').forEach(function(b){
      b.classList.toggle('active', b.getAttribute('data-v')===fs);
    });
  }

  function ensureDisplayCard(){
    var page = document.getElementById('settings-page');
    if(!page || document.getElementById('mn-display-card')) return;
    var card = document.createElement('div');
    card.id = 'mn-display-card';
    card.className = 'mn-card';
    card.innerHTML =
      '<div class="mn-h">🔆 화면 밝기 · 글자 크기</div>'
      +'<div class="mn-set-lbl">화면 밝기</div>'
      +'<div id="mn-bright-chips" class="mn-set-chips">'
      +'<button class="mn-set-chip" data-v="light" onclick="mnSetBrightness(\'light\')">밝게</button>'
      +'<button class="mn-set-chip" data-v="dark" onclick="mnSetBrightness(\'dark\')">어둡게</button>'
      +'<button class="mn-set-chip" data-v="system" onclick="mnSetBrightness(\'system\')">휴대폰 설정</button>'
      +'</div>'
      +'<div class="mn-set-help">\'휴대폰 설정\'을 고르면 휴대폰이 어두워질 때 앱도 같이 어두워져요</div>'
      +'<div class="mn-set-lbl" style="margin-top:12px;">글자 크기</div>'
      +'<div id="mn-font-chips" class="mn-set-chips">'
      +'<button class="mn-set-chip" data-v="1" onclick="mnSetFontScale(\'1\')">보통</button>'
      +'<button class="mn-set-chip" data-v="1.2" onclick="mnSetFontScale(\'1.2\')">크게</button>'
      +'<button class="mn-set-chip" data-v="1.35" onclick="mnSetFontScale(\'1.35\')">아주 크게</button>'
      +'</div>';
    page.insertBefore(card, page.firstChild);
    _syncBrightnessChips();
  }

  // ══════════════════════════════════════════
  // 선행 작업 — 홈에서 뺄 기능의 대체 경로 확보 (HOME v2 명세 §1: "제거가 아니라 이동")
  //  점검 결과(2026-07-26):
  //   · 출근/퇴근 → 근태 화면 + 새 히어로 CTA        … 경로 있음
  //   · 지출 입력 → 생존관리 변동지출 입력 폼         … 경로 있음
  //   · 급여 확인 → 수입 탭                          … 경로 있음
  //   · 내 자산  → **홈 카드에서만 도달 가능**        … 경로 없음 → 생존관리에 추가
  // ══════════════════════════════════════════
  function ensureBudgetAssetCard(){
    var page = document.getElementById('budget-page');
    if(!page || document.getElementById('mn-budget-asset')) return;
    if(typeof renderHomeAssetCard !== 'function') return;
    var box = document.createElement('div');
    box.id = 'mn-budget-asset';
    box.innerHTML = renderHomeAssetCard();
    page.appendChild(box);
  }

  function patchRenderBudget(){
    if(typeof window.renderBudgetPage !== 'function' || window.renderBudgetPage.__mnAsset) return;
    var orig = window.renderBudgetPage;
    window.renderBudgetPage = function(){
      orig.apply(this, arguments);
      try{ ensureBudgetAssetCard(); }catch(e){}
    };
    window.renderBudgetPage.__mnAsset = true;
  }

  function patchRenderSettings(){
    if(typeof window.renderSettingsPage !== 'function' || window.renderSettingsPage.__mnDisp) return;
    var orig = window.renderSettingsPage;
    window.renderSettingsPage = function(){
      orig.apply(this, arguments);
      try{ ensureDisplayCard(); }catch(e){}
    };
    window.renderSettingsPage.__mnDisp = true;
  }

  function restoreDisplayPrefs(){
    var b = null, fs = null;
    try{ b = localStorage.getItem(BRIGHT_KEY); }catch(e){}
    try{ fs = localStorage.getItem(FONT_KEY); }catch(e){}
    if(b) mnSetBrightness(b, true);      // applyBg(구 배경 팔레트)보다 늦게 → 우선 적용
    if(fs) mnSetFontScale(fs, true);
  }

  // ══════════════════════════════════════════
  // 챗봇 퀵리플라이 (README 오버레이 B)
  //  실제로 동작하는 것만 노출한다 — 동작 검증(2026-07-25):
  //   ○ "퇴근했어"          → handleVoiceText 경유로 실제 퇴근 기록(_wsEnd)
  //   ○ "이번 달 얼마 벌었어?" → 어시스턴트가 실수령/예상수입 응답
  //   ✕ "점심값 9천원 썼어"   → 자연어 지출 입력 파서가 없어 "이해하지 못한 질문" 응답.
  //                            파서 신설은 신규 기능(Feature Freeze)이므로 노출하지 않고,
  //                            검증된 "남은 연차 며칠이야?"로 대체
  // ══════════════════════════════════════════
  window.mnQuickReply = function(kind){
    if(kind === 'off'){
      try{
        var ai = document.getElementById('asst-input');
        if(ai) ai.value = '';
        if(typeof addUserMsg==='function') addUserMsg('퇴근했어');
      }catch(e){}
      handleVoiceText('퇴근했어');   // 실제 기록 → 실패 시 어시스턴트 안내로 폴백
      return;
    }
    if(typeof askQuick==='function') askQuick(kind);
  };

  function patchAsstQuick(){
    if(typeof window.renderAsstContext !== 'function' || window.renderAsstContext.__mnQr) return;
    var orig = window.renderAsstContext;
    window.renderAsstContext = function(){
      orig.apply(this, arguments);
      try{
        var q = document.getElementById('asst-quick');
        if(!q || q.querySelector('.mn-qr')) return;
        var chips =
          '<button class="asst-q mn-qr" onclick="mnQuickReply(\'off\')">퇴근했어</button>'
          +'<button class="asst-q mn-qr" onclick="mnQuickReply(\'이번 달 얼마 벌었어?\')">이번 달 얼마 벌었어?</button>'
          +'<button class="asst-q mn-qr" onclick="mnQuickReply(\'남은 연차 며칠이야?\')">남은 연차 며칠이야?</button>';
        q.insertAdjacentHTML('afterbegin', chips);
      }catch(e){}
    };
    window.renderAsstContext.__mnQr = true;
  }

  // ── 헤더 "오늘 +N원" 칩 ──
  // HOME_V2_SPEC §7: 이 칩은 **누적 실적**이다. 히어로의 "지금까지" 금액과 반드시 같은
  // 값이어야 하므로 같은 _todayEarn()만 쓴다 (하루 예상액을 넣지 않는다).
  // 0원일 때는 앰버가 아니라 중립색(#F1F5F9/#64748B)으로 — 실적이 없음을 색으로도 구분.
  function updateTodayChip(){
    var chip = document.getElementById('mn-today-chip');
    if(!chip) return;
    var e = _todayEarn();
    chip.textContent = e.sum>0 ? '오늘 +'+_fmtWon(e.sum)+'원' : '오늘 0원';
    chip.classList.toggle('live', !!e.live);
    chip.classList.toggle('zero', !(e.sum>0));
  }

  // ── 셸용 showPage 교체 (기존 호출부 전부 그대로 동작) ──
  function installShellShowPage(){
    window.showPage = function(p){ shellGo(p); };
    window.showPage.__mnShell = true;
  }

  // ── 해시 복원 (뒤로가기 / 새로고침) ──
  function bindHash(){
    window.addEventListener('hashchange', function(){
      var p = (location.hash||'').replace('#','');
      if(IDX[p]!==undefined && IDX[p]!==cur) shellGo(p, true);
    });
  }

  // ══════════════════════════════════════════
  // HOME v2 ④ — PC 셸 (HOME_V2_SPEC §6, 레퍼런스 6c)
  //  1) 좌측 네비 사이드바 236px + 상단 바
  //  2) 기존 상단 배너의 12개 버튼 제거 — 6탭은 사이드바로, 나머지 5개
  //     (직업설정·백업·복원·초기화·도움말)는 이미 설정 화면에 모두 존재해 경로 손실 없음
  //  ※ 기존 좌측 설정 패널(#sidebar)은 삭제하지 않고 "상세 설정" 항목으로 열리는
  //     드로어로 유지한다 (교대조 범례·수당 계산식 등 설정 화면에 없는 항목 보존)
  // ══════════════════════════════════════════
  var PC_ICONS = {
    home:'<path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1v-8Z"/>',
    info:'<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8v.4"/>',
    att: '<rect x="4" y="5.5" width="16" height="14.5" rx="2"/><path d="M4 10h16M8.5 3v4M15.5 3v4"/>',
    sal: '<circle cx="12" cy="12" r="8.5"/><path d="M14.5 9.3A3 3 0 0 0 9.5 11c0 2.5 5 1.5 5 4a3 3 0 0 1-5 1.6M12 7v10"/>',
    budget:'<path d="M12 3.5 19 6v6c0 4-3 7-7 8.5C8 19 5 16 5 12V6l7-2.5Z"/>',
    dash:'<path d="M4 19V9M9.3 19V5M14.7 19v-7M20 19v-4"/>',
    // 톱니 — 레퍼런스의 path는 햇살 모양이라 설정 아이콘으로 읽히지 않는다.
    // 모바일 헤더와 같은 톱니 SVG로 통일 (명세 §3: 톱니 SVG 19px)
    settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    sliders:'<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>'
  };
  function _pcIcon(k){
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
      + 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(PC_ICONS[k]||'')+'</svg>';
  }

  var PC_TITLES = { home:'홈', info:'정보', att:'근태', sal:'수입', budget:'생존', dash:'연간', settings:'설정' };

  function buildPcShell(){
    var app = document.getElementById('app');
    if(!app || document.getElementById('mn-pc-nav')) return false;

    // ── 좌측 네비 ──
    var nav = document.createElement('div');
    nav.id = 'mn-pc-nav';
    nav.innerHTML =
      // ★ 삼선(햄버거): 모바일 셸과 동일하게 캐릭터 왼쪽 — 상세 설정 드로어(#sidebar)를 연다.
      //   (기존 하단 "상세 설정" 텍스트 항목을 대체 — 소유자 결정 2026-07-28)
      '<div class="mn-pc-logo">'
      +'<button id="mn-pc-menu-btn" aria-label="설정 메뉴" onclick="toggleDrawer()">'
      +'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/></svg>'
      +'</button>'
      +_avatarImg(32)+'<span>머니냥</span></div>'
      +'<div class="mn-pc-menu">'
      + TABS.map(function(t){
          return '<button class="mn-pc-item" data-p="'+t.p+'" onclick="showPage(\''+t.p+'\')">'
            + _pcIcon(t.p) + '<span>'+t.label+'</span>'
            + (t.p==='info' ? '<i id="mn-info-dot-pc" class="mn-pc-dot"></i>' : '')
            + '</button>';
        }).join('')
      +'</div>'
      +'<div class="mn-pc-bottom">'
      +'<div class="mn-pc-income"><span>이번 달 예상 수입</span><b id="mn-pc-income-val">-</b></div>'
      +'<button class="mn-pc-item" data-p="settings" onclick="showPage(\'settings\')">'+_pcIcon('settings')+'<span>설정</span></button>'
      +'</div>';
    app.insertBefore(nav, app.firstChild);

    // ── 상단 바 ──
    var top = document.createElement('div');
    top.id = 'mn-pc-top';
    top.innerHTML =
      '<div class="mn-pc-title"><div id="mn-pc-title-t">홈</div><div id="mn-pc-title-s"></div></div>'
      +'<div class="mn-pc-actions">'
      +'<span id="mn-pc-chip">오늘 0원</span>'
      +'<button id="mn-pc-mic" aria-label="음성 입력">'
      +'<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>'
      +'</button>'
      +'<button id="mn-pc-asst">'+_avatarImg(28)+'<span>냥이 비서</span></button>'
      +'</div>';
    // ★ 본문 래퍼 — 명세 §2: body(flex row) = [사이드바] + [본문(flex column)].
    //   상단 바를 #app(flex row)에 그냥 끼우면 사이드바 옆에 세로 열이 하나 더 생겨
    //   "상단 바가 화면 중앙에 뜨고 콘텐츠가 3열처럼 보이는" 문제가 된다.
    //   상단 바와 #main을 한 컬럼 컨테이너 안에 넣어야 한다.
    var main = document.getElementById('main');
    if(main && main.parentNode){
      var bodyCol = document.createElement('div');
      bodyCol.id = 'mn-pc-body';
      main.parentNode.insertBefore(bodyCol, main);
      bodyCol.appendChild(top);
      bodyCol.appendChild(main);
    }

    // PWA 설치 버튼은 배너와 함께 숨겨지므로 상단 바로 옮겨 보존
    try{
      var pwa = document.getElementById('pwa-install-btn');
      if(pwa) top.querySelector('.mn-pc-actions').insertBefore(pwa, top.querySelector('#mn-pc-mic'));
    }catch(e){}

    document.getElementById('mn-pc-mic').addEventListener('click', function(){
      var vb = document.getElementById('mn-voice-bar');
      if(!vb) return;
      var open = vb.classList.toggle('open');
      this.classList.toggle('on', open);
      var i = document.getElementById('mn-voice-input');
      var m = document.getElementById('mn-voice-mic');
      if(open){ if(m && i) startVoice(m, i); }   // 열자마자 듣기 시작
      else { stopVoice(); }
    });
    document.getElementById('mn-pc-asst').addEventListener('click', function(){
      var vb = document.getElementById('mn-voice-bar');
      if(vb) vb.classList.remove('open');
      var mi = document.getElementById('mn-pc-mic'); if(mi) mi.classList.remove('on');
      try{ if(typeof toggleAsst==='function') toggleAsst(); }catch(e){}
    });

    document.body.classList.add('mn-pc');
    return true;
  }

  // ── 상단 바 화면별 컨텍스트 요소 (PC_SHELL_V2_SPEC §4) ──
  //  전부 **이미 있는 기능**으로만 연결한다. 대응 기능이 없는 버튼은 만들지 않는다
  //  (연간 "연말정산 자료"는 앱에 해당 기능이 없어 제외 — 백로그).
  function _pcCtxHtml(p){
    if(p === 'att'){
      var n = 0;
      try{ n = document.querySelectorAll('#calendar .cal-day.mn-pc-missed').length; }catch(e){}
      if(!n) return '';
      return '<button id="mn-pc-ctx" class="mn-pc-ctx-chip" onclick="mnPcGotoMissed()">미기록 '+n+'일</button>';
    }
    if(p === 'sal')
      return '<button id="mn-pc-ctx" class="mn-pc-ctx-btn" onclick="mnPcPayslipInput()">명세서 입력</button>';
    if(p === 'budget')
      return '<button id="mn-pc-ctx" class="mn-pc-ctx-btn mn-pc-ctx-btn--fill" onclick="mnPcExpenseInput()">지출 기록</button>';
    return '';
  }

  // 첫 미기록 날짜로 이동 (좌우 연동 재사용)
  window.mnPcGotoMissed = function(){
    var c = document.querySelector('#calendar .cal-day.mn-pc-missed');
    if(c) c.click();
  };
  // 급여명세서 비교 입력창으로 이동 (render-salary.js의 기존 입력 필드)
  window.mnPcPayslipInput = function(){
    var inp = document.querySelector('#salary-page input[id^="sal-actual-inp-"]');
    if(!inp){ if(typeof showToast==='function') showToast('명세서 비교는 급여 기록이 있을 때 열려요'); return; }
    inp.scrollIntoView({behavior:'smooth', block:'center'});
    setTimeout(function(){ try{ inp.focus(); }catch(e){} }, 300);
  };
  // 변동지출 입력 섹션으로 이동 (budget.js의 기존 입력 폼)
  window.mnPcExpenseInput = function(){
    var el = document.getElementById('var-expense-section')
          || document.querySelector('#budget-page button[onclick*="addBudgetVariableExpense"]');
    if(!el){ if(typeof showPage==='function') showPage('budget'); return; }
    el.scrollIntoView({behavior:'smooth', block:'center'});
    el.style.outline = '2px solid var(--mn-primary)';
    setTimeout(function(){ el.style.outline = ''; }, 1500);
  };

  function _pcSyncCtx(p){
    var actions = document.querySelector('#mn-pc-top .mn-pc-actions');
    if(!actions) return;
    var old = document.getElementById('mn-pc-ctx');
    if(old) old.remove();
    var html = _pcCtxHtml(p);
    if(html) actions.insertAdjacentHTML('afterbegin', html);
  }

  // 사이드바 하단 월 예상 수입 — 어느 화면에서도 보인다 (명세 §3).
  //  init 시점에는 근태 데이터 로드가 아직 안 끝났을 수 있어 값이 비는 경우가 있었다.
  //  렌더가 일어날 때마다 갱신하고, 초기에는 짧게 재시도한다.
  function _pcSyncIncome(){
    var inc = document.getElementById('mn-pc-income-val');
    if(!inc) return;
    var v = 0;
    try{
      var fin = HomeDashboardBuilder.financial();
      if(fin && (fin.hasRealData || fin.hasIncomeData)) v = fin.incTotal || 0;
    }catch(e){}
    inc.textContent = v > 0 ? _fmtWon(v)+'원' : '-';
  }

  function _pcCurrent(){
    var a = document.querySelector('#mn-pc-nav .mn-pc-item.active');
    return a ? a.getAttribute('data-p') : 'home';
  }

  function syncPcShell(p){
    document.querySelectorAll('#mn-pc-nav .mn-pc-item').forEach(function(b){
      b.classList.toggle('active', b.getAttribute('data-p') === p);
    });
    var t = document.getElementById('mn-pc-title-t');
    if(t) t.textContent = PC_TITLES[p] || '홈';
    var s = document.getElementById('mn-pc-title-s');
    if(s){
      var d = new Date(), wd = ['일','월','화','수','목','금','토'][d.getDay()];
      var nm = '';
      try{ if(typeof memName !== 'undefined' && memName) nm = ' · '+memName+'님'; }catch(e){}
      s.textContent = (d.getMonth()+1)+'월 '+d.getDate()+'일 '+wd+'요일'+nm;
    }
    // 오늘 칩 — 모바일 헤더 칩과 같은 _todayEarn() (명세 §7)
    var chip = document.getElementById('mn-pc-chip');
    if(chip){
      var e = _todayEarn();
      chip.textContent = e.sum>0 ? '오늘 +'+_fmtWon(e.sum)+'원' : '오늘 0원';
      chip.classList.toggle('zero', !(e.sum>0));
    }
    _pcSyncIncome();
    _pcSyncCtx(p);
    _syncInfoDot();
  }

  // ══════════════════════════════════════════
  // HOME v2 ④-3 — 화면별 2열 콘텐츠 (PC)
  //  좌: 그 화면의 주 작업 / 우: 참고 정보. 우측 열은 **미리 보여주는 용도**로만 쓰고,
  //  PC에만 있는 새 기능은 넣지 않는다 (명세 §6).
  // ══════════════════════════════════════════

  // 홈 — 좌 히어로 / 우 (남은 일 · 날씨 · 경고)
  function _pcLayoutHome(){
    var page = document.getElementById('home-page');
    if(!page || !document.getElementById('mn-pc-nav')) return;
    var content = page.querySelector('.mn-home');
    if(!content || content.classList.contains('mn-pc-2col')) return;

    var hero  = content.querySelector('.mn-hero');
    var todo  = content.querySelector('.mn-todo');
    var month = content.querySelector('.mn-month-bar');
    var date  = content.querySelector('.mn-home-date');
    if(!hero) return;

    var left  = document.createElement('div'); left.className  = 'mn-pc-col-l';
    var right = document.createElement('div'); right.className = 'mn-pc-col-r';

    if(date) date.remove();                 // 날짜는 상단 바가 이미 보여준다
    left.appendChild(hero);
    if(todo) right.appendChild(todo);

    // 날씨 카드 — 정보 화면과 같은 소스/마크업 (새 기능 아님)
    try{
      var w = WeatherBuilder.build(WeatherProvider.getCache());
      if(w){
        var wx = document.createElement('div');
        wx.className = 'mn-pc-wx';
        wx.innerHTML = _wxCardHtml(w);
        right.appendChild(wx);
      }
    }catch(e){}

    // 경고 카드 (조건부) — 생존 경고 1개만
    try{
      var fin = HomeDashboardBuilder.financial();
      if(fin && fin.isExceeded){
        var warn = document.createElement('div');
        warn.className = 'mn-warn-card';
        warn.textContent = '이번 달 지출이 수입을 넘었어요. 생존관리에서 남은 예산을 확인해보세요.';
        right.appendChild(warn);
      }
    }catch(e){}

    // 월 요약 바는 사이드바 하단에 상시 고정되어 있으므로 PC 본문에서는 중복 제거
    if(month) month.remove();

    content.innerHTML = '';
    content.className = 'home-content mn-home mn-pc-2col';
    content.appendChild(left);
    content.appendChild(right);
  }

  // 정보 — 좌 날씨(지금 필요한 것) / 우 브리핑·내 소식·경고 (참고 정보)
  //  명세 §5 표에는 정보 화면이 없지만, 같은 원칙(좌 결론 / 우 근거·목록)을 그대로 적용한다.
  //  기존 블록을 옮기기만 하고 새 블록은 만들지 않는다.
  function _pcLayoutInfo(){
    var page = document.getElementById('info-page');
    if(!page || !document.getElementById('mn-pc-nav')) return;
    var content = page.querySelector('.mn-info');
    if(!content || content.classList.contains('mn-pc-2col')) return;

    var date = content.querySelector('.mn-info-date');
    var wx   = content.querySelector('#info-wx-wrap');
    var rest = [].slice.call(content.children).filter(function(c){
      return c !== date && c !== wx;
    });
    if(!wx) return;

    var left  = document.createElement('div'); left.className  = 'mn-pc-col-l';
    var right = document.createElement('div'); right.className = 'mn-pc-col-r';
    if(date) date.remove();                    // 날짜는 상단 바가 이미 보여준다
    // 높이 균형: 브리핑(긴 목록)만 우측, 날씨+내 소식+경고는 좌측.
    // 날씨만 좌측에 두면 좌측이 짧아 아래가 크게 빈다.
    left.appendChild(wx);
    rest.forEach(function(c){
      (c.classList.contains('mn-brief') ? right : left).appendChild(c);
    });

    content.innerHTML = '';
    content.className = 'home-content mn-info mn-pc-2col mn-pc-info';
    content.appendChild(left);
    content.appendChild(right);
  }

  // 근태 — 좌 v3(주간 스트립·기록) / 우 전체 달력 상주
  //  모바일에서 팝업이던 월 달력을 PC에서는 항상 띄워 두고, 좌우가 같은 날짜를 가리키게 한다.
  function _pcLayoutAtt(){
    var page = document.getElementById('att-page');
    if(!page || !document.getElementById('mn-pc-nav')) return;
    var v3  = document.getElementById('att-v3');
    var cal = document.getElementById('cal-area');
    if(!cal) return;

    var wrap = document.getElementById('mn-pc-att');
    if(!wrap){
      wrap = document.createElement('div');
      wrap.id = 'mn-pc-att';
      wrap.innerHTML = '<div class="mn-pc-col-l" id="mn-pc-att-l"></div>'
                     + '<div class="mn-pc-col-r" id="mn-pc-att-r"></div>';
      page.insertBefore(wrap, page.firstChild);
    }
    var L = document.getElementById('mn-pc-att-l'), R = document.getElementById('mn-pc-att-r');
    if(v3 && v3.parentNode !== L) L.appendChild(v3);
    if(cal.parentNode !== R) R.appendChild(cal);

    // ★ 미니 달력 숨김 전 선행 조치 — 상태 색점 범례(mnAttLegendHtml)는 근태 화면에서
    //   v3 미니 달력에만 있다(#cal-area에는 없음). 우측 달력 위로 먼저 옮긴 뒤 숨긴다.
    if(!document.getElementById('mn-pc-att-legend') && typeof mnAttLegendHtml === 'function'){
      var lg = document.createElement('div');
      lg.id = 'mn-pc-att-legend';
      try{ lg.innerHTML = mnAttLegendHtml(); }catch(e){}
      if(lg.innerHTML) R.insertBefore(lg, R.firstChild);
    }

    // v3가 숨겨 둔 달력을 PC에서는 다시 보이게 하고, 레거시 달력을 그려 넣는다
    cal.style.display = 'block';
    _pcRenderCalendar();
    _pcMarkCalSelection();
    _pcMarkMissed();
  }

  // 미기록 날짜 표시 — 좌측 v3의 "기록?" 항목과 같은 날짜를 달력에서도 가리킨다.
  //  판정은 전부 기존 함수/설정값 조회: 지난 근무일인데 _attV3HasAny()가 false인 날.
  function _pcMarkMissed(){
    var cal = document.getElementById('calendar');
    if(!cal || typeof _attV3HasAny !== 'function') return;
    cal.querySelectorAll('.cal-day').forEach(function(c){ c.classList.remove('mn-pc-missed'); });
    var today = new Date(); today = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    var jobs = [];
    try{ jobs = (typeof loadSelectedJobs === 'function') ? loadSelectedJobs() : []; }catch(e){}
    var isWage = jobs.indexOf('employee') >= 0 || jobs.indexOf('salary') >= 0 || jobs.length === 0;
    if(!isWage) return;                       // 근무일 개념이 다른 직종은 표시하지 않는다

    cal.querySelectorAll('.cal-day:not(.empty)').forEach(function(c){
      var dn = c.querySelector('.dn');
      if(!dn) return;
      var day = parseInt(dn.textContent, 10);
      if(!day) return;
      var d = new Date(curY, curM, day);
      if(d >= today) return;                  // 오늘·미래는 미기록이 아니다
      var dow = d.getDay();
      var isWorkday = (dow !== 0 && dow !== 6);
      if(!isWorkday){
        try{
          var w = weekOfMonth(curY, curM, day);
          isWorkday = !!(satToggle && satToggle[weekKey(curY, curM, w, dow === 6 ? 'sat' : 'sun')]);
        }catch(e){}
      }
      if(!isWorkday) return;
      var has = false;
      try{ has = _attV3HasAny(d); }catch(e){ has = true; }
      if(!has) c.classList.add('mn-pc-missed');
    });
  }

  // v3 위임을 잠시 통과시켜 레거시 달력을 #calendar에 렌더 (attV3OpenMonthPopup과 같은 방식)
  function _pcRenderCalendar(){
    var prev = window._attV3PopupOpen;
    try{
      window._attV3PopupOpen = true;
      if(typeof renderCalendar === 'function') renderCalendar();
    }catch(e){}
    finally{
      window._attV3PopupOpen = prev;
      // ★ renderCalendar의 레거시 분기가 "v3 비활성"으로 보고 #att-v3를 숨긴다
      //   (원래 월 팝업에서는 v3가 가려져 있어 문제가 없던 동작).
      //   PC 2열에서는 좌측 v3와 우측 달력이 동시에 보여야 하므로 되돌린다.
      var v3 = document.getElementById('att-v3');
      if(v3) v3.style.display = 'block';
    }
  }

  // 좌우 연동 ①: 좌측에서 선택한 날짜를 우측 달력에서 강조
  function _pcMarkCalSelection(){
    var cal = document.getElementById('calendar');
    if(!cal) return;
    var sel = null;
    try{ sel = (typeof _attV3SelDate === 'function') ? _attV3SelDate() : null; }catch(e){}
    cal.querySelectorAll('.cal-day').forEach(function(c){ c.classList.remove('mn-pc-sel'); });
    if(!sel) return;
    if(typeof curY !== 'undefined' && (sel.getFullYear() !== curY || sel.getMonth() !== curM)) return;
    cal.querySelectorAll('.cal-day:not(.empty)').forEach(function(c){
      var dn = c.querySelector('.dn');
      if(dn && parseInt(dn.textContent, 10) === sel.getDate()) c.classList.add('mn-pc-sel');
    });
  }

  // 좌우 연동 ②: 우측 달력 셀 클릭 → 좌측 v3의 선택 날짜를 바꾼다
  //  (기록 팝업 대신 좌측 상세로 연결 — PC에서는 좌측이 이미 기록 UI다)
  function _pcBindCalClicks(){
    var cal = document.getElementById('calendar');
    if(!cal || cal.__mnPcBound) return;
    cal.addEventListener('click', function(ev){
      if(!document.getElementById('mn-pc-att')) return;
      var cell = ev.target.closest ? ev.target.closest('.cal-day') : null;
      if(!cell || cell.classList.contains('empty')) return;
      var dn = cell.querySelector('.dn');
      if(!dn) return;
      var day = parseInt(dn.textContent, 10);
      if(!day) return;
      ev.stopPropagation();
      ev.preventDefault();
      try{
        if(typeof _attV3Select === 'function'){
          _attV3Select(new Date(curY, curM, day));   // 좌측 갱신 (내부에서 renderAttV3 호출)
          _pcLayoutAtt();                            // v3 재렌더로 빠져나간 DOM 재배치
        }
      }catch(e){}
    }, true);
    cal.__mnPcBound = true;
  }

  // 수입·생존·연간 — 이미 있는 블록을 좌/우로 옮긴다 (PC_SHELL_V2_SPEC §5, 레퍼런스 8b~8d).
  //  새 블록을 만들지 않는다. head = 전체 폭 머리글, left/right = 2열, 나머지는 아래 1열.
  var PC_SPLIT = {
    // inner: 블록이 한 겹 안쪽 컨테이너에 들어 있는 화면 (생존 = .budget-container)
    'salary-page': { cls:'mn-pc-sal',  head:[0], left:[1],       right:[2] },
    'budget-page': { cls:'mn-pc-bdg',  head:[0], left:[1,2,3,4], right:'rest', inner:'.budget-container' },
    'dash-page':   { cls:'mn-pc-dash', head:[],  left:[0,1],     right:[-1] }  // -1 = 마지막(월별 12개월)
  };

  function _pcSplit(pageId){
    var cfg = PC_SPLIT[pageId];
    var page = document.getElementById(pageId);
    if(!cfg || !page) return;
    // 블록이 실제로 들어 있는 루트 (없으면 페이지 자신)
    var root = page;
    if(cfg.inner){
      var inner = page.querySelector(cfg.inner);
      if(inner && inner.children.length >= 3) root = inner;
    }
    if(root.querySelector(':scope > .mn-pc-split')) return;
    var kids = [].slice.call(root.children).filter(function(c){
      return c.id !== 'mn-pc-att' && !c.classList.contains('mn-pc-split');
    });
    // 페이지 직속에 따로 붙은 블록(예: 생존 화면의 자산 카드)도 분배 대상에 포함
    if(root !== page){
      [].slice.call(page.children).forEach(function(c){
        if(c !== root && !c.classList.contains('mn-pc-split')) kids.push(c);
      });
    }
    if(kids.length < 3) return;                       // 데이터가 없어 블록이 안 나온 상태

    function pick(spec){
      if(spec === 'rest') return null;
      return (spec||[]).map(function(i){ return i < 0 ? kids[kids.length + i] : kids[i]; })
                       .filter(Boolean);
    }
    var head  = pick(cfg.head) || [];
    var left  = pick(cfg.left) || [];
    var right = cfg.right === 'rest' ? null : (pick(cfg.right) || []);
    var used  = head.concat(left).concat(right || []);
    var rest  = kids.filter(function(c){ return used.indexOf(c) < 0; });
    if(right === null){ right = rest; rest = []; }

    var wrap = document.createElement('div');
    wrap.className = 'mn-pc-split ' + cfg.cls;
    var hd = document.createElement('div'); hd.className = 'mn-pc-head';
    var gr = document.createElement('div'); gr.className = 'mn-pc-grid';
    var L  = document.createElement('div'); L.className  = 'mn-pc-col-l';
    var R  = document.createElement('div'); R.className  = 'mn-pc-col-r';
    var bl = document.createElement('div'); bl.className = 'mn-pc-below';

    head.forEach(function(c){ hd.appendChild(c); });
    left.forEach(function(c){ L.appendChild(c); });
    right.forEach(function(c){ R.appendChild(c); });
    rest.forEach(function(c){ bl.appendChild(c); });

    gr.appendChild(L); gr.appendChild(R);
    if(hd.children.length) wrap.appendChild(hd);
    wrap.appendChild(gr);
    if(bl.children.length) wrap.appendChild(bl);
    root.appendChild(wrap);
  }

  function applyPcLayout(p){
    if(!document.getElementById('mn-pc-nav')) return;
    try{
      if(p === 'home') _pcLayoutHome();
      if(p === 'info') _pcLayoutInfo();
      if(p === 'att'){ _pcLayoutAtt(); _pcBindCalClicks(); }
      if(p === 'sal')    _pcSplit('salary-page');
      if(p === 'budget') _pcSplit('budget-page');
      if(p === 'dash')   _pcSplit('dash-page');
      // 근태 미기록 칩은 달력이 그려진 뒤라야 개수를 셀 수 있어 배치 후 한 번 더
      _pcSyncCtx(p);
      _pcSyncIncome();       // 렌더로 데이터가 채워진 뒤 사이드바 금액 갱신
    }catch(e){}
  }

  // ══════════════════════════════════════════
  // 데스크톱 (기존 유지 — v6 패치)
  // ══════════════════════════════════════════
  function patchDesktopNav(){
    var home = document.getElementById('btn-home');
    var att  = document.getElementById('btn-att');
    if(home) home.innerHTML = '<span class="tab-icon">📅</span> 오늘';
    if(att){
      att.innerHTML = '<span class="tab-icon">🗓️</span> 이번 달';
      if(!document.getElementById('btn-info')){
        var b = document.createElement('button');
        b.className = 'main-tab'; b.id = 'btn-info';
        b.innerHTML = '<span class="tab-icon">📋</span> 정보<span id="mn-info-dot-desk" style="display:none;width:6px;height:6px;border-radius:50%;background:var(--mn-danger-text,#DC2626);margin-left:4px;vertical-align:top;"></span>';
        b.onclick = function(){ showPage('info'); };
        att.parentNode.insertBefore(b, att);
      }
    }
  }

  function patchShowPageDesktop(){
    if(typeof window.showPage !== 'function' || window.showPage.__mnV6) return;
    var orig = window.showPage;
    window.showPage = function(p){
      if(p === 'info'){
        orig('home');
        var home = document.getElementById('home-page');
        if(home) home.style.display = 'none';
        var info = document.getElementById('info-page');
        if(info) info.style.display = 'block';
        renderInfoPage();
        document.querySelectorAll('.main-tab').forEach(function(b){ b.classList.remove('active'); });
        var db = document.getElementById('btn-info');
        if(db) db.classList.add('active');
        try{ syncPcShell('info'); }catch(e){}
        try{ applyPcLayout('info'); }catch(e){}
        return;
      }
      var info = document.getElementById('info-page');
      if(info) info.style.display = 'none';
      orig(p);
      if(p === 'home') stripHomeCards();
      _syncInfoDot();
      try{ syncPcShell(p); }catch(e){}
      try{ applyPcLayout(p); }catch(e){}
    };
    window.showPage.__mnV6 = true;
  }

  // PC 2열: 렌더 함수가 DOM을 다시 만들면 배치도 다시 적용해야 한다
  function patchPcRenders(){
    if(typeof window.renderAttV3 === 'function' && !window.renderAttV3.__mnPc){
      var origAtt = window.renderAttV3;
      window.renderAttV3 = function(){
        origAtt.apply(this, arguments);
        try{
          if(document.getElementById('mn-pc-nav')){ _pcLayoutAtt(); _pcBindCalClicks(); }
          else { _mvFullCalBtn(); }     // 모바일: 전체 달력 버튼을 주간 스트립 아래로
        }catch(e){}
      };
      window.renderAttV3.__mnPc = true;
    }
    if(typeof window.renderHomePage === 'function' && !window.renderHomePage.__mnPc){
      var origHome = window.renderHomePage;
      window.renderHomePage = function(){
        origHome.apply(this, arguments);
        try{ if(document.getElementById('mn-pc-nav')) _pcLayoutHome(); }catch(e){}
      };
      window.renderHomePage.__mnPc = true;
    }
    // 수입·생존·연간 — 렌더가 페이지를 다시 채우므로 그때마다 다시 나눈다
    [['renderIncomePage','salary-page'], ['renderBudgetPage','budget-page'], ['renderDash','dash-page']]
      .forEach(function(pair){
        var fn = pair[0], pageId = pair[1];
        if(typeof window[fn] !== 'function' || window[fn].__mnPcSplit) return;
        var orig = window[fn];
        window[fn] = function(){
          orig.apply(this, arguments);
          try{ if(document.getElementById('mn-pc-nav')) _pcSplit(pageId); }catch(e){}
        };
        window[fn].__mnPcSplit = true;
      });
  }

  function syncVoiceBarDesktop(){
    var loggedOut = false;
    try{
      var lp = document.getElementById('login-page');
      loggedOut = !!(lp && getComputedStyle(lp).display !== 'none');
    }catch(e){}
    document.body.classList.toggle('mn-home-visible', !loggedOut);
  }

  // ══════════════════════════════════════════
  // init
  // ══════════════════════════════════════════
  var shellBuilt = false;
  function _isMobileNow(){
    try{ return window.matchMedia('(max-width:768px)').matches; }
    catch(e){ return window.innerWidth <= 768; }
  }

  // 모바일 폭이면 셸 구축 (한 번만). 늦은 뷰포트 확정(웹뷰 초기화·회전)에도
  // 대응할 수 있게 init 이후 resize에서도 호출된다 — 리로드 없이 동적 업그레이드
  // PC 셸 크롬 제거 — 데스크톱에서 모바일 폭으로 좁혔을 때 두 셸이 겹치는 것을 막는다
  function _teardownPcShell(){
    var nav = document.getElementById('mn-pc-nav');
    var top = document.getElementById('mn-pc-top');
    var bodyCol = document.getElementById('mn-pc-body');
    if(!nav && !top && !bodyCol) return;
    // 상단 바에 옮겨 둔 PWA 설치 버튼은 잃지 않도록 되돌린다
    try{
      var pwa = document.getElementById('pwa-install-btn');
      var hdr = document.querySelector('.header-right');
      if(pwa && hdr) hdr.insertBefore(pwa, hdr.firstChild);
    }catch(e){}
    if(nav) nav.remove();
    if(top) top.remove();
    if(bodyCol){                       // #main을 #app 직속으로 되돌리고 래퍼 제거
      var app = document.getElementById('app');
      var main = document.getElementById('main');
      if(app && main) app.appendChild(main);
      bodyCol.remove();
    }
    document.body.classList.remove('mn-pc');
  }

  function ensureShell(){
    if(shellBuilt || !_isMobileNow()) return;
    _teardownPcShell();               // PC 셸이 남아 있으면 먼저 걷어낸다
    if(!buildShell()) return;
    shellBuilt = true;
    installShellShowPage();
    bindSwipe();
    bindHash();
    // 새로고침 복원: 유효한 해시가 있으면 그 화면으로
    var p0 = (location.hash||'').replace('#','');
    shellGo(IDX[p0]!==undefined ? p0 : 'home');
    setInterval(updateTodayChip, 30000);
  }

  function init(){
    MOB = _isMobileNow();
    ensureInfoPage();
    patchRenderHome();
    patchRenderSettings();
    patchRenderBudget();
    patchAsstQuick();
    restoreDisplayPrefs();
    ensureVoiceBar();
    stripHomeCards();

    // 달력이 다시 그려질 때(기록 저장 등) 주 스트립 색점도 동기화
    if(typeof window.renderCalendar==='function' && !window.renderCalendar.__mnStrip){
      var rc = window.renderCalendar;
      window.renderCalendar = function(){
        rc.apply(this, arguments);
        try{ renderAttWeekStrip(); }catch(e){}
        // PC 근태: 달력 셀이 새로 만들어질 때마다 선택·미기록 표시를 다시 붙인다
        // (어떤 경로로 재렌더되든 표시가 사라지지 않도록 여기 한 곳에서 보장)
        try{
          if(document.getElementById('mn-pc-att')){ _pcMarkCalSelection(); _pcMarkMissed(); }
        }catch(e){}
      };
      window.renderCalendar.__mnStrip = true;
    }

    if(MOB){
      ensureShell();
    } else {
      // 연간 월별 막대에 작년 같은 달을 겹쳐 보여준다 (PC 전용 — 명세 §5)
      window.__mnPcYearCompare = true;
      buildPcShell();          // HOME v2 ④: PC 네비 사이드바 + 상단 바
      patchDesktopNav();
      patchShowPageDesktop();
      patchPcRenders();        // ④-3: 2열 배치 재적용
      if(typeof window.showPage==='function' && !window.showPage.__mnV6vb){
        var sp = window.showPage;
        window.showPage = function(p){ sp(p); syncVoiceBarDesktop(); };
        window.showPage.__mnV6vb = true;
      }
      syncVoiceBarDesktop();
      try{ if(typeof renderHomePage==='function') renderHomePage(); }catch(e){}
      try{
        syncPcShell('home'); applyPcLayout('home');
        // 데이터 로드가 늦는 경우 대비 — 초기 몇 초간 재시도
        [500, 2000, 5000].forEach(function(ms){ setTimeout(_pcSyncIncome, ms); });
        setInterval(function(){ syncPcShell(_pcCurrent()); }, 30000);
      }catch(e){}
    }
    _syncInfoDot();

    // 브레이크포인트 교차 대응 (debounce 250ms)
    //  - 데스크톱→모바일: 셸 동적 구축 (리로드 불필요)
    //  - 셸 구축 후에는 가로 회전(>768px)에도 셸 유지 — 리로드로 기록 중 입력이
    //    날아가지 않도록 리로드하지 않는다 (소유자 결정 2026-07-25)
    var _rt = null;
    function _onViewportChange(){
      clearTimeout(_rt);
      _rt = setTimeout(function(){
        if(!shellBuilt && _isMobileNow()) ensureShell();
      }, 250);
    }
    window.addEventListener('resize', _onViewportChange);
    // resize가 안 오는 환경(일부 웹뷰) 대비 — matchMedia change 병행
    try{
      var mm = window.matchMedia('(max-width:768px)');
      try{ mm.addEventListener('change', _onViewportChange); }
      catch(e){ mm.addListener(_onViewportChange); }
    }catch(e){}
  }

  // QA/디버그 훅 (dev-mode에서 셸 상태 확인·수동 구축용)
  window.__mnShell = {
    get built(){ return shellBuilt; },
    isMobileNow: _isMobileNow,
    ensure: ensureShell
  };

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(init, 0); });
  } else {
    setTimeout(init, 0);
  }
})();
