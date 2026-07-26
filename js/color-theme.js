/* ══════════════════════════════════════════════════════════════
   머니냥 컬러 테마 v1.0 (color-theme.js)
   테마 5종(파스텔/스카이/민트/라벤더/피치)을 사용자가 직접 선택.
   - 선택 UI: 사이드바 설정 "🐱 컬러 테마" (#color-theme-chips)
   - 저장: localStorage 'mn.colorTheme' (라이트/다크와 독립)
   - 적용: <link id="theme-css"> href 교체 (add-only 테마 CSS)
   - iframe 미리보기: ?themePreview=id 로 강제 적용 (저장 안 함)
   ══════════════════════════════════════════════════════════════ */
(function(){
  var THEMES = [
    { id:'pastel',   name:'파스텔',  file:'css/theme-pastel.css',   dot:'#fdf8f0', ring:'#e3d7c3' },
    { id:'sky',      name:'스카이',  file:'css/theme-sky.css',      dot:'#dfe8f6', ring:'#b8cdf0' },
    { id:'mint',     name:'민트',    file:'css/theme-mint.css',     dot:'#daeee2', ring:'#a9d8bd' },
    { id:'lavender', name:'라벤더',  file:'css/theme-lavender.css', dot:'#e6def3', ring:'#c6b5e8' },
    { id:'peach',    name:'피치',    file:'css/theme-peach.css',    dot:'#f2ded0', ring:'#e8bd9c' },
    // v6 리디자인 기본 테마 (시안 31·34·36 라이트 토큰)
    { id:'daybreak', name:'데이브레이크', file:'css/theme-daybreak.css', dot:'#f6f7fa', ring:'#e8960c' }
  ];
  var KEY = 'mn.colorTheme';
  var VER = '20260724b';
  var link = document.getElementById('theme-css');
  if (!link) return;

  function findTheme(id){
    for (var i = 0; i < THEMES.length; i++) if (THEMES[i].id === id) return THEMES[i];
    return THEMES[0];
  }

  function setHref(t){ link.href = t.file + '?v=' + VER; }

  // 배경 동기화: init.js applyBg()가 body에 인라인 배경을 칠해 테마 --bg를 가림 →
  // 라이트 모드에서는 인라인 배경을 걷어내 테마 배경이 전체에 적용되게 함 (다크 모드는 유지)
  function _syncBodyBg(){
    try{
      var dark = document.documentElement.getAttribute('data-theme') === 'dark';
      if(!dark && document.body) document.body.style.background = '';
    }catch(e){}
  }

  window.applyColorTheme = function(id, silent){
    var t = findTheme(id);
    setHref(t);
    _syncBodyBg();
    try { localStorage.setItem(KEY, t.id); } catch(e){}
    renderColorThemeChips();
    if (!silent && typeof showToast === 'function') showToast('🎨 ' + t.name + ' 테마로 변경됐어요!');
  };

  window.renderColorThemeChips = function(){
    var wrap = document.getElementById('color-theme-chips');
    if (!wrap) return;
    var cur = 'sky';
    try { cur = localStorage.getItem(KEY) || 'sky'; } catch(e){}
    wrap.innerHTML = '';
    THEMES.forEach(function(t){
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.title = t.name + ' 테마';
      var on = t.id === cur;
      btn.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px 2px 6px;border-radius:10px;cursor:pointer;transition:border-color .15s;background:' + (on ? 'var(--surface2)' : 'none') + ';border:2px solid ' + (on ? 'var(--accent)' : 'var(--border)') + ';';
      var dot = document.createElement('span');
      dot.style.cssText = 'width:22px;height:22px;border-radius:50%;background:' + t.dot + ';border:2px solid ' + t.ring + ';';
      var name = document.createElement('span');
      name.textContent = t.name;
      name.style.cssText = 'font-size:11px;font-weight:' + (on ? '700' : '400') + ';color:var(--text2);';
      btn.appendChild(dot);
      btn.appendChild(name);
      btn.onclick = function(){ applyColorTheme(t.id); };
      wrap.appendChild(btn);
    });
  };

  // iframe 미리보기 강제 적용 (저장 X)
  var forced = null;
  try { forced = new URLSearchParams(location.search).get('themePreview'); } catch(e){}
  if (forced) { setHref(findTheme(forced)); return; }

  // 저장된 테마 즉시 복원 (이 스크립트는 link 바로 아래에서 동기 실행 — FOUC 최소화)
  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch(e){}
  // 기본 테마 = 스카이 (사용자 확정 스크린샷 기준). 데이브레이크는 선택지로 유지
  setHref(findTheme(saved || 'sky'));

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', renderColorThemeChips);
  else renderColorThemeChips();

  // init.js(applyBg)가 로드 시 body 배경을 다시 칠하므로, 로드 후 한 번 더 동기화
  window.addEventListener('load', function(){ setTimeout(_syncBodyBg, 700); });
})();
