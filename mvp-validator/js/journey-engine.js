/**
 * journey-engine.js — 2단계: 사용자 시나리오 분석 (화면 구조 기반 사용 시뮬레이션)
 * 각 페르소나가 서비스를 처음 방문했다고 가정하고 8단계 여정을 규칙 기반으로 추정한다.
 *
 * ⚠️ 정직성 원칙: 이 엔진은 실제 브라우저 자동 조작을 수행하지 않는다.
 * 모든 판정은 "정적 구조 지표 × 페르소나 특성"의 명시적 함수로 계산된 '추정'이며,
 * 문구도 단정형("클릭했다")이 아닌 추정형("~할 가능성")으로만 생성한다.
 */
(function (global) {
  'use strict';
  const MVPV = global.MVPV = global.MVPV || {};
  const clamp01 = MVPV.clamp01;

  const STEPS = [
    { key: 'enter', label: '첫 화면 진입' },
    { key: 'understand', label: '서비스 목적 이해' },
    { key: 'explore', label: '원하는 기능 탐색' },
    { key: 'tryCore', label: '핵심 기능 사용 시도' },
    { key: 'input', label: '입력 과정' },
    { key: 'outcome', label: '결과 확인' },
    { key: 'revisit', label: '재사용 판단' },
    { key: 'convert', label: '가입·결제 판단' },
  ];

  const TIER_WEIGHT = [0.05, 0.35, 0.6, 0.85, 0.5];

  /**
   * 페르소나 1명의 여정 시뮬레이션
   * @param {object} persona
   * @param {object} structure SiteStructure (없으면 null → 입력 정보만으로 축약 추정)
   * @param {object} profile MvpProfile
   * @param {Rng} rng
   * @returns {steps, dropPoint, frictions, jScores}
   */
  function simulateJourney(persona, structure, profile, rng) {
    const S = structure;
    const steps = [];
    const frictions = []; // {key, text} — 근거 집계 파이프라인에 합류
    let dropPoint = null;
    const patience = 1 - persona.changeResistance;      // 인내심
    const lit = persona.digitalLiteracy;

    const push = (key, label, result, reason) => {
      steps.push({ key, label, result, reason });
      if (result === 'drop' && !dropPoint) dropPoint = key;
    };
    const friction = (key, text) => frictions.push({ key, text });

    // 구조 지표 (미확보 시 입력 기반 근사)
    const purpose = S ? S.purposeClarity : clamp01(0.3 + profile.problemStrength * 0.4 + (profile.completeness > 0.5 ? 0.1 : 0));
    const ctaCount = S ? S.ctas.length : (profile.features.length ? 3 : 1);
    const menuCount = S ? S.menus.length : 3;
    const fieldCount = S ? S.totalFields : Math.round(profile.complexity * 8);
    const hasSignup = S ? S.auth.hasSignup : true;
    const spaShell = S ? S.spaShell : false;
    const priceTier = (S && S.priceInfo.found) ? S.priceInfo.tier : profile.price.tier;

    // CTA 명확성: 0개=길이 없음 / 1~4 최적 / 과다=혼란
    const ctaClarity = ctaCount === 0 ? 0.3 : ctaCount <= 4 ? 1.0 : ctaCount <= 8 ? 0.75 : 0.5;
    const menuFactor = menuCount === 0 ? 0.65 : menuCount <= 7 ? 1.0 : 0.75;

    // ── 1) 첫 화면 진입 ──
    if (spaShell) {
      push('enter', '첫 화면 진입', 'friction', '정적 HTML에 내용이 거의 없어 첫 로딩 화면이 비어 보일 가능성이 있습니다');
      friction('spa_shell', '첫 화면이 늦게 그려지거나 비어 보일 가능성');
    } else {
      push('enter', '첫 화면 진입', 'pass', '첫 화면 진입에 구조적 장애는 보이지 않습니다');
    }

    // ── 2) 서비스 목적 이해 ──
    const understand = clamp01(purpose * 0.7 + lit * 0.12 + persona.targetFit * 0.18);
    if (understand < 0.35 && patience < 0.45) {
      push('understand', '서비스 목적 이해', 'drop',
        '제목·소개 문구만으로 목적을 파악하기 어려워 이 사용자는 이 단계에서 떠날 가능성이 높습니다');
      friction('unclear_purpose', '첫 화면에서 서비스 목적이 명확히 전달되지 않을 가능성');
    } else if (understand < 0.55) {
      push('understand', '서비스 목적 이해', 'friction', '목적을 이해하는 데 시간이 걸릴 것으로 추정됩니다 (이해도 ' + Math.round(understand * 100) + '점)');
      friction('unclear_purpose', '첫 화면에서 서비스 목적이 명확히 전달되지 않을 가능성');
    } else {
      push('understand', '서비스 목적 이해', 'pass', '제목·소개·헤딩 구조상 목적 전달이 비교적 명확합니다 (이해도 ' + Math.round(understand * 100) + '점)');
    }

    // ── 3) 원하는 기능 탐색 ──
    let findability = 0, tried = 0, inputOk = 0, outcomeOk = 0;
    if (!dropPoint) {
      findability = clamp01((0.45 * ctaClarity + 0.25 * menuFactor + 0.3 * lit) * (0.7 + 0.3 * understand));
      if (ctaCount === 0) {
        push('explore', '원하는 기능 탐색', 'drop', '눌러볼 버튼·CTA가 발견되지 않아 다음 행동으로 이어지기 어렵습니다');
        friction('cta_missing', '행동을 유도하는 버튼·CTA 부재');
      } else if (findability < 0.45) {
        push('explore', '원하는 기능 탐색', patience < 0.4 ? 'drop' : 'friction',
          ctaCount > 8
            ? '버튼·CTA가 ' + ctaCount + '개로 많아 어디를 눌러야 할지 헤맬 가능성이 높습니다'
            : '이 사용자의 디지털 숙련도 기준으로 원하는 기능을 찾는 데 어려움이 예상됩니다');
        friction(ctaCount > 8 ? 'cta_overload' : 'low_findability',
          ctaCount > 8 ? 'CTA 과다(' + ctaCount + '개)로 인한 선택 혼란' : '기능 발견 경로가 불명확할 가능성');
      } else {
        push('explore', '원하는 기능 탐색', 'pass', '메뉴 ' + menuCount + '개·CTA ' + ctaCount + '개 구성으로 기능 발견 가능성이 양호합니다');
      }
    }

    // ── 4) 핵심 기능 사용 시도 ──
    if (!dropPoint) {
      const techGap = Math.max(0, (S ? S.interactionComplexity : profile.complexity) - lit);
      tried = clamp01(findability * (1 - techGap * 0.9));
      if (techGap > 0.3) {
        push('tryCore', '핵심 기능 사용 시도', patience < 0.35 ? 'drop' : 'friction',
          '화면 구성 복잡도 대비 디지털 숙련도가 낮아 핵심 기능 사용을 시도하다 막힐 가능성이 있습니다');
        friction('tech_gap_journey', '저숙련 사용자가 핵심 기능 진입에서 막힐 가능성');
      } else {
        push('tryCore', '핵심 기능 사용 시도', 'pass', '핵심 기능 시도까지의 구조적 장벽은 낮은 것으로 추정됩니다');
      }
    }

    // ── 5) 입력 과정 ──
    if (!dropPoint) {
      if (fieldCount === 0) {
        inputOk = 1;
        push('input', '입력 과정', 'pass', '필수 입력 과정이 감지되지 않아 진입 부담이 낮습니다');
      } else {
        const burden = clamp01(fieldCount / 10);
        inputOk = clamp01(1 - burden * (1.2 - patience * 0.6) * (1.2 - lit * 0.4));
        if (inputOk < 0.4) {
          push('input', '입력 과정', patience < 0.4 ? 'drop' : 'friction',
            '입력 필드가 ' + fieldCount + '개로 많아 입력 도중 포기할 가능성이 높습니다');
          friction('form_burden', '입력 필드 과다(' + fieldCount + '개)로 인한 중도 포기 위험');
        } else if (inputOk < 0.65) {
          push('input', '입력 과정', 'friction', '입력 과정(' + fieldCount + '개 필드)이 다소 번거롭게 느껴질 수 있습니다');
          friction('form_burden', '입력 필드 과다(' + fieldCount + '개)로 인한 중도 포기 위험');
        } else {
          push('input', '입력 과정', 'pass', '입력 부담(' + fieldCount + '개 필드)은 감내 가능한 수준으로 추정됩니다');
        }
      }
    }

    // ── 6) 결과 확인 ──
    if (!dropPoint) {
      outcomeOk = clamp01(0.55 + tried * 0.3 + (spaShell ? -0.25 : 0.05) + rng.range(-0.05, 0.05));
      push('outcome', '결과 확인', outcomeOk < 0.45 ? 'friction' : 'pass',
        outcomeOk < 0.45
          ? '핵심 기능의 결과가 첫 사용에서 뚜렷하게 보이지 않을 가능성이 있습니다'
          : '핵심 가치 확인까지 도달할 가능성이 비교적 높습니다');
      if (outcomeOk < 0.45) friction('weak_outcome', '첫 사용에서 결과·가치가 뚜렷이 보이지 않을 가능성');
    }

    // ── 7) 재사용 판단 ──
    let revisit = 0;
    if (!dropPoint) {
      revisit = clamp01(persona.problemFreq * 0.4 + outcomeOk * 0.25 + persona.problemSeverity * 0.15 + (1 - persona.changeResistance) * 0.2);
      push('revisit', '재사용 판단', revisit < 0.4 ? 'drop' : revisit < 0.6 ? 'friction' : 'pass',
        revisit < 0.4
          ? '문제 빈도·체감 가치 기준으로 재방문 동기가 약해 자연 이탈이 예상됩니다'
          : revisit < 0.6
            ? '재사용 여부가 첫 경험의 만족도에 크게 좌우될 것으로 보입니다'
            : '문제를 자주 겪는 사용자라 재사용 가능성이 높습니다');
      if (revisit < 0.4) friction('low_revisit', '재방문 동기 부족으로 인한 자연 이탈');
    }

    // ── 8) 가입·결제 판단 ──
    let convert = 0;
    if (!dropPoint) {
      const priceBlock = persona.priceSensitivity * TIER_WEIGHT[priceTier];
      convert = clamp01(revisit * (1 - priceBlock) * (hasSignup ? 1 : 0.6));
      if (!hasSignup && priceTier === 4) {
        push('convert', '가입·결제 판단', 'friction', '가입·결제 경로가 화면에서 확인되지 않아 전환 판단을 보류할 가능성이 높습니다');
        friction('no_convert_path', '가입·결제 경로가 화면에서 발견되지 않음');
      } else if (convert < 0.3) {
        push('convert', '가입·결제 판단', 'drop',
          priceBlock > 0.4 ? '가격 부담으로 가입·결제 단계에서 이탈할 가능성이 높습니다'
            : '전환 동기가 충분히 형성되지 않아 가입·결제로 이어지기 어렵습니다');
        friction(priceBlock > 0.4 ? 'price_convert_block' : 'weak_convert', priceBlock > 0.4 ? '가격 부담으로 인한 전환 단계 이탈' : '전환 동기 부족');
      } else if (convert < 0.55) {
        push('convert', '가입·결제 판단', 'friction', '무료 체험 등 확신 장치가 있어야 전환할 것으로 추정됩니다');
      } else {
        push('convert', '가입·결제 판단', 'pass', '이 사용자 유형은 전환까지 도달할 가능성이 있습니다');
      }
    }

    // 이탈 이후 단계는 '도달 못 함' 처리 (실행하지 않은 것을 실행한 것처럼 표현하지 않음)
    const reachedKeys = steps.map(s => s.key);
    for (const st of STEPS) {
      if (!reachedKeys.includes(st.key)) {
        steps.push({ key: st.key, label: st.label, result: 'not_reached', reason: '앞 단계 이탈로 도달하지 않은 것으로 추정' });
      }
    }
    steps.sort((a, b) => STEPS.findIndex(s => s.key === a.key) - STEPS.findIndex(s => s.key === b.key));

    // ── 3단계: 여정 기반 점수 (0~100) ──
    const noise = () => rng.range(-5, 5);
    const pct = v => Math.round(MVPV.clamp(v * 100 + noise(), 0, 100));
    const jScores = {
      firstImpression: pct(clamp01(purpose * 0.55 + (S && S.mobile.hasViewport ? 0.15 : 0.05) + ctaClarity * 0.2 + persona.targetFit * 0.1)),
      comprehension: pct(understand),
      findability: pct(dropPoint === 'understand' ? findability * 0.5 : findability),
      easeOfUse: pct(clamp01((inputOk || 0.4) * 0.5 + (1 - Math.max(0, (S ? S.interactionComplexity : profile.complexity) - lit)) * 0.5)),
      signupIntent: pct(convert * (hasSignup ? 1 : 0.7)),
      retentionIntent: pct(revisit),
      paymentIntent: pct(clamp01(convert * (1 - persona.priceSensitivity * TIER_WEIGHT[priceTier] * 0.5))),
    };

    return { steps, dropPoint, frictions, jScores };
  }

  const JSCORE_LABELS = {
    firstImpression: '첫인상', comprehension: '서비스 이해도', findability: '핵심 기능 발견 가능성',
    easeOfUse: '사용 난이도(높을수록 쉬움)', signupIntent: '가입 의향',
    retentionIntent: '지속 사용 의향', paymentIntent: '결제 의향',
  };

  MVPV.simulateJourney = simulateJourney;
  MVPV.JOURNEY_STEPS = STEPS;
  MVPV.JSCORE_LABELS = JSCORE_LABELS;
})(window);
