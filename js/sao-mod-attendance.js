// ══════════════════════════════════════════
// sao-mod-attendance.js — SAO Router: Attendance Module
// "이번 주/이번 달 몇 시간 근무했어?", "이번 달 며칠 출근했어?" 등 근태 집계 질문
// 기존 기록(_attV3Rec)과 기존 산식(calcNetHours)을 읽기만 함 — 계산 로직 무변경
// ══════════════════════════════════════════
(function(){
  if(typeof SaoRouter==='undefined') return;

  function _netOf(d){
    try{
      if(typeof _attV3Rec!=='function' || typeof calcNetHours!=='function') return 0;
      var r = _attV3Rec(d);
      if(!r || !r.status || r.status==='none') return 0;
      if(r.start===undefined || r.start===null || r.end===undefined || r.end===null) return 0;
      return Math.max(0, calcNetHours(r.start, r.end, r.status, r.shift));
    }catch(e){ return 0; }
  }
  function _hasRec(d){
    try{
      if(typeof _attV3Rec!=='function') return false;
      var r = _attV3Rec(d);
      return !!(r && r.status && r.status!=='none' && r.status!=='leave' && r.status!=='absent');
    }catch(e){ return false; }
  }
  function _sum(from, to){
    var hours = 0, days = 0;
    var d = new Date(from);
    while(d <= to){
      var h = _netOf(d);
      if(h > 0){ hours += h; days++; }
      else if(_hasRec(d)) days++;
      d = new Date(d.getFullYear(), d.getMonth(), d.getDate()+1);
    }
    return { hours: Math.round(hours*10)/10, days: days };
  }
  function _nick(){ return (typeof memName!=='undefined' && memName) ? memName+'님, ' : ''; }

  SaoRouter.register({
    id: 'attendance',
    match: function(msg){
      if(!/(이번주|이번달|이달|오늘|지난주)/.test(msg)) return false;
      return /(몇시간|근무시간|일했|일한시간|며칠출근|출근일|근무일수|며칠일|평균근무)/.test(msg);
    },
    handle: function(userMsg, msg){
      var t = new Date(); t = new Date(t.getFullYear(), t.getMonth(), t.getDate());
      var from, to = t, label;
      if(/오늘/.test(msg)){
        var h = _netOf(t);
        if(h>0) return { reply: _nick()+'오늘은 지금까지 '+h.toFixed(1).replace(/\.0$/,'')+'시간 근무로 기록되어 있어요! 🐱' };
        return { reply: _nick()+'오늘은 아직 확정된 근무 기록이 없어요. 출근·퇴근을 기록하면 바로 계산해드릴게요! 🐱' };
      }
      if(/지난주/.test(msg)){
        var dow = (t.getDay()+6)%7;
        to = new Date(t.getFullYear(), t.getMonth(), t.getDate()-dow-1);
        from = new Date(to.getFullYear(), to.getMonth(), to.getDate()-6);
        label = '지난주';
      } else if(/이번주/.test(msg)){
        var dow2 = (t.getDay()+6)%7;
        from = new Date(t.getFullYear(), t.getMonth(), t.getDate()-dow2);
        label = '이번 주';
      } else {
        from = new Date(t.getFullYear(), t.getMonth(), 1);
        label = '이번 달';
      }
      var s = _sum(from, to);
      if(s.days===0) return { reply: _nick()+label+'에는 아직 근무 기록이 없어요.\n기록이 쌓이면 근무시간을 바로 알려드릴게요! 🐱' };
      // v2.7: "평균은?" 후속 질문(Memory 보정) — 평균만 콕 집어 답변
      if(/평균근무/.test(msg)){
        if(s.hours>0) return { reply: _nick()+label+' 하루 평균 '+(Math.round(s.hours/s.days*10)/10)+'시간 근무하셨어요! 🐱\n('+s.days+'일 동안 총 '+s.hours+'시간)' };
        return { reply: _nick()+label+'에는 시간이 기록된 근무가 없어서 평균을 낼 수 없어요 🐱' };
      }
      var r = _nick()+label+' 근무 요약이에요! 🐱\n• 근무일수: '+s.days+'일';
      if(s.hours>0) r += '\n• 총 근무시간: '+s.hours+'시간';
      if(s.hours>0 && s.days>0) r += '\n• 하루 평균: '+(Math.round(s.hours/s.days*10)/10)+'시간';
      return { reply: r };
    }
  });
})();
