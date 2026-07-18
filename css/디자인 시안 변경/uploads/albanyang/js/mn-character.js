// ══════════════════════════════════════════
// mn-character.js — 머니냥 캐릭터 시스템 v1.0
//
// 로그인·홈·근태·챗봇·온보딩이 "같은 캐릭터 컴포넌트"를 쓰기 위한 단일 진입점.
// 크기/말풍선/상태 매핑을 여기서만 관리 — 한 번 수정하면 앱 전체에 반영된다.
//
// 사용법:
//   MnCharacter.html({ mood:'welcome', size:'hero', message:'안녕하세요!' })
//   MnCharacter.img('thinking', 'md')                  // 이미지 태그만
//   MnCharacter.swap(document.getElementById(id), 'celebrate')  // 상태 교체
//
// mood(상태) → 캐릭터 이미지:
//   welcome(환영·휴식) thinking(진행중·로딩) celebrate(축하·성과)
//   warn(주의·경고) error(오류·실패) unknown(미기록·안내) money(돈·수입)
// size: hero(로그인 히어로) | lg(온보딩) | md(브리핑) | sm(카드) | avatar(챗봇/라벨)
// ══════════════════════════════════════════
var MnCharacter = (function(){
  var MOODS = {
    welcome:   '환영인사.png',
    thinking:  '생각중.png',
    celebrate: '칭찬축하.png',
    warn:      '걱정경고.png',
    error:     '울음오류.png',
    unknown:   '모를때.png',
    money:     '수입돈.png'
  };
  function src(mood){ return 'img/emoji/' + (MOODS[mood] || MOODS.welcome); }

  // 이미지 태그 (크기/링/섀도는 design-system.css의 .mn-char--* 가 관리)
  function img(mood, size, extra){
    return '<img src="'+src(mood)+'" alt="머니냥" class="mn-char mn-char--'+(size||'md')+(extra&&extra.animate==='pop'?' mn-pop-in':'')+(extra&&extra.animate==='wave'?' mn-waving':'')+'"'
      + (extra&&extra.id ? ' id="'+extra.id+'"' : '') + '>';
  }

  // 캐릭터 + (선택) 말풍선 블록
  function html(opts){
    opts = opts || {};
    var h = '<div class="mn-char-wrap'+(opts.className?' '+opts.className:'')+'">'
      + img(opts.mood, opts.size, opts)
      + (opts.message ? '<div class="mn-char-bubble">'+opts.message+'</div>' : '')
      + '</div>';
    return h;
  }

  // 이미 렌더된 캐릭터의 상태 교체 (같은 AI가 표정만 바꾸는 연출)
  function swap(imgEl, mood, wave){
    if(!imgEl) return;
    imgEl.src = src(mood);
    imgEl.classList.toggle('mn-waving', !!wave);
  }

  return { html: html, img: img, src: src, swap: swap, MOODS: MOODS };
})();

// ══════════════════════════════════════════
// 근태 상태 색상 시스템 v1.0 — 색만 보고 상태를 인식 (전 화면 공용 단일 맵)
// CSS 토큰(design-system.css의 --mn-att-*)과 세트. 계산 로직 무관 — 표시 전용.
// ══════════════════════════════════════════
var MN_ATT_COLORS = {
  work:    'var(--mn-att-work)',     // 정상근무 = 초록
  leave:   'var(--mn-att-leave)',    // 연차 = 파랑
  half:    'var(--mn-att-half)',     // 반차 = 보라
  late:    'var(--mn-att-late)',     // 지각 = 주황
  early:   'var(--mn-att-early)',    // 조퇴 = 노랑
  absent:  'var(--mn-att-absent)',   // 결근 = 빨강
  holiday: 'var(--mn-att-holiday)',  // 휴일근무(토·일·공휴 포함) = 청록
  night:   'var(--mn-att-night)'     // 야간근무 = 남색
};
// v1.1: 상태 아이콘 (색맹·흑백 화면 대응 — 색+아이콘 이중 표기)
var MN_ATT_ICONS = {
  work:'✔️', leave:'🌴', half:'🌗', late:'⏰',
  early:'🏃', absent:'❌', holiday:'🌞', night:'🌙'
};
var MN_ATT_LABELS = {
  work:'근무', leave:'연차', half:'반차', late:'지각',
  early:'조퇴', absent:'결근', holiday:'휴일', night:'야간'
};

// 기록(rec) → 상태 키. 지각(주간고정 + 기준시각 이후 출근)과 야간은 파생 판정.
function mnAttStatusKey(rec){
  if(!rec || !rec.status || rec.status==='none') return null;
  var s = rec.status;
  if(s==='absent') return 'absent';
  if(s==='leave')  return 'leave';
  if(s==='half')   return 'half';
  if(s==='early')  return 'early';
  if(s==='holiday'||s==='public'||s==='sat_work'||s==='sun_work') return 'holiday';
  // work: 야간 > 지각 > 정상 순으로 판정
  try{
    if(rec.shift==='night' || rec.shift==='C' || (typeof wt!=='undefined' && wt==='night')) return 'night';
    if(typeof wt!=='undefined' && wt==='day' && typeof dayStart!=='undefined'
       && rec.start!==undefined && rec.start!==null && rec.start > dayStart) return 'late';
  }catch(e){}
  return 'work';
}
function mnAttColor(rec){
  var k = mnAttStatusKey(rec);
  return k ? MN_ATT_COLORS[k] : null;
}
function mnAttIcon(rec){
  var k = mnAttStatusKey(rec);
  return k ? MN_ATT_ICONS[k] : '';
}

// 상태 범례 한 줄 — 달력 상단 공용 (compact=모바일: 색점+아이콘 / full=PC: +텍스트)
function mnAttLegendHtml(){
  var keys = ['work','leave','half','late','early','absent','holiday','night'];
  var items = keys.map(function(k){
    return '<span style="display:inline-flex;align-items:center;gap:3px;white-space:nowrap;">'
      + '<span style="width:8px;height:8px;border-radius:50%;background:'+MN_ATT_COLORS[k]+';display:inline-block;"></span>'
      + '<span style="font-size:10px;">'+MN_ATT_ICONS[k]+'</span>'
      + '<span class="mn-legend-txt" style="font-size:10px;color:var(--text3);">'+MN_ATT_LABELS[k]+'</span>'
      + '</span>';
  }).join('');
  return '<div class="mn-att-legend" style="display:flex;flex-wrap:wrap;gap:6px 10px;padding:4px 2px 8px;">'+items+'</div>';
}
