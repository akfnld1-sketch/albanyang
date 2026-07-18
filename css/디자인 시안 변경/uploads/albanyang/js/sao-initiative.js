// ══════════════════════════════════════════
// sao-initiative.js — SAO v2.8 Initiative Engine (선제형 AI 비서)
//
// 사용자가 질문하지 않아도, 앱 실행 시 현재 상황을 분석해
// "가장 중요한 정보 1개만" 먼저 말한다. (여러 개 나열 금지, 2~3줄 이내)
//
// 구조: Provider 등록 → 우선순위 검사 → 첫 번째로 값을 반환한 Provider만 출력.
//   SaoInitiativeEngine.register({ id, priority, check:function(){ return {emoji,text} 또는 null } })
//   → 추후 News/Goal/Notice/Event/Habit도 check() 하나만 구현해 등록하면 자동 동작.
//
// 출력 위치: 홈 상단 + 근태관리 상단 — 동일 엔진의 bannerHtml() 사용.
// 사용자 표시명: "😺 오늘의 한마디" (코드명은 SaoInitiativeEngine 유지)
// 원칙: Context Engine/Router/Memory 무변경. 계산식 무변경(전부 읽기 전용).
// ══════════════════════════════════════════
var SaoInitiativeEngine = (function(){
  var providers = [];
  function register(p){
    providers.push(p);
    providers.sort(function(a,b){ return a.priority - b.priority; });
  }
  // 우선순위 순서대로 검사 — 첫 번째 조건만 반환 (1개만 출력 원칙)
  function first(){
    for(var i=0;i<providers.length;i++){
      try{
        var r = providers[i].check();
        if(r && r.text) return r;
      }catch(e){}
    }
    return null;
  }
  // 이모지 → 캐릭터 상태(mood) — 상황에 따라 표정이 바뀐다 (MnCharacter 단일 경로)
  function _avatar(emoji){
    var moodMap = {
      '😺':'welcome', '🌿':'welcome',
      '🌧️':'warn', '❄️':'warn', '☔':'warn',
      '💰':'money',
      '🔥':'celebrate', '🏆':'celebrate', '🎉':'celebrate', '🎊':'celebrate', '🎂':'celebrate'
    };
    var mood = moodMap[emoji] || 'welcome';
    if(typeof MnCharacter!=='undefined') return MnCharacter.img(mood, 'sm');
    return '<span style="font-size:20px;">'+(emoji||'😺')+'</span>';
  }

  // 홈/근태 공용 배너 HTML — 표시할 것이 없으면 빈 문자열
  function bannerHtml(){
    var r = first();
    if(!r) return '';
    return '<div class="sao-initiative" style="display:flex;gap:10px;align-items:flex-start;'
      + 'background:var(--surface,#1e2235);border:1px solid var(--border,rgba(255,255,255,.1));'
      + 'border-left:3px solid var(--accent,#4f7cff);border-radius:12px;padding:12px 14px;margin-bottom:12px;">'
      + _avatar(r.emoji)
      + '<div><div style="font-size:12px;font-weight:700;color:var(--accent,#4f7cff);margin-bottom:3px;">오늘의 한마디</div>'
      + '<div style="font-size:14px;line-height:1.55;color:var(--text,#eee);">'+r.text+'</div></div>'
      + '</div>';
  }
  // 이모지 → 캐릭터 상태 (홈 Hero 등 표정 연동용 공개 API)
  function moodOf(emoji){
    var m = { '😺':'welcome','🌿':'welcome','🌧️':'warn','❄️':'warn','☔':'warn',
              '💰':'money','🔥':'celebrate','🏆':'celebrate','🎉':'celebrate','🎊':'celebrate','🎂':'celebrate' };
    return m[emoji] || 'welcome';
  }
  return { register:register, first:first, bannerHtml:bannerHtml, moodOf:moodOf,
           list:function(){ return providers.map(function(p){ return p.id; }); } };
})();

// ══════════ 1순위: 퇴근하지 않은 상태 ══════════
SaoInitiativeEngine.register({ id:'unfinished', priority:1, check:function(){
  try{
    // Work Session 진행 중 (읽기만)
    var ws = (typeof _wsGet==='function') ? _wsGet() : null;
    var t = new Date();
    var todayKey = (typeof _attV3Key==='function' && typeof _attV3Today==='function') ? _attV3Key(_attV3Today()) : null;
    if(ws && ws.startTime && (!todayKey || ws.date===todayKey)){
      return { emoji:'😺', text:'아직 퇴근 기록이 없습니다.<br>퇴근하셨다면 퇴근하기를 눌러주세요.' };
    }
    // 오늘 기록에 출근만 있고 퇴근이 없는 경우
    if(typeof _attV3Rec==='function' && typeof _attV3Today==='function'){
      var rec = _attV3Rec(_attV3Today());
      if(rec && rec.status && rec.status!=='none' && rec.status!=='leave' && rec.status!=='absent'
         && rec.start!==undefined && rec.start!==null && (rec.end===undefined || rec.end===null)){
        return { emoji:'😺', text:'아직 퇴근 기록이 없습니다.<br>퇴근하셨다면 퇴근하기를 눌러주세요.' };
      }
    }
  }catch(e){}
  return null;
}});

// ══════════ 2순위: 오늘 근무 예정 ══════════
SaoInitiativeEngine.register({ id:'schedule', priority:2, check:function(){
  try{
    if(typeof _attV3Rec!=='function' || typeof _attV3Today!=='function') return null;
    var rec = _attV3Rec(_attV3Today());
    if(!rec || !rec.status || rec.status==='none') return null;
    if(rec.status==='leave') return { emoji:'🌿', text:'오늘은 연차입니다.<br>충분히 쉬면서 재충전하세요.' };
    if(rec.status==='absent') return null;
    var nowH = new Date().getHours() + new Date().getMinutes()/60;
    // 미리 기록된 근무가 아직 시작 전이면 "오늘 근무 예정"
    if(rec.start!==undefined && rec.start!==null && nowH < rec.start){
      return { emoji:'😺', text:'오늘 근무 일정이 있습니다.<br>좋은 하루 보내세요!' };
    }
  }catch(e){}
  return null;
}});

// ══════════ 3순위: 현재 비 / 퇴근 시간 비 예보 ══════════
SaoInitiativeEngine.register({ id:'weather', priority:3, check:function(){
  try{
    if(typeof WeatherProvider==='undefined' || typeof WeatherBuilder==='undefined') return null;
    var w = WeatherBuilder.build(WeatherProvider.getCache());
    if(!w) return null;
    if(w.isRainingNow) return { emoji:'🌧️', text:'지금 비가 내리고 있습니다.<br>외출하실 때 우산을 꼭 챙기세요.' };
    if(w.isSnowingNow) return { emoji:'❄️', text:'지금 눈이 내리고 있습니다.<br>길이 미끄러우니 조심하세요.' };
    if(w.isRainy)      return { emoji:'☔', text:'퇴근 시간에 비가 예상됩니다.<br>우산을 챙기시면 좋겠습니다.' };
  }catch(e){}
  return null;
}});

// ══════════ 4순위: 월급 D-7 ══════════
SaoInitiativeEngine.register({ id:'payday', priority:4, check:function(){
  try{
    if(typeof _attV3Dday!=='function') return null;
    var d = _attV3Dday();
    if(d===null || d<0 || d>7) return null;
    if(d===0) return { emoji:'💰', text:'오늘은 월급날입니다!<br>한 달 동안 정말 수고 많으셨어요.' };
    return { emoji:'💰', text:'월급날까지 '+d+'일 남았습니다.<br>조금만 더 힘내요!' };
  }catch(e){}
  return null;
}});

// ══════════ 5순위: 연속 기록 ══════════
SaoInitiativeEngine.register({ id:'streak', priority:5, check:function(){
  try{
    if(typeof _attV3HasAny!=='function' || typeof _attV3Today!=='function') return null;
    var t = _attV3Today(), n = 0;
    for(var i=0;i<60;i++){
      var dd = new Date(t.getFullYear(), t.getMonth(), t.getDate()-i);
      if(_attV3HasAny(dd)) n++;
      else if(i===0) continue;
      else break;
    }
    if(n>=30) return { emoji:'🏆', text:n+'일 연속 기록 달성!<br>머니냥이 진심으로 응원합니다.' };
    if(n>=7)  return { emoji:'🔥', text:'벌써 '+n+'일 연속 기록 중입니다.<br>정말 꾸준하시네요!' };
  }catch(e){}
  return null;
}});

// ══════════ 추후 확장 자리 — check() 하나만 구현해 등록하면 동작 ══════════
// SaoInitiativeEngine.register({ id:'goal',   priority:6, check:function(){ return null; } });  // 목표 수입
// SaoInitiativeEngine.register({ id:'news',   priority:7, check:function(){ return null; } });  // 뉴스
// SaoInitiativeEngine.register({ id:'notice', priority:8, check:function(){ return null; } });  // 공지사항
// SaoInitiativeEngine.register({ id:'event',  priority:9, check:function(){ return null; } });  // 이벤트
// SaoInitiativeEngine.register({ id:'habit',  priority:10,check:function(){ return null; } });  // 소비 습관
