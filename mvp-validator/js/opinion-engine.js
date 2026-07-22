/**
 * opinion-engine.js — 템플릿 기반 자연어 의견 생성 (로컬 표준 검증 모드)
 * 원형 × 성향(긍정/중립/부정/회의) × 슬롯 치환 조합으로 페르소나별 서로 다른 의견을 만든다.
 * AI 심층 모드에서는 이 결과를 로컬 LLM이 재작성한다.
 */
(function (global) {
  'use strict';
  const MVPV = global.MVPV = global.MVPV || {};

  // 슬롯: {name} {feature} {price} {competitor} {current} {value} {quit} {problem}
  const T = {
    firstImpression: {
      positive: [
        '"{name}" 소개만 보고도 제 얘기다 싶었어요. {problem} 이거 진짜 제가 매번 겪는 문제거든요.',
        '설명을 보자마자 한번 써보고 싶다는 생각이 들었어요. 특히 {feature} 부분이 눈에 들어왔습니다.',
        '오, 이런 게 있었으면 했는데 드디어 나왔네 싶은 첫인상이었어요.',
      ],
      neutral: [
        '나쁘지 않은데, 솔직히 "그래서 기존 방법이랑 뭐가 다르지?"라는 생각이 먼저 들었어요.',
        '컨셉은 알겠는데 제가 굳이 새 걸 깔아야 할 이유까지는 아직 못 느꼈어요.',
        '설명은 이해했어요. 다만 실제로 편한지는 써봐야 알 것 같아요.',
      ],
      negative: [
        '솔직히 첫인상에서 저를 위한 서비스라는 느낌은 못 받았어요.',
        '설명을 두 번 읽었는데도 이게 왜 필요한지 잘 와닿지 않았어요.',
        '저는 지금 {current}(으)로도 큰 불편이 없어서 눈길이 안 갔어요.',
      ],
      skeptical: [
        '이런 서비스 많이 봤는데 결국 다 비슷하더라고요. {name}은 뭐가 다른지 증명해야 할 것 같아요.',
        '말은 좋은데, 실제로 되는지 의심부터 드는 게 사실이에요.',
      ],
    },
    likeMost: {
      positive: ['{feature} 기능이 제일 마음에 들어요. 딱 필요했던 부분이에요.', '제가 중요하게 여기는 게 {value}인데, 그 부분을 건드려주는 게 좋았어요.'],
      neutral: ['{feature}는 있으면 편할 것 같긴 해요.', '방향성 자체는 공감해요. 문제 선정은 잘한 것 같아요.'],
      negative: ['딱히 꼽기 어렵지만, 굳이 고르면 아이디어 자체는 이해돼요.', '문제 인식은 맞다고 봐요. 다만 저한테는 해당이 없을 뿐이에요.'],
      skeptical: ['좋아 보이는 건 있죠. 근데 그게 실제로 돌아가는지가 관건이에요.'],
    },
    mostNeeded: {
      positive: ['{feature}만 확실하게 잘 되면 저는 씁니다.', '자동으로 알아서 해주는 부분이 제일 중요해요. 손이 많이 가면 안 써요.'],
      neutral: ['시작하자마자 5분 안에 가치를 느끼게 해주는 온보딩이 제일 필요해 보여요.', '기존에 쓰던 {current}에서 데이터를 옮겨오는 기능이 없으면 시작을 못 해요.'],
      negative: ['일단 무료로 충분히 써볼 수 있는 구조가 필요해요.', '저 같은 사람도 헤매지 않을 만큼 쉬운 화면이요.'],
      skeptical: ['결과가 믿을 만하다는 근거를 보여주는 기능이요. 그게 없으면 다 소용없어요.'],
    },
    hardToUnderstand: {
      positive: ['크게 어려운 건 없었는데, 처음 쓰는 사람한테는 용어가 살짝 낯설 수 있겠어요.'],
      neutral: ['{name}이 정확히 뭘 해주고 뭘 안 해주는지 경계가 좀 모호했어요.', '사용 흐름 중간 단계가 머릿속에 잘 안 그려졌어요.'],
      negative: ['설명이 제공자 입장 언어라서 저 같은 사람은 뭐가 좋다는 건지 한 번에 이해가 안 돼요.', '기능이 많아서 뭐부터 해야 할지 모르겠어요.'],
      skeptical: ['"어떻게" 그걸 해준다는 건지 원리가 안 보여서 신뢰가 안 가요.'],
    },
    unnecessary: {
      positive: ['핵심만 있으면 돼요. 부가 기능이 늘어나면 오히려 복잡해질까 걱정이에요.'],
      neutral: ['기능 목록 중에 절반은 저는 안 쓸 것 같아요. 핵심 한두 개가 중요하죠.'],
      negative: ['{feature} 같은 건 저한테는 굳이 필요 없어 보여요.', '이 기능 저 기능 다 있는 것보다 하나라도 확실한 게 나아요.'],
      skeptical: ['차별점이라고 내세우는 것들이 실제론 장식처럼 느껴져요.'],
    },
    whyNotUse: {
      positive: ['지금은 딱히 없어요. 다만 몇 번 써봤는데 기대에 못 미치면 조용히 지울 것 같아요.'],
      neutral: ['습관을 바꾸는 게 귀찮아서요. {current}가 완벽하진 않아도 익숙하거든요.', '초반에 손이 많이 가면 결국 안 쓰게 되더라고요.'],
      negative: ['저는 이 문제를 그렇게 자주 겪지 않아서요. 있으면 좋지만 없어도 그만이에요.', '{current}(으)로 이미 해결하고 있어서 갈아탈 이유가 부족해요.'],
      skeptical: ['이런 앱 깔았다 지운 게 한두 번이 아니라서요. 이번에도 그럴 것 같은 예감이 들어요.'],
    },
    whyNotPay: {
      positive: ['무료로 충분히 써보고 확신이 들기 전엔 결제 안 해요. 확신이 들면 {price} 정도는 낼 수 있어요.'],
      neutral: ['{price}가 아주 부담되는 건 아닌데, 이 정도 문제 해결에 돈을 쓸지는 고민돼요.', '한 달 써보고 시간이든 돈이든 아껴준 게 눈에 보여야 결제할 거예요.'],
      negative: ['비슷한 걸 무료로 해주는 데가 있을 것 같아서요. {price}는 저한테 비싸요.', '구독이 이미 너무 많아요. 하나 더 늘릴 여유가 없어요.'],
      skeptical: ['효과를 못 믿겠는데 선결제는 절대 안 하죠. 성과를 먼저 보여주세요.'],
    },
    improvement: {
      positive: ['처음 설정 과정을 더 줄여주세요. 시작이 가벼울수록 좋아요.', '{feature}를 더 깊게 파주세요. 얕게 여러 개보다 이게 확실한 게 좋아요.'],
      neutral: ['{competitor} 대비 뭐가 나은지 첫 화면에서 바로 보여줬으면 해요.', '제 상황에 맞춘 예시를 보여주면 훨씬 와닿을 것 같아요.'],
      negative: ['타깃을 더 좁혀서 그 사람들한테 확실한 것 하나를 주는 게 나아 보여요.', '용어와 화면을 훨씬 쉽게 바꿔야 저 같은 사람도 쓸 수 있어요.'],
      skeptical: ['결과의 근거를 보여주세요. 어떤 원리로 이 결과가 나왔는지요.'],
    },
    userQuestion: {
      positive: ['제 데이터는 어디에 저장되고, 서비스가 없어지면 어떻게 되나요?', '{feature}는 구체적으로 어떻게 동작하나요?'],
      neutral: ['{competitor}랑 비교하면 뭐가 제일 다른가요?', '하루에 얼마나 시간을 써야 효과를 보나요?'],
      negative: ['이거 꼭 앱을 깔아야 하나요? 그냥 웹에서 되면 안 돼요?', '무료로는 어디까지 쓸 수 있나요?'],
      skeptical: ['실제로 효과 봤다는 사용자가 있나요? 사례를 보여줄 수 있나요?', '몇 달 뒤에 서비스 접는 거 아니에요?'],
    },
    oneLiner: {
      positive: ['"딱 내 문제를 건드리는 서비스. 완성도만 받쳐주면 쓸 것 같다."', '"기대되는 물건. 첫 경험에서 실망만 안 시키면 된다."'],
      neutral: ['"방향은 맞는데, 갈아탈 결정타가 아직 없다."', '"나쁘지 않지만 없어도 사는 데 지장 없는 서비스."'],
      negative: ['"나를 위한 서비스는 아닌 것 같다."', '"아이디어는 알겠는데 내 돈과 시간을 쓸 정도는 아니다."'],
      skeptical: ['"증명되기 전까지는 못 믿겠다. 증명되면 그때 보겠다."', '"말은 좋다. 그런데 세상에 말 좋은 서비스는 많았다."'],
    },
  };

  const OPINION_LABELS = {
    firstImpression: '첫인상', likeMost: '가장 마음에 드는 부분', mostNeeded: '가장 필요한 기능',
    hardToUnderstand: '이해하기 어려운 부분', unnecessary: '불필요해 보이는 부분',
    whyNotUse: '사용하지 않을 이유', whyNotPay: '결제하지 않을 이유',
    improvement: '개선 요청', userQuestion: '묻고 싶은 질문', oneLiner: '한 줄 평가',
  };

  function fill(tpl, ctx) {
    return tpl
      .replace(/\{name\}/g, ctx.name)
      .replace(/\{feature\}/g, ctx.feature)
      .replace(/\{price\}/g, ctx.price)
      .replace(/\{competitor\}/g, ctx.competitor)
      .replace(/\{current\}/g, ctx.current)
      .replace(/\{value\}/g, ctx.value)
      .replace(/\{problem\}/g, ctx.problem);
  }

  /** 항목별 성향 결정: 전체 성향 기반이되 항목 점수에 따라 조정 */
  function toneFor(category, evaluation, persona) {
    const s = evaluation.scores;
    const base = evaluation.sentiment;
    if (category === 'whyNotPay' && s.payment < 35) return persona.archetype === 'skeptic' ? 'skeptical' : 'negative';
    if (category === 'whyNotUse' && s.firstUse < 35) return persona.archetype === 'skeptic' ? 'skeptical' : 'negative';
    if (category === 'hardToUnderstand' && s.usability < 45) return 'negative';
    if (category === 'likeMost' && s.empathy >= 65 && base !== 'skeptical') return 'positive';
    return base;
  }

  /**
   * 페르소나 1명의 의견 10종 생성
   */
  function generateOpinions(persona, evaluation, profile, input, rng) {
    const ctx = {
      name: input.name || '이 서비스',
      feature: profile.features.length ? persona.expectedFeature || profile.features[0] : '핵심 기능',
      price: profile.price.tier === 4 ? '(가격 미정)' : profile.price.label,
      competitor: profile.hasCompetitors ? profile.competitors.split(/[,、\n]/)[0].trim() : '기존 방법',
      current: persona.currentSolution,
      value: persona.coreValue.label,
      problem: (input.problem || '이 문제').split(/[.\n]/)[0].slice(0, 40),
    };
    const opinions = {};
    for (const cat in T) {
      const tone = toneFor(cat, evaluation, persona);
      const bank = T[cat][tone] || T[cat].neutral;
      opinions[cat] = fill(rng.pick(bank), ctx);
    }
    return opinions;
  }

  MVPV.generateOpinions = generateOpinions;
  MVPV.OPINION_LABELS = OPINION_LABELS;
})(window);
