// ══════════════════════════════════════════
// sao-engine.js — SAO v2.5 Persona Context Engine
//
// SAO가 "그날 가장 필요한 말"을 고르는 엔진.
// 우선순위: 1.근태(브리핑 본문이 담당) → 2.날씨 → 3.연속기록 → 4.급여일 → 5.기념일
// 출력 규칙: 브리핑 본문(근태) + 엔진이 고른 컨텍스트 1개 = 최대 2개.
//
// 확장 방법: SaoEngine.register({ id, priority, collect:function(d){ return {emoji,text} 또는 null } })
//   → 뉴스/목표 수입/소비 습관/AI 추천/공지/이벤트는 collect만 구현해 등록하면 끝.
//
// 랜덤 규칙: 날짜+상태 시드 — 같은 날 같은 상태에선 같은 문장, 날/상태가 바뀌면 새 문장.
// 원칙: 계산 로직·WeatherProvider·Work Session 무변경. 읽기만 한다.
// ══════════════════════════════════════════
var SaoEngine = (function(){
  var providers = [];

  // ── 시드 랜덤 (같은 날 같은 상태 = 같은 문장) ──
  function seed(key){
    var h = 0;
    for(var i=0;i<key.length;i++){ h = (h*31 + key.charCodeAt(i)) >>> 0; }
    return h;
  }
  function pick(key, arr){ return arr[seed(key)%arr.length]; }
  function dkey(d){ return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); }

  function register(p){
    providers.push(p);
    providers.sort(function(a,b){ return a.priority - b.priority; });
  }

  // ── 우선순위 순으로 수집해 가장 중요한 컨텍스트 1개 반환 ──
  function top(d){
    for(var i=0;i<providers.length;i++){
      try{
        var c = providers[i].collect(d);
        if(c && c.text) return c;
      }catch(e){}
    }
    return null;
  }

  // 근태 브리핑 뒤에 붙는 한 줄 (attendance-v3에서 호출)
  function extraLine(d){
    var c = top(d);
    return c ? '<br>'+(c.emoji?c.emoji+' ':'')+c.text : '';
  }

  return { register:register, top:top, extraLine:extraLine, pick:pick, seed:seed, dkey:dkey };
})();

// ── 최초 사용일 기록 (기념일 계산용 — 없을 때만 1회 기록, 기존 데이터 무변경) ──
(function(){
  try{
    if(!localStorage.getItem('atm2_first_seen')){
      localStorage.setItem('atm2_first_seen', String(Date.now()));
    }
  }catch(e){}
})();

// ══════════ 2순위: Weather Context (WeatherProvider 캐시 재사용) ══════════
SaoEngine.register({ id:'weather', priority:2, collect:function(d){
  if(typeof WeatherProvider==='undefined' || typeof WeatherBuilder==='undefined') return null;
  var w = WeatherBuilder.build(WeatherProvider.getCache());
  if(!w) return null;
  var jobs = [];
  try{ jobs = (typeof loadSelectedJobs==='function') ? loadSelectedJobs() : []; }catch(e){}
  var isDelivery = jobs.some(function(j){ return j==='delivery'||j==='driver'; });
  var k = SaoEngine.dkey(d)+'wx';
  if(w.isRainingNow){
    if(isDelivery) return { emoji:'🌧️', text: SaoEngine.pick(k,[
      '지금 비가 내리고 있어요. 우천 할증 여부를 확인해보세요!',
      '비가 오는 중이에요. 오늘은 안전운행이 최우선이에요!'
    ])};
    return { emoji:'🌧️', text: SaoEngine.pick(k,[
      '지금 비가 내리고 있어요. 퇴근길 우산 챙기세요!',
      '창밖에 비가 와요. 우산 꼭 챙기세요!'
    ])};
  }
  if(w.isSnowingNow) return { emoji:'❄️', text:'눈이 내리고 있어요. 길 미끄럼 조심하세요!' };
  if(w.isRainy){
    if(isDelivery) return { emoji:'🛵', text:'오후부터 비가 예상돼요. 우천 할증 여부를 확인해보세요.' };
    return { emoji:'☔', text: SaoEngine.pick(k,[
      '오늘 비 소식이 있어요. 우산 챙겨두면 안심이에요.',
      '퇴근 시간에 비가 예상돼요. 우산을 챙기시면 좋겠어요.'
    ])};
  }
  if(w.isHot)  return { emoji:'🥵', text:'오늘 '+w.temp+'도까지 올라요. 물 자주 챙겨 마셔요!' };
  if(w.isCold) return { emoji:'🧣', text:'오늘 많이 추워요. 따뜻하게 입고 나가세요!' };
  if(w.isBadPm) return { emoji:'😷', text:'오늘 미세먼지가 나빠요. 마스크 챙기세요!' };
  return null;
}});

// ══════════ 3순위: Streak Context (연속 기록) ══════════
SaoEngine.register({ id:'streak', priority:3, collect:function(d){
  if(typeof _attV3HasAny!=='function' || typeof _attV3Today!=='function') return null;
  var t = _attV3Today(), n = 0;
  for(var i=0;i<60;i++){
    var dd = new Date(t.getFullYear(), t.getMonth(), t.getDate()-i);
    if(_attV3HasAny(dd)) n++;
    else if(i===0) continue;   // 오늘 미기록은 끊김으로 안 봄
    else break;
  }
  if(n>=30) return { emoji:'🏆', text:n+'일 연속 기록 달성! 머니냥이 응원합니다.' };
  if(n>=7)  return { emoji:'🔥', text:n+'일 연속 기록 중입니다. 정말 꾸준하시네요!' };
  if(n>=3)  return { emoji:'🎉', text:'벌써 '+n+'일 연속 기록 중이에요. 꾸준함이 멋져요!' };
  return null;
}});

// ══════════ 4순위: Salary Context (급여일 D-day) ══════════
SaoEngine.register({ id:'salary', priority:4, collect:function(d){
  if(typeof _attV3Dday!=='function') return null;
  var dday = _attV3Dday();
  if(dday===null || dday<0 || dday>7) return null;
  if(dday===0) return { emoji:'💰', text:'오늘은 월급날이에요! 한 달 동안 정말 수고 많으셨어요.' };
  return { emoji:'💰', text:'월급날까지 '+dday+'일 남았습니다. 조금만 더 힘내요!' };
}});

// ══════════ 5순위: Milestone Context (기념일) ══════════
SaoEngine.register({ id:'milestone', priority:5, collect:function(d){
  try{
    var first = parseInt(localStorage.getItem('atm2_first_seen'));
    if(!first) return null;
    var days = Math.floor((_attV3Today().getTime() - new Date(new Date(first).getFullYear(), new Date(first).getMonth(), new Date(first).getDate()).getTime()) / 86400000) + 1;
    if(days===100) return { emoji:'🎉', text:'머니냥과 함께한 지 100일이 되었습니다. 감사합니다!' };
    if(days===200) return { emoji:'🎊', text:'머니냥과 200일째! 늘 함께해주셔서 고마워요.' };
    if(days===365) return { emoji:'🎂', text:'머니냥과 1년! 지난 1년, 정말 수고 많으셨어요.' };
  }catch(e){}
  return null;
}});

// ══════════ 추후 확장 자리 (collect만 구현해 등록하면 동작) ══════════
// SaoEngine.register({ id:'news',  priority:6, collect:function(d){ return null; } });  // 뉴스
// SaoEngine.register({ id:'goal',  priority:7, collect:function(d){ return null; } });  // 목표 수입
// SaoEngine.register({ id:'habit', priority:8, collect:function(d){ return null; } });  // 소비 습관
// SaoEngine.register({ id:'ai',    priority:9, collect:function(d){ return null; } });  // AI 추천
// SaoEngine.register({ id:'notice',priority:10,collect:function(d){ return null; } });  // 공지사항
// SaoEngine.register({ id:'event', priority:11,collect:function(d){ return null; } });  // 이벤트
