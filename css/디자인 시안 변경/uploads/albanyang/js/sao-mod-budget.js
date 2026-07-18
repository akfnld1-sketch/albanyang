// ══════════════════════════════════════════
// sao-mod-budget.js — SAO Router: Budget Module
// "이번 달 지출 얼마야?" 등 지출/예산 질문 — 기존 calcZeroBalanceDate() 재사용 (계산 무변경)
// ══════════════════════════════════════════
(function(){
  if(typeof SaoRouter==='undefined') return;

  function _fmt(n){ return Math.round(n).toLocaleString('ko-KR')+'원'; }
  function _nick(){ return (typeof memName!=='undefined' && memName) ? memName+'님, ' : ''; }

  SaoRouter.register({
    id: 'budget',
    match: function(msg){
      if(!/(이번달|이달|지금까지)/.test(msg)) return false;
      return /(지출얼마|얼마썼|얼마나썼|지출은|쓴돈|소비얼마)/.test(msg);
    },
    handle: function(userMsg, msg){
      if(typeof calcZeroBalanceDate!=='function') return null; // 폴스루 → 기존 챗봇
      var z = calcZeroBalanceDate();
      if(!z) return null;
      if(!z.varTotal && !z.fixedTotal) return { reply: _nick()+'이번 달은 아직 지출 기록이 없어요.\n생존관리에서 지출을 기록하면 분석해드릴게요! 🐱' };
      var r = _nick()+'이번 달 지출 현황이에요! 🐱'
        + '\n• 변동지출: '+_fmt(z.varTotal||0)
        + '\n• 고정지출: '+_fmt(z.fixedTotal||0)
        + '\n• 합계: '+_fmt((z.varTotal||0)+(z.fixedTotal||0));
      if(z.riskLabel && z.riskLevel!=='nodata') r += '\n• 상태: '+z.riskLabel+(z.spentPct?' (가용예산의 '+z.spentPct+'% 사용)':'');
      r += '\n\n자세한 내역은 생존관리 탭에서 볼 수 있어요!';
      return { reply: r };
    }
  });
})();
