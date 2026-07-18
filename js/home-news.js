// ══════════════════════════════════════════
// v4.2.2-beta.9: 홈 뉴스 카드 (home-news.js)
// 구글 뉴스 경제 RSS → rss2json 변환 → 헤드라인 4개 링크 카드.
// 30분 localStorage 캐시('mn.newsCache'), 실패/오프라인 시 조용히 안내.
// 홈 "둘러보기" 카드를 대체 — weather.js renderHomePage에서 호출.
// ══════════════════════════════════════════
(function(){
  var KEY = 'mn.newsCache';
  var TTL = 30*60*1000;
  var RSS = 'https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=ko&gl=KR&ceid=KR:ko';
  var API = 'https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(RSS);

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

  function _fetch(){
    if(!window._isOnline && window._isOnline !== undefined){ _fail(); return; }
    fetch(API).then(function(r){ return r.json(); }).then(function(j){
      if(j && j.status === 'ok' && j.items && j.items.length){
        var items = j.items.map(function(it){ return { title: it.title, link: it.link, pubDate: it.pubDate }; });
        try{ localStorage.setItem(KEY, JSON.stringify({ t: Date.now(), items: items })); }catch(e){}
        _fill(items);
      } else { _fail(); }
    }).catch(_fail);
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
