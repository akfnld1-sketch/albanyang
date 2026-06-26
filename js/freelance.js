// ══════════════════════════════════════════
// freelance.js — N잡·알바·프리랜서 수입 관리
// v13: 직종별 계산방식 분리
//   시간제: 편의점/단기알바/쿠팡물류 → 시급×시간
//   건수제: 배달/대리/프리랜서 → 건수×건당단가 (여러건 추가)
// ══════════════════════════════════════════

// ── 플랫폼 수수료 정보 ──────────────────────
const PLATFORM_FEE = {
  none:    { label:'직접거래',  fee:0,    tax33:true },
  kmong:   { label:'크몽',      fee:'kmong', tax33:true },
  wishket: { label:'위시켓',   fee:0.10, tax33:true },
  taling:  { label:'탈잉',     fee:0.30, tax33:true },
  soomgo:  { label:'숨고',     fee:0,    tax33:true },
  custom:  { label:'직접입력', fee:null, tax33:true },
};

// 크몽 누진 수수료 계산
// 서비스이용료(구간별) + 결제망이용료(3.3%) + 부가세((서비스이용료+결제망이용료)×10%)
function calcKmongFee(amount){
  // 서비스 이용료 (누진)
  let serviceAmt = 0;
  if(amount <= 700000){
    serviceAmt = Math.round(amount * 0.164);
  } else if(amount <= 2000000){
    serviceAmt = Math.round(700000 * 0.164) + Math.round((amount - 700000) * 0.094);
  } else {
    serviceAmt = Math.round(700000 * 0.164) + Math.round(1300000 * 0.094) + Math.round((amount - 2000000) * 0.044);
  }
  // 결제망 이용료 3.3%
  const pgAmt = Math.round(amount * 0.033);
  // 부가세 10%
  const vatAmt = Math.round((serviceAmt + pgAmt) * 0.10);
  const totalFee = serviceAmt + pgAmt + vatAmt;
  const net = amount - totalFee;
  const effectiveRate = amount > 0 ? totalFee / amount : 0;
  return { serviceAmt, pgAmt, vatAmt, totalFee, net, effectiveRate };
}

function calcPlatformNet(grossAmount, platformKey, customFeeRate, includeTax33){
  // 크몽은 별도 누진 계산
  if(platformKey === 'kmong'){
    const k = calcKmongFee(grossAmount);
    // ★ 크몽은 calcKmongFee 내부에서 pgAmt(결제망 3.3%)를 이미 totalFee에 포함
    // → 여기서 추가로 3.3% 원천징수하면 이중 공제 발생 → tax33Amt = 0 고정
    return {
      feeRate: k.effectiveRate,
      feeAmt: k.totalFee,
      afterFee: k.net,
      tax33Amt: 0,
      net: k.net,
      kmongDetail: k,
    };
  }
  const p = PLATFORM_FEE[platformKey] || PLATFORM_FEE['none'];
  const feeRate = (platformKey === 'custom') ? (parseFloat(customFeeRate)||0)/100 : p.fee;
  const feeAmt  = Math.round(grossAmount * feeRate);
  const afterFee = grossAmount - feeAmt;
  const tax33Amt = (includeTax33 !== false && p.tax33) ? Math.round(afterFee * 0.033) : 0;
  const net = afterFee - tax33Amt;
  return { feeRate, feeAmt, afterFee, tax33Amt, net };
}

// 직종별 계산 타입
const JOB_CALC_TYPE = {
  convenience: 'hourly',   // 시급×시간
  shortAlba:   'hourly',
  delivery:    'perCase',  // 건수×단가
  driver:      'perCase',
  freelancer:  'perCase',
  etc:         'manual',
};

// ── 자연어 파서 ──────────────────────────
const NL_PATTERNS = [
  { key:'convenience', regex:/편의점|마트|슈퍼|쿠팡물류/ },
  { key:'delivery',    regex:/배달|쿠팡이츠|배민|요기요/ },
  { key:'driver',      regex:/대리기사|대리운전|대리/ },
  { key:'freelancer',  regex:/프리랜서|외주|프리/ },
  { key:'shortAlba',   regex:/단기|행사|알바/ },
];

function parseNaturalInput(text){
  const results = [];
  if(!text) return results;

  const hourMatch = text.match(/(\d+\.?\d*)\s*시간/g) || [];
  const hours = hourMatch.map(m => parseFloat(m));

  const caseMatch = text.match(/(\d+)\s*(건|콜|회|개)/g) || [];
  const cases = caseMatch.map(m => parseInt(m));

  const amountMatch = text.match(/(\d+)\s*만\s*원?|(\d+)\s*원/g) || [];
  const amounts = amountMatch.map(m => {
    if(m.includes('만')) return parseInt(m) * 10000;
    return parseInt(m.replace(/원/,''));
  }).filter(a => a > 0);

  let hIdx=0, cIdx=0, aIdx=0;

  for(const p of NL_PATTERNS){
    if(p.regex.test(text)){
      const calc = JOB_CALC_TYPE[p.key] || 'hourly';
      const entry = { typeLabel: p.key, calc };
      if(calc === 'hourly' && hIdx < hours.length) entry.hours = hours[hIdx++];
      else if(calc === 'perCase' && cIdx < cases.length) entry.cases = cases[cIdx++];
      else if(aIdx < amounts.length) entry.amount = amounts[aIdx++];
      results.push(entry);
    }
  }

  if(results.length === 0 && amounts.length > 0)
    results.push({ typeLabel:'etc', calc:'manual', amount:amounts[0] });

  return results;
}

// ── 수입 계산 ──────────────────────────
function calcJobIncome(entry, wages){
  let amount = 0, detail = '';
  if(entry.calc === 'hourly'){
    const wage = wages[entry.typeLabel] || 10320;
    if(entry.hours){ amount = Math.round(entry.hours * wage); detail = `${entry.hours}시간 × ${wage.toLocaleString()}원`; }
    else if(entry.amount){ amount = entry.amount; detail = '직접 입력'; }
  } else if(entry.calc === 'perCase'){
    // 건수제는 items 배열로 관리 (여러 건 추가)
    if(entry.items && entry.items.length > 0){
      amount = entry.items.reduce((s,it) => s + (parseInt(it.count)||0)*(parseInt(it.price)||0), 0);
      detail = `${entry.items.length}종 ${entry.items.reduce((s,it)=>s+(parseInt(it.count)||0),0)}건`;
    } else if(entry.amount){ amount = entry.amount; detail = '직접 입력'; }
  } else {
    amount = entry.amount || 0; detail = '직접 입력';
  }
  return { amount, detail };
}

// ── 주휴수당 계산 ──────────────────────
function calcWeeklyHolidayPay(weeklyHours, hourlyWage){
  if(weeklyHours < 15) return 0;
  return Math.round(hourlyWage * 8);
}

// ══════════════════════════════════════════
// 알바 실수령액 (4대보험·연장·야간 반영)
// ── 직장인(salary.js)과 같은 계산기를 재사용하므로 이 섹션에는
//    새 4대보험/세금 "계산기"를 만들지 않고, 알바 데이터 집계 + 적격성 판단만 담당함
// ══════════════════════════════════════════

/**
 * getAlbaJobWeeklyHours(y, m): 일반알바(albaData, 레거시) + N잡알바(njobLoad)를
 * "알바명" 단위(사업장 근사)로 병합해, getWeekRanges()의 주 단위 구간에 시간/금액을 집계.
 *
 * ★ 3단계 — 데이터 병합까지만 담당. 주휴수당 발생 판정(15h+개근)과 실제 급여 가산은
 *   getAlbaMonthlyAggregate()/getAlbaPaySummary()에 연결하는 4~5단계에서 진행.
 *
 * 반환: getWeekRanges(y,m)와 동일한 주 구조에 byJob 필드를 추가한 배열
 *   [{ weekKey, weekLabel, isFutureWeek, byJob:{ [알바명]: {hours, gross} } }, ...]
 *
 * 같은 알바명이 레거시(albaData)와 N잡(njobLoad)에 동시에 존재하면 같은 사업장으로 보고
 * 시간/금액을 합산한다(정책: 알바명 기반 식별 유지, 별도 사업장ID 없음).
 */
function getAlbaJobWeeklyHours(y, m){
  const weekRanges = (typeof getWeekRanges === 'function') ? getWeekRanges(y, m) : [];

  return weekRanges.map(wr => {
    const byJob = {};
    const addJob = (name, hours, gross) => {
      const k = name || '알바';
      if(!byJob[k]) byJob[k] = {hours:0, gross:0};
      byJob[k].hours += hours;
      byJob[k].gross += gross;
    };

    wr.days.forEach(dayInfo => {
      const key = dk(dayInfo.y, dayInfo.m, dayInfo.d);

      // 레거시 단독알바(albaData) — 야간/연장 분리 없는 단순 시급 계산
      if(typeof albaData !== 'undefined'){
        (albaData[key]||[]).forEach(it=>{
          let h = it.endH - it.startH; if(h<0) h += 24;
          const amt = Math.round(h * (it.wage||0));
          addJob(it.name, h, amt);
        });
      }

      // N잡 알바(njobLoad)
      if(typeof njobLoad === 'function'){
        const nd = njobLoad(key);
        (nd.alba||[]).forEach(it=>{
          const wage = it.wage || 0;
          const hours = it.hours || 0;
          const amt = (it.amount != null) ? it.amount : Math.round(wage*hours);
          addJob(it.name, hours, amt);
        });
      }
    });

    return {
      weekKey: wr.weekKey,
      weekLabel: wr.weekLabel,
      isFutureWeek: wr.isFutureWeek,
      byJob
    };
  });
}

/**
 * getGeneralAlbaWeeklyHolidayData(y, m): 일반알바/N잡알바(getAlbaJobWeeklyHours 기반)
 * 주휴수당 발생 판정. 알바명 단위(사업장 근사)로 독립 판정.
 *
 * 정책(A안 확정): 일반알바/N잡알바는 예정근무 정보가 없어 "결근" 개념을 적용할 데이터가
 * 없으므로, 해당 주 실근무시간이 15h 이상이면 개근으로 간주해 주휴 발생으로 처리(추정치).
 * → 화면에는 반드시 "예정근무 정보가 없어 실근무시간 기준으로 추정 계산됩니다" 안내 필요
 *   (UI 반영은 7단계에서 진행).
 *
 * 1회 주휴수당 금액은 해당 주·해당 알바명의 평균 시급(그 주 금액÷시간)×8h로 추정.
 *
 * ★ 4단계 — 판정 결과 생성까지만 담당. getAlbaMonthlyAggregate()/getAlbaPaySummary()
 *   실제 급여 가산 연결은 5단계에서 진행.
 *
 * 반환: [{ weekKey, weekLabel, isFutureWeek,
 *          byJob:{ [알바명]: {hours, gross, cond1, holidayOk, amount} } }, ...]
 */
function getGeneralAlbaWeeklyHolidayData(y, m){
  const weeklyHours = (typeof getAlbaJobWeeklyHours === 'function') ? getAlbaJobWeeklyHours(y, m) : [];

  return weeklyHours.map(week => {
    const byJob = {};
    Object.keys(week.byJob).forEach(name => {
      const job = week.byJob[name];
      const cond1 = job.hours >= 15;
      // 진행중 주는 아직 끝나지 않아 확정할 수 없으므로 holidayOk=false(미달이 아니라 미확정)
      const holidayOk = !week.isFutureWeek && cond1;
      const avgWage = job.hours > 0 ? job.gross / job.hours : 0;
      const amount = holidayOk ? Math.round(avgWage * 8) : 0;
      byJob[name] = { hours: job.hours, gross: job.gross, cond1, holidayOk, amount };
    });

    return {
      weekKey: week.weekKey,
      weekLabel: week.weekLabel,
      isFutureWeek: week.isFutureWeek,
      byJob
    };
  });
}

// 레거시(albaData) + N잡(njobLoad) 알바 항목을 한 달치로 합산
// byJob: 4대보험 60h 판정을 "알바명" 단위로 하기 위한 집계(고용주별 판정 근사)
function getAlbaMonthlyAggregate(y, m){
  const dim = new Date(y, m+1, 0).getDate();
  let legacyGross = 0, legacyHours = 0;
  let njobGross = 0, njobHours = 0, otPay = 0, nightPay = 0;
  const byJob = {};

  const addJob = (name, hours, gross) => {
    const k = name || '알바';
    if(!byJob[k]) byJob[k] = {hours:0, gross:0};
    byJob[k].hours += hours;
    byJob[k].gross += gross;
  };

  for(let d=1; d<=dim; d++){
    const key = (typeof dk==='function') ? dk(y,m,d) : `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;

    // 레거시 단독알바(albaData) — 야간/연장 분리 없는 단순 시급 계산
    if(typeof albaData !== 'undefined'){
      (albaData[key]||[]).forEach(it=>{
        let h = it.endH - it.startH; if(h<0) h += 24;
        const amt = Math.round(h * (it.wage||0));
        legacyGross += amt; legacyHours += h;
        addJob(it.name, h, amt);
      });
    }

    // N잡 알바(njobLoad) — otHours/nightHours 필드가 있으면 반영(과거 데이터는 0으로 처리)
    if(typeof njobLoad === 'function'){
      const nd = njobLoad(key);
      (nd.alba||[]).forEach(it=>{
        const wage = it.wage || 0;
        const hours = it.hours || 0;
        const amt = (it.amount != null) ? it.amount : Math.round(wage*hours);
        const oh = it.otHours || 0;
        const nh = it.nightHours || 0;
        njobGross += amt; njobHours += hours;
        otPay    += Math.round(oh*wage*0.5);
        nightPay += Math.round(nh*wage*0.5);
        addJob(it.name, hours, amt);
      });
    }
  }

  // ── 회사알바 기본수입 집계(dayData 기반) ──
  // 회사알바는 직장인과 동일하게 dayData[status/start/end]에 저장되므로, 같은 net-hours
  // 계산(calcNetHours)을 그대로 써서 "근무한 시간 × 시급"을 단순 집계.
  // ★ byJob(알바명 단위, 60h 4대보험 판정용) 밖의 별도 합계(companyGross/companyHours)로만
  //   처리 — 회사알바를 byJob에 넣지 않음(정책: 60h 4대보험 판정 대상에 포함하지 않음,
  //   5단계에서 만든 "회사알바 주휴수당도 byJob 밖" 설계와 일관성 유지).
  // ★ 연장(OT)/야간수당 가산 없이 단순 시급(net×hourlyRate)만 집계 — 1차 최소 범위.
  let companyGross = 0, companyHours = 0;
  // ★ Income Gateway 연계: dayData는 "회사알바"(알바인데 캘린더로 출퇴근 기록) 전용 입력이다.
  //   employee가 selectedJobs에 별도로 선택되어 있으면 같은 dayData가 이미 직장인 수입
  //   계산(getPayData)에 쓰이고 있으므로, 여기서 또 가져오면 이중집계가 된다. employee가
  //   선택되어 있지 않을 때만 dayData를 "회사알바" 수입으로 집계한다.
  const _selJobsForCompany = (typeof loadSelectedJobs==='function') ? loadSelectedJobs() : [];
  const _hasEmployeeAlready = _selJobsForCompany.indexOf('employee')>=0;
  // ★ "회사알바"는 albaSubtype==='company'로 명시적으로 설정된 경우에만 의미가 있다.
  //   이 체크가 없으면, 일반 알바로 전환한 사용자의 과거 직장인 시절 dayData 잔존 기록이
  //   "회사알바 수입"으로 잘못 해석되는 문제가 있었음(직업변경 반복 시나리오에서 발견).
  let _albaSubtypeForCompany = '';
  try{ _albaSubtypeForCompany = localStorage.getItem('atm2_albaSubtype')||''; }catch(e){}
  const _isCompanyAlba = _albaSubtypeForCompany === 'company';
  if(!_hasEmployeeAlready && _isCompanyAlba){
    const monthData = (y === curY && m === curM)
      ? dayData
      : ((typeof attLoadMonth === 'function' && activeWpId && activeEmpId)
          ? attLoadMonth(activeWpId, activeEmpId, y, m) : {});
    const companyWorkStates = ['work','early','half','sat_work','sun_work','holiday'];
    for(let d=1; d<=dim; d++){
      const data = monthData[dk(y, m, d)];
      if(!data || !data.status) continue;
      if(companyWorkStates.includes(data.status)){
        const net = calcNetHours(data.start, data.end, data.status, data.shift);
        companyGross += Math.round(net * hourlyRate);
        companyHours += net;
      } else if(data.status === 'leave'){
        // 연차(유급) — 8h 기준(getWeeklyHolidayData 등 기존 관례와 동일)
        companyGross += Math.round(8 * hourlyRate);
        companyHours += 8;
      }
    }
  }

  // ── 주휴수당 가산(5단계) ──
  // 확정된 주(isFutureWeek=false 이고 holidayOk=true)만 totalGross에 가산.
  // 진행중 주는 weeklyHolidayDetail에 기록만 하고 금액은 가산하지 않음(holidayOk가 이미 false라 자연히 제외됨).
  // ★ 일반알바/N잡알바 주휴수당은 byJob[name].gross에도 가산(4대보험 산정 정확성용) —
  //   60h 판정 기준인 byJob[name].hours는 절대 건드리지 않음(시간 카운트 불변).
  // ★ 회사알바 주휴수당은 byJob 체계(알바명 단위) 밖이므로 totalGross에만 가산되고
  //   byJob에는 포함되지 않음 — 회사알바 자체가 이 함수의 byJob/4대보험 판정 대상이 아닌
  //   기존 구조(회사알바 기본 시급 수입도 이 집계에 포함되지 않음)를 그대로 따름.
  let weeklyHolidayPay = 0;
  const weeklyHolidayDetail = [];

  if(!_hasEmployeeAlready && _isCompanyAlba && typeof getCompanyAlbaWeeklyHolidayData === 'function'){
    getCompanyAlbaWeeklyHolidayData(y, m).forEach(w => {
      weeklyHolidayDetail.push({
        source: 'company', jobName: '회사알바',
        weekKey: w.weekKey, weekLabel: w.weekLabel,
        isFutureWeek: w.isFutureWeek, holidayOk: w.holidayOk, amount: w.amount
      });
      if(w.holidayOk) weeklyHolidayPay += w.amount;
    });
  }

  if(typeof getGeneralAlbaWeeklyHolidayData === 'function'){
    getGeneralAlbaWeeklyHolidayData(y, m).forEach(w => {
      Object.keys(w.byJob).forEach(name => {
        const job = w.byJob[name];
        weeklyHolidayDetail.push({
          source: 'general', jobName: name,
          weekKey: w.weekKey, weekLabel: w.weekLabel,
          isFutureWeek: w.isFutureWeek, holidayOk: job.holidayOk, amount: job.amount
        });
        if(job.holidayOk){
          weeklyHolidayPay += job.amount;
          if(byJob[name]) byJob[name].gross += job.amount;
          else addJob(name, 0, job.amount); // 안전망(이론상 이미 byJob에 존재해야 함)
        }
      });
    });
  }

  return {
    totalGross: legacyGross + njobGross + companyGross + weeklyHolidayPay,
    totalHours: legacyHours + njobHours + companyHours,
    otPay, nightPay, byJob,
    companyGross, companyHours,
    weeklyHolidayPay,
    weeklyHolidayDetail
  };
}

// 4대보험 — calc4Insurance()(salary.js)를 그대로 재사용, 여기서는 "적격성"만 판단
// 국민연금/건강보험(+장기요양): 알바명 단위 월 60시간 이상일 때만 적용
// 고용보험: 시간 기준과 무관하게 해당 알바에 근무 실적이 있으면 별도로 적용
function getAlbaInsuranceSummary(byJob){
  let np=0, hi=0, ltc=0, ei=0;
  Object.keys(byJob||{}).forEach(name=>{
    const job = byJob[name];
    const npHiEligible = job.hours >= 60;
    const eiEligible = job.hours > 0;
    const raw = (typeof calc4Insurance === 'function') ? calc4Insurance(job.gross) : {np:0,hi:0,ltc:0,ei:0};
    if(npHiEligible){ np += raw.np; hi += raw.hi; ltc += raw.ltc; }
    if(eiEligible){ ei += raw.ei; }
  });
  return { np, hi, ltc, ei, total: np+hi+ltc+ei };
}

// 알바 월 실수령액 종합 — gross → 연장/야간 → 4대보험 → 세금 → 최종 실수령액
function getAlbaPaySummary(y, m){
  const agg = getAlbaMonthlyAggregate(y, m);
  const ins = getAlbaInsuranceSummary(agg.byJob);
  // 세금: 근로소득 가정 시 직장인과 동일한 calcIncomeTax()를 재사용(참고용 근사치)
  const taxRaw = (typeof calcIncomeTax === 'function') ? calcIncomeTax(agg.totalGross) : {income:0, local:0, total:0};
  const tax = agg.totalGross > 0 ? taxRaw : {income:0, local:0, total:0};
  const finalPay = Math.max(0, agg.totalGross - ins.total - tax.total);
  return {
    grossPay: agg.totalGross,
    totalHours: agg.totalHours,
    otPay: agg.otPay,
    nightPay: agg.nightPay,
    ins, tax, finalPay,
    byJob: agg.byJob,
    companyGross: agg.companyGross,
    companyHours: agg.companyHours,
    weeklyHolidayPay: agg.weeklyHolidayPay,
    weeklyHolidayDetail: agg.weeklyHolidayDetail
  };
}

// ── 메인 렌더 ──────────────────────────
function renderIncomeCalc(){
  const page = document.getElementById('salary-page');
  if(!page) return;

  const selectedJobs = loadSelectedJobs ? loadSelectedJobs() : [];
  const isEmployee = selectedJobs.includes('employee') || jobType === 'employee';
  if(isEmployee){ if(typeof renderSalaryPage==='function') renderSalaryPage(); return; }

  const incKey = `atm2_income_${curY}_${pad2(curM+1)}`;
  let incomeItems = [];
  try{ const raw=localStorage.getItem(incKey); if(raw) incomeItems=JSON.parse(raw); }catch(e){}

  const wageKey = 'atm2_jobWages';
  let wages = {};
  try{ const raw=localStorage.getItem(wageKey); if(raw) wages=JSON.parse(raw); }catch(e){}

  const totalGross = incomeItems.reduce((s,it)=>s+(parseInt(it.amount)||0),0);
  // 플랫폼 수수료가 있는 항목은 platformNet, 없는 항목은 amount로 집계
  const totalAfterFee = incomeItems.reduce((s,it)=>{
    if(it.platformNet != null) return s + parseInt(it.platformNet);
    return s + (parseInt(it.amount)||0);
  },0);
  const totalPlatformFee = incomeItems.reduce((s,it)=>s+(parseInt(it.platformFeeAmt)||0),0);
  // 플랫폼수수료 미적용 항목에만 3.3% 적용
  const tax33 = incomeItems.reduce((s,it)=>{
    if(it.tax33Override != null) return s + (parseInt(it.tax33Override)||0);
    return s + Math.round((parseInt(it.amount)||0)*0.033);
  },0);
  const afterTax = totalGross - totalPlatformFee - tax33;

  const byType = {};
  incomeItems.forEach(it=>{
    const t = it.jobType||'etc';
    if(!byType[t]) byType[t]={total:0,count:0};
    byType[t].total += parseInt(it.amount)||0;
    byType[t].count++;
  });

  const totalHours = incomeItems.reduce((s,it)=>s+(parseFloat(it.hours)||0),0);

  const jobChips = selectedJobs.filter(j=>j!=='employee').map(j=>{
    const info = JOB_TYPES[j]||{};
    const t = byType[j]?.total||0;
    return `<div style="display:inline-flex;align-items:center;gap:6px;padding:5px 10px;
                        border-radius:20px;background:rgba(0,0,0,.05);border:1px solid var(--border);
                        font-size:16px;font-weight:600;color:var(--text);">
              ${info.icon||'💼'} ${info.name||j}
              ${t>0?`<span style="color:var(--green);font-size:15px;">+${t.toLocaleString()}원</span>`:''}
            </div>`;
  }).join('');

  const itemRows = incomeItems.map((it,i)=>{
    const info = JOB_TYPES[it.jobType]||{icon:'💼',name:'기타'};
    const hasPlatform = it.platformKey && it.platformKey !== 'none' && it.platformFeeAmt > 0;
    const platformInfo = hasPlatform ? PLATFORM_FEE[it.platformKey] : null;
    return `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;
                  background:var(--surface2);border:1px solid var(--border);border-radius:10px;margin-bottom:6px;">
        <div style="font-size:26px;flex-shrink:0;">${info.icon}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:17px;font-weight:700;color:var(--text);">${it.label||info.name}</div>
          <div style="font-size:15px;color:var(--text3);">
            ${it.date||''} ${it.detail?'· '+it.detail:''} ${it.note?'· '+it.note:''}
          </div>
          ${hasPlatform?`<div style="font-size:14px;color:var(--red);margin-top:2px;">
            🏪 ${platformInfo?.label||it.platformKey} 수수료 -${it.platformFeeAmt.toLocaleString()}원
            ${it.tax33Override>0?`· 세금 -${it.tax33Override.toLocaleString()}원`:''}
          </div>`:''}
        </div>
        <div style="text-align:right;flex-shrink:0;">
          <div style="font-size:18px;font-weight:700;color:var(--green);">+${parseInt(it.amount).toLocaleString()}원</div>
          ${it.platformNet && it.platformNet !== it.amount ?
            `<div style="font-size:15px;font-weight:700;color:var(--accent);">실수령 ${parseInt(it.platformNet).toLocaleString()}원</div>` : ''}
          ${it.hours?`<div style="font-size:14px;color:var(--text3);">${it.hours}시간</div>`:''}
        </div>
        <button onclick="deleteIncomeItem(${i})"
          style="background:none;border:none;color:var(--text3);font-size:18px;cursor:pointer;">✕</button>
      </div>`;
  }).join('');

  page.innerHTML = `
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px;">
    <div>
      <h2 style="font-size:26px;font-weight:700;">💼 ${curY}년 ${curM+1}월 수입관리</h2>
      <div style="font-size:15px;color:var(--text3);margin-top:2px;">N잡·알바·프리랜서 통합 수입 · 3.3% 자동계산</div>
    </div>
    <div style="display:flex;gap:8px;">
      <button onclick="openNLInput()"
        style="padding:9px 14px;border-radius:8px;border:none;background:var(--accent);
               color:#fff;font-size:17px;font-weight:700;cursor:pointer;font-family:'Noto Sans KR';">
        🗣️ 자연어 입력</button>
      <button onclick="openAddIncomeItem()"
        style="padding:9px 14px;border-radius:8px;border:1px solid var(--border);background:var(--surface2);
               color:var(--text);font-size:17px;font-weight:700;cursor:pointer;font-family:'Noto Sans KR';">
        + 직접 입력</button>
    </div>
  </div>

  ${jobChips?`<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px;">${jobChips}</div>`:''}

  <div style="background:linear-gradient(135deg,rgba(61,214,140,.15),rgba(79,124,255,.08));
              border:1px solid rgba(61,214,140,.3);border-radius:14px;padding:20px 22px;margin-bottom:16px;">
    <div style="font-size:17px;color:var(--text2);margin-bottom:10px;">이번달 통합 수입 요약</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px;">
      <div style="text-align:center;">
        <div style="font-size:15px;color:var(--text3);margin-bottom:4px;">총 수입 (계약금)</div>
        <div style="font-size:22px;font-weight:700;font-family:'JetBrains Mono';color:var(--text);">${totalGross.toLocaleString()}원</div>
      </div>
      <div style="text-align:center;">
        <div style="font-size:15px;color:var(--red);margin-bottom:4px;">수수료+세금</div>
        <div style="font-size:22px;font-weight:700;font-family:'JetBrains Mono';color:var(--red);">-${(totalPlatformFee+tax33).toLocaleString()}원</div>
      </div>
      <div style="text-align:center;">
        <div style="font-size:15px;color:var(--green);margin-bottom:4px;">실수령 (세후)</div>
        <div style="font-size:28px;font-weight:900;font-family:'JetBrains Mono';color:var(--green);">${afterTax.toLocaleString()}원</div>
      </div>
    </div>
    ${totalPlatformFee>0?`<div style="background:rgba(255,92,122,.06);border-radius:8px;padding:7px 14px;
        display:flex;justify-content:space-between;margin-bottom:6px;">
      <span style="font-size:16px;color:var(--text2);">🏪 플랫폼 수수료 합계</span>
      <span style="font-size:16px;font-weight:700;color:var(--red);">-${totalPlatformFee.toLocaleString()}원</span>
    </div>`:''}
    ${totalHours>0?`<div style="background:rgba(0,0,0,.06);border-radius:8px;padding:8px 14px;
                display:flex;justify-content:space-between;">
      <span style="font-size:16px;color:var(--text2);">이번달 총 근무시간</span>
      <span style="font-size:17px;font-weight:700;color:var(--text);">${totalHours.toFixed(1)}시간</span>
    </div>`:''}
  </div>

  ${incomeItems.length===0?`
  <div onclick="openNLInput()"
       style="background:rgba(79,124,255,.06);border:1.5px dashed rgba(79,124,255,.4);
              border-radius:14px;padding:22px;margin-bottom:16px;text-align:center;cursor:pointer;">
    <div style="font-size:34px;margin-bottom:8px;">🗣️</div>
    <div style="font-size:18px;font-weight:700;color:var(--accent);margin-bottom:6px;">자연어로 수입을 기록해보세요</div>
    <div style="font-size:16px;color:var(--text3);line-height:1.8;">
      <b>"오늘 편의점 5시간, 배달 8건 했어"</b><br>
      <b>"대리 7콜 했고 외주 하나 마무리했어"</b>
    </div>
    <div style="margin-top:12px;display:inline-block;padding:8px 20px;border-radius:20px;
                background:var(--accent);color:#fff;font-size:17px;font-weight:700;">탭해서 입력하기</div>
  </div>`:''}

  ${incomeItems.length>0?`
  <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;
              padding:16px 18px;margin-bottom:16px;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
      <div style="font-size:17px;font-weight:700;color:var(--text);">📋 수입 내역 (${incomeItems.length}건)</div>
      <button onclick="showCustomConfirm('모두 삭제할까요?', clearIncomeItems)"
        style="font-size:15px;padding:3px 8px;border-radius:5px;border:1px solid rgba(255,92,122,.3);
               background:none;color:var(--red);cursor:pointer;">전체삭제</button>
    </div>
    ${itemRows}
  </div>`:''}

  <!-- 직종별 시급/단가 설정 -->
  <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;
              padding:16px 18px;margin-bottom:16px;">
    <div style="font-size:17px;font-weight:700;color:var(--text);margin-bottom:12px;">⚙️ 직종별 시급·단가 설정</div>
    ${renderWageSettings(selectedJobs.filter(j=>j!=='employee'), wages)}
  </div>

  ${totalGross>0?`
  <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px 18px;margin-bottom:16px;">
    <div style="font-size:17px;font-weight:700;color:var(--text);margin-bottom:10px;">📋 세금 안내</div>
    <div style="font-size:16px;color:var(--text2);line-height:2;">
      ${totalPlatformFee>0?`<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);">
        <span>🏪 플랫폼 수수료</span><span style="font-weight:700;color:var(--red);">-${totalPlatformFee.toLocaleString()}원</span>
      </div>`:''}
      <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);">
        <span>소득세 (3%)</span><span style="font-weight:700;color:var(--red);">-${Math.round((totalGross-totalPlatformFee)*0.03).toLocaleString()}원</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);">
        <span>지방소득세 (0.3%)</span><span style="font-weight:700;color:var(--red);">-${Math.round((totalGross-totalPlatformFee)*0.003).toLocaleString()}원</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:7px 0;">
        <span style="font-weight:700;">실수령액</span>
        <span style="font-weight:700;font-size:20px;color:var(--green);">${afterTax.toLocaleString()}원</span>
      </div>
    </div>
    <div style="margin-top:10px;padding:9px 12px;background:rgba(255,209,102,.07);
                border:1px solid rgba(255,209,102,.25);border-radius:8px;font-size:15px;
                color:var(--text3);line-height:1.8;">
      ⚠️ 연간 수입 합산 후 <b>매년 5월</b> 종합소득세 신고 필수<br>
      연 수입 2,400만원 이하 → 단순경비율 적용으로 환급 가능성 높음
    </div>
  </div>`:''}`;

  if(typeof budgetState!=='undefined' && budgetState.customIncome===0 && afterTax>0){
    const s=document.createElement('div');
    s.style.cssText='background:rgba(79,124,255,.06);border:1px solid rgba(79,124,255,.2);border-radius:10px;padding:12px 16px;margin-bottom:16px;';
    s.innerHTML=`<div style="font-size:16px;font-weight:700;color:var(--accent);margin-bottom:6px;">💡 가계부 자동연동</div>
      <div style="font-size:16px;color:var(--text2);">실수령액 <b style="color:var(--green);">${afterTax.toLocaleString()}원</b>을 가계부 수입으로 반영할까요?</div>
      <button onclick="applyIncomeTobudget(${afterTax})"
        style="margin-top:8px;padding:7px 14px;border-radius:7px;border:none;background:var(--accent);
               color:#fff;font-size:16px;font-weight:700;cursor:pointer;font-family:'Noto Sans KR';">💳 가계부에 반영</button>`;
    page.appendChild(s);
  }
}

// ── 시급/단가 설정 렌더 ──────────────────
function renderWageSettings(jobs, wages){
  if(!jobs||jobs.length===0) return '<div style="font-size:16px;color:var(--text3);">직종을 먼저 선택해주세요</div>';
  return jobs.map(j=>{
    const info = JOB_TYPES[j]||{};
    const calcType = JOB_CALC_TYPE[j]||'hourly';
    const isPerCase = calcType==='perCase';
    if(j==='etc') return '';
    const currentWage = wages[j]||(isPerCase?5000:10320);
    const label = isPerCase?'건당 단가':'시급';
    const unit = isPerCase?'원/건':'원/시간';
    return `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
        <div style="font-size:23px;flex-shrink:0;">${info.icon||'💼'}</div>
        <div style="flex:1;">
          <div style="font-size:16px;font-weight:600;color:var(--text);margin-bottom:4px;">
            ${info.name||j} ${label}
            <span style="font-size:14px;font-weight:400;color:var(--text3);margin-left:4px;">
              ${isPerCase?'(거리·상황마다 다르면 기록 시 직접 입력)':''}
            </span>
          </div>
          <div style="display:flex;align-items:center;gap:6px;">
            <input type="number" id="wage-${j}" value="${currentWage}" min="0" step="100"
              onchange="saveWageSetting('${j}',this.value)"
              style="width:110px;background:var(--surface2);border:1px solid var(--border);
                     color:var(--text);border-radius:7px;padding:7px 10px;font-size:18px;
                     font-family:'JetBrains Mono';font-weight:700;text-align:right;outline:none;">
            <span style="font-size:16px;color:var(--text3);">${unit}</span>
          </div>
        </div>
      </div>`;
  }).join('');
}

function saveWageSetting(key,val){
  const wageKey='atm2_jobWages';
  let wages={};
  try{const raw=localStorage.getItem(wageKey);if(raw)wages=JSON.parse(raw);}catch(e){}
  wages[key]=parseInt(val)||0;
  if(typeof saveJobWages==='function') saveJobWages(wages); else try{localStorage.setItem(wageKey,JSON.stringify(wages));}catch(e){}
  showToast('✅ 저장됨');
}

// ── 자연어 입력 팝업 ──────────────────────
function openNLInput(){
  let ov=document.getElementById('nl-input-popup');
  if(!ov){
    ov=document.createElement('div');
    ov.id='nl-input-popup';ov.className='overlay';
    ov.onclick=e=>{if(e.target===ov)ov.style.display='none';};
    document.body.appendChild(ov);
  }
  ov.innerHTML=`
    <div class="popup" style="width:380px;padding:24px 22px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
        <h3 style="font-size:21px;margin:0;">🗣️ 자연어로 수입 기록</h3>
        <button onclick="document.getElementById('nl-input-popup').style.display='none'"
          style="background:none;border:none;color:var(--text2);font-size:23px;cursor:pointer;">✕</button>
      </div>
      <div style="background:rgba(79,124,255,.06);border:1px solid rgba(79,124,255,.2);
                  border-radius:10px;padding:12px 14px;margin-bottom:14px;">
        <div style="font-size:15px;font-weight:700;color:var(--accent);margin-bottom:6px;">입력 예시</div>
        <div style="font-size:16px;color:var(--text2);line-height:2;">
          "오늘 편의점 5시간, 배달 8건 했어"<br>
          "대리 7콜 했고 외주 프로젝트 2건"<br>
          "단기알바 4시간"
        </div>
      </div>
      <textarea id="nl-text-inp" placeholder="오늘 한 일을 자유롭게 입력하세요..." rows="3"
        style="width:100%;background:var(--surface2);border:1px solid var(--border);color:var(--text);
               border-radius:10px;padding:12px;font-size:18px;font-family:'Noto Sans KR';
               outline:none;resize:none;line-height:1.6;box-sizing:border-box;"></textarea>
      <div id="nl-preview" style="margin:10px 0;min-height:40px;"></div>
      <button onclick="processNLInput()"
        style="width:100%;padding:12px;border-radius:8px;border:none;background:var(--accent);
               color:#fff;font-size:20px;font-weight:700;cursor:pointer;font-family:'Noto Sans KR';">
        자동 분석 & 저장</button>
    </div>`;
  ov.style.display='flex';
  setTimeout(()=>{
    const inp=document.getElementById('nl-text-inp');
    if(inp){
      inp.focus();
      inp.addEventListener('input',()=>{
        const parsed=parseNaturalInput(inp.value);
        const prev=document.getElementById('nl-preview');
        if(!prev)return;
        if(parsed.length===0){prev.innerHTML='';return;}
        const wageKey='atm2_jobWages';let wages={};
        try{const raw=localStorage.getItem(wageKey);if(raw)wages=JSON.parse(raw);}catch(e){}
        const items=parsed.map(p=>{
          const info=JOB_TYPES[p.typeLabel]||{icon:'💼',name:p.typeLabel};
          const {amount,detail}=calcJobIncome(p,wages);
          return `<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;
                              background:var(--surface2);border-radius:8px;margin-bottom:4px;">
                    <span style="font-size:21px;">${info.icon}</span>
                    <div style="flex:1;font-size:16px;color:var(--text2);">${info.name} · ${detail||'-'}</div>
                    <div style="font-size:17px;font-weight:700;color:var(--green);">
                      ${amount>0?'+'+amount.toLocaleString()+'원':'금액 미상'}
                    </div>
                  </div>`;
        }).join('');
        prev.innerHTML=`<div style="font-size:15px;font-weight:700;color:var(--text3);margin-bottom:6px;">분석 결과</div>${items}`;
      });
    }
  },100);
}

function processNLInput(){
  const inp=document.getElementById('nl-text-inp');
  if(!inp||!inp.value.trim()){showToast('⚠️ 내용을 입력해주세요');return;}
  const text=inp.value.trim();
  const parsed=parseNaturalInput(text);
  if(parsed.length===0){showToast('⚠️ 인식된 수입이 없어요. 직접 입력을 사용해주세요');return;}
  const wageKey='atm2_jobWages';let wages={};
  try{const raw=localStorage.getItem(wageKey);if(raw)wages=JSON.parse(raw);}catch(e){}
  const incKey=`atm2_income_${curY}_${pad2(curM+1)}`;
  let items=[];
  try{const raw=localStorage.getItem(incKey);if(raw)items=JSON.parse(raw);}catch(e){}
  const today=new Date();
  const dateStr=`${pad2(today.getMonth()+1)}/${pad2(today.getDate())}`;
  let cnt=0;
  parsed.forEach(p=>{
    const info=JOB_TYPES[p.typeLabel]||{name:p.typeLabel};
    const {amount,detail}=calcJobIncome(p,wages);
    items.push({id:Date.now()+cnt,label:info.name||p.typeLabel,jobType:p.typeLabel,
      amount,hours:p.hours||null,cases:p.cases||null,detail,date:dateStr,note:'',fromNL:text.substring(0,30)});
    cnt++;
  });
  try{localStorage.setItem(incKey,JSON.stringify(items));}catch(e){}
  document.getElementById('nl-input-popup').style.display='none';
  renderIncomeCalc();
  showToast(`✅ ${cnt}건 기록됨`);
}

// ── 직접 입력 팝업 ────────────────────────
function openAddIncomeItem(){
  let ov=document.getElementById('add-income-popup');
  if(!ov){
    ov=document.createElement('div');ov.id='add-income-popup';ov.className='overlay';
    ov.onclick=e=>{if(e.target===ov)ov.style.display='none';};
    document.body.appendChild(ov);
  }
  const selectedJobs=loadSelectedJobs?loadSelectedJobs():[];
  const jobs=selectedJobs.filter(j=>j!=='employee');
  const today=new Date();
  const defDate=`${today.getFullYear()}-${pad2(today.getMonth()+1)}-${pad2(today.getDate())}`;
  const wageKey='atm2_jobWages';let wages={};
  try{const raw=localStorage.getItem(wageKey);if(raw)wages=JSON.parse(raw);}catch(e){}

  const jobOptions=jobs.map(j=>{
    const info=JOB_TYPES[j]||{};
    return `<option value="${j}">${info.icon||''} ${info.name||j}</option>`;
  }).join('')||'<option value="etc">➕ 기타</option>';

  ov.innerHTML=`
    <div class="popup" style="width:380px;padding:22px 20px;max-height:90vh;overflow-y:auto;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
        <h3 style="font-size:21px;margin:0;">+ 수입 직접 입력</h3>
        <button onclick="document.getElementById('add-income-popup').style.display='none'"
          style="background:none;border:none;color:var(--text2);font-size:23px;cursor:pointer;">✕</button>
      </div>

      <div style="margin-bottom:10px;">
        <div style="font-size:16px;color:var(--text3);margin-bottom:5px;">직종</div>
        <select id="inc-type-sel" onchange="onJobTypeChange(this.value)"
          style="width:100%;background:var(--surface2);border:1px solid var(--border);color:var(--text);
                 border-radius:8px;padding:10px 12px;font-size:18px;font-family:'Noto Sans KR';outline:none;">
          ${jobOptions}
        </select>
      </div>

      <div style="margin-bottom:10px;">
        <div style="font-size:16px;color:var(--text3);margin-bottom:5px;">항목명</div>
        <input id="inc-label-inp" type="text" placeholder="예: 야간 편의점, 배달 저녁타임, 웹개발 외주"
          style="width:100%;background:var(--surface2);border:1px solid var(--border);color:var(--text);
                 border-radius:8px;padding:10px 12px;font-size:18px;font-family:'Noto Sans KR';outline:none;">
      </div>

      <!-- 시간제 입력 -->
      <div id="hourly-form">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
          <div>
            <div style="font-size:16px;color:var(--text3);margin-bottom:5px;">시급 (원)</div>
            <input id="inc-wage-inp" type="number" placeholder="10320" min="0" step="10"
              style="width:100%;background:var(--surface2);border:1px solid var(--border);color:var(--text);
                     border-radius:8px;padding:9px 12px;font-size:18px;font-family:'JetBrains Mono';
                     font-weight:700;outline:none;">
          </div>
          <div>
            <div style="font-size:16px;color:var(--text3);margin-bottom:5px;">근무시간</div>
            <input id="inc-hours-inp" type="number" placeholder="0" min="0" step="0.5"
              style="width:100%;background:var(--surface2);border:1px solid var(--border);color:var(--text);
                     border-radius:8px;padding:9px 12px;font-size:18px;font-family:'JetBrains Mono';
                     font-weight:700;outline:none;">
          </div>
        </div>
        <div id="hourly-preview" style="font-size:16px;color:var(--green);margin-bottom:10px;display:none;"></div>
      </div>

      <!-- 건수제 입력 (배달/대리/프리랜서) -->
      <div id="percase-form" style="display:none;">
        <div style="font-size:16px;color:var(--text3);margin-bottom:8px;">건별 내역 (여러 건 추가 가능)</div>
        <div id="case-items-list"></div>
        <button onclick="addCaseItem()"
          style="width:100%;padding:8px;border:1px dashed var(--border);border-radius:8px;
                 background:none;color:var(--text2);font-size:17px;cursor:pointer;margin-bottom:10px;
                 font-family:'Noto Sans KR';">+ 건 추가</button>
        <div id="percase-total" style="font-size:17px;font-weight:700;color:var(--green);text-align:right;margin-bottom:10px;"></div>
      </div>

      <!-- 플랫폼 수수료 (프리랜서 직종일 때 표시) -->
      <div id="platform-fee-section" style="display:none;margin-bottom:10px;">
        <div style="font-size:16px;color:var(--text3);margin-bottom:5px;">🏪 플랫폼 / 수수료</div>
        <select id="inc-platform-sel" onchange="updatePlatformPreview()"
          style="width:100%;background:var(--surface2);border:1px solid var(--border);color:var(--text);
                 border-radius:8px;padding:10px 12px;font-size:18px;font-family:'Noto Sans KR';outline:none;margin-bottom:8px;">
          ${Object.entries(PLATFORM_FEE).map(([k,v])=>`<option value="${k}">${v.label}${v.fee>0?' (수수료 '+(v.fee*100)+'%)':v.fee===0&&k!=='none'?' (수수료 없음)':''}</option>`).join('')}
        </select>
        <!-- 직접입력 수수료율 -->
        <div id="custom-fee-wrap" style="display:none;margin-bottom:8px;">
          <div style="font-size:16px;color:var(--text3);margin-bottom:5px;">수수료율 (%)</div>
          <input id="inc-custom-fee" type="number" placeholder="예: 15" min="0" max="100" step="0.5"
            oninput="updatePlatformPreview()"
            style="width:100%;background:var(--surface2);border:1px solid var(--border);color:var(--text);
                   border-radius:8px;padding:9px 12px;font-size:18px;font-family:'JetBrains Mono';font-weight:700;outline:none;">
        </div>
        <!-- 3.3% 세금 토글 -->
        <label style="display:flex;align-items:center;gap:8px;font-size:16px;color:var(--text2);cursor:pointer;margin-bottom:8px;">
          <input type="checkbox" id="inc-tax33-chk" checked onchange="updatePlatformPreview()"
            style="width:15px;height:15px;accent-color:var(--accent);">
          3.3% 원천징수 적용
        </label>
        <!-- 실수령 미리보기 -->
        <div id="platform-net-preview" style="display:none;background:rgba(61,214,140,.08);
             border:1px solid rgba(61,214,140,.25);border-radius:10px;padding:12px 14px;">
          <div style="font-size:15px;font-weight:700;color:var(--text3);margin-bottom:8px;">💸 실수령 계산</div>
          <div id="platform-net-rows"></div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
        <div>
          <div style="font-size:16px;color:var(--text3);margin-bottom:5px;">날짜</div>
          <input id="inc-date-inp" type="date" value="${defDate}"
            style="width:100%;background:var(--surface2);border:1px solid var(--border);color:var(--text);
                   border-radius:8px;padding:9px 12px;font-size:17px;outline:none;">
        </div>
        <div>
          <div style="font-size:16px;color:var(--text3);margin-bottom:5px;">메모 (선택)</div>
          <input id="inc-note-inp" type="text" placeholder="메모..."
            style="width:100%;background:var(--surface2);border:1px solid var(--border);color:var(--text);
                   border-radius:8px;padding:9px 12px;font-size:17px;font-family:'Noto Sans KR';outline:none;">
        </div>
      </div>

      <button onclick="saveIncomeItem()"
        style="width:100%;padding:12px;border-radius:8px;border:none;background:var(--green);
               color:#fff;font-size:20px;font-weight:700;cursor:pointer;font-family:'Noto Sans KR';">저장</button>
    </div>`;

  ov.style.display='flex';

  // 초기 직종에 맞게 폼 전환
  setTimeout(()=>{
    const sel=document.getElementById('inc-type-sel');
    if(sel) onJobTypeChange(sel.value);
    // 시급 자동입력
    const wInp=document.getElementById('inc-wage-inp');
    if(wInp && sel){
      const w=wages[sel.value]||10320;
      wInp.value=w;
    }
    // 시급×시간 실시간 계산
    ['inc-wage-inp','inc-hours-inp'].forEach(id=>{
      const el=document.getElementById(id);
      if(el) el.addEventListener('input', updateHourlyPreview);
    });
    // 첫 건수 항목 추가
    addCaseItem();
  },100);
}

let caseItemCount=0;
function addCaseItem(){
  caseItemCount++;
  const list=document.getElementById('case-items-list');
  if(!list)return;
  const idx=caseItemCount;
  const row=document.createElement('div');
  row.id=`case-row-${idx}`;
  row.style.cssText='display:grid;grid-template-columns:1fr 1fr auto;gap:6px;margin-bottom:8px;align-items:center;';
  row.innerHTML=`
    <input type="number" placeholder="건수" min="1" step="1" id="case-count-${idx}"
      oninput="updateCaseTotal()"
      style="background:var(--surface2);border:1px solid var(--border);color:var(--text);
             border-radius:8px;padding:8px 10px;font-size:18px;font-family:'JetBrains Mono';
             font-weight:700;outline:none;">
    <div style="position:relative;">
      <input type="number" placeholder="건당단가" min="0" step="100" id="case-price-${idx}"
        oninput="updateCaseTotal()"
        style="width:100%;background:var(--surface2);border:1px solid var(--border);color:var(--text);
               border-radius:8px;padding:8px 10px;font-size:18px;font-family:'JetBrains Mono';
               font-weight:700;outline:none;">
      <span style="position:absolute;right:8px;top:50%;transform:translateY(-50%);
                   font-size:15px;color:var(--text3);pointer-events:none;">원</span>
    </div>
    <button onclick="removeCaseItem(${idx})"
      style="background:none;border:1px solid rgba(255,92,122,.3);border-radius:6px;
             color:var(--red);width:30px;height:36px;cursor:pointer;font-size:18px;flex-shrink:0;">✕</button>`;
  list.appendChild(row);
}

function removeCaseItem(idx){
  const row=document.getElementById(`case-row-${idx}`);
  if(row)row.remove();
  updateCaseTotal();
}

function updateCaseTotal(){
  let total=0;
  document.querySelectorAll('[id^="case-row-"]').forEach(row=>{
    const idx=row.id.replace('case-row-','');
    const cnt=parseInt(document.getElementById(`case-count-${idx}`)?.value)||0;
    const price=parseInt(document.getElementById(`case-price-${idx}`)?.value)||0;
    total+=cnt*price;
  });
  const el=document.getElementById('percase-total');
  if(el) el.textContent=total>0?`소계: +${total.toLocaleString()}원`:'';
  // 플랫폼 미리보기 연동
  updatePlatformPreview();
}

function updateHourlyPreview(){
  const wage=parseInt(document.getElementById('inc-wage-inp')?.value)||0;
  const hours=parseFloat(document.getElementById('inc-hours-inp')?.value)||0;
  const prev=document.getElementById('hourly-preview');
  if(!prev)return;
  if(wage>0&&hours>0){
    const amt=Math.round(wage*hours);
    prev.style.display='block';
    prev.textContent=`${wage.toLocaleString()}원 × ${hours}시간 = ${amt.toLocaleString()}원`;
  } else prev.style.display='none';
}

function onJobTypeChange(jobKey){
  const calcType=JOB_CALC_TYPE[jobKey]||'hourly';
  const hForm=document.getElementById('hourly-form');
  const pForm=document.getElementById('percase-form');
  const pfSection=document.getElementById('platform-fee-section');
  if(!hForm||!pForm)return;
  if(calcType==='perCase'){
    hForm.style.display='none';
    pForm.style.display='block';
    // 건수제 직종 설명 추가
    const desc=document.getElementById('percase-desc');
    if(!desc){
      const d=document.createElement('div');
      d.id='percase-desc';
      d.style.cssText='font-size:15px;color:var(--text3);margin-bottom:8px;padding:6px 10px;background:rgba(255,209,102,.07);border-radius:6px;';
      d.textContent='거리·상황마다 단가가 다를 수 있어요. 건별로 따로 입력해주세요.';
      pForm.insertBefore(d,pForm.firstChild);
    }
    // 프리랜서일 때만 플랫폼 섹션 표시
    if(pfSection) pfSection.style.display = (jobKey==='freelancer') ? 'block' : 'none';
  } else {
    hForm.style.display='block';
    pForm.style.display='none';
    if(pfSection) pfSection.style.display='none';
    // 저장된 시급 자동세팅
    const wageKey='atm2_jobWages';let wages={};
    try{const raw=localStorage.getItem(wageKey);if(raw)wages=JSON.parse(raw);}catch(e){}
    const wInp=document.getElementById('inc-wage-inp');
    if(wInp) wInp.value=wages[jobKey]||10320;
    updateHourlyPreview();
  }
}

function updatePlatformPreview(){
  const platformKey = document.getElementById('inc-platform-sel')?.value || 'none';
  const customFeeWrap = document.getElementById('custom-fee-wrap');
  if(customFeeWrap) customFeeWrap.style.display = (platformKey==='custom') ? 'block' : 'none';

  // 현재 금액 계산
  let grossAmount = 0;
  document.querySelectorAll('[id^="case-row-"]').forEach(row=>{
    const idx=row.id.replace('case-row-','');
    const cnt=parseInt(document.getElementById(`case-count-${idx}`)?.value)||0;
    const price=parseInt(document.getElementById(`case-price-${idx}`)?.value)||0;
    grossAmount+=cnt*price;
  });

  const preview = document.getElementById('platform-net-preview');
  const rows = document.getElementById('platform-net-rows');
  if(!preview||!rows) return;

  if(grossAmount <= 0){ preview.style.display='none'; return; }

  const customFee = document.getElementById('inc-custom-fee')?.value || 0;
  const tax33 = document.getElementById('inc-tax33-chk')?.checked !== false;
  const {feeRate, feeAmt, afterFee, tax33Amt, net, kmongDetail} = calcPlatformNet(grossAmount, platformKey, customFee, tax33);

  preview.style.display='block';

  // 크몽 상세 내역
  const kmongRows = kmongDetail ? `
    <div style="display:flex;justify-content:space-between;font-size:15px;padding:2px 0;color:var(--text3);">
      <span>　└ 서비스이용료 (구간별 누진)</span>
      <span>-${kmongDetail.serviceAmt.toLocaleString()}원</span>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:15px;padding:2px 0;color:var(--text3);">
      <span>　└ 결제망 이용료 (3.3%)</span>
      <span>-${kmongDetail.pgAmt.toLocaleString()}원</span>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:15px;padding:2px 0 4px;color:var(--text3);border-bottom:1px solid rgba(0,0,0,.06);">
      <span>　└ 부가세 (10%)</span>
      <span>-${kmongDetail.vatAmt.toLocaleString()}원</span>
    </div>` : '';

  rows.innerHTML=`
    <div style="display:flex;justify-content:space-between;font-size:16px;padding:3px 0;border-bottom:1px solid rgba(0,0,0,.06);">
      <span style="color:var(--text2);">계약금액</span>
      <span style="font-weight:700;color:var(--text);">${grossAmount.toLocaleString()}원</span>
    </div>
    ${feeAmt>0?`<div style="display:flex;justify-content:space-between;font-size:16px;padding:3px 0;${!kmongDetail?'border-bottom:1px solid rgba(0,0,0,.06);':''}">
      <span style="color:var(--text2);">플랫폼 수수료 ${kmongDetail?'':'('+((feeRate*100).toFixed(1))+'%)'}</span>
      <span style="font-weight:700;color:var(--red);">-${feeAmt.toLocaleString()}원</span>
    </div>
    ${kmongRows}`:''}
    ${tax33Amt>0?`<div style="display:flex;justify-content:space-between;font-size:16px;padding:3px 0;border-bottom:1px solid rgba(0,0,0,.06);">
      <span style="color:var(--text2);">원천징수 (3.3%)</span>
      <span style="font-weight:700;color:var(--red);">-${tax33Amt.toLocaleString()}원</span>
    </div>`:''}
    <div style="display:flex;justify-content:space-between;font-size:18px;padding:6px 0 2px;">
      <span style="font-weight:700;color:var(--text);">실수령액</span>
      <span style="font-weight:900;color:var(--green);font-family:'JetBrains Mono';">${net.toLocaleString()}원</span>
    </div>`;
}

function saveIncomeItem(){
  const jobType_=document.getElementById('inc-type-sel')?.value||'etc';
  const label=(document.getElementById('inc-label-inp')?.value||'').trim();
  const date=document.getElementById('inc-date-inp')?.value||'';
  const note=(document.getElementById('inc-note-inp')?.value||'').trim();
  const calcType=JOB_CALC_TYPE[jobType_]||'hourly';

  if(!label){showToast('⚠️ 항목명을 입력해주세요');return;}

  let amount=0, detail='', hours=null;

  if(calcType==='hourly'){
    const wage=parseInt(document.getElementById('inc-wage-inp')?.value)||0;
    hours=parseFloat(document.getElementById('inc-hours-inp')?.value)||0;
    if(wage<=0){showToast('⚠️ 시급을 입력해주세요');return;}
    if(hours<=0){showToast('⚠️ 근무시간을 입력해주세요');return;}
    amount=Math.round(wage*hours);
    detail=`${wage.toLocaleString()}원 × ${hours}시간`;
    // 시급 자동저장
    const wageKey='atm2_jobWages';let wages={};
    try{const raw=localStorage.getItem(wageKey);if(raw)wages=JSON.parse(raw);}catch(e){}
    wages[jobType_]=wage;
    if(typeof saveJobWages==='function') saveJobWages(wages); else try{localStorage.setItem(wageKey,JSON.stringify(wages));}catch(e){}
  } else {
    // 건수제: 여러 건 합산
    const rows=document.querySelectorAll('[id^="case-row-"]');
    if(rows.length===0){showToast('⚠️ 건 내역을 추가해주세요');return;}
    let caseItems=[];
    rows.forEach(row=>{
      const idx=row.id.replace('case-row-','');
      const cnt=parseInt(document.getElementById(`case-count-${idx}`)?.value)||0;
      const price=parseInt(document.getElementById(`case-price-${idx}`)?.value)||0;
      if(cnt>0&&price>0) caseItems.push({count:cnt,price});
      amount+=cnt*price;
    });
    if(amount<=0){showToast('⚠️ 건수와 단가를 입력해주세요');return;}
    detail=caseItems.map(it=>`${it.count}건×${it.price.toLocaleString()}원`).join(', ');
  }

  const dateParts=date.split('-');
  const y=parseInt(dateParts[0])||curY;
  const m=parseInt(dateParts[1])-1;
  const incKey=`atm2_income_${y}_${pad2(m+1)}`;
  let items=[];
  try{const raw=localStorage.getItem(incKey);if(raw)items=JSON.parse(raw);}catch(e){}

  // 플랫폼 수수료 계산 (프리랜서일 때)
  let platformKey=null, platformFeeAmt=0, platformNet=amount, tax33Override=null;
  if(jobType_==='freelancer'){
    platformKey = document.getElementById('inc-platform-sel')?.value || 'none';
    const customFee = document.getElementById('inc-custom-fee')?.value || 0;
    const tax33chk = document.getElementById('inc-tax33-chk')?.checked !== false;
    const calc = calcPlatformNet(amount, platformKey, customFee, tax33chk);
    platformFeeAmt = calc.feeAmt;
    platformNet = calc.net;
    tax33Override = tax33chk ? calc.tax33Amt : 0;
  }

  items.push({id:Date.now(),jobType:jobType_,label,amount,hours,detail,
    date:`${dateParts[1]}/${dateParts[2]}`,note,
    platformKey, platformFeeAmt, platformNet,
    tax33Override: jobType_==='freelancer' ? tax33Override : null});
  try{localStorage.setItem(incKey,JSON.stringify(items));}catch(e){}

  document.getElementById('add-income-popup').style.display='none';
  caseItemCount=0;
  renderIncomeCalc();
  showToast(`✅ ${label} +${amount.toLocaleString()}원 추가됨`);
}

function deleteIncomeItem(idx){
  const incKey=`atm2_income_${curY}_${pad2(curM+1)}`;
  let items=[];
  try{const raw=localStorage.getItem(incKey);if(raw)items=JSON.parse(raw);}catch(e){}
  items.splice(idx,1);
  try{localStorage.setItem(incKey,JSON.stringify(items));}catch(e){}
  renderIncomeCalc();
}

function clearIncomeItems(){
  const incKey=`atm2_income_${curY}_${pad2(curM+1)}`;
  try{localStorage.removeItem(incKey);}catch(e){}
  renderIncomeCalc();
}

function applyIncomeTobudget(amount){
  if(typeof budgetState!=='undefined'){
    budgetState.customIncome=amount;
    if(typeof budgetSave==='function') budgetSave();
    showToast(`✅ 가계부 수입 ${amount.toLocaleString()}원으로 설정됨`);
    renderIncomeCalc();
  }
}
// ══════════════════════════════════════════
