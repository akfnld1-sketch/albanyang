/**
 * mvp-parser.js — MVP 입력을 특성 벡터(MvpProfile)로 변환
 * 페르소나 생성·평가 엔진이 사용하는 가격 티어, 복잡도, 타깃 토큰, 문제 강도 등을 추출
 */
(function (global) {
  'use strict';
  const MVPV = global.MVPV = global.MVPV || {};

  // ── 타깃 텍스트 키워드 사전 ──
  const AGE_TOKENS = [
    { key: 'teen',   words: ['10대', '청소년', '중학생', '고등학생', '중고생'], range: [14, 19] },
    { key: '20s',    words: ['20대', '대학생', '취준생', '사회초년생', 'MZ'], range: [20, 29] },
    { key: '30s',    words: ['30대', '직장인', '신혼'], range: [30, 39] },
    { key: '40s',    words: ['40대', '중년', '학부모'], range: [40, 49] },
    { key: '50s',    words: ['50대', '장년'], range: [50, 59] },
    { key: 'senior', words: ['60대', '70대', '시니어', '노인', '어르신', '고령'], range: [60, 75] },
  ];

  const OCCUPATION_TOKENS = [
    { key: 'student',    words: ['학생', '대학생', '대학원생', '취준생', '수험생'] },
    { key: 'office',     words: ['직장인', '회사원', '사무직', '오피스'] },
    { key: 'parttime',   words: ['알바', '아르바이트', '파트타임', '시간제'] },
    { key: 'freelancer', words: ['프리랜서', 'n잡', 'N잡', '부업', '크리에이터', '유튜버'] },
    { key: 'homemaker',  words: ['주부', '육아', '엄마', '아빠', '부모'] },
    { key: 'founder',    words: ['창업자', '사장', '자영업', '소상공인', '스타트업', '대표'] },
    { key: 'developer',  words: ['개발자', '디자이너', '기획자', 'IT', '엔지니어', 'PM'] },
    { key: 'senior_job', words: ['은퇴', '퇴직'] },
    { key: 'medical',    words: ['환자', '간병', '보호자'] },
    { key: 'teacher',    words: ['교사', '강사', '선생님', '교육자'] },
  ];

  const CONTEXT_TOKENS = [
    { key: 'money',   words: ['돈', '재테크', '저축', '가계부', '월급', '금융', '투자', '절약'] },
    { key: 'health',  words: ['건강', '운동', '다이어트', '식단', '수면', '헬스'] },
    { key: 'work',    words: ['업무', '일정', '생산성', '협업', '문서', '자동화'] },
    { key: 'life',    words: ['생활', '일상', '취미', '여행', '요리', '반려'] },
    { key: 'learn',   words: ['공부', '학습', '교육', '자격증', '어학', '스터디'] },
    { key: 'social',  words: ['커뮤니티', '소통', '모임', '친구', '매칭', 'SNS'] },
    { key: 'commerce',words: ['쇼핑', '판매', '거래', '중고', '예약', '주문'] },
  ];

  // 문제 서술의 심각도 신호 키워드
  const SEVERITY_WORDS = ['매일', '항상', '반복', '스트레스', '불편', '힘들', '어렵', '귀찮',
    '낭비', '손해', '실수', '놓치', '못 하', '못하', '몰라', '복잡', '비싸', '오래 걸',
    '시간이 없', '불안', '걱정', '포기'];
  const FREQUENCY_WORDS = ['매일', '매주', '매달', '항상', '자주', '수시로', '반복', '주기적', '매번', '때마다'];

  // 개발 단계별 기대 보정
  const STAGE_INFO = {
    idea:      { label: '아이디어',  maturity: 0.30 },
    prototype: { label: '프로토타입', maturity: 0.50 },
    mvp:       { label: 'MVP',      maturity: 0.70 },
    beta:      { label: '베타',      maturity: 0.85 },
    prelaunch: { label: '출시 전',   maturity: 0.95 },
  };

  function countMatches(text, words) {
    let n = 0;
    for (const w of words) if (text.indexOf(w) !== -1) n++;
    return n;
  }

  function findTokens(text, dict) {
    const found = [];
    for (const entry of dict) {
      if (entry.words.some(w => text.indexOf(w) !== -1)) found.push(entry.key);
    }
    return found;
  }

  /** 가격 문자열 → { tier: 0무료/1저가/2중가/3고가/4불명, label, monthly } */
  function parsePrice(raw) {
    const text = (raw || '').trim();
    if (!text) return { tier: 4, label: '미입력', monthly: null };
    // "0원"은 단독일 때만 무료로 판정 ("39,000원"의 부분 문자열 오매칭 방지)
    if (/무료|free|공짜|(?:^|[^\d,.])0\s*원/i.test(text) && !/유료|프리미엄/.test(text)) {
      return { tier: 0, label: '무료', monthly: 0 };
    }
    // 숫자 추출 (만원 단위 처리)
    let amount = null;
    const manMatch = text.match(/([\d,.]+)\s*만\s*원/);
    const wonMatch = text.match(/([\d,]{2,})\s*원/);
    const dollarMatch = text.match(/\$\s*([\d,.]+)|([\d,.]+)\s*(달러|불|USD)/i);
    if (manMatch) amount = parseFloat(manMatch[1].replace(/,/g, '')) * 10000;
    else if (wonMatch) amount = parseInt(wonMatch[1].replace(/,/g, ''), 10);
    else if (dollarMatch) amount = parseFloat((dollarMatch[1] || dollarMatch[2]).replace(/,/g, '')) * 1400;

    if (amount === null) {
      // 숫자를 못 찾았지만 유료 언급이 있으면 중가로 추정
      if (/유료|구독|결제|프리미엄/.test(text)) return { tier: 2, label: text, monthly: null };
      return { tier: 4, label: text, monthly: null };
    }
    // 연 단위면 월 환산
    const isYearly = /년|연간|연\s*[\d]|annual|yearly/i.test(text);
    const monthly = isYearly ? amount / 12 : amount;
    let tier;
    if (monthly <= 0) tier = 0;
    else if (monthly < 5000) tier = 1;      // 저가: 월 5천 원 미만
    else if (monthly < 30000) tier = 2;     // 중가: 월 3만 원 미만
    else tier = 3;                          // 고가
    return { tier, label: text, monthly: Math.round(monthly) };
  }

  /** 핵심 기능 텍스트 → 기능 목록 배열 */
  function splitFeatures(raw) {
    if (!raw) return [];
    return raw.split(/[\n,、·;／/]|(?:\d+[.)])/)
      .map(s => s.trim().replace(/^[-*•]\s*/, ''))
      .filter(s => s.length >= 2)
      .slice(0, 12);
  }

  /**
   * MVP 입력 전체 → MvpProfile
   * @param {object} input MvpInput
   */
  function parseMvp(input) {
    const problem = (input.problem || '') + ' ' + (input.tagline || '');
    const targetText = (input.targetUsers || '') + ' ' + problem;
    const features = splitFeatures(input.coreFeatures);
    const flowLen = (input.userFlow || '').length;

    // 복잡도: 기능 수 + 사용 흐름 길이 기반 0~1
    const complexity = MVPV.clamp01(
      0.15 + features.length * 0.07 + Math.min(flowLen / 600, 0.3)
    );

    // 문제 강도: 서술 구체성(길이) + 심각도/빈도 키워드
    const sevHits = countMatches(problem, SEVERITY_WORDS);
    const freqHits = countMatches(problem, FREQUENCY_WORDS);
    const problemStrength = MVPV.clamp01(
      Math.min((input.problem || '').length / 150, 0.4) + sevHits * 0.08 + freqHits * 0.06
    );

    // 입력 완성도 → 검증 신뢰도의 기반
    const fields = ['name', 'tagline', 'problem', 'targetUsers', 'coreFeatures',
      'userFlow', 'price', 'competitors', 'stage', 'keyQuestion'];
    const weights = { problem: 2, targetUsers: 2, coreFeatures: 2, price: 1.5 };
    let got = 0, total = 0;
    for (const f of fields) {
      const w = weights[f] || 1;
      total += w;
      if ((input[f] || '').trim().length > 0) got += w;
    }
    const completeness = total > 0 ? got / total : 0;

    const stage = STAGE_INFO[input.stage] ? input.stage : null;

    return {
      price: parsePrice(input.price),
      complexity,
      features,
      targetAges: findTokens(targetText, AGE_TOKENS),
      targetOccupations: findTokens(targetText, OCCUPATION_TOKENS),
      contexts: findTokens(targetText + ' ' + (input.coreFeatures || ''), CONTEXT_TOKENS),
      problemStrength,
      hasCompetitors: (input.competitors || '').trim().length > 0,
      competitors: (input.competitors || '').trim(),
      stage,
      stageInfo: stage ? STAGE_INFO[stage] : { label: '미입력', maturity: 0.6 },
      completeness,
      missingFields: fields.filter(f => !(input[f] || '').trim()),
    };
  }

  MVPV.AGE_TOKENS = AGE_TOKENS;
  MVPV.OCCUPATION_TOKENS = OCCUPATION_TOKENS;
  MVPV.STAGE_INFO = STAGE_INFO;
  MVPV.parseMvp = parseMvp;
  MVPV.parsePrice = parsePrice;
  MVPV.splitFeatures = splitFeatures;
})(window);
