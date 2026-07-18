// ══════════════════════════════════════════
// sao-router.js — SAO v2.6 AI Router
//
// 사용자 질문 → Intent 분석 → 처리 가능한 모듈이 즉시 답변,
// 어떤 모듈도 처리 못 하면 기존 챗봇(Claude 역할, assistant.js 규칙 엔진)으로 폴스루.
//
// 모듈 인터페이스: SaoRouter.register({
//   id: 'weather',
//   match: function(msg){ return true/false; },        // msg = 공백 제거 + 소문자
//   handle: function(userMsg, msg){
//     return { reply:'즉시 답변' }                       // 동기 답변
//     또는   { reply:'placeholder', async:Promise<string> }  // 비동기 (조회 후 추가 답변)
//     또는   null;                                       // 이번 질문은 패스 → 다음 모듈
//   }
// });
// 추후 News/Goal/Schedule 모듈도 위 형태로 등록만 하면 동작.
// ══════════════════════════════════════════
var SaoRouter = (function(){
  var modules = [];
  function register(m){ modules.push(m); }
  function _try(userMsg, msg){
    for(var i=0;i<modules.length;i++){
      try{
        if(modules[i].match(msg)){
          var r = modules[i].handle(userMsg, msg);
          if(r && r.reply){
            if(typeof SaoMemory!=='undefined'){ try{ SaoMemory.remember(modules[i].id, msg); }catch(e){} }
            return { handled:true, module:modules[i].id, reply:r.reply, async:r.async||null };
          }
        }
      }catch(e){}
    }
    return null;
  }
  function route(userMsg, msg){
    // 1차: 질문 그대로 라우팅 (완전한 질문은 Memory 보정 없이 평소처럼 처리)
    var direct = _try(userMsg, msg);
    if(direct) return direct;
    // 2차: v2.7 Memory Engine — 직접 해석 불가일 때만, 생략형 후속 질문
    //      ("내일은?", "지난달은?", "평균은?")을 직전 대화 기준으로 보정해 재시도
    if(typeof SaoMemory!=='undefined'){
      try{
        var rewritten = SaoMemory.rewrite(msg);
        if(rewritten){
          var again = _try(userMsg, rewritten);
          if(again) return again;
        }
      }catch(e){}
    }
    return { handled:false };
  }
  return { register:register, route:route, list:function(){ return modules.map(function(m){ return m.id; }); } };
})();
