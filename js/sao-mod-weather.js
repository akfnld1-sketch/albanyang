// ══════════════════════════════════════════
// sao-mod-weather.js — SAO Router: Weather Module
// v2.4.2의 AsstWeatherQuery(assistant.js)를 라우터 모듈로 래핑 — 로직 재사용, 무변경
// ══════════════════════════════════════════
(function(){
  if(typeof SaoRouter==='undefined') return;
  SaoRouter.register({
    id: 'weather',
    match: function(msg){
      return (typeof AsstWeatherQuery!=='undefined') && AsstWeatherQuery.match(msg);
    },
    handle: function(userMsg, msg){
      var wq = AsstWeatherQuery.parse(msg);
      return {
        reply: '🌦️ 잠깐만요, 하늘 좀 보고 올게요...',
        async: AsstWeatherQuery.answer(wq)
          .catch(function(){ return '지금은 날씨 정보를 가져올 수 없어요 😿\n위치 권한과 인터넷 연결을 확인한 뒤 다시 물어봐 주세요!'; })
      };
    }
  });
})();
