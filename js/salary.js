// 주휴수당 계산 (한국 노동법 기준)
// ══════════════════════════════════════════
/**
 * getWeekRanges(y, m): 해당 월(0-indexed)에 "귀속"되는 모든 ISO주(월~일)를 반환하는 공용 헬퍼.
 *
 * 귀속 규칙(★ 중요 — 직장인/회사알바/일반알바/N잡알바 주휴수당 계산이 모두 이 규칙에 의존함)
 * - 한 주의 귀속월 = 그 주의 월요일이 속한 달. 정확히 1개월에만 귀속되고 중복되지 않음.
 *   → 이번 달 1일이 속한 주의 월요일이 전월이면, 그 주는 "전월 귀속"이라 이번 달 결과에서 제외.
 *   → 이번 달 말일이 속한 주는 월요일이 항상 이번 달 안에 있으므로(월요일은 그 주의 어떤 날보다도
 *     앞서거나 같아 다음 달로 넘어갈 수 없음) 항상 이번 달에 포함되고, 그 주의 화~일이 다음 달로
 *     넘어가더라도(예: 2026-08-31(월)~09-06(일)) 그 주 전체가 "8월의 한 주"로만 1번 계산됨.
 * - 이 규칙 덕분에 매월 getWeekRanges(y,m)을 독립적으로 호출해 결과를 단순 합산해도
 *   (연간요약처럼) 같은 주가 두 달에 걸쳐 중복 계산되는 일이 없음.
 * - 연/월 경계(예: 2026-12-28~2027-01-03)는 JS Date의 자체 정규화(setDate 오버플로 시 연/월
 *   자동 보정)를 그대로 활용 — 별도의 m+1/y+1 분기 처리를 직접 작성하지 않아도 안전하게 처리됨.
 *
 * 각 주 객체:
 * - weekKey: 월요일 날짜('YYYY-MM-DD') — 주 식별자
 * - weekLabel: 'M/D주' 표시용 라벨
 * - days: 월~일 7일 전체({y,m,d,dateKey,dow}) — 전월/익월로 넘어가는 날도 실제 연/월/일로 포함
 * - isFutureWeek: 그 주의 일요일이 오늘보다 미래면 true → "진행중 주", 확정 주휴수당 산정 대상 제외
 */
function getWeekRanges(y, m){
  const dim = new Date(y, m+1, 0).getDate();
  const weeks = [];
  let lastWeekKey = null;

  const today = new Date();
  today.setHours(0,0,0,0);

  for(let d = 1; d <= dim; d++){
    const date = new Date(y, m, d);
    const dow  = date.getDay(); // 0=일 ... 6=토

    // 이 날짜가 속한 주의 월요일 (JS Date가 월/연 경계를 자동 정규화)
    const monday = new Date(date);
    monday.setDate(d - (dow === 0 ? 6 : dow - 1));
    // ★ toISOString()은 UTC로 변환되어 KST 등 양(+)의 타임존에서 날짜가 하루 어긋남(전날로 표시됨) —
    //   로컬 연/월/일을 그대로 사용해야 함(dk()와 동일한 포맷)
    const weekKey = dk(monday.getFullYear(), monday.getMonth(), monday.getDate());

    // 같은 주(연속된 날짜)는 한 번만 처리
    if(weekKey === lastWeekKey) continue;
    lastWeekKey = weekKey;

    // 이 주의 월요일이 이번 달(y,m)에 속하지 않으면(=전월 귀속 주) 이번 달 결과에서 제외
    if(monday.getFullYear() !== y || monday.getMonth() !== m) continue;

    // 월~일 7일 전체 생성(전월/익월로 넘어가는 날도 실제 연/월/일로 포함)
    const days = [];
    for(let i = 0; i < 7; i++){
      const dt = new Date(monday);
      dt.setDate(monday.getDate() + i);
      days.push({
        y: dt.getFullYear(), m: dt.getMonth(), d: dt.getDate(),
        dateKey: dk(dt.getFullYear(), dt.getMonth(), dt.getDate()),
        dow: dt.getDay()
      });
    }

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const isFutureWeek = sunday.getTime() > today.getTime();

    weeks.push({
      weekKey,
      weekLabel: `${monday.getMonth()+1}/${monday.getDate()}주`,
      days,
      isFutureWeek
    });
  }

  return weeks;
}

/**
 * getWeeklyHolidayData: 월 단위 주휴수당 자동 계산 (표시용 — 직장인 209h 기본급에
 * 이미 주휴수당이 포함되어 있다는 전제이므로 여기서 산출되는 금액은 실급여(getPayData)에
 * 가산되지 않음. getPayData()/finalPay는 이 함수와 무관하게 그대로 유지됨)
 *
 * 주휴수당 발생 조건 (근로기준법 제55조)
 * 1. 1주 소정근로시간 합계 >= 15시간
 * 2. 해당 주 소정근로일 결근 없이 개근
 *
 * 처리 기준
 * - 월~일 단위로 주를 구분(getWeekRanges() 공용 헬퍼 사용 — 전월/익월로 걸친 날짜도
 *   포함해서 정확히 집계하고, 한 주는 그 주의 월요일이 속한 달에만 1번 귀속됨)
 * - 소정근로일: work/early/half/sat_work/sun_work 상태인 날
 * - 결근(absent)/무단결근(absent) 포함 시 해당 주 주휴 미발생
 * - 연차(leave)는 개근으로 인정 (소정근로일 충족으로 처리)
 * - 법정공휴일(public)은 소정근로일 아님
 * - 주휴수당 = 시급 × 8h
 * - 아직 끝나지 않은 주(isFutureWeek)는 "진행중"으로 별도 표시, 미달이 아니라 미확정으로 처리
 */
function getWeeklyHolidayData(){
  const y = curY, m = curM;
  const weekRanges = getWeekRanges(y, m);

  // 전월/익월로 걸친 날짜의 근태 데이터 조회용 캐시(다른 달은 attLoadMonth로 별도 로드)
  const monthCache = {};
  function getDayRecord(dy, dm, dd){
    if(dy === y && dm === m) return dayData[dk(dy, dm, dd)];
    const cacheKey = `${dy}-${dm}`;
    if(!monthCache[cacheKey]){
      monthCache[cacheKey] = (typeof attLoadMonth === 'function' && activeWpId && activeEmpId)
        ? attLoadMonth(activeWpId, activeEmpId, dy, dm) : {};
    }
    return monthCache[cacheKey][dk(dy, dm, dd)];
  }

  const workStates = ['work','early','half','sat_work','sun_work'];

  const weeks = weekRanges.map(wr => {
    const week = {
      weekKey: wr.weekKey,
      weekLabel: wr.weekLabel,
      days: [],
      totalH: 0,
      hasAbsent: false,
      workDayCount: 0,   // 소정근로일(출근 기록 있는 날)
      plannedDays: wr.days.length,
      holidayOk: false,  // 주휴 발생 여부(확정)
      isFutureWeek: wr.isFutureWeek, // 아직 끝나지 않은 주(진행중) — 확정 판정 제외
      amount: 0
    };

    wr.days.forEach(dayInfo => {
      const data = getDayRecord(dayInfo.y, dayInfo.m, dayInfo.d);
      const s = data ? data.status : 'none';

      if(workStates.includes(s)){
        const net = calcNetHours(data.start, data.end, s, data.shift);
        week.totalH += net;
        week.workDayCount++;
        week.days.push({y:dayInfo.y, m:dayInfo.m, d:dayInfo.d, dow:dayInfo.dow, status:s, net});
      } else if(s === 'leave'){
        // 연차: 개근 인정, 8h로 계산
        week.totalH += 8;
        week.workDayCount++;
        week.days.push({y:dayInfo.y, m:dayInfo.m, d:dayInfo.d, dow:dayInfo.dow, status:s, net:8});
      } else if(s === 'absent'){
        // 결근: 개근 실패 → 주휴 미발생
        week.hasAbsent = true;
        week.days.push({y:dayInfo.y, m:dayInfo.m, d:dayInfo.d, dow:dayInfo.dow, status:s, net:0});
      } else {
        week.days.push({y:dayInfo.y, m:dayInfo.m, d:dayInfo.d, dow:dayInfo.dow, status:s, net:0});
      }
    });

    return week;
  });

  // 각 주 주휴 발생 여부 판정
  let totalWeeklyAmt = 0;
  const weeklyAmt = hourlyRate * 8;
  const qualifiedWeeks = [];

  weeks.forEach(week => {
    // 조건 1: 주 총 근무시간 >= 15h
    const cond1 = week.totalH >= 15;
    // 조건 2: 결근 없음
    const cond2 = !week.hasAbsent;
    // 조건 3: 실제 근무 기록이 있는 주 (빈 주 제외)
    const cond3 = week.workDayCount > 0;

    // 진행중 주는 아직 끝나지 않아 확정할 수 없으므로 holidayOk=false(미발생이 아니라 미확정)
    week.holidayOk = !week.isFutureWeek && cond1 && cond2 && cond3;
    week.cond1 = cond1;
    week.cond2 = cond2;
    week.amount = week.holidayOk ? weeklyAmt : 0;

    if(week.holidayOk){
      totalWeeklyAmt += weeklyAmt;
      qualifiedWeeks.push(week.weekLabel);
    }
  });

  return {
    weeks,
    totalWeeklyAmt,
    qualifiedWeeks,
    weeklyAmt,   // 1회 주휴수당
    qualCount: qualifiedWeeks.length
  };
}

/**
 * getCompanyAlbaWeeklyHolidayData(y, m): 회사알바(dayData 기반) 주휴수당 발생 판정.
 *
 * 직장인의 getWeeklyHolidayData()와 같은 데이터 구조(dayData + 인접월 attLoadMonth)를
 * 쓰지만, 정책상 회사알바는 "209h에 이미 포함"이 아니라 "별도 가산" 항목이므로
 * 독립된 판정 함수로 분리함. 결근 판정은 직장인과 동일(결근 있으면 그 주 미발생).
 *
 * ★ 4단계 — 판정 결과 생성까지만 담당. getAlbaMonthlyAggregate()/getAlbaPaySummary()
 *   실제 급여 가산 연결은 5단계에서 진행.
 *
 * 반환: getWeekRanges()와 동일한 주 배열에 판정 결과 필드를 추가
 *   [{ weekKey, weekLabel, isFutureWeek, totalH, hasAbsent, workDayCount,
 *      cond1, cond2, holidayOk, amount }, ...]
 */
function getCompanyAlbaWeeklyHolidayData(y, m){
  const weekRanges = (typeof getWeekRanges === 'function') ? getWeekRanges(y, m) : [];

  const monthCache = {};
  function getDayRecord(dy, dm, dd){
    if(dy === y && dm === m) return dayData[dk(dy, dm, dd)];
    const cacheKey = `${dy}-${dm}`;
    if(!monthCache[cacheKey]){
      monthCache[cacheKey] = (typeof attLoadMonth === 'function' && activeWpId && activeEmpId)
        ? attLoadMonth(activeWpId, activeEmpId, dy, dm) : {};
    }
    return monthCache[cacheKey][dk(dy, dm, dd)];
  }

  const workStates = ['work','early','half','sat_work','sun_work'];
  const weeklyAmt = hourlyRate * 8;

  return weekRanges.map(wr => {
    let totalH = 0, hasAbsent = false, workDayCount = 0;

    wr.days.forEach(dayInfo => {
      const data = getDayRecord(dayInfo.y, dayInfo.m, dayInfo.d);
      const s = data ? data.status : 'none';

      if(workStates.includes(s)){
        totalH += calcNetHours(data.start, data.end, s, data.shift);
        workDayCount++;
      } else if(s === 'leave'){
        totalH += 8;
        workDayCount++;
      } else if(s === 'absent'){
        hasAbsent = true;
      }
    });

    const cond1 = totalH >= 15;
    const cond2 = !hasAbsent;
    const cond3 = workDayCount > 0;
    // 진행중 주는 아직 끝나지 않아 확정할 수 없으므로 holidayOk=false(미발생이 아니라 미확정)
    const holidayOk = !wr.isFutureWeek && cond1 && cond2 && cond3;

    return {
      weekKey: wr.weekKey,
      weekLabel: wr.weekLabel,
      isFutureWeek: wr.isFutureWeek,
      totalH, hasAbsent, workDayCount,
      cond1, cond2,
      holidayOk,
      amount: holidayOk ? weeklyAmt : 0
    };
  });
}
// ══════════════════════════════════════════
// 급여 계산
// ══════════════════════════════════════════
function getPayData(){
  const y=curY, m=curM;
  const dim=new Date(y,m+1,0).getDate();
  const twd=countWD(y,m);

  let wDays=0, lDays=0, halfDays=0, absDays=0;
  let normalH=0;   // 기본 근무시간 (8h 이내, 수당 미포함)
  let totOT=0;     // 연장근무시간 (8h 초과)
  let nightH=0;    // 야간시간 (22~06시, 기본/연장 포함)
  let holidayH=0, satH=0, sunH=0;
  let earlyDeduct=0;
  // 휴일수당(holiday/sun_work) 8h 계단식 금액 누적 — 일별 net 기준 8h 이내 1.5배 / 초과분 2.0배 (근로기준법 제56조②)
  let aHolidayAccum=0, aSunAccum=0;

  let lateDeduct = 0;   // 지각 공제 (30분 단위)
  let lateCount  = 0;   // 지각 횟수

  for(let d=1;d<=dim;d++){
    const key=dk(y,m,d);
    const data=dayData[key];
    if(!data||!data.status||data.status==='none') continue;
    const s=data.status;
    const net=calcNetHours(data.start,data.end,s,data.shift);

    if(s==='work'||s==='early') wDays++;
    if(s==='half'){ wDays++; halfDays++; }
    if(s==='leave'){ lDays++; wDays++; } // 연차는 개근(만근수당) 인정
    if(s==='absent') absDays++;

    // 교대근무별 표준근무시간 기준으로 OT 분리
    // 2교대: 12h 기준, 3교대: 8h 기준, 주간/야간고정: 8h 기준
    if(s==='work'||s==='early'){
      // atm2_workSubType 읽어 서브타입 확인
      var _wsub = '';
      try{ _wsub = localStorage.getItem('atm2_workSubType')||''; }catch(e){}
      var stdH = 8; // 기본 표준근무시간
      if(wt==='2shift'){
        // 2교대: 주간조/야간조는 12h, 통상조는 8h
        stdH = (_wsub==='day_fixed') ? 8 : 12;
      } else if(wt==='3shift'){
        // 3교대: 모든 조 8h
        stdH = 8;
      }
      const ot = Math.max(0, net - stdH);
      totOT   += ot;
      normalH += net - ot;
    }
    if(s==='half') normalH += 4;

    // 야간시간 — 22:00~06:00 구간 (2교대 야간조는 20~22도 야간 해당하지만 법정기준 22시 적용)
    if(['work','early','sat_work','sun_work','holiday'].includes(s)){
      nightH += calcNight(data.start, data.end);
    }

    if(s==='holiday'){
      holidayH += net;
      // 8h 이내 1.5배 + 8h 초과분 2.0배 (일별 계단식, 근로기준법 제56조②)
      aHolidayAccum += Math.min(net,8)*companyRate*1.5 + Math.max(0,net-8)*companyRate*2.0;
    }
    if(s==='sat_work') satH += net;
    if(s==='sun_work'){
      sunH += net;
      aSunAccum += Math.min(net,8)*companyRate*1.5 + Math.max(0,net-8)*companyRate*2.0;
    }

    // ── 조퇴 공제: 8h 미달 시간 × 시급 ──
    if(s==='early'){
      const shortage = Math.max(0, 8 - net);
      earlyDeduct += shortage * hourlyRate;
    }

    // ── 지각 공제: 주간 근무(day, 2교대주간조, 3교대A조/통상조)에 적용 ──
    // 야간조·B조·C조는 시작시간이 낮이 아니므로 지각 공제 미적용
    var _wsub2 = '';
    try{ _wsub2 = localStorage.getItem('atm2_workSubType')||''; }catch(e){}
    var _isDayShift = (wt==='day')
      || (wt==='2shift' && (_wsub2==='day'||_wsub2==='day_fixed'))
      || (wt==='3shift' && (_wsub2==='A'||_wsub2==='day_fixed'));
    if(_isDayShift && (s==='work'||s==='early') && data.start !== undefined && data.start !== null){
      // 교대조별 기준 출근시각 결정
      var _shiftStart = dayStart;
      if(wt==='2shift' && _wsub2==='day'){
        _shiftStart = (typeof SHIFT2!=='undefined'&&SHIFT2&&SHIFT2.day) ? SHIFT2.day.s : 7;
      } else if(wt==='3shift' && (_wsub2==='A'||_wsub2==='day_fixed')){
        _shiftStart = (typeof SHIFT3!=='undefined'&&SHIFT3&&SHIFT3.A) ? SHIFT3.A.s : 7;
      }
      if(data.start > _shiftStart){
        const lateRaw = data.start - _shiftStart;
        const lateRnd = Math.ceil(lateRaw / 0.5) * 0.5;
        lateDeduct += lateRnd * hourlyRate;
        lateCount++;
      }
    }
  }

  // ── 기본급: 시급 × 209h (고정, 주휴 포함) ──
  const BASE_HOURS = 209;
  const basePay = hourlyRate * BASE_HOURS;

  // ── 공제: 결근·조퇴·지각만 공제 (연차/반차/공휴일은 유급 처리) ──
  const dLeave   = 0;   // 연차: 유급 → 공제 없음
  const dHalf    = 0;   // 반차: 유급 → 공제 없음
  const dAbsent  = absDays * 8 * hourlyRate;  // 결근: 8h 공제
  const dEarly   = earlyDeduct;               // 조퇴: 미달시간 공제
  const dLate    = lateDeduct;               // 지각: 30분 단위 공제
  const totDeduct = dAbsent + dEarly + dLate;

  // ── 수당: companyRate(회사 실제 시급) 기준, 10원 단위 반올림 ──
  const r10 = function(n){ return Math.round(n/10)*10; };
  const aOT      = r10(totOT    * companyRate * 1.5);
  const aNight   = r10(nightH   * companyRate * 0.5);
  const aHoliday = r10(aHolidayAccum);  // 8h 이내 1.5배 + 초과분 2.0배 (일별 계단식 누적값)
  const aSat     = r10(satH     * companyRate * 1.5);
  const aSun     = r10(aSunAccum);      // 8h 이내 1.5배 + 초과분 2.0배 (일별 계단식 누적값)

  const isPerfect = wDays>=twd;
  // 만근수당: 사용자가 직접 "만근으로 처리" 체크(perfectOn)하면
  //          달력 기록(isPerfect)과 무관하게 allowances.perfect 적용
  const perfectApplied = (typeof perfectOn !== 'undefined' && perfectOn) ? true : isPerfect;
  const perfAmt   = perfectApplied?(allowances.perfect||0):0;

  // 주휴수당: weeklyOn ON이면 사용자 입력값 사용 (weeklyHolidayEnabled는 표시 제어만 — 급여 미변경)
  const _whe = (typeof weeklyHolidayEnabled !== 'undefined') ? weeklyHolidayEnabled : true;
  const aWeeklyManual = weeklyOn ? (allowances.weekly||0) : 0;
  const totAllow = aOT+aNight+aHoliday+aSat+aSun
                  +(allowances.tenure||0)
                  +aWeeklyManual
                  +perfAmt+(allowances.other||0);
  // companyRate 참조 (리턴에 포함)
  const _companyRate = companyRate;

  const grossPay = basePay + totAllow - totDeduct;
  const netPay   = grossPay;
  // 자동계산 후 override 적용
  const _ins = calc4Insurance(grossPay);
  const _tax = calcIncomeTax(grossPay);
  const ins = {
    np  : insOverride.np   !== null ? insOverride.np   : _ins.np,
    hi  : insOverride.hi   !== null ? insOverride.hi   : _ins.hi,
    ltc : insOverride.ltc  !== null ? insOverride.ltc  : _ins.ltc,
    ei  : insOverride.ei   !== null ? insOverride.ei   : _ins.ei,
    // auto: 자동계산값 (입력 필드 placeholder용)
    _np: _ins.np, _hi: _ins.hi, _ltc: _ins.ltc, _ei: _ins.ei,
  };
  ins.total = ins.np + ins.hi + ins.ltc + ins.ei;
  const tax = {
    income : taxOverride.income !== null ? taxOverride.income : _tax.income,
    local  : taxOverride.local  !== null ? taxOverride.local  : _tax.local,
    _income: _tax.income, _local: _tax.local,
  };
  tax.total = tax.income + tax.local;
  const finalPay = Math.max(0, grossPay - ins.total - tax.total);

  // ── 주휴수당 자동체크 (발생 여부 표시용 - 실제 급여에는 이미 포함) ──
  // 209h 기본급에 이미 주휴 포함 → 별도 금액 가산 없음, UI 표시용으로만 사용
  // weeklyHolidayEnabled=false면 표시용 데이터도 zeroing
  const _wdRaw = getWeeklyHolidayData();
  const wd = _whe ? _wdRaw : Object.assign({}, _wdRaw, {qualCount:0, totalWeeklyAmt:0});
  const aWeeklyHoliday = 0;  // 이미 기본급에 포함
  const totAllowWithWH = totAllow;
  const netPayWithWH   = grossPay;
  const grossPayWithWH = grossPay;
  const insWH  = ins;
  const taxWH  = tax;
  const finalPayWithWH = finalPay;

  return {basePay, normalH, twd, wDays, lDays, halfDays, absDays,
    totOT, nightH, holidayH, satH, sunH,
    dLeave, dHalf, dAbsent, dEarly, dLate, lateCount, totDeduct,
    aOT, aNight, aHoliday, aSat, aSun, aWeeklyManual, totAllow, _companyRate,
    netPay, grossPay, ins, tax, finalPay, isPerfect, perfAmt, perfectApplied,
    wd, aWeeklyHoliday, totAllowWithWH,
    netPayWithWH, grossPayWithWH, insWH, taxWH, finalPayWithWH,
    BASE_HOURS};
}

function fmt(n){ return Math.round(n).toLocaleString('ko-KR')+'원'; }

// ══════════════════════════════════════════
// 4대보험 + 근로소득세 계산
// ══════════════════════════════════════════
// ── 연도별 4대보험 요율 테이블 (매년 업데이트) ──
const INS_TABLE = {
  2024: { NP:0.045, HI:0.03545, LTC_RATE:0.1295, EI:0.009, NP_MIN:370000, NP_MAX:5900000 },
  2025: { NP:0.045, HI:0.03545, LTC_RATE:0.1295, EI:0.009, NP_MIN:390000, NP_MAX:6170000 },
  2026: { NP:0.045, HI:0.03545, LTC_RATE:0.1295, EI:0.009, NP_MIN:400000, NP_MAX:6370000 }, // 2026 확정
};
// 현재 연도 요율 자동 선택 (테이블에 없으면 가장 최신 연도 사용)
function getInsRate(year) {
  if (INS_TABLE[year]) return INS_TABLE[year];
  const years = Object.keys(INS_TABLE).map(Number).sort((a,b)=>b-a);
  return INS_TABLE[years[0]];
}
const _curInsYear = new Date().getFullYear(); // 현재 연도 자동 적용 (2026 기준)
const _ins = getInsRate(_curInsYear);
const INS = { NP: _ins.NP, HI: _ins.HI, EI: _ins.EI };
const NP_MIN_SALARY = _ins.NP_MIN;
const NP_MAX_SALARY = _ins.NP_MAX;
const LTC_RATE      = _ins.LTC_RATE;

/**
 * calc4Insurance(grossPay)
 * grossPay: 총급여 (기본급 + 수당 합계, 근태공제 전)
 * 반환: { np, hi, ltc, ei, total, 각 항목 요율 표시용 }
 */
function calc4Insurance(grossPay){
  const gp = Math.round(grossPay);

  // 국민연금: 기준소득월액 상·하한 적용
  const npBase = Math.min(Math.max(gp, NP_MIN_SALARY), NP_MAX_SALARY);
  const np  = Math.round(npBase * INS.NP);

  // 건강보험
  const hi  = Math.round(gp * INS.HI);

  // 장기요양보험 = 건강보험료 × LTC_RATE (연도별)
  const ltc = Math.round(hi * LTC_RATE);

  // 고용보험
  const ei  = Math.round(gp * INS.EI);

  const total = np + hi + ltc + ei;
  return { np, hi, ltc, ei, total };
}

/**
 * calcIncomeTax(grossPay)
 * 근로소득세 간이세액표 기반 (비과세 없는 경우, 공제대상 가족 1인 기준)
 * 실무상 정확한 값은 국세청 간이세액표 조회이나,
 * 여기서는 근사식(과세표준 구간별 세율)을 적용
 */
function calcIncomeTax(grossPay){
  // 월 근로소득세 = (총급여 - 비과세) 기준 간이세액표 근사
  // 비과세: 식대 20만원 등 → 여기선 간단하게 총급여 기준
  const gp = Math.round(grossPay);

  // 연간 과세 급여 추정 (월×12)
  const annualGross = gp * 12;

  // 근로소득공제 계산 (소득세법 제47조)
  let wageDeduction = 0;
  if(annualGross <= 5000000)        wageDeduction = annualGross * 0.70;
  else if(annualGross <= 15000000)  wageDeduction = 3500000 + (annualGross - 5000000) * 0.40;
  else if(annualGross <= 45000000)  wageDeduction = 7500000 + (annualGross - 15000000) * 0.15;
  else if(annualGross <= 100000000) wageDeduction = 12000000 + (annualGross - 45000000) * 0.05;
  else                              wageDeduction = 14750000 + (annualGross - 100000000) * 0.02;
  // 공제 한도: 2,000만원
  wageDeduction = Math.min(wageDeduction, 20000000);

  // 근로소득금액
  const incomeAmt = annualGross - wageDeduction;

  // 인적공제: 본인 1인 → 150만원
  const personalDeduction = 1500000;

  // 과세표준
  const taxBase = Math.max(0, incomeAmt - personalDeduction);

  // 종합소득세율 (2024년 기준)
  let annualTax = 0;
  if(taxBase <= 14000000)       annualTax = taxBase * 0.06;
  else if(taxBase <= 50000000)  annualTax = 840000  + (taxBase - 14000000) * 0.15;
  else if(taxBase <= 88000000)  annualTax = 6240000 + (taxBase - 50000000) * 0.24;
  else if(taxBase <= 150000000) annualTax = 15360000+ (taxBase - 88000000) * 0.35;
  else if(taxBase <= 300000000) annualTax = 37060000+ (taxBase - 150000000)* 0.38;
  else if(taxBase <= 500000000) annualTax = 94060000+ (taxBase - 300000000)* 0.40;
  else                          annualTax = 174060000+(taxBase - 500000000)* 0.42;

  // 근로소득세액공제 (산출세액의 55~66%)
  let taxCredit = 0;
  if(annualTax <= 1300000)      taxCredit = annualTax * 0.55;
  else                          taxCredit = 715000 + (annualTax - 1300000) * 0.30;
  taxCredit = Math.min(taxCredit, 740000);

  const annualIncomeTax = Math.max(0, annualTax - taxCredit);

  // 월 근로소득세 = 연간 ÷ 12 (원 단위 반올림, 10원 단위)
  const monthlyTax = Math.round(annualIncomeTax / 12 / 10) * 10;

  // 지방소득세 = 근로소득세의 10%
  const localTax = Math.round(monthlyTax * 0.10 / 10) * 10;

  return { income: monthlyTax, local: localTax, total: monthlyTax + localTax };
}

// ══════════════════════════════════════════
// 연간 대시보드
// ══════════════════════════════════════════

// 특정 연·월의 dayData를 localStorage에서 가져와 급여 계산
function getPayDataForMonth(y, m){
  // 해당 월 dayData 수집 (메모리 + localStorage)
  const mData = {};
  const prefix = `${y}-${pad2(m+1)}-`;
  // 메모리에 있는 것 먼저
  Object.keys(dayData).forEach(k=>{ if(k.startsWith(prefix)) mData[k]=dayData[k]; });
  // ★ v11 신규 키: atm2_att_{wpId}_{empId}_{y}_{mm}
  try{
    if(typeof activeWpId !== 'undefined' && activeWpId && typeof activeEmpId !== 'undefined' && activeEmpId){
      const raw = localStorage.getItem(`atm2_att_${activeWpId}_${activeEmpId}_${y}_${pad2(m+1)}`);
      if(raw){ const p=JSON.parse(raw); Object.keys(p).forEach(k=>{ if(!mData[k]) mData[k]=p[k]; }); }
    }
  }catch(e){}
  // 하위호환 fallback: 구버전 키 atm2_dd_{y}_{mm}
  try{
    const stored = localStorage.getItem(`atm2_dd_${y}_${pad2(m+1)}`);
    if(stored){ const p=JSON.parse(stored); Object.keys(p).forEach(k=>{ if(!mData[k]) mData[k]=p[k]; }); }
    // 구형 단일 키 호환
    const old = localStorage.getItem('atm2_dd');
    if(old){ const p=JSON.parse(old); Object.keys(p).forEach(k=>{ if(k.startsWith(prefix)&&!mData[k]) mData[k]=p[k]; }); }
  }catch(e){}

  const dim = new Date(y,m+1,0).getDate();
  const twd = countWD(y,m);
  let wDays=0,lDays=0,halfDays=0,absDays=0;
  let normalH=0,totOT=0,nightH=0,holidayH=0,satH=0,sunH=0,earlyDeduct=0;
  // 휴일수당(holiday/public/sun_work) 8h 계단식 금액 누적 — getPayData와 동일 기준 (근로기준법 제56조②)
  let aHolidayAccum=0, aSunAccum=0;

  for(let d=1;d<=dim;d++){
    const key=`${y}-${pad2(m+1)}-${pad2(d)}`;
    const data=mData[key];
    if(!data||!data.status||data.status==='none') continue;
    const s=data.status;
    const net=calcNetHours(data.start,data.end,s,data.shift);
    if(s==='work'||s==='early') wDays++;
    if(s==='half'){ wDays++; halfDays++; }
    if(s==='leave'){ lDays++; wDays++; } // 연차는 개근(만근수당) 인정
    if(s==='absent') absDays++;
    if(s==='work'||s==='early'){
      const ot=Math.max(0,net-8);
      totOT+=ot; normalH+=net-ot;
    }
    if(s==='half') normalH+=4;
    if(['work','early','sat_work','sun_work','holiday','public'].includes(s)) nightH+=calcNight(data.start,data.end);
    if(s==='holiday'||s==='public'){
      holidayH+=net;
      aHolidayAccum += Math.min(net,8)*companyRate*1.5 + Math.max(0,net-8)*companyRate*2.0;
    }
    if(s==='sat_work') satH+=net;
    if(s==='sun_work'){
      sunH+=net;
      aSunAccum += Math.min(net,8)*companyRate*1.5 + Math.max(0,net-8)*companyRate*2.0;
    }
    if(s==='early'){ const shortage=Math.max(0,8-net); earlyDeduct+=shortage*hourlyRate; }
  }

  const basePay   = hourlyRate * 209;  // 209h 고정 (getPayData와 동일)
  const dLeave    = lDays*8*hourlyRate;
  const dHalf     = halfDays*4*hourlyRate;
  const dAbsent   = absDays*8*hourlyRate;
  const totDeduct = dLeave+dHalf+dAbsent+earlyDeduct;
  const aOT       = totOT    * companyRate * 1.5;
  const aNight    = nightH   * companyRate * 0.5;
  const aHoliday  = aHolidayAccum;  // 8h 이내 1.5배 + 초과분 2.0배 (일별 계단식 누적값)
  const aSat      = satH     * companyRate * 1.5;
  const aSun      = aSunAccum;      // 8h 이내 1.5배 + 초과분 2.0배 (일별 계단식 누적값)
  const isPerfect = wDays>=twd;
  const perfAmt   = isPerfect?(allowances.perfect||0):0;
  const totAllow  = aNight+aOT+aHoliday+aSat+aSun+(allowances.tenure||0)+(allowances.weekly||0)+perfAmt+(allowances.other||0);
  // ★ netPay는 이름과 달리 grossPay(세전)와 동일한 값이라 "실수령액" 라벨에 쓰면 의미가
  //   어긋남(앱 전체 용어 정리, 2026-06-20). 4대보험·세금까지 차감한 진짜 세후 실수령액인
  //   finalPay를 getPayData()와 동일한 계산기(calc4Insurance/calcIncomeTax)로 추가 산출.
  const netPay    = basePay+totAllow-totDeduct; // 하위호환용 유지(= grossPay, 세전) — 신규 참조 금지
  const grossPay  = netPay;
  const _ins4 = calc4Insurance(grossPay);
  const _tax4 = calcIncomeTax(grossPay);
  const ins = {
    np  : insOverride.np   !== null ? insOverride.np   : _ins4.np,
    hi  : insOverride.hi   !== null ? insOverride.hi   : _ins4.hi,
    ltc : insOverride.ltc  !== null ? insOverride.ltc  : _ins4.ltc,
    ei  : insOverride.ei   !== null ? insOverride.ei   : _ins4.ei,
  };
  ins.total = ins.np + ins.hi + ins.ltc + ins.ei;
  const tax = {
    income : taxOverride.income !== null ? taxOverride.income : _tax4.income,
    local  : taxOverride.local  !== null ? taxOverride.local  : _tax4.local,
  };
  tax.total = tax.income + tax.local;
  const finalPay = Math.max(0, grossPay - ins.total - tax.total);
  const totalWorkH= Object.keys(mData).reduce((sum,k)=>{
    const dd=mData[k]; if(!dd||!dd.status) return sum;
    return sum+calcNetHours(dd.start,dd.end,dd.status,dd.shift);
  },0);

  return { wDays, lDays, absDays, totOT, nightH, satH, sunH,
           basePay, totAllow, totDeduct, netPay, grossPay, ins, tax, finalPay,
           totalWorkH, twd, isPerfect };
}

let dashYear = new Date().getFullYear();

// ══════════════════════════════════════════
// N잡러 연간 수입 요약
// 알바/배달/프리랜서 직종: 올해 총수입 + 월평균 + 월별 그래프
// ══════════════════════════════════════════
// ── 월별 N잡 수입 집계 ── (★ 연간요약 통합 작업에서 renderNjobYearlySummary 내부 함수를
//   모듈 레벨로 추출 — 직장인+N잡 조합 섹션에서도 재사용하기 위함. 계산 공식은 한 글자도
//   변경하지 않음, 위치만 이동.)
function getNjobIncomeForMonth(yr, mo){
  const _p = n => String(n).padStart(2,'0');
  const dim = new Date(yr, mo+1, 0).getDate();
  let gross = 0;
  let albaH  = 0;
  try{
    for(let d=1; d<=dim; d++){
      const key = `${yr}-${_p(mo+1)}-${_p(d)}`;
      const raw = localStorage.getItem('atm2_njob_'+key);
      if(!raw) continue;
      const data = JSON.parse(raw);
      (data.alba||[]).forEach(it=>{
        let amt;
        if(it.amount && it.amount > 0){
          amt = it.amount;
        } else if(it.dayHours !== undefined){
          amt = Math.round((it.dayHours||0)*(it.wage||0))
              + Math.round((it.nightHours||0)*(it.wage||0)*1.5)
              + (it.extraNight||0)+(it.extraOver||0)+(it.extraOther||0)+(it.extraMeal||0);
        } else {
          amt = Math.round((it.wage||0)*(it.hours||0));
        }
        gross += amt;
        albaH += (it.hours || it.dayHours || 0);
      });
      (data.delivery||[]).forEach(it=>{ gross += (it.count||0)*(it.price||0); });
      (data.free||[]).forEach(it=>{ gross += it.type==='lecture' ? (it.fee||0) : (it.count||0)*(it.price||0); });
      (data.etc||[]).forEach(it=>{ gross += (it.amount||0); });
    }
  }catch(e){}
  return { gross, albaH };
}

function renderNjobYearlySummary(){
  const container = document.getElementById('dash-page');
  if(!container) return;

  const y = dashYear;
  const nowY = new Date().getFullYear();
  const nowM = new Date().getMonth(); // 0-indexed
  const MO_KO_S = ['1','2','3','4','5','6','7','8','9','10','11','12'];

  // 12개월 데이터
  const monthlyData = Array.from({length:12}, (_,m)=>{
    const isFuture = y > nowY || (y === nowY && m > nowM);
    const {gross} = getNjobIncomeForMonth(y, m);
    return { m, gross, isFuture };
  });

  const pastMonths = monthlyData.filter(d => !d.isFuture && d.gross > 0);
  const totalGross = pastMonths.reduce((s,d) => s+d.gross, 0);
  const monthAvg   = pastMonths.length > 0
    ? Math.round(totalGross / pastMonths.length) : 0;
  const maxGross   = Math.max(...monthlyData.map(d=>d.gross), 1);

  // ── 직종 아이콘/이름 ──
  const _jobs = (()=>{
    try{ const r=localStorage.getItem('atm2_selectedJobs'); if(r) return JSON.parse(r); }catch(e){}
    return [];
  })().filter(j=>j!=='employee');

  const jobLabels = _jobs.map(j=>{
    const info = (typeof JOB_TYPES!=='undefined'&&JOB_TYPES[j]) || {};
    return (info.icon||'💼')+' '+(info.name||j);
  }).join(' · ') || '💼 N잡';

  // ── 월별 바 행 ──
  const barRows = monthlyData.map(({m, gross, isFuture})=>{
    const pct = gross > 0 ? (gross/maxGross*100).toFixed(1) : 0;
    const isNow = (m===nowM && y===nowY);
    const barColor = isFuture
      ? 'rgba(79,124,255,0.2)'
      : 'linear-gradient(90deg,var(--orange),var(--yellow))';
    const label = isFuture
      ? `<span style="font-size:14px;color:var(--text3);">-</span>`
      : gross > 0
        ? `<span style="font-size:16px;font-weight:700;color:var(--text);font-family:'JetBrains Mono';">${fmtK(gross)}</span>`
        : `<span style="font-size:14px;color:var(--text3);">기록없음</span>`;

    const bar = gross > 0
      ? `<div style="height:14px;background:rgba(255,140,66,.12);border-radius:3px;overflow:hidden;">
           <div style="height:100%;width:${pct}%;background:${barColor};border-radius:3px;transition:width .6s;"></div>
         </div>`
      : `<div style="height:14px;display:flex;align-items:center;">
           <span style="font-size:14px;color:var(--text3);">${isFuture?'미래':'기록없음'}</span>
         </div>`;

    return `
    <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.04);">
      <div style="width:26px;font-size:15px;font-weight:700;color:${isNow?'var(--accent)':'var(--text2)'};">${MO_KO_S[m]}월</div>
      <div style="flex:1;min-width:0;">${bar}</div>
      <div style="width:90px;text-align:right;">${label}</div>
    </div>`;
  }).join('');

  // 분기별 합산
  const quarters = [0,1,2,3].map(q=>{
    const ps = monthlyData.slice(q*3,(q+1)*3);
    const tot = ps.filter(d=>!d.isFuture).reduce((s,d)=>s+d.gross,0);
    const hasData = ps.some(d=>!d.isFuture && d.gross>0);
    return {tot, hasData, label:`Q${q+1} · ${q*3+1}~${q*3+3}월`};
  });

  container.innerHTML = `
  <!-- 헤더 -->
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
    <div>
      <h2 style="font-size:26px;font-weight:700;">💼 ${y}년 수입 연간요약</h2>
      <div style="font-size:15px;font-weight:700;color:var(--accent);margin-top:4px;">월별 수입 흐름을 그래프로 확인해보세요</div>
      <div style="font-size:15px;color:var(--text3);margin-top:3px;">${jobLabels}</div>
    </div>
    <div style="display:flex;align-items:center;gap:8px;">
      <button onclick="dashYear--;renderDash()" style="width:44px;height:44px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text);font-size:20px;cursor:pointer;">◀</button>
      <span style="font-size:21px;font-weight:700;min-width:60px;text-align:center;">${y}년</span>
      <button onclick="dashYear++;renderDash()" style="width:44px;height:44px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text);font-size:20px;cursor:pointer;">▶</button>
    </div>
  </div>

  <!-- 핵심 수치 카드 2개 -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
    <div style="background:linear-gradient(135deg,rgba(255,140,66,.18),rgba(255,209,102,.1));
                border:1px solid rgba(255,140,66,.4);border-radius:var(--radius);padding:20px;text-align:center;">
      <div style="font-size:16px;color:var(--text2);margin-bottom:6px;">💰 ${y}년 올해 총수입</div>
      <div style="font-size:40px;font-weight:900;font-family:'JetBrains Mono';color:var(--orange);">
        ${totalGross > 0 ? fmtK(totalGross) : '0원'}
      </div>
      <div style="font-size:14px;color:var(--text3);margin-top:4px;">${y===nowY?nowM+1:12}개월 집계 (세전)</div>
    </div>
    <div style="background:linear-gradient(135deg,rgba(61,214,140,.12),rgba(79,124,255,.08));
                border:1px solid rgba(61,214,140,.3);border-radius:var(--radius);padding:20px;text-align:center;">
      <div style="font-size:16px;color:var(--text2);margin-bottom:6px;">📊 월평균 수입</div>
      <div style="font-size:40px;font-weight:900;font-family:'JetBrains Mono';color:var(--green);">
        ${monthAvg > 0 ? fmtK(monthAvg) : '0원'}
      </div>
      <div style="font-size:14px;color:var(--text3);margin-top:4px;">수입 있는 월 기준 평균</div>
    </div>
  </div>

  <!-- 분기별 합산 -->
  <div class="sal-section" style="margin-bottom:16px;">
    <h3>📅 분기별 합산</h3>
    ${quarters.map(q=>`
      <div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.04);">
        <span style="font-size:17px;font-weight:700;color:var(--text2);">${q.label}</span>
        <span style="font-size:21px;font-weight:700;font-family:'JetBrains Mono';color:${q.hasData?'var(--orange)':'var(--text3)'};">
          ${q.hasData ? fmtK(q.tot) : '-'}
        </span>
      </div>`).join('')}
  </div>

  <!-- 월별 수입 그래프 -->
  <div class="sal-section" style="margin-bottom:16px;">
    <h3>📈 월별 수입 추이</h3>
    <div style="position:relative;height:220px;margin-bottom:12px;" id="njob-year-chart-wrap">
      <canvas id="njob-annual-chart"></canvas>
    </div>
    <!-- 월별 바 목록 -->
    ${barRows}
  </div>

  <!-- 안내 -->
  <div style="background:rgba(255,140,66,.06);border:1px solid rgba(255,140,66,.15);
              border-radius:10px;padding:12px 16px;font-size:15px;color:var(--text2);line-height:1.9;margin-bottom:16px;">
    ℹ️ <b>연간요약 안내</b><br>
    · 달력에서 날짜별로 수입을 기록하면 자동 집계됩니다<br>
    · 세전 기준 · 실수령은 월별 수입관리에서 확인<br>
    · 종합소득세 신고 시 참고용으로 활용하세요
  </div>`;

  // ── Chart.js 월별 수입 차트 ──
  requestAnimationFrame(()=>{
    if(typeof Chart === 'undefined' || window._chartFailed) return;
    const ctx = document.getElementById('njob-annual-chart');
    if(!ctx) return;
    if(ctx._chartInst) ctx._chartInst.destroy();

    const vals   = monthlyData.map(d => d.gross > 0 ? Math.round(d.gross/10000) : 0);
    const bgClrs = monthlyData.map(d =>
      d.isFuture ? 'rgba(79,124,255,0.15)' :
      d.gross>0  ? 'rgba(255,140,66,0.65)' : 'rgba(255,255,255,0.05)'
    );
    const brClrs = monthlyData.map(d =>
      d.isFuture ? 'rgba(79,124,255,0.35)' :
      d.gross>0  ? 'rgba(255,209,102,1)'   : 'rgba(255,255,255,0.1)'
    );

    ctx._chartInst = new Chart(ctx, {
      data:{
        labels:['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'],
        datasets:[
          {
            type:'bar', label:'월 수입 (만원)',
            data: vals,
            backgroundColor: bgClrs, borderColor: brClrs,
            borderWidth:1.5, borderRadius:4
          },
          {
            type:'line', label:'추이선',
            data: monthlyData.map((d,i) => d.isFuture||d.gross===0 ? null : vals[i]),
            borderColor:'rgba(61,214,140,0.8)', backgroundColor:'rgba(61,214,140,0.08)',
            pointBackgroundColor:'rgba(61,214,140,1)', pointRadius:4, pointHoverRadius:6,
            tension:0.35, fill:true, spanGaps:false
          }
        ]
      },
      options:{
        responsive:true, maintainAspectRatio:false,
        plugins:{
          legend:{ labels:{ color:'#a8b3cf', font:{ size:11 } } },
          tooltip:{ backgroundColor:'#1e2230', borderColor:'#3a4060', borderWidth:1,
                    titleColor:'#e2e8ff', bodyColor:'#a8b3cf' }
        },
        scales:{
          x:{ ticks:{ color:'#a8b3cf', font:{ size:10 } }, grid:{ color:'rgba(255,255,255,0.05)' } },
          y:{ ticks:{ color:'#a8b3cf', font:{ size:10 }, callback: v=>v+'만' },
              grid:{ color:'rgba(255,255,255,0.05)' } }
        }
      }
    });
  });
}
// 월별 실수령 직접 입력값: key = "YYYY-MM" → 숫자(원)
let manualPay = {};

function saveManualPay(ym, val){
  const n = parseInt(val.replace(/,/g,''))||0;
  if(n===0) delete manualPay[ym];
  else manualPay[ym]=n;
  lsSave();
  renderDash();
}

function renderDash(){
  // ── 직업군 분기: N잡러면 별도 연간요약 렌더링 ──
  const _selectedJobs = (()=>{
    try{ const r=localStorage.getItem('atm2_selectedJobs'); if(r) return JSON.parse(r); }catch(e){}
    if(typeof jobType!=='undefined'&&jobType&&jobType!=='multi') return [jobType];
    return [];
  })();
  const _isEmployee = _selectedJobs.includes('employee') ||
    (typeof jobType!=='undefined' && jobType==='employee');
  if(!_isEmployee && _selectedJobs.length > 0){
    renderNjobYearlySummary();
    return;
  }

  const y = dashYear;
  const nowY = new Date().getFullYear();
  const nowM = new Date().getMonth(); // 0-indexed
  const months = [];
  for(let m=0;m<12;m++) months.push(getPayDataForMonth(y,m));

  // 월별 실제 지급액: 직접입력 우선, 없으면 앱 계산값
  // 미래 월은 앱 계산값만 (참고용)
  const MO_KO_S = ['1','2','3','4','5','6','7','8','9','10','11','12'];
  const isPastOrNow = (m) => y < nowY || (y === nowY && m <= nowM);

  const payList = months.map((d,m)=>{
    const ym = `${y}-${pad2(m+1)}`;
    const manual = manualPay[ym];
    // ★ "실수령 누적"/"예상 연봉" 등 라벨이 세후를 의미하므로 finalPay(4대보험·세금
    //   차감 후) 참조로 통일(이전엔 netPay=grossPay, 세전 — 용어 불일치였음)
    const auto = d.finalPay;
    const actual = manual !== undefined ? manual : auto;
    const hasManual = manual !== undefined;
    const isFuture = y > nowY || (y === nowY && m > nowM);
    return { m, ym, manual, auto, actual, hasManual, isFuture, d };
  });

  // 누적 연봉 (1월부터 현재까지 실지급 합산)
  const cumulativePay = payList
    .filter(p => !p.isFuture)
    .reduce((s,p) => s + p.actual, 0);

  // 연간 전체 예상 합산 (미래는 앱 계산값)
  const annualEstimate = payList.reduce((s,p) => s + p.actual, 0);

  // 연간 집계 (앱 계산 기반)
  const ann = {
    workH:  months.reduce((s,d)=>s+d.totalWorkH,0),
    OT:     months.reduce((s,d)=>s+d.totOT,0),
    night:  months.reduce((s,d)=>s+d.nightH,0),
    sat:    months.reduce((s,d)=>s+d.satH,0),
    sun:    months.reduce((s,d)=>s+d.sunH,0),
    leave:  months.reduce((s,d)=>s+d.lDays,0),
    absent: months.reduce((s,d)=>s+d.absDays,0),
    perfect:months.filter(d=>d.isPerfect).length,
  };

  const maxActual = Math.max(...payList.map(p=>p.actual), 1);
  const maxH = Math.max(...months.map(d=>d.totalWorkH), 1);

  // 분기별
  const quarters = [0,1,2,3].map(q=>{
    const ps = payList.slice(q*3,(q+1)*3);
    return {
      net: ps.reduce((s,p)=>s+p.actual,0),
      h:   months.slice(q*3,(q+1)*3).reduce((s,d)=>s+d.totalWorkH,0),
      hasData: ps.some(p=>!p.isFuture)
    };
  });

  // 월별 행 - 막대는 실제 데이터 있을 때만 표시
  const barRows = payList.map(({m, ym, actual, auto, hasManual, isFuture, d})=>{
    const pct  = actual>0        ? (actual/maxActual*100).toFixed(1)      : 0;
    const hpct = d.totalWorkH>0  ? (d.totalWorkH/maxH*100).toFixed(1)    : 0;
    const isNow     = (m===nowM && y===nowY);
    const manualVal = manualPay[ym]||'';
    const tagColor  = hasManual ? 'var(--yellow)' : (isFuture ? 'var(--text3)' : 'var(--green)');
    const tagText   = hasManual ? '직접' : (isFuture ? '예상' : '자동');
    const cumul     = payList.slice(0,m+1).filter(p=>!p.isFuture).reduce((s,p)=>s+p.actual,0);
    const hasData   = actual>0 || d.totalWorkH>0;

    const barHTML = hasData ? `
        <div style="height:14px;background:rgba(79,124,255,.12);border-radius:3px;overflow:hidden;margin-bottom:2px;">
          <div style="height:100%;width:${pct}%;background:${hasManual?'linear-gradient(90deg,#ffd166,#ff8c42)':'linear-gradient(90deg,var(--accent),var(--accent2))'};border-radius:3px;transition:width .5s;"></div>
        </div>
        <div style="height:7px;background:rgba(61,214,140,.1);border-radius:2px;overflow:hidden;">
          <div style="height:100%;width:${hpct}%;background:rgba(61,214,140,.45);border-radius:2px;transition:width .5s;"></div>
        </div>` :
      `<div style="height:23px;display:flex;align-items:center;"><span style="font-size:14px;color:var(--text3);">명세서를 입력하면 막대가 표시됩니다</span></div>`;

    return `
    <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.04);">
      <div style="width:26px;font-size:15px;font-weight:700;color:${isNow?'var(--accent)':'var(--text2)'};">${MO_KO_S[m]}월</div>
      <div style="flex:1;min-width:0;">${barHTML}</div>
      <div style="position:relative;width:110px;">
        <input type="text"
          placeholder="${isFuture?'앱 계산: '+(auto>0?auto.toLocaleString():'0')+'원':'명세서 입력'}"
          value="${manualVal?manualVal.toLocaleString():''}"
          style="width:100%;background:${hasManual?'rgba(255,209,102,.1)':'var(--surface2)'};border:1px solid ${hasManual?'var(--yellow)':'var(--border)'};color:var(--text);border-radius:6px;padding:4px 7px;font-size:15px;font-family:'JetBrains Mono';font-weight:700;outline:none;text-align:right;"
          onchange="saveManualPay('${ym}',this.value)">
        <span style="position:absolute;top:-8px;right:2px;font-size:12px;font-weight:700;color:${tagColor};">${tagText}</span>
      </div>
      <div style="width:34px;text-align:right;font-size:14px;color:var(--text3);">${d.totalWorkH>0?d.totalWorkH+'h':'-'}</div>
      <div style="width:80px;text-align:right;font-size:14px;color:var(--text3);">누적 ${cumul>0?fmtK(cumul):'-'}</div>
    </div>`;
  }).join('');

  document.getElementById('dash-page').innerHTML = `
  <!-- 헤더 -->
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
    <div>
      <h2 style="font-size:26px;font-weight:700;">💰 ${y}년 연봉 현황</h2>
      <div style="font-size:15px;font-weight:700;color:var(--accent);margin-top:4px;">월별 수입 흐름을 그래프로 확인해보세요</div>
      <div style="font-size:15px;color:var(--text3);margin-top:3px;">직접 입력(노란색) 우선 · 미입력 시 앱 자동계산</div>
    </div>
    <div style="display:flex;align-items:center;gap:8px;">
      <button onclick="dashYear--;renderDash()" style="width:44px;height:44px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text);font-size:20px;cursor:pointer;">◀</button>
      <span style="font-size:21px;font-weight:700;min-width:60px;text-align:center;">${y}년</span>
      <button onclick="dashYear++;renderDash()" style="width:44px;height:44px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text);font-size:20px;cursor:pointer;">▶</button>
    </div>
  </div>

  <!-- 연봉 메인 카드 -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
    <div style="background:linear-gradient(135deg,rgba(61,214,140,.15),rgba(79,124,255,.1));border:1px solid var(--green);border-radius:var(--radius);padding:20px;text-align:center;">
      <div style="font-size:16px;color:var(--text2);margin-bottom:6px;">📥 ${y}년 실수령 누적 (${y===nowY?nowM+1:12}월까지)</div>
      <div style="font-size:40px;font-weight:900;font-family:'JetBrains Mono';color:var(--green);">${fmtK(cumulativePay)}</div>
      <div style="font-size:14px;color:var(--text3);margin-top:4px;">직접입력 + 자동계산 합산</div>
    </div>
    <div style="background:linear-gradient(135deg,rgba(255,209,102,.1),rgba(255,140,66,.08));border:1px solid rgba(255,209,102,.4);border-radius:var(--radius);padding:20px;text-align:center;">
      <div style="font-size:16px;color:var(--text2);margin-bottom:6px;">📊 ${y}년 예상 연봉 (12개월)</div>
      <div style="font-size:40px;font-weight:900;font-family:'JetBrains Mono';color:var(--yellow);">${fmtK(annualEstimate)}</div>
      <div style="font-size:14px;color:var(--text3);margin-top:4px;">미래 월은 앱 계산값 기준</div>
    </div>
  </div>

  <!-- KPI 카드 -->
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px;margin-bottom:16px;">
    ${kpiCard('월 평균 실수령', fmtK(Math.round(cumulativePay/Math.max(payList.filter(p=>!p.isFuture).length,1))), 'var(--green)', '실지급 월 기준')}
    ${kpiCard('총 근무시간', ann.workH+'h', 'var(--accent)', '휴게 공제 후')}
    ${kpiCard('총 OT', ann.OT+'h', 'var(--yellow)', '평일 연장')}
    ${kpiCard('야간근무', ann.night+'h', 'var(--cyan)', '22~06시')}
    ${kpiCard('토요특근', ann.sat+'h', 'var(--sat)', '합계')}
    ${kpiCard('일요특근', ann.sun+'h', 'var(--sun)', '합계')}
    ${kpiCard('연차', ann.leave+'일', 'var(--green)', '사용 합계')}
    ${kpiCard('결근', ann.absent+'일', 'var(--red)', '합계')}
    ${kpiCard('만근', ann.perfect+'개월', 'var(--yellow)', '12개월 중')}
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
    <!-- 분기별 -->
    <div class="sal-section">
      <h3>📅 분기별 합산</h3>
      ${[0,1,2,3].map(q=>`
        <div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.04);">
          <div>
            <div style="font-size:17px;font-weight:700;color:var(--text2);">Q${q+1} · ${q*3+1}~${q*3+3}월</div>
            <div style="font-size:14px;color:var(--text3);">${quarters[q].h}h</div>
          </div>
          <div style="font-size:21px;font-weight:700;font-family:'JetBrains Mono';color:${quarters[q].hasData?'var(--green)':'var(--text3)'};">
            ${quarters[q].hasData?fmtK(quarters[q].net):'-'}
          </div>
        </div>`).join('')}
    </div>
    <!-- 입력 안내 -->
    <div class="sal-section">
      <h3>✏️ 직접입력 안내</h3>
      <div style="font-size:16px;color:var(--text2);line-height:1.9;">
        매월 <b style="color:var(--yellow)">실제 명세서</b>를 받으면<br>
        아래 표의 해당 월 칸에 입력하세요.<br><br>
        입력한 값은 <b style="color:var(--yellow)">노란 배경</b>으로 표시되며<br>
        앱 자동계산보다 <b style="color:var(--green)">우선 적용</b>됩니다.<br><br>
        <span style="color:var(--text3);font-size:15px;">입력값 지우면 자동계산으로 복귀</span>
      </div>
    </div>
  </div>

  <!-- 연간 차트 -->
  <div class="sal-section" style="margin-bottom:16px;">
    <h3>📈 월별 실수령액 추이</h3>
    <div style="position:relative;height:220px;" id="pay-chart-wrap">
      <canvas id="annual-pay-chart"></canvas>
      <div id="pay-chart-offline" style="display:none;height:100%;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:6px;color:var(--text3);font-size:17px;">
        <span style="font-size:34px;">📊</span>
        오프라인 상태 — 인터넷 연결 후 차트 표시
      </div>
    </div>
  </div>

  <div class="sal-section" style="margin-bottom:16px;">
    <h3>⏱️ 월별 근무시간 추이</h3>
    <div style="position:relative;height:180px;" id="hour-chart-wrap">
      <canvas id="annual-hour-chart"></canvas>
      <div id="hour-chart-offline" style="display:none;height:100%;display:flex;align-items:center;justify-content:center;color:var(--text3);font-size:17px;">
        오프라인 — 차트 불가 (수치는 아래 표에서 확인)
      </div>
    </div>
  </div>

  <!-- 월별 상세 -->
  <div class="sal-section">
    <h3>📋 월별 급여 상세</h3>
    <div style="display:flex;gap:12px;margin-bottom:10px;font-size:14px;color:var(--text3);flex-wrap:wrap;">
      <div style="display:flex;align-items:center;gap:4px;"><span style="width:10px;height:5px;background:linear-gradient(90deg,var(--accent),var(--accent2));border-radius:2px;display:inline-block;"></span>자동계산</div>
      <div style="display:flex;align-items:center;gap:4px;"><span style="width:10px;height:5px;background:linear-gradient(90deg,#ffd166,#ff8c42);border-radius:2px;display:inline-block;"></span>직접입력</div>
      <div style="display:flex;align-items:center;gap:4px;"><span style="width:10px;height:5px;background:rgba(61,214,140,.45);border-radius:2px;display:inline-block;"></span>근무시간</div>
      <span style="color:var(--accent);font-weight:700;">← 노란 칸에 실제 수령액 입력</span>
    </div>
    ${barRows}
  </div>`;

  // ★ 연간요약 통합(직장인+N잡 조합) — 기존 코드는 위까지 한 글자도 변경하지 않음.
  //   직장인 단독(_njobTypesForCombo.length===0)이면 아래 블록은 전혀 실행되지 않아
  //   화면이 기존과 100% 동일하다. 조합일 때만 "본업 수입(세후)" 라벨을 맨 위에,
  //   "N잡 수입 현황(세전)" 카드를 맨 아래에 추가로 삽입한다(innerHTML 재할당 아님 —
  //   insertAdjacentHTML로 기존 DOM에 추가만 함).
  const _njobTypesForCombo = _selectedJobs.filter(j=>j!=='employee');
  if(_njobTypesForCombo.length > 0 && typeof getNjobIncomeForMonth==='function'){
    const _dashPageEl = document.getElementById('dash-page');
    _dashPageEl.insertAdjacentHTML('afterbegin',
      `<div style="font-size:13px;font-weight:700;color:var(--accent);margin-bottom:10px;">🏢 본업 수입 (세후)</div>`);

    const _comboMonthly = Array.from({length:12}, (_,cm)=>{
      const _isFuture = y > nowY || (y === nowY && cm > nowM);
      const {gross} = getNjobIncomeForMonth(y, cm);
      return { m: cm, gross, isFuture: _isFuture };
    });
    const _comboPast = _comboMonthly.filter(d=>!d.isFuture && d.gross>0);
    const _comboTotal = _comboPast.reduce((s,d)=>s+d.gross,0);
    const _comboMax = Math.max(..._comboMonthly.map(d=>d.gross), 1);
    const _comboJobLabels = _njobTypesForCombo.map(j=>{
      const info = (typeof JOB_TYPES!=='undefined'&&JOB_TYPES[j]) || {};
      return (info.icon||'💼')+' '+(info.name||j);
    }).join(' · ');
    const _comboBarRows = _comboMonthly.map(({m:cm, gross, isFuture})=>{
      const pct = gross > 0 ? (gross/_comboMax*100).toFixed(1) : 0;
      const isNow = (cm===nowM && y===nowY);
      const label = isFuture
        ? `<span style="font-size:14px;color:var(--text3);">-</span>`
        : gross > 0
          ? `<span style="font-size:16px;font-weight:700;color:var(--text);font-family:'JetBrains Mono';">${fmtK(gross)}</span>`
          : `<span style="font-size:14px;color:var(--text3);">기록없음</span>`;
      const bar = gross > 0
        ? `<div style="height:14px;background:rgba(255,140,66,.12);border-radius:3px;overflow:hidden;">
             <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,var(--orange),var(--yellow));border-radius:3px;"></div>
           </div>`
        : `<div style="height:14px;display:flex;align-items:center;"><span style="font-size:14px;color:var(--text3);">${isFuture?'미래':'기록없음'}</span></div>`;
      return `
      <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.04);">
        <div style="width:26px;font-size:15px;font-weight:700;color:${isNow?'var(--accent)':'var(--text2)'};">${MO_KO_S[cm]}월</div>
        <div style="flex:1;min-width:0;">${bar}</div>
        <div style="width:90px;text-align:right;">${label}</div>
      </div>`;
    }).join('');

    const _njobSectionHTML = `
    <div class="sal-section" style="margin-top:16px;border:1px solid rgba(255,140,66,.25);">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;flex-wrap:wrap;gap:6px;">
        <h3 style="margin:0;">💼 N잡 수입 현황 (세전)</h3>
        <div style="font-size:13px;color:var(--text3);">${_comboJobLabels}</div>
      </div>
      <div style="font-size:13px;color:var(--text3);margin-bottom:10px;">본업 수입(세후)과는 세금 계산 방식이 달라 따로 집계해요</div>
      <div style="font-size:30px;font-weight:900;font-family:'JetBrains Mono';color:var(--orange);margin-bottom:10px;">${fmtK(_comboTotal)}</div>
      ${_comboBarRows}
    </div>`;
    _dashPageEl.insertAdjacentHTML('beforeend', _njobSectionHTML);
  }

  // ── Chart.js 차트 렌더링 ──
  requestAnimationFrame(() => {
    const MO_LABELS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
    const payVals   = payList.map(p => Math.round(p.actual / 10000));   // 만원 단위
    const hourVals  = months.map(d => Math.round(d.totalWorkH * 10) / 10);
    const otVals    = months.map(d => Math.round(d.totOT * 10) / 10);
    const bgColors  = payList.map(p => p.hasManual
      ? 'rgba(255,209,102,0.7)' : p.isFuture
      ? 'rgba(79,124,255,0.2)'
      : 'rgba(79,124,255,0.6)'
    );
    const borderColors = payList.map(p => p.hasManual
      ? 'rgba(255,209,102,1)' : p.isFuture
      ? 'rgba(79,124,255,0.4)'
      : 'rgba(79,124,255,1)'
    );

    // Chart.js 오프라인 체크
    if(typeof Chart === 'undefined' || window._chartFailed){
      ['pay-chart-wrap','hour-chart-wrap'].forEach(id=>{
        const wrap = document.getElementById(id);
        if(wrap){
          const canvas = wrap.querySelector('canvas');
          const msg = wrap.querySelector('[id$="-offline"]');
          if(canvas) canvas.style.display='none';
          if(msg) msg.style.display='flex';
        }
      });
      return; // 차트 렌더 건너뜀
    }

    const chartDefaults = {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#a8b3cf', font: { size: 11 } } },
                 tooltip: { backgroundColor: '#1e2230', borderColor: '#3a4060', borderWidth: 1,
                            titleColor: '#e2e8ff', bodyColor: '#a8b3cf' } },
      scales: {
        x: { ticks: { color: '#a8b3cf', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
        y: { ticks: { color: '#a8b3cf', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' } }
      }
    };

    // ① 실수령액 차트 (막대 + 선)
    const payCtx = document.getElementById('annual-pay-chart');
    if(payCtx && typeof Chart !== 'undefined') {
      if(payCtx._chartInst) payCtx._chartInst.destroy();
      payCtx._chartInst = new Chart(payCtx, {
        data: {
          labels: MO_LABELS,
          datasets: [
            {
              type: 'bar', label: '실수령액 (만원)',
              data: payVals,
              backgroundColor: bgColors, borderColor: borderColors,
              borderWidth: 1.5, borderRadius: 4,
              yAxisID: 'y'
            },
            {
              type: 'line', label: '추이선',
              data: payVals.map((v,i) => payList[i].isFuture ? null : v),
              borderColor: 'rgba(61,214,140,0.8)', backgroundColor: 'rgba(61,214,140,0.08)',
              pointBackgroundColor: 'rgba(61,214,140,1)', pointRadius: 4, pointHoverRadius: 6,
              tension: 0.35, fill: true, spanGaps: false,
              yAxisID: 'y'
            }
          ]
        },
        options: {
          ...chartDefaults,
          scales: {
            ...chartDefaults.scales,
            y: { ...chartDefaults.scales.y, ticks: { ...chartDefaults.scales.y.ticks,
              callback: v => v + '만' } }
          }
        }
      });
    }

    // ② 근무시간 차트 (막대 + OT 선)
    const hourCtx = document.getElementById('annual-hour-chart');
    if(hourCtx && typeof Chart !== 'undefined') {
      if(hourCtx._chartInst) hourCtx._chartInst.destroy();
      hourCtx._chartInst = new Chart(hourCtx, {
        data: {
          labels: MO_LABELS,
          datasets: [
            {
              type: 'bar', label: '총 근무 (h)',
              data: hourVals,
              backgroundColor: 'rgba(61,214,140,0.4)', borderColor: 'rgba(61,214,140,0.8)',
              borderWidth: 1.5, borderRadius: 4, yAxisID: 'y'
            },
            {
              type: 'line', label: 'OT (h)',
              data: otVals,
              borderColor: 'rgba(255,209,102,0.9)', backgroundColor: 'rgba(255,209,102,0.08)',
              pointBackgroundColor: 'rgba(255,209,102,1)', pointRadius: 3, pointHoverRadius: 5,
              tension: 0.35, fill: false, yAxisID: 'y2'
            }
          ]
        },
        options: {
          ...chartDefaults,
          scales: {
            x: chartDefaults.scales.x,
            y:  { ...chartDefaults.scales.y, position: 'left',
                  ticks: { ...chartDefaults.scales.y.ticks, callback: v => v + 'h' } },
            y2: { ...chartDefaults.scales.y, position: 'right', grid: { drawOnChartArea: false },
                  ticks: { ...chartDefaults.scales.y.ticks, callback: v => v + 'h', color: 'rgba(255,209,102,0.8)' } }
          }
        }
      });
    }
  });
}

function kpiCard(label, value, color, sub){
  return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:14px;">
    <div style="font-size:14px;color:var(--text3);margin-bottom:6px;">${label}</div>
    <div style="font-size:26px;font-weight:700;font-family:'JetBrains Mono';color:${color};">${value}</div>
    <div style="font-size:12px;color:var(--text3);margin-top:3px;">${sub}</div>
  </div>`;
}
function annRow(label, value, color){
  return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.04);">
    <span style="font-size:17px;color:var(--text2);">${label}</span>
    <span style="font-size:20px;font-weight:700;font-family:'JetBrains Mono';color:${color};">${value}</span>
  </div>`;
}
function fmtK(n){
  // 만원 단위 표시 (100만 이상은 백만원 단위)
  const abs=Math.abs(Math.round(n));
  if(abs>=100000000) return (n/100000000).toFixed(1)+'억원';
  if(abs>=10000000)  return Math.round(n/1000000)+'백만원';
  if(abs>=1000000)   return (n/1000000).toFixed(1)+'백만원';
  return Math.round(n).toLocaleString('ko-KR')+'원';
}

// ══════════════════════════════════════════

// ══════════════════════════════════════════
// 통합 수입관리 페이지
// 직장인 급여 + N잡(알바/배달/프리) 통합 표시
// ══════════════════════════════════════════
function renderIncomePage(){
  const page = document.getElementById('salary-page');
  if(!page) return;

  const _p = n => String(n).padStart(2,'0');
  const dim = new Date(curY, curM+1, 0).getDate();

  // ── 직장인 급여 ── (Income Gateway: selectedJobs에 employee가 없으면 집계하지 않음)
  let employeePay = 0;
  let employeeData = null;
  try{
    const selectedJobs = (typeof loadSelectedJobs==='function') ? loadSelectedJobs() : [];
    if(selectedJobs.indexOf('employee')>=0){
      const d = getPayData();
      if(d && d.finalPay > 0){ employeePay = d.finalPay; employeeData = d; }
    }
  }catch(e){}

  // ── N잡 수입 데이터 집계 (달력 calendar-modes.js와 동일한 atm2_njob_ 키 사용) ──
  let njobItems = [];  // 표시용 flat 목록
  let njobGross = 0;
  try{
    for(let d=1; d<=dim; d++){
      const key = `${curY}-${_p(curM+1)}-${_p(d)}`;
      const raw = localStorage.getItem('atm2_njob_'+key);
      if(!raw) continue;
      const data = JSON.parse(raw);
      const dateLabel = `${curM+1}/${d}`;
      // 알바: 시급 × 시간
      (data.alba||[]).forEach(it=>{
        let amt;
        if(it.amount && it.amount > 0){
          amt = it.amount; // 신버전: 야간수당 포함 amount 직접 사용
        } else if(it.dayHours !== undefined){
          const dayPay   = Math.round((it.dayHours||0)*(it.wage||0));
          const nightPay = Math.round((it.nightHours||0)*(it.wage||0)*1.5);
          amt = dayPay + nightPay + (it.extraNight||0) + (it.extraOver||0) + (it.extraOther||0) + (it.extraMeal||0);
        } else {
          amt = Math.round((it.wage||0)*(it.hours||0)); // 구버전
        }
        njobGross += amt;
        const det = it.detail || `${it.hours}h × ${(it.wage||0).toLocaleString()}원`;
        njobItems.push({jobType:'shortAlba', label:it.name||'알바', amount:amt,
          detail:det, date:dateLabel});
      });
      // 배달/대리: 건수 × 단가
      (data.delivery||[]).forEach(it=>{
        const amt = (it.count||0)*(it.price||0);
        njobGross += amt;
        njobItems.push({jobType:'delivery', label:it.name||'배달', amount:amt,
          detail:`${it.count}건 × ${(it.price||0).toLocaleString()}원`, date:dateLabel});
      });
      // 프리랜서: 건수 × 단가
      (data.free||[]).forEach(it=>{
        const amt = (it.count||0)*(it.price||0);
        njobGross += amt;
        njobItems.push({jobType:'freelancer', label:it.name||'프리랜서', amount:amt,
          detail:`${it.count}건 × ${(it.price||0).toLocaleString()}원`, date:dateLabel});
      });
      (data.etc||[]).forEach(it=>{
        const _EI={insurance:'🏥',gov:'🏛️',tax:'💸',platform:'📱',sale:'🛍️',finance:'📈',reward:'🎁',transfer:'💌',other:'✨'};
        njobGross += (it.amount||0);
        njobItems.push({jobType:'etc', label:it.name, amount:it.amount||0,
          detail:(_EI[it.cat]||'✨')+' '+(it.memo||''), date:dateLabel});
      });
    }
  }catch(e){}

  // ── 알바 월 누적 근무시간 → 60시간 초과 여부 판단 ──
  const albaMonthHours = njobItems
    .filter(it => it.jobType==='shortAlba' || it.jobType==='convenience')
    .reduce((s,it) => s+(it.hours||0), 0);
  const albaOver60 = albaMonthHours > 60;

  // ── N잡 세금 구분 ──
  const albaGrossForTax = njobItems
    .filter(it => it.jobType==='shortAlba' || it.jobType==='convenience')
    .reduce((s,it) => s+(it.amount||0), 0);
  const bizGross = njobGross - albaGrossForTax;

  let albaDeduct = 0;
  let albaInsDetail = '';
  if(albaOver60){
    const albaNP  = Math.round(albaGrossForTax * 0.045);
    const albaHI  = Math.round(albaGrossForTax * 0.03545);
    const albaLTC = Math.round(albaHI * 0.1295);
    const albaEI2 = Math.round(albaGrossForTax * 0.009);
    albaDeduct = albaNP + albaHI + albaLTC + albaEI2;
    albaInsDetail = `국민연금 ${albaNP.toLocaleString()}원 · 건강보험 ${albaHI.toLocaleString()}원 · 장기요양 ${albaLTC.toLocaleString()}원 · 고용보험 ${albaEI2.toLocaleString()}원`;
  } else {
    albaDeduct = Math.round(albaGrossForTax * 0.009);
  }
  const albaEI     = albaDeduct;
  const njobBizTax = Math.round(bizGross * 0.033);
  const njobTax    = albaEI + njobBizTax;
  const njobNet    = njobGross - njobTax;

  const totalNet = employeePay + njobNet;
  const hasEmployee = employeePay > 0;
  const hasNjob = njobGross > 0;

  page.innerHTML = `
  <!-- 헤더 -->
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px;">
    <div>
      <h2 style="font-size:26px;font-weight:700;">💰 ${curY}년 ${curM+1}월 수입관리</h2>
      <div style="font-size:15px;font-weight:700;color:var(--accent);margin-top:4px;">이번 달 받을 돈을 미리 확인해보세요</div>
      <div style="font-size:13px;color:var(--text2);margin-top:2px;">이 돈으로 버틸 수 있는지는 생존관리에서 확인할 수 있어요</div>
      <div style="font-size:15px;color:var(--text3);margin-top:2px;">달력 기록 자동 집계 · 직장+N잡 통합</div>
    </div>
    <div style="display:flex;gap:6px;">
      <button onclick="showPage('att')"
        style="padding:7px 12px;border-radius:8px;border:1px solid var(--border);
               background:var(--surface2);color:var(--text2);font-size:16px;
               cursor:pointer;font-family:'Noto Sans KR';">📅 달력으로</button>
    </div>
  </div>

  <!-- 총 실수령 큰 카드 -->
  <div style="background:linear-gradient(135deg,rgba(61,214,140,.15),rgba(79,124,255,.08));
              border:1px solid rgba(61,214,140,.3);border-radius:14px;padding:18px 20px;margin-bottom:14px;">
    <div style="font-size:16px;color:var(--text2);margin-bottom:6px;">이번달 총 실수령액</div>
    <div style="font-size:38px;font-weight:900;font-family:'JetBrains Mono';color:var(--green);">
      ${totalNet.toLocaleString()}원
    </div>
    ${totalNet === 0 ? `
    <div style="font-size:16px;color:var(--text3);margin-top:6px;">
      달력에서 근태/수입을 기록하면 자동으로 집계됩니다
    </div>` : `
    <div style="display:flex;gap:12px;margin-top:10px;flex-wrap:wrap;">
      ${hasEmployee?`<div style="font-size:16px;color:var(--text2);">🏢 직장 <b style="color:var(--accent)">${employeePay.toLocaleString()}원</b></div>`:''}
      ${hasNjob?`<div style="font-size:16px;color:var(--text2);">💼 N잡 <b style="color:var(--orange)">${njobNet.toLocaleString()}원</b></div>`:''}
    </div>`}
  </div>

  ${hasEmployee ? `
  <!-- 직장인 급여 섹션 -->
  <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;
              margin-bottom:10px;overflow:hidden;">
    <div onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none';this.querySelector('.acc-arr').textContent=this.nextElementSibling.style.display==='none'?'▼':'▲'"
      style="display:flex;align-items:center;justify-content:space-between;
             padding:12px 16px;cursor:pointer;background:rgba(79,124,255,.06);">
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:21px;">🏢</span>
        <span style="font-size:17px;font-weight:700;color:var(--accent);">직장 급여</span>
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:18px;font-weight:700;color:var(--accent);">${employeePay.toLocaleString()}원</span>
        <span class="acc-arr" style="font-size:16px;color:var(--text3);">▼</span>
      </div>
    </div>
    <div style="display:none;padding:14px 16px;">
      ${employeeData ? `
      <div style="display:flex;flex-direction:column;gap:5px;">
        <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);">
          <span style="font-size:16px;color:var(--text2);">기본급</span>
          <span style="font-size:16px;font-weight:700;color:var(--text);">${(employeeData.basePay||0).toLocaleString()}원</span>
        </div>
        ${(employeeData.totAllow||0)>0?`
        <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);">
          <span style="font-size:16px;color:var(--text2);">각종 수당</span>
          <span style="font-size:16px;font-weight:700;color:var(--green);">+${(employeeData.totAllow||0).toLocaleString()}원</span>
        </div>`:''}
        ${(employeeData.totDeduct||0)>0?`
        <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);">
          <span style="font-size:16px;color:var(--text2);">4대보험+세금</span>
          <span style="font-size:16px;font-weight:700;color:var(--red);">-${(employeeData.totDeduct||0).toLocaleString()}원</span>
        </div>`:''}
        <div style="display:flex;justify-content:space-between;padding:7px 0;">
          <span style="font-size:17px;font-weight:700;color:var(--text);">실수령</span>
          <span style="font-size:20px;font-weight:700;color:var(--green);">${employeePay.toLocaleString()}원</span>
        </div>
      </div>
      <button onclick="if(typeof renderSalary==='function'){renderSalary();document.getElementById('salary-page').scrollTop=0;}"
        style="width:100%;margin-top:10px;padding:8px;border-radius:8px;border:1px solid var(--border);
               background:var(--surface2);color:var(--text2);font-size:16px;cursor:pointer;
               font-family:'Noto Sans KR';">📊 급여 상세분석 보기</button>
      ` : '<div style="font-size:16px;color:var(--text3);text-align:center;padding:12px;">근태 기록 후 자동 계산됩니다</div>'}
    </div>
  </div>` : ''}

  __NJOB_PLACEHOLDER__`;

  // ── N잡 섹션 직접 DOM 추가 (template literal 중첩 방지) ──
  const NJOB_ICONS = {convenience:'🏪',delivery:'🛵',driver:'🚗',freelancer:'💻',shortAlba:'📋',etc:'➕',employee:'🏢'};

  // 알바 집계
  const albaItems  = njobItems.filter(it=>it.jobType==='shortAlba'||it.jobType==='convenience');
  const delivItems = njobItems.filter(it=>it.jobType==='delivery'||it.jobType==='driver');
  const freeItems  = njobItems.filter(it=>it.jobType==='freelancer');
  const etcItems   = njobItems.filter(it=>it.jobType==='etc');

  const albaGross  = albaItems.reduce((s,it)=>s+(it.amount||0),0);
  const delivGross = delivItems.reduce((s,it)=>s+(it.amount||0),0);
  const freeGross  = freeItems.reduce((s,it)=>s+(it.amount||0),0);
  const etcGross   = etcItems.reduce((s,it)=>s+(it.amount||0),0);

  function makeNjobSection(label, icon, color, items, gross){
    const isAlba = label.includes('알바');
    const net = isAlba ? Math.round(gross * 0.991) : Math.round(gross * 0.967);
    const rows = items.map(it=>`
      <div style="display:flex;justify-content:space-between;align-items:center;
                  padding:7px 0;border-bottom:1px solid var(--border);">
        <div>
          <div style="font-size:17px;font-weight:600;color:var(--text);">${NJOB_ICONS[it.jobType]||icon} ${it.label||label}</div>
          <div style="font-size:15px;color:var(--text3);">${it.date||''} · ${it.detail||''}</div>
        </div>
        <span style="font-size:17px;font-weight:700;color:${color};">+${(it.amount||0).toLocaleString()}원</span>
      </div>`).join('');

    const inner = items.length>0 ? rows + `
      <div style="display:flex;justify-content:space-between;padding:8px 0;border-top:1px solid var(--border);margin-top:4px;">
        <span style="font-size:16px;color:var(--text2);">${isAlba?'고용보험(0.9%) 공제 후':'3.3% 공제 후'}</span>
        <span style="font-size:18px;font-weight:700;color:var(--green);">${net.toLocaleString()}원</span>
      </div>` :
      '<div style="font-size:16px;color:var(--text3);text-align:center;padding:12px;">이번달 기록 없음</div>';

    const amtLabel = items.length>0 ? `${net.toLocaleString()}원` : '0원';
    const cntLabel = items.length>0 ? `${items.length}건` : '';

    return `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;margin-bottom:10px;overflow:hidden;">
      <div onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none';this.querySelector('.acc-arr').textContent=this.nextElementSibling.style.display==='none'?'▼':'▲'"
        style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;cursor:pointer;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:21px;">${icon}</span>
          <span style="font-size:17px;font-weight:700;color:${color};">${label}</span>
          <span style="font-size:15px;color:var(--text3);">${cntLabel}</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:18px;font-weight:700;color:${color};">${amtLabel}</span>
          <span class="acc-arr" style="font-size:16px;color:var(--text3);">▼</span>
        </div>
      </div>
      <div style="display:none;padding:14px 16px;">${inner}</div>
    </div>`;
  }

  const njobHTML =
    `<div style="background:rgba(255,140,66,.06);border:1px solid rgba(255,140,66,.15);
              border-radius:10px;padding:10px 14px;margin-bottom:8px;font-size:15px;color:var(--text2);line-height:1.8;">
      ℹ️ <b>알바 세금 안내</b><br>
      · 월 60시간 이하 → 고용보험(0.9%)만 공제<br>
      · 월 60시간 초과 → 4대보험 전체 공제 (국민연금+건강보험+장기요양+고용보험)<br>
      · 60시간 초과 첫 명세서에서 이전 미공제분 <b>소급 정산</b> 발생 가능
    </div>` +
    makeNjobSection('알바 수입','⏰','var(--orange)', albaItems, albaGross) +
    makeNjobSection('배달·대리 수입','🛵','var(--yellow)', delivItems, delivGross) +
    makeNjobSection('프리랜서 수입','💻','var(--accent)', freeItems, freeGross) +
    (etcGross>0 ? makeNjobSection('기타 수입','➕','var(--text2)', etcItems, etcGross) : '');

  const taxHTML = njobGross>0 ? `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px 16px;margin-bottom:16px;">
      <div style="font-size:17px;font-weight:700;color:var(--text);margin-bottom:10px;">📋 N잡 세금 안내</div>
      <div style="font-size:16px;color:var(--text2);line-height:2;">
        <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border);">
          <span>N잡 총 수입 (세전)</span><span style="font-weight:700;">${njobGross.toLocaleString()}원</span>
        </div>
        ${albaGrossForTax>0?`
        <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border);">
          <span>⏰ 알바 수입 (근로소득)</span><span style="font-weight:700;color:var(--orange);">${albaGrossForTax.toLocaleString()}원</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border);">
          <span style="padding-left:8px;font-size:15px;">└ 이달 누적 ${Math.round(albaMonthHours*10)/10}시간 · ${albaOver60?'⚠️ 60h 초과':'✅ 60h 이하'}</span>
          <span style="font-weight:700;color:var(--red);">-${albaEI.toLocaleString()}원</span>
        </div>
        ${albaOver60?`<div style="padding:5px 8px;margin:2px 0 4px;background:rgba(255,107,107,.08);border-radius:6px;font-size:14px;color:var(--text3);line-height:1.7;border-bottom:1px solid var(--border);">🚨 4대보험 전체 적용 · ${albaInsDetail}<br>⚠️ 소급 정산 발생 가능 - 명세서 확인 필수</div>`:''}
        `:''}
        ${bizGross>0?`
        <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border);">
          <span>💻 프리랜서·배달 (사업소득)</span><span style="font-weight:700;">${bizGross.toLocaleString()}원</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border);">
          <span style="padding-left:8px;">└ 3.3% 원천징수</span><span style="font-weight:700;color:var(--red);">-${njobBizTax.toLocaleString()}원</span>
        </div>`:''}
        <div style="display:flex;justify-content:space-between;padding:6px 0;">
          <span style="font-weight:700;">N잡 실수령</span>
          <span style="font-weight:700;font-size:18px;color:var(--green);">${njobNet.toLocaleString()}원</span>
        </div>
      </div>
      <div style="margin-top:8px;padding:8px 10px;background:rgba(255,209,102,.07);border-radius:7px;font-size:15px;color:var(--text3);line-height:1.8;">
        ⚠️ 알바 근로소득은 3.3% 아닌 고용보험(0.9%)만 적용!<br>프리랜서·배달 사업소득 → <b>5월 종합소득세 신고</b> 필수<br>ℹ️ 세금 방식은 계약 형태에 따라 다를 수 있어요
      </div>
    </div>` : '';

  page.innerHTML = page.innerHTML.replace('__NJOB_PLACEHOLDER__', njobHTML + taxHTML);
}
// ══════════════════════════════════════════
