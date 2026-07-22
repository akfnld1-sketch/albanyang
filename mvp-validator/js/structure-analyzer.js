/**
 * structure-analyzer.js — 확보된 HTML 스냅샷의 정적 구조 분석 (1단계: 구조 분석)
 * DOMParser 기반 — 서버·외부 API 불필요, 전부 브라우저 로컬.
 * 분석 대상: 제목/설명/H1, 메뉴, 버튼·CTA, 입력폼, 가격, 가입/로그인, 모바일·접근성 휴리스틱,
 *           첫 화면 목적 이해도(purposeClarity), 기능 후보, 미분석 영역(warnings).
 * 주의: JS 실행 없이 정적 HTML만 분석하므로 SPA 셸·로그인 뒤 화면은 분석 불가 — warnings로 명시.
 */
(function (global) {
  'use strict';
  const MVPV = global.MVPV = global.MVPV || {};
  const clamp01 = MVPV.clamp01;

  const CTA_KEYWORDS = {
    signup: /가입|회원가입|sign\s*up|register|시작하기|무료로 시작|체험|join|get started/i,
    login: /로그인|log\s*in|sign\s*in/i,
    buy: /구매|결제|구독|주문|업그레이드|buy|subscribe|checkout|pricing|요금/i,
  };
  const GENERIC_TITLES = /^(home|index|untitled|main|홈|메인|제목 없음|document|react app|vite app)$/i;

  function txt(el) { return (el && el.textContent || '').replace(/\s+/g, ' ').trim(); }

  function classifyCta(label) {
    if (CTA_KEYWORDS.signup.test(label)) return 'signup';
    if (CTA_KEYWORDS.login.test(label)) return 'login';
    if (CTA_KEYWORDS.buy.test(label)) return 'buy';
    return 'other';
  }

  function analyzePage(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const meta = name => {
      const el = doc.querySelector('meta[name="' + name + '"], meta[property="og:' + name + '"]');
      return el ? (el.getAttribute('content') || '').trim() : '';
    };

    const title = txt(doc.querySelector('title')) || meta('title');
    const description = meta('description');
    const h1 = txt(doc.querySelector('h1'));

    // 메뉴: nav 우선, 없으면 header 링크
    const navLinks = Array.from(doc.querySelectorAll('nav a, [role="navigation"] a'));
    const headerLinks = navLinks.length ? [] : Array.from(doc.querySelectorAll('header a'));
    const menuSet = [];
    for (const a of navLinks.concat(headerLinks)) {
      const t = txt(a);
      if (t && t.length <= 20 && !menuSet.includes(t)) menuSet.push(t);
      if (menuSet.length >= 15) break;
    }

    // 버튼·CTA
    const ctaEls = Array.from(doc.querySelectorAll(
      'button, input[type="submit"], input[type="button"], a[class*="btn" i], a[class*="button" i], a[class*="cta" i], [role="button"]'));
    const ctas = [];
    for (const el of ctaEls) {
      const label = txt(el) || el.getAttribute('value') || el.getAttribute('aria-label') || '';
      if (!label || label.length > 40) continue;
      if (ctas.some(c => c.label === label)) continue;
      ctas.push({ label, kind: classifyCta(label) });
      if (ctas.length >= 25) break;
    }

    // 입력폼
    const forms = Array.from(doc.querySelectorAll('form')).map(f => {
      const fields = Array.from(f.querySelectorAll('input:not([type=hidden]):not([type=submit]):not([type=button]), select, textarea'));
      return {
        fields: fields.length,
        requiredCount: fields.filter(el => el.required || el.getAttribute('aria-required') === 'true').length,
        hasPassword: !!f.querySelector('input[type=password]'),
        hasEmail: !!f.querySelector('input[type=email], input[name*="email" i]'),
      };
    }).filter(f => f.fields > 0);
    // form 태그 없이 흩어진 입력 필드 (SPA 흔한 패턴)
    const looseInputs = doc.querySelectorAll('input:not([type=hidden]):not([type=submit]):not([type=button]):not(form input)').length;
    if (looseInputs > 0) forms.push({ fields: looseInputs, requiredCount: 0, hasPassword: !!doc.querySelector('input[type=password]:not(form input)'), hasEmail: false, loose: true });

    // 가격: 본문 텍스트에서 가격 스니펫 탐색 → 기존 parsePrice 재사용
    const bodyText = txt(doc.body).slice(0, 30000);
    let priceInfo = { found: false, tier: 4, label: '' };
    const priceMatch = bodyText.match(/(월|연|년)?\s*[₩$]?\s*[\d,]{3,}\s*(원|₩|\/\s*(월|month))|\$\s*\d+(\.\d+)?|무료(?:\s*체험|로 시작)?/);
    if (priceMatch) {
      const parsed = MVPV.parsePrice(priceMatch[0]);
      priceInfo = { found: parsed.tier !== 4, tier: parsed.tier, label: priceMatch[0].trim() };
    }

    // 가입·로그인
    const allText = bodyText + ' ' + ctas.map(c => c.label).join(' ');
    const auth = {
      hasSignup: CTA_KEYWORDS.signup.test(allText),
      hasLogin: CTA_KEYWORDS.login.test(allText),
      socialLogin: /구글로|google로|카카오|kakao|네이버로|naver로|apple로/i.test(allText),
    };

    // 모바일·접근성 휴리스틱
    const mobile = {
      hasViewport: !!doc.querySelector('meta[name="viewport"]'),
      mediaQueryHint: Array.from(doc.querySelectorAll('style')).some(s => s.textContent.indexOf('@media') !== -1),
    };
    const imgs = doc.querySelectorAll('img');
    const inputs = doc.querySelectorAll('input:not([type=hidden]), select, textarea');
    let labeled = 0;
    inputs.forEach(el => {
      if (el.getAttribute('aria-label') || el.getAttribute('placeholder') ||
        (el.id && doc.querySelector('label[for="' + el.id + '"]'))) labeled++;
    });
    const h1Count = doc.querySelectorAll('h1').length;
    const a11y = {
      altRatio: imgs.length ? Array.from(imgs).filter(i => (i.getAttribute('alt') || '').trim()).length / imgs.length : 1,
      labelRatio: inputs.length ? labeled / inputs.length : 1,
      headingOk: h1Count === 1,
      langSet: !!doc.documentElement.getAttribute('lang'),
    };

    // SPA 셸 감지: 본문 텍스트가 거의 없고 스크립트만 있는 경우
    const spaShell = bodyText.length < 200 && doc.querySelectorAll('script[src]').length > 0;

    // 기능 후보: 메뉴 + h2/h3 제목
    const featureCandidates = [];
    for (const t of menuSet.concat(Array.from(doc.querySelectorAll('h2, h3')).map(txt))) {
      if (t && t.length >= 2 && t.length <= 30 && !featureCandidates.includes(t) &&
        !CTA_KEYWORDS.login.test(t) && !/문의|contact|faq|약관|정책/i.test(t)) {
        featureCandidates.push(t);
      }
      if (featureCandidates.length >= 8) break;
    }

    return { title, description, h1, menus: menuSet, ctas, forms, priceInfo, auth, mobile, a11y, spaShell, bodyTextLen: bodyText.length, featureCandidates };
  }

  /** 첫 화면 목적 이해도 0~1 */
  function computePurposeClarity(p) {
    let score = 0;
    if (p.title && p.title.length >= 4 && !GENERIC_TITLES.test(p.title)) score += 0.28;
    if (p.description && p.description.length >= 15) score += 0.27;
    if (p.h1 && p.h1.length >= 4) score += 0.25;
    if (p.bodyTextLen >= 300) score += 0.1;
    if (p.ctas.length >= 1 && p.ctas.length <= 6) score += 0.1;
    if (p.spaShell) score = Math.min(score, 0.25); // 정적 HTML에 내용이 없으면 판단 불가에 가까움
    return clamp01(score);
  }

  /**
   * 스냅샷 전체 분석 → SiteStructure
   * @param {object} snapshot {url, source, pages:[{name, html}]}
   */
  function analyzeSite(snapshot) {
    if (!snapshot || !snapshot.pages || !snapshot.pages.length) return null;
    const pageResults = snapshot.pages.map(pg => ({ name: pg.name, ...analyzePage(pg.html) }));
    const main = pageResults[0];

    // 다중 페이지 병합: CTA·폼·기능 후보는 합산(중복 제거)
    const merged = { ...main };
    for (const pr of pageResults.slice(1)) {
      for (const c of pr.ctas) if (!merged.ctas.some(x => x.label === c.label)) merged.ctas.push(c);
      merged.forms = merged.forms.concat(pr.forms);
      for (const f of pr.featureCandidates) if (!merged.featureCandidates.includes(f)) merged.featureCandidates.push(f);
      if (!merged.priceInfo.found && pr.priceInfo.found) merged.priceInfo = pr.priceInfo;
      merged.auth = {
        hasSignup: merged.auth.hasSignup || pr.auth.hasSignup,
        hasLogin: merged.auth.hasLogin || pr.auth.hasLogin,
        socialLogin: merged.auth.socialLogin || pr.auth.socialLogin,
      };
    }
    merged.featureCandidates = merged.featureCandidates.slice(0, 8);

    const totalFields = merged.forms.reduce((s, f) => s + f.fields, 0);
    merged.purposeClarity = computePurposeClarity(main);
    merged.interactionComplexity = clamp01(0.1 + merged.ctas.length * 0.03 + totalFields * 0.05 + merged.menus.length * 0.02);
    merged.totalFields = totalFields;
    merged.pageCount = pageResults.length;
    merged.url = snapshot.url || '';
    merged.source = snapshot.source;

    // 미분석 영역 (정직성 원칙)
    const warnings = [];
    if (main.spaShell) warnings.push('이 페이지는 JS 렌더링(SPA) 구조로 보입니다. 정적 HTML에는 실제 화면 내용이 거의 없어 구조 분석이 제한적입니다. 브라우저에서 화면을 연 뒤 DevTools로 렌더링된 HTML을 복사해 붙여넣으면 정확도가 올라갑니다.');
    if (merged.auth.hasLogin) warnings.push('로그인 뒤 화면은 이 분석에 포함되지 않았습니다. 로그인 후 페이지를 저장(.html)해 추가 업로드하면 분석 범위가 넓어집니다.');
    if (snapshot.pages.length === 1) warnings.push('첫 페이지 1장만 분석되었습니다. 핵심 기능 페이지를 추가 업로드하면 사용 흐름 추정이 정교해집니다.');
    if (!merged.priceInfo.found) warnings.push('페이지에서 가격 정보를 찾지 못했습니다. 결제 관련 평가는 입력된 가격 정보에 의존합니다.');
    merged.warnings = warnings;

    return merged;
  }

  MVPV.analyzeSite = analyzeSite;
})(window);
