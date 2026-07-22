/**
 * stats-engine.js — 결과 집계·세그먼트 분석·100명 통계
 */
(function (global) {
  'use strict';
  const MVPV = global.MVPV = global.MVPV || {};

  function avg(arr) { return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0; }

  /** 근거(reason) 키 빈도 집계 → 상위 항목 */
  function topReasons(results, dir, limit) {
    const freq = {};
    for (const r of results) {
      for (const reason of r.evaluation.reasons) {
        if (reason.dir !== dir) continue;
        if (!freq[reason.key]) freq[reason.key] = { count: 0, text: reason.aggText || reason.text };
        freq[reason.key].count++;
      }
    }
    return Object.keys(freq)
      .map(k => ({ key: k, count: freq[k].count, text: freq[k].text }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit || 5);
  }

  /** 세그먼트 분류 규칙 */
  const SEGMENTS = [
    {
      key: 'core', label: '핵심 고객층', emoji: '🎯',
      test: s => s.firstUse >= 60 && s.payment >= 50,
      why: '문제 공감과 사용 의향이 높고 결제 의향까지 있는 그룹입니다. 이들이 실제 초기 유료 고객이 될 가능성이 가장 높습니다.',
    },
    {
      key: 'potential', label: '잠재 고객층', emoji: '🌱',
      test: s => s.firstUse >= 55 && s.payment < 50,
      why: '써볼 의향은 있지만 결제까지는 주저하는 그룹입니다. 무료 구간에서 가치를 증명하면 전환 가능한 층입니다.',
    },
    {
      key: 'interested', label: '관심만 있는 층', emoji: '👀',
      test: s => s.empathy >= 55 && s.firstUse < 55,
      why: '문제에는 공감하지만 행동으로 이어지지 않는 그룹입니다. 진입 장벽(설치·학습·전환 비용)이 원인일 가능성이 큽니다.',
    },
    {
      key: 'churn_risk', label: '이탈 위험층', emoji: '⚠️',
      test: s => s.firstUse >= 50 && s.retention < 45,
      why: '시작은 하지만 오래 쓰지 않을 그룹입니다. 사용 빈도를 만들 반복 가치(리마인드·습관 고리)가 부족합니다.',
    },
    {
      key: 'non_target', label: '비타깃층', emoji: '🚶',
      test: (s, p) => p.targetFit < 0.35 || s.empathy < 35,
      why: '문제를 거의 겪지 않거나 타깃 조건 밖의 그룹입니다. 이 층을 설득하는 데 자원을 쓰지 않는 것이 좋습니다.',
    },
  ];

  function classifySegment(result) {
    const s = result.evaluation.scores;
    const p = result.persona;
    // 비타깃 우선 판정 → 이후 순서대로
    if (SEGMENTS[4].test(s, p)) return 'non_target';
    for (const seg of SEGMENTS.slice(0, 4)) {
      if (seg.test(s, p)) return seg.key;
    }
    return 'interested';
  }

  /**
   * 전체 결과 집계
   * @param {Array} results [{persona, evaluation, opinions?}]
   * @param {object} profile
   */
  function aggregate(results, profile) {
    const keys = Object.keys(MVPV.SCORE_LABELS);
    const means = {};
    for (const k of keys) means[k] = Math.round(avg(results.map(r => r.evaluation.scores[k])));

    // 종합점수: 핵심 지표 가중 평균
    const overall = Math.round(
      means.empathy * 0.15 + means.need * 0.15 + means.firstUse * 0.2 +
      means.retention * 0.15 + means.usability * 0.1 + means.switching * 0.05 +
      means.payment * 0.12 + means.referral * 0.08
    );

    // 예상 이탈률: 지속 사용 가능성 역산 + 이탈위험 세그먼트 비중
    const segments = {};
    for (const seg of SEGMENTS) segments[seg.key] = [];
    for (const r of results) segments[classifySegment(r)].push(r);
    const churnRate = Math.round(MVPV.clamp(
      (100 - means.retention) * 0.7 + (segments.churn_risk.length / results.length) * 100 * 0.3, 0, 100));

    // 검증 신뢰도: 입력 완성도 × 인원 보정
    const nBonus = results.length >= 100 ? 1.0 : results.length >= 10 ? 0.9 : results.length >= 5 ? 0.8 : results.length >= 3 ? 0.7 : 0.55;
    // 상한 90: 시뮬레이션 결과에 과도한 확신을 주지 않기 위함
    const confidence = Math.min(90, Math.round(profile.completeness * nBonus * 100));

    const sentimentCount = { positive: 0, neutral: 0, negative: 0, skeptical: 0 };
    for (const r of results) sentimentCount[r.evaluation.sentiment]++;

    const agg = {
      n: results.length,
      overall, means, churnRate, confidence,
      confidenceLevel: confidence >= 65 ? 'high' : confidence >= 45 ? 'mid' : 'low',
      sentimentCount,
      segments,
      segmentDefs: SEGMENTS,
      topPositive: topReasons(results, +1, 5),
      topNegative: topReasons(results, -1, 5),
    };

    // ── 여정(사용 시나리오) 통계 — journey가 있을 때만 ──
    if (results[0] && results[0].journey) {
      const jKeys = Object.keys(MVPV.JSCORE_LABELS);
      const jMeans = {};
      for (const k of jKeys) jMeans[k] = Math.round(avg(results.map(r => r.journey.jScores[k])));

      const dropDist = {};
      for (const r of results) {
        if (r.journey.dropPoint) dropDist[r.journey.dropPoint] = (dropDist[r.journey.dropPoint] || 0) + 1;
      }
      let topDrop = null;
      for (const k in dropDist) {
        if (!topDrop || dropDist[k] > topDrop.count) {
          const step = MVPV.JOURNEY_STEPS.find(s => s.key === k);
          topDrop = { key: k, label: step ? step.label : k, count: dropDist[k] };
        }
      }

      const frictionFreq = {};
      for (const r of results) {
        for (const f of r.journey.frictions) {
          if (!frictionFreq[f.key]) frictionFreq[f.key] = { count: 0, text: f.text.replace(/\(\d+개\)/, '') };
          frictionFreq[f.key].count++;
        }
      }
      const topFrictions = Object.keys(frictionFreq)
        .map(k => ({ key: k, count: frictionFreq[k].count, text: frictionFreq[k].text }))
        .sort((a, b) => b.count - a.count).slice(0, 5);

      const pctOf = fn => Math.round(results.filter(fn).length / results.length * 100);
      agg.journey = {
        means: jMeans, dropDist, topDrop, topFrictions,
        findRate: pctOf(r => {
          const st = r.journey.steps.find(s => s.key === 'explore');
          return st && st.result === 'pass';
        }),
        signupRate: pctOf(r => r.journey.jScores.signupIntent >= 55),
        retentionRate: pctOf(r => r.journey.jScores.retentionIntent >= 55),
        paymentRate: pctOf(r => r.journey.jScores.paymentIntent >= 55),
        completedRate: pctOf(r => !r.journey.dropPoint),
      };

      // 종합점수: 기존 평가 55% + 여정 기반 45% 혼합
      const jc = jMeans.firstImpression * 0.15 + jMeans.comprehension * 0.15 + jMeans.findability * 0.15 +
        jMeans.easeOfUse * 0.1 + jMeans.signupIntent * 0.15 + jMeans.retentionIntent * 0.15 + jMeans.paymentIntent * 0.15;
      agg.overall = Math.round(agg.overall * 0.55 + jc * 0.45);
    }

    // ── 100명 모드 추가 통계 ──
    if (results.length >= 100) {
      const sc = r => r.evaluation.scores;
      agg.bulk = {
        activeUsers: results.filter(r => sc(r).firstUse >= 65).length,
        considering: results.filter(r => sc(r).firstUse >= 45 && sc(r).firstUse < 65).length,
        nonUsers: results.filter(r => sc(r).firstUse < 45).length,
        payers: results.filter(r => sc(r).payment >= 55).length,
        topPositiveOpinion: agg.topPositive[0] || null,
        topNegativeOpinion: agg.topNegative[0] || null,
        topRequestedFeature: profile.features.length
          ? profile.features[0] + ' (핵심 기능 중 기대 집중)'
          : '핵심 기능이 명시되지 않아 집계 불가',
        topChurnCause: agg.topNegative.find(r => ['low_freq_churn', 'churn_risk', 'tech_gap', 'change_resist'].includes(r.key))
          || agg.topNegative[0] || null,
      };
    }
    return agg;
  }

  /** 대표 페르소나 선정 (100명 모드): 원형별로 점수 중앙값에 가장 가까운 인물 */
  function pickRepresentatives(results, maxN) {
    const byArch = {};
    for (const r of results) {
      (byArch[r.persona.archetype] = byArch[r.persona.archetype] || []).push(r);
    }
    const reps = [];
    for (const arch in byArch) {
      const group = byArch[arch].slice().sort((a, b) =>
        a.evaluation.scores.firstUse - b.evaluation.scores.firstUse);
      const median = group[Math.floor(group.length / 2)];
      reps.push(median);
      // 큰 그룹은 상·하위 1명씩 추가로 뽑아 다양성 확보
      if (group.length >= 15 && reps.length < maxN) reps.push(group[group.length - 1]);
    }
    return reps.slice(0, maxN || 8);
  }

  MVPV.aggregate = aggregate;
  MVPV.pickRepresentatives = pickRepresentatives;
  MVPV.classifySegment = classifySegment;
})(window);
