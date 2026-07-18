// ════════════════════════════════════
// AI 어시스턴트
// ════════════════════════════════════
let asstOpen = false;
let bubbleTimer = null;

// ── 머니냥 먼저 말걸기: 데이터 기반 스마트 알림 ──
function getSmartAlert(){
  try {
    const d = getPayData();
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    const h = today.getHours();
    const dayOfWeek = today.getDay(); // 0=일, 6=토
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;

    // 오늘 날짜의 근태 기록 확인
    const stored = dayData || {};
    const todayRec = stored[todayStr];
    const checkedIn = todayRec && todayRec.in;
    const checkedOut = todayRec && todayRec.out;

    const alerts = [];

    // 1️⃣ 출근 시간대인데 오늘 기록 없음 (평일 오전 8~10시)
    if(isWeekday && h >= 8 && h <= 10 && !checkedIn){
      alerts.push({
        priority: 10,
        msg: `오늘 아직 출근 기록이 없어요! 🙀\n혹시 출근 기록을 빠뜨리셨나요?\n아래 🟢 출근 버튼으로 빠르게 등록해 드릴게요.`,
        action: 'checkin'
      });
    }

    // 2️⃣ 퇴근 시간대인데 오늘 퇴근 기록 없음 (평일 오후 5~8시, 출근 기록 있을 때)
    if(isWeekday && h >= 17 && h <= 20 && checkedIn && !checkedOut){
      alerts.push({
        priority: 9,
        msg: `퇴근 기록이 아직 없어요! 😿\n오늘 출근은 하셨는데 퇴근 시간이 기록되지 않았어요.\n아래 🔴 퇴근 버튼으로 기록해 두세요!`,
        action: 'checkout'
      });
    }

    // 3️⃣ 이번 주 OT 10시간 초과
    if(d.totOT >= 10){
      const weekOT = calcWeekOT(); // 이번 주 OT 계산
      if(weekOT >= 10){
        alerts.push({
          priority: 8,
          msg: `이번 주 OT가 ${weekOT.toFixed(1)}시간을 넘었어요! 😤\n과로는 건강의 적이에요. 오늘은 제때 퇴근하시는 건 어떨까요?\n(주간 OT 현황은 근태 탭에서 확인하실 수 있어요)`,
          action: null
        });
      }
    }

    // 4️⃣ 이번 달 예상 실수령액이 지난달보다 많이 줄었을 때 (10% 이상)
    // ★ Income Gateway: 직장인이 아니면 d.finalPay(직장인 전용 계산값)로 알림을 만들지 않음
    const _selJobs4 = (typeof loadSelectedJobs==='function') ? loadSelectedJobs() : [];
    const prevPayKey = `pay_prev_${curY}_${curM}`;
    const prevPay = parseInt(localStorage.getItem(prevPayKey) || '0');
    if(_selJobs4.indexOf('employee')>=0 && prevPay > 0 && d.finalPay > 0){
      const diff = d.finalPay - prevPay;
      const ratio = Math.abs(diff) / prevPay;
      if(diff < 0 && ratio >= 0.1){
        const pct = Math.round(ratio*100);
        alerts.push({
          priority: 7,
          msg: `이번 달 예상 실수령액이 지난달보다 약 ${pct}% 줄었어요! 😢\n(지난달: ${fmt(prevPay)} → 이번달: ${fmt(d.finalPay)})\n이유를 확인해볼까요? 아래에 질문해 주세요!`,
          action: null
        });
      }
    }

    // 5️⃣ 연차/월차 잔여 0일 경고
    const usedL = (getPayData().lDays || 0) + (getPayData().halfDays || 0) * 0.5;
    const totalL = leaveOverride !== null ? leaveOverride : (() => { const al = calcAnnualLeave(hireDate); return al ? al.totalLeave : 0; })();
    const remainL = Math.max(0, totalL - usedL);
    if(totalL > 0 && remainL === 0){
      alerts.push({
        priority: 6,
        msg: `발생한 연차를 모두 사용하셨어요! 📅\n추가 결근 시 급여에서 공제될 수 있어요. 미리 확인해 두세요!`,
        action: null
      });
    }

    // 6️⃣ 급여일 D-3 이내 (사용자 설정 급여일 기준)
    const payDay = parseInt(localStorage.getItem('payDay_setting') || '0');
    if(payDay > 0){
      const nextPay = new Date(today.getFullYear(), today.getMonth(), payDay);
      if(nextPay < today) nextPay.setMonth(nextPay.getMonth()+1);
      const daysLeft = Math.ceil((nextPay - today)/(1000*60*60*24));
      if(daysLeft >= 1 && daysLeft <= 3){
        // ★ Income Gateway: 직업유형에 맞는 총수입으로 표시(직장인 전용 d.finalPay 직접 사용 금지)
        const _summary6 = (typeof getIncomeSummary==='function') ? getIncomeSummary(curY, curM) : null;
        const _payAmt6 = _summary6 ? _summary6.total : d.finalPay;
        alerts.push({
          priority: 5,
          msg: `급여일까지 ${daysLeft}일 남았어요! 💰\n이번 달 예상 실수령액은 ${fmt(_payAmt6)}이에요.\n설레는 날이 다가오고 있어요~ 😄`,
          action: null
        });
      }
    }

    // 7️⃣ 기본 인사 (아무 알림도 없을 때 시간대별)
    if(alerts.length === 0){
      const greet = h<12 ? '좋은 아침이에요! ☀️' : h<18 ? '안녕하세요! 😊' : '오늘도 수고 많으셨어요! 🌙';
      return {
        msg: `${greet} 머니냥이에요 🐱\n궁금한 것이 있으면 언제든 물어봐 주세요!`,
        action: null
      };
    }

    // 우선순위 높은 알림 선택
    alerts.sort((a,b) => b.priority - a.priority);
    return alerts[0];
  } catch(e){
    return { msg: `안녕하세요! 머니냥이에요 🐱\n궁금한 점을 물어보세요!`, action: null };
  }
}

function calcWeekOT(){
  // 이번 주 OT 계산 (월~일 기준)
  try {
    const today = new Date();
    const dow = today.getDay(); // 0=일
    const mondayOffset = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset);
    monday.setHours(0,0,0,0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23,59,59,999);

    // ★ Fix #19: lsLoad('att_data') → dayData 직접 참조 (v11 구조 대응)
    const stored = (typeof dayData !== 'undefined' ? dayData : {});
    let weekOT = 0;
    Object.keys(stored).forEach(dateStr => {
      const d = new Date(dateStr);
      if(d >= monday && d <= sunday){
        const rec = stored[dateStr];
        // v11: start/end 필드 사용 (구버전 in/out 폴백 포함)
        const startVal = rec.start !== undefined ? rec.start : rec.in;
        const endVal   = rec.end   !== undefined ? rec.end   : rec.out;
        if(startVal !== undefined && startVal !== null && endVal !== undefined && endVal !== null){
          // start/end가 숫자(소수)면 그대로, 문자열(HH:MM)이면 변환
          const toH = v => typeof v === 'number' ? v :
            parseFloat(String(v).split(':').reduce((a,b,i)=>i===0?parseFloat(a):parseFloat(a)+parseFloat(b)/60, 0));
          const inH  = toH(startVal);
          const outH = toH(endVal);
          // 간단히: 8시간 초과분 (야간근무 고려)
          const worked = outH > inH ? outH - inH : 24 - inH + outH;
          const ot = Math.max(0, worked - 8);
          weekOT += ot;
        }
      }
    });
    return weekOT;
  } catch(e){ return 0; }
}

// ★ 시작 후 3초 뒤 스마트 알림 표시 — initAsstBubble()로 감싸서 init.js에서 호출
function initAsstBubble(){
  setTimeout(()=>{
    try{
      const b = document.getElementById('asst-bubble');
      if(!b) return;
      const alert = getSmartAlert();
      // 말풍선에 짧게 요약
      const shortMsg = alert.msg.split('\n')[0];
      b.textContent = shortMsg;
      b.classList.add('show');

      // 버블 클릭 시 패널 열기
      b.onclick = () => {
        b.classList.remove('show');
        if(!asstOpen) toggleAsst();
        // 패널이 열리면 스마트 알림 메시지 표시
        setTimeout(()=>{
          const msgs = document.getElementById('asst-msgs');
          if(msgs && msgs.children.length === 0){
            addBotMsg(alert.msg);
            // action이 있으면 관련 버튼 하이라이트
            if(alert.action === 'checkin'){
              const btn = document.getElementById('asst-checkin-btn');
              if(btn) { btn.style.animation = 'pulse-ring 1s ease-in-out 3'; }
            } else if(alert.action === 'checkout'){
              const btn = document.getElementById('asst-checkout-btn');
              if(btn) { btn.style.animation = 'pulse-ring 1s ease-in-out 3'; }
            }
          }
        }, 300);
      };

      bubbleTimer = setTimeout(()=>b.classList.remove('show'), 6000);
    }catch(e){ console.warn('[머니냥] 스마트 알림 초기화 실패:', e); }
  }, 3000);
}

function toggleAsst(){
  asstOpen=!asstOpen;
  const panel=document.getElementById('asst-panel');
  const btn=document.getElementById('asst-btn');
  const bubble=document.getElementById('asst-bubble');
  const mobBtn=document.getElementById('mob-btn-asst');
  panel.classList.toggle('open', asstOpen);
  if(btn){
    btn.style.animation = asstOpen ? 'none' : 'asst-float 3s ease-in-out infinite';
    btn.style.transform = asstOpen ? 'scale(1)' : '';
  }
  // 모바일 탭 버튼 활성 상태 동기화
  if(mobBtn) mobBtn.classList.toggle('asst-open', asstOpen);
  bubble.classList.remove('show');
  if(asstOpen){
    renderAsstContext(); // 현재 화면 컨텍스트 반영
    if(typeof AsstMemory!=='undefined') AsstMemory.recordPage(getCurrentPageId());
    if(document.getElementById('asst-msgs').children.length===0){
      if(!onboardingDone && !memName){
        onboardingStep = 1;
        addBotMsg('안녕하세요! 저는 머니냥이에요 🐱\n\n더 친근하게 도와드리려고요,\n어떻게 불러드릴까요? 이름이나 닉네임을 알려주세요!\n예) "민준이야" / "지수라고 불러줘"');
      } else {
        // ① N잡 수입 요약 — 여러 수입원 사용자 최우선
        var _selJobs = typeof loadSelectedJobs==='function' ? loadSelectedJobs() : [];
        var _njobGreetShown = false;
        if(_selJobs.length > 1){
          try {
            var _today = new Date(), _ny=_today.getFullYear(), _nm=_today.getMonth();
            var _njIncome = typeof getIncomeSummary==='function' ? getIncomeSummary(_ny,_nm) : null;
            var _njTotal = _njIncome ? (_njIncome.total||0) : 0;
            var _njLines = ['💼 N잡 전체 수입 현황이에요 🐱\n'];
            var _hasEmp = _selJobs.indexOf('employee') >= 0;
            var _hasFl  = _selJobs.indexOf('freelancer') >= 0;
            var _hasAlba = _selJobs.some(function(j){ return j!=='employee'&&j!=='freelancer'; });
            if(_hasEmp){
              var _njPay = typeof getPayData==='function' ? getPayData() : null;
              var _empPay = _njPay ? (_njPay.finalPay||0) : 0;
              _njLines.push('🏢 직장 실수령액: '+(_empPay>0 ? fmt(_empPay) : '미입력'));
            }
            if(_hasAlba) _njLines.push('💪 알바 수입: '+(_njTotal>0 ? '입력됨' : '미입력'));
            if(_hasFl)   _njLines.push('💻 프리랜서: '+(_njTotal>0 ? '입력됨' : '미입력'));
            _njLines.push('\n💰 이번달 합계: '+(_njTotal>0 ? fmt(_njTotal) : '0원 (미입력)'));
            _njLines.push('\n무엇이 궁금하세요?');
            addBotMsg(_njLines.join('\n'));
            if(typeof AsstActionDispatcher!=='undefined') AsstActionDispatcher.renderActions(['ask:report','nav:sal','nav:budget']);
            _njobGreetShown = true;
          } catch(e){}
        }
        if(!_njobGreetShown){
          // ② Insight Engine — critical/warning 있으면 최우선 표시 + Action 버튼
          var _insights = typeof AsstInsightEngine!=='undefined' ? AsstInsightEngine.analyze() : [];
          var _topInsight = _insights.length > 0 ? _insights[0] : null;
          if(_topInsight){
            if(typeof AsstMemory!=='undefined') AsstMemory.markInsightShown(_topInsight.id);
            addBotMsg(_topInsight.msg);
            if(typeof AsstActionDispatcher!=='undefined') AsstActionDispatcher.renderActions(_topInsight.actions||[]);
          } else {
            // ③ Context Greeting — 화면별 데이터 요약 (미입력 시 {msg, actions} 형식 지원)
            var _ctxGreet = (_asstCtx && typeof AsstContextGreeting!=='undefined' && AsstContextGreeting[_asstCtx.page])
              ? AsstContextGreeting[_asstCtx.page](_asstCtx.data||{})
              : null;
            if(_ctxGreet){
              var _greetMsg = (typeof _ctxGreet==='object' && _ctxGreet.msg) ? _ctxGreet.msg : _ctxGreet;
              var _greetActs = (typeof _ctxGreet==='object' && _ctxGreet.actions) ? _ctxGreet.actions : [];
              addBotMsg(_greetMsg);
              if(_greetActs.length && typeof AsstActionDispatcher!=='undefined') AsstActionDispatcher.renderActions(_greetActs);
            } else {
              // ④ 기존 getSmartAlert() fallback
              const alert = getSmartAlert();
              addBotMsg(alert.msg);
            }
          }
        }
      }
    }
  }
}

function getGreeting(){
  const d = getPayData();
  const h = new Date().getHours();
  const greet = h<12?'좋은 아침이에요 ☀️': h<18?'안녕하세요 😊':'수고 많으셨어요 🌙';
  // ★ Income Gateway: 직업유형과 무관하게 직장인 급여(d.grossPay/finalPay)를 보여주던 버그 수정
  const _selJobsG = (typeof loadSelectedJobs==='function') ? loadSelectedJobs() : [];
  const _isEmpG = _selJobsG.indexOf('employee')>=0;
  const _summaryG = (typeof getIncomeSummary==='function') ? getIncomeSummary(curY, curM) : null;
  const payLine = _isEmpG
    ? `• 예상 세전급여: ${fmt(d.grossPay)}\n• 예상 실수령액: ${fmt(d.finalPay)}\n\n`
    : (_summaryG ? `• 이번 달 예상 수입: ${fmt(_summaryG.total)}\n\n` : '');
  return `${greet} 저는 머니냥이에요! 🐱\n\n이번 달(${curY}년 ${curM+1}월) 현황을 보니,\n` +
    `• 근무일: ${d.wDays}일 / ${d.twd}일\n` +
    payLine +
    `궁금한 점을 질문하거나 아래 버튼을 눌러보세요! 💬`;
}

// 데이터 컨텍스트 생성 (AI에게 전달)
function buildContext(){
  const d = getPayData();
  const mo = `${curY}년 ${curM+1}월`;
  // ★ Income Gateway: 직장인이 아니면 직장인 전용 상세항목(기본급/수당/4대보험/세금) 대신
  //   직업유형에 맞는 총수입만 컨텍스트에 포함 — 직업유형과 무관하게 직장인 데이터가
  //   AI 응답 컨텍스트에 항상 들어가던 버그 수정
  const _selJobsC = (typeof loadSelectedJobs==='function') ? loadSelectedJobs() : [];
  const _isEmpC = _selJobsC.indexOf('employee')>=0;
  if(!_isEmpC){
    const _summaryC = (typeof getIncomeSummary==='function') ? getIncomeSummary(curY, curM) : null;
    return `[현재 데이터 - ${mo}]
선택된 직업유형: ${_selJobsC.join(', ') || '미선택'}
근무일수: ${d.wDays}일 / 총 ${d.twd}일
연차: ${d.lDays}일 | 반차: ${d.halfDays}회 | 결근: ${d.absDays}일
이번 달 예상 수입(직업유형 합산): ${_summaryC ? fmt(_summaryC.total) : '0원'}`;
  }
  return `[현재 데이터 - ${mo}]
근무형태: ${wt==='day'?'주간근무':wt==='night'?'야간근무':wt==='2shift'?'2교대':'3교대'}
기본시급: ${hourlyRate.toLocaleString()}원
근무일수: ${d.wDays}일 / 총 ${d.twd}일
정규근무시간: ${d.normalH}h | OT: ${d.totOT}h
야간근무: ${d.nightH}h | 휴일근무: ${d.holidayH}h
토요특근: ${d.satH}h | 일요특근: ${d.sunH}h
연차: ${d.lDays}일 | 반차: ${d.halfDays}회 | 결근: ${d.absDays}일
기본급: ${fmt(d.basePay)}
수당합계: ${fmt(d.totAllow)} (OT수당:${fmt(d.aOT)}, 야간:${fmt(d.aNight)}, 휴일:${fmt(d.aHoliday)}, 토요:${fmt(d.aSat)}, 일요:${fmt(d.aSun)})
근태공제: ${fmt(d.totDeduct)}
세전총급여: ${fmt(d.grossPay)}
4대보험: ${fmt(d.ins.total)} (국민연금:${fmt(d.ins.np)}, 건강:${fmt(d.ins.hi)}, 장기요양:${fmt(d.ins.ltc)}, 고용:${fmt(d.ins.ei)})
근로소득세+지방세: ${fmt(d.tax.total)}
최종실수령액: ${fmt(d.finalPay)}`;
}

// ══════════════════════════════════════════
// 머니냥 Q&A 데이터베이스 (100개)
// ══════════════════════════════════════════
const ALBA_QA = [
  // ★ Fix #64: "~가 뭐야" 설명형 질문 전용 FAQ 6개 추가(2026-06-21).
  //   매칭 알고리즘/데이터 응답 로직은 전혀 건드리지 않고 콘텐츠만 추가함.
  {q:"연차가 뭐야",a:"연차는 1년 이상 일하면 매년 주어지는 유급 휴가야. 쉬어도 급여가 그대로 나와. 보통 1년차에 15일이 기본이고, 입사일 기준으로 자동 계산돼. 설정 탭에 입사일을 입력하면 달력 통계 카드에서 연차 현황을 바로 확인할 수 있어.",cat:"근태"},
  {q:"반차가 뭐야",a:"반차는 하루 8시간 중 4시간만 쉬는 거야. 연차처럼 유급이라 급여에서 안 빠져. 오전 반차는 늦게 출근, 오후 반차는 일찍 퇴근하는 식으로 시간을 잡으면 돼. 회사 규정에 따라 다를 수 있으니 사용 전에 미리 확인해보는 게 좋아.",cat:"근태"},
  {q:"조퇴가 뭐야",a:"조퇴는 출근은 했는데 정해진 퇴근 시간보다 일찍 나가는 거야. 반차랑 다르게 미리 계획 안 하고 갑자기 몸이 안 좋거나 급한 일이 생겼을 때 주로 써. 못 채운 시간만큼 급여에서 공제돼.",cat:"근태"},
  {q:"야간수당이 뭐야",a:"밤 10시(22시)부터 새벽 6시 사이에 일한 시간에 추가로 붙는 수당이야. 시급의 0.5배가 더 붙어서, 예를 들어 시급 10,000원이면 야간엔 15,000원이 되는 거야. 앱이 근무시간만 입력하면 자동으로 계산해줘.",cat:"근태"},
  {q:"휴일근무가 뭐야",a:"휴일(주휴일·법정휴일 등)에 일한 걸 휴일근무라고 해. 8시간까지는 시급의 1.5배, 8시간을 넘긴 시간은 2.0배가 적용되는 계단식 계산이야. 날짜 눌러서 '🌙 휴일근무' 선택하면 자동으로 반영돼.",cat:"근태"},
  {q:"특근이 뭐야",a:"특근은 원래 쉬는 날인 토요일·일요일에 추가로 나와서 일하는 거야. 토요특근은 시급의 1.5배, 일요특근은 2.0배가 적용돼. 달력에서 토요일·일요일 날짜를 누르고 '토요특근'·'일요특근'을 선택하면 자동 계산돼.",cat:"근태"},
  {q:"반차랑 조퇴 차이가 뭐야",a:"반차는 하루 8시간 중 4시간만 쉬는 거고, 조퇴는 출근했다가 정해진 퇴근 시간 전에 일찍 나가는 거야. 반차는 미리 계획해서 쓰고, 조퇴는 갑자기 몸이 안 좋거나 급한 일 생겼을 때 쓰는 경우가 많아. 급여 공제는 둘 다 빠진 시간만큼 계산돼.",cat:"근태"},
  {q:"지각하면 급여에서 얼마나 깎여",a:"이 앱은 30분 단위 올림으로 계산해. 예를 들어 9시 출근인데 9시 6분에 왔으면 30분치 시급이 빠져. 회사마다 기준이 다를 수 있으니까 근로계약서를 한 번 확인해보는 게 좋아. 앱에서 지각 현황이 자동으로 표시되니까 참고해봐.",cat:"근태"},
  {q:"퇴근 시간 기록을 깜빡했어",a:"날짜 칸 눌러서 팝업 열고 메모란에 '퇴근 18:30' 이렇게 입력하면 자동 추출 버튼이 나타나. 눌러주면 바로 입력돼. 너무 늦게 기억났으면 카카오톡 메시지나 사진 찍은 거 보고 찾아서 입력해봐.",cat:"근태"},
  {q:"연차가 자동으로 계산된다는데 어떻게 해",a:"설정 패널에서 입사일 입력하면 근로기준법 기준으로 자동 계산돼. 1년 미만이면 매달 1일씩, 1년 이상이면 연 15일 기본으로 나와. 달력 통계 카드에서 연차 현황도 볼 수 있어. 실제 연차는 회사 규정에 따라 다를 수 있으니 참고용으로 활용해봐.",cat:"근태"},
  {q:"결근하면 어떻게 처리돼",a:"달력에서 해당 날짜 누르고 '❌ 결근' 버튼 누르면 돼. 급여에서 8시간치 시급이 빠지고 주휴수당에도 영향이 생길 수 있어. 아픈 거라면 회사에 미리 연락해두는 게 나중을 위해 좋아.",cat:"근태"},
  {q:"주휴수당은 어떤 조건에서 받을 수 있어",a:"일반적으로 주 15시간 이상 일하고, 그 주에 결근 없이 개근하면 발생하는 경우가 많아. 아르바이트도 동일하게 적용될 수 있어서 조건 맞으면 꼭 챙겨보는 게 좋아. 수입관리 탭에서 주휴수당 ON 켜면 자동으로 계산해줘. ※ 실제 적용은 고용 형태에 따라 달라질 수 있어.",cat:"근태"},
  {q:"교대근무 설정 어떻게 해",a:"설정 패널에서 근무 형태를 '2교대' 또는 '3교대'로 선택하면 돼. 버튼 바로 아래에 출퇴근 시간 설정창이 펼쳐지니까 주간조/야간조 시간 맞춰서 설정해. A/B/C조도 각각 따로 설정 가능해.",cat:"근태"},
  {q:"공휴일에 일하면 어떻게 기록해",a:"날짜 눌러서 '🌙 휴일근무' 버튼 누르고 시간 선택하면 돼. 일반적으로 공휴일 근무는 시급의 2배가 적용되는 경우가 많아. 자동으로 공휴일 표시도 해주니까 놓치지 않게 기록해두는 걸 추천해.",cat:"근태"},
  {q:"조퇴 급여 계산이 이상해",a:"조퇴는 8시간 기준에서 못 채운 시간만큼 공제야. 6시간 일했으면 2시간치가 빠지는 거야. 날짜 눌러서 '🚶 조퇴 시간설정' 눌러서 출퇴근 시간 정확히 입력하면 자동으로 계산해줘.",cat:"근태"},
  {q:"야간근무하면 수당이 따로 붙어",a:"밤 10시(22시)~새벽 6시 사이에 일한 시간은 야간수당 0.5배가 추가로 붙는 경우가 일반적이야. 예를 들어 시급 10,000원이면 야간에는 15,000원이 되는 거야. 앱이 자동으로 계산하니까 근무시간만 정확히 입력하면 돼. ※ 실제 금액은 참고용이야.",cat:"근태"},
  {q:"토요일 출근은 어떻게 기록해",a:"달력에서 해당 토요일 누르고 '🔵 토요특근' 선택하면 돼. 시급 1.5배 적용돼. 주별로 토요 특근 ON/OFF도 설정 가능하니까 매주 일하면 주별 토글 켜놓으면 편해.",cat:"근태"},
  {q:"연차를 쓰면 급여에서 빠지나",a:"유급 연차는 급여 공제가 없어. 쉬면서도 돈 받는 거야. 달력에서 '🌿 연차' 클릭만 하면 연차 카운트가 올라가고 급여에는 영향 없어. 단, 회사가 무급으로 처리하는 경우도 있으니까 근로계약서 확인해보는 게 좋아.",cat:"근태"},
  {q:"지각 몇 번하면 큰일나",a:"법적으로 정해진 기준은 없는데 지각 횟수가 많아지면 주휴수당에 영향 줄 수 있어. 현실적으로 사장님 눈에 띄면 계약 연장에 영향을 줄 수 있으니까 최대한 지키는 게 좋아. 이 앱에서 지각 현황이 자동으로 표시되니까 확인해봐.",cat:"근태"},
  {q:"OT 초과근무 수당은 언제 붙어",a:"하루 8시간 넘어서 일하면 OT야. 넘은 시간만큼 시급 1.5배 받아. 달력 날짜 카드에 'OT+Xh' 배지가 자동으로 붙으니까 한눈에 확인 가능해.",cat:"근태"},
  {q:"출근 시간 기록을 실수로 잘못 입력했어",a:"해당 날짜 다시 누르면 팝업에 현재 기록이 나와. 시간 선택창에서 수정하고 저장 버튼 누르면 바로 반영돼. 기록이 급여 계산에 직접 영향 주니까 정확하게 수정해두는 게 좋아.",cat:"근태"},
  {q:"반차 오전에도 쓸 수 있어",a:"앱에서는 출근/퇴근 시간 직접 설정해서 저장할 수 있어. 오전 반차면 늦게 출근, 오후 반차면 일찍 퇴근으로 시간 잡으면 돼. 회사 규정마다 다르니까 사용 전에 상사한테 미리 확인해보는 게 좋아.",cat:"근태"},
  {q:"3년 이상 일하면 연차가 더 생기나",a:"일반적으로 3년 이상이면 2년마다 1일씩 추가돼. 최대 25일까지 받을 수 있어. 입사일을 앱에 입력해두면 자동으로 계산해서 보여주니까 편해. ※ 실제 연차는 회사 규정에 따라 다를 수 있어.",cat:"근태"},
  {q:"일요일 근무 수당은 얼마야",a:"일반적으로 일요일 특근은 시급의 2배가 적용되는 경우가 많아. 달력에서 일요일 날짜 눌러서 '🔴 일요특근' 선택하고 시간 입력하면 자동 계산돼. ※ 실제 수당은 회사 규정 확인 후 적용해봐.",cat:"근태"},
  {q:"법정공휴일이 자동으로 표시된다는데",a:"맞아, 2024~2027년 공휴일이 앱에 다 입력되어 있어서 달력에 자동으로 주황색으로 표시돼. '🗓️ 공휴일 자동표시' 버튼 누르면 해당 월 공휴일을 자동으로 기록해줘.",cat:"근태"},
  {q:"퇴근 기록 없이 출근만 있으면 어떻게 돼",a:"달력 날짜 카드에 '⚠ 퇴근?' 배지가 붙어서 미기록을 알려줘. 퇴근 시간이 없으면 급여 계산이 정확하지 않으니까 늦게라도 기억해서 입력해두는 걸 추천해. 메모에 '퇴근 18:30' 입력하면 자동 추출도 가능해.",cat:"근태"},
  {q:"이번 달 실수령액이 얼마야",a:"상단 '💰 수입관리' 탭 누르면 4대보험이랑 세금 공제 후 예상 실수령액이 크게 표시돼. 출퇴근 기록 다 입력했으면 자동으로 계산해줘. ※ 참고용 수치이니 실제 명세서랑 비교해봐.",cat:"급여"},
  {q:"시급 설정은 어디서 해",a:"수입관리 탭 → '📌 기본급' 섹션에서 ① 법정 최저시급이랑 ② 회사 실제 시급 따로 입력할 수 있어. 기본급은 법정 시급으로, OT·야간 수당은 실제 시급으로 계산되니까 다르면 둘 다 입력해야 더 정확해.",cat:"급여"},
  {q:"4대보험이 너무 많이 나가는 것 같아",a:"국민연금 4.5%, 건강보험 3.545%, 장기요양보험, 고용보험 0.9% — 합치면 총급여의 약 9% 정도 나가. 세전 총급여가 높을수록 공제액도 올라가. 실제 명세서랑 다르면 수입관리 탭에서 직접 수정 가능해.\n\n⚠️ 4대보험 기준은 회사 정책에 따라 다를 수 있어. 정확한 확인은 노무사(1350) 상담을 받아봐.",cat:"급여"},
  {q:"OT 수당 계산이 맞는지 확인하고 싶어",a:"달력 날짜 눌러서 시간 보면 팝업에 연장수당 계산식이 바로 나와. 'OT X시간 × 시급 × 1.5 = 얼마' 형식으로 보여줘. 매달 수입관리 탭 '💎 추가 수당' 섹션에서 전체 OT 수당도 확인할 수 있어. ※ 앱 계산은 참고용이야.",cat:"급여"},
  {q:"전월이랑 이번달 급여 차이 보고 싶어",a:"수입관리 탭 열면 상단에 '📊 전월 대비' 카드가 자동으로 나와. 저번 달보다 얼마 더 받는지 ▲▼ 표시로 바로 보여줘. 두 달치 기록이 있어야 비교가 되니까 꾸준히 기록해두면 좋아.",cat:"급여"},
  {q:"점심시간은 급여에서 빠지나",a:"맞아, 점심 1시간은 무급 휴게시간으로 자동 공제돼. 야간이나 장시간 근무 시에는 저녁 0.5시간도 추가 공제돼. 설정에서 점심 공제 시간을 조정할 수도 있어.",cat:"급여"},
  {q:"기본급 209시간이 뭐야",a:"한 달 유급 근로시간이야. 실제 근무일과 주휴일(주휴수당 포함)을 합친 시간이 약 209시간이 돼. 이게 기본급 계산 기준이라서 시급 × 209h = 기본급이야. 법정 최저시급 기준으로 계산해줘. ※ 참고용 수치야.",cat:"급여"},
  {q:"명세서 출력할 수 있어",a:"수입관리 탭 상단 '📄 명세서 출력' 버튼 누르면 새 창으로 급여 명세서가 열려. PDF로 저장하거나 인쇄할 수 있어. 이직할 때나 증빙 자료로 활용하면 편해.",cat:"급여"},
  {q:"근속수당 식대는 어디서 입력해",a:"수입관리 탭 → '💎 추가 수당' 섹션에 근속수당, 만근수당, 기타수당 항목이 있어. 금액 직접 입력하면 실수령액에 자동으로 합산돼. 식대처럼 매달 고정 지급되면 여기에 넣어봐.",cat:"급여"},
  {q:"올해 연간 총수령액이 얼마인지 알고 싶어",a:"상단 '📊 연간요약' 탭에서 연도별로 확인 가능해. 매달 실제 받은 금액이랑 앱 계산값을 비교할 수 있고, 누적 연봉이랑 분기별 합산도 나와. 실제 명세서 금액을 직접 입력하면 더 정확해.",cat:"급여"},
  {q:"최저시급이 얼마야",a:"2026년 기준 법정 최저시급은 10,320원이야. 앱에 기본값으로 설정되어 있어. 회사에서 이보다 적게 지급된다면, 고용노동부 상담을 받아보는 방법도 있어.",cat:"급여"},
  {q:"계약직이랑 정규직 급여 계산이 달라",a:"이 앱은 시급 기반으로 계산하니까 계약 형태 상관없이 시급만 맞게 넣으면 돼. 다만 계약직은 퇴직금 조건이 다를 수 있고, 4대보험 가입 여부도 확인해보는 게 좋아.",cat:"급여"},
  {q:"야간수당은 몇 시부터야",a:"일반적으로 법정 야간은 오후 10시(22시)~오전 6시 사이야. 이 시간대에 일한 시간은 야간수당 0.5배 추가 계산돼. 설정에서 야간 시작 시간 바꿀 수 있으니까 회사 규정에 맞게 조정해봐.",cat:"급여"},
  {q:"반차를 쓰면 주휴수당 영향 받아",a:"반차는 출근으로 인정돼서 주휴수당에 영향 없어. 결근이 아니라서 개근 조건 충족해. 조퇴도 마찬가지야. 결근만 주휴수당 발생 조건에서 빠지게 돼.",cat:"급여"},
  {q:"퇴직금은 언제부터 받을 수 있어",a:"일반적으로 1년 이상 일하면 퇴직금이 발생하는 경우가 많아. 1일 평균임금 × 30일 × 근속연수로 계산돼. 이 앱은 퇴직금 계산 기능은 없으니까 고용노동부 퇴직금 계산기나 전문가 상담을 받아보는 걸 추천해.",cat:"급여"},
  {q:"이번 달 만근수당 받을 수 있어",a:"수입관리 탭 → 추가 수당에서 '만근수당' 칸 확인해봐. 이번 달 근무일수가 총 근무 예정일과 같으면 ✅ 만근 달성으로 표시돼. 금액은 회사 규정에 따라 직접 입력해두면 자동 적용돼.",cat:"급여"},
  {q:"수입관리에서 보험이랑 세금 수정할 수 있어",a:"응, 수입관리 탭 하단에 4대보험이랑 근로소득세 항목이 있고 직접 금액 입력 가능해. 실제 명세서랑 다를 때 수정하면 돼. '↺ 자동계산으로' 버튼 누르면 다시 자동계산으로 돌아와.",cat:"급여"},
  {q:"주휴수당을 자동으로 계산해주나",a:"수입관리 탭 '🌟 주휴수당' 토글 ON으로 켜면 이번 달 주별로 발생 여부 자동 계산해줘. 주 15시간 이상 + 개근 조건 충족된 주만 인정돼. 실제 적용 여부는 직접 금액 입력해서 확정해.",cat:"급여"},
  {q:"급여일을 앱에 저장할 수 있어",a:"머니냥한테 '급여일은 25일이야' 이렇게 말하면 기억해줘. 다음에 물어보면 알려주고 급여일 전후로 챙겨줄게. 가계부 탭에서도 급여일 기준으로 수입 관리할 수 있어.",cat:"급여"},
  {q:"급여 명세서가 실제랑 차이가 나면 어떻게 해",a:"앱 계산은 참고용이야. 실제 명세서가 기준이야. 차이 나는 항목을 수입관리 탭에서 직접 수정하거나, 연간요약 탭에서 실수령액을 직접 입력해두면 더 정확하게 관리할 수 있어.",cat:"급여"},
  {q:"3.3% 세금은 뭐야",a:"프리랜서나 단기 알바가 사업소득으로 급여 받을 때 원천징수되는 세금이야. 소득세 3% + 지방소득세 0.3% = 3.3%야. 4대보험 없이 일하는 경우에 많이 쓰여. ※ 정확한 세금은 개인 상황에 따라 다를 수 있어.",cat:"세금"},
  {q:"3.3% 떼였는데 환급받을 수 있어",a:"매년 5월 종합소득세 신고를 통해 환급받을 수 있는 경우가 많아. 연간 소득이 낮으면 낸 세금보다 환급이 더 나오는 경우도 있어. 홈택스에서 직접 신고하거나 세무사 상담을 받아보는 걸 추천해.",cat:"세금"},
  {q:"월 60시간 넘으면 어떻게 돼",a:"월 60시간 초과하는 순간부터 4대보험 전체(국민연금+건강보험+장기요양+고용보험)가 적용돼.\n\n🚨 주의! 60시간 넘는 첫 명세서에서 이전 근무분 소급 정산이 한꺼번에 빠질 수 있어. 예상보다 훨씬 많이 공제될 수 있으니 미리 준비해놔.\n\n⚠️ 회사 정책에 따라 다를 수 있으니 정확한 내용은 노무사 상담을 받아봐.",cat:"급여"},
  {q:"소급 정산이 뭐야",a:"60시간 초과 전에 고용보험만 냈는데, 초과하는 순간 그 이전 근무분에 대한 국민연금·건강보험·장기요양 미납분을 한꺼번에 공제하는 걸 소급 정산이라고 해.\n\n🚨 예를 들어 60시간 넘는 달 첫 명세서에서 갑자기 5만원 이상 더 빠질 수 있어. 미리 알고 준비하는 게 중요해.\n\n⚠️ 회사마다 적용 방식이 다를 수 있으니 실제 명세서로 꼭 확인해봐.",cat:"급여"},
  {q:"4대보험 가입 안 하면 어떻게 돼",a:"주 15시간, 월 60시간 이상 일하는 경우 일반적으로 4대보험 의무 가입 대상이 돼. 미가입이면 나중에 연금이나 실업급여에서 불이익을 받을 수 있어. 가입 여부가 불분명하면 근로복지공단이나 고용노동부에 상담받아보는 방법도 있어.",cat:"세금"},
  {q:"알바인데 세금 신고 해야 해",a:"급여를 사업소득(3.3%)으로 받으면 5월에 종합소득세 신고를 하는 게 일반적이야. 근로소득(4대보험 가입)으로 받으면 회사가 연말정산 해줘. 어떤 방식인지 모르겠으면 계약서 확인해봐. ※ 개인 상황에 따라 다를 수 있어.",cat:"세금"},
  {q:"프리랜서는 종합소득세 신고 꼭 해야 해",a:"일반적으로 연간 소득이 있으면 5월에 종합소득세 신고를 하는 경우가 많아. 홈택스에서 간편신고 서비스 이용하거나, 단순경비율 적용하면 혼자도 할 수 있어. 처음이면 세무사 상담을 받아보는 걸 추천해. ※ 정확한 의무 여부는 세무 전문가와 확인해봐.",cat:"세금"},
  {q:"근로소득세는 어떻게 계산돼",a:"월 급여 기준으로 간이세액표에 따라 계산돼. 부양가족 수에 따라 달라지고, 이 앱은 1인 기준으로 자동계산해줘. 실제 세액이 다르면 수입관리 탭에서 직접 수정 가능해. ※ 정확한 세액은 세무사 상담을 통해 확인해봐.",cat:"세금"},
  {q:"두 군데서 알바하면 세금 어떻게 돼",a:"두 곳 합산 소득으로 신고하는 경우가 일반적이야. 각각 원천징수됐더라도 합산하면 세율이 높아질 수 있어서 5월 종합소득세 신고 때 추가 납부가 생길 수도 있어. 미리 세금 예산을 잡아두는 걸 추천해. ※ 정확한 내용은 세무 전문가와 상담해봐.",cat:"세금"},
  {q:"연말정산이 뭐야",a:"1년 동안 미리 낸 세금이 실제 내야 할 세금보다 많으면 환급, 적으면 추가 납부하는 정산이야. 회사가 대신 해주고 1~2월에 처리돼. 알바나 프리랜서는 5월에 직접 종합소득세 신고를 하는 경우가 많아.",cat:"세금"},
  {q:"실업급여 받으면 세금 내야 해",a:"실업급여는 비과세라서 세금 없어. 실업급여 받는 기간에 다른 소득이 있으면 신고가 필요한 경우가 있어. 실업급여 관련 규정은 개인 상황에 따라 다를 수 있으니 고용센터에 상담받아보는 걸 추천해.",cat:"세금"},
  {q:"퇴직금에도 세금 떼",a:"퇴직소득세가 있어. 근무 연수가 길수록 공제가 많아져서 실제 세금은 생각보다 적을 수 있어. 회사가 퇴직금 줄 때 원천징수 후 지급하는 게 일반적이야. ※ 정확한 세액은 개인 상황에 따라 달라져.",cat:"세금"},
  {q:"식대나 교통비는 세금 안 내도 돼",a:"식대 월 20만원까지, 자가운전 보조금 월 20만원까지는 비과세가 적용되는 경우가 많아. 회사에서 별도 지급하면 그만큼 세금이 줄어들 수 있으니까 챙겨보는 게 좋아. 근로계약서에 이 항목이 있으면 비과세로 받는 거야. ※ 정확한 내용은 세무 전문가와 확인해봐.",cat:"세금"},
  {q:"국민연금 나중에 돌려받을 수 있어",a:"10년 이상 납부하면 노령연금으로 받고, 그 미만이면 60세 이후 반환일시금으로 받을 수 있는 경우가 있어. 자세한 조건은 국민연금공단에 상담받아보는 걸 추천해.",cat:"세금"},
  {q:"건강보험료가 너무 많이 나와",a:"직장가입자는 월급 기준으로 3.545% 나가. 실제 명세서랑 다르면 국민건강보험공단에 확인 요청해볼 수 있어. 앱에서 직접 수정도 가능해. ※ 실제 금액은 개인 상황에 따라 다를 수 있어.",cat:"세금"},
  {q:"소득이 적으면 세금이 0원이 될 수도 있어",a:"연 소득이 일정 수준 이하면 근로소득세가 0원이 되는 경우가 있어. 각종 공제 다 받으면 저소득 알바는 세금이 없는 경우도 많아. ※ 정확한 내용은 개인 상황에 따라 달라지니 참고용으로만 봐줘.",cat:"세금"},
  {q:"세금 더 내지 않으려면 어떻게 해",a:"합법적으로는 소득공제 항목을 최대한 챙기는 방법이 있어. 신용카드 사용, 의료비, 교육비 등 공제 가능한 항목을 모아두면 연말정산/종합소득세 때 도움이 될 수 있어. 홈택스에서 간편조회 해봐. ※ 정확한 절세 방법은 세무 전문가와 상담해봐.",cat:"세금"},
  {q:"가계부 어디서 시작해",a:"상단 '💳 가계부' 탭 눌러봐. 처음엔 고정지출 먼저 설정하는 게 좋아. '⚙️ 고정지출 설정' 버튼 누르면 월세, 대출, 통신비 등 입력할 수 있어. 그다음 수입 연동하면 자동으로 잔여 금액 계산해줘.",cat:"가계부"},
  {q:"잔고 소진일이 뭐야",a:"지금 소비 속도로 계속 쓰면 언제 돈이 0원이 되는지 예측해주는 거야. 오늘까지 하루 평균 얼마 썼는지 계산해서 남은 돈이랑 비교해. 경고 뜨면 씀씀이 줄여야 한다는 신호야. ※ 참고용 예측이야.",cat:"가계부"},
  {q:"이번 달 사용 가능한 금액은 어떻게 계산돼",a:"수입 - 고정지출 - 저축목표 = 이번 달 쓸 수 있는 돈이야. 여기서 또 변동지출을 빼면 지금 남은 잔액이 나와. 가계부 탭 중간에 크게 표시해줘.",cat:"가계부"},
  {q:"고정지출에는 뭘 넣어야 해",a:"월세, 대출 상환, 통신비, 보험료처럼 매달 무조건 나가는 돈을 넣어. 금액이 조금 달라도 평균치로 넣는 게 좋아. 고정지출이 정확해야 실제 쓸 수 있는 금액이 현실적으로 나와.",cat:"가계부"},
  {q:"지출 카테고리는 어떻게 나눠",a:"식비, 카페/간식, 교통비, 의료/건강, 의류/미용, 문화/오락, 경조사, 기타 8가지로 나뉘어 있어. '+ 지출 입력' 버튼 눌러서 카테고리 선택하고 금액이랑 날짜 입력하면 돼.",cat:"가계부"},
  {q:"저축 목표를 설정할 수 있어",a:"가계부 탭 하단에 '🎯 월 저축 목표' 입력란 있어. 목표 금액 넣으면 수입에서 먼저 빼서 실제 쓸 수 있는 돈을 계산해줘. 목표가 있어야 자연스럽게 절약하게 되더라.",cat:"가계부"},
  {q:"30% 절약하면 며칠 더 버틴다는 게 뭐야",a:"현재 하루 평균 지출을 30% 줄였을 때 돈이 며칠 더 버텨지는지 보여주는 거야. 예를 들어 지금 10일 남았는데 절약하면 15일 된다면 +5일 표시돼. 동기부여용 참고 수치야.",cat:"가계부"},
  {q:"수입이 달마다 달라지는데 어떻게 해",a:"알바/프리랜서면 수입계산기 탭에서 이번 달 수입 입력하고 '💳 가계부에 반영' 버튼 누르면 돼. 아니면 가계부 탭 하단 수입 직접입력란에 이번 달 예상 수입 넣어도 돼.",cat:"가계부"},
  {q:"경고가 초위험이 떴는데 어떻게 해",a:"이번 달 지출이 수입을 넘었거나 거의 다 쓴 거야. 불필요한 지출을 줄이고, 고정지출 빼고 남은 돈 위주로 쓰는 걸 추천해. 다음 달부터 고정지출을 조정할 방법도 찾아보는 게 좋아.",cat:"가계부"},
  {q:"식비가 제일 많이 나와 줄이는 방법 있어",a:"배달을 줄이고 마트에서 직접 사는 방법이 효과적이야. 점심 도시락이나 간단한 요리로 바꾸면 한 달에 꽤 줄일 수 있어. 가계부에 식비 따로 추적하면 어디서 새는지 파악이 돼.",cat:"가계부"},
  {q:"지출 기록을 삭제하고 싶어",a:"가계부 탭 지출 내역에서 각 항목 오른쪽 ✕ 버튼 누르면 삭제돼. 전체 다 지우려면 '전체삭제' 버튼 있어. 한 번 지우면 복구 안 되니까 신중하게.",cat:"가계부"},
  {q:"수입이 자동으로 연동 안 돼",a:"시급제는 근태 기록이 있어야 자동 연동돼. 연봉제는 설정에서 연봉만 입력하면 돼. 알바/프리랜서는 수입계산기 탭에서 입력하고 '가계부에 반영' 버튼 눌러야 해. 아니면 가계부 탭 수입 직접입력란에 금액 넣어도 돼.",cat:"가계부"},
  {q:"고정지출을 수정하고 싶어",a:"가계부 탭 아래 '등록된 고정지출' 섹션에서 '수정' 버튼 누르면 돼. 각 항목 금액 바꾸고 저장하면 즉시 반영돼. 통신비 바꾸거나 대출 상환액이 달라졌을 때 업데이트해줘.",cat:"가계부"},
  {q:"카테고리별 지출이 어디서 보여",a:"이번 달 지출이 있으면 가계부 탭 중간에 '🗂️ 카테고리별 지출' 섹션이 나타나. 식비, 교통비 등 항목별로 금액이랑 비율 막대로 보여줘서 어디서 가장 많이 쓰는지 한눈에 보여.",cat:"가계부"},
  {q:"이번 달 가계부 경고 색깔이 뭘 의미해",a:"✅ 초록 안전, ⚠️ 노랑 주의(지출 80%), 🔥 주황 위험(85%), 🚨 빨강 초위험(100% 이상)이야. 빨강이 뜨면 지출이 수입을 넘었다는 신호니까 지출을 줄여보는 게 좋아.",cat:"가계부"},
  {q:"월급이 너무 적어서 생활이 안 돼",a:"일단 고정지출부터 줄일 수 있는 게 있는지 확인해봐. 통신비는 알뜰폰으로 바꾸면 꽤 줄고, OTT 구독도 합산하면 생각보다 많이 나가. 수입을 늘리는 방법으로 부업이나 시급 높은 곳을 알아보는 것도 방법이 될 수 있어.",cat:"현실고민"},
  {q:"월세 내고 나면 생활비가 거의 없어",a:"월세가 수입의 30%를 넘으면 주거비 부담이 높은 편이야. 룸메이트 구하기, 공공임대 신청 알아보기, 직주근접으로 교통비 아끼기 같은 방법을 고려해볼 수 있어. 주거비가 줄어야 다른 부분이 편해지더라.",cat:"현실고민"},
  {q:"카드빚이 있는데 어떻게 관리해야 해",a:"이자가 높은 것부터 우선 상환하는 방법을 추천해. 카드 사용을 최소화하고, 가계부로 지출을 추적하면 어디서 줄일 수 있는지 파악이 돼. 부담이 크다면 서민금융진흥원 같은 곳에서 상담받아보는 방법도 있어.",cat:"현실고민"},
  {q:"월급날 전에 돈이 바닥났어",a:"당장 급하면 가족한테 빌리는 방법이 가장 부담이 적어. 대부업이나 캐피탈은 이자 부담이 커서 신중히 고려하는 게 좋아. 다음 달부터는 비상금 통장 만들어서 수입의 10%라도 따로 떼두는 습관을 만들어가는 걸 추천해.",cat:"현실고민"},
  {q:"부업을 하고 싶은데 어떤 게 좋아",a:"본업 시간이랑 체력을 고려해서 골라야 해. 배달, 쿠팡 플렉스는 시간이 자유롭고, 재능이 있으면 크몽 같은 플랫폼을 활용해보는 방법도 있어. 부업 수입도 따로 기록해두면 세금 신고 때 도움이 돼.",cat:"현실고민"},
  {q:"친구한테 돈 빌려줬는데 못 받고 있어",a:"차용증이 있으면 법적으로 청구할 수 있어. 없으면 카카오톡 대화 내용이라도 증거로 남겨두고, 정중하게 독촉 연락을 해보는 게 시작이야. 우선 내 생활은 빌려준 돈 없다고 생각하고 계획 세워봐.",cat:"현실고민"},
  {q:"저축을 하나도 못 하고 있어",a:"금액보다 '습관'을 만드는 게 먼저야. 월급 받자마자 소액이라도 자동이체 걸어두면 자연스럽게 저축이 돼. 가계부에서 저축 목표 설정해두면 지출할 때 의식하게 되더라.",cat:"현실고민"},
  {q:"명절에 경조사비가 너무 많이 나가",a:"연 단위로 미리 예산을 잡아두는 게 현실적이야. 가계부에서 경조사 카테고리로 따로 추적해두면 얼마나 나가는지 파악되고, 다음 해 예산 짜는 데 도움이 돼.",cat:"현실고민"},
  {q:"퇴직하고 수입이 없는데 어떻게 버텨",a:"실업급여 신청 가능한 상황인지 먼저 확인해봐. 비자발적 퇴직이면 고용보험 가입 기간이 180일 이상인 경우 신청할 수 있는 경우가 많아. 정확한 조건은 고용센터에 상담받아보는 걸 추천해.",cat:"현실고민"},
  {q:"통장에 항상 10만원 이하야",a:"지출을 줄여도 통장이 안 채워진다면 수입 자체를 늘리는 방법을 고민해보는 게 좋아. 지금 시급이 최저임금 수준인지 확인해보고, 가계부로 수입·지출을 정확히 파악하는 게 먼저야.",cat:"현실고민"},
  {q:"대출 이자가 너무 커 줄일 방법 없어",a:"금리가 높은 대출이라면 은행 대출로 갈아타는 대환대출을 알아보는 방법도 있어. 신용등급을 올리면 더 낮은 금리로 바꿀 수 있는 경우가 있어. 서민금융진흥원에서 상담받아보는 것도 좋은 방법이야.",cat:"현실고민"},
  {q:"사장이 임금을 안 줘",a:"임금이 지급되지 않는 상황이라면 고용노동부 고객상담센터(1350)에 상담을 받아볼 수 있어. 신고 전에 근무 기록, 계약서, 급여 입금 내역 같은 증거를 미리 정리해두면 도움이 돼. 혼자 해결하기 어려우면 도움을 요청하는 방법도 있어.",cat:"현실고민"},
  {q:"갑자기 해고당했어 뭘 해야 해",a:"30일 전 예고 없이 해고된 경우 해고예고수당을 받을 수 있는 경우가 있어. 부당해고라고 느껴진다면 고용노동부(1350) 상담을 받아보거나 노동위원회에 구제 신청을 알아볼 수 있어. 실업급여 신청 여부도 확인해봐.",cat:"현실고민"},
  {q:"생활비가 부족한데 대출받아도 될까",a:"생활비 대출은 이자가 지출을 더 늘리는 구조라서 신중하게 고려하는 게 좋아. 먼저 복지관, 긴급복지지원, 서민금융 같은 정부 지원을 알아보는 방법을 추천해. 주변에 도움을 요청하는 것도 방법이 될 수 있어.",cat:"현실고민"},
  {q:"돈 관리가 너무 어려워 어디서부터 시작해",a:"복잡하게 생각하지 않아도 돼. 이번 달 수입이 얼마인지 파악하고, 고정지출 다 적고, 남은 게 실제 쓸 수 있는 돈이야. 가계부 탭에서 이 세 가지만 먼저 입력해봐. 보이기 시작하면 관리가 훨씬 수월해져.",cat:"현실고민"},
  {q:"저축은 하고 싶은데 얼마부터 해야 해",a:"금액보다 '습관'이 중요해. 5만원도 좋고 1만원도 좋아. 자동이체로 월급날 바로 빠지게 해두고, 1년 뒤에 얼마 모였는지 보면 동기부여가 돼. 가계부에 저축 목표 넣으면 지출할 때 의식하게 되더라.",cat:"현실고민"},
  {q:"부모님 생활비도 줘야 하는데 내 생활비가 부족해",a:"내 생활 최소 비용을 먼저 계산해보고, 드릴 수 있는 현실적인 금액을 설정하는 게 좋아. 부모님께 솔직하게 상황을 이야기하는 게 장기적으로 더 나을 수 있어. 내 생활이 무너지면 더 드리기도 어려워지니까.",cat:"현실고민"},
  {q:"이직할까 말까 급여도 올라가야 할 것 같고",a:"연간요약 탭에서 지금까지 받은 총 금액을 확인해봐. 이직 제안 금액이랑 비교할 때는 단순 시급 말고 교통비, 복지, 4대보험 조건까지 다 따져보는 게 좋아. 꼼꼼히 비교해보면 실제로 더 버는 건지 파악이 돼.",cat:"현실고민"},
  {q:"물가가 오르는데 시급은 그대로야",a:"더 높은 시급을 주는 곳을 알아보는 방법도 있고, 같은 일이라도 지역이나 업종에 따라 시급 차이가 나는 경우가 있어. 지출 구조를 줄이는 것과 함께 부업이나 스킬 업으로 단가를 올리는 방향을 고민해보는 것도 좋아.",cat:"현실고민"},
  {q:"비상금이 얼마나 있어야 해",a:"일반적으로 최소 3개월치 생활비를 비상금으로 갖춰두는 게 좋다고 해. 처음엔 1개월치부터 목표로 잡아봐. 가계부에서 월 고정지출 확인하면 목표 금액이 나와. ※ 본인 상황에 맞게 조절해봐.",cat:"현실고민"},
  {q:"백업은 왜 해야 해",a:"앱 데이터는 브라우저 저장소에 있어서 브라우저 초기화하거나 앱 삭제하면 다 사라져. 백업 눌러서 JSON 파일 저장해두면 나중에 복원 가능해. 카카오톡 나에게 보내기로 저장해두는 걸 추천해.",cat:"앱사용법"},
  {q:"아이폰에서 앱처럼 설치하려면 어떻게 해",a:"Safari에서 파일 열고 하단 공유 버튼(□↑) 눌러서 '홈 화면에 추가' 선택해. 그러면 앱 아이콘이 홈 화면에 생겨. Chrome이나 다른 브라우저는 안 되니까 꼭 Safari로 해야 해.",cat:"앱사용법"},
  {q:"배경색을 바꿀 수 있어",a:"설정 패널에서 🎨 배경색 팔레트 선택하거나, 달력 빈 공간 탭하면 색이 바뀌어. 밝은 색 13개, 다크 18개 총 31가지 있어. 취향에 맞게 골라봐.",cat:"앱사용법"},
  {q:"SAO 퀵메뉴는 어떻게 열어",a:"모바일에서 화면 오른쪽 끝에서 왼쪽으로 스와이프하면 메뉴 버튼들이 튀어나와. 백업, 복원, 직업유형, 가계부, 초기화 같은 자주 쓰는 기능들에 빠르게 접근 가능해.",cat:"앱사용법"},
  {q:"직업유형 바꾸면 기존 데이터가 사라져",a:"아니, 안 사라져. 직업유형은 화면 표시 방식만 바꾸는 거야. 시급제 ↔ 연봉제 ↔ 프리랜서 ↔ 알바 전환해도 기존에 기록한 출퇴근, 급여 데이터는 그대로 유지돼.",cat:"앱사용법"},
  {q:"머니냥한테 뭐든 물어봐도 돼",a:"근태, 급여, 세금, 가계부 관련 질문하면 계산식 기반으로 바로 답해줘. 이름이나 시급 알려주면 더 맞춤으로 대답해줘. 인터넷 없어도 다 돼. ※ 답변은 참고용이니 중요한 내용은 전문가에게 확인해봐.",cat:"앱사용법"},
  {q:"달 이동은 어떻게 해",a:"달력 위에 ◀ ▶ 화살표 버튼 누르면 앞뒤 달로 이동할 수 있어. 지나간 달 기록도 볼 수 있고, 미래 달에 미리 스케줄도 입력할 수 있어.",cat:"앱사용법"},
  {q:"회사 로고를 앱 아이콘으로 쓸 수 있어",a:"상단 왼쪽 로고 영역 탭하면 이미지 업로드 가능해. 올린 이미지가 PWA 설치 시 앱 아이콘으로 쓰여. 회사 로고나 귀여운 이미지로 꾸며봐.",cat:"앱사용법"},
  {q:"알람은 어떻게 설정해",a:"프리랜서/알바 모드에서 달력 날짜 탭 → 일정이나 알바 추가 시 알람 시간 설정 가능해. 설정한 시간에 브라우저 알림이랑 앱 토스트 알림이 동시에 울려. 처음 설정 시 알림 허용 눌러줘야 해.",cat:"앱사용법"},
  {q:"데이터를 전부 초기화하고 싶어",a:"상단 🗑️ 초기화 버튼이나 SAO 퀵메뉴의 초기화 버튼 누르면 모든 데이터가 삭제돼. 한 번 지우면 복구 안 되니까 꼭 💾 백업 먼저 해두고 진행해.",cat:"앱사용법"},
  {q:"교대근무인데 어떻게 설정해?",a:"설정 패널에서 근무 형태를 '2교대' 또는 '3교대'로 선택하면 돼. 버튼 바로 아래에 출퇴근 시간 설정창이 펼쳐지니까 주간조/야간조 시간 맞춰서 설정해. A/B/C조도 각각 따로 설정 가능해.",cat:"근태"},
  {q:"조퇴를 했는데 급여가 이상하게 계산돼.",a:"조퇴는 8시간 기준에서 못 채운 시간만큼 공제야. 6시간 일했으면 2시간치가 빠지는 거야. 날짜 눌러서 '🚶 조퇴 시간설정' 눌러서 출퇴근 시간 정확히 입력하면 자동으로 계산해줘.",cat:"근태"},
  {q:"한 달에 몇 번 지각하면 큰일나?",a:"법적으로 정해진 기준은 없는데 지각 횟수가 많아지면 주휴수당에 영향 줄 수 있어. 그리고 현실적으로 사장님 눈에 띄면 계약 안 연장될 수 있으니까 최대한 지키는 게 좋아. 이 앱에서 지각 현황이 자동으로 표시되니까 확인해봐.",cat:"근태"},
  {q:"OT(초과근무) 수당은 언제 붙어?",a:"하루 8시간 넘어서 일하면 OT야. 넘은 시간만큼 시급 1.5배 받아. 달력 날짜 카드에 'OT+Xh' 배지가 자동으로 붙으니까 한눈에 확인 가능해.",cat:"근태"},
  {q:"반차를 오전에 쓸 수도 있고 오후에도 쓸 수 있어?",a:"앱에서는 출근/퇴근 시간 직접 설정해서 저장할 수 있어. 오전 반차면 늦게 출근, 오후 반차면 일찍 퇴근으로 시간 잡으면 돼. 회사 규정마다 다르니까 사용 전에 상사한테 확인하는 게 좋아.",cat:"근태"},
  {q:"전월이랑 이번 달 급여 차이 보고 싶어.",a:"수입관리 탭 열면 상단에 '📊 전월 대비' 카드가 자동으로 나와. 저번 달보다 얼마 더 받는지 ▲▼ 표시로 바로 보여줘. 두 달치 기록이 있어야 비교가 되니까 꾸준히 기록해두면 좋아.",cat:"급여"},
  {q:"근속수당, 식대는 어디서 입력해?",a:"수입관리 탭 → '💎 추가 수당' 섹션에 근속수당, 만근수당, 기타수당 항목이 있어. 금액 직접 입력하면 실수령액에 자동으로 합산돼. 식대처럼 매달 고정 지급되면 여기에 넣어.",cat:"급여"},
  {q:"경고가 🚨 초위험이 떴는데 어떻게 해?",a:"이번 달 지출이 수입을 넘었거나 거의 다 쓴 거야. 지금 당장 불필요한 지출 다 끊고, 고정지출 빼고 남은 돈만 쓴다는 생각으로 버텨야 해. 다음 달부터 고정지출 줄일 방법 찾는 게 급해.",cat:"가계부"},
  {q:"식비가 카테고리 중 제일 많이 나와. 줄이는 방법 있어?",a:"배달 줄이고 마트에서 직접 사는 게 제일 효과적이야. 점심은 도시락, 저녁은 간단히 해먹으면 한 달에 10만원 이상 줄일 수 있어. 가계부에 식비 따로 추적하면 어디서 새는지 보여.",cat:"가계부"},
  {q:"갑자기 해고당했어. 뭘 해야 해?",a:"30일 전 예고 없이 해고면 해고예고수당 받을 수 있어. 부당해고 같으면 노동위원회에 구제 신청 가능해. 실업급여도 바로 신청해. 억울하면 참지 말고 고용노동부(1350) 전화해봐.",cat:"현실고민"},
  {q:"이직할까 말까 고민이야. 급여도 올라가야 할 것 같고.",a:"연간요약 탭에서 지금까지 받은 총 금액 확인해봐. 그리고 이직 제안 금액이랑 비교해. 단순 시급 말고 교통비, 복지, 4대보험 조건까지 다 따져야 실제로 더 버는 건지 보여.",cat:"현실고민"}
];

// Q&A 매칭 함수 — 형태소 유사도 기반 점수 산출
// ★ Fix #59: 짧은 일상 질문이 흔한 조사/어미 2~3글자만 겹쳐도 FAQ로 오매칭되던
//   문제 수정(2026-06-21). 예: "오늘 점심 뭐 먹지?" ↔ "점심시간은 급여에서 빠지나"가
//   "점심"이라는 불용어 하나만으로 매칭되던 사례. 이 단어들은 매칭 점수 계산에서 제외.
const QA_STOP_TOKENS = new Set(['점심','좋아','보여','뭐야','가뭐','가뭐야','해줘','줄래']);

function matchQA(userMsg){
  const norm = s => s.replace(/\s/g,'').replace(/[?？!！~～]/g,'').toLowerCase();
  const um = norm(userMsg);

  // 키워드 추출 (2글자 이상)
  function tokens(s){
    const t = [];
    for(let i=0;i<s.length;i++) for(let j=i+2;j<=Math.min(i+6,s.length);j++) t.push(s.slice(i,j));
    return t;
  }

  let best = null, bestScore = 0;
  const umTokens = tokens(um);

  ALBA_QA.forEach(item => {
    const qn = norm(item.q);
    const qTokens = tokens(qn);
    // 공통 토큰 비율 (불용어는 점수에서 제외)
    let hit = 0;
    umTokens.forEach(t => { if(!QA_STOP_TOKENS.has(t) && qn.includes(t)) hit += t.length; });
    qTokens.forEach(t => { if(!QA_STOP_TOKENS.has(t) && um.includes(t)) hit += t.length; });
    const score = hit / (um.length + qn.length + 1);
    if(score > bestScore){ bestScore = score; best = item; }
  });

  // 임계값 0.15 이상이면 매칭 성공
  return bestScore >= 0.15 ? best : null;
}

function callClaude(userMsg){
  // 순수 JS 계산식 기반 머니냥 응답 (API 없음)
  const d = getPayData();
  // ★ Income Gateway: 아래 응답 블록들이 d.finalPay/d.grossPay(직장인 전용 계산값)를
  //   직업유형과 무관하게 그대로 답변하던 버그 수정용 — 직장인이 아니면 게이트웨이의
  //   직업유형 합산 총수입을 답한다.
  const _selJobsCC = (typeof loadSelectedJobs==='function') ? loadSelectedJobs() : [];
  const _isEmpCC = _selJobsCC.indexOf('employee')>=0;
  // v2.0: 연봉제 데이터 — 연봉 설정 시 configured=true
  const _isSalCC = _selJobsCC.indexOf('salary')>=0;
  const _salCC = (_isSalCC && typeof getSalaryPayData==='function') ? getSalaryPayData() : null;
  const _summaryCC = (typeof getIncomeSummary==='function') ? getIncomeSummary(curY, curM) : null;
  const msg = userMsg.replace(/\s/g,'').toLowerCase();

  // ── 채팅 히스토리에 사용자 메시지 추가 ──
  chatHistory.push({ role: 'user', text: userMsg });
  if(chatHistory.length > 10) chatHistory = chatHistory.slice(-10);

  // ── 온보딩: 처음 이용 시 이름 질문 ──
  if(onboardingStep === 1){
    // 이름 입력 대기 중
    const nameGuess = userMsg.match(/^([가-힣a-zA-Z]{1,6})(?:이야|야|이에요|예요|입니다)?$/) ||
                      userMsg.match(/(?:나는?|저는?)\s*([가-힣a-zA-Z]{1,6})/) ||
                      userMsg.match(/([가-힣a-zA-Z]{1,6})(?:이라고|라고)\s*불러/);
    const extracted = nameGuess ? (nameGuess[1]||nameGuess[2]||'').replace(/이$/, '') : null;
    if(extracted && extracted.length >= 1){
      memName = extracted;
      onboardingStep = 2;
      onboardingDone = true;
      lsSave();
      const r = `반가워요, ${memName}님! 🎉\n머니냥이 열심히 도와드릴게요 🐱\n\n궁금한 게 있으면 언제든지 물어보세요!\n예) "이번달 급여 알려줘", "연차 몇 개야?"`;
      chatHistory.push({ role: 'bot', text: r }); lsSave();
      return r;
    } else {
      // 이름 못 받으면 넘어가기
      onboardingStep = 2;
      onboardingDone = true;
      lsSave();
    }
  }

  // ── v2.6: SAO AI Router — 모듈이 처리 가능한 질문은 즉시 답변,
  //    어떤 모듈도 처리 못 하면 아래 기존 흐름(Claude 역할)으로 폴스루 ──
  if(typeof SaoRouter!=='undefined'){
    const routed = SaoRouter.route(userMsg, msg);
    if(routed.handled){
      if(routed.async){
        routed.async.then(function(r){
          addBotMsg(r);
          chatHistory.push({ role:'bot', text:r });
          if(chatHistory.length > 10) chatHistory = chatHistory.slice(-10);
          lsSave();
        });
      }
      chatHistory.push({ role:'bot', text:routed.reply }); lsSave();
      return routed.reply;
    }
  }

  // ── 기억 감지: 이름/호칭 ──
  // 예: "나 민준이야", "내 이름은 지수야", "민준이라고 불러줘"
  const nameMatch = userMsg.match(/(?:나\s*는?|내\s*이름\s*은?|저\s*는?)\s*([가-힣a-zA-Z]{1,6})(?:이야|야|이에요|예요|입니다|이라고불러|라고불러)/);
  if(nameMatch){
    memName = nameMatch[1].replace(/이$/, ''); // "민준이" → "민준"
    lsSave();
    const r = `반가워요, ${memName}님! 이제 ${memName}님이라고 부를게요 🐱🎉`;
    chatHistory.push({ role: 'bot', text: r }); lsSave(); return r;
  }

  // ── 기억 감지: 급여일 ──
  // 예: "25일이 급여일이야", "매달 10일에 월급 받아", "급여일은 15일"
  const paydayMatch = userMsg.match(/(?:급여일|월급날|월급|급여)[^0-9]*(\d{1,2})\s*일|(\d{1,2})\s*일[^0-9]*(?:급여일|월급날|급여|월급)/);
  if(paydayMatch && (msg.includes('급여일') || msg.includes('월급날') || msg.includes('월급') || msg.includes('급여'))){
    const day = parseInt(paydayMatch[1] || paydayMatch[2]);
    if(day >= 1 && day <= 31){
      memPayday = day;
      // ── 3곳 동시 동기화 ──
      budgetState.paydayDay = day;
      budgetSave();
      if(typeof savePayDaySetting==='function') savePayDaySetting(day); else localStorage.setItem('payDay_setting', String(day));
      // atm2_memory도 즉시 갱신 (lsSave 전에 memPayday 이미 위에서 세팅됨)
      // 사이드바 입력창 + 상태 표시까지 갱신
      const pdInput  = document.getElementById('payday-input');
      const pdStatus = document.getElementById('payday-status');
      if(pdInput)  pdInput.value = day;
      if(pdStatus){
        pdStatus.style.color = 'var(--accent)';
        pdStatus.textContent = `✅ 급여일 매달 ${day}일 저장됨!`;
        setTimeout(() => { pdStatus.textContent = ''; }, 3000);
      }
      lsSave();
      const namePrefix = memName ? `${memName}님의 ` : '';
      const r = `알겠어요! ${namePrefix}급여일은 매달 ${day}일로 기억할게요 🐱💰\n설정 패널에도 자동 반영됐어요!`;
      chatHistory.push({ role: 'bot', text: r }); lsSave(); return r;
    }
  }

  // ── 기억 감지: 직책/직종 ──
  // 예: "나 알바야", "파트타이머야", "정직원이야"
  const jobMatch = userMsg.match(/(?:나\s*는?|저\s*는?)\s*(알바|파트타이머|파트|정직원|직원|아르바이트|인턴|계약직|프리랜서)(?:야|이야|예요|이에요|입니다)/);
  if(jobMatch){
    memJobTitle = jobMatch[1];
    lsSave();
    const namePrefix = memName ? `${memName}님은 ` : '';
    const r = `기억했어요! ${namePrefix}${memJobTitle} 이시군요 🐱\n앞으로 ${memJobTitle}에 맞게 도움을 드릴게요!`;
    chatHistory.push({ role: 'bot', text: r }); lsSave(); return r;
  }

  // ── 기억 감지: 회사명 ──
  // 예: "나 스타벅스 다녀", "회사 이름은 CU야", "직장이 맥도날드야"
  const compMatch = userMsg.match(/(?:나\s*는?|저\s*는?)\s*([가-힣a-zA-Z0-9]{1,10})\s*(?:다녀|알바해|일해|근무해)|(?:회사|직장|매장)\s*(?:이름은?|은?|가)\s*([가-힣a-zA-Z0-9]{1,10})/);
  if(compMatch){
    const cn = (compMatch[1]||compMatch[2]||'').trim();
    if(cn.length >= 1){
      memCompany = cn;
      lsSave();
      const r = `${cn}에서 일하시는군요! 기억할게요 🐱🏪`;
      chatHistory.push({ role: 'bot', text: r }); lsSave(); return r;
    }
  }

  // ── 기억 감지: 시급 ──
  // 예: "나 시급 12000원이야", "시급이 11500원", "시급 만이천원"
  const hourlyMatch = userMsg.match(/시급\s*(?:이|은|가)?\s*(\d[\d,]+)\s*원/) ||
                      userMsg.match(/(\d[\d,]+)\s*원\s*(?:시급)/);
  if(hourlyMatch){
    const rateStr = (hourlyMatch[1]||'').replace(/,/g,'');
    const rate = parseInt(rateStr);
    if(rate >= 9000 && rate <= 100000){
      memHourlyRate = rate;
      lsSave();
      const r = `시급 ${rate.toLocaleString()}원 기억했어요 🐱💰\n(설정 탭에서 시급을 변경하시면 자동 계산에도 반영돼요!)`;
      chatHistory.push({ role: 'bot', text: r }); lsSave(); return r;
    }
  }

  // ── 기억 확인 요청 ──
  if(msg.includes('나기억해') || msg.includes('뭐기억') || msg.includes('기억뭐') || msg.includes('기억하는거') || msg.includes('기억한거') || msg.includes('저기억해')){
    const items = [];
    if(memName)        items.push(`• 이름: ${memName}님`);
    if(memPayday)      items.push(`• 급여일: 매달 ${memPayday}일`);
    if(memJobTitle)    items.push(`• 직책: ${memJobTitle}`);
    if(memCompany)     items.push(`• 직장: ${memCompany}`);
    if(memHourlyRate)  items.push(`• 시급: ${memHourlyRate.toLocaleString()}원`);
    if(leaveOverride !== null) items.push(`• 연차: ${leaveOverride}일 (직접 설정)`);
    if(items.length === 0){
      const r = `아직 기억하는 게 없어요 🐱\n이름, 급여일, 직장, 시급 등을 알려주시면 기억할게요!\n예) "나 민준이야", "급여일은 25일이야", "시급 12000원이야"`;
      chatHistory.push({ role: 'bot', text: r }); lsSave(); return r;
    }
    const r = `제가 기억하는 내용이에요 🐱🌿\n\n${items.join('\n')}\n\n잊어버리려면 "기억 초기화"라고 말씀해 주세요!`;
    chatHistory.push({ role: 'bot', text: r }); lsSave(); return r;
  }

  // ── 기억 초기화 ──
  if(msg.includes('기억초기화') || msg.includes('기억지워') || msg.includes('기억삭제') || msg.includes('다잊어')){
    memName = null; memPayday = null; memCompany = null; memJobTitle = null; memHourlyRate = null;
    chatHistory = [];
    onboardingDone = false; onboardingStep = 0;
    lsSave();
    const r = `모든 기억을 지웠어요 🐱\n새로 알려주시면 다시 기억할게요!`;
    chatHistory.push({ role: 'bot', text: r }); lsSave(); return r;
  }

  // ── 호칭 적용 헬퍼 ──
  const greeting = memName ? `${memName}님, ` : '';

  // ★ Fix #54: "연차가 뭐야?"처럼 설명을 원하는 질문은 데이터 응답이 아니라
  //   FAQ 설명으로 보내고, "연차 몇 개야?"처럼 내 데이터를 묻는 질문만 아래
  //   데이터 응답 블록이 처리하도록 구분(2026-06-20).
  const isExplanationQuestion = /(뭐야|뭐임|뭔가요|무엇|이란|란무엇|정의|설명해|설명좀|이게뭐|란뭐)/.test(msg);

  // ── 연차 override 초기화 ──
  if((msg.includes('연차') || msg.includes('월차')) &&
     (msg.includes('초기화') || msg.includes('자동') || msg.includes('취소') || msg.includes('리셋'))){
    leaveOverride = null;
    lsSave();
    return `연차 설정을 초기화했어요! 🐱\n이제 입사일 기준 자동 계산값을 사용할게요.`;
  }

  // ── 연차 override 저장 (숫자 + 연차/월차 패턴 감지) ──
  // 예: "15.5개 쓸 수 있어", "연차 15개야", "나 16일 연차 있어"
  const overrideMatch = userMsg.match(/(\d+(?:\.\d+)?)\s*(?:개|일|days?)?\s*(?:연차|월차|휴가)|(연차|월차|휴가)\s*(\d+(?:\.\d+)?)\s*(?:개|일)?/i);
  const overrideKeywords = ['있어','쓸수있','사용가능','가능해','야','이야','있음','받았어','생겼어','줬어'];
  const hasOverrideIntent = overrideKeywords.some(k => msg.includes(k));
  if(overrideMatch && hasOverrideIntent){
    const numStr = overrideMatch[1] || overrideMatch[3];
    const val = parseFloat(numStr);
    if(!isNaN(val) && val > 0 && val <= 365){
      leaveOverride = val;
      lsSave();
      const usedLeave = d.lDays + (d.halfDays * 0.5);
      const remaining = Math.max(0, leaveOverride - usedLeave);
      return `알겠어요! 사용 가능한 연차를 ${val}일로 기억할게요 🐱🌿\n\n• 설정한 총 연차: ${val}일\n• 이번 달 사용: ${usedLeave}일\n• 잔여 연차: ${remaining}일\n\n초기화하려면 "연차 자동계산으로" 라고 말씀해 주세요!`;
    }
  }

  // ★ Fix #54: 아래 데이터 응답 블록 전체는 "설명형 질문"(~이 뭐야 등)이 아닐 때만
  //   동작 — 설명형 질문은 이 블록을 건너뛰고 아래 FAQ 매칭으로 넘어감.
  if(!isExplanationQuestion){

  // ── 컨텍스트 기반 생존관리 응답 ──
  if(_asstCtx && _asstCtx.page==='budget'){
    var bd = _asstCtx.data || {};
    var riskLabel = {safe:'✅ 안전',warning:'⚠️ 주의',danger:'🚨 위험',danger_high:'🆘 매우 위험',nodata:'📭 데이터 없음'}[bd.riskLevel||'nodata'];
    if(msg.includes('얼마나더') || msg.includes('더쓸') || msg.includes('남았') || (msg.includes('예산') && !msg.includes('초과'))){
      return '이번 달 생존관리 현황이에요! 🐱🛡️\n\n• 이번 달 수입: '+fmt(bd.income||0)+'\n• 고정지출: '+fmt(bd.fixedExpense||0)+'\n• 변동지출: '+fmt(bd.varExpense||0)+'\n• 가용 잔액: '+fmt(bd.remain||0)+'\n\n'+(bd.remain<0 ? '⚠️ 이미 예산을 초과했어요!' : '아직 '+fmt(bd.remain)+' 더 사용할 수 있어요!');
    }
    if(msg.includes('초과') || msg.includes('위험') || msg.includes('가능성')){
      return '예산 위험도 분석이에요! 🐱\n\n• 위험 수준: '+riskLabel+'\n• 일평균 지출: '+fmt(bd.avgDailySpend||0)+'\n• 남은 일수: '+(bd.daysLeft!=null ? bd.daysLeft+'일' : '계산 불가');
    }
    if(msg.includes('일평균') || msg.includes('하루평균') || msg.includes('하루얼마')){
      return '하루 평균 지출 현황이에요! 🐱\n\n• 일평균 지출: '+fmt(bd.avgDailySpend||0)+'\n• 이번달 변동지출: '+fmt(bd.varExpense||0)+'\n• 위험 수준: '+riskLabel;
    }
    if(msg.includes('소진') || msg.includes('바닥') || msg.includes('언제쯤')){
      return '예산 소진 예상이에요! 🐱\n\n• 남은 가용예산: '+fmt(bd.remain||0)+'\n• 일평균 지출: '+fmt(bd.avgDailySpend||0)+'\n'+(bd.daysLeft!=null ? '• 약 '+bd.daysLeft+'일 후 소진 예상' : '• 지출 데이터가 부족해서 계산이 어려워요');
    }
  }

  // ── 컨텍스트 기반 연간요약 응답 ──
  if(_asstCtx && _asstCtx.page==='dash'){
    var dd = _asstCtx.data || {};
    if(msg.includes('올해') || msg.includes('총수입') || msg.includes('연간') || (msg.includes('총') && msg.includes('벌'))){
      return dd.year+'년 수입 현황이에요! 🐱📊\n\n• 집계 기간: '+dd.monthsCount+'개월\n• 올해 누적 수입: '+fmt(dd.totalPay||0)+'\n• 월 평균: '+fmt(dd.avgPay||0)+'\n• 최고 수입월: '+(dd.maxMonth ? dd.maxMonth+'월 ('+fmt(dd.maxPay)+')' : '데이터 없음');
    }
    if(msg.includes('평균') || msg.includes('월평균')){
      return '월 평균 수입이에요! 🐱\n\n• '+dd.year+'년 월평균: '+fmt(dd.avgPay||0)+'\n• 집계 기간: '+dd.monthsCount+'개월\n• 누적 총수입: '+fmt(dd.totalPay||0);
    }
    if(msg.includes('최고') || msg.includes('가장많이') || msg.includes('많이번') || msg.includes('최대')){
      return '최고 수입월이에요! 🐱\n\n• 최고 수입월: '+(dd.maxMonth ? dd.maxMonth+'월' : '데이터 없음')+'\n• 해당 월 수입: '+fmt(dd.maxPay||0)+'\n• 올해 평균: '+fmt(dd.avgPay||0);
    }
  }

  // ── 실수령액 관련 ──
  if(msg.includes('실수령') || msg.includes('최종급여') || msg.includes('받는돈') || msg.includes('얼마받')){
    // v2.0: 연봉제 — 연봉 기준 확정 실수령액 (출근 기록 불필요)
    if(_isSalCC && _salCC && _salCC.configured && !_isEmpCC){
      const _tot = _summaryCC ? _summaryCC.total : _salCC.netPay;
      const _extra = _tot > _salCC.netPay ? `\n\n💼 다른 직종 수입 포함 이번 달 합산: ${fmt(_tot)}` : '';
      return `${greeting}연봉 기준 월 실수령액은 💰 ${fmt(_salCC.netPay)} 이에요! 🐱\n\n• 월급(연봉÷12): ${fmt(_salCC.monthly)}\n• 4대보험: -${fmt(_salCC.ins.total)}\n• 소득세+지방세: -${fmt(_salCC.tax.total)}\n• 실수령: = ${fmt(_salCC.netPay)}${_extra}`;
    }
    if(_isSalCC && _salCC && !_salCC.configured && !_isEmpCC){
      return `${greeting}아직 연봉이 설정되지 않았어요. 🐱\n설정 탭에서 연봉을 입력하면 월급·4대보험·세금·실수령액을 바로 계산해드릴게요!`;
    }
    if(!_isEmpCC){
      return `${greeting}이번 달 예상 수입은 💰 ${fmt(_summaryCC?_summaryCC.total:0)} 이에요! 🐱\n(현재 선택된 직업유형 기준으로 합산한 금액이에요)`;
    }
    if(typeof _hasAttendance==='function' && !_hasAttendance()){
      const _salLine = (_isSalCC && _salCC && _salCC.configured) ? `\n\n💼 연봉제 월 실수령액은 ${fmt(_salCC.netPay)} 이에요!` : '';
      return `${greeting}아직 이번달 출근 기록이 없어서 시급제 실수령액을 계산할 수 없어요. 🐱\n근태 탭에서 출근을 기록하면 바로 계산해드릴게요!${_salLine}`;
    }
    const _salAdd = (_isSalCC && _salCC && _salCC.configured) ? `\n\n💼 연봉제 실수령 ${fmt(_salCC.netPay)} 포함, 합산 ${fmt(d.finalPay + _salCC.netPay)} 이에요!` : '';
    return `${greeting}이번 달 최종 실수령액은 💰 ${fmt(d.finalPay)} 이에요! 🐱\n\n• 세전총급여: ${fmt(d.grossPay)}\n• 4대보험: -${fmt(d.ins.total)}\n• 소득세+지방세: -${fmt(d.tax.total)}\n• 실수령: = ${fmt(d.finalPay)}${_salAdd}`;
  }

  // ── 기본급 관련 ──
  if(msg.includes('기본급') || msg.includes('기본급여')){
    if(!_isEmpCC){
      return `기본급(법정시급×209h) 계산은 시급제 근로소득 기준이라, 직업유형에 "시급제"가 없으면 적용되지 않아요! 🐱\n현재 이번 달 예상 수입은 ${fmt(_summaryCC?_summaryCC.total:0)} 이에요.`;
    }
    if(typeof _hasAttendance==='function' && !_hasAttendance()){
      return `아직 이번달 출근 기록이 없어서 기본급을 계산할 수 없어요. 🐱\n근태 탭에서 출근을 기록하면 바로 계산해드릴게요!`;
    }
    return `기본급은 ${fmt(d.basePay)} 이에요! 🐱\n계산식: 법정 최저시급 ${hourlyRate.toLocaleString()}원 × 209시간(소정근로 월 기준)\n= ${hourlyRate.toLocaleString()} × 209 = ${fmt(d.basePay)}`;
  }

  // ── OT/연장수당 관련 ──
  if(msg.includes('ot') || msg.includes('연장') || msg.includes('초과근무') || msg.includes('overtime')){
    if(!_isEmpCC){
      return `OT(연장근무) 수당 계산은 시급제 근로소득 기준이라, 직업유형에 "시급제"가 없으면 적용되지 않아요! 🐱\n현재 이번 달 예상 수입은 ${fmt(_summaryCC?_summaryCC.total:0)} 이에요.`;
    }
    return `이번 달 OT(연장근무) 현황이에요! 🐱\n• OT 시간: ${d.totOT}h\n• 연장수당: ${fmt(d.aOT)} (회사시급 ${companyRate.toLocaleString()}원 × ${d.totOT}h × 1.5배)\n※ 10원 단위 반올림 적용`;
  }

  // ── 야간수당 관련 ──
  if(msg.includes('야간') || msg.includes('야간수당')){
    if(!_isEmpCC){
      return `야간수당 계산은 시급제 근로소득 기준이라, 직업유형에 "시급제"가 없으면 적용되지 않아요! 🐱\n현재 이번 달 예상 수입은 ${fmt(_summaryCC?_summaryCC.total:0)} 이에요.`;
    }
    return `야간근무 수당 계산이에요! 🐱\n• 야간시간: ${d.nightH}h (22:00~06:00)\n• 야간수당: ${fmt(d.aNight)} (시급 × 야간시간 × 0.5배 추가)\n※ 야간수당은 기본급에 추가로 지급됩니다.`;
  }

  // ── 4대보험 관련 ──
  if(msg.includes('4대보험') || msg.includes('보험') || msg.includes('국민연금') || msg.includes('건강보험') || msg.includes('고용보험')){
    if(!_isEmpCC){
      if(_isSalCC && _salCC && _salCC.configured){
        return `연봉제 4대보험 공제 내역이에요! 🐱\n• 국민연금: ${fmt(_salCC.ins.np)} (과세표준 × 4.5%)\n• 건강보험: ${fmt(_salCC.ins.hi)} (과세표준 × 3.545%)\n• 장기요양: ${fmt(_salCC.ins.ltc)} (건강보험료 × 12.95%)\n• 고용보험: ${fmt(_salCC.ins.ei)} (과세표준 × 0.9%)\n합계: ${fmt(_salCC.ins.total)}`;
      }
      return `4대보험 공제 내역은 시급제·연봉제 근로소득 기준이라, 해당 직업유형이 없으면 적용되지 않아요! 🐱\n현재 이번 달 예상 수입은 ${fmt(_summaryCC?_summaryCC.total:0)} 이에요.`;
    }
    return `4대보험 공제 내역이에요! 🐱\n• 국민연금: ${fmt(d.ins.np)} (과세표준 × 4.5%)\n• 건강보험: ${fmt(d.ins.hi)} (과세표준 × 3.545%)\n• 장기요양: ${fmt(d.ins.ltc)} (건강보험료 × 12.95%)\n• 고용보험: ${fmt(d.ins.ei)} (과세표준 × 0.9%)\n합계: ${fmt(d.ins.total)}`;
  }

  // ── 세금 관련 ──
  if(msg.includes('세금') || msg.includes('소득세') || msg.includes('근로소득세') || msg.includes('지방세')){
    if(!_isEmpCC){
      if(_isSalCC && _salCC && _salCC.configured){
        return `연봉제 소득세 내역이에요! 🐱\n• 근로소득세: ${fmt(_salCC.tax.income)}\n• 지방소득세: ${fmt(_salCC.tax.local)} (소득세 × 10%)\n• 합계: ${fmt(_salCC.tax.total)}\n※ 간이세액표 근사 기준${_salCC.dependents>1?` (부양가족 ${_salCC.dependents}명)`:''}`;
      }
      return `근로소득세 내역은 시급제·연봉제 근로소득 기준이라, 해당 직업유형이 없으면 적용되지 않아요! 🐱\n프리랜서·N잡 수입은 보통 3.3% 사업소득세가 적용돼요.`;
    }
    return `소득세 내역이에요! 🐱\n• 근로소득세: ${fmt(d.tax.income)}\n• 지방소득세: ${fmt(d.tax.local)} (소득세 × 10%)\n• 합계: ${fmt(d.tax.total)}\n※ 간이세액표 기준 적용`;
  }

  // ── 근무시간 관련 ──
  if(msg.includes('근무시간') || msg.includes('일한시간') || msg.includes('근로시간')){
    if(!_isEmpCC){
      return `OT·야간·휴일시간 구분 계산은 시급제 근로소득 기준이라, 직업유형에 "시급제"가 없으면 적용되지 않아요! 🐱\n근무일수는 근태관리 탭에서 확인할 수 있어요.`;
    }
    return `이번 달 근무 현황이에요! 🐱\n• 근무일수: ${d.wDays}일\n• 정규시간: ${d.normalH}h\n• OT: ${d.totOT}h\n• 야간: ${d.nightH}h\n• 휴일: ${d.holidayH}h\n• 토요특근: ${d.satH}h / 일요특근: ${d.sunH}h`;
  }

  // ── 수당 합계 ──
  if(msg.includes('수당') || msg.includes('총수당')){
    if(!_isEmpCC){
      return `OT·야간·휴일 수당 계산은 시급제 근로소득 기준이라, 직업유형에 "시급제"가 없으면 적용되지 않아요! 🐱\n현재 이번 달 예상 수입은 ${fmt(_summaryCC?_summaryCC.total:0)} 이에요.`;
    }
    return `이번 달 수당 합계: ${fmt(d.totAllow)} 이에요! 🐱\n• OT수당: ${fmt(d.aOT)}\n• 야간수당: ${fmt(d.aNight)}\n• 휴일수당: ${fmt(d.aHoliday)}\n• 토요특근: ${fmt(d.aSat)}\n• 일요특근: ${fmt(d.aSun)}\n• 기타수당: ${fmt(d.totAllow - d.aOT - d.aNight - d.aHoliday - d.aSat - d.aSun)}`;
  }

  // ── 공제 관련 ──
  if(msg.includes('공제') || msg.includes('차감') || msg.includes('결근') || msg.includes('지각')){
    if(!_isEmpCC){
      return `근태공제(결근·지각 공제) 계산은 시급제 근로소득 기준이라, 직업유형에 "시급제"가 없으면 적용되지 않아요! 🐱`;
    }
    return `이번 달 근태공제 내역이에요! 🐱\n• 근태공제 합계: ${fmt(d.totDeduct)}\n• 결근일수: ${d.absDays}일\n• 연차사용: ${d.lDays}일\n• 반차사용: ${d.halfDays}회\n※ 결근·지각은 해당 시간만큼 기본급에서 공제됩니다.`;
  }

  // ── 연차·월차 관련 ──
  if(msg.includes('연차') || msg.includes('반차') || msg.includes('휴가') || msg.includes('월차')){
    if(!_isEmpCC){
      return `연차·월차 자동계산은 직장인(입사일 기준) 근로기준법을 따르고 있어, 직업유형에 "직장인"이 없으면 적용되지 않아요! 🐱\n알바·프리랜서로 일하면서 연차가 있다면, 직업유형에 "직장인"을 추가하면 자동 계산을 사용할 수 있어요.`;
    }
    // 월차/연차 구분 정보 주입
    const alResult = calcAnnualLeave(hireDate);
    const alType = alResult ? (alResult.isMonthly ? '월차(1년 미만)' : '연차(1년 이상)') : '연차/월차';
    let leaveInfo = '';
    const usedLeave = d.lDays + (d.halfDays * 0.5);
    if(leaveOverride !== null){
      // 사용자가 직접 설정한 값 우선 사용
      const remaining = Math.max(0, leaveOverride - usedLeave);
      leaveInfo = `\n\n📅 연차 현황 (직접 설정값 기준):\n• 설정한 총 연차: ${leaveOverride}일 ✏️\n• 이번 달 사용: ${usedLeave}일 (연차 ${d.lDays}일 + 반차 ${d.halfDays}회)\n• 잔여 연차: ${remaining}일\n\n💡 자동계산으로 되돌리려면 "연차 자동계산으로" 라고 말해주세요!`;
    } else {
      const al = calcAnnualLeave(hireDate);
      if(al){
        const remaining = Math.max(0, al.totalLeave - usedLeave);
        leaveInfo = `\n\n📅 연차 자동 계산 결과 (입사일 기준):\n• 발생 연차: ${al.totalLeave}일\n• 이번 달 사용: ${usedLeave}일 (연차 ${d.lDays}일 + 반차 ${d.halfDays}회)\n• 잔여 연차: ${remaining}일\n${al.nextInfo ? `• ${al.nextInfo}` : ''}\n\n💡 실제 연차가 다르면 "나 15.5일 연차 있어" 라고 말해주세요!`;
      } else {
        leaveInfo = `\n\n⚠️ 입사일이 설정되지 않았어요.\n설정 탭에서 입사일을 입력하시면 연차를 자동 계산해 드려요!`;
      }
    }
    return `이번 달 연차·반차 현황이에요! 🐱\n• 연차 사용: ${d.lDays}일\n• 반차 사용: ${d.halfDays}회${leaveInfo}`;
  }

  // ── 세전 총급여 ──
  if(msg.includes('세전') || msg.includes('총급여') || msg.includes('그로스')){
    if(!_isEmpCC){
      return `세전·세후 구분은 시급제 근로소득 기준이라, 직업유형에 "시급제"가 없으면 적용되지 않아요! 🐱\n현재 이번 달 예상 수입은 ${fmt(_summaryCC?_summaryCC.total:0)} 이에요.`;
    }
    return `세전 총급여는 ${fmt(d.grossPay)} 이에요! 🐱\n계산: 기본급 ${fmt(d.basePay)} + 수당 ${fmt(d.totAllow)} - 공제 ${fmt(d.totDeduct)}\n= ${fmt(d.grossPay)}`;
  }

  // ── 시급 관련 ──
  if(msg.includes('시급') || msg.includes('최저시급')){
    return `현재 설정된 시급 정보예요! 🐱\n• 법정 최저시급: ${hourlyRate.toLocaleString()}원 (기본급 209h 계산 기준)\n• 회사 실제 시급: ${companyRate.toLocaleString()}원 (OT·수당 계산 기준)\n2026년 법정 최저시급은 ${CURRENT_MIN_WAGE.toLocaleString()}원이에요. 🐾`;
  }

  // ── 휴일·토요·일요 특근 ──
  if(msg.includes('휴일') || msg.includes('특근') || msg.includes('토요') || msg.includes('일요')){
    if(!_isEmpCC){
      return `휴일·토요·일요 특근 수당 계산은 시급제 근로소득 기준이라, 직업유형에 "시급제"가 없으면 적용되지 않아요! 🐱`;
    }
    return `특근 수당 내역이에요! 🐱\n• 휴일근무: ${d.holidayH}h → ${fmt(d.aHoliday)} (시급 × 2배)\n• 토요특근: ${d.satH}h → ${fmt(d.aSat)} (시급 × 1.5배)\n• 일요특근: ${d.sunH}h → ${fmt(d.aSun)} (시급 × 2배)\n※ 모두 10원 단위 반올림 적용`;
  }

  // ── 출근·퇴근 기록 안내 ──
  if(msg.includes('출근') || msg.includes('퇴근') || msg.includes('기록')){
    return `출퇴근 기록은 달력에서 날짜를 클릭해서 등록할 수 있어요! 🐱\n채팅창 하단 🟢 출근 / 🔴 퇴근 버튼으로도 오늘 날짜에 지금 시각으로 빠르게 기록할 수 있어요!`;
  }

  // ── 근로기준법 관련 ──
  if(msg.includes('근로기준법') || msg.includes('법정') || msg.includes('법') || msg.includes('규정')){
    return `한국 근로기준법 주요 기준이에요! 🐱\n• 법정 근로시간: 주 40시간 (1일 8시간)\n• OT 한도: 주 12시간 이내\n• OT 수당: 통상임금 × 1.5배\n• 야간(22~06시): 통상임금 × 0.5배 추가\n• 휴일근무: 통상임금 × 2배`;
  }

  // ★ Fix #58: "급여"/"수입"/"월급" 단독 질문이 데이터 응답 블록에 한 번도 안 걸려
  //   바로 FAQ로 새던 문제 수정 — 더 구체적인 블록(실수령/기본급/세전 등)이 모두 위에서
  //   먼저 처리되므로, 여기는 그 어떤 블록에도 안 걸린 경우에만 동작하는 캐치올(2026-06-21).
  if(msg.includes('급여') || msg.includes('수입') || msg.includes('월급')){
    if(!_isEmpCC){
      if(_isSalCC && _salCC && _salCC.configured){
        return `${greeting}이번 달 급여 요약이에요! 🐱\n• 월급(연봉÷12, 세전): ${fmt(_salCC.monthly)}\n• 공제 합계: ${fmt(_salCC.ins.total + _salCC.tax.total)}\n• 월 실수령: ${fmt(_salCC.netPay)}${_summaryCC && _summaryCC.total > _salCC.netPay ? `\n• 다른 직종 포함 합산: ${fmt(_summaryCC.total)}` : ''}`;
      }
      return `${greeting}이번 달 수입 요약이에요! 🐱\n• 이번 달 예상 수입(직업유형 합산): ${fmt(_summaryCC?_summaryCC.total:0)}`;
    }
    if(typeof _hasAttendance==='function' && !_hasAttendance()){
      return `${greeting}아직 이번달 출근 기록이 없어서 급여를 계산할 수 없어요. 🐱\n근태 탭에서 출근을 기록하면 바로 계산해드릴게요!`;
    }
    return `${greeting}이번 달 급여 요약이에요! 🐱\n• 세전총급여: ${fmt(d.grossPay)}\n• 공제 합계: ${fmt(d.ins.total + d.tax.total)}\n• 최종 실수령: ${fmt(d.finalPay)}`;
  }

  // ── 도움말 ──
  if(msg.includes('도움말') || msg.includes('뭐물어') || msg.includes('뭘물어') || msg.includes('help')){
    return `안녕하세요! 머니냥이에요 🐱\n아래 내용을 물어보세요!\n\n💰 실수령액·기본급·세전급여\n📊 OT수당·야간수당·특근수당\n🏥 4대보험·소득세 내역\n⏰ 근무시간·근태 현황\n📅 연차·반차·공제 내역\n📜 근로기준법 기준\n\n🟢🔴 채팅창 하단 출근/퇴근 버튼으로 오늘 출퇴근 기록도 바로 할 수 있어요!`;
  }
  } // ← isExplanationQuestion 가드 종료

  // ★ Fix #54: 데이터 응답 블록에서 매칭되지 않았거나 설명형 질문이면 FAQ 매칭
  if(onboardingStep !== 1){
    const qaHit = matchQA(userMsg);
    if(qaHit){
      const prefix = memName ? `${memName}님! ` : '';
      const catIcon = {근태:'📋',급여:'💰',세금:'💸',가계부:'💳',현실고민:'💬',앱사용법:'📱'}[qaHit.cat] || '🐱';
      const r = `${prefix}${qaHit.a}\n\n${catIcon} _(더 궁금한 게 있으면 언제든지 물어봐!)_`;
      chatHistory.push({ role: 'bot', text: r }); lsSave(); return r;
    }
  }

  // ★ Fix #54: 모든 패턴 매칭에 실패하면 무조건 급여 요약을 보여주던 것을
  //   "이해하지 못했다"는 명확한 안내로 변경(2026-06-20).
  const r = `죄송해요. 아직 이해하지 못한 질문이에요.\n급여, 연차, 근무일수, OT, 수입, 지출 관련 질문을 해주세요.`;
  chatHistory.push({ role: 'bot', text: r }); lsSave(); return r;
}

function addBotMsg(text){
  const msgs=document.getElementById('asst-msgs');
  const div=document.createElement('div');
  div.className='asst-msg bot';
  // 감정 이모지 시스템 (nyang-emoji.js 모듈 사용)
  let avatarHtml;
  if(typeof detectEmotion === 'function' && typeof getNyangAvatarHtml === 'function'){
    const emotionSrc = detectEmotion(text);
    avatarHtml = getNyangAvatarHtml(emotionSrc);
  } else {
    // fallback: 환영인사 이모지 (nyang-emoji.js 미로드 시)
    avatarHtml = '<img src="img/emoji/환영인사.png" style="width:28px;height:28px;object-fit:cover;border-radius:50%;margin-top:2px;">';
  }
  div.innerHTML=`<div class="av">${avatarHtml}</div><div class="bubble">${text.replace(/\n/g,'<br>')}</div>`;
  msgs.appendChild(div);
  msgs.scrollTop=msgs.scrollHeight;
  // 헤더 아바타도 같은 감정 이모지로 업데이트
  const headImg = document.querySelector('#asst-head img');
  if(headImg && typeof detectEmotion === 'function'){
    headImg.src = detectEmotion(text);
  }
}

function addUserMsg(text){
  const msgs=document.getElementById('asst-msgs');
  const div=document.createElement('div');
  div.className='asst-msg user';
  div.innerHTML=`<div class="bubble">${text}</div><div class="av">👤</div>`;
  msgs.appendChild(div);
  msgs.scrollTop=msgs.scrollHeight;
}

function addTyping(){
  const msgs=document.getElementById('asst-msgs');
  const div=document.createElement('div');
  div.id='asst-typing';
  div.className='asst-msg bot';
  // 생각중 이모지 (타이핑 중)
  let typingAvatarHtml;
  if(typeof getNyangTypingAvatarHtml === 'function'){
    typingAvatarHtml = getNyangTypingAvatarHtml();
  } else {
    typingAvatarHtml = '<img src="img/emoji/생각중.png" style="width:28px;height:28px;object-fit:cover;border-radius:50%;margin-top:2px;">';
  }
  div.innerHTML=`<div class="av">${typingAvatarHtml}</div><div class="bubble" style="padding:12px 16px;">
    <span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>
  </div>`;
  msgs.appendChild(div);
  msgs.scrollTop=msgs.scrollHeight;
  return div;
}

function sendAsst(){
  const inp=document.getElementById('asst-input');
  const txt=inp.value.trim();
  if(!txt) return;
  inp.value='';
  addUserMsg(txt);
  const reply = callClaude(txt);
  addBotMsg(reply);
  if(typeof AsstMemory!=='undefined') AsstMemory.recordQA(txt, reply);
  // chatHistory에 봇 응답 추가 (callClaude 내부에서 안 추가된 경우 대비)
  if(chatHistory.length === 0 || chatHistory[chatHistory.length-1].text !== reply){
    chatHistory.push({ role: 'bot', text: reply });
    if(chatHistory.length > 10) chatHistory = chatHistory.slice(-10);
    lsSave();
  }
}

function askQuick(q){
  if(!asstOpen) toggleAsst();
  document.getElementById('asst-input').value=q;
  sendAsst();
}

// (asst 영역 제외는 onBgTap 내부에서 처리)

// ══════════════════════════════════════════
// ── Context Provider Registry ──
// 화면별 데이터·추천 질문 제공. 신규 화면 추가 시 여기에만 등록.
// ══════════════════════════════════════════
var _asstCtx = null; // 현재 활성 컨텍스트 (callClaude에서 참조)

var AsstContextRegistry = {
  att: {
    name: '근태', icon: '📋',
    getCtx: function(){
      try {
        var d = getPayData();
        var today = new Date();
        var y = today.getFullYear(), m = today.getMonth();
        var prefix = y + '-' + String(m+1).padStart(2,'0');
        var keys = Object.keys(dayData||{}).filter(function(k){ return k.startsWith(prefix); });
        var workDays = keys.filter(function(k){ return ['work','sat_work','sun_work','holiday'].includes((dayData[k]||{}).status); }).length;
        var leaveDays = keys.filter(function(k){ return (dayData[k]||{}).status==='leave'; }).length;
        var halfDays  = keys.filter(function(k){ return (dayData[k]||{}).status==='half'; }).length;
        var leaveInfo = typeof calcAnnualLeave==='function' ? calcAnnualLeave() : null;
        return { workDays:workDays, leaveDays:leaveDays, halfDays:halfDays,
          totOT: d.totOT||0, nightH: d.nightH||0,
          leaveTotal: leaveInfo?leaveInfo.total:null, leaveUsed: leaveInfo?leaveInfo.used:null,
          leaveRemain: leaveInfo?leaveInfo.remain:null };
      } catch(e){ return {}; }
    },
    suggestions: [
      { label:'📅 근무일수', q:'이번달 근무일수 알려줘' },
      { label:'🌿 연차 잔여', q:'연차 몇 개 남았어?' },
      { label:'🌙 야근 현황', q:'이번달 야근 총 시간은?' },
      { label:'⏰ OT 수당',   q:'OT 수당 얼마야?' }
    ]
  },
  sal: {
    name: '급여', icon: '💰',
    getCtx: function(){
      try {
        var d = getPayData();
        return { grossPay:d.grossPay, finalPay:d.finalPay, basePay:d.basePay,
          aOT:d.aOT, aNight:d.aNight, insTotal:d.ins?d.ins.total:0,
          taxTotal:d.tax?d.tax.total:0, totOT:d.totOT, nightH:d.nightH };
      } catch(e){ return {}; }
    },
    suggestions: [
      { label:'💰 실수령액', q:'이번달 실수령액 얼마야?' },
      { label:'🌙 야간수당', q:'야간수당 얼마야?' },
      { label:'⏰ OT 수당',  q:'OT 수당 얼마야?' },
      { label:'🛡️ 4대보험', q:'4대보험 얼마 나와?' },
      { label:'💼 세금',     q:'소득세 얼마야?' }
    ]
  },
  budget: {
    name: '생존관리', icon: '🛡️',
    getCtx: function(){
      try {
        var today = new Date();
        var y = today.getFullYear(), m = today.getMonth();
        var income = typeof getIncomeSummary==='function' ? getIncomeSummary(y,m) : null;
        var zb = typeof calcZeroBalanceDate==='function' ? calcZeroBalanceDate() : null;
        var fixedTotal = (typeof budgetState!=='undefined' && budgetState)
          ? Object.values(budgetState.fixedExpenses||{}).reduce(function(s,v){ return s+(parseInt(v)||0); },0) : 0;
        var ymPrefix = y+'-'+String(m+1).padStart(2,'0');
        var monthVar = (typeof budgetState!=='undefined' && budgetState)
          ? (budgetState.variableExpenses||[]).filter(function(e){ return e.date&&e.date.startsWith(ymPrefix); }) : [];
        var varTotal = monthVar.reduce(function(s,e){ return s+(parseInt(e.amount)||0); },0);
        var incomeTotal = income ? income.total : 0;
        return { income:incomeTotal, fixedExpense:fixedTotal, varExpense:varTotal,
          totalExpense:fixedTotal+varTotal, remain:incomeTotal-fixedTotal-varTotal,
          riskLevel:zb?zb.riskLevel:'nodata', daysLeft:zb?zb.daysLeft:null,
          avgDailySpend:zb?zb.avgDailySpend:0 };
      } catch(e){ return {}; }
    },
    suggestions: [
      { label:'💳 남은 예산',   q:'이번달 얼마나 더 쓸 수 있어?' },
      { label:'⚠️ 위험 분석',   q:'예산 초과할 가능성 있어?' },
      { label:'📉 일평균 지출', q:'하루 평균 얼마 쓰고 있어?' },
      { label:'🗓️ 소진 예상일', q:'언제쯤 돈이 바닥날 것 같아?' }
    ]
  },
  dash: {
    name: '연간요약', icon: '📊',
    getCtx: function(){
      try {
        var y = typeof dashYear!=='undefined' ? dashYear : new Date().getFullYear();
        var nowM = new Date().getMonth();
        var totalPay=0, maxPay=0, maxMonth=-1;
        for(var mi=0; mi<=nowM; mi++){
          var d = getPayDataForMonth(y,mi);
          var pay = d.finalPay||0;
          totalPay += pay;
          if(pay>maxPay){ maxPay=pay; maxMonth=mi; }
        }
        return { year:y, totalPay:totalPay, avgPay:nowM>=0?Math.round(totalPay/(nowM+1)):0,
          maxPay:maxPay, maxMonth:maxMonth>=0?maxMonth+1:null, monthsCount:nowM+1 };
      } catch(e){ return {}; }
    },
    suggestions: [
      { label:'📈 올해 총수입', q:'올해 총 얼마 벌었어?' },
      { label:'📊 월평균 수입', q:'월 평균 수입이 얼마야?' },
      { label:'🏆 최고 수입월', q:'가장 많이 번 달이 언제야?' },
      { label:'📉 소비 분석',   q:'올해 소비 패턴 분석해줘' }
    ]
  },
  settings: {
    name: '설정', icon: '⚙️',
    getCtx: function(){
      try {
        return {
          workType: localStorage.getItem('atm2_workType')||'day',
          hourlyRate: parseInt(localStorage.getItem('atm2_hourlyRate')||'10320'),
          payday: parseInt(localStorage.getItem('atm2_payday')||'25')
        };
      } catch(e){ return {}; }
    },
    suggestions: [
      { label:'⏰ 내 시급',   q:'내 시급이 얼마야?' },
      { label:'📅 급여일',    q:'급여일이 언제야?' },
      { label:'🔄 근무형태',  q:'현재 근무형태 뭐야?' },
      { label:'📋 설정 요약', q:'내 현재 설정 요약해줘' }
    ]
  }
};

// 현재 활성 페이지 ID 반환 ('att'/'sal'/'budget'/'dash'/'settings')
function getCurrentPageId(){
  var t = document.querySelector('.main-tab.active');
  if(!t) return null;
  return t.id.replace('btn-','');
}

// 컨텍스트 수집 + 전역 _asstCtx 갱신 + 패널 UI 업데이트
function renderAsstContext(){
  var pageId = getCurrentPageId();
  var provider = pageId ? AsstContextRegistry[pageId] : null;

  // 컨텍스트 수집
  _asstCtx = provider ? { page:pageId, name:provider.name, icon:provider.icon,
    data:(function(){ try{ return provider.getCtx(); }catch(e){ return {}; } })(),
    suggestions:provider.suggestions } : null;

  // Memory Layer — 화면별 스냅샷 저장
  if(_asstCtx && typeof AsstMemory!=='undefined') AsstMemory.recordSnap(_asstCtx.page, _asstCtx.data);

  // ── 컨텍스트 바 ──
  var ctxBar = document.getElementById('asst-ctx-bar');
  if(ctxBar){
    if(_asstCtx){
      ctxBar.style.display='';
      ctxBar.innerHTML='<span style="font-size:11px;color:var(--text3);">'+_asstCtx.icon+' <b>'+_asstCtx.name+'</b> 화면 기준으로 답변해요</span>';
    } else {
      ctxBar.style.display='none';
    }
  }

  // ── 추천 질문 버튼 ──
  var quickEl = document.getElementById('asst-quick');
  if(!quickEl) return;

  var checkinBtn = '<button class="asst-q" id="asst-checkin-btn" onclick="manualRecordAttendance()" style="background:rgba(61,214,140,.15);border-color:var(--green);color:var(--green);font-weight:700;font-size:13px;">🟢 출근</button>';
  var checkoutBtn= '<button class="asst-q" id="asst-checkout-btn" onclick="manualRecordLeave()" style="background:rgba(255,92,122,.15);border-color:var(--red);color:var(--red);font-weight:700;font-size:13px;">🔴 퇴근</button>';

  // AsstDynamicSuggestions 우선, 없으면 정적 suggestions fallback
  var _dynSuggs = (_asstCtx && typeof AsstDynamicSuggestions!=='undefined' && AsstDynamicSuggestions[_asstCtx.page])
    ? AsstDynamicSuggestions[_asstCtx.page](_asstCtx.data||{})
    : (_asstCtx ? _asstCtx.suggestions : null);

  var suggBtns;
  if(_dynSuggs && _dynSuggs.length){
    suggBtns = _dynSuggs.map(function(s){
      var safeQ = s.q.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
      return '<button class="asst-q" onclick="askQuick(\''+safeQ+'\')">'+s.label+'</button>';
    }).join('');
  } else {
    suggBtns = '<button class="asst-q" onclick="askQuick(\'이번달 급여 요약해줘\')">💰 이번달 급여</button>'
             + '<button class="asst-q" onclick="askQuick(\'이번달 근무 상태 알려줘\')">📋 근무 현황</button>'
             + '<button class="asst-q" onclick="askQuick(\'월차 몇 개 남았어?\')">🌿 월차 잔여</button>'
             + '<button class="asst-q" onclick="askQuick(\'OT 수당 얼마야?\')">⏰ OT 수당</button>'
             + '<button class="asst-q" onclick="askQuick(\'4대보험 얼마 나와?\')">🛡️ 4대보험</button>';
  }

  // 근태 화면 또는 컨텍스트 없을 때만 출근/퇴근 버튼 유지
  // ★ 출근/퇴근은 dayData 기반 직장인(+회사알바) 전용 기록 — 프리랜서·배달 등
  //   비직장인에게 노출되면 잘못된 직장 근태가 저장되므로 직업 기준으로 게이트
  var _showCheckBtns = false;
  try{
    var _cbJobs = (typeof loadSelectedJobs==='function') ? loadSelectedJobs() : [];
    var _cbSub = localStorage.getItem('atm2_albaSubtype')||'';
    _showCheckBtns = _cbJobs.indexOf('employee')>=0 || _cbJobs.length===0
      || (_cbJobs.indexOf('convenience')>=0 && _cbSub==='company');
  }catch(e){ _showCheckBtns = true; }
  if((!pageId || pageId==='att') && _showCheckBtns){
    quickEl.innerHTML = checkinBtn + checkoutBtn + suggBtns;
  } else {
    quickEl.innerHTML = suggBtns;
  }
}

// ══════════════════════════════════════════
// ── Memory Layer ──
// Conversation Context Memory: 세션 기억 + localStorage 영속 저장
// 확장 포인트: snap에 날씨·소비패턴 등 신규 컨텍스트 추가 가능
// ══════════════════════════════════════════
var AsstMemory = (function(){
  var KEY = 'moneynyang_asst_mem';
  var mem = { lastPage:null, lastQ:null, lastA:null, lastTs:null, snapshots:{}, shownInsights:{} };
  try {
    var raw = localStorage.getItem(KEY);
    if(raw){ var p=JSON.parse(raw); Object.assign(mem,p);
      if(!mem.snapshots) mem.snapshots={};
      if(!mem.shownInsights) mem.shownInsights={}; }
  } catch(e){}

  function save(){ try{ localStorage.setItem(KEY, JSON.stringify(mem)); }catch(e){} }

  return {
    recordPage:  function(pg){ mem.lastPage=pg; save(); },
    recordSnap:  function(pg, data){ mem.snapshots[pg]={ts:Date.now(),data:data}; save(); },
    recordQA:    function(q, a){ mem.lastQ=q; mem.lastA=a; mem.lastTs=Date.now(); save(); },
    getSnap:     function(pg){ return mem.snapshots[pg]||null; },
    get:         function(k){ return mem[k]; },
    // Insight 중복 억제 — level별 쿨다운 (critical 12h / warning 24h / positive 48h)
    shouldShowInsight: function(id, level){
      var ts = (mem.shownInsights||{})[id];
      if(!ts) return true;
      var cd = level==='critical' ? 12*3600*1000 : level==='positive' ? 48*3600*1000 : 24*3600*1000;
      return (Date.now() - ts) > cd;
    },
    markInsightShown: function(id){
      if(!mem.shownInsights) mem.shownInsights={};
      mem.shownInsights[id]=Date.now(); save();
    },
    // 전체 메모리 요약 (향후 AI 분석에 전달)
    summary:     function(){
      return { lastPage:mem.lastPage, lastQ:mem.lastQ, lastA:mem.lastA,
               lastTs:mem.lastTs, snapshots:mem.snapshots };
    }
  };
})();

// ── Dynamic Context Greetings ──
// 화면별 데이터 기반 인사말. null 반환 시 getSmartAlert() fallback.
var AsstContextGreeting = {
  att: function(d){
    var lines = ['📋 이번 달 근태 현황이에요! 🐱'];
    lines.push('• 근무일수: '+d.workDays+'일 · OT: '+d.totOT+'h · 야근: '+d.nightH+'h');
    if(d.leaveRemain !== null && d.leaveRemain !== undefined){
      lines.push('• 연차 잔여: '+d.leaveRemain+'일'+(d.leaveRemain<=3?' (⚠️ 촉박)':''));
    }
    if(d.totOT>20) lines.push('• ⏰ 이번달 OT가 많아요 ('+d.totOT+'h)');
    lines.push('\n무엇이 궁금하세요?');
    return lines.join('\n');
  },
  sal: function(){
    try {
      var pay = getPayData();
      if(!pay || (!pay.finalPay && !pay.grossPay)){
        var _jobs = typeof loadSelectedJobs==='function' ? loadSelectedJobs() : [];
        var _isAlbaOnly = _jobs.length > 0 && _jobs.indexOf('employee') < 0 && _jobs.indexOf('freelancer') < 0;
        var _isFreelancer = _jobs.indexOf('freelancer') >= 0 && _jobs.indexOf('employee') < 0;
        if(_isAlbaOnly){
          return { msg:'💰 급여 탭이에요 🐱\n\n⚙️ 아직 시급이 설정되지 않았어요.\n설정에서 시급을 먼저 입력하면\n근무 시간만 기록해도 급여가 자동 계산돼요!', actions:['nav:att'] };
        }
        if(_isFreelancer){
          return { msg:'💰 급여 탭이에요 🐱\n\n💻 아직 프로젝트 수입이 없어요.\n이번달 받은 금액을 입력하면\n3.3% 세금을 자동으로 계산해드려요!', actions:['nav:sal'] };
        }
        return { msg:'💰 급여 탭이에요 🐱\n\n📋 아직 급여 정보가 없어요.\n근태 탭에서 근무일수를 입력하면\n급여가 자동으로 계산돼요!', actions:['nav:att'] };
      }
      var lines = ['💰 이번 달 급여 현황이에요! 🐱'];
      lines.push('• 실수령액: '+fmt(pay.finalPay));
      lines.push('• 세전급여: '+fmt(pay.grossPay)+' / 공제: '+fmt((pay.ins?pay.ins.total:0)+(pay.tax?pay.tax.total:0)));
      if(pay.totOT>0) lines.push('• OT수당: '+fmt(pay.aOT)+' ('+pay.totOT+'h)');
      if(pay.nightH>0) lines.push('• 야간수당: '+fmt(pay.aNight)+' ('+pay.nightH+'h)');
      lines.push('\n무엇이 궁금하세요?');
      return lines.join('\n');
    } catch(e){ return null; }
  },
  budget: function(d){
    if(!d.income && !d.totalExpense) return null;
    if(d.remain<0){
      return '⚠️ 이번 달 예산이 '+fmt(Math.abs(d.remain))+' 초과되었어요! 🐱\n• 수입: '+fmt(d.income)+' / 지출: '+fmt(d.totalExpense)+'\n어떻게 도와드릴까요?';
    }
    var rm = {safe:'✅ 예산 관리 양호',warning:'⚠️ 지출 주의',danger:'🚨 위험 수준',danger_high:'🆘 초과 임박',nodata:''}[d.riskLevel||'nodata']||'';
    return '🛡️ 이번 달 가용 예산 '+fmt(d.remain)+' 남았어요! 🐱\n• 수입: '+fmt(d.income)+' / 지출: '+fmt(d.totalExpense)+(rm?'\n• '+rm:'')+'\n무엇이 궁금하세요?';
  },
  dash: function(d){
    if(!d.totalPay) return null;
    var lines = ['📊 '+d.year+'년 수입 현황이에요! 🐱'];
    lines.push('• 누적 수입: '+fmt(d.totalPay)+' ('+d.monthsCount+'개월)');
    lines.push('• 월 평균: '+fmt(d.avgPay));
    if(d.maxMonth) lines.push('• 최고 수입: '+d.maxMonth+'월 '+fmt(d.maxPay));
    lines.push('\n무엇이 궁금하세요?');
    return lines.join('\n');
  },
  settings: function(d){
    var wm = {day:'주간고정',night:'야간','2shift':'주야2교대','3shift':'주야3교대'};
    return '⚙️ 현재 설정 요약이에요! 🐱\n• 시급: '+(d.hourlyRate||0).toLocaleString()+'원\n• 급여일: '+d.payday+'일\n• 근무형태: '+(wm[d.workType]||d.workType||'-')+'\n무엇을 도와드릴까요?';
  }
};

// ── 직업 선택 완료 후 AI 가이드 ──
// 급여 데이터가 없는 신규 사용자에게만 1회 표시
function showJobSelectedGuide(){
  try {
    var pay = typeof getPayData==='function' ? getPayData() : null;
    if(pay && (pay.finalPay>0 || pay.grossPay>0)) return; // 이미 데이터 있으면 스킵
  } catch(e){}
  var jobs = typeof loadSelectedJobs==='function' ? loadSelectedJobs() : [];
  if(!jobs.length) return;
  var isEmp = jobs.indexOf('employee') >= 0;
  var isFl  = jobs.indexOf('freelancer') >= 0;
  var isAlba = jobs.some(function(j){ return j!=='employee'&&j!=='freelancer'; });
  var msg, acts;
  if(jobs.length > 1){
    msg  = '✅ N잡 모드로 설정했어요 🐱\n각 수입원을 탭에서 따로 입력하면 합산해드려요!\n\n먼저 어느 탭부터 시작할까요?';
    acts = ['nav:att','nav:sal','nav:budget'];
  } else if(isEmp){
    msg  = '✅ 시급제 모드로 설정했어요 🏢\n📋 근태 탭에서 근무일수를 입력하면\n💰 급여가 자동으로 계산돼요!';
    acts = ['nav:att','nav:sal'];
  } else if(isFl){
    msg  = '✅ 프리랜서 모드로 설정했어요 💻\n💰 급여 탭에서 프로젝트 수입을 입력하면\n3.3% 원천징수를 자동으로 계산해드려요!';
    acts = ['nav:sal','nav:budget'];
  } else if(isAlba){
    msg  = '✅ 알바 모드로 설정했어요 💪\n⚙️ 먼저 설정에서 시급을 입력해주세요!\n그러면 근무 시간만 기록해도 급여가 자동 계산돼요.';
    acts = ['nav:att'];
  } else { return; }
  setTimeout(function(){
    try {
      if(!asstOpen) toggleAsst();
      setTimeout(function(){
        addBotMsg(msg);
        if(typeof AsstActionDispatcher!=='undefined') AsstActionDispatcher.renderActions(acts);
      }, 350);
    } catch(e){}
  }, 700);
}

// ── Dynamic Suggestions ──
// 데이터 상태에 따라 추천 질문이 다름 (예산 초과 여부, OT 과다 등)
var AsstDynamicSuggestions = {
  att: function(d){
    var _jobs = typeof loadSelectedJobs==='function' ? loadSelectedJobs() : [];
    var _albaOnly = _jobs.length > 0 && _jobs.indexOf('employee') < 0;
    var s = _albaOnly
      ? [
          { label:'📅 근무일수',    q:'이번달 근무일수 알려줘' },
          { label:'⏰ 총 근무시간', q:'이번달 총 근무 시간은?' },
          { label:'💰 이번달 급여', q:'이번달 급여 얼마야?' },
          { label:'🌙 야간 근무',   q:'이번달 야근 총 시간은?' }
        ]
      : [
          { label:'📅 근무일수', q:'이번달 근무일수 알려줘' },
          { label:'🌿 연차 잔여', q:'연차 몇 개 남았어?' },
          { label:'🌙 야근 현황', q:'이번달 야근 총 시간은?' },
          { label:'⏰ OT 수당',   q:'OT 수당 얼마야?' }
        ];
    if(d.leaveRemain!==null && d.leaveRemain!==undefined && d.leaveRemain<=3 && d.leaveRemain>=0)
      s.unshift({ label:'⚡ 연차 촉박!', q:'연차가 얼마 안 남았어, 빨리 써야 해?' });
    if(d.totOT>20)
      s.unshift({ label:'⏰ OT 과다',    q:'이번달 OT가 너무 많은 것 같은데 괜찮아?' });
    return s.slice(0,5);
  },
  sal: function(){
    var _jobs = typeof loadSelectedJobs==='function' ? loadSelectedJobs() : [];
    var _freelancerOnly = _jobs.indexOf('freelancer') >= 0 && _jobs.indexOf('employee') < 0;
    if(_freelancerOnly){
      return [
        { label:'💰 이번달 수입', q:'이번달 프리랜서 수입 얼마야?' },
        { label:'🧾 세금 계산',  q:'3.3% 세금 얼마야?' },
        { label:'📊 순수입',     q:'세금 빼고 실제로 얼마 받아?' },
        { label:'🎯 다음달 목표', q:'다음달 수입 목표를 어떻게 세우면 좋을까?' }
      ];
    }
    return [
      { label:'💰 실수령액', q:'이번달 실수령액 얼마야?' },
      { label:'🌙 야간수당', q:'야간수당 얼마야?' },
      { label:'⏰ OT 수당',  q:'OT 수당 얼마야?' },
      { label:'🛡️ 4대보험', q:'4대보험 얼마 나와?' },
      { label:'💼 세금',     q:'소득세 얼마야?' }
    ];
  },
  budget: function(d){
    if(d.remain<0) return [                          // 초과
      { label:'❓ 초과 원인', q:'왜 예산이 초과되었나요?' },
      { label:'💡 절약 방법', q:'절약 방법 알려주세요' },
      { label:'📊 지출 분석', q:'이번달 지출 분석해줘' },
      { label:'🆘 긴급 대응', q:'돈이 부족한데 어떻게 해야 해?' }
    ];
    if(d.remain<100000) return [                     // 여유 부족
      { label:'💳 잔여 확인', q:'이번달 얼마나 더 쓸 수 있어?' },
      { label:'⚠️ 소진 예상', q:'언제쯤 돈이 바닥날 것 같아?' },
      { label:'📉 절약 팁',   q:'남은 돈으로 어떻게 버텨야 해?' },
      { label:'📊 지출 분석', q:'하루 평균 얼마 쓰고 있어?' }
    ];
    return [                                          // 여유
      { label:'💳 남은 예산',   q:'이번달 얼마나 더 쓸 수 있어?' },
      { label:'⚠️ 위험 분석',   q:'예산 초과할 가능성 있어?' },
      { label:'📉 일평균 지출', q:'하루 평균 얼마 쓰고 있어?' },
      { label:'🗓️ 소진 예상일', q:'언제쯤 돈이 바닥날 것 같아?' }
    ];
  },
  dash: function(){
    return [
      { label:'📈 올해 총수입', q:'올해 총 얼마 벌었어?' },
      { label:'📊 월평균 수입', q:'월 평균 수입이 얼마야?' },
      { label:'🏆 최고 수입월', q:'가장 많이 번 달이 언제야?' },
      { label:'📉 소비 분석',   q:'올해 소비 패턴 분석해줘' }
    ];
  },
  settings: function(){
    return [
      { label:'⏰ 내 시급',   q:'내 시급이 얼마야?' },
      { label:'📅 급여일',    q:'급여일이 언제야?' },
      { label:'🔄 근무형태',  q:'현재 근무형태 뭐야?' },
      { label:'📋 설정 요약', q:'내 현재 설정 요약해줘' }
    ];
  }
};

// ══════════════════════════════════════════
// ── Insight Engine (선제형 AI) ──
// 사용자가 묻기 전에 AI가 먼저 중요한 변화·위험을 감지하여 메시지 생성
// 확장: AsstInsightEngine.register({ id, level, check }) 으로 신규 Insight 추가
// ══════════════════════════════════════════
var AsstInsightEngine = (function(){
  var PRIORITY = { critical:0, warning:1, positive:2, info:3 };

  // ── 내부 헬퍼 ──
  function _budget(){
    try {
      var today=new Date(), y=today.getFullYear(), m=today.getMonth();
      var income = typeof getIncomeSummary==='function' ? getIncomeSummary(y,m) : null;
      var incTotal = income ? income.total : 0;
      // 출근 기록 없으면 incTotal에 섞인 직장인 기본급 추정치(=finalPay)만큼 제외 (1단계와 동일 정책)
      // ★ getPayData()는 직업 유형과 무관하게 호출되므로, employee가 선택된 경우에만 보정
      //   (그렇지 않으면 프리랜서 등 다른 직업의 실수입에서 엉뚱하게 차감되는 버그 발생)
      try{
        var _selJobsBudget = (typeof loadSelectedJobs==='function') ? loadSelectedJobs() : [];
        if(_selJobsBudget.indexOf('employee')>=0 && typeof _hasAttendance==='function' && !_hasAttendance()){
          var pd = typeof getPayData==='function' ? getPayData() : null;
          if(pd) incTotal = Math.max(0, incTotal - (pd.finalPay||0));
        }
      }catch(e2){}
      var ymPfx = y+'-'+String(m+1).padStart(2,'0');
      var bs = (typeof budgetState!=='undefined') ? budgetState : null;
      var fixed = bs ? Object.values(bs.fixedExpenses||{}).reduce(function(s,v){return s+(parseInt(v)||0);},0) : 0;
      var varExp = bs ? (bs.variableExpenses||[]).filter(function(e){return e.date&&e.date.startsWith(ymPfx);})
                          .reduce(function(s,e){return s+(parseInt(e.amount)||0);},0) : 0;
      return { income:incTotal, fixed:fixed, varExp:varExp, remain:incTotal-fixed-varExp,
               daysLeft:new Date(y,m+1,0).getDate()-today.getDate(), dayOfMonth:today.getDate() };
    } catch(e){ return null; }
  }
  function _prevVarExp(){
    try {
      var today=new Date(), y=today.getFullYear(), m=today.getMonth();
      var pm=m-1, py=y; if(pm<0){pm=11;py--;}
      var pfx=py+'-'+String(pm+1).padStart(2,'0');
      var bs=(typeof budgetState!=='undefined')?budgetState:null;
      return bs?(bs.variableExpenses||[]).filter(function(e){return e.date&&e.date.startsWith(pfx);})
                  .reduce(function(s,e){return s+(parseInt(e.amount)||0);},0):0;
    } catch(e){ return 0; }
  }
  function _payNow(){
    try{ return typeof getPayData==='function'?getPayData():null; }catch(e){return null;}
  }
  function _payPrev(){
    try{
      var today=new Date(), y=today.getFullYear(), m=today.getMonth();
      var pm=m-1,py=y; if(pm<0){pm=11;py--;}
      return typeof getPayDataForMonth==='function'?getPayDataForMonth(py,pm):null;
    }catch(e){return null;}
  }
  function _leave(){
    try{ return typeof calcAnnualLeave==='function'?calcAnnualLeave():null; }catch(e){return null;}
  }

  // ── 10개 Insight 정의 (개선판) ──
  // check()는 string 또는 { msg, actions } 반환 — 상황별 동적 Action 지원
  var _checks = [

    // 1. 예산 초과 (critical)
    { id:'budget_exceed', level:'critical', check: function(){
      var b=_budget(); if(!b||b.income===0) return null;
      if(b.remain>=0) return null;
      var exceed=Math.abs(b.remain), total=b.fixed+b.varExp;
      var spendPct=b.income>0?Math.round(total/b.income*100):0;
      var varPct=total>0?Math.round(b.varExp/total*100):0;
      var dailyCut=b.daysLeft>0?Math.round(exceed/b.daysLeft):0;
      var msg='🚨 이번 달 예산을 '+fmt(exceed)+' 초과했어요! 🐱\n'
        +'• 수입 '+fmt(b.income)+' → 지출 '+fmt(total)+' (수입의 '+spendPct+'%)\n'
        +'• 고정비 '+fmt(b.fixed)+' / 변동비 '+fmt(b.varExp)+' (지출의 '+varPct+'%)\n'
        +(b.daysLeft>0?'• 앞으로 '+b.daysLeft+'일 — 하루 '+fmt(dailyCut)+' 씩 절약 필요':'• 이번달 마감 임박 — 다음달 계획을 세워요');
      // 변동비가 고정비보다 크면 지출 상세 우선, 아니면 고정비 점검
      var actions = b.varExp>b.fixed
        ? ['ask:budgetCause','ask:budgetDetail','ask:savingTip','nav:budget']
        : ['ask:budgetCause','ask:savingTip','nav:budget'];
      return { msg:msg, actions:actions };
    }},

    // 2. 예산 부족 (warning) — 잔여 10만원 미만 + 5일 이상 남음
    { id:'budget_low', level:'warning', check: function(){
      var b=_budget(); if(!b||b.income===0) return null;
      if(b.remain<0||b.remain>=100000||b.daysLeft<=4) return null;
      var dailyLeft=Math.round(b.remain/b.daysLeft);
      var spendPct=b.income>0?Math.round((b.fixed+b.varExp)/b.income*100):0;
      var urgency=b.remain<30000?'🔴 매우 촉박':b.remain<60000?'🟠 촉박':'🟡 주의';
      var msg='⚠️ 이번 달 예산이 '+urgency+' — '+fmt(b.remain)+' 남았어요! 🐱\n'
        +'• 남은 기간: '+b.daysLeft+'일 / 하루 가용: '+fmt(dailyLeft)+'\n'
        +'• 수입 대비 지출: '+spendPct+'% 소진 완료\n'
        +'하루 '+fmt(dailyLeft)+' 안에서 생활하면 버틸 수 있어요.';
      var actions=b.remain<30000
        ? ['ask:savingTip','ask:budgetDetail','nav:budget']
        : ['ask:budgetDetail','ask:savingTip','nav:budget'];
      return { msg:msg, actions:actions };
    }},

    // 3. 급여 감소 (warning) — 전월 대비 10% 이상 감소
    { id:'salary_drop', level:'warning', check: function(){
      if(typeof _hasAttendance==='function' && !_hasAttendance()) return null;
      var cur=_payNow(), prv=_payPrev();
      if(!cur||!prv||!prv.finalPay||prv.finalPay<10000) return null;
      if(cur.finalPay>=prv.finalPay*0.90) return null;
      var diff=prv.finalPay-cur.finalPay, pct=Math.round(diff/prv.finalPay*100);
      var wDiff=(cur.workDays||0)-(prv.workDays||0);
      var oDiff=(cur.totOT||0)-(prv.totOT||0);
      var cause=wDiff<-2?'근무일수 '+Math.abs(wDiff)+'일 감소':oDiff<-5?'OT '+Math.abs(oDiff)+'h 감소':'공제 항목 변동';
      var msg='⚠️ 예상 급여가 전월 대비 '+pct+'% ('+fmt(diff)+') 줄었어요! 🐱\n'
        +'• 이번달 '+fmt(cur.finalPay)+' / 지난달 '+fmt(prv.finalPay)+'\n'
        +'• 감소 원인으로 보이는 것: '+cause+'\n'
        +'근태 기록을 확인해 원인을 파악해보세요.';
      var actions=wDiff<-2
        ? ['ask:salaryCompare','nav:att','nav:sal']
        : ['ask:salaryCompare','ask:salaryAnalysis','nav:sal'];
      return { msg:msg, actions:actions };
    }},

    // 4. 급여 증가 (positive) — 전월 대비 5% 이상 증가
    { id:'salary_up', level:'positive', check: function(){
      if(typeof _hasAttendance==='function' && !_hasAttendance()) return null;
      var cur=_payNow(), prv=_payPrev();
      if(!cur||!prv||!prv.finalPay||prv.finalPay<10000) return null;
      if(cur.finalPay<=prv.finalPay*1.05) return null;
      var diff=cur.finalPay-prv.finalPay, pct=Math.round(diff/prv.finalPay*100);
      var wDiff=(cur.workDays||0)-(prv.workDays||0);
      var oDiff=(cur.totOT||0)-(prv.totOT||0);
      var reason=wDiff>1?'근무일수 +'+wDiff+'일':oDiff>3?'OT +'+oDiff+'h':'급여 조건 개선';
      var msg='🎉 예상 급여가 전월 대비 '+pct+'% ('+fmt(diff)+') 늘었어요! 🐱\n'
        +'• 이번달 '+fmt(cur.finalPay)+' / 지난달 '+fmt(prv.finalPay)+'\n'
        +'• 증가 요인: '+reason+'\n'
        +'수고하셨어요! 연간 추이도 확인해볼까요?';
      return { msg:msg, actions:['ask:salaryCompare','ask:report','nav:dash'] };
    }},

    // 5. 소비 증가 (warning) — 전월 변동지출 대비 30% 이상 증가
    { id:'spending_increase', level:'warning', check: function(){
      var b=_budget(); if(!b) return null;
      var prev=_prevVarExp();
      if(prev<50000||b.varExp<=prev*1.30) return null;
      var diff=b.varExp-prev, pct=Math.round(diff/prev*100);
      var incPct=b.income>0?Math.round(b.varExp/b.income*100):0;
      var severity=pct>80?'급격히':pct>50?'크게':'눈에 띄게';
      var msg='⚠️ 변동 지출이 전월보다 '+severity+' 늘었어요! 🐱\n'
        +'• 이번달 '+fmt(b.varExp)+' / 지난달 '+fmt(prev)+' → '+pct+'% 증가\n'
        +'• 수입 대비 변동지출 비중: '+incPct+'%\n'
        +'지출 내역에서 주요 원인을 찾아보세요.';
      var actions=incPct>40
        ? ['ask:budgetCause','ask:budgetDetail','ask:savingTip','nav:budget']
        : ['ask:budgetCause','ask:savingTip','nav:budget'];
      return { msg:msg, actions:actions };
    }},

    // 6. 연차 부족 (warning) — 잔여 3일 이하
    { id:'leave_low', level:'warning', check: function(){
      var lv=_leave(); if(!lv||lv.remain===null||lv.remain===undefined) return null;
      if(lv.remain<0||lv.remain>3) return null;
      var usedPct=lv.total>0?Math.round(lv.used/lv.total*100):0;
      var urgency=lv.remain===0?'❗ 연차가 모두 소진됐어요!':lv.remain===1?'딱 1일 남았어요':''+lv.remain+'일 남았어요';
      var msg='⚠️ 연차 잔여: '+urgency+' 🐱\n'
        +'• 사용 '+lv.used+'일 / 총 '+lv.total+'일 ('+usedPct+'% 소진)\n'
        +(lv.remain===0?'• 추가 휴가 시 무단결근 처리될 수 있어요\n':'')
        +'연말 전 남은 연차를 계획적으로 활용하는 게 좋아요.';
      var actions=lv.remain===0
        ? ['ask:leaveCheck','nav:att']
        : ['ask:leaveCheck','nav:att'];
      return { msg:msg, actions:actions };
    }},

    // 7. 근무시간 이상 (warning) — OT 40h 초과
    { id:'overtime_high', level:'warning', check: function(){
      var p=_payNow(); if(!p||(p.totOT||0)<=40) return null;
      var dailyOT=((p.totOT||0)/(p.workDays||22)).toFixed(1);
      var legal=p.totOT>52?'\n⛔ 법정 한도(월 52h) 초과 수준이에요':'';
      var msg='⚠️ 이번 달 OT '+p.totOT+'h — 과로 위험이에요! 🐱\n'
        +'• 하루 평균 OT: '+dailyOT+'h / 야간: '+(p.nightH||0)+'h\n'
        +'• OT 수당: '+fmt(p.aOT||0)+legal+'\n'
        +'몸이 자산이에요. 무리하지 마세요 🐱';
      var actions=p.totOT>52
        ? ['ask:otAnalysis','ask:salaryAnalysis','nav:att']
        : ['ask:otAnalysis','nav:att'];
      return { msg:msg, actions:actions };
    }},

    // 8. 야간근무 증가 (warning) — 전월 대비 40% 이상 증가 + 10h 초과
    { id:'night_increase', level:'warning', check: function(){
      var cur=_payNow(), prv=_payPrev();
      if(!cur||!prv) return null;
      var cn=cur.nightH||0, pn=prv.nightH||0;
      if(cn<=10||pn<=0||cn<=pn*1.40) return null;
      var diff=cn-pn, pct=Math.round(diff/pn*100);
      var nightPay=cur.aNight||0;
      var msg='⚠️ 야간근무가 전월보다 '+pct+'% ('+diff+'h) 늘었어요! 🐱\n'
        +'• 이번달 '+cn+'h / 지난달 '+pn+'h\n'
        +(nightPay>0?'• 야간수당: '+fmt(nightPay)+'\n':'')
        +'야간 패턴이 굳어지면 건강에 영향을 줄 수 있어요.';
      return { msg:msg, actions:['ask:otAnalysis','nav:att'] };
    }},

    // 9. 목표 달성 (positive) — 25일 이후 + 잔여예산 양호 + 급여 유지
    { id:'goal_achieved', level:'positive', check: function(){
      var b=_budget(); if(!b||b.dayOfMonth<25) return null;
      if(typeof _hasAttendance==='function' && !_hasAttendance()) return null;
      var cur=_payNow(), prv=_payPrev();
      if(!b.remain||b.remain<=0) return null;
      if(!cur||!prv||prv.finalPay<=0||cur.finalPay<prv.finalPay*0.95) return null;
      var saveRate=b.income>0?Math.round(b.remain/b.income*100):0;
      var total=b.fixed+b.varExp;
      var msg='🏆 이번 달 예산 관리 성공이에요! 🐱\n'
        +'• 잔여 예산: '+fmt(b.remain)+' (절약률 '+saveRate+'%)\n'
        +'• 수입 '+fmt(b.income)+' / 지출 '+fmt(total)+'\n'
        +'• 급여 '+fmt(cur.finalPay)+' 전월 수준 유지 ✅\n'
        +'이 페이스라면 다음 달도 문제없어요! 화이팅 🐱';
      return { msg:msg, actions:['ask:report','ask:nextGoal','nav:dash'] };
    }},

    // 10. 목표 실패 (warning) — 20일 이후 + 예산 초과 + OT 과다
    { id:'goal_failed', level:'warning', check: function(){
      var b=_budget(); if(!b||b.dayOfMonth<20) return null;
      var p=_payNow();
      if(b.remain>=0||!p||(p.totOT||0)<=30) return null;
      var exceed=Math.abs(b.remain), spendPct=b.income>0?Math.round((b.fixed+b.varExp)/b.income*100):0;
      var otSeverity=p.totOT>60?'심각한 과로':'과중한 OT';
      var msg='⚠️ 과로 + 예산 초과가 동시에 발생했어요! 🐱\n'
        +'• 예산 초과: '+fmt(exceed)+' / '+otSeverity+': '+p.totOT+'h\n'
        +'• 지출이 수입의 '+spendPct+'%에 달해요\n'
        +'몸과 지갑, 둘 다 쉬어가는 전략이 필요해요 🐱';
      return { msg:msg, actions:['ask:budgetCause','ask:otAnalysis','ask:savingTip','nav:budget'] };
    }}
  ];

  // ── Action 매핑 — Insight ID → 연결 Action ID 목록 ──
  var _actionMap = {
    budget_exceed:     ['ask:budgetCause', 'ask:budgetDetail', 'nav:budget'],
    budget_low:        ['ask:savingTip',   'ask:budgetDetail', 'nav:budget'],
    salary_drop:       ['ask:salaryCompare','ask:salaryAnalysis','nav:sal'],
    salary_up:         ['ask:salaryCompare','ask:report',       'nav:dash'],
    spending_increase: ['ask:budgetCause', 'ask:savingTip',    'nav:budget'],
    leave_low:         ['ask:leaveCheck',  'nav:att'],
    overtime_high:     ['ask:otAnalysis',  'ask:salaryAnalysis','nav:att'],
    night_increase:    ['ask:otAnalysis',  'nav:att'],
    goal_achieved:     ['ask:report',      'ask:nextGoal',     'nav:dash'],
    goal_failed:       ['ask:budgetCause', 'ask:savingTip',    'nav:budget'],
  };

  return {
    // 현재 상태 분석 → 우선순위 정렬된 Insight 배열 반환
    analyze: function(){
      var results = [];
      _checks.forEach(function(c){
        try {
          if(typeof AsstMemory!=='undefined' && !AsstMemory.shouldShowInsight(c.id, c.level)) return;
          var raw = c.check();
          if(!raw) return;
          // check()는 string 또는 { msg, actions } 반환 가능
          var insightMsg     = (typeof raw==='object' && raw.msg)  ? raw.msg     : raw;
          var insightActions = (typeof raw==='object' && raw.actions) ? raw.actions : (_actionMap[c.id]||[]);
          results.push({ id:c.id, level:c.level, msg:insightMsg, actions:insightActions });
        } catch(e){}
      });
      results.sort(function(a,b){
        var pa = PRIORITY[a.level]!==undefined ? PRIORITY[a.level] : 9;
        var pb = PRIORITY[b.level]!==undefined ? PRIORITY[b.level] : 9;
        return pa - pb;
      });
      return results;
    },
    // 외부에서 Insight 추가 가능. actions 배열도 함께 전달 가능
    register: function(insight){ _checks.push(insight); if(insight.actions) _actionMap[insight.id]=insight.actions; }
  };
})();

// ══════════════════════════════════════════
// ── Action Dispatcher (AI Agent 행동 연결) ──
// Insight → Action → 기존 기능 실행까지 한 흐름
// 확장: AsstActionDispatcher.register('id', { label, type, fn }) 으로 신규 Action 추가
// ══════════════════════════════════════════
var AsstActionDispatcher = (function(){
  // _navClose: 패널 닫고 탭 이동 (nav 타입)
  function _navClose(page){
    if(typeof asstOpen!=='undefined' && asstOpen && typeof toggleAsst==='function') toggleAsst();
    setTimeout(function(){ if(typeof showPage==='function') showPage(page); }, 160);
  }
  // _ask: 채팅창에 질문 입력 (ask 타입, 패널 유지)
  function _ask(q){
    if(typeof askQuick==='function') askQuick(q);
  }

  var _actions = {
    // ── 내비게이션 (nav) ──
    'nav:att':    { label:'📋 근태 보기',      type:'nav', fn:function(){ _navClose('att');    }},
    'nav:sal':    { label:'💰 급여 보기',      type:'nav', fn:function(){ _navClose('sal');    }},
    'nav:budget': { label:'🛡️ 생존관리 보기', type:'nav', fn:function(){ _navClose('budget'); }},
    'nav:dash':   { label:'📊 연간요약 보기',  type:'nav', fn:function(){ _navClose('dash');   }},

    // ── 대화형 분석 (ask) ──
    'ask:budgetCause':    { label:'원인 분석',     type:'ask', fn:function(){ _ask('이번달 예산 초과 원인이 뭐야?'); }},
    'ask:budgetDetail':   { label:'지출 내역',     type:'ask', fn:function(){ _ask('이번달 지출 내역 보여줘'); }},
    'ask:savingTip':      { label:'절약 팁',       type:'ask', fn:function(){ _ask('절약 방법 알려줘'); }},
    'ask:salaryCompare':  { label:'전월 비교',     type:'ask', fn:function(){ _ask('이번달과 지난달 급여를 비교해줘'); }},
    'ask:salaryAnalysis': { label:'급여 분석',     type:'ask', fn:function(){ _ask('이번달 급여 구성 분석해줘'); }},
    'ask:leaveCheck':     { label:'연차 확인',     type:'ask', fn:function(){ _ask('연차 몇 개 남았어?'); }},
    'ask:otAnalysis':     { label:'OT·법정 한도',   type:'ask', fn:function(){ _ask('이번달 OT 현황 알려줘'); }},
    'ask:report':         { label:'리포트 보기',   type:'ask', fn:function(){ _ask('이번달 전체 리포트 만들어줘'); }},
    'ask:monthlyReport':  { label:'월 리포트',     type:'ask', fn:function(){ _ask('이번달 전체 리포트 만들어줘'); }},
    'ask:nextGoal':       { label:'다음 목표 설정',type:'ask', fn:function(){ _ask('다음달 목표를 어떻게 세우면 좋을까?'); }},
  };

  // CSS 1회 주입
  (function(){
    if(document.getElementById('asst-action-style')) return;
    var s = document.createElement('style');
    s.id = 'asst-action-style';
    s.textContent = [
      '.asst-action-bar{display:flex;flex-wrap:wrap;gap:5px;padding:5px 8px 8px 44px;}',
      '.asst-act{font-size:11px;padding:4px 11px;border-radius:14px;border:1px solid var(--border,#3f3f46);',
        'background:var(--surface2,#27272a);color:var(--text2,#a1a1aa);cursor:pointer;',
        'transition:background .15s,border-color .15s;white-space:nowrap;line-height:1.4;}',
      '.asst-act:active{background:var(--surface3,#3f3f46);}',
      '.asst-act.t-nav{border-color:#5b8af5;color:#93c5fd;}',
      '.asst-act.t-ask{border-color:var(--border,#3f3f46);color:var(--text2,#a1a1aa);}',
    ].join('');
    document.head.appendChild(s);
  })();

  return {
    dispatch: function(id){
      var a = _actions[id];
      if(!a) return;
      // ask 타입은 AsstActionHandler 우선 (실데이터 기반 응답)
      // handle()이 false 반환 시 기존 FAQ 경로(_ask)로 fallback
      if(a.type === 'ask' && typeof AsstActionHandler !== 'undefined'){
        if(AsstActionHandler.handle(id, a.label)) return;
      }
      try{ a.fn(); }catch(e){}
    },
    getAction: function(id){ return _actions[id]||null; },
    // 확장 포인트 — 날씨·금융리포트 등 신규 Action 등록
    register: function(id, action){ _actions[id] = action; },
    // Action 버튼 DOM 생성 → asst-msgs 마지막에 추가
    renderActions: function(actionIds){
      if(!actionIds||!actionIds.length) return;
      var msgs = document.getElementById('asst-msgs');
      if(!msgs) return;
      var bar = document.createElement('div');
      bar.className = 'asst-action-bar';
      actionIds.forEach(function(id){
        var a = _actions[id]; if(!a) return;
        var btn = document.createElement('button');
        btn.className = 'asst-act t-'+(a.type||'ask');
        btn.textContent = a.label;
        btn.onclick = function(){ AsstActionDispatcher.dispatch(id); };
        bar.appendChild(btn);
      });
      msgs.appendChild(bar);
      msgs.scrollTop = msgs.scrollHeight;
    }
  };
})();

// ══════════════════════════════════════════
// ── Layer 1: Context Builders (데이터 수집 전용) ──
// 문자열·UI 생성 없이 순수 데이터 객체(JSON)만 반환
// null 반환 시 데이터 부족 → Handler가 FAQ fallback 처리
// 확장: AsstContextBuilders.myBuilder = function(){ return {...}; }
// ══════════════════════════════════════════
var AsstContextBuilders = (function(){
  // 고정비 키 → 한국어 레이블 (표시용, formatters가 소비)
  var FE_LABEL = { loan:'대출', telecom:'통신비', insurance:'보험', rent:'월세',
                   maintenance:'관리비', transport:'교통비', living:'생활비', other:'기타' };

  // 공통: 이번달 예산 기초 데이터 수집
  function _budgetBase(){
    var today = new Date(), y = today.getFullYear(), m = today.getMonth();
    var ymPfx = y + '-' + String(m+1).padStart(2,'0');
    var income = typeof getIncomeSummary==='function' ? getIncomeSummary(y,m) : null;
    var incTotal = income ? (income.total||0) : 0;
    var bs = (typeof budgetState!=='undefined' && budgetState && budgetState._loaded) ? budgetState : null;
    var fixed = bs ? Object.values(bs.fixedExpenses||{}).reduce(function(s,v){ return s+(parseInt(v)||0); },0) : 0;
    var monthVarItems = bs ? (bs.variableExpenses||[]).filter(function(e){ return e.date&&e.date.startsWith(ymPfx); }) : [];
    var varExp = monthVarItems.reduce(function(s,e){ return s+(parseInt(e.amount)||0); },0);
    return { incTotal:incTotal, fixed:fixed, varExp:varExp, remain:incTotal-fixed-varExp,
             daysLeft: new Date(y,m+1,0).getDate()-today.getDate(),
             bs:bs, monthVarItems:monthVarItems, y:y, m:m };
  }

  return {
    budgetCause: function(){
      var bd = _budgetBase();
      if(!bd.incTotal && !bd.fixed && !bd.varExp) return null;
      var varPct = bd.incTotal > 0 ? Math.round(bd.varExp/bd.incTotal*100) : 0;
      var fixedItems = bd.bs
        ? Object.entries(bd.bs.fixedExpenses||{})
            .filter(function(kv){ return parseInt(kv[1])>0; })
            .sort(function(a,b){ return (parseInt(b[1])||0)-(parseInt(a[1])||0); })
            .slice(0,3)
            .map(function(kv){ return { label:(FE_LABEL[kv[0]]||kv[0]), amount:parseInt(kv[1]) }; })
        : [];
      return { incTotal:bd.incTotal, fixed:bd.fixed, fixedItems:fixedItems,
               varExp:bd.varExp, varPct:varPct, remain:bd.remain,
               daysLeft:bd.daysLeft, isExceeded:bd.remain<0,
               dailyCut:bd.daysLeft>0 ? Math.round(Math.abs(bd.remain)/bd.daysLeft) : 0 };
    },

    budgetDetail: function(){
      var bd = _budgetBase();
      if(!bd.bs) return null;
      var fixedItems = Object.entries(bd.bs.fixedExpenses||{})
        .filter(function(kv){ return parseInt(kv[1])>0; })
        .sort(function(a,b){ return (parseInt(b[1])||0)-(parseInt(a[1])||0); })
        .map(function(kv){ return { label:(FE_LABEL[kv[0]]||kv[0]), amount:parseInt(kv[1]) }; });
      var sorted = bd.monthVarItems.slice()
        .sort(function(a,b){ return (parseInt(b.amount)||0)-(parseInt(a.amount)||0); });
      var varItems = sorted.slice(0,5)
        .map(function(e){ return { label:(e.memo||e.cat||'기타'), amount:parseInt(e.amount)||0 }; });
      return { fixed:bd.fixed, fixedItems:fixedItems,
               varExp:bd.varExp, varItems:varItems,
               varCount:bd.monthVarItems.length,
               moreCount:Math.max(0, bd.monthVarItems.length-5) };
    },

    savingTip: function(){
      var bd = _budgetBase();
      if(!bd.incTotal) return null;
      var dailyBudget = bd.daysLeft > 0 ? Math.round(bd.remain/bd.daysLeft) : 0;
      var situation = bd.remain < 0 ? 'exceeded' : bd.remain < 50000 ? 'tight' : 'ok';
      return { incTotal:bd.incTotal, varExp:bd.varExp, remain:bd.remain,
               daysLeft:bd.daysLeft, dailyBudget:dailyBudget,
               targetVarNextMonth:Math.round(bd.varExp*0.8), situation:situation };
    },

    salaryCompare: function(){
      var d = (typeof getPayData==='function') ? getPayData() : null;
      if(!d) return null;
      var today = new Date(), y=today.getFullYear(), m=today.getMonth();
      var selJobs = (typeof loadSelectedJobs==='function') ? loadSelectedJobs() : [];
      var isEmp = selJobs.indexOf('employee') >= 0;
      var income = typeof getIncomeSummary==='function' ? getIncomeSummary(y,m) : null;
      var currPay = isEmp ? (d.finalPay||0) : (income ? income.total : 0);
      var snap = (typeof AsstMemory!=='undefined') ? AsstMemory.getSnap('sal') : null;
      var prevData = snap ? snap.data : null;
      var prevPay = prevData ? (isEmp ? (prevData.finalPay||0) : (prevData.income||prevData.finalPay||0)) : 0;
      var diff = currPay - prevPay;
      var pct = prevPay > 0 ? Math.round(Math.abs(diff)/prevPay*100) : 0;
      var currOT = d.totOT||0, prevOT = prevData ? (prevData.totOT||0) : 0;
      return { currPay:currPay, prevPay:prevPay, diff:diff, pct:pct,
               currOT:currOT, prevOT:prevOT, otDiff:currOT-prevOT,
               hasPrev:prevPay>0, isSame:prevPay>0&&prevPay===currPay };
    },

    salaryAnalysis: function(){
      var d = (typeof getPayData==='function') ? getPayData() : null;
      if(!d || (!d.grossPay && !d.finalPay)) return null;
      var allows = [];
      if(d.aOT > 0)      allows.push({ label:'OT',   amount:d.aOT });
      if(d.aNight > 0)   allows.push({ label:'야간',  amount:d.aNight });
      if(d.aHoliday > 0) allows.push({ label:'휴일',  amount:d.aHoliday });
      var deducts = [];
      if(d.ins && d.ins.total > 0) deducts.push({ label:'4대보험', amount:d.ins.total });
      if(d.tax && d.tax.total > 0) deducts.push({ label:'세금',    amount:d.tax.total });
      var totalDeduct = deducts.reduce(function(s,i){ return s+i.amount; },0);
      var deductPct = d.grossPay > 0 ? Math.round(totalDeduct/d.grossPay*100) : 0;
      return { basePay:d.basePay||0, allows:allows, grossPay:d.grossPay||0,
               deducts:deducts, finalPay:d.finalPay||0, deductPct:deductPct };
    },

    leaveCheck: function(){
      var d = (typeof getPayData==='function') ? getPayData() : null;
      if(!d) return null;
      var usedLeave = (d.lDays||0) + (d.halfDays||0)*0.5;
      var override = (typeof leaveOverride!=='undefined') ? leaveOverride : null;
      var al = (typeof calcAnnualLeave==='function') ? calcAnnualLeave() : null;
      var totalLeave = override !== null ? override : (al ? al.totalLeave : null);
      if(totalLeave === null) return null;
      var remaining = totalLeave - usedLeave;
      var usedPct = totalLeave > 0 ? Math.round(usedLeave/totalLeave*100) : 0;
      return { totalLeave:totalLeave, usedLeave:usedLeave,
               lDays:d.lDays||0, halfDays:d.halfDays||0,
               remaining:remaining, usedPct:usedPct,
               nextInfo:al?(al.nextInfo||null):null,
               isManual:override!==null,
               monthsLeft:12-new Date().getMonth() };
    },

    otAnalysis: function(){
      var d = (typeof getPayData==='function') ? getPayData() : null;
      if(!d) return null;
      var totOT = d.totOT||0, wDays = d.wDays||d.workDays||0;
      var legalPct = Math.round(totOT/52*100);
      return { totOT:totOT, nightH:d.nightH||0, aOT:d.aOT||0, aNight:d.aNight||0,
               wDays:wDays, dailyAvgOT:wDays>0 ? parseFloat((totOT/wDays).toFixed(1)) : 0,
               legalPct:legalPct, isExceeded:totOT>=52, isWarning:totOT>=40&&totOT<52 };
    },

    report: function(){
      var bd = _budgetBase();
      var d = (typeof getPayData==='function') ? getPayData() : null;
      var hasAtt = (typeof _hasAttendance==='function') ? _hasAttendance() : true;
      // 출근 기록이 없으면 incTotal에 섞여 있는 직장인 기본급 추정치(=finalPay)만큼 제외
      // (프리랜서·배달·알바 등 다른 수입원은 그대로 유지 — budget.js:849 employee=pd.finalPay 합산 구조 보정)
      // ★ getPayData()는 직업 유형과 무관하게 호출되므로, employee가 선택된 경우에만 차감
      var _selJobsReport = (typeof loadSelectedJobs==='function') ? loadSelectedJobs() : [];
      var empContribution = (d && !hasAtt && _selJobsReport.indexOf('employee')>=0) ? (d.finalPay||0) : 0;
      var incTotal = Math.max(0, bd.incTotal - empContribution);
      var remain = incTotal - bd.fixed - bd.varExp;
      return { mName:(bd.m+1)+'월', incTotal:incTotal,
               finalPay:(d&&hasAtt)?(d.finalPay||null):null, hasAttendance:hasAtt,
               fixed:bd.fixed, varExp:bd.varExp, varCount:bd.monthVarItems.length,
               remain:remain, budgetOk:remain>=0,
               wDays:d?(typeof d.wDays==='number'?d.wDays:null):null, totOT:d?(d.totOT||0):null,
               nightH:d?(d.nightH||0):null,
               lDays:d?(d.lDays||null):null, halfDays:d?(d.halfDays||0):null,
               otExceeded:!!(d&&d.totOT>=52), otWarning:!!(d&&d.totOT>=40&&d.totOT<52) };
    },

    nextGoal: function(){
      var bd = _budgetBase();
      if(!bd.incTotal) return null;
      var saveRate = Math.round(bd.remain/bd.incTotal*100);
      var situation = bd.remain < 0 ? 'exceeded' : saveRate < 10 ? 'low' : 'ok';
      var targetSave = situation==='low' ? Math.round(bd.incTotal*0.1) : 0;
      var nextSaveRate = situation==='ok' ? Math.min(saveRate+5, 30) : 0;
      return { incTotal:bd.incTotal, fixed:bd.fixed, varExp:bd.varExp, remain:bd.remain,
               saveRate:saveRate, targetVarNext:Math.round(bd.varExp*0.8),
               targetSave:targetSave, nextSaveRate:nextSaveRate, situation:situation };
    }
  };
})();

// ══════════════════════════════════════════
// ── Layer 2: Context Formatters (문장 생성 전용) ──
// Builder 데이터 객체를 받아 사용자에게 보여줄 문자열 반환
// 계산 로직 없음 — 데이터를 한국어 문장으로만 변환
// 확장: AsstContextFormatters.myFormat = function(data){ return '...'; }
// ══════════════════════════════════════════
var AsstContextFormatters = (function(){
  function f(n){ return Math.round(n).toLocaleString('ko-KR')+'원'; }

  return {
    budgetCause: function(d){
      var L = ['📊 이번달 예산 원인 분석이에요 🐱'];
      L.push('• 수입: ' + f(d.incTotal));
      if(d.fixedItems && d.fixedItems.length){
        var items = d.fixedItems.map(function(i){ return i.label+' '+f(i.amount); }).join(' / ');
        L.push('• 고정비: '+f(d.fixed)+'\n  ('+items+')');
      } else {
        L.push('• 고정비: '+f(d.fixed));
      }
      L.push('• 변동비: '+f(d.varExp)+' (수입의 '+d.varPct+'%)');
      L.push('• 잔여: '+(d.isExceeded ? '-'+f(Math.abs(d.remain))+' 초과' : f(d.remain)+' 남음'));
      if(d.isExceeded){
        L.push('\n→ '+(d.varExp>d.fixed
          ? '변동비가 고정비보다 '+f(d.varExp-d.fixed)+' 많아요'
          : '고정비·변동비 합계가 수입을 초과했어요'));
        if(d.daysLeft > 0)
          L.push('→ 남은 '+d.daysLeft+'일, 하루 '+f(d.dailyCut)+' 절약 필요');
      } else {
        L.push('\n→ 아직 예산 내 관리 중이에요. 남은 '+f(d.remain)+' 계획적으로 써보세요');
      }
      return L.join('\n');
    },

    budgetDetail: function(d){
      var L = ['💳 이번달 지출 내역이에요 🐱'];
      L.push('\n[고정비] '+f(d.fixed));
      if(d.fixedItems.length === 0){
        L.push('• 고정비가 아직 설정되지 않았어요');
      } else {
        d.fixedItems.forEach(function(i){ L.push('• '+i.label+': '+f(i.amount)); });
      }
      L.push('\n[변동비] '+f(d.varExp)+' ('+d.varCount+'건)');
      if(d.varCount === 0){
        L.push('• 이번달 기록된 변동 지출이 없어요');
      } else {
        d.varItems.forEach(function(i){ L.push('• '+i.label+': '+f(i.amount)); });
        if(d.moreCount > 0) L.push('  …외 '+d.moreCount+'건');
      }
      L.push('\n합계: '+f(d.fixed+d.varExp));
      return L.join('\n');
    },

    savingTip: function(d){
      var L = ['💡 현재 상황 기반 절약 팁이에요 🐱'];
      L.push('• 잔여 예산: '+(d.remain<0 ? '-'+f(Math.abs(d.remain))+' (초과)' : f(d.remain)));
      if(d.daysLeft > 0)
        L.push('• 남은 '+d.daysLeft+'일 하루 한도: '+(d.dailyBudget<0 ? '-'+f(Math.abs(d.dailyBudget)) : f(d.dailyBudget)));
      L.push('');
      if(d.situation === 'exceeded'){
        L.push('→ 변동 지출을 지금 당장 멈춰야 해요');
        L.push('→ 고정비 중 통신비·보험 재검토를 권장해요');
        L.push('→ 다음달 변동비 목표: '+f(d.targetVarNextMonth)+' (20% 감소)');
      } else if(d.situation === 'tight'){
        L.push('→ 남은 예산이 빠듯해요. 꼭 필요한 지출만 하세요');
        L.push('→ 남은 '+f(d.remain)+'을 비상금으로 남겨두는 것도 좋아요');
      } else {
        L.push('→ 남은 '+f(d.remain)+'의 절반('+f(Math.round(d.remain*0.5))+')을 저축해보세요');
        L.push('→ 변동비를 카테고리별로 기록하면 절약 패턴이 보여요');
      }
      return L.join('\n');
    },

    salaryCompare: function(d){
      var L = ['💰 급여 전월 비교예요 🐱'];
      L.push('• 이번달 예상: '+f(d.currPay));
      if(!d.hasPrev){
        L.push('\n→ 지난달 급여 기록이 없어요. 급여 탭 방문 시 자동 저장돼요');
      } else if(d.isSame){
        L.push('• 지난달과 동일해요');
        L.push('\n→ 꾸준한 수입! 이 페이스를 유지해요 🐱');
      } else {
        var sign = d.diff >= 0 ? '+' : '-';
        L.push('• 지난달 기록: '+f(d.prevPay));
        L.push('• 차이: '+sign+f(Math.abs(d.diff))+' ('+(d.diff>=0?'+':'')+d.pct+'%)');
        if(Math.abs(d.otDiff) >= 2)
          L.push('• OT: 이번달 '+d.currOT+'h / 지난달 '+d.prevOT+'h ('+(d.otDiff>0?'+':'')+d.otDiff+'h)');
        L.push('\n→ '+(d.diff>=0 ? '급여가 늘었어요! 저축에 활용해보세요 🎉' : '급여가 줄었어요. 근태 기록을 확인해보세요'));
      }
      return L.join('\n');
    },

    salaryAnalysis: function(d){
      var L = ['🧮 이번달 급여 구성이에요 🐱'];
      if(d.basePay > 0) L.push('• 기본급: '+f(d.basePay));
      if(d.allows.length)
        L.push('• 수당: '+d.allows.map(function(i){ return i.label+' '+f(i.amount); }).join(' / '));
      L.push('• 세전: '+f(d.grossPay));
      if(d.deducts.length)
        L.push('• 공제: '+d.deducts.map(function(i){ return i.label+' -'+f(i.amount); }).join(' / '));
      L.push('• 실수령: '+f(d.finalPay));
      L.push('\n→ 공제율 '+d.deductPct+'% — '+(d.deductPct>15?'비중이 높은 편이에요':'일반적인 수준이에요'));
      return L.join('\n');
    },

    leaveCheck: function(d){
      var L = ['🌿 연차 현황이에요 🐱'];
      L.push('• 총 연차: '+d.totalLeave+'일');
      L.push('• 사용: '+d.usedLeave+'일 (연차 '+d.lDays+'일 + 반차 '+d.halfDays+'회)');
      L.push('• 잔여: '+d.remaining+'일 ('+d.usedPct+'% 소진)');
      if(d.nextInfo) L.push('• '+d.nextInfo);
      if(d.remaining <= 0){
        L.push('\n⚠️ 연차가 모두 소진됐어요');
        L.push('→ 추가 휴가 시 무급 처리될 수 있어요. 근태 탭에서 확인해보세요');
      } else if(d.remaining === 1){
        L.push('\n→ 딱 1일 남았어요. '+d.monthsLeft+'개월 안에 사용하지 않으면 소멸돼요');
      } else if(d.remaining <= 3){
        L.push('\n→ '+d.remaining+'일 남았어요. '+d.monthsLeft+'개월 안에 계획적으로 사용해보세요');
      } else {
        L.push('\n→ 여유 있게 남아 있어요 🐱 계획적으로 활용해보세요');
      }
      if(d.isManual) L.push('※ 직접 설정한 연차 기준이에요');
      return L.join('\n');
    },

    otAnalysis: function(d){
      var L = ['⏰ 이번달 OT 현황이에요 🐱'];
      if(d.totOT === 0){
        L.push('• 아직 이번달 OT 기록이 없어요');
        L.push('\n→ 근태 탭에서 초과근무를 입력하면 OT 수당이 자동 계산돼요');
        return L.join('\n');
      }
      L.push('• 총 OT: '+d.totOT+'h');
      if(d.wDays > 0) L.push('• 하루 평균: '+d.dailyAvgOT+'h');
      L.push('• OT 수당: '+f(d.aOT));
      if(d.nightH > 0) L.push('• 야간: '+d.nightH+'h / 수당: '+f(d.aNight));
      if(d.isExceeded){
        L.push('\n⛔ 법정 한도(월 52h) '+(d.totOT-52)+'h 초과 — 건강에 주의하세요');
      } else if(d.isWarning){
        L.push('\n⚠️ 법정 한도(52h)의 '+d.legalPct+'% — 속도 조절이 필요해요');
      } else {
        L.push('\n→ 법정 한도 내 관리 중 ('+d.legalPct+'%) — 양호해요');
      }
      return L.join('\n');
    },

    monthlyReport: function(d){
      var L = ['📋 '+d.mName+' 전체 리포트예요 🐱'];
      L.push('\n[💰 수입]');
      if(d.incTotal > 0){
        L.push('• 예상 수입: '+f(d.incTotal));
        if(d.finalPay && d.finalPay !== d.incTotal) L.push('• 실수령액: '+f(d.finalPay));
      } else {
        L.push('• 예상 수입: 미설정 (급여 탭에서 입력해보세요)');
      }
      L.push('\n[🛡️ 예산]');
      L.push('• 고정비: '+f(d.fixed)+' / 변동비: '+f(d.varExp)+' ('+d.varCount+'건)');
      L.push('• 잔여: '+(d.budgetOk ? f(d.remain)+' 남음' : '-'+f(Math.abs(d.remain))+' 초과 ⚠️'));
      if(d.wDays !== null){
        L.push('\n[📋 근태]');
        L.push('• 근무 '+d.wDays+'일 / OT '+(d.totOT||0)+'h / 야간 '+(d.nightH||0)+'h');
        if(d.lDays !== null) L.push('• 연차 '+d.lDays+'일 사용 / 반차 '+(d.halfDays||0)+'회');
      }
      L.push('\n[총평]');
      L.push('→ '+(d.budgetOk?'✅ 예산 양호':'⚠️ 예산 초과')
             +(d.otExceeded?' / ⛔ OT 한도 초과':d.otWarning?' / ⚠️ OT 주의':''));
      return L.join('\n');
    },

    nextGoal: function(d){
      var L = ['🎯 다음달 목표 제안이에요 🐱'];
      L.push('• 이번달 잔여: '+(d.remain>=0 ? f(d.remain)+' (절약률 '+d.saveRate+'%)' : '-'+f(Math.abs(d.remain))+' 초과'));
      L.push('• 이번달 변동비: '+f(d.varExp));
      L.push('');
      if(d.situation === 'exceeded'){
        L.push('→ 다음달 변동비 목표: '+f(d.targetVarNext)+' (20% 감소)');
        L.push('→ 초과분 '+f(Math.abs(d.remain))+' 만큼 추가 절약 필요');
      } else if(d.situation === 'low'){
        L.push('→ 저축 목표: '+f(d.targetSave)+' (수입의 10%)');
        L.push('→ 변동비를 줄여 여유분을 확보해보세요');
      } else {
        L.push('→ 이 페이스 유지하면 다음달도 좋아요!');
        L.push('→ 저축 목표를 '+d.nextSaveRate+'%로 높여봐요: '+f(Math.round(d.incTotal*d.nextSaveRate/100)));
      }
      return L.join('\n');
    }
  };
})();

// ══════════════════════════════════════════
// ── Layer 3: Action Handler (조율 전용) ──
// Builder → Formatter → addBotMsg() 흐름 조율
// 계산 없음, 문장 생성 없음 — 오케스트레이션만 담당
// Fallback: handle()이 false 반환 시 _ask() → callClaude() FAQ 경로
// 확장: AsstActionHandler.register('ask:id', buildFn, formatFn)
// ══════════════════════════════════════════
var AsstActionHandler = (function(){
  // actionId → { build: BuilderKey, format: FormatterKey }
  var _map = {
    'ask:budgetCause':    { build:'budgetCause',    format:'budgetCause'    },
    'ask:budgetDetail':   { build:'budgetDetail',   format:'budgetDetail'   },
    'ask:savingTip':      { build:'savingTip',      format:'savingTip'      },
    'ask:salaryCompare':  { build:'salaryCompare',  format:'salaryCompare'  },
    'ask:salaryAnalysis': { build:'salaryAnalysis', format:'salaryAnalysis' },
    'ask:leaveCheck':     { build:'leaveCheck',     format:'leaveCheck'     },
    'ask:otAnalysis':     { build:'otAnalysis',     format:'otAnalysis'     },
    'ask:report':         { build:'report',         format:'monthlyReport'  },
    'ask:nextGoal':       { build:'nextGoal',       format:'nextGoal'       },
  };

  return {
    // true: 데이터 기반 응답 완료 / false: 데이터 부족 → FAQ fallback
    handle: function(actionId, label){
      var pair = _map[actionId];
      if(!pair) return false;
      try {
        var data = AsstContextBuilders[pair.build]();
        if(!data) return false;
        var msg  = AsstContextFormatters[pair.format](data);
        if(!msg)  return false;
        addUserMsg(label || actionId);
        addBotMsg(msg);
        if(typeof AsstMemory !== 'undefined') AsstMemory.recordQA(label||actionId, msg);
        return true;
      } catch(e){ return false; }
    },
    // 신규 Action 등록: Builder/Formatter를 외부 모듈에 직접 추가 후 매핑
    register: function(id, buildKey, formatKey){
      _map[id] = { build:buildKey, format:formatKey };
    }
  };
})();

// ── FAB 가시성 관리 ──
// 전체화면 오버레이(온보딩/모달)가 열릴 때 FAB를 숨기고, 닫히면 다시 표시
function initAsstFabVisibility(){
  // 온보딩: class 기반(show 클래스), 나머지: style.display 기반
  const classOverlays = ['onboarding-overlay'];
  const styleOverlays = ['manual-overlay','ui-guide-overlay','reset-confirm-overlay','generic-confirm-overlay','leave-note-overlay'];

  function isFabShouldHide(){
    for(const id of classOverlays){
      const el = document.getElementById(id);
      if(el && el.classList.contains('show')) return true;
    }
    for(const id of styleOverlays){
      const el = document.getElementById(id);
      if(el && window.getComputedStyle(el).display !== 'none') return true;
    }
    return false;
  }

  function applyFabVisibility(){
    const hide = isFabShouldHide();
    const btn    = document.getElementById('asst-btn');
    const bubble = document.getElementById('asst-bubble');
    const panel  = document.getElementById('asst-panel');
    if(btn)    btn.style.visibility    = hide ? 'hidden' : '';
    if(bubble) bubble.style.visibility = hide ? 'hidden' : '';
    // 오버레이 열릴 때 패널도 닫기
    if(hide && asstOpen) toggleAsst();
  }

  const obs = new MutationObserver(applyFabVisibility);
  // class 기반 오버레이 감시
  classOverlays.forEach(id=>{
    const el = document.getElementById(id);
    if(el) obs.observe(el, {attributes:true, attributeFilter:['class']});
  });
  // style 기반 오버레이 감시
  styleOverlays.forEach(id=>{
    const el = document.getElementById(id);
    if(el) obs.observe(el, {attributes:true, attributeFilter:['style']});
  });

  applyFabVisibility(); // 초기 상태 반영
}

// ══════════════════════════════════════════
// v2.4.2: SAO 날씨 질의 — 챗봇에서 "오늘/내일/이번 주/주말/출근길/퇴근길 날씨" 질문 처리
// 기존 Open-Meteo API 재사용(별도 캐시 키), 직업·근무 일정과 연결한 SAO 답변
// ══════════════════════════════════════════
var AsstWeatherQuery = (function(){
  var CK = 'atm2_wx_forecast', TTL = 30*60*1000;
  var WMO_S = {0:'맑음',1:'대체로 맑음',2:'구름 조금',3:'흐림',45:'안개',48:'안개',
    51:'이슬비',53:'이슬비',55:'이슬비',61:'비',63:'비',65:'폭우',66:'진눈깨비',67:'진눈깨비',
    71:'눈',73:'눈',75:'폭설',77:'눈',80:'소나기',81:'소나기',82:'강한 소나기',
    85:'눈',86:'폭설',95:'뇌우',96:'뇌우',99:'뇌우'};
  function _txt(c){ return WMO_S[c]||'날씨 정보'; }
  function _icon(c){
    if(c===0||c===1) return '☀️'; if(c===2) return '⛅'; if(c===3) return '☁️';
    if(c===45||c===48) return '🌫️';
    if((c>=71&&c<=77)||c===85||c===86) return '❄️';
    if(c>=95) return '⛈️'; if(c>=51) return '🌧️'; return '🌡️';
  }
  function _isWet(c){ return c>=51; }

  function _load(){
    try{ var d=JSON.parse(localStorage.getItem(CK)||'null'); if(d && Date.now()-d.ts<TTL) return d; }catch(e){}
    return null;
  }
  function _fetch(){
    var c=_load(); if(c) return Promise.resolve(c);
    return new Promise(function(res, rej){
      if(!navigator.geolocation) return rej('NO_GEO');
      navigator.geolocation.getCurrentPosition(function(pos){
        var lat=pos.coords.latitude.toFixed(4), lon=pos.coords.longitude.toFixed(4);
        fetch('https://api.open-meteo.com/v1/forecast?latitude='+lat+'&longitude='+lon
          +'&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max'
          +'&hourly=precipitation_probability,weather_code'
          +'&timezone=Asia%2FSeoul&forecast_days=7')
        .then(function(r){ return r.ok ? r.json() : Promise.reject('HTTP'); })
        .then(function(j){
          var d = { daily:j.daily, hourly:j.hourly, ts:Date.now() };
          try{ localStorage.setItem(CK, JSON.stringify(d)); }catch(e){}
          res(d);
        }).catch(rej);
      }, function(){ rej('GEO_DENY'); }, {timeout:10000, maximumAge:300000});
    });
  }

  // ── 자연어 파싱 (msg는 공백 제거·소문자) ──
  function match(msg){
    if(/날씨/.test(msg)) return true;
    if(/(오늘|내일|모레|주말|이번주)(비|눈)(와|올|오|내려)/.test(msg)) return true;
    if(/(비|눈)(와\?|올까|오나|와$|옴\?)/.test(msg)) return true;
    if(/우산(챙|필요|가져)/.test(msg)) return true;
    return false;
  }
  function parse(msg){
    var rainOnly = /비|눈|우산/.test(msg) && !/날씨/.test(msg);
    if(/출근길|출근.*날씨/.test(msg)) return { kind:'am', rainOnly:false };
    if(/퇴근길|퇴근.*날씨/.test(msg)) return { kind:'pm', rainOnly:false };
    if(/주말/.test(msg)) return { kind:'weekend', rainOnly:rainOnly };
    if(/이번주|일주일|주간/.test(msg)) return { kind:'week', rainOnly:rainOnly };
    if(/모레/.test(msg)) return { kind:'d2', rainOnly:rainOnly };
    if(/내일/.test(msg)) return { kind:'tomorrow', rainOnly:rainOnly };
    return { kind:'today', rainOnly:rainOnly };
  }

  // ── 머니냥 데이터: 직업 / 특정일 근무 일정 ──
  function _jobs(){ return (typeof loadSelectedJobs==='function') ? loadSelectedJobs() : []; }
  function _hasWorkOn(d){
    try{
      if(typeof _attV3Rec!=='function') return false;
      var r = _attV3Rec(d);
      return !!(r && r.status && r.status!=='none' && r.status!=='leave' && r.status!=='absent');
    }catch(e){ return false; }
  }
  function _jobTail(wet){
    var jobs = _jobs();
    var isDelivery = jobs.some(function(j){ return j==='delivery'||j==='driver'; });
    var isOffice = jobs.indexOf('employee')>=0 || jobs.indexOf('salary')>=0;
    var isFree = jobs.indexOf('freelancer')>=0;
    if(isDelivery) return wet
      ? '🛵 비 오는 날은 우천 할증이 붙는 경우가 많아요. 할증 여부 확인하시고, 오늘은 특히 안전운행이 최우선이에요!'
      : '🛵 운행하기 좋은 날씨예요. 오늘도 안전운행 하세요!';
    if(isOffice) return wet
      ? '☔ 우산 꼭 챙기시고, 출퇴근길 조금 여유 있게 나서세요!'
      : '👔 출퇴근하기 좋은 날씨예요. 오늘도 화이팅!';
    if(isFree) return wet
      ? '💻 이런 날은 실내 작업이 최고죠. 야외 미팅이 있다면 일정 조정도 고려해보세요.'
      : '☀️ 야외 미팅 일정이 있다면 딱 좋은 날씨예요!';
    return wet ? '☔ 나가실 일이 있다면 우산 꼭 챙기세요!' : '오늘도 좋은 하루 보내세요! 🐱';
  }
  function _dayLine(fc, i, label){
    var c = fc.daily.weather_code[i], p = fc.daily.precipitation_probability_max[i];
    return _icon(c)+' '+label+': '+_txt(c)+', '+Math.round(fc.daily.temperature_2m_min[i])+'~'
      +Math.round(fc.daily.temperature_2m_max[i])+'도'+(p>=40?' (강수확률 '+p+'%)':'');
  }
  function _hourWindow(fc, dayOffset, h1, h2){
    // hourly 배열은 0시부터 1시간 간격 (7일치)
    var maxP = 0, wet = false, code = 0;
    for(var h=h1; h<=h2; h++){
      var idx = dayOffset*24 + h;
      if(idx >= fc.hourly.precipitation_probability.length) break;
      var p = fc.hourly.precipitation_probability[idx]||0;
      if(p > maxP){ maxP = p; code = fc.hourly.weather_code[idx]; }
      if(_isWet(fc.hourly.weather_code[idx])){ wet = true; code = fc.hourly.weather_code[idx]; }
    }
    return { maxP:maxP, wet:wet||maxP>=60, code:code };
  }

  function answer(wq){
    return _fetch().then(function(fc){
      var nick = (typeof memName!=='undefined' && memName) ? memName+'님, ' : '';
      var t = new Date();
      var L = [];

      if(wq.kind==='today' || wq.kind==='tomorrow' || wq.kind==='d2'){
        var i = wq.kind==='today'?0:(wq.kind==='tomorrow'?1:2);
        var label = i===0?'오늘':(i===1?'내일':'모레');
        var c = fc.daily.weather_code[i], p = fc.daily.precipitation_probability_max[i];
        var wet = _isWet(c) || p>=60;
        if(wq.rainOnly){
          if(wet) L.push(nick+label+'은 '+_icon(c)+' '+_txt(c)+' 예보가 있어요. 강수확률 '+p+'%!');
          else if(p>=40) L.push(nick+label+'은 강수확률 '+p+'%로 애매한 하늘이에요. 접는 우산 하나 챙기면 안심!');
          else L.push(nick+label+'은 비 걱정 없어요! ☀️ 강수확률 '+p+'%예요.');
        } else {
          L.push(nick+_dayLine(fc, i, label));
        }
        var target = new Date(t.getFullYear(), t.getMonth(), t.getDate()+i);
        if(i>0 && _hasWorkOn(target)) L.push('📅 '+label+'은 근무 일정이 등록되어 있어요.');
        L.push(_jobTail(wet));
      }

      if(wq.kind==='am' || wq.kind==='pm'){
        var isAm = wq.kind==='am';
        // 오후에 출근길을 물으면 내일 아침 기준으로 답변
        var dayOff = (isAm && t.getHours()>=12) ? 1 : 0;
        var w = isAm ? _hourWindow(fc, dayOff, 6, 9) : _hourWindow(fc, dayOff, 17, 20);
        var when = (dayOff?'내일 ':'오늘 ')+(isAm?'출근길(6~9시)':'퇴근길(17~20시)');
        if(w.wet) L.push(nick+'☔ '+when+'에 비 소식이 있어요. 강수확률 최대 '+w.maxP+'%!');
        else if(w.maxP>=40) L.push(nick+when+' 강수확률이 '+w.maxP+'%예요. 우산 하나 챙기면 든든해요.');
        else L.push(nick+when+'은 '+_icon(fc.daily.weather_code[dayOff])+' 무난해요! 강수확률 '+w.maxP+'%.');
        L.push(_jobTail(w.wet));
      }

      if(wq.kind==='week' || wq.kind==='weekend'){
        var anyWet = false;
        if(wq.kind==='week'){
          L.push(nick+'이번 주 날씨를 정리해봤어요!');
          var names = ['일','월','화','수','목','금','토'];
          for(var k=0;k<7;k++){
            var dd = new Date(t.getFullYear(), t.getMonth(), t.getDate()+k);
            var lb = k===0?'오늘':(k===1?'내일':names[dd.getDay()]+'요일');
            L.push(_dayLine(fc, k, lb));
            if(_isWet(fc.daily.weather_code[k])||fc.daily.precipitation_probability_max[k]>=60) anyWet = true;
          }
        } else {
          L.push(nick+'다가오는 주말 날씨예요!');
          var found = 0;
          for(var k2=0;k2<7 && found<2;k2++){
            var d2 = new Date(t.getFullYear(), t.getMonth(), t.getDate()+k2);
            if(d2.getDay()===6 || d2.getDay()===0){
              L.push(_dayLine(fc, k2, d2.getDay()===6?'토요일':'일요일'));
              if(_isWet(fc.daily.weather_code[k2])||fc.daily.precipitation_probability_max[k2]>=60) anyWet = true;
              found++;
            }
          }
        }
        L.push(anyWet ? '☔ 비 오는 날이 있으니 일정 잡을 때 참고하세요!' : '☀️ 대체로 무난한 하늘이에요.');
        L.push(_jobTail(anyWet));
      }

      return L.join('\n');
    });
  }

  return { match:match, parse:parse, answer:answer };
})();
