/**
 * report-engine.js — 최종 MVP 개선 보고서 + GO/NO-GO 판정
 * 집계 결과와 근거 빈도를 바탕으로 실행 가능한 제언을 자동 생성한다.
 */
(function (global) {
  'use strict';
  const MVPV = global.MVPV = global.MVPV || {};

  const VERDICTS = {
    GO: { label: 'GO', emoji: '🟢', desc: '핵심 가설이 유효해 보입니다. 실제 사용자 검증으로 빠르게 넘어가세요.' },
    CONDITIONAL_GO: { label: 'CONDITIONAL GO', emoji: '🟡', desc: '가능성은 있지만 조건이 붙습니다. 아래 개선 항목을 해결한 뒤 진행하세요.' },
    PIVOT_CONSIDER: { label: 'PIVOT CONSIDER', emoji: '🟠', desc: '문제 공감은 있으나 현재 형태로는 전환이 약합니다. 타깃 또는 제공 방식의 피벗을 검토하세요.' },
    STOP_REDEFINE: { label: 'STOP & REDEFINE', emoji: '🔴', desc: '현재 정의된 문제·타깃으로는 수요 신호가 약합니다. 문제 정의부터 다시 세우는 것을 권합니다.' },
  };

  function decideVerdict(agg) {
    const m = agg.means;
    const hasCore = agg.segments.core.length > 0;
    if (agg.overall < 40 || m.empathy < 35) return 'STOP_REDEFINE';
    if (agg.overall >= 68 && m.payment >= 50 && hasCore) return 'GO';
    if (agg.overall >= 50) return 'CONDITIONAL_GO';
    // 50점 미만: 공감은 있는데 전환·사용이 약하면 피벗 검토
    return 'PIVOT_CONSIDER';
  }

  // 근거 키 → 개선 과제 매핑
  const IMPROVEMENT_MAP = {
    price_block: { title: '가격 저항 완화', text: '가격 민감층의 결제 저항이 큽니다. 무료 구간 확대, 낮은 진입 요금제, 또는 가치 대비 가격 근거 제시를 검토하세요.' },
    satisfied_current: { title: '전환 이유 만들기', text: '기존 해결 방법에 만족하는 사용자가 많습니다. "지금 방식 대비 확실히 나은 한 가지"를 첫 화면에서 증명해야 합니다.' },
    tech_gap: { title: '사용 난이도 낮추기', text: '디지털 저숙련 사용자에게 서비스가 어렵습니다. 온보딩 단순화, 용어 순화, 기본값 자동 설정이 필요합니다.' },
    change_resist: { title: '진입 장벽 제거', text: '갈아타는 부담이 이탈 원인입니다. 가입 없이 체험, 기존 데이터 가져오기 등 전환 비용을 줄이세요.' },
    weak_problem_def: { title: '문제 정의 구체화', text: '문제 서술의 설득력이 약합니다. 누가·언제·얼마나 자주 겪는 문제인지 구체적 시나리오로 다듬으세요.' },
    early_stage: { title: '완성도 신뢰 확보', text: '초기 단계에 대한 불안이 감지됩니다. 데모·스크린샷·작동 영상 등 실체를 보여주는 자료가 필요합니다.' },
    complex_service: { title: '기능 다이어트', text: '기능이 많아 학습 부담이 큽니다. 핵심 1~2개에 집중하고 나머지는 후순위로 미루세요.' },
    off_target: { title: '타깃 좁히기', text: '비타깃 사용자에게는 반응이 없습니다. 타깃을 좁혀 그 안에서 강한 반응을 만드는 편이 낫습니다.' },
    low_freq_churn: { title: '재방문 고리 설계', text: '문제 빈도가 낮은 사용자는 금방 떠납니다. 알림·리포트 등 주기적으로 돌아올 이유를 설계하세요.' },
    rival_loyal: { title: '경쟁 대비 차별화', text: '경쟁 서비스 충성 사용자는 움직이지 않습니다. 정면 대결보다 경쟁사가 못 푸는 세부 문제를 노리세요.' },
    skeptic_no_ref: { title: '신뢰 근거 제시', text: '회의적 사용자는 증거를 원합니다. 실제 사례, 수치 근거, 작동 원리 공개로 신뢰를 쌓으세요.' },
    price_unknown: { title: '가격 정책 결정', text: '가격 정보가 없어 결제 의향 검증이 불가능합니다. 가설이라도 가격을 정해 다시 검증하세요.' },
    need_referral: { title: '추천 루프 설계', text: '지인 추천으로 움직이는 사용자가 있습니다. 초대·공유 보상 등 추천 동선을 만들어 두세요.' },
    rare_problem: { title: '문제 빈도 검증', text: '문제를 자주 겪지 않는 사용자가 섞여 있습니다. 고빈도 상황의 사용자를 핵심 타깃으로 재정의하세요.' },
    free_now: { title: '수익화 가설 수립', text: '무료 전제라 결제 검증이 안 됩니다. 유료화 시점·대상·형태의 가설을 먼저 세우세요.' },
    churn_risk: { title: '초기 이탈 방지', text: '초기 습관 형성 전에 떠날 위험이 큽니다. 첫 1~2주의 사용 경험을 집중 설계하세요.' },
    // ── 여정(화면 구조) 기반 개선 과제 ──
    unclear_purpose: { title: '첫 화면 목적 전달 개선', text: '첫 화면의 제목·소개 문구만으로 서비스 목적이 전달되지 않을 가능성이 높습니다. 첫 화면 상단에 "누구의 어떤 문제를 해결하는지" 한 문장을 명확히 배치하세요.' },
    cta_overload: { title: 'CTA 정리', text: '버튼·CTA가 많아 어디를 눌러야 할지 혼란스러울 수 있습니다. 첫 화면의 주요 행동 버튼을 1~2개로 줄이세요.' },
    cta_missing: { title: '행동 유도 버튼 추가', text: '다음 행동으로 이어질 버튼·CTA가 화면에서 발견되지 않았습니다. 핵심 기능으로 이어지는 명확한 버튼이 필요합니다.' },
    low_findability: { title: '기능 발견 경로 개선', text: '원하는 기능을 찾아가는 경로가 불명확할 가능성이 있습니다. 메뉴 구조와 첫 화면 안내를 정리하세요.' },
    form_burden: { title: '입력 부담 축소', text: '입력 필드가 많아 입력 도중 포기할 위험이 있습니다. 필수 입력을 최소화하고 단계를 나누세요.' },
    tech_gap_journey: { title: '저숙련 사용자 배려', text: '디지털 숙련도가 낮은 사용자가 핵심 기능 진입에서 막힐 수 있습니다. 용어 순화와 단계별 안내를 추가하세요.' },
    spa_shell: { title: '초기 로딩 경험 개선', text: '정적 HTML에 내용이 없어 첫 화면이 늦게 보이거나 비어 보일 수 있습니다. 로딩 상태 표시나 SSR/프리렌더링을 검토하세요.' },
    weak_outcome: { title: '첫 사용 가치 증명', text: '첫 사용에서 결과·가치가 뚜렷이 보이지 않을 수 있습니다. 첫 세션 안에 "되는 순간"을 반드시 보여주세요.' },
    low_revisit: { title: '재방문 고리 설계', text: '재방문 동기가 약한 사용자가 많습니다. 알림·리포트 등 돌아올 이유를 설계하세요.' },
    no_convert_path: { title: '전환 경로 노출', text: '가입·결제 경로가 화면에서 확인되지 않았습니다. 전환 지점을 명확히 노출하세요.' },
    price_convert_block: { title: '전환 단계 가격 저항 완화', text: '가격 부담으로 전환 직전에 이탈할 가능성이 큽니다. 무료 체험·단계적 요금제를 검토하세요.' },
    weak_convert: { title: '전환 동기 강화', text: '사용까지는 가지만 전환 동기가 약합니다. 전환 시점에 얻는 가치를 명확히 제시하세요.' },
  };

  function priceAssessment(agg, profile) {
    const t = profile.price.tier;
    const pay = agg.means.payment;
    if (t === 4) return '가격이 정해지지 않아 결제 검증이 사실상 불가능합니다. 가설 가격이라도 설정해 재검증하세요.';
    if (t === 0) return '무료 전략은 진입 장벽을 낮추지만, 향후 유료 전환 시나리오의 결제 의향(' + pay + '점)은 보수적으로 나타났습니다. 유료화 가설을 미리 세워두세요.';
    if (pay >= 55) return '현재 가격(' + profile.price.label + ')에 대한 수용도가 비교적 양호합니다(' + pay + '점). 핵심층 대상 가격 인상 여력도 실험해볼 만합니다.';
    if (pay >= 40) return '현재 가격(' + profile.price.label + ')은 경계선입니다(' + pay + '점). 무료 체험 후 전환 구조로 저항을 낮추는 것을 권합니다.';
    return '현재 가격(' + profile.price.label + ')에 대한 저항이 큽니다(' + pay + '점). 가격 인하보다 먼저, 가격만큼의 가치가 전달되는지 점검하세요.';
  }

  /**
   * 최종 보고서 생성
   */
  function buildReport(agg, profile, input, results) {
    const m = agg.means;
    const verdictKey = decideVerdict(agg);

    // 개선 TOP 5: 부정 근거 빈도순 매핑
    const improvements = [];
    for (const r of agg.topNegative) {
      const item = IMPROVEMENT_MAP[r.key];
      if (item && !improvements.some(i => i.title === item.title)) {
        improvements.push({ ...item, count: r.count });
      }
      if (improvements.length >= 5) break;
    }
    if (improvements.length === 0) {
      improvements.push({ title: '실사용 검증', text: '시뮬레이션에서 큰 감점 요인이 없습니다. 실제 사용자 5명 인터뷰로 검증을 이어가세요.', count: 0 });
    }

    // 핵심 타깃 서술
    const coreN = agg.segments.core.length;
    const coreSample = agg.segments.core[0];
    const coreTarget = coreN > 0
      ? (coreSample.persona.age + '세 전후 ' + coreSample.persona.occupation + ' 유형 — 문제를 자주·심하게 겪으면서 현재 해결책에 불만이 있는 사용자')
      : '시뮬레이션에서 뚜렷한 핵심층이 나타나지 않았습니다. 타깃 정의를 좁혀 재검증이 필요합니다.';

    const excludeTarget = agg.segments.non_target.length > 0
      ? '문제를 거의 겪지 않는 사용자(' + agg.segments.non_target.length + '명 분류)와 기존 해결책 만족도가 높은 사용자는 초기 타깃에서 제외하는 것이 효율적입니다.'
      : '뚜렷한 제외 대상은 발견되지 않았습니다.';

    const strongFeature = profile.features.length
      ? profile.features[0] + (profile.features.length > 1 ? ' (입력된 기능 중 첫 번째 핵심 기능 기준)' : '')
      : '핵심 기능이 입력되지 않아 판단 불가 — 기능 목록을 입력하고 재검증하세요.';
    const deferFeature = profile.features.length > 2
      ? profile.features.slice(2).join(', ') + ' — 핵심 경험 검증 전까지 후순위 권장'
      : '기능 수가 적어 후순위 조정 대상이 없습니다. 현재 범위를 유지하세요.';

    // 검증할 가설·인터뷰 질문
    const hypotheses = [
      '타깃 사용자는 "' + ((input.problem || '정의된 문제').split(/[.\n]/)[0].slice(0, 50)) + '" 문제를 주 1회 이상 겪는다',
      '사용자는 현재 해결 방법(수기·검색·경쟁 서비스)에 구체적 불만을 말로 표현할 수 있다',
      profile.price.tier > 0 && profile.price.tier < 4
        ? '핵심 타깃은 ' + profile.price.label + ' 수준의 비용을 문제 해결 대가로 수용한다'
        : '사용자가 이 문제 해결에 지불 의사가 있는 금액대가 존재한다',
      '사용자는 첫 사용 5분 안에 핵심 가치를 이해한다',
    ];
    if (input.keyQuestion) hypotheses.unshift('[입력한 핵심 질문] ' + input.keyQuestion);

    const interviewQs = [
      '이 문제를 마지막으로 겪은 게 언제였고, 그때 어떻게 해결하셨나요?',
      '지금 방법에서 가장 불만스러운 순간은 언제인가요?',
      '(소개 문구를 보여주고) 이 설명에서 이해가 안 되는 부분이 있나요?',
      '이런 서비스에 돈을 낸다면 얼마까지 낼 수 있나요? 그 이유는요?',
      '내일부터 이 서비스를 못 쓰게 된다면 어떤 기분일 것 같나요?',
    ];

    const nextPriorities = improvements.slice(0, 3).map((im, i) => (i + 1) + '. ' + im.title);
    nextPriorities.push((nextPriorities.length + 1) + '. 실제 타깃 사용자 5명 심층 인터뷰');

    // 여정 기반 항목 (journey 집계가 있을 때)
    let dropText = null, frictionText = null;
    if (agg.journey) {
      dropText = agg.journey.topDrop
        ? '"' + agg.journey.topDrop.label + '" 단계 (' + agg.journey.topDrop.count + '명 이탈 추정, 여정 완주율 ' + agg.journey.completedRate + '%)'
        : '뚜렷한 공통 이탈 지점 없음 (여정 완주율 ' + agg.journey.completedRate + '%)';
      frictionText = agg.journey.topFrictions.length
        ? agg.journey.topFrictions[0].text + ' (' + agg.journey.topFrictions[0].count + '명)'
        : '집계된 공통 불편 없음';
    }

    return {
      verdictKey,
      verdict: VERDICTS[verdictKey],
      dropText, frictionText,
      problemStrengthText: m.empathy >= 60
        ? '문제 공감도 평균 ' + m.empathy + '점 — 시뮬레이션상 문제 자체는 실재하는 것으로 보입니다.'
        : m.empathy >= 45
          ? '문제 공감도 평균 ' + m.empathy + '점 — 문제는 존재하나 절실함이 부족합니다. "있으면 좋은 것"과 "꼭 필요한 것"의 경계에 있습니다.'
          : '문제 공감도 평균 ' + m.empathy + '점 — 정의된 문제에 대한 공감이 약합니다. 문제 정의부터 재검토가 필요합니다.',
      coreTarget, excludeTarget, strongFeature, deferFeature,
      improvements,
      addSuggestion: agg.topNegative.some(r => r.key === 'change_resist' || r.key === 'satisfied_current')
        ? '기존 방식(엑셀·메모·경쟁 서비스)에서 데이터를 가져오는 마이그레이션 기능 — 전환 장벽 완화에 직접 기여'
        : '첫 사용 5분 안에 가치를 보여주는 샘플 데이터/데모 모드',
      priceText: priceAssessment(agg, profile),
      hypotheses, interviewQs, nextPriorities,
    };
  }

  MVPV.buildReport = buildReport;
  MVPV.VERDICTS = VERDICTS;
})(window);
