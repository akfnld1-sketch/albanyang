/**
 * persona-engine.js — 가상 사용자 페르소나 생성
 * 원형(archetype) 쿼터 배분 + MVP 타깃 반영 샘플링 + 속성 상관 구조
 * 단순 랜덤 복제가 아닌, MVP 특성을 우선 반영한 서로 다른 페르소나를 만든다.
 */
(function (global) {
  'use strict';
  const MVPV = global.MVPV = global.MVPV || {};

  // ── 원형 정의: 속성 샘플링 구간이 원형마다 다름 ──
  // 값 구간은 [min, max] (0~1)
  const ARCHETYPES = {
    early_adopter: {
      label: '얼리어답터', emoji: '🚀',
      desc: '새 서비스를 먼저 써보는 것을 즐기는 사용자',
      digitalLiteracy: [0.75, 1.0], changeResistance: [0.0, 0.25],
      priceSensitivity: [0.2, 0.55], solutionSatisfaction: [0.2, 0.5],
      problemFreq: [0.5, 0.9], problemSeverity: [0.5, 0.9],
    },
    pragmatist: {
      label: '실용적 중립', emoji: '🧐',
      desc: '확실한 효용이 보여야 움직이는 사용자',
      digitalLiteracy: [0.5, 0.85], changeResistance: [0.35, 0.6],
      priceSensitivity: [0.4, 0.7], solutionSatisfaction: [0.4, 0.7],
      problemFreq: [0.4, 0.8], problemSeverity: [0.4, 0.75],
    },
    skeptic: {
      label: '회의적 사용자', emoji: '🤨',
      desc: '새 서비스의 효용 자체를 의심하는 사용자',
      digitalLiteracy: [0.4, 0.8], changeResistance: [0.65, 0.95],
      priceSensitivity: [0.5, 0.85], solutionSatisfaction: [0.55, 0.9],
      problemFreq: [0.3, 0.7], problemSeverity: [0.25, 0.6],
    },
    price_sensitive: {
      label: '가격 민감형', emoji: '💸',
      desc: '무료가 아니면 쓰지 않으려는 사용자',
      digitalLiteracy: [0.45, 0.85], changeResistance: [0.3, 0.6],
      priceSensitivity: [0.75, 1.0], solutionSatisfaction: [0.35, 0.65],
      problemFreq: [0.45, 0.85], problemSeverity: [0.4, 0.8],
    },
    low_digital: {
      label: '디지털 저숙련', emoji: '🐢',
      desc: '앱·서비스 사용 자체가 어려운 사용자',
      digitalLiteracy: [0.05, 0.35], changeResistance: [0.55, 0.9],
      priceSensitivity: [0.5, 0.85], solutionSatisfaction: [0.4, 0.75],
      problemFreq: [0.4, 0.8], problemSeverity: [0.45, 0.85],
    },
    loyal_rival: {
      label: '경쟁서비스 충성', emoji: '🏰',
      desc: '이미 다른 해결책에 만족하고 있는 사용자',
      digitalLiteracy: [0.55, 0.9], changeResistance: [0.6, 0.9],
      priceSensitivity: [0.4, 0.7], solutionSatisfaction: [0.75, 1.0],
      problemFreq: [0.5, 0.85], problemSeverity: [0.45, 0.8],
    },
    off_target: {
      label: '비타깃', emoji: '🚶',
      desc: '타깃 조건에서 벗어난 사용자 (경계 검증용)',
      digitalLiteracy: [0.3, 0.8], changeResistance: [0.4, 0.8],
      priceSensitivity: [0.4, 0.8], solutionSatisfaction: [0.5, 0.85],
      problemFreq: [0.05, 0.35], problemSeverity: [0.05, 0.35],
    },
  };

  // 인원수별 원형 배분 (전원 긍정 방지의 핵심)
  const QUOTAS = {
    1:   [['pragmatist', 1]],
    3:   [['early_adopter', 1], ['pragmatist', 1], ['skeptic', 1]],
    5:   [['early_adopter', 1], ['pragmatist', 1], ['price_sensitive', 1], ['skeptic', 1], ['low_digital', 1]],
    10:  [['early_adopter', 2], ['pragmatist', 3], ['price_sensitive', 2], ['skeptic', 1], ['low_digital', 1], ['off_target', 1]],
    100: [['early_adopter', 18], ['pragmatist', 30], ['price_sensitive', 16], ['skeptic', 13], ['low_digital', 8], ['loyal_rival', 5], ['off_target', 10]],
  };

  // ── 이름/직업/생활환경 풀 ──
  const SURNAMES = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황', '안', '송', '전', '홍'];
  const GIVEN = ['민준', '서연', '지우', '하은', '도윤', '수아', '예준', '지민', '현우', '서준',
    '유진', '지훈', '수빈', '재현', '은지', '태윤', '가은', '준호', '소율', '동현',
    '미경', '영수', '순자', '광호', '정숙', '병철', '옥순', '상철', '혜정', '용식'];

  const OCC_POOL = {
    student:    ['대학생', '대학원생', '취업준비생', '고등학생'],
    office:     ['중소기업 사무직', 'IT기업 직장인', '마케팅 담당자', '영업직 회사원', '공기업 직원', '금융권 직장인'],
    parttime:   ['카페 아르바이트생', '편의점 알바생', '식당 서빙 알바', '물류센터 단기 알바'],
    freelancer: ['프리랜서 디자이너', '유튜브 크리에이터', 'N잡 직장인', '배달 라이더', '프리랜서 번역가'],
    homemaker:  ['육아 중인 전업주부', '워킹맘', '초등학생 학부모', '육아휴직 중인 직장인'],
    founder:    ['카페 사장', '온라인 쇼핑몰 운영자', '스타트업 대표', '동네 식당 자영업자'],
    developer:  ['백엔드 개발자', 'UX 디자이너', '서비스 기획자', '스타트업 PM'],
    senior_job: ['은퇴한 전직 교사', '퇴직 후 재취업 준비자'],
    medical:    ['만성질환 관리 중인 환자', '부모님을 간병하는 보호자'],
    teacher:    ['학원 강사', '초등학교 교사', '온라인 클래스 강사'],
    generic:    ['공무원', '간호사', '군인', '버스 기사', '미용사', '헬스 트레이너', '사진작가', '농업인'],
  };

  const LIFESTYLES = ['1인 가구, 수도권 원룸 거주', '부모님과 함께 거주', '맞벌이 부부, 자녀 1명',
    '지방 중소도시 거주', '서울 출퇴근 왕복 2시간', '재택근무 중심 생활', '주말에도 일하는 생활',
    '자취 5년차, 불규칙한 생활 패턴', '아이 둘 육아로 개인 시간 부족', '반려동물과 함께 사는 1인 가구'];

  const INCOME_LEVELS = [
    { key: 'low', label: '월 100만 원 이하', v: 0.15 },
    { key: 'lowmid', label: '월 100~250만 원', v: 0.35 },
    { key: 'mid', label: '월 250~400만 원', v: 0.55 },
    { key: 'midhigh', label: '월 400~600만 원', v: 0.75 },
    { key: 'high', label: '월 600만 원 이상', v: 0.9 },
  ];

  const DECISION_STYLES = [
    { key: 'impulsive', label: '일단 써보고 판단' },
    { key: 'research', label: '후기·비교 꼼꼼히 조사 후 결정' },
    { key: 'referral', label: '지인 추천이 있어야 움직임' },
    { key: 'cautious', label: '무료 체험 없으면 시작 안 함' },
  ];

  const CORE_VALUES = [
    { key: 'time', label: '시간 절약' }, { key: 'money', label: '비용 절감' },
    { key: 'simple', label: '간편함' }, { key: 'trust', label: '신뢰성·정확성' },
    { key: 'design', label: '보기 좋은 디자인' }, { key: 'privacy', label: '개인정보 보호' },
  ];

  const CURRENT_SOLUTIONS = ['엑셀/스프레드시트로 직접 관리', '수첩·메모장에 기록', '그냥 참고 지냄(해결 안 함)',
    '네이버/구글 검색으로 그때그때 해결', '지인에게 물어봄', '유사한 무료 앱 사용 중',
    '카카오톡 나에게 보내기로 메모', '유료 서비스 구독 중'];

  const QUIT_REASONS = ['며칠 쓰다 잊어버림', '입력이 귀찮아지면 바로 삭제', '광고가 많으면 즉시 이탈',
    '무료 기간 끝나면 해지', '더 좋은 대안이 나오면 갈아탐', '효과가 2주 안에 안 보이면 포기',
    '오류를 한 번이라도 겪으면 신뢰를 잃음', '앱이 무겁거나 느리면 삭제'];

  const AGE_LITERACY = [ // 연령대별 디지털 숙련도 보정(약한 상관)
    { max: 29, adj: +0.1 }, { max: 39, adj: +0.05 }, { max: 49, adj: 0 },
    { max: 59, adj: -0.1 }, { max: 99, adj: -0.2 },
  ];

  function rangeSample(rng, pair) { return rng.range(pair[0], pair[1]); }

  /** 타깃 토큰 기반으로 연령 샘플링 */
  function sampleAge(rng, profile, isOffTarget) {
    const dict = MVPV.AGE_TOKENS;
    const targeted = dict.filter(e => profile.targetAges.includes(e.key));
    if (targeted.length > 0 && !isOffTarget) {
      const e = rng.pick(targeted);
      return rng.int(e.range[0], e.range[1]);
    }
    if (targeted.length > 0 && isOffTarget) {
      // 의도적으로 타깃 밖 연령
      const others = dict.filter(e => !profile.targetAges.includes(e.key));
      const e = rng.pick(others.length ? others : dict);
      return rng.int(e.range[0], e.range[1]);
    }
    // 타깃 연령 미지정 → 20~59 중심 분포
    return Math.round(MVPV.clamp(rng.gauss(36, 16), 15, 72));
  }

  /** 타깃 토큰 기반으로 직업 샘플링 */
  function sampleOccupation(rng, profile, age, isOffTarget) {
    const keys = profile.targetOccupations;
    if (keys.length > 0 && !isOffTarget && rng.next() < 0.8) {
      const key = rng.pick(keys);
      if (OCC_POOL[key]) return rng.pick(OCC_POOL[key]);
    }
    // 연령 정합성 있는 일반 풀
    if (age <= 24) return rng.pick(OCC_POOL.student.concat(OCC_POOL.parttime));
    if (age >= 60) return rng.pick(OCC_POOL.senior_job.concat(['소일거리 중인 은퇴자']));
    const pool = OCC_POOL.office.concat(OCC_POOL.freelancer, OCC_POOL.generic, OCC_POOL.founder);
    return rng.pick(pool);
  }

  /** targetFit 계산: 페르소나가 MVP 타깃 정의에 얼마나 부합하는가 */
  function computeTargetFit(rng, profile, archetypeKey, age, isOffTarget) {
    if (isOffTarget) return rng.range(0.05, 0.3);
    let fit = 0.55; // 기본값 (타깃 정보 없을 때 중간)
    const hasAgeTarget = profile.targetAges.length > 0;
    const hasOccTarget = profile.targetOccupations.length > 0;
    if (hasAgeTarget) {
      const inRange = MVPV.AGE_TOKENS.some(e =>
        profile.targetAges.includes(e.key) && age >= e.range[0] && age <= e.range[1]);
      fit += inRange ? 0.25 : -0.2;
    }
    if (hasOccTarget) fit += 0.15; // 직업은 샘플링 단계에서 이미 편향됨
    if (!hasAgeTarget && !hasOccTarget) fit = rng.range(0.4, 0.7); // 타깃 미정의 → 불확실
    return MVPV.clamp01(fit + rng.range(-0.08, 0.08));
  }

  /**
   * 페르소나 1명 생성
   * @param {Rng} rng
   * @param {object} profile MvpProfile
   * @param {string} archetypeKey
   * @param {number} idx
   * @param {boolean} detailed 상세 페르소나 여부 (1~10명 모드)
   */
  function createPersona(rng, profile, archetypeKey, idx, detailed) {
    const arc = ARCHETYPES[archetypeKey];
    const isOffTarget = archetypeKey === 'off_target';
    const age = sampleAge(rng, profile, isOffTarget);
    const occupation = sampleOccupation(rng, profile, age, isOffTarget);
    const genderRoll = rng.next();
    const gender = genderRoll < 0.44 ? '여성' : genderRoll < 0.88 ? '남성' : '비공개';

    // 원형 구간 샘플링 + 연령 상관 보정
    let digitalLiteracy = rangeSample(rng, arc.digitalLiteracy);
    const ageAdj = AGE_LITERACY.find(a => age <= a.max);
    digitalLiteracy = MVPV.clamp01(digitalLiteracy + (ageAdj ? ageAdj.adj : 0));

    let solutionSatisfaction = profile.hasCompetitors && archetypeKey === 'loyal_rival'
      ? rng.range(0.8, 1.0)
      : rangeSample(rng, arc.solutionSatisfaction);
    // 경쟁 서비스가 없는 시장 = 현재 해결 방법이 임시방편일 가능성 → 만족도 하향
    if (!profile.hasCompetitors) solutionSatisfaction *= 0.82;

    const income = rng.weighted(INCOME_LEVELS.map(l => ({ value: l, w: l.key === 'mid' || l.key === 'lowmid' ? 2 : 1 })));
    // 소득↔가격민감 약한 역상관
    let priceSensitivity = rangeSample(rng, arc.priceSensitivity);
    priceSensitivity = MVPV.clamp01(priceSensitivity + (0.5 - income.v) * 0.25);

    const persona = {
      id: 'p' + (idx + 1),
      archetype: archetypeKey,
      archetypeLabel: arc.label,
      archetypeEmoji: arc.emoji,
      name: rng.pick(SURNAMES) + rng.pick(GIVEN),
      age, gender, occupation,
      lifestyle: rng.pick(LIFESTYLES),
      incomeLevel: income.label,
      incomeV: income.v,
      digitalLiteracy,
      problemFreq: rangeSample(rng, arc.problemFreq),
      problemSeverity: rangeSample(rng, arc.problemSeverity),
      currentSolution: profile.hasCompetitors && rng.next() < 0.45
        ? profile.competitors.split(/[,、\n]/)[0].trim() + ' 사용 중'
        : rng.pick(CURRENT_SOLUTIONS),
      solutionSatisfaction,
      changeResistance: rangeSample(rng, arc.changeResistance),
      priceSensitivity,
      decisionStyle: rng.pick(DECISION_STYLES),
      coreValue: rng.pick(CORE_VALUES),
      quitReason: rng.pick(QUIT_REASONS),
      targetFit: computeTargetFit(rng, profile, archetypeKey, age, isOffTarget),
      detailed: !!detailed,
    };

    if (detailed) {
      persona.purpose = persona.problemSeverity > 0.6
        ? '지금 겪는 문제를 확실히 해결하고 싶어서'
        : persona.problemFreq > 0.5
          ? '반복되는 불편을 조금이라도 줄이고 싶어서'
          : '호기심에 한번 둘러보는 정도';
      persona.expectedFeature = profile.features.length > 0
        ? rng.pick(profile.features)
        : '핵심 문제를 바로 해결해 주는 기능';
    }
    return persona;
  }

  /**
   * 페르소나 세트 생성
   * @param {object} input MvpInput
   * @param {object} profile MvpProfile
   * @param {number} count 1|3|5|10|100
   * @param {number} seedOffset "다시 섞기" 오프셋
   */
  function generatePersonas(input, profile, count, seedOffset) {
    const seedStr = JSON.stringify(input) + '|n=' + count + '|s=' + (seedOffset || 0);
    const rng = new MVPV.Rng(seedStr);
    const quota = QUOTAS[count] || QUOTAS[5];
    const detailed = count <= 10;
    const personas = [];
    let idx = 0;
    for (const [key, n] of quota) {
      for (let i = 0; i < n; i++) {
        personas.push(createPersona(rng, profile, key, idx++, detailed));
      }
    }
    return { personas, rngSeed: rng.seed };
  }

  MVPV.ARCHETYPES = ARCHETYPES;
  MVPV.QUOTAS = QUOTAS;
  MVPV.generatePersonas = generatePersonas;
})(window);
