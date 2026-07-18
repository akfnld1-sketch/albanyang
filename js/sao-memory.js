// ══════════════════════════════════════════
// sao-memory.js — SAO v2.7 Memory Engine
//
// 직전 대화의 의미(모듈·질문·기간)를 기억해서, "내일은?" "지난달은?" "평균은?"처럼
// 생략된 후속 질문을 앞 질문에 이어 완전한 Intent로 보정(rewrite)한다.
//
// 범위: 최근 5개 대화 / 최근 10분. 메모리에만 저장(앱 종료 시 초기화).
// 원칙: 계산식 무변경. Router가 rewrite → 기존 모듈이 평소처럼 처리.
// ══════════════════════════════════════════
var SaoMemory = (function(){
  var MAX = 5, TTL = 10*60*1000;
  var log = [];   // [{module, msg, ts}] — msg는 정규화(공백 제거·소문자)된 질문

  function _purge(){
    var now = Date.now();
    log = log.filter(function(e){ return now - e.ts < TTL; }).slice(-MAX);
  }
  function remember(moduleId, msg){
    log.push({ module:moduleId, msg:msg, ts:Date.now() });
    _purge();
  }
  function last(){ _purge(); return log.length ? log[log.length-1] : null; }
  function clear(){ log = []; }

  // 질문 속 기간/대상 단어
  function _period(msg){
    var m = msg.match(/(오늘|내일|모레|이번주|지난주|다음주|주말|이번달|이달|지난달|저번달)/);
    return m ? m[1] : null;
  }
  // v3.3: 질문 속 사업장명 탐지 ("그럼 생산직은?", "쿠팡은?")
  function _coName(msg){
    try{
      if(typeof wpList!=='function') return null;
      var list = wpList();
      for(var i=0;i<list.length;i++){
        var n = String(list[i].name||'').replace(/\s/g,'').toLowerCase();
        if(n.length>=2 && msg.indexOf(n)>=0) return list[i].name;
        // 부분 일치: 앞 2글자 이상 (예: "쿠팡은?" → "쿠팡물류")
        var frag = msg.replace(/그럼|그거|그건|[?!.~\s]/g,'').replace(/(은|는|이|가|도|요|만)$/,'');
        if(frag.length>=2 && n.indexOf(frag)===0) return list[i].name;
      }
    }catch(e){}
    return null;
  }

  // 생략형 후속 질문인가 — 짧고("내일은?"), 기간·지시어·사업장명만 있는 형태
  function _isFragment(msg){
    var core = msg.replace(/[?!.~\s]|은|는|이|가|도|요|엔|에는/g, '');
    if(core.length > 10) return false;
    if(/(오늘|내일|모레|주말|이번주|지난주|다음주|이번달|이달|지난달|저번달|평균|그럼|그거|그건|그날)/.test(msg)) return true;
    return !!_coName(msg);
  }

  // 직전 대화 기준으로 생략 질문을 완전한 질문으로 재작성. 해석 불가면 null(→ 평소 흐름)
  function rewrite(msg){
    var e = last();
    if(!e || !_isFragment(msg)) return null;
    var p = _period(msg);
    // v3.3: 사업장 문맥 — 직전이 수입 대화였다면 "그럼 생산직은?" → 해당 사업장 급여 질의
    if(e.module==='salary'){
      var co = _coName(msg);
      if(co) return co.replace(/\s/g,'').toLowerCase()+'만얼마야';
    }
    if(e.module==='weather'){
      if(p) return p+'날씨알려줘';
      return null;
    }
    if(e.module==='salary'){
      if(p==='지난달'||p==='저번달'||p==='이번달'||p==='이달'||p==='이번주') return p+'얼마나벌었어';
      return null;
    }
    if(e.module==='attendance'){
      if(/평균/.test(msg)){
        var lp = _period(e.msg)||'이번주';
        return lp+'평균근무시간';
      }
      if(p) return p+'몇시간근무했어';
      return null;
    }
    if(e.module==='budget'){
      if(p==='이번달'||p==='이달') return p+'지출얼마야';
      return null;
    }
    return null;
  }

  return { remember:remember, last:last, rewrite:rewrite, clear:clear };
})();
