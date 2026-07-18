const PREMIUM_UNLOCKED = true;

/** [1] 손해 감지 엔진 */
function detectPayLoss(d, weeklyData) {
  const items = [];
  const nightH = (typeof d.nightH === 'number' && !isNaN(d.nightH)) ? d.nightH : 0;
  const totOT  = (typeof d.totOT  === 'number' && !isNaN(d.totOT))  ? d.totOT  : 0;

  // ─ 야간수당 누락 감지
  if (nightH > 0) {
    const expectedNight = Math.round(nightH * companyRate * 0.5);
    items.push({
      id: 'night',
      icon: '🌙',
      title: `야간수당 ${nightH.toFixed(1)}h 미지급 가능성`,
      detail: `22시~06시 근무 ${nightH.toFixed(1)}h → 예상 수당 +${expectedNight.toLocaleString()}원`,
      amount: expectedNight,
      risk: 'high',
      premium: false
    });
  }

  // ─ 연장수당 누락 감지
  if (totOT > 0) {
    const expectedOT = Math.round(d.totOT * companyRate * 1.5);
    const actualOT   = Math.round(d.totOT * companyRate * 0.5); // 추가분만
    items.push({
      id: 'ot',
      icon: '⏰',
      title: `연장수당 ${totOT.toFixed(1)}h 발생`,
      detail: `8h 초과 ${totOT.toFixed(1)}h × 시급 1.5배 → +${Math.round(totOT * companyRate * 0.5).toLocaleString()}원 추가분`,
      amount: Math.round(d.totOT * companyRate * 0.5),
      risk: 'mid',
      premium: false
    });
  }

  // ─ 주휴수당 대상 여부 (별도 계산 OFF면 카드 숨김)
  const _whe = (typeof weeklyHolidayEnabled !== 'undefined') ? weeklyHolidayEnabled : true;
  if (_whe && weeklyData.qualCount > 0) {
    items.push({
      id: 'weekly',
      icon: '🌟',
      title: `주휴수당 발생 확정 (${weeklyData.qualCount}주)`,
      detail: `조건 충족 ${weeklyData.qualCount}주 × ${weeklyData.weeklyAmt.toLocaleString()}원 = ${weeklyData.totalWeeklyAmt.toLocaleString()}원`,
      amount: weeklyData.totalWeeklyAmt,
      risk: 'info',
      premium: false
    });
  }

  // ─ 지각 공제 감지
  items.push({
    id: 'late_excess',
    icon: '⏱',
    title: '지각 공제 감지',
    detail: d.lateCount > 0 ? `지각 ${d.lateCount}회 → 공제 ${Math.round(d.dLate||0).toLocaleString()}원` : '이번 달 지각 없음',
    amount: Math.round(d.dLate || 0),
    risk: d.lateCount > 0 ? 'mid' : 'info',
    premium: false
  });

  // ─ 토/일 특근 수당
  items.push({
    id: 'weekend_loss',
    icon: '📅',
    title: '토·일 특근 수당',
    detail: (() => {
      const sH = typeof d.satH === 'number' ? d.satH : 0;
      const uH = typeof d.sunH === 'number' ? d.sunH : 0;
      if(sH === 0 && uH === 0) return '이번 달 특근 없음';
      return `토요 ${sH}h(×1.5) + 일요 ${uH}h(×2.0) 자동 반영`;
    })(),
    amount: Math.round(((d.satH||0) * companyRate * 0.5) + ((d.sunH||0) * companyRate * 1.0)),
    risk: ((d.satH||0) + (d.sunH||0)) > 0 ? 'mid' : 'info',
    premium: false
  });

  // ─ 비과세 혜택 안내
  items.push({
    id: 'nontax',
    icon: '💡',
    title: '비과세 혜택 안내',
    detail: '식대 월 20만원·교통비 20만원 비과세 → 세금 절감 가능',
    amount: 0,
    risk: 'info',
    premium: false
  });

  // 총 손해 가능 금액
  const totalRisk = items
    .filter(i => !i.premium && i.amount > 0)
    .reduce((s, i) => s + i.amount, 0);

  return { items, totalRisk };
}

/** [3] 오늘 실시간 수익 계산 — 직장인 선택 + companyRate 유효 시에만 */
function calcTodayEarnings() {
  // 직장인 미선택 시 카드 미표시 (N잡 단독 사용자 오표시 방지)
  const _sj = (typeof loadSelectedJobs==='function') ? loadSelectedJobs() : [];
  if(_sj.indexOf('employee') < 0) return null;
  // 시급 미설정 시 카드 미표시 (0원 표기 방지)
  if(!companyRate || companyRate <= 0) return null;

  const today = new Date();
  const isToday = (today.getFullYear() === curY && today.getMonth() === curM);
  if (!isToday) return null;

  const key  = dk(curY, curM, today.getDate());
  const data = dayData[key];
  // v3.4: 공통 함수(calcDayEarningsShared)에 위임 — 근태 Hero와 완전히 동일한 계산 경로
  if(typeof calcDayEarningsShared!=='function') return null;
  const e = calcDayEarningsShared(data, today);
  if(!e) return null;
  return { total: e.total, net: e.net, isLive: e.isLive, startH: e.startH };
}

/** [4] 급여 분석 카드 데이터 계산 */
function calcSalaryAnalytics(d) {
  const totalWorkH = (typeof d.totalWorkH === 'number') ? d.totalWorkH : 0;
  const netPay     = (typeof d.netPay === 'number') ? d.netPay : ((typeof d.finalPay === 'number') ? d.finalPay : 0);
  const totAllow   = (typeof d.totAllow === 'number') ? d.totAllow : 0;

  // 평균 시급
  const avgHourly = totalWorkH > 0
    ? Math.round(netPay / totalWorkH)
    : companyRate;

  // 수당 비율
  const allowRatio = netPay > 0
    ? Math.round((totAllow / netPay) * 100)
    : 0;

  // 전주 대비 (이번 주 vs 저번 주 근무 시간 기준)
  const thisWeekH = calcWeekHours(0);
  const prevWeekH = calcWeekHours(1);
  const weekChange = prevWeekH > 0
    ? Math.round(((thisWeekH - prevWeekH) / prevWeekH) * 100)
    : null;

  return { avgHourly, allowRatio, weekChange, thisWeekH, prevWeekH };
}

function calcWeekHours(weeksAgo) {
  const today = new Date();
  const monday = new Date(today);
  const dow = today.getDay();
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1) - weeksAgo * 7);

  let total = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    if (d.getMonth() !== curM) continue;
    const key  = dk(d.getFullYear(), d.getMonth(), d.getDate());
    const data = dayData[key];
    if (data && data.status && data.status !== 'none') {
      total += calcNetHours(data.start, data.end, data.status, data.shift);
    }
  }
  return total;
}

/** 분석 UI 렌더링 */
function renderSalaryAnalysis(d) {
  // ★ 방어: d가 없거나 필수값 없으면 빈 문자열 반환
  if (!d) return '';
  // 출근 기록이 없으면 기본급 가정치 기반 분석을 실제 금액처럼 보여주지 않음
  if (typeof _hasAttendance === 'function' && !_hasAttendance()) {
    return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px 18px;margin-bottom:14px;font-size:16px;color:var(--text3);line-height:1.7;">
      아직 이번달 출근 기록이 없어 급여 분석을 보여드릴 수 없어요. 근태 탭에서 출근을 기록해보세요!
    </div>`;
  }

  // totalWorkH는 getPayData()에 없을 수 있으므로 직접 계산
  const totalWorkH = (function(){
    let h = 0;
    const dim = new Date(curY, curM+1, 0).getDate();
    for(let i=1; i<=dim; i++){
      const k = dk(curY, curM, i);
      const dd = dayData[k];
      if(dd && dd.status && dd.status !== 'none')
        h += calcNetHours(dd.start, dd.end, dd.status, dd.shift);
    }
    return h;
  })();

  // 안전한 숫자 변환 헬퍼
  const safeNum = (v, fallback=0) => (typeof v === 'number' && !isNaN(v)) ? v : fallback;
  const sf = (v, dec=1) => safeNum(v).toFixed(dec);

  const netPay    = safeNum(d.finalPay || d.netPay);
  const basePay   = safeNum(d.basePay);
  const totAllow  = safeNum(d.totAllow);
  const totDeduct = safeNum(d.totDeduct);
  const nightH    = safeNum(d.nightH);
  const totOT     = safeNum(d.totOT);

  const weeklyData  = getWeeklyHolidayData();
  const lossData    = detectPayLoss({...d, nightH, totOT, netPay, totalWorkH}, weeklyData);
  const todayEarn   = calcTodayEarnings();
  const analytics   = calcSalaryAnalytics({...d, netPay, totalWorkH});

  // ── [1] 히어로 섹션 ──
  const lossHtml = lossData.totalRisk > 0
    ? `<div style="margin-top:6px;font-size:17px;color:var(--red);font-weight:700;">
        ⚠️ 손해 가능성: -${lossData.totalRisk.toLocaleString()}원
       </div>`
    : `<div style="margin-top:6px;font-size:16px;color:var(--green);">✅ 감지된 손해 없음</div>`;

  const heroHtml = `
  <div style="background:linear-gradient(135deg,rgba(79,124,255,.12),rgba(124,92,255,.08));
    border:1px solid rgba(79,124,255,.3);border-radius:16px;padding:20px 22px;margin-bottom:14px;position:relative;overflow:hidden;">
    <div style="font-size:15px;color:var(--text3);font-weight:600;letter-spacing:.5px;margin-bottom:4px;">이번 달 예상 실수령액${typeof helpBtn==='function'?helpBtn('homePay'):''}</div>
    <div style="font-size:40px;font-weight:900;font-family:'JetBrains Mono';color:var(--green);line-height:1.1;">
      ${netPay > 0 ? '₩'+netPay.toLocaleString() : '<span style="font-size:21px;color:var(--text3)">기록 없음</span>'}
    </div>
    ${lossHtml}
    <div style="margin-top:12px;display:flex;gap:16px;flex-wrap:wrap;">
      <div style="font-size:15px;color:var(--text3);">기본급 <b style="color:var(--text2);">₩${Math.round(basePay).toLocaleString()}</b></div>
      <div style="font-size:15px;color:var(--text3);">수당 <b style="color:var(--accent);">+₩${Math.round(totAllow).toLocaleString()}</b></div>
      <div style="font-size:15px;color:var(--text3);">공제 <b style="color:var(--red);">-₩${Math.round(totDeduct).toLocaleString()}</b></div>
    </div>
    <div style="position:absolute;right:16px;top:16px;font-size:40px;opacity:.06;">💰</div>
  </div>`;

  // ── [3] 실시간 오늘 수익 ──
  const todayHtml = todayEarn ? `
  <div id="today-earn-card" style="background:var(--surface);border:1px solid var(--border);
    border-radius:12px;padding:14px 16px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;">
    <div>
      <div style="font-size:15px;color:var(--text3);margin-bottom:3px;">
        ${todayEarn.isLive ? '⏱ 오늘 실시간 수익 (근무 중)' : '✅ 오늘 수익 확정'}
      </div>
      <div style="font-size:28px;font-weight:900;font-family:\'JetBrains Mono\';color:var(--accent);"
           id="today-earn-val">₩${todayEarn.total.toLocaleString()}</div>
      <div style="font-size:15px;color:var(--text3);margin-top:2px;">
        근무 ${todayEarn.net.toFixed(1)}h × ${companyRate.toLocaleString()}원/h
      </div>
    </div>
    ${todayEarn.isLive ? `<div style="width:10px;height:10px;border-radius:50%;background:var(--green);
      box-shadow:0 0 0 3px rgba(26,158,92,.25);animation:pulse-dot 1.5s infinite;"></div>` : ''}
  </div>` : '';

  // ── [2] 손해 감지 카드 ──
  const lossCards = lossData.items.map((item, idx) => {
    const riskColor = item.risk === 'high' ? 'var(--red)' : item.risk === 'mid' ? 'var(--yellow)' : 'var(--green)';
    const riskBg    = item.risk === 'high' ? 'rgba(224,52,85,.08)' : item.risk === 'mid' ? 'rgba(212,144,10,.07)' : 'rgba(26,158,92,.07)';
    const amtHtml   = item.amount > 0
      ? `<div style="font-size:17px;font-weight:700;color:${riskColor};white-space:nowrap;">+${item.amount.toLocaleString()}원</div>`
      : '';
    return `
    <div style="display:flex;align-items:center;gap:12px;padding:10px 12px;
      border-radius:9px;border:1px solid ${riskColor}33;background:${riskBg};">
      <span style="font-size:23px;">${item.icon}</span>
      <div style="flex:1;">
        <div style="font-size:16px;font-weight:700;color:${riskColor};">${item.title}</div>
        <div style="font-size:15px;color:var(--text3);margin-top:1px;">${item.detail}</div>
      </div>
      ${amtHtml}
    </div>`;
  }).join('');

  const lossSection = `
  <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px 16px;margin-bottom:14px;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
      <div style="font-size:17px;font-weight:700;color:var(--text);">⚠️ 급여 손해 감지</div>
      <div style="font-size:14px;color:var(--text3);">자동 분석 결과</div>
    </div>
    <div style="display:flex;flex-direction:column;gap:7px;">${lossCards}</div>
  </div>`;

  // ── [4] 분석 카드 ──
  const weekChangeHtml = analytics.weekChange !== null
    ? `<div style="text-align:center;padding:10px;background:var(--surface2);border-radius:9px;">
        <div style="font-size:14px;color:var(--text3);margin-bottom:4px;">전주 대비</div>
        <div style="font-size:21px;font-weight:700;color:${analytics.weekChange >= 0 ? 'var(--green)' : 'var(--red)'};">
          ${analytics.weekChange >= 0 ? '+' : ''}${analytics.weekChange}%
        </div>
        <div style="font-size:14px;color:var(--text3);">${analytics.thisWeekH.toFixed(1)}h vs ${analytics.prevWeekH.toFixed(1)}h</div>
       </div>`
    : `<div style="text-align:center;padding:10px;background:var(--surface2);border-radius:9px;opacity:.5;">
        <div style="font-size:14px;color:var(--text3);margin-bottom:4px;">전주 대비</div>
        <div style="font-size:17px;color:var(--text3);">데이터 없음</div>
       </div>`;

  const analyticsSection = `
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px;">
    <div style="text-align:center;padding:12px 8px;background:var(--surface);border:1px solid var(--border);border-radius:10px;">
      <div style="font-size:14px;color:var(--text3);margin-bottom:4px;">평균 시급</div>
      <div style="font-size:21px;font-weight:700;font-family:'JetBrains Mono';color:var(--accent);">
        ₩${analytics.avgHourly.toLocaleString()}
      </div>
      <div style="font-size:14px;color:var(--text3);margin-top:2px;">${safeNum(totalWorkH).toFixed(0)}h 기준</div>
    </div>
    <div style="text-align:center;padding:12px 8px;background:var(--surface);border:1px solid var(--border);border-radius:10px;">
      <div style="font-size:14px;color:var(--text3);margin-bottom:4px;">수당 비율</div>
      <div style="font-size:21px;font-weight:700;font-family:'JetBrains Mono';color:var(--yellow);">
        ${analytics.allowRatio}%
      </div>
      <div style="font-size:14px;color:var(--text3);margin-top:2px;">총 수령 대비</div>
    </div>
    ${weekChangeHtml}
  </div>`;

  // 실시간 업데이트 (근무 중일 때만)
  if (todayEarn && todayEarn.isLive) {
    if (window._earnTimer) clearInterval(window._earnTimer);
    window._earnTimer = setInterval(() => {
      const e2 = calcTodayEarnings();
      const el = document.getElementById('today-earn-val');
      if (el && e2) el.textContent = '₩' + e2.total.toLocaleString();
    }, 60000); // 1분마다 갱신
  }

  return heroHtml + todayHtml + lossSection + analyticsSection;
}

/** 프리미엄 모달 */
function showPremiumModal() {
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.id = 'premium-modal-ov';
  ov.innerHTML = `
  <div class="popup" style="width:340px;padding:28px 24px;text-align:center;">
    <div style="font-size:50px;margin-bottom:12px;">🔓</div>
    <h3 style="font-size:23px;margin:0 0 8px;">프리미엄 기능</h3>
    <p style="font-size:17px;color:var(--text2);margin:0 0 20px;line-height:1.7;">
      지각 공제 과다 감지, 특근 수당 누락 분석,<br>비과세 항목 미적용 감지 등<br>
      <b style="color:var(--accent);">3가지 추가 손해 감지</b> 기능을 이용할 수 있어요.
    </p>
    <div style="background:rgba(79,124,255,.08);border:1px solid rgba(79,124,255,.2);
      border-radius:10px;padding:12px;margin-bottom:18px;font-size:16px;color:var(--text2);line-height:1.8;">
      ✅ 지각 공제 과다 분석<br>
      ✅ 토·일 특근 수당 검증<br>
      ✅ 식대·교통비 비과세 감지
    </div>
    <button onclick="document.getElementById('premium-modal-ov').remove()"
      style="width:100%;padding:12px;border-radius:10px;border:none;background:var(--accent);
      color:#fff;font-size:20px;font-weight:700;cursor:pointer;font-family:'Noto Sans KR';margin-bottom:8px;">
      준비 중입니다
    </button>
    <button onclick="document.getElementById('premium-modal-ov').remove()"
      style="width:100%;padding:10px;border-radius:10px;border:1px solid var(--border);background:transparent;
      color:var(--text2);font-size:17px;cursor:pointer;font-family:'Noto Sans KR';">
      닫기
    </button>
  </div>`;
  document.body.appendChild(ov);
}

// ══════════════════════════════════════════
// v4.0 수입관리 리디자인 — "이번 달 얼마 벌었는지 5초 안에" (UI 전용, 계산 무변경)
// 구조: ①총 예상수입 Hero → ②사업장별 카드(접기/펼치기) → ③이번 주 수입 → ⑥AI 요약
// (④오늘 실시간·⑤급여 상세는 아래 기존 섹션 그대로)
// ══════════════════════════════════════════
function _salAccordionToggle(id){
  const body = document.getElementById(id);
  const arrow = document.getElementById(id+'-arrow');
  if(!body) return;
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'block';
  if(arrow) arrow.style.transform = open ? '' : 'rotate(180deg)';
}

function _salCompanyDetailRows(pd){
  const row = (label, val, color) => (typeof val==='number' && val!==0)
    ? `<div style="display:flex;justify-content:space-between;font-size:var(--font-sm);padding:4px 0;color:var(--text2);"><span>${label}</span><b style="color:${color||'var(--text)'};">${fmt(Math.round(val))}</b></div>` : '';
  let h = '';
  h += row('기본급', pd.basePay);
  h += row('주휴수당', pd.aWeeklyManual);
  h += row('연장수당', pd.aOT);
  h += row('야간수당', pd.aNight);
  h += row('휴일수당', pd.aHoliday);
  h += row('만근수당', pd.perfAmt);
  if(pd.ins && pd.ins.total) h += row('4대보험', -pd.ins.total, 'var(--red)');
  if(pd.tax && pd.tax.total) h += row('세금', -pd.tax.total, 'var(--red)');
  h += `<div style="display:flex;justify-content:space-between;font-size:var(--font-base);font-weight:800;border-top:1px solid var(--border);padding-top:7px;margin-top:4px;"><span>실수령 예상</span><span style="color:var(--mn-success);">${fmt(pd.finalPay||0)}</span></div>`;
  return h;
}

// ══════════════════════════════════════════
// v4.0.1~3: 급여명세서 비교 — 회사 실지급 입력 → 예상 vs 실제 → AI 차이 분석
// 저장: 기존 월별 직접입력 키(atm2_pay_{wp}_{emp}_manual, {"YYYY-MM": 금액}) 재사용 — 연간요약 호환
// ══════════════════════════════════════════
function _salActualKey(wpId, empId){ return 'atm2_pay_'+wpId+'_'+empId+'_manual'; }
function _salActualMap(wpId, empId){
  try{ return JSON.parse(localStorage.getItem(_salActualKey(wpId, empId))||'{}'); }catch(e){ return {}; }
}
function _salActualGet(wpId, empId, y, m){
  var v = _salActualMap(wpId, empId)[y+'-'+pad2(m+1)];
  return (v===undefined || v===null || v==='') ? null : parseInt(v);
}
function _salActualSave(inputId, wpId, empId){
  var el = document.getElementById(inputId);
  if(!el) return;
  var v = parseInt(String(el.value).replace(/[^0-9]/g,''));
  if(!v || v<=0){ if(typeof showToast==='function') showToast('금액을 입력해주세요'); return; }
  var map = _salActualMap(wpId, empId);
  map[curY+'-'+pad2(curM+1)] = v;
  try{ localStorage.setItem(_salActualKey(wpId, empId), JSON.stringify(map)); }catch(e){}
  if(typeof showToast==='function') showToast('💼 회사 실지급액이 저장되었습니다');
  renderSalary();
}

// 예상 vs 실제 비교 + AI 분석 블록 (아코디언 내부)
function _salCompareHtml(c, pd, idx){
  var actual = _salActualGet(c.wpId, c.empId, curY, curM);
  var expected = pd.finalPay || 0;
  var inputId = 'sal-actual-inp-'+idx;
  var h = '<div style="border-top:1px dashed var(--border);margin-top:10px;padding-top:10px;">'
    + '<div style="font-size:var(--font-sm);font-weight:800;color:var(--text2);margin-bottom:6px;">💼 급여명세서 비교</div>';
  // 입력 행 (저장돼 있으면 수정 가능하게 값 채움)
  h += '<div style="display:flex;gap:8px;">'
    + '<input id="'+inputId+'" type="number" inputmode="numeric" placeholder="회사 실지급액 (원)" value="'+(actual||'')+'" class="mn-input" style="flex:1;min-height:40px;">'
    + '<button onclick="event.stopPropagation();_salActualSave(\''+inputId+'\',\''+c.wpId+'\',\''+c.empId+'\')" class="mn-btn mn-btn--primary mn-btn--sm" style="min-height:40px;">저장</button>'
    + '</div>';
  if(actual !== null && expected > 0){
    var diff = actual - expected;
    var errPct = Math.round(Math.abs(diff)/expected*1000)/10;
    var accuracy = Math.max(0, Math.round((100 - Math.abs(diff)/expected*100)*10)/10);
    var diffColor = diff===0 ? 'var(--text)' : (diff>0 ? 'var(--mn-success)' : 'var(--mn-error)');
    var accColor = accuracy>=99 ? 'var(--mn-success)' : (accuracy>=95 ? 'var(--mn-warning)' : 'var(--mn-error)');
    h += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;text-align:center;margin-top:10px;">'
      + '<div><div class="mn-caption">예상</div><b style="font-size:var(--font-sm);color:var(--text);">'+fmt(expected)+'</b></div>'
      + '<div><div class="mn-caption">회사 실지급</div><b style="font-size:var(--font-sm);color:var(--text);">'+fmt(actual)+'</b></div>'
      + '<div><div class="mn-caption">차이</div><b style="font-size:var(--font-sm);color:'+diffColor+';">'+(diff>0?'+':'')+fmt(diff)+'</b></div>'
      + '</div>'
      // 신뢰 지표: 정확도 (몇 달 쌓이면 "머니냥 계산은 믿어도 된다"는 신뢰의 근거)
      + '<div style="text-align:center;margin-top:8px;">'
      + '<span class="mn-badge" style="background:var(--mn-good-soft);color:'+accColor+';font-size:12px;padding:4px 12px;">🎯 정확도 '+accuracy+'%</span>'
      + '</div>';
    // ── AI 분석 (비서 말투) ──
    var mood, msg;
    if(errPct < 1){
      mood = 'celebrate';
      msg = '이번 달 계산은 회사 급여명세서와 <b>거의 동일합니다</b>.<br>정확도 <b style="color:var(--mn-success);">'+accuracy+'%</b> — 계산 결과를 안심하고 참고하셔도 됩니다.';
    } else if(diff < 0){
      mood = 'thinking';
      msg = '예상보다 <b style="color:var(--mn-error);">'+fmt(Math.abs(diff))+'</b> 적게 지급되었습니다.<br>아래 "왜 차이가 났나요?"에서 가능성이 높은 원인을 확인해보세요.';
    } else {
      mood = 'celebrate';
      msg = '예상보다 <b style="color:var(--mn-success);">'+fmt(diff)+'</b> 많이 받으셨습니다.<br>상여금이나 추가 수당이 지급되었을 수 있어요. 좋은 소식이네요!';
    }
    // ── 왜 차이가 났나요? — 접이식 원인 분석 (금액이 가장 근접한 항목을 유력 원인으로) ──
    var whyHtml = '';
    if(errPct >= 1){
      var cand = [
        { n:'연장수당',   v: pd.aOT },
        { n:'야간수당',   v: pd.aNight },
        { n:'휴일수당',   v: pd.aHoliday },
        { n:'주휴수당',   v: pd.aWeeklyManual },
        { n:'만근수당',   v: pd.perfAmt },
        { n:'국민연금',   v: pd.ins && pd.ins.np },
        { n:'건강보험',   v: pd.ins && (pd.ins.hi||0)+(pd.ins.ltc||0) },
        { n:'고용보험',   v: pd.ins && pd.ins.ei },
        { n:'소득세',     v: pd.tax && pd.tax.income },
        { n:'지방소득세', v: pd.tax && pd.tax.local }
      ].filter(function(x){ return typeof x.v==='number' && x.v>0; });
      var target = Math.abs(diff), best = null;
      cand.forEach(function(x){
        var gap = Math.abs(x.v - target);
        if(gap <= target*0.3 && (!best || gap < best.gap)) best = { n:x.n, v:x.v, gap:gap };
      });
      var whyId = 'sal-why-'+idx;
      var rows = cand.map(function(x){
        var hit = best && x.n===best.n;
        return '<div style="display:flex;justify-content:space-between;font-size:var(--font-xs);padding:3px 0;color:'+(hit?'var(--mn-warning)':'var(--text3)')+';">'
          + '<span>'+(hit?'⭐ ':'▶ ')+x.n+(hit?' <b>(가장 유력)</b>':'')+'</span><span>'+fmt(x.v)+'</span></div>';
      }).join('');
      whyHtml = '<div style="margin-top:8px;">'
        + '<button onclick="event.stopPropagation();_salAccordionToggle(\''+whyId+'\')" class="mn-btn mn-btn--ghost mn-btn--sm" style="width:100%;">🔍 왜 차이가 났나요? <span id="'+whyId+'-arrow" style="transition:transform .2s;">▼</span></button>'
        + '<div id="'+whyId+'" style="display:none;background:var(--surface2);border-radius:var(--mn-r-sm);padding:9px 11px;margin-top:5px;">'
        + '<div class="mn-caption" style="margin-bottom:5px;">차이 '+fmt(Math.abs(diff))+'와 금액이 비슷한 항목일 가능성이 높아요.</div>'
        + rows
        + (best ? '' : '<div class="mn-caption" style="margin-top:4px;">딱 맞는 항목이 없어요 — 여러 항목이 함께 달라졌을 수 있으니 명세서의 공제 합계를 확인해보세요.</div>')
        + '</div></div>';
    }
    // 최근 3개월 오차 히스토리
    var hist = [];
    for(var k=1;k<=3;k++){
      var hm = curM-k, hy = curY;
      while(hm<0){ hm+=12; hy--; }
      var hA = _salActualGet(c.wpId, c.empId, hy, hm);
      if(hA===null) continue;
      try{
        var hp = (typeof CompanyEngine!=='undefined')
          ? CompanyEngine.runFor(c.wpId, c.empId, function(){ return getPayDataForMonth(hy, hm); })
          : getPayDataForMonth(hy, hm);
        if(hp && hp.finalPay>0) hist.push({ label:(hm+1)+'월', err: Math.round(Math.abs(hA-hp.finalPay)/hp.finalPay*1000)/10 });
      }catch(e){}
    }
    if(hist.length){
      var avg = hist.reduce(function(s,x){ return s+x.err; },0)/hist.length;
      if(errPct > 1 && avg > 0 && errPct > avg*2){
        msg += '<br><b style="color:var(--mn-warning);">이번 달은 평소(평균 오차 '+ (Math.round(avg*10)/10) +'%)보다 차이가 커요.</b>';
      }
      msg += '<br><span class="mn-caption">최근 오차: '+hist.map(function(x){ return x.label+' '+x.err+'%'; }).join(' · ')+'</span>';
    }
    h += '<div style="display:flex;gap:8px;align-items:flex-start;background:var(--mn-brand-soft);border-radius:var(--mn-r-sm);padding:9px 10px;margin-top:8px;">'
      + ((typeof MnCharacter!=='undefined')?MnCharacter.img(mood,'avatar'):'')
      + '<div style="font-size:var(--font-xs);color:var(--text);line-height:1.55;">'+msg+'</div>'
      + '</div>'
      + whyHtml;
  }
  h += '</div>';
  return h;
}

function _salRedesignTop(){
  try{
    const _sj = (typeof loadSelectedJobs==='function') ? loadSelectedJobs() : [];
    if(_sj.indexOf('employee') < 0) return '';
    const hasCE = (typeof CompanyEngine!=='undefined');
    const multi = hasCE && CompanyEngine.isMulti();
    const hasRec = hasCE ? CompanyEngine.companies().some(c => CompanyEngine.hasRecords(c.wpId, c.empId))
                         : ((typeof _hasAttendance==='function') ? _hasAttendance() : true);
    let H = '';

    // ① 이번 달 총 예상수입 Hero
    let total = 0, gross = 0, breakdown = [];
    if(multi){ const all = CompanyEngine.getPayDataAll(); total = all.total; gross = all.gross; breakdown = all.breakdown; }
    else if(hasRec){ const pd0 = getPayData(); total = pd0.finalPay||0; gross = pd0.grossPay||0; }
    // v4.2.2-beta.8 (디자인 시안 6): 그라디언트 히어로 + 머니냥 캐릭터
    H += `<div class="mn-card" style="background:linear-gradient(135deg,var(--accent),color-mix(in srgb, var(--accent) 55%, #ffffff));border:none;color:#fff;display:flex;align-items:center;gap:12px;">
      <div style="flex:1;min-width:0;text-align:left;">
        <div style="font-size:var(--font-xs);font-weight:700;opacity:.9;">💰 이번 달 총 예상수입 (실수령)</div>
        <div style="font-family:'JetBrains Mono';font-weight:900;font-size:calc(30px * var(--ui-scale));margin-top:2px;">${hasRec?fmt(total):'—'}</div>
        <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;">
          <span style="font-size:var(--font-xs);font-weight:700;background:rgba(255,255,255,.18);padding:3px 10px;border-radius:999px;">${hasRec?('세전 '+fmt(gross)):'출근을 기록하면 계산이 시작돼요'}</span>
          ${hasRec&&multi?('<span style="font-size:var(--font-xs);font-weight:700;background:rgba(255,255,255,.18);padding:3px 10px;border-radius:999px;">사업장 '+breakdown.length+'곳 합산</span>'):''}
        </div>
      </div>
      <img src="img/emoji/수입돈.png" alt="머니냥" style="width:84px;height:84px;object-fit:contain;flex:none;filter:drop-shadow(0 4px 10px rgba(0,0,0,.18));">
    </div>`;

    // ② 사업장별 예상급여 카드 (접기/펼치기)
    if(hasCE && hasRec){
      const cos = CompanyEngine.companies().filter(c => CompanyEngine.hasRecords(c.wpId, c.empId));
      if(cos.length){
        H += `<div class="mn-h" style="margin-top:2px;">🏢 사업장별 예상급여</div>`;
        cos.forEach((c, i) => {
          const pd = CompanyEngine.getPayDataFor(c.wpId, c.empId);
          if(!pd) return;
          const isMain = c.wpId===activeWpId;
          const bid = 'sal-co-body-'+i;
          H += `<div class="mn-card" style="padding:0;overflow:hidden;">
            <div onclick="_salAccordionToggle('${bid}')" style="display:flex;justify-content:space-between;align-items:center;padding:var(--card-pad);cursor:pointer;">
              <div style="font-size:var(--font-base);font-weight:800;color:var(--text);">${isMain?'🏢':'📦'} ${c.name}
                <span class="mn-badge ${isMain?'mn-badge--main':'mn-badge--sub'}" style="margin-left:6px;">${isMain?'메인':'보조'}</span></div>
              <div style="display:flex;align-items:center;gap:8px;">
                <b style="font-family:'JetBrains Mono';color:var(--mn-success);font-size:var(--font-md);">${fmt(pd.finalPay||0)}</b>
                <span id="${bid}-arrow" style="color:var(--text3);transition:transform .2s;">▼</span>
              </div>
            </div>
            <div id="${bid}" style="display:none;padding:0 var(--card-pad) var(--card-pad);border-top:1px solid var(--border);">
              ${_salCompanyDetailRows(pd)}
              ${_salCompareHtml(c, pd, i)}
            </div>
          </div>`;
        });
      }
    }

    // ③ 이번 주 수입 (공통 계산 함수 — 근태/SAO와 동일 기준)
    if(hasCE && typeof calcDayEarningsShared==='function'){
      const t0 = new Date(); const t = new Date(t0.getFullYear(), t0.getMonth(), t0.getDate());
      const dow = (t.getDay()+6)%7;
      let weekTotal = 0; const parts = [];
      CompanyEngine.companies().forEach(c => {
        let s = 0;
        for(let i=0;i<=dow;i++){
          const d = new Date(t.getFullYear(), t.getMonth(), t.getDate()-i);
          const rec = CompanyEngine.recOf(c.wpId, c.empId, d);
          if(rec && rec.start!==undefined && rec.start!==null && rec.end!==undefined && rec.end!==null){
            const e = CompanyEngine.runFor(c.wpId, c.empId, () => calcDayEarningsShared(rec, d, {wsKey:'atm2_workSession_'+c.wpId}));
            if(e) s += e.total;
          }
        }
        if(s>0){ weekTotal += s; parts.push(c.name+' '+fmt(s)); }
      });
      if(weekTotal>0){
        H += `<div class="mn-card"><div style="display:flex;justify-content:space-between;align-items:center;">
          <div class="mn-h" style="margin:0;">📅 이번 주 수입</div>
          <b style="font-family:'JetBrains Mono';color:var(--text);font-size:var(--font-md);">${fmt(weekTotal)}</b></div>
          ${parts.length>1?`<div class="mn-caption" style="margin-top:4px;">${parts.join(' · ')}</div>`:''}
        </div>`;
      }
    }

    // ⑥ AI 요약 — 전월 대비 한 줄 (캐릭터 컴포넌트)
    if(hasRec && typeof getPayDataForMonth==='function'){
      try{
        const pm = curM===0?11:curM-1, py = curM===0?curY-1:curY;
        let prev = 0;
        if(multi){ CompanyEngine.companies().forEach(c => { const p = CompanyEngine.runFor(c.wpId, c.empId, () => getPayDataForMonth(py, pm)); if(p) prev += p.finalPay||0; }); }
        else { const p = getPayDataForMonth(py, pm); prev = p ? (p.finalPay||0) : 0; }
        if(prev > 0 && total > 0){
          const pct = Math.round((total - prev) / prev * 100);
          const up = pct >= 0;
          const msg = pct===0 ? '이번 달 예상급여가 지난달과 같아요.'
            : `이번 달 예상급여는 지난달보다 <b style="color:${up?'var(--mn-success)':'var(--mn-error)'};">${up?'+':''}${pct}%</b> ${up?'증가':'감소'}했어요.`;
          H += `<div class="mn-card mn-card--flat" style="display:flex;gap:10px;align-items:center;background:var(--mn-brand-soft);border:none;">
            ${(typeof MnCharacter!=='undefined')?MnCharacter.img(up?'celebrate':'thinking','sm'):''}
            <div style="font-size:var(--font-sm);color:var(--text);line-height:1.5;">${msg}</div>
          </div>`;
        }
      }catch(e){}
    }
    return H;
  }catch(e){ return ''; }
}

// v3.2: 사업장별 예상급여 카드 (2개 이상일 때만) — CompanyEngine 반복 호출 재사용
function _coSalaryBreakdownCard(){
  try{
    if(typeof CompanyEngine==='undefined' || !CompanyEngine.isMulti()) return '';
    const all = CompanyEngine.getPayDataAll();
    if(!all.breakdown.length) return '';
    let rows = '';
    all.breakdown.forEach(b => {
      rows += `<div style="display:flex;justify-content:space-between;align-items:center;font-size:15px;padding:7px 0;border-bottom:1px solid var(--border);">
        <span style="color:var(--text2);">${b.wpId===activeWpId?'🏢':'📦'} ${b.name}${b.wpId===activeWpId?' <span style="font-size:11px;color:var(--accent);font-weight:700;">메인</span>':''}</span>
        <span style="text-align:right;"><span style="color:var(--text3);font-size:13px;">세전 ${fmt(b.grossPay)}</span><br><b style="color:var(--text);">실수령 ${fmt(b.finalPay)}</b></span>
      </div>`;
    });
    return `<div class="sal-section" style="margin-bottom:14px;">
      <h3>🏢 사업장별 예상급여</h3>
      ${rows}
      <div style="display:flex;justify-content:space-between;font-size:17px;font-weight:800;padding-top:10px;">
        <span>총합 (${all.breakdown.length}곳)</span><span style="color:var(--green);">${fmt(all.total)}</span>
      </div>
    </div>`;
  }catch(e){ return ''; }
}

function renderSalary(){
  const d=getPayData();
  const _hasAtt = (typeof _hasAttendance==='function') ? _hasAttendance() : true;

  // ── 전월 비교 계산 ──
  const prevM = curM === 0 ? 11 : curM - 1;
  const prevY = curM === 0 ? curY - 1 : curY;
  // 전월 데이터 임시 로드 (현재 dayData 보호)
  // ── 전월 급여: getPayDataForMonth 재사용으로 계산식 통일 ──
  let prevNetPay = 0;
  try {
    const prevStored = localStorage.getItem(`pay_prev_${curY}_${curM}`);
    if (prevStored && parseInt(prevStored) > 0) {
      // 이미 저장된 전월 실수령액 사용 (가장 정확)
      prevNetPay = parseInt(prevStored);
    } else {
      // 저장값 없으면 전월 dayData 로드 후 현재 계산식과 동일한 로직으로 산출
      // ★ v11 신규 키 우선, 구버전 키 fallback
      let prevDd = null;
      if(typeof activeWpId !== 'undefined' && activeWpId && typeof activeEmpId !== 'undefined' && activeEmpId){
        prevDd = localStorage.getItem(`atm2_att_${activeWpId}_${activeEmpId}_${prevY}_${pad2(prevM+1)}`);
      }
      if(!prevDd) prevDd = localStorage.getItem(ddKey(prevY, prevM));
      if (prevDd) {
        const prevDayData = JSON.parse(prevDd);
        const pdim = new Date(prevY, prevM+1, 0).getDate();
        let pNormalH=0, pOT=0, pNightH=0, pHolidayH=0, pSatH=0, pSunH=0;
        let pAbsDays=0, pEarlyDeduct=0, pLateDeduct=0;
        for(let dd2=1; dd2<=pdim; dd2++){
          const pk = `${prevY}-${pad2(prevM+1)}-${pad2(dd2)}`;
          const pd = prevDayData[pk];
          if(!pd||!pd.status||pd.status==='none') continue;
          const ps = pd.status;
          const pnet = calcNetHours(pd.start, pd.end, ps, pd.shift);
          if(ps==='work'||ps==='early'){ const ot=Math.max(0,pnet-8); pOT+=ot; pNormalH+=pnet-ot; }
          if(ps==='half') pNormalH+=4;
          if(ps==='absent') pAbsDays++;
          if(['work','early','sat_work','sun_work','holiday'].includes(ps)){
            const _pnb=getBreaks(pd.start,ps,pd.shift); pNightH+=calcNight(pd.start,pd.end,_pnb.snack||0);
          }
          if(ps==='sat_work') pSatH+=pnet;
          if(ps==='sun_work') pSunH+=pnet;
          if(ps==='holiday') pHolidayH+=pnet;
          if(ps==='early') pEarlyDeduct+=Math.max(0,8-pnet)*hourlyRate;
          if(wt==='day'&&(ps==='work'||ps==='early')&&pd.start>dayStart){
            pLateDeduct+=Math.ceil((pd.start-dayStart)/0.5)*0.5*hourlyRate;
          }
        }
        // 현재 getPayData와 동일한 계산식: 기본급 209h 고정
        const pBase    = hourlyRate * 209;
        const pDeduct  = pAbsDays*8*hourlyRate + pEarlyDeduct + pLateDeduct;
        const r10 = n => Math.round(n/10)*10;
        const pAllow   = r10(pOT*companyRate*1.5) + r10(pNightH*companyRate*0.5)
                       + r10(pHolidayH*companyRate*2) + r10(pSatH*companyRate*1.5) + r10(pSunH*companyRate*2);
        const pGross   = pBase + pAllow - pDeduct;
        // 4대보험도 동일 함수 사용
        const pInsObj  = calc4Insurance(pGross);
        const pTaxObj  = calcIncomeTax(pGross);
        prevNetPay     = Math.max(0, pGross - pInsObj.total - pTaxObj.total);
      }
    }
  }catch(e){}

  const diffPay   = d.finalPay - prevNetPay;
  const diffSign  = diffPay >= 0 ? '+' : '';
  const diffColor = diffPay > 0 ? 'var(--green)' : diffPay < 0 ? 'var(--red)' : 'var(--text3)';
  const diffIcon  = diffPay > 0 ? '▲' : diffPay < 0 ? '▼' : '━';
  const prevLabel = `${prevY}년 ${prevM+1}월`;
  const compareCard = (prevNetPay > 0 && _hasAtt) ? `
  <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:14px 18px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
    <div style="font-size:16px;color:var(--text2);">📊 전월(${prevLabel}) 대비</div>
    <div style="display:flex;align-items:center;gap:16px;">
      <div style="text-align:center;">
        <div style="font-size:14px;color:var(--text3);margin-bottom:2px;">${prevLabel}</div>
        <div style="font-size:20px;font-weight:700;font-family:'JetBrains Mono';color:var(--text2);">${fmt(prevNetPay)}</div>
      </div>
      <div style="font-size:26px;color:var(--text3);">→</div>
      <div style="text-align:center;">
        <div style="font-size:14px;color:var(--text3);margin-bottom:2px;">${curM+1}월</div>
        <div style="font-size:20px;font-weight:700;font-family:'JetBrains Mono';color:var(--green);">${fmt(d.finalPay)}</div>
      </div>
      <div style="text-align:center;min-width:80px;">
        <div style="font-size:23px;font-weight:900;font-family:'JetBrains Mono';color:${diffColor};">${diffIcon} ${diffSign}${fmt(Math.abs(diffPay))}</div>
        <div style="font-size:14px;color:${diffColor};margin-top:2px;">${diffPay===0?'전월 동일':diffPay>0?'전월보다 더 받음':'전월보다 덜 받음'}</div>
      </div>
    </div>
  </div>` : '';

  document.getElementById('salary-page').innerHTML=`
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
    <h2 style="font-size:26px;font-weight:700;">💰 ${curY}년 ${curM+1}월 급여 명세${typeof helpBtn==='function'?helpBtn('sal'):''}</h2>
    <div style="display:flex;gap:8px;">
      <button class="print-btn" onclick="printPayslip()">📄 명세서 출력</button>
      <button class="print-btn" onclick="window.print()">🖨️ 인쇄</button>
    </div>
  </div>
  ${_salRedesignTop()}
  ${(typeof renderNjobCombinedHTML==='function') ? renderNjobCombinedHTML() : ''}
  ${(typeof renderAnnualSalaryCardHTML==='function') ? renderAnnualSalaryCardHTML() : ''}
  ${renderSalaryAnalysis(d)}
  ${compareCard}
  <div style="background:rgba(255,209,102,.08);border:1px solid rgba(255,209,102,.25);border-radius:10px;padding:12px 16px;margin-bottom:16px;font-size:15px;color:var(--text3);line-height:1.8;">
    ※ 본 급여 계산은 <b style="color:var(--yellow)">참고용</b>입니다. 회사의 급여 규정에 따라 실제 지급액과 차이가 있을 수 있습니다.<br>
    일부 사업장은 주휴수당이 시급 또는 기본급에 포함되어 별도 항목으로 표시되지 않을 수 있습니다.
  </div>
  <div style="background:rgba(100,180,255,.07);border:1px solid rgba(100,180,255,.22);border-radius:10px;padding:12px 16px;margin-bottom:16px;font-size:15px;color:var(--text3);line-height:1.9;">
    🛡️ <b style="color:#7fb3ff;">4대보험 안내</b> — 아래 계산은 <b>법정 요율 기준 자동 산출값</b>이며, 실제 공제액과 다를 수 있습니다.<br>
    &nbsp;&nbsp;• 건강보험은 <b>전년도 보수총액</b> 기준 정산되므로 금액이 달라질 수 있어요.<br>
    &nbsp;&nbsp;• 국민연금·고용보험은 사업장별 기준월액·보수월액 산정 방식에 따라 차이가 납니다.<br>
    &nbsp;&nbsp;• 장기요양보험료율은 매년 변경될 수 있습니다.<br>
    &nbsp;&nbsp;→ 정확한 금액은 <b>회사 급여담당자</b> 또는 <b>4대보험 포털(EDI)</b>에서 확인하세요.
  </div>
  <div class="total-box">
    ${_hasAtt ? `
    <div class="lbl">이번달 예상 급여 <span style="font-size:15px;opacity:.7;">(세전)</span>${(typeof CompanyEngine!=='undefined'&&CompanyEngine.isMulti())?' <span style="font-size:13px;opacity:.6;">— 메인 사업장 상세</span>':''}</div>
    <div class="amt">${fmt(d.grossPay)}</div>
    <div style="font-size:16px;color:var(--text2);margin-top:8px;">
      4대보험 -${fmt(d.ins.total)} · 세금 -${fmt(d.tax.total)} 공제
    </div>
    <div style="font-size:18px;color:var(--green);margin-top:6px;font-weight:700;">
      → 실수령 예상 <span style="font-family:'JetBrains Mono';">${fmt(d.finalPay)}</span>
    </div>
    <div style="margin-top:6px;font-size:15px;color:${weeklyOn?'#7fffd4':'var(--text3)'};">${weeklyOn?'🌟 주휴수당 '+fmt(d.aWeeklyManual)+' 포함':'💡 주휴수당 OFF'} | 기본급 ${fmt(d.basePay)}</div>
    <div style="margin-top:4px;font-size:15px;color:${d.perfectApplied?'var(--yellow)':'var(--text3)'};">${d.perfectApplied?'🏅 만근수당 '+fmt(d.perfAmt)+' 포함'+(perfectOn?' (직접입력)':' (달력기준)'):'🏅 만근수당 미적용'}</div>
    ` : `
    <div class="lbl">예상 실수령액</div>
    <div style="font-size:16px;color:var(--text3);margin-top:8px;line-height:1.6;">아직 이번달 출근 기록이 없어요.<br>근태 탭에서 출근을 기록하면 바로 계산해드릴게요!</div>
    `}
  </div>
  <div class="two-col">
    <div class="sal-section">
      <h3>📌 기본급</h3>
      <!-- 법정 최저시급 -->
      <div class="hrly-row">
        <div>
          <label style="font-size:17px;font-weight:700;">① 법정 최저시급 <span style="font-size:15px;color:var(--text3);font-weight:400;">(2026년 기준 10,320원)</span></label>
          <div style="font-size:14px;color:var(--text3);margin-top:2px;">기본급(209h) 계산 기준</div>
        </div>
        <div style="display:flex;align-items:center;gap:6px;">
          <input class="hrly-inp" type="number" id="hrly-inp" value="${hourlyRate}" step="1"
            onchange="hourlyRate=Math.round(parseFloat(this.value)||CURRENT_MIN_WAGE);if(activeWpId&&activeEmpId)empUpdate(activeWpId,activeEmpId,{hourlyRate});lsSave();renderSalary()">
          <span style="font-size:17px;color:var(--text3);">원</span>
        </div>
      </div>
      <!-- 회사 실제 시급 -->
      <div class="hrly-row" style="margin-top:6px;">
        <div>
          <label style="font-size:17px;font-weight:700;">② 회사 실제 시급</label>
          <div style="font-size:14px;color:var(--text3);margin-top:2px;">OT·야간·휴일 등 추가수당 계산 기준</div>
        </div>
        <div style="display:flex;align-items:center;gap:6px;">
          <input class="hrly-inp" type="number" id="company-rate-inp" value="${companyRate}" step="1"
            onchange="companyRate=Math.round(parseFloat(this.value)||hourlyRate);if(activeWpId&&activeEmpId)empUpdate(activeWpId,activeEmpId,{companyRate});lsSave();renderSalary()">
          <span style="font-size:17px;color:var(--text3);">원</span>
        </div>
      </div>
      <div style="margin:8px 0 10px;padding:8px 10px;background:rgba(255,209,102,.07);border-left:3px solid rgba(255,209,102,.4);border-radius:4px;font-size:14px;color:var(--text3);line-height:1.7;">
        ① 법정 최저시급: 기본급(시급 × 209h) 계산에만 사용<br>
        ② 회사 실제 시급: OT·야간·휴일·특근 등 <b style="color:var(--yellow)">추가수당 계산</b>에 사용<br>
        두 값이 같으면 ②를 ①과 동일하게 설정하세요
      </div>
      <div class="hrly-row" style="margin-bottom:10px;">
        <label style="font-size:17px;color:var(--text2);">휴게공제</label>
        <span style="font-size:16px;font-family:'JetBrains Mono';font-weight:700;color:var(--yellow);">점심 ${lunchBreak}h(주간·A조) / 저녁·야식 ${DINNER_BREAK}h(야간·B조·C조)</span>
      </div>
      <div class="sal-row">
        <div><div class="nm">기본급</div><div class="cl">① ${hourlyRate.toLocaleString()}원 × 209h (법정시급 기준 고정)</div></div>
        <div class="sal-amt" style="color:var(--green)">${fmt(d.basePay)}</div>
      </div>
      <div class="sal-row">
        <div class="nm" style="font-size:15px;color:var(--text3);line-height:1.9">
          근무일 ${d.wDays}/${d.twd}일 &nbsp;|&nbsp; 실근무 ${d.normalH}h &nbsp;|&nbsp; OT ${d.totOT}h<br>
          야간 ${d.nightH}h &nbsp;|&nbsp; 휴일 ${d.holidayH}h<br>
          🔵토요특근 ${d.satH}h &nbsp;|&nbsp; 🔴일요특근 ${d.sunH}h
        </div>
      </div>
    </div>
    <div class="sal-section">
      <h3>📉 근태 공제</h3>
      <div class="sal-row">
        <div><div class="nm">연차</div><div class="cl" style="color:var(--green)">유급 처리 → 공제 없음</div></div>
        <div class="sal-amt" style="color:var(--text3)">—</div>
      </div>
      <div class="sal-row">
        <div><div class="nm">반차</div><div class="cl" style="color:var(--green)">유급 처리 → 공제 없음</div></div>
        <div class="sal-amt" style="color:var(--text3)">—</div>
      </div>
      <div class="sal-row">
        <div><div class="nm">법정공휴일</div><div class="cl" style="color:var(--green)">유급 처리 → 공제 없음</div></div>
        <div class="sal-amt" style="color:var(--text3)">—</div>
      </div>
      <div class="sal-row">
        <div><div class="nm">결근 공제</div><div class="cl">${d.absDays}일 × 8h × ${hourlyRate.toLocaleString()}</div></div>
        <div class="sal-amt" style="color:${d.dAbsent>0?'var(--red)':'var(--text3)'};">${d.dAbsent>0?'-'+fmt(d.dAbsent):'—'}</div>
      </div>
      <div class="sal-row">
        <div><div class="nm">조퇴 공제</div><div class="cl">정상근무(8h) - 실근무시간 × ${hourlyRate.toLocaleString()}</div></div>
        <div class="sal-amt" style="color:${d.dEarly>0?'var(--red)':'var(--text3)'};">${d.dEarly>0?'-'+fmt(d.dEarly):'—'}</div>
      </div>
      <div class="sal-row">
        <div><div class="nm">지각 공제</div><div class="cl">${d.lateCount>0?d.lateCount+'회 · 30분 단위 올림':'지각 없음'} ${d.lateCount>0?'× '+hourlyRate.toLocaleString()+'원':''}</div></div>
        <div class="sal-amt" style="color:${d.dLate>0?'var(--red)':'var(--text3)'};">${d.dLate>0?'-'+fmt(d.dLate):'—'}</div>
      </div>
      <div class="sal-row" style="border-top:1px solid var(--border);margin-top:4px;padding-top:10px;">
        <div class="nm" style="font-weight:700;">공제 합계</div>
        <div class="sal-amt" style="color:${d.totDeduct>0?'var(--red)':'var(--text3)'};font-size:23px;">${d.totDeduct>0?'-'+fmt(d.totDeduct):'0원'}</div>
      </div>
    </div>
  </div>
  <div class="sal-section">
    <h3>💎 추가 수당</h3>
    <div class="allow-grid">
      ${aC('연장수당(OT)','×1.5',`OT ${d.totOT}h × ${d._companyRate.toLocaleString()} × 1.5 (10원 단위 반올림)`,d.aOT,'var(--yellow)')}
      ${aC('야간수당','×0.5 할증',`야간 ${d.nightH}h × ${d._companyRate.toLocaleString()} × 0.5`,d.aNight,'var(--cyan)')}
      ${aC('휴일수당','8h↑×2.0',`휴일 ${d.holidayH}h (8h 이내 × 1.5, 초과분 × 2.0)`,d.aHoliday,'var(--accent2)')}
      ${aC('🔵 토요특근수당','자동',`${d.satH}h × ${d._companyRate.toLocaleString()} × 1.5`,d.aSat,'var(--sat)')}
      ${aC('🔴 일요특근수당','8h↑×2.0',`${d.sunH}h (8h 이내 × 1.5, 초과분 × 2.0)`,d.aSun,'var(--sun)')}
      ${eC('tenure','근속수당','직접 입력')}
      <!-- 주휴수당 별도 계산 체크박스 -->
      <div style="grid-column:1/-1;padding:10px 14px 4px;display:flex;flex-direction:column;gap:6px;">
        <label style="display:flex;align-items:center;gap:10px;cursor:pointer;">
          <input type="checkbox" id="whe-toggle"
            ${(weeklyHolidayEnabled !== false) ? 'checked' : ''}
            onchange="weeklyHolidayEnabled=this.checked;lsSave();renderSalary();"
            style="width:18px;height:18px;accent-color:#7fffd4;cursor:pointer;">
          <span style="font-size:16px;font-weight:700;color:var(--text);">주휴수당 별도 표시</span>
        </label>
        <div style="font-size:12px;color:var(--text3);padding-left:28px;">
          체크 해제 시 주휴수당이 시급에 포함된 것으로 간주하며 별도 표시하지 않습니다.
        </div>
      </div>
      <div class="allow-card" style="grid-column:1/-1;display:${(weeklyHolidayEnabled !== false)?'flex':'none'};background:${weeklyOn?'rgba(127,255,212,.08)':'rgba(255,255,255,.03)'};border:1px solid ${weeklyOn?'rgba(127,255,212,.3)':'var(--border)'};transition:all .25s;">
        <div style="flex:1;">
          <div class="nm" style="display:flex;align-items:center;gap:10px;">
            🌟 주휴수당
            <button onclick="weeklyOn=!weeklyOn;lsSave();renderSalary();"
              style="display:inline-flex;align-items:center;gap:6px;padding:3px 12px;border-radius:20px;font-size:15px;font-weight:700;border:none;cursor:pointer;transition:all .2s;
              background:${weeklyOn?'rgba(127,255,212,.25)':'rgba(255,255,255,.08)'};
              color:${weeklyOn?'#7fffd4':'var(--text3)'};">
              ${weeklyOn?'ON ✅':'OFF ⬜'}
            </button>
          </div>
          <div class="cl" style="margin-top:4px;">
            ${weeklyOn
              ? '직접 입력 모드 — 아래에 금액을 입력하세요'
              : '주휴수당 미적용 — ON으로 켜면 직접 입력 가능'}
          </div>
          ${weeklyOn ? `<div style="margin-top:8px;display:flex;align-items:center;gap:8px;">
            <input class="editable" type="number" data-allow="weekly"
              value="${allowances.weekly||0}"
              placeholder="주휴수당 금액 입력"
              style="width:160px;font-size:18px;"
              onchange="allowances.weekly=parseFloat(this.value)||0;lsSave();renderSalary()">
            <span style="font-size:16px;color:var(--text3);">원</span>
          </div>` : ''}
        </div>
        <div class="sal-amt" style="color:${weeklyOn?'#7fffd4':'var(--text3)'};">
          ${weeklyOn ? '+'+fmt(d.aWeeklyManual) : '—'}
        </div>
      </div>
      <div class="allow-card" style="grid-column:1/-1;background:${perfectOn?'rgba(255,209,102,.08)':'rgba(255,255,255,.03)'};border:1px solid ${perfectOn?'rgba(255,209,102,.35)':'var(--border)'};transition:all .25s;">
        <div style="flex:1;">
          <div class="nm" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            🏅 만근수당
            <span style="font-size:14px;background:${d.isPerfect?'rgba(61,214,140,.15)':'rgba(255,92,122,.12)'};color:${d.isPerfect?'var(--green)':'var(--red)'};padding:1px 6px;border-radius:4px;">
              ${d.isPerfect?'📅 달력기준 만근':'📅 달력기준 미달'}
            </span>
            <button onclick="perfectOn=!perfectOn;lsSave();renderSalary();"
              style="display:inline-flex;align-items:center;gap:6px;padding:3px 12px;border-radius:20px;font-size:15px;font-weight:700;border:none;cursor:pointer;transition:all .2s;
              background:${perfectOn?'rgba(255,209,102,.28)':'rgba(255,255,255,.08)'};
              color:${perfectOn?'var(--yellow)':'var(--text3)'};">
              ${perfectOn?'직접입력 ON ✅':'직접입력 OFF ⬜'}
            </button>
          </div>
          <div class="cl" style="margin-top:4px;">
            ${perfectOn
              ? '달력 기록과 무관하게 강제 적용 중 — 아래 금액이 급여에 더해집니다'
              : (d.isPerfect ? '달력상 만근 충족 → 아래 금액이 자동 적용됩니다' : '달력상 만근 미달 → 미적용 (직접입력 ON으로 강제 적용 가능)')}
          </div>
          <div style="margin-top:8px;display:flex;align-items:center;gap:8px;">
            <input class="editable" type="number" data-allow="perfect"
              value="${allowances.perfect||0}"
              placeholder="만근수당 금액 입력"
              style="width:160px;font-size:18px;"
              onchange="allowances.perfect=parseInt(this.value)||0;lsSave();renderSalary()">
            <span style="font-size:16px;color:var(--text3);">원</span>
          </div>
        </div>
        <div class="sal-amt" style="color:${d.perfectApplied?'var(--green)':'var(--text3)'};">
          ${d.perfectApplied ? '+'+fmt(d.perfAmt) : '—'}
        </div>
      </div>
      ${eC('other','기타수당','위험/자재 등')}
    </div>
  </div>
  <div class="sal-section">
    <h3>📊 급여 요약 (세전 → 세후)</h3>
    <div class="sal-row"><div class="nm">기본급 <span style="font-size:14px;color:var(--text3);">209h 고정</span></div><div class="sal-amt" style="color:var(--green)">+ ${fmt(d.basePay)}</div></div>
    ${weeklyOn&&d.aWeeklyManual>0?`<div class="sal-row"><div class="nm">🌟 주휴수당</div><div class="sal-amt" style="color:#7fffd4">+ ${fmt(d.aWeeklyManual)}</div></div>`:''}
    <div class="sal-row"><div class="nm">추가 수당 합계</div><div class="sal-amt" style="color:var(--accent)">+ ${fmt(d.totAllow)}</div></div>
    <div class="sal-row"><div class="nm">근태 공제</div><div class="sal-amt" style="color:var(--red)">- ${fmt(d.totDeduct)}</div></div>
    <div class="sal-row" style="border-top:1px solid var(--border);margin-top:4px;padding-top:10px;">
      <div class="nm" style="font-weight:700;">총급여 (세전)</div>
      <div class="sal-amt" style="color:var(--yellow);font-size:23px;">${fmt(d.grossPayWithWH)}</div>
    </div>
  </div>

  <!-- 4대보험 공제 -->
  <div class="sal-section">
    <h3>🛡️ 4대보험 공제
      <span style="font-size:14px;font-weight:400;color:var(--text3);">(2025년 기준 자동계산 · 수정 가능)</span>
      <button onclick="insOverride={np:null,hi:null,ltc:null,ei:null};lsSave();renderSalary();"
        style="margin-left:8px;font-size:14px;padding:2px 8px;border-radius:12px;border:1px solid var(--border);background:var(--surface2);color:var(--text3);cursor:pointer;">↺ 자동계산으로</button>
    </h3>
    <div id="ins-edit-grid"></div>
    <div class="sal-row" style="border-top:1px solid var(--border);margin-top:8px;padding-top:10px;">
      <div class="nm" style="font-weight:700;">4대보험 합계</div>
      <div class="sal-amt" style="color:var(--red);font-size:23px;">- ${fmt(d.ins.total)}</div>
    </div>
  </div>

  <!-- 소득세 공제 -->
  <div class="sal-section">
    <h3>📋 근로소득세
      <span style="font-size:14px;font-weight:400;color:var(--text3);">(간이세액 자동계산 · 수정 가능)</span>
      <button onclick="taxOverride={income:null,local:null};lsSave();renderSalary();"
        style="margin-left:8px;font-size:14px;padding:2px 8px;border-radius:12px;border:1px solid var(--border);background:var(--surface2);color:var(--text3);cursor:pointer;">↺ 자동계산으로</button>
    </h3>
    <div id="tax-edit-grid"></div>
    <div class="sal-row" style="border-top:1px solid var(--border);margin-top:8px;padding-top:10px;">
      <div class="nm" style="font-weight:700;">세금 합계</div>
      <div class="sal-amt" style="color:var(--red);font-size:23px;">- ${fmt(d.tax.total)}</div>
    </div>
  </div>


  <!-- 주휴수당 상세 (별도 계산 ON + weeklyOn 상태일 때만 표시) -->
  ${(weeklyHolidayEnabled !== false) && weeklyOn ? `<div class="sal-section" style="border:1px solid rgba(127,255,212,.3);">
    <h3>🌟 주휴수당 상세 <span style="font-size:14px;font-weight:400;color:var(--text3);">(주 15h 이상 + 개근 조건 참고용)</span></h3>
    <div id="weekly-detail-body"></div>
  </div>` : ''}

  <!-- 최종 실수령액 -->
  <div class="sal-section" style="border:2px solid var(--green);">
    <h3>✅ 최종 실수령액 계산</h3>
    <div class="sal-row"><div class="nm">총급여 (세전)</div><div class="sal-amt" style="color:var(--yellow)">+ ${fmt(d.grossPay)}</div></div>
    <div class="sal-row"><div class="nm">4대보험 공제</div><div class="sal-amt" style="color:var(--red)">- ${fmt(d.ins.total)}</div></div>
    <div class="sal-row"><div class="nm">근로소득세 + 지방세</div><div class="sal-amt" style="color:var(--red)">- ${fmt(d.tax.total)}</div></div>
    <div class="sal-row" style="border-top:2px solid var(--green);margin-top:8px;padding-top:14px;">
      <div class="nm" style="font-size:23px;font-weight:900;">🏦 최종 실수령액</div>
      <div class="sal-amt" style="color:var(--green);font-size:32px;font-weight:900;">${fmt(d.finalPay)}</div>
    </div>
    <div style="margin-top:10px;padding:10px;background:rgba(61,214,140,.06);border-radius:8px;font-size:15px;color:var(--text3);line-height:1.8;">
      총공제: ${fmt(d.ins.total + d.tax.total)} &nbsp;|&nbsp;
      실수령률: ${((d.finalPay/d.grossPay)*100).toFixed(1)}%
    </div>
  </div>`;
  document.querySelectorAll('[data-allow]').forEach(el=>{ el.value=allowances[el.dataset.allow]||0; });
  renderWeeklyDetail(d.wd);
  renderInsEdit(d);
}

// ══════════════════════════════════════════
// 4대보험 / 세금 수정 가능 그리드 렌더링
// ══════════════════════════════════════════
function renderInsEdit(d){
  // 4대보험
  var insEl = document.getElementById('ins-edit-grid');
  if(insEl){
    var items = [
      {key:'np',   label:'국민연금',    tag:'× 4.5%',         auto:d.ins._np,  color:'var(--accent)'},
      {key:'hi',   label:'건강보험',    tag:'× 3.545%',        auto:d.ins._hi,  color:'var(--accent2)'},
      {key:'ltc',  label:'장기요양',    tag:'건강보험료 × 12.95%', auto:d.ins._ltc, color:'var(--cyan)'},
      {key:'ei',   label:'고용보험',    tag:'× 0.9%',          auto:d.ins._ei,  color:'var(--sat)'},
    ];
    var html = '<div style="display:grid;gap:8px;">';
    items.forEach(function(it){
      var isModified = insOverride[it.key] !== null;
      var dispVal = isModified ? insOverride[it.key] : it.auto;
      html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.04);">'
        + '<div style="flex:1;">'
        + '<div style="font-size:18px;color:var(--text2);">' + it.label
        + ' <span style="font-size:14px;background:rgba(255,92,122,.12);color:var(--red);padding:1px 5px;border-radius:4px;">' + it.tag + '</span>'
        + (isModified ? ' <span style="font-size:14px;color:var(--yellow);">✏️ 수정됨</span>' : '')
        + '</div>'
        + '<div style="font-size:15px;color:var(--text3);margin-top:2px;">자동: ' + Math.round(it.auto).toLocaleString('ko-KR') + '원</div>'
        + '</div>'
        + '<div style="display:flex;align-items:center;gap:6px;">'
        + '<input type="number" value="' + Math.round(dispVal) + '" min="0" step="1"'
        + ' style="width:110px;text-align:right;padding:6px 8px;border-radius:8px;border:1px solid '+(isModified?'var(--yellow)':'var(--border)')+';background:var(--surface2);color:var(--text);font-family:JetBrains Mono,monospace;font-size:17px;font-weight:700;"'
        + ' onchange="insOverride[\'' + it.key + '\']=parseFloat(this.value);lsSave();renderSalary();">'
        + '<span style="font-size:16px;color:var(--text3);">원</span>'
        + '</div>'
        + '</div>';
    });
    html += '</div>';
    insEl.innerHTML = html;
  }

  // 소득세
  var taxEl = document.getElementById('tax-edit-grid');
  if(taxEl){
    var taxItems = [
      {key:'income', label:'근로소득세', tag:'간이세액',   auto:d.tax._income, color:'var(--orange)'},
      {key:'local',  label:'지방소득세', tag:'× 10%',      auto:d.tax._local,  color:'var(--yellow)'},
    ];
    var thtml = '<div style="display:grid;gap:8px;">';
    taxItems.forEach(function(it){
      var isModified = taxOverride[it.key] !== null;
      var dispVal = isModified ? taxOverride[it.key] : it.auto;
      thtml += '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.04);">'
        + '<div style="flex:1;">'
        + '<div style="font-size:18px;color:var(--text2);">' + it.label
        + ' <span style="font-size:14px;background:rgba(255,92,122,.12);color:var(--red);padding:1px 5px;border-radius:4px;">' + it.tag + '</span>'
        + (isModified ? ' <span style="font-size:14px;color:var(--yellow);">✏️ 수정됨</span>' : '')
        + '</div>'
        + '<div style="font-size:15px;color:var(--text3);margin-top:2px;">자동: ' + Math.round(it.auto).toLocaleString('ko-KR') + '원</div>'
        + '</div>'
        + '<div style="display:flex;align-items:center;gap:6px;">'
        + '<input type="number" value="' + Math.round(dispVal) + '" min="0" step="1"'
        + ' style="width:110px;text-align:right;padding:6px 8px;border-radius:8px;border:1px solid '+(isModified?'var(--yellow)':'var(--border)')+';background:var(--surface2);color:var(--text);font-family:JetBrains Mono,monospace;font-size:17px;font-weight:700;"'
        + ' onchange="taxOverride[\'' + it.key + '\']=parseFloat(this.value);lsSave();renderSalary();">'
        + '<span style="font-size:16px;color:var(--text3);">원</span>'
        + '</div>'
        + '</div>';
    });
    thtml += '</div>';
    taxEl.innerHTML = thtml;
  }
}

// 주휴수당 상세 렌더링 (별도 함수 - 템플릿 리터럴 충돌 방지)
function renderWeeklyDetail(wd){
  var el = document.getElementById('weekly-detail-body');
  if(!el) return;
  var activeWeeks = wd.weeks.filter(function(w){ return w.workDayCount > 0 || w.hasAbsent; });
  if(activeWeeks.length === 0){
    el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text3);font-size:17px;">이달 근무 기록이 없습니다.</div>';
    return;
  }
  var html = '<div style="display:grid;gap:8px;">';
  activeWeeks.forEach(function(w){
    var ok   = w.holidayOk;
    var prog = !!w.isFutureWeek; // 아직 끝나지 않은 주 — 미달이 아니라 진행중(미확정)
    var bgC  = ok ? 'rgba(127,255,212,.08)' : prog ? 'rgba(255,200,80,.06)' : 'rgba(255,92,122,.05)';
    var bdC  = ok ? 'rgba(127,255,212,.25)' : prog ? 'rgba(255,200,80,.25)' : 'rgba(255,92,122,.2)';
    var icon = ok ? '&#x2705;' : prog ? '&#x23F3;' : '&#x274C;';
    var badge = ok
      ? '<span style="background:rgba(127,255,212,.2);color:#7fffd4;padding:2px 8px;border-radius:20px;font-size:14px;font-weight:700;">주휴 발생</span>'
      : prog
      ? '<span style="background:rgba(255,200,80,.2);color:#ffc850;padding:2px 8px;border-radius:20px;font-size:14px;font-weight:700;">진행중</span>'
      : '<span style="background:rgba(255,92,122,.15);color:var(--red);padding:2px 8px;border-radius:20px;font-size:14px;font-weight:700;">주휴 없음</span>';
    var c1c = w.cond1 ? '#7fffd4' : 'var(--red)';
    var c1m = (w.cond1 ? '&#x2713; 주 ' : '&#x2717; 주 ') + w.totalH.toFixed(1) + 'h (' + (w.cond1 ? '15h 이상' : '15h 미만') + ')';
    var c2c = w.cond2 ? '#7fffd4' : 'var(--red)';
    var c2m = w.cond2 ? '&#x2713; 개근' : '&#x2717; 결근 있음';
    var amtStr   = ok ? ('+' + fmt(w.amount)) : prog ? '확정전' : '&#x2014;';
    var amtColor = ok ? '#7fffd4' : prog ? '#ffc850' : 'var(--text3)';
    html += '<div style="background:' + bgC + ';border:1px solid ' + bdC + ';border-radius:10px;padding:12px 14px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">'
      + '<div style="flex:1;min-width:120px;">'
      + '<div style="font-size:17px;font-weight:700;margin-bottom:4px;">' + icon + ' ' + w.weekLabel + ' ' + badge + '</div>'
      + '<div style="font-size:15px;display:flex;gap:12px;flex-wrap:wrap;">'
      + '<span style="color:' + c1c + ';">' + c1m + '</span>'
      + '<span style="color:' + c2c + ';">' + c2m + '</span>'
      + '</div></div>'
      + '<div style="font-family:JetBrains Mono,monospace;font-weight:700;font-size:20px;color:' + amtColor + ';">' + amtStr + '</div>'
      + '</div>';
  });
  html += '</div>';
  if(wd.qualCount > 0){
    html += '<div style="margin-top:12px;padding:10px 14px;background:rgba(127,255,212,.1);border-radius:8px;display:flex;justify-content:space-between;align-items:center;">'
      + '<span style="font-size:17px;font-weight:700;color:#7fffd4;">총 주휴수당 (' + wd.qualCount + '주)</span>'
      + '<span style="font-family:JetBrains Mono,monospace;font-size:23px;font-weight:900;color:#7fffd4;">+ ' + fmt(wd.totalWeeklyAmt) + '</span>'
      + '</div>';
  } else {
    html += '<div style="margin-top:10px;padding:10px;text-align:center;font-size:16px;color:var(--red);">이달 주휴수당 발생 조건 미충족</div>';
  }
  el.innerHTML = html;
}

function aC(label,tag,calc,amt,color){
  return `<div class="allow-card"><div><div class="nm">${label} <span style="font-size:14px;background:rgba(61,214,140,.15);color:var(--green);padding:1px 5px;border-radius:4px;">${tag}</span></div><div class="cl">${calc}</div></div><div class="sal-amt" style="color:${color}">${fmt(amt)}</div></div>`;
}
function eC(key,label,hint){
  return `<div class="allow-card"><div><div class="nm">${label}</div><div class="cl">${hint}</div></div><input class="editable" type="number" data-allow="${key}" value="${allowances[key]||0}" onchange="allowances['${key}']=parseInt(this.value)||0;lsSave();renderSalary()"></div>`;
}
function insCard(label, tag, calc, amt, color){
  return `<div class="allow-card"><div><div class="nm">${label} <span style="font-size:14px;background:rgba(255,92,122,.12);color:var(--red);padding:1px 5px;border-radius:4px;">${tag}</span></div><div class="cl">${calc}</div></div><div class="sal-amt" style="color:${color}">- ${fmt(amt)}</div></div>`;
}

// ══════════════════════════════════════════
// 연봉제 카드 + N잡 합산 헤더 (v2.0 — FR-350~355, FR-340)
// ══════════════════════════════════════════

// 연봉제 월 급여 카드 HTML — 연봉제 미선택 시 ''
function renderAnnualSalaryCardHTML(){
  const jobs = (typeof loadSelectedJobs==='function') ? loadSelectedJobs() : [];
  if(jobs.indexOf('salary') < 0) return '';
  const sd = (typeof getSalaryPayData==='function') ? getSalaryPayData() : {configured:false};
  if(!sd.configured){
    return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:18px;margin-bottom:14px;text-align:center;">
      <div style="font-size:17px;font-weight:700;color:var(--text);margin-bottom:6px;">💼 연봉제 급여</div>
      <div style="font-size:15px;color:var(--text3);line-height:1.6;margin-bottom:12px;">아직 연봉이 설정되지 않았어요.<br>연봉을 입력하면 월급·공제·실수령액을 계산해드려요!</div>
      <button onclick="showPage('settings');if(typeof renderSettingsPage==='function')renderSettingsPage();"
        style="padding:10px 20px;border-radius:8px;border:none;background:var(--accent);color:#fff;font-size:16px;font-weight:700;cursor:pointer;font-family:'Noto Sans KR';">⚙️ 연봉 설정하기</button>
    </div>`;
  }
  return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:18px;margin-bottom:14px;">
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px;margin-bottom:12px;">
      <div style="font-size:17px;font-weight:700;color:var(--text);">💼 연봉제 급여 <span style="font-size:14px;color:var(--text3);font-weight:400;">연봉 ${fmt(sd.annual)}</span></div>
      ${sd.inclusiveOT ? '<span style="font-size:13px;background:rgba(255,159,67,.15);color:#ff9f43;border-radius:10px;padding:3px 9px;font-weight:700;">포괄임금제</span>' : ''}
    </div>
    <div style="display:flex;justify-content:space-between;font-size:16px;color:var(--text2);padding:5px 0;"><span>월급 (연봉 ÷ 12, 세전)</span><b style="color:var(--text);font-family:'JetBrains Mono';">${fmt(sd.monthly)}</b></div>
    ${sd.nonTax>0 ? `<div style="display:flex;justify-content:space-between;font-size:15px;color:var(--text3);padding:4px 0;"><span>비과세 (식대·교통비)</span><span style="font-family:'JetBrains Mono';">${fmt(sd.nonTax)}</span></div>` : ''}
    <div style="border-top:1px solid var(--border);margin:8px 0;"></div>
    <div style="display:flex;justify-content:space-between;font-size:15px;color:var(--text2);padding:3px 0;"><span>국민연금 (4.5%)</span><span style="color:var(--red);font-family:'JetBrains Mono';">- ${fmt(sd.ins.np)}</span></div>
    <div style="display:flex;justify-content:space-between;font-size:15px;color:var(--text2);padding:3px 0;"><span>건강보험 (3.545%)</span><span style="color:var(--red);font-family:'JetBrains Mono';">- ${fmt(sd.ins.hi)}</span></div>
    <div style="display:flex;justify-content:space-between;font-size:15px;color:var(--text2);padding:3px 0;"><span>장기요양 (건보의 12.95%)</span><span style="color:var(--red);font-family:'JetBrains Mono';">- ${fmt(sd.ins.ltc)}</span></div>
    <div style="display:flex;justify-content:space-between;font-size:15px;color:var(--text2);padding:3px 0;"><span>고용보험 (0.9%)</span><span style="color:var(--red);font-family:'JetBrains Mono';">- ${fmt(sd.ins.ei)}</span></div>
    <div style="display:flex;justify-content:space-between;font-size:15px;color:var(--text2);padding:3px 0;"><span>소득세+지방세 (간이세액표${sd.dependents>1?' · 부양 '+sd.dependents+'명':''})</span><span style="color:var(--red);font-family:'JetBrains Mono';">- ${fmt(sd.tax.total)}</span></div>
    <div style="border-top:1px solid var(--border);margin:8px 0;"></div>
    <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;">
      <span style="font-size:17px;font-weight:700;color:var(--text);">월 실수령액</span>
      <b style="font-size:22px;color:var(--green);font-family:'JetBrains Mono';">${fmt(sd.netPay)}</b>
    </div>
  </div>`;
}

// N잡 합산 헤더 HTML — 수입원 2개 미만이면 ''
function renderNjobCombinedHTML(){
  if(typeof getIncomeSummary !== 'function') return '';
  let s;
  try{ s = getIncomeSummary(curY, curM); }catch(e){ return ''; }
  if(!s) return '';
  const parts = [
    { key:'employee',   icon:'🏢', label:'시급제',  amt:s.employee },
    { key:'salary',     icon:'💼', label:'연봉제',  amt:s.salary||0 },
    { key:'alba',       icon:'💪', label:'알바',    amt:s.alba },
    { key:'freelancer', icon:'💻', label:'프리랜서', amt:s.freelancer },
    { key:'etc',        icon:'➕', label:'배달·기타', amt:s.etc },
  ].filter(p=>p.amt > 0);
  if(parts.length < 2) return '';
  const chips = parts.map(p=>`<div style="display:inline-flex;align-items:center;gap:5px;padding:5px 11px;border-radius:20px;background:rgba(0,0,0,.06);border:1px solid var(--border);font-size:15px;font-weight:600;color:var(--text);">${p.icon} ${p.label} <b style="color:var(--green);font-family:'JetBrains Mono';">${p.amt.toLocaleString('ko-KR')}원</b></div>`).join('');
  return `<div style="background:linear-gradient(135deg,rgba(79,124,255,.1),rgba(61,214,140,.08));border:1px solid rgba(79,124,255,.25);border-radius:var(--radius);padding:16px 18px;margin-bottom:14px;">
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:10px;">
      <div style="font-size:16px;font-weight:700;color:var(--text);">🔗 N잡 합산 수입 (이번달)</div>
      <div style="font-size:24px;font-weight:900;color:var(--accent);font-family:'JetBrains Mono';">${s.total.toLocaleString('ko-KR')}원</div>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:6px;">${chips}</div>
  </div>`;
}

// ══════════════════════════════════════════
// INIT (PWA manifest 초기화 — 실제 init은 아래 통합 블록에서)
// ══════════════════════════════════════════
// ★ Fix #23: 로고가 실제로 있을 때만 updateManifest 호출 (Blob URL 낭비 방지)
try {
  const _savedLogo = localStorage.getItem('companyLogo');
  if(_savedLogo) updateManifest(_savedLogo);
} catch(e){}

// ══════════════════════════════════════════
