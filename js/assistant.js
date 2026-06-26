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
  if(asstOpen && document.getElementById('asst-msgs').children.length===0){
    if(!onboardingDone && !memName){
      onboardingStep = 1;
      addBotMsg('안녕하세요! 저는 머니냥이에요 🐱\n\n더 친근하게 도와드리려고요,\n어떻게 불러드릴까요? 이름이나 닉네임을 알려주세요!\n예) "민준이야" / "지수라고 불러줘"');
    } else {
      const alert = getSmartAlert();
      addBotMsg(alert.msg);
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
  {q:"주휴수당은 어떤 조건에서 받을 수 있어",a:"일반적으로 주 15시간 이상 일하고, 그 주에 결근 없이 개근하면 발생하는 경우가 많아. 아르바이트도 동일하게 적용될 수 있어서 조건 맞으면 꼭 챙겨보는 게 좋아. 급여관리 탭에서 주휴수당 ON 켜면 자동으로 계산해줘. ※ 실제 적용은 고용 형태에 따라 달라질 수 있어.",cat:"근태"},
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
  {q:"이번 달 실수령액이 얼마야",a:"상단 '💰 급여관리' 탭 누르면 4대보험이랑 세금 공제 후 예상 실수령액이 크게 표시돼. 출퇴근 기록 다 입력했으면 자동으로 계산해줘. ※ 참고용 수치이니 실제 명세서랑 비교해봐.",cat:"급여"},
  {q:"시급 설정은 어디서 해",a:"급여관리 탭 → '📌 기본급' 섹션에서 ① 법정 최저시급이랑 ② 회사 실제 시급 따로 입력할 수 있어. 기본급은 법정 시급으로, OT·야간 수당은 실제 시급으로 계산되니까 다르면 둘 다 입력해야 더 정확해.",cat:"급여"},
  {q:"4대보험이 너무 많이 나가는 것 같아",a:"국민연금 4.5%, 건강보험 3.545%, 장기요양보험, 고용보험 0.9% — 합치면 총급여의 약 9% 정도 나가. 세전 총급여가 높을수록 공제액도 올라가. 실제 명세서랑 다르면 급여관리 탭에서 직접 수정 가능해.\n\n⚠️ 4대보험 기준은 회사 정책에 따라 다를 수 있어. 정확한 확인은 노무사(1350) 상담을 받아봐.",cat:"급여"},
  {q:"OT 수당 계산이 맞는지 확인하고 싶어",a:"달력 날짜 눌러서 시간 보면 팝업에 연장수당 계산식이 바로 나와. 'OT X시간 × 시급 × 1.5 = 얼마' 형식으로 보여줘. 매달 급여관리 탭 '💎 추가 수당' 섹션에서 전체 OT 수당도 확인할 수 있어. ※ 앱 계산은 참고용이야.",cat:"급여"},
  {q:"전월이랑 이번달 급여 차이 보고 싶어",a:"급여관리 탭 열면 상단에 '📊 전월 대비' 카드가 자동으로 나와. 저번 달보다 얼마 더 받는지 ▲▼ 표시로 바로 보여줘. 두 달치 기록이 있어야 비교가 되니까 꾸준히 기록해두면 좋아.",cat:"급여"},
  {q:"점심시간은 급여에서 빠지나",a:"맞아, 점심 1시간은 무급 휴게시간으로 자동 공제돼. 야간이나 장시간 근무 시에는 저녁 0.5시간도 추가 공제돼. 설정에서 점심 공제 시간을 조정할 수도 있어.",cat:"급여"},
  {q:"기본급 209시간이 뭐야",a:"한 달 유급 근로시간이야. 실제 근무일과 주휴일(주휴수당 포함)을 합친 시간이 약 209시간이 돼. 이게 기본급 계산 기준이라서 시급 × 209h = 기본급이야. 법정 최저시급 기준으로 계산해줘. ※ 참고용 수치야.",cat:"급여"},
  {q:"명세서 출력할 수 있어",a:"급여관리 탭 상단 '📄 명세서 출력' 버튼 누르면 새 창으로 급여 명세서가 열려. PDF로 저장하거나 인쇄할 수 있어. 이직할 때나 증빙 자료로 활용하면 편해.",cat:"급여"},
  {q:"근속수당 식대는 어디서 입력해",a:"급여관리 탭 → '💎 추가 수당' 섹션에 근속수당, 만근수당, 기타수당 항목이 있어. 금액 직접 입력하면 실수령액에 자동으로 합산돼. 식대처럼 매달 고정 지급되면 여기에 넣어봐.",cat:"급여"},
  {q:"올해 연간 총수령액이 얼마인지 알고 싶어",a:"상단 '📊 연간요약' 탭에서 연도별로 확인 가능해. 매달 실제 받은 금액이랑 앱 계산값을 비교할 수 있고, 누적 연봉이랑 분기별 합산도 나와. 실제 명세서 금액을 직접 입력하면 더 정확해.",cat:"급여"},
  {q:"최저시급이 얼마야",a:"2026년 기준 법정 최저시급은 10,320원이야. 앱에 기본값으로 설정되어 있어. 회사에서 이보다 적게 지급된다면, 고용노동부 상담을 받아보는 방법도 있어.",cat:"급여"},
  {q:"계약직이랑 정규직 급여 계산이 달라",a:"이 앱은 시급 기반으로 계산하니까 계약 형태 상관없이 시급만 맞게 넣으면 돼. 다만 계약직은 퇴직금 조건이 다를 수 있고, 4대보험 가입 여부도 확인해보는 게 좋아.",cat:"급여"},
  {q:"야간수당은 몇 시부터야",a:"일반적으로 법정 야간은 오후 10시(22시)~오전 6시 사이야. 이 시간대에 일한 시간은 야간수당 0.5배 추가 계산돼. 설정에서 야간 시작 시간 바꿀 수 있으니까 회사 규정에 맞게 조정해봐.",cat:"급여"},
  {q:"반차를 쓰면 주휴수당 영향 받아",a:"반차는 출근으로 인정돼서 주휴수당에 영향 없어. 결근이 아니라서 개근 조건 충족해. 조퇴도 마찬가지야. 결근만 주휴수당 발생 조건에서 빠지게 돼.",cat:"급여"},
  {q:"퇴직금은 언제부터 받을 수 있어",a:"일반적으로 1년 이상 일하면 퇴직금이 발생하는 경우가 많아. 1일 평균임금 × 30일 × 근속연수로 계산돼. 이 앱은 퇴직금 계산 기능은 없으니까 고용노동부 퇴직금 계산기나 전문가 상담을 받아보는 걸 추천해.",cat:"급여"},
  {q:"이번 달 만근수당 받을 수 있어",a:"급여관리 탭 → 추가 수당에서 '만근수당' 칸 확인해봐. 이번 달 근무일수가 총 근무 예정일과 같으면 ✅ 만근 달성으로 표시돼. 금액은 회사 규정에 따라 직접 입력해두면 자동 적용돼.",cat:"급여"},
  {q:"급여관리에서 보험이랑 세금 수정할 수 있어",a:"응, 급여관리 탭 하단에 4대보험이랑 근로소득세 항목이 있고 직접 금액 입력 가능해. 실제 명세서랑 다를 때 수정하면 돼. '↺ 자동계산으로' 버튼 누르면 다시 자동계산으로 돌아와.",cat:"급여"},
  {q:"주휴수당을 자동으로 계산해주나",a:"급여관리 탭 '🌟 주휴수당' 토글 ON으로 켜면 이번 달 주별로 발생 여부 자동 계산해줘. 주 15시간 이상 + 개근 조건 충족된 주만 인정돼. 실제 적용 여부는 직접 금액 입력해서 확정해.",cat:"급여"},
  {q:"급여일을 앱에 저장할 수 있어",a:"머니냥한테 '급여일은 25일이야' 이렇게 말하면 기억해줘. 다음에 물어보면 알려주고 급여일 전후로 챙겨줄게. 가계부 탭에서도 급여일 기준으로 수입 관리할 수 있어.",cat:"급여"},
  {q:"급여 명세서가 실제랑 차이가 나면 어떻게 해",a:"앱 계산은 참고용이야. 실제 명세서가 기준이야. 차이 나는 항목을 급여관리 탭에서 직접 수정하거나, 연간요약 탭에서 실수령액을 직접 입력해두면 더 정확하게 관리할 수 있어.",cat:"급여"},
  {q:"3.3% 세금은 뭐야",a:"프리랜서나 단기 알바가 사업소득으로 급여 받을 때 원천징수되는 세금이야. 소득세 3% + 지방소득세 0.3% = 3.3%야. 4대보험 없이 일하는 경우에 많이 쓰여. ※ 정확한 세금은 개인 상황에 따라 다를 수 있어.",cat:"세금"},
  {q:"3.3% 떼였는데 환급받을 수 있어",a:"매년 5월 종합소득세 신고를 통해 환급받을 수 있는 경우가 많아. 연간 소득이 낮으면 낸 세금보다 환급이 더 나오는 경우도 있어. 홈택스에서 직접 신고하거나 세무사 상담을 받아보는 걸 추천해.",cat:"세금"},
  {q:"월 60시간 넘으면 어떻게 돼",a:"월 60시간 초과하는 순간부터 4대보험 전체(국민연금+건강보험+장기요양+고용보험)가 적용돼.\n\n🚨 주의! 60시간 넘는 첫 명세서에서 이전 근무분 소급 정산이 한꺼번에 빠질 수 있어. 예상보다 훨씬 많이 공제될 수 있으니 미리 준비해놔.\n\n⚠️ 회사 정책에 따라 다를 수 있으니 정확한 내용은 노무사 상담을 받아봐.",cat:"급여"},
  {q:"소급 정산이 뭐야",a:"60시간 초과 전에 고용보험만 냈는데, 초과하는 순간 그 이전 근무분에 대한 국민연금·건강보험·장기요양 미납분을 한꺼번에 공제하는 걸 소급 정산이라고 해.\n\n🚨 예를 들어 60시간 넘는 달 첫 명세서에서 갑자기 5만원 이상 더 빠질 수 있어. 미리 알고 준비하는 게 중요해.\n\n⚠️ 회사마다 적용 방식이 다를 수 있으니 실제 명세서로 꼭 확인해봐.",cat:"급여"},
  {q:"4대보험 가입 안 하면 어떻게 돼",a:"주 15시간, 월 60시간 이상 일하는 경우 일반적으로 4대보험 의무 가입 대상이 돼. 미가입이면 나중에 연금이나 실업급여에서 불이익을 받을 수 있어. 가입 여부가 불분명하면 근로복지공단이나 고용노동부에 상담받아보는 방법도 있어.",cat:"세금"},
  {q:"알바인데 세금 신고 해야 해",a:"급여를 사업소득(3.3%)으로 받으면 5월에 종합소득세 신고를 하는 게 일반적이야. 근로소득(4대보험 가입)으로 받으면 회사가 연말정산 해줘. 어떤 방식인지 모르겠으면 계약서 확인해봐. ※ 개인 상황에 따라 다를 수 있어.",cat:"세금"},
  {q:"프리랜서는 종합소득세 신고 꼭 해야 해",a:"일반적으로 연간 소득이 있으면 5월에 종합소득세 신고를 하는 경우가 많아. 홈택스에서 간편신고 서비스 이용하거나, 단순경비율 적용하면 혼자도 할 수 있어. 처음이면 세무사 상담을 받아보는 걸 추천해. ※ 정확한 의무 여부는 세무 전문가와 확인해봐.",cat:"세금"},
  {q:"근로소득세는 어떻게 계산돼",a:"월 급여 기준으로 간이세액표에 따라 계산돼. 부양가족 수에 따라 달라지고, 이 앱은 1인 기준으로 자동계산해줘. 실제 세액이 다르면 급여관리 탭에서 직접 수정 가능해. ※ 정확한 세액은 세무사 상담을 통해 확인해봐.",cat:"세금"},
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
  {q:"수입이 자동으로 연동 안 돼",a:"직장인은 근태 기록이 있어야 자동 연동돼. 알바/프리랜서는 수입계산기 탭에서 입력하고 '가계부에 반영' 버튼 눌러야 해. 아니면 가계부 탭 수입 직접입력란에 금액 넣어도 돼.",cat:"가계부"},
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
  {q:"직업유형 바꾸면 기존 데이터가 사라져",a:"아니, 안 사라져. 직업유형은 화면 표시 방식만 바꾸는 거야. 직장인 ↔ 프리랜서 ↔ 알바 전환해도 기존에 기록한 출퇴근, 급여 데이터는 그대로 유지돼.",cat:"앱사용법"},
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
  {q:"전월이랑 이번 달 급여 차이 보고 싶어.",a:"급여관리 탭 열면 상단에 '📊 전월 대비' 카드가 자동으로 나와. 저번 달보다 얼마 더 받는지 ▲▼ 표시로 바로 보여줘. 두 달치 기록이 있어야 비교가 되니까 꾸준히 기록해두면 좋아.",cat:"급여"},
  {q:"근속수당, 식대는 어디서 입력해?",a:"급여관리 탭 → '💎 추가 수당' 섹션에 근속수당, 만근수당, 기타수당 항목이 있어. 금액 직접 입력하면 실수령액에 자동으로 합산돼. 식대처럼 매달 고정 지급되면 여기에 넣어.",cat:"급여"},
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
  // ── 실수령액 관련 ──
  if(msg.includes('실수령') || msg.includes('최종급여') || msg.includes('받는돈') || msg.includes('얼마받')){
    if(!_isEmpCC){
      return `${greeting}이번 달 예상 수입은 💰 ${fmt(_summaryCC?_summaryCC.total:0)} 이에요! 🐱\n(현재 선택된 직업유형 기준으로 합산한 금액이에요)`;
    }
    return `${greeting}이번 달 최종 실수령액은 💰 ${fmt(d.finalPay)} 이에요! 🐱\n\n• 세전총급여: ${fmt(d.grossPay)}\n• 4대보험: -${fmt(d.ins.total)}\n• 소득세+지방세: -${fmt(d.tax.total)}\n• 실수령: = ${fmt(d.finalPay)}`;
  }

  // ── 기본급 관련 ──
  if(msg.includes('기본급') || msg.includes('기본급여')){
    if(!_isEmpCC){
      return `기본급(법정시급×209h) 계산은 직장인 근로소득 기준이라, 직업유형에 "직장인"이 없으면 적용되지 않아요! 🐱\n현재 이번 달 예상 수입은 ${fmt(_summaryCC?_summaryCC.total:0)} 이에요.`;
    }
    return `기본급은 ${fmt(d.basePay)} 이에요! 🐱\n계산식: 법정 최저시급 ${hourlyRate.toLocaleString()}원 × 209시간(소정근로 월 기준)\n= ${hourlyRate.toLocaleString()} × 209 = ${fmt(d.basePay)}`;
  }

  // ── OT/연장수당 관련 ──
  if(msg.includes('ot') || msg.includes('연장') || msg.includes('초과근무') || msg.includes('overtime')){
    if(!_isEmpCC){
      return `OT(연장근무) 수당 계산은 직장인 근로소득 기준이라, 직업유형에 "직장인"이 없으면 적용되지 않아요! 🐱\n현재 이번 달 예상 수입은 ${fmt(_summaryCC?_summaryCC.total:0)} 이에요.`;
    }
    return `이번 달 OT(연장근무) 현황이에요! 🐱\n• OT 시간: ${d.totOT}h\n• 연장수당: ${fmt(d.aOT)} (회사시급 ${companyRate.toLocaleString()}원 × ${d.totOT}h × 1.5배)\n※ 10원 단위 반올림 적용`;
  }

  // ── 야간수당 관련 ──
  if(msg.includes('야간') || msg.includes('야간수당')){
    if(!_isEmpCC){
      return `야간수당 계산은 직장인 근로소득 기준이라, 직업유형에 "직장인"이 없으면 적용되지 않아요! 🐱\n현재 이번 달 예상 수입은 ${fmt(_summaryCC?_summaryCC.total:0)} 이에요.`;
    }
    return `야간근무 수당 계산이에요! 🐱\n• 야간시간: ${d.nightH}h (22:00~06:00)\n• 야간수당: ${fmt(d.aNight)} (시급 × 야간시간 × 0.5배 추가)\n※ 야간수당은 기본급에 추가로 지급됩니다.`;
  }

  // ── 4대보험 관련 ──
  if(msg.includes('4대보험') || msg.includes('보험') || msg.includes('국민연금') || msg.includes('건강보험') || msg.includes('고용보험')){
    if(!_isEmpCC){
      return `4대보험 공제 내역은 직장인 근로소득 기준이라, 직업유형에 "직장인"이 없으면 적용되지 않아요! 🐱\n현재 이번 달 예상 수입은 ${fmt(_summaryCC?_summaryCC.total:0)} 이에요.`;
    }
    return `4대보험 공제 내역이에요! 🐱\n• 국민연금: ${fmt(d.ins.np)} (과세표준 × 4.5%)\n• 건강보험: ${fmt(d.ins.hi)} (과세표준 × 3.545%)\n• 장기요양: ${fmt(d.ins.ltc)} (건강보험료 × 12.95%)\n• 고용보험: ${fmt(d.ins.ei)} (과세표준 × 0.9%)\n합계: ${fmt(d.ins.total)}`;
  }

  // ── 세금 관련 ──
  if(msg.includes('세금') || msg.includes('소득세') || msg.includes('근로소득세') || msg.includes('지방세')){
    if(!_isEmpCC){
      return `근로소득세 내역은 직장인 근로소득 기준이라, 직업유형에 "직장인"이 없으면 적용되지 않아요! 🐱\n프리랜서·N잡 수입은 보통 3.3% 사업소득세가 적용돼요.`;
    }
    return `소득세 내역이에요! 🐱\n• 근로소득세: ${fmt(d.tax.income)}\n• 지방소득세: ${fmt(d.tax.local)} (소득세 × 10%)\n• 합계: ${fmt(d.tax.total)}\n※ 간이세액표 기준 적용`;
  }

  // ── 근무시간 관련 ──
  if(msg.includes('근무시간') || msg.includes('일한시간') || msg.includes('근로시간')){
    if(!_isEmpCC){
      return `OT·야간·휴일시간 구분 계산은 직장인 근로소득 기준이라, 직업유형에 "직장인"이 없으면 적용되지 않아요! 🐱\n근무일수는 근태관리 탭에서 확인할 수 있어요.`;
    }
    return `이번 달 근무 현황이에요! 🐱\n• 근무일수: ${d.wDays}일\n• 정규시간: ${d.normalH}h\n• OT: ${d.totOT}h\n• 야간: ${d.nightH}h\n• 휴일: ${d.holidayH}h\n• 토요특근: ${d.satH}h / 일요특근: ${d.sunH}h`;
  }

  // ── 수당 합계 ──
  if(msg.includes('수당') || msg.includes('총수당')){
    if(!_isEmpCC){
      return `OT·야간·휴일 수당 계산은 직장인 근로소득 기준이라, 직업유형에 "직장인"이 없으면 적용되지 않아요! 🐱\n현재 이번 달 예상 수입은 ${fmt(_summaryCC?_summaryCC.total:0)} 이에요.`;
    }
    return `이번 달 수당 합계: ${fmt(d.totAllow)} 이에요! 🐱\n• OT수당: ${fmt(d.aOT)}\n• 야간수당: ${fmt(d.aNight)}\n• 휴일수당: ${fmt(d.aHoliday)}\n• 토요특근: ${fmt(d.aSat)}\n• 일요특근: ${fmt(d.aSun)}\n• 기타수당: ${fmt(d.totAllow - d.aOT - d.aNight - d.aHoliday - d.aSat - d.aSun)}`;
  }

  // ── 공제 관련 ──
  if(msg.includes('공제') || msg.includes('차감') || msg.includes('결근') || msg.includes('지각')){
    if(!_isEmpCC){
      return `근태공제(결근·지각 공제) 계산은 직장인 근로소득 기준이라, 직업유형에 "직장인"이 없으면 적용되지 않아요! 🐱`;
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
      return `세전·세후 구분은 직장인 근로소득 기준이라, 직업유형에 "직장인"이 없으면 적용되지 않아요! 🐱\n현재 이번 달 예상 수입은 ${fmt(_summaryCC?_summaryCC.total:0)} 이에요.`;
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
      return `휴일·토요·일요 특근 수당 계산은 직장인 근로소득 기준이라, 직업유형에 "직장인"이 없으면 적용되지 않아요! 🐱`;
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
      return `${greeting}이번 달 수입 요약이에요! 🐱\n• 이번 달 예상 수입(직업유형 합산): ${fmt(_summaryCC?_summaryCC.total:0)}`;
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
