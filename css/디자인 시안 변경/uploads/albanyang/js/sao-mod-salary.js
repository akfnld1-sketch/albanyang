// ══════════════════════════════════════════
// sao-mod-salary.js — SAO Router: Salary Module
// "이번 달 얼마나 벌었어?" 등 수입 집계 질문 — 기존 Income Gateway(getIncomeSummary) 재사용
// v3.2: 사업장별 내역 + 사업장 지정 질의("생산직만 얼마야?") — CompanyEngine 반복 호출
// ══════════════════════════════════════════
(function(){
  if(typeof SaoRouter==='undefined') return;

  function _fmt(n){ return Math.round(n).toLocaleString('ko-KR')+'원'; }
  function _nick(){ return (typeof memName!=='undefined' && memName) ? memName+'님, ' : ''; }
  function _strip(s){ return String(s||'').replace(/\s/g,'').toLowerCase(); }

  // 질문 속에 사업장명이 있으면 해당 사업장 반환
  function _companyInMsg(msg){
    try{
      if(typeof CompanyEngine==='undefined') return null;
      var cs = CompanyEngine.companies();
      for(var i=0;i<cs.length;i++){
        var n = _strip(cs[i].name);
        if(n && n.length>=2 && msg.indexOf(n)>=0) return cs[i];
      }
    }catch(e){}
    return null;
  }

  SaoRouter.register({
    id: 'salary',
    match: function(msg){
      var money = /(얼마나벌|얼마벌|번돈|수입얼마|수입은|벌었|얼마야|얼마에요|급여얼마)/.test(msg);
      if(!money) return false;
      if(/(이번달|이달|지난달|저번달|이번주|지금까지)/.test(msg)) return true;
      return !!_companyInMsg(msg); // "생산직만 얼마야?" — 기간 없이 사업장명만 있어도 처리
    },
    handle: function(userMsg, msg){
      if(typeof getIncomeSummary!=='function') return null; // 폴스루 → 기존 챗봇
      var t = new Date();
      var co = _companyInMsg(msg);
      var multi = (typeof CompanyEngine!=='undefined' && CompanyEngine.isMulti());

      // ── 사업장 지정 질의: "생산직만 얼마야?" ──
      if(co && multi){
        try{
          // v3.3.1: 기록 없는 사업장은 예상치 대신 안내 (기록 게이트)
          if(!CompanyEngine.hasRecords(co.wpId, co.empId)) return { reply: _nick()+co.name+'은(는) 아직 이번 달 근무 기록이 없어요.\n출근을 기록하면 바로 계산해드릴게요! 🐱' };
          var pd = CompanyEngine.getPayDataFor(co.wpId, co.empId);
          if(!pd || !pd.finalPay) return { reply: _nick()+co.name+'은(는) 아직 이번 달 근무 기록이 없어요.\n출근을 기록하면 바로 계산해드릴게요! 🐱' };
          return { reply: _nick()+co.name+' 이번 달 예상급여예요! 🐱\n• 세전: '+_fmt(pd.grossPay||0)+'\n• 실수령 예상: '+_fmt(pd.finalPay)+'\n\n다른 사업장까지 합친 금액은 "이번달 얼마 벌었어?"로 물어보세요!' };
        }catch(e){}
      }

      // ── 이번 주: 사업장별 일수입 합산 (근태 카드와 동일 기준) ──
      if(/이번주/.test(msg)){
        try{
          var t0 = new Date(t.getFullYear(), t.getMonth(), t.getDate());
          var dow = (t0.getDay()+6)%7;
          var lines = [], weekTotal = 0;
          var cs = multi ? CompanyEngine.companies() : (typeof CompanyEngine!=='undefined' ? CompanyEngine.companies() : []);
          cs.forEach(function(c){
            var coSum = 0;
            for(var i=0;i<=dow;i++){
              var d = new Date(t0.getFullYear(), t0.getMonth(), t0.getDate()-i);
              var rec = CompanyEngine.recOf(c.wpId, c.empId, d);
              if(rec && rec.start!==undefined && rec.start!==null && rec.end!==undefined && rec.end!==null){
                // v3.4: 공통 함수 단일 경로 (전 화면과 동일 계산)
                coSum += CompanyEngine.runFor(c.wpId, c.empId, function(){
                  var e = (typeof calcDayEarningsShared==='function') ? calcDayEarningsShared(rec, d, { wsKey:'atm2_workSession_'+c.wpId }) : null;
                  return e ? e.total : 0;
                }) || 0;
              }
            }
            if(coSum>0){ lines.push('• '+c.name+': '+_fmt(coSum)); weekTotal += coSum; }
          });
          if(weekTotal===0) return { reply: _nick()+'이번 주에는 아직 확정된 근무 수입이 없어요.\n퇴근까지 기록되면 집계해드릴게요! 🐱' };
          var wr = _nick()+'이번 주 번 돈이에요! 🐱\n'+lines.join('\n');
          if(lines.length>1) wr += '\n• 합계: '+_fmt(weekTotal);
          return { reply: wr };
        }catch(e){}
      }

      // ── 이번 달 / 지난달 총수입 ──
      var isPrev = /(지난달|저번달)/.test(msg);
      var y = t.getFullYear(), m = t.getMonth();
      if(isPrev){ m -= 1; if(m < 0){ m = 11; y -= 1; } }
      var label = isPrev ? '지난달' : '이번 달';
      var s = getIncomeSummary(y, m);
      if(!s || !s.total) return { reply: _nick()+label+'은 아직 집계된 수입이 없어요.\n근태나 수입을 기록하면 바로 계산해드릴게요! 🐱' };
      var r = _nick()+label+(isPrev?' 번 돈이에요! 🐱':' 지금까지 번 돈이에요! 🐱');
      // v3.2: 사업장 2개 이상이면 사업장별 내역 먼저
      try{
        if(multi && !isPrev){
          CompanyEngine.getPayDataAll().breakdown.forEach(function(b){
            r += '\n• '+b.name+': '+_fmt(b.finalPay);
          });
        } else if(multi && isPrev && typeof getPayDataForMonth==='function'){
          CompanyEngine.companies().forEach(function(c){
            var p = CompanyEngine.runFor(c.wpId, c.empId, function(){ return getPayDataForMonth(y, m); });
            if(p && p.finalPay) r += '\n• '+c.name+': '+_fmt(p.finalPay);
          });
        }
      }catch(e){}
      try{
        if(s.breakdown && s.breakdown.length>1){
          s.breakdown.forEach(function(b){ if(b.amount>0 && b.label.indexOf('시급제')<0) r += '\n• '+b.label+': '+_fmt(b.amount); });
        }
      }catch(e){}
      r += '\n• 총 예상수입: '+_fmt(s.total);
      r += '\n\n자세한 내역은 수입관리 탭에서 볼 수 있어요!';
      return { reply: r };
    }
  });
})();
