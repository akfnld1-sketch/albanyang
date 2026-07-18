// ══════════════════════════════════════════
// 컨텍스트 도움말 시스템 (v2.1)
// 온보딩/사용설명서 대체 — 각 화면·카드 제목 옆 ? 버튼을 누르면 설명 팝업 표시
// 사용: 제목 HTML에 helpBtn('토픽id') 삽입
// ══════════════════════════════════════════

var HELP_TOPICS = {
  att: {
    icon:'📅', title:'근태관리란?',
    body:'달력에서 날짜를 누르면 출근·퇴근 시간, 휴가, 특근을 기록할 수 있어요.<br><br>'
      + '• <b>직장(시급제)</b> — 출퇴근 시간을 기록하면 급여가 자동 계산돼요<br>'
      + '• <b>알바</b> — 시급 × 근무시간, 야간수당 자동 반영<br>'
      + '• <b>배달·대리</b> — 건수 × 단가 입력<br>'
      + '• <b>프리랜서</b> — 프로젝트 단가 입력<br><br>'
      + '💡 시급은 <b>설정 탭</b>에서 언제든 바꿀 수 있어요'
  },
  sal: {
    icon:'💰', title:'수입관리란?',
    body:'이번 달 모든 수입을 한눈에 보여줘요.<br><br>'
      + '• 직장 급여 + 알바 + 배달 + 프리랜서 등 <b>모든 수익원을 합산</b>해요<br>'
      + '• 4대보험·세금을 뺀 <b>실수령액</b> 기준으로 표시돼요<br>'
      + '• 연봉제·월급제는 근태 기록 없이도 고정 월급이 반영돼요<br><br>'
      + '💡 기록할수록 예상 금액이 더 정확해져요'
  },
  budget: {
    icon:'🛡️', title:'생존관리란?',
    body:'이번 달 받을 돈으로 <b>월급날까지 버틸 수 있는지</b> 계산해줘요.<br><br>'
      + '• <b>고정지출</b> — 월세, 통신비 같은 매달 나가는 돈을 등록해요<br>'
      + '• <b>변동지출</b> — 식비, 교통비 등 그때그때 쓰는 돈을 기록해요<br>'
      + '• 수입 − 지출로 남은 돈과 위험도(안전/주의/위험)를 알려줘요'
  },
  dash: {
    icon:'📊', title:'연간요약이란?',
    body:'1년 치 수입과 근무를 모아서 분석해줘요.<br><br>'
      + '• 월별 수입 추이 그래프<br>'
      + '• 연간 총수입·근무시간 통계<br>'
      + '• 다음 해 계획을 세울 때 참고할 수 있어요'
  },
  homePay: {
    icon:'💵', title:'예상 실수령액이란?',
    body:'지금까지의 기록을 바탕으로 <b>이번 달에 실제로 받을 돈</b>을 예상한 금액이에요.<br><br>'
      + '• 4대보험·소득세를 뺀 <b>세후 금액</b>이에요<br>'
      + '• 연봉제·월급제는 설정한 금액 기준으로 바로 계산돼요<br>'
      + '• 시급제·알바는 출근 기록이 쌓일수록 정확해져요'
  },
  setBasic: {
    icon:'📋', title:'기본 정보 설정',
    body:'급여 계산의 기준이 되는 정보예요.<br><br>'
      + '• <b>기본 시급</b> — 시급제·알바 급여 계산에 사용돼요 (2026년 최저시급 10,320원)<br>'
      + '• <b>이름/회사명</b> — 화면 표시용이에요<br>'
      + '• <b>입사일</b> — 연차 개수를 자동 계산해줘요'
  },
  setSalary: {
    icon:'💼', title:'연봉제·월급제 설정',
    body:'연봉(또는 월급)을 입력하면 실수령액을 자동 계산해요.<br><br>'
      + '• <b>비과세 식대/교통비</b> — 세금이 붙지 않는 금액이라 클수록 실수령액이 늘어요 (식대 월 20만원까지 비과세)<br>'
      + '• <b>부양가족 수</b> — 본인 포함 가족 수. 많을수록 소득세가 줄어요<br>'
      + '• <b>포괄임금제</b> — 연장근무 수당이 연봉에 이미 포함된 계약이에요'
  },
  setNjob: {
    icon:'💼', title:'N잡 기본 단가란?',
    body:'달력에서 부업을 기록할 때 자동으로 적용되는 기본값이에요.<br><br>'
      + '• 알바는 <b>시급</b>, 배달·대리는 <b>건당 단가</b>를 미리 넣어두면<br>'
      + '기록할 때마다 다시 입력하지 않아도 돼요<br>'
      + '• 기록 화면에서 그때그때 바꿀 수도 있어요'
  },
  setPayday: {
    icon:'💰', title:'급여일 설정이란?',
    body:'직종마다 다른 급여일을 등록해두면,<br><b>D-3 · D-1 · 당일</b>에 알림을 보내드려요.<br><br>'
      + '• <b>월 고정일</b> — 매월 25일처럼 정해진 날 지급<br>'
      + '• <b>주급 방식</b> — 마감 요일 + 며칠 후 지급 (쿠팡 등)<br>'
      + '• <b>당일/익일</b> — 일한 날 바로 지급'
  },
  extraIncome: {
    icon:'➕', title:'추가수입이란?',
    body:'보험지급액, 환급금, 정부지원금처럼 <b>일시적으로 생기는 수입</b>을 기록하는 곳이에요.<br><br>'
      + '기록하면 이번 달 총수입과 생존관리 계산에 자동으로 반영돼요.'
  },
};

// 제목 옆에 붙이는 ? 버튼 HTML (렌더 문자열에 삽입)
function helpBtn(topicId){
  if(!HELP_TOPICS[topicId]) return '';
  return '<span onclick="event.stopPropagation();showHelpPopup(\''+topicId+'\')" '
    + 'style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;'
    + 'border-radius:50%;background:rgba(79,124,255,.15);color:var(--accent,#4f7cff);font-size:13px;'
    + 'font-weight:800;cursor:pointer;vertical-align:middle;margin-left:6px;flex-shrink:0;'
    + 'font-family:\'Noto Sans KR\',sans-serif;" title="도움말">?</span>';
}

function showHelpPopup(topicId){
  var t = HELP_TOPICS[topicId];
  if(!t) return;
  var old = document.getElementById('help-overlay');
  if(old) old.remove();

  var ov = document.createElement('div');
  ov.id = 'help-overlay';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:100000;padding:20px;';
  ov.addEventListener('click', function(e){ if(e.target === ov) ov.remove(); });

  var modal = document.createElement('div');
  modal.style.cssText = 'background:var(--surface,#1e2235);border:1px solid var(--border,rgba(255,255,255,.1));border-radius:18px;padding:24px 20px 18px;max-width:400px;width:100%;max-height:80vh;overflow-y:auto;box-shadow:0 20px 56px rgba(0,0,0,.45);';
  modal.innerHTML = '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">'
    + '<span style="font-size:28px;">'+t.icon+'</span>'
    + '<h3 style="font-size:19px;font-weight:800;color:var(--text,#fff);margin:0;">'+t.title+'</h3></div>'
    + '<div style="font-size:15px;color:var(--text2,#ccc);line-height:1.7;">'+t.body+'</div>';

  var closeBtn = document.createElement('button');
  closeBtn.textContent = '확인';
  closeBtn.style.cssText = 'width:100%;margin-top:16px;padding:12px;border-radius:10px;border:none;background:var(--accent,#4f7cff);color:#fff;font-size:16px;font-weight:700;cursor:pointer;font-family:"Noto Sans KR",sans-serif;';
  closeBtn.addEventListener('click', function(){ ov.remove(); });
  modal.appendChild(closeBtn);

  ov.appendChild(modal);
  document.body.appendChild(ov);
}
