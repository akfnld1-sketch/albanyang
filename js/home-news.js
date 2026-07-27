// ══════════════════════════════════════════
// v4.2.2-beta.9: 홈 뉴스 카드 (home-news.js)
// 구글 뉴스 경제 RSS → rss2json 변환 → 헤드라인 4개 링크 카드.
// 30분 localStorage 캐시('mn.newsCache'), 실패/오프라인 시 조용히 안내.
// 홈 "둘러보기" 카드를 대체 — weather.js renderHomePage에서 호출.
// ══════════════════════════════════════════
(function(){
  var KEY = 'mn.newsCache';
  var TTL = 30*60*1000;
  // ── 뉴스 소스 (v4.2.2-beta.46) ──
  // 구글이 1순위. 한 곳이 막히면 다음 조합으로 넘어간다.
  // 브라우저에서 RSS를 직접 부르면 CORS로 막히므로 무료 프록시/변환 서비스를 거친다.
  var FEEDS = [
    'https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=ko&gl=KR&ceid=KR:ko', // 구글 뉴스 경제
    'https://www.yna.co.kr/rss/economy.xml',        // 연합뉴스 경제
    'https://rss.hankyung.com/feed/economy.xml',    // 한국경제
    'https://www.mk.co.kr/rss/30100041/'            // 매일경제
  ];
  var PROXIES = [
    { n:'rss2json',   u:function(f){ return 'https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(f); }, t:'json' },
    { n:'allorigins', u:function(f){ return 'https://api.allorigins.win/raw?url=' + encodeURIComponent(f); },           t:'xml'  },
    { n:'codetabs',   u:function(f){ return 'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(f); },      t:'xml'  }
  ];
  var MAX_TRY = 8;      // 과도한 재시도 방지
  var TIMEOUT = 7000;   // 응답 없는 소스에서 오래 붙들리지 않도록

  function _get(url){
    var ctl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var timer = ctl ? setTimeout(function(){ ctl.abort(); }, TIMEOUT) : null;
    var opt = ctl ? { signal: ctl.signal } : {};
    return fetch(url, opt).then(function(r){
      if(timer) clearTimeout(timer);
      if(!r.ok) throw new Error('http ' + r.status);
      return r.text();
    }, function(e){ if(timer) clearTimeout(timer); throw e; });
  }

  // rss2json 응답(JSON) → 기사 배열
  function _fromJson(text){
    var j = JSON.parse(text);
    if(!j || j.status !== 'ok' || !j.items || !j.items.length) throw new Error(j && j.message || 'no items');
    return j.items.map(function(it){ return { title:it.title, link:it.link, pubDate:it.pubDate }; });
  }
  // RSS 원문(XML) → 기사 배열
  function _fromXml(text){
    var doc = new DOMParser().parseFromString(text, 'text/xml');
    var nodes = doc.querySelectorAll('item');
    if(!nodes.length) throw new Error('no items');
    var out = [];
    for(var i = 0; i < nodes.length && i < 10; i++){
      var q = function(sel){ var e = nodes[i].querySelector(sel); return e ? e.textContent : ''; };
      var t = q('title'), l = q('link');
      if(t && l) out.push({ title:t, link:l, pubDate:q('pubDate') });
    }
    if(!out.length) throw new Error('empty');
    return out;
  }

  function _cache(){
    try{
      var raw = localStorage.getItem(KEY);
      if(!raw) return null;
      var o = JSON.parse(raw);
      if(!o || !o.t || (Date.now()-o.t) > TTL) return null;
      return o.items || null;
    }catch(e){ return null; }
  }

  function _ago(iso){
    try{
      var m = Math.round((Date.now() - new Date(iso.replace(' ','T')).getTime())/60000);
      if(m < 60) return m + '분 전';
      if(m < 1440) return Math.round(m/60) + '시간 전';
      return Math.round(m/1440) + '일 전';
    }catch(e){ return ''; }
  }

  function _rows(items){
    var H = '';
    items.slice(0,4).forEach(function(it){
      var title = (it.title||'').replace(/</g,'&lt;');
      H += '<a href="'+it.link+'" target="_blank" rel="noopener" style="display:block;padding:8px 0;border-bottom:1px solid var(--border);text-decoration:none;">'
        + '<div style="font-size:13px;font-weight:700;color:var(--text);line-height:1.45;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">'+title+'</div>'
        + '<div style="font-size:11px;color:var(--text3);margin-top:2px;">'+_ago(it.pubDate)+' · 새 창에서 열림 ↗</div>'
        + '</a>';
    });
    return H || '<div style="font-size:13px;color:var(--text3);padding:8px 0;">표시할 뉴스가 없어요.</div>';
  }

  function _fill(items){
    var el = document.getElementById('home-news-list');
    if(el) el.innerHTML = _rows(items);
  }

  // 시도 순서: 피드1×프록시1,2,3 → 피드2×… (구글이 막히면 다른 매체로 넘어간다)
  function _plan(){
    var list = [];
    for(var f = 0; f < FEEDS.length; f++)
      for(var p = 0; p < PROXIES.length; p++)
        list.push({ feed: FEEDS[f], proxy: PROXIES[p] });
    return list.slice(0, MAX_TRY);
  }

  function _fetch(){
    if(!window._isOnline && window._isOnline !== undefined){ _fail(); return; }
    var plan = _plan(), i = 0;

    function next(){
      if(i >= plan.length){ _fail(); return; }      // 전부 실패해야 안내를 띄운다
      var step = plan[i++];
      _get(step.proxy.u(step.feed)).then(function(text){
        var items = (step.proxy.t === 'json') ? _fromJson(text) : _fromXml(text);
        try{ localStorage.setItem(KEY, JSON.stringify({ t: Date.now(), items: items })); }catch(e){}
        _fill(items);
      }).catch(function(){ next(); });               // 이 조합이 막히면 다음으로
    }
    next();
  }

  function _fail(){
    var el = document.getElementById('home-news-list');
    if(el) el.innerHTML = '<div style="font-size:13px;color:var(--text3);padding:8px 0;">뉴스를 불러오지 못했어요. 잠시 후 다시 확인해주세요.</div>';
  }

  // weather.js renderHomePage에서 호출 — 카드 틀을 반환하고 내용은 비동기 채움
  window.renderHomeNewsCard = function(){
    var cached = _cache();
    if(!cached) setTimeout(_fetch, 50);
    return '<div class="home-card"><div class="home-lbl">📰 오늘의 경제 뉴스</div>'
      + '<div id="home-news-list">'
      + (cached ? _rows(cached) : '<div style="font-size:13px;color:var(--text3);padding:8px 0;">뉴스를 불러오는 중…</div>')
      + '</div></div>';
  };
})();
