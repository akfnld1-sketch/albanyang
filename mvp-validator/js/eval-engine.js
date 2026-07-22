/**
 * eval-engine.js — 설명 가능한 평가 엔진
 * 점수는 MVP 특성 × 페르소나 특성의 명시적 함수로 계산한다.
 * 단순 Math.random() 점수 생성 금지 — 시드 노이즈는 ±6 이내 개인차 표현에만 사용.
 * 모든 점수에 근거(reasons)를 남겨 "왜 이 점수인지" 표시할 수 있게 한다.
 */
(function (global) {
  'use strict';
  const MVPV = global.MVPV = global.MVPV || {};
  const clamp01 = MVPV.clamp01;

  // 가격 티어별 결제 저항 가중치 (0무료/1저가/2중가/3고가/4불명)
  const TIER_WEIGHT = [0.05, 0.35, 0.6, 0.85, 0.5];
  const TIER_LABEL = ['무료', '저가', '중가', '고가', '가격 미정'];

  function pct(v) { return Math.round(MVPV.clamp(v, 0, 1) * 100); }

  /**
   * 페르소나 1명의 MVP 평가
   * @returns {scores, reasons, sentiment}
   */
  function evaluate(persona, profile, rng) {
    const R = []; // 근거 목록 {key, text, dir:+1|-1}
    const noise = () => rng.range(-6, 6); // 개인차 소폭 노이즈 (0~100 스케일)

    // ── 1) 문제 공감도 ──
    // 페르소나의 체감 + MVP 문제 정의의 설득력 보정
    let empathy = clamp01(
      (0.45 * persona.problemSeverity + 0.35 * persona.problemFreq + 0.20 * persona.targetFit)
      * (0.85 + 0.3 * profile.problemStrength)
    );
    if (persona.targetFit < 0.35) R.push({ key: 'off_target', dir: -1, text: '타깃 조건에서 벗어나 있어 문제 자체를 크게 느끼지 않음' });
    if (persona.problemSeverity > 0.7) R.push({ key: 'severe_problem', dir: +1, text: '이 문제를 심각하게 겪고 있어 공감도가 높음' });
    if (persona.problemFreq < 0.3) R.push({ key: 'rare_problem', dir: -1, text: '문제를 겪는 빈도가 낮아 공감도가 제한적' });

    // ── 2) 서비스 필요성 ──
    // 곱셈 체인 압축을 피하기 위해 감쇠 계수를 완만하게 설정 (전원 부정 방지)
    let need = empathy * (1 - 0.45 * persona.solutionSatisfaction) * (0.7 + 0.3 * profile.problemStrength);
    if (persona.solutionSatisfaction > 0.7) R.push({ key: 'satisfied_current', dir: -1, text: '현재 해결 방법(' + persona.currentSolution + ')에 이미 만족하고 있음' });
    if (profile.problemStrength < 0.3) R.push({ key: 'weak_problem_def', dir: -1, text: '문제 정의가 약하게 서술되어 필요성 설득력이 떨어짐' });
    if (persona.solutionSatisfaction < 0.35 && empathy > 0.5) R.push({ key: 'unmet_need', dir: +1, text: '현재 해결 방법에 불만이 있어 대안을 찾는 중' });

    // ── 3) 사용 편의성 예상 ──
    const techGap = Math.max(0, profile.complexity - persona.digitalLiteracy);
    let usability = clamp01(0.85 - techGap * 1.1 - profile.complexity * 0.15);
    if (techGap > 0.25) R.push({ key: 'tech_gap', dir: -1, text: '디지털 숙련도 대비 서비스가 복잡해 사용이 어려울 것으로 예상' });
    if (profile.complexity > 0.6) R.push({ key: 'complex_service', dir: -1, text: '기능이 많아 처음 배우는 부담이 큼' });
    if (persona.digitalLiteracy > 0.8 && profile.complexity < 0.5) R.push({ key: 'easy_for_user', dir: +1, text: '디지털에 익숙해 쉽게 적응할 것으로 예상' });

    // ── 4) 첫 사용 의향 ──
    // 필요성과 개방성(1-저항)의 가중 혼합 × 편의성·단계 보정 — 페르소나 간 분산 유지
    const stagePenalty = 0.85 + 0.15 * profile.stageInfo.maturity;
    // 시도 장벽: 가격이 높을수록 "일단 써보기"조차 어려워짐 (무료면 거의 없음)
    const trialBarrier = 1 - 0.35 * persona.priceSensitivity * TIER_WEIGHT[profile.price.tier];
    let firstUse = (0.5 * need + 0.5 * empathy * (1 - persona.changeResistance))
      * (0.7 + 0.3 * usability) * stagePenalty * trialBarrier;
    if (profile.price.tier >= 2 && persona.priceSensitivity > 0.6) R.push({ key: 'trial_barrier', dir: -1, text: '유료 서비스라 시작 자체를 망설임 — 무료 체험 여부가 관건' });
    if (persona.changeResistance > 0.65) R.push({ key: 'change_resist', dir: -1, text: '새로운 서비스로 갈아타는 것 자체를 꺼림' });
    if (profile.stageInfo.maturity < 0.5) R.push({ key: 'early_stage', dir: -1, text: profile.stageInfo.label + ' 단계라 완성도에 대한 불안이 있음' });
    if (persona.decisionStyle.key === 'impulsive' && need > 0.4) { firstUse = clamp01(firstUse * 1.15); R.push({ key: 'try_first', dir: +1, text: '일단 써보는 성향이라 첫 진입 장벽이 낮음' }); }
    if (persona.decisionStyle.key === 'referral') { firstUse *= 0.85; R.push({ key: 'need_referral', dir: -1, text: '지인 추천 없이는 잘 시작하지 않는 성향' }); }

    // ── 5) 기존 해결방법 전환 가능성 ──
    let switching = firstUse * (1 - 0.45 * persona.solutionSatisfaction) * (1 - 0.25 * persona.changeResistance);
    if (profile.hasCompetitors && persona.archetype === 'loyal_rival') { switching *= 0.5; R.push({ key: 'rival_loyal', dir: -1, text: '경쟁 서비스에 정착해 있어 전환 동기가 약함' }); }

    // ── 6) 유료 결제 의향 ──
    const tier = profile.price.tier;
    let priceFit;
    if (tier === 0) { priceFit = 0.9; }
    else { priceFit = clamp01(1 - persona.priceSensitivity * TIER_WEIGHT[tier]); }
    let payment = (0.55 * firstUse + 0.45 * need) * priceFit * (0.7 + 0.3 * persona.problemSeverity);
    if (tier === 0) {
      payment *= 0.7; // 무료 서비스: 추후 유료 전환 가정 시 보수적으로
      R.push({ key: 'free_now', dir: -1, text: '현재 무료라 결제 의향은 향후 유료화 시나리오 기준 추정' });
    }
    if (tier >= 2 && persona.priceSensitivity > 0.65) R.push({ key: 'price_block', dir: -1, text: '가격 민감도가 높은데 ' + TIER_LABEL[tier] + ' 티어(' + profile.price.label + ')라 결제 저항이 큼' });
    if (tier === 1 && persona.problemSeverity > 0.6) R.push({ key: 'cheap_ok', dir: +1, text: '문제가 절실하고 가격이 부담 없는 수준이라 결제 가능성 있음' });
    if (tier === 4) R.push({ key: 'price_unknown', dir: -1, text: '가격 정보가 없어 결제 의향 추정의 불확실성이 큼' });

    // ── 7) 지속 사용 가능성 ──
    let retention = firstUse * (0.55 + 0.45 * persona.problemFreq) * (0.65 + 0.35 * usability);
    if (persona.problemFreq < 0.35) R.push({ key: 'low_freq_churn', dir: -1, text: '문제 발생 빈도가 낮아 쓸 일이 줄면 자연 이탈 가능성' });
    if (persona.quitReason && retention < 0.5) R.push({ key: 'churn_risk', dir: -1, text: '초기 습관이 자리 잡기 전에 이탈할 위험이 큼 (예: ' + persona.quitReason + ')', aggText: '초기 습관이 자리 잡기 전에 이탈할 위험이 큼' });

    // ── 8) 추천 가능성 ──
    let referral = (0.45 * retention + 0.35 * empathy + 0.2 * firstUse);
    if (persona.decisionStyle.key === 'referral') referral *= 1.1; // 추천 문화에 민감한 사람이 만족하면 잘 퍼뜨림
    if (persona.archetype === 'skeptic') { referral *= 0.7; R.push({ key: 'skeptic_no_ref', dir: -1, text: '회의적인 성향이라 남에게 권하는 데 신중함' }); }

    const scores = {
      empathy:   MVPV.clamp(pct(empathy) + noise(), 0, 100),
      need:      MVPV.clamp(pct(need) + noise(), 0, 100),
      firstUse:  MVPV.clamp(pct(firstUse) + noise(), 0, 100),
      retention: MVPV.clamp(pct(retention) + noise(), 0, 100),
      usability: MVPV.clamp(pct(usability) + noise(), 0, 100),
      switching: MVPV.clamp(pct(switching) + noise(), 0, 100),
      payment:   MVPV.clamp(pct(payment) + noise(), 0, 100),
      referral:  MVPV.clamp(pct(referral) + noise(), 0, 100),
    };
    for (const k in scores) scores[k] = Math.round(scores[k]);

    // 종합 성향 판정
    const avgKey = (scores.empathy + scores.firstUse + scores.retention) / 3;
    let sentiment;
    if (persona.archetype === 'skeptic' && avgKey < 60) sentiment = 'skeptical';
    else if (avgKey >= 62) sentiment = 'positive';
    else if (avgKey >= 42) sentiment = 'neutral';
    else sentiment = 'negative';

    return { scores, reasons: R, sentiment };
  }

  const SCORE_LABELS = {
    empathy: '문제 공감도', need: '서비스 필요성', firstUse: '첫 사용 의향',
    retention: '지속 사용 가능성', usability: '사용 편의성 예상', switching: '전환 가능성',
    payment: '유료 결제 의향', referral: '추천 가능성',
  };

  MVPV.evaluate = evaluate;
  MVPV.SCORE_LABELS = SCORE_LABELS;
  MVPV.TIER_LABEL = TIER_LABEL;
})(window);
