/**
 * app.js — MVP URL 기반 가상검증 시스템 화면 흐름·상태 관리
 * STEP1 URL 입력 → STEP2 정보 확인·보완 → STEP3 타깃 → STEP4 인원/모드
 * → STEP5~7 시뮬레이션(페르소나 생성·구조 검증·여정) → 결과 → STEP8 보고서
 * localStorage: mvpv_* 프리픽스만 사용 (다른 앱 데이터 절대 미접근)
 */
(function (global) {
  'use strict';
  const MVPV = global.MVPV;
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));

  const LS_DRAFT = 'mvpv_draft';

  const state = {
    step: 'url',
    input: {},
    count: 5,
    useAi: false,
    aiSupported: false,
    seedOffset: 0,
    snapshot: null,   // {url, source:'fetch'|'paste'|'upload', pages:[{name,html}]}
    structure: null,  // SiteStructure | null
    results: null,
    agg: null,
    report: null,
    profile: null,
    mode: 'standard',
  };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── 스텝 전환 (8단계 스텝바) ──
  const STEP_LABELS = {
    url: 'STEP 1 · MVP URL 입력', 1: 'STEP 2 · MVP 정보 확인·보완', 2: 'STEP 3 · 타깃 고객 설정',
    3: 'STEP 4 · 검증 인원 선택', 4: 'STEP 5~7 · 가상 검증 진행', 6: '결과 분석 (STEP 6~7)',
    7: 'STEP 8 · 검증 보고서',
  };
  const STEP_FILL = { url: 1, 1: 2, 2: 3, 3: 4, 4: 6, 6: 7, 7: 8 };

  function showStep(n) {
    state.step = n;
    $$('.screen').forEach(el => el.classList.add('hidden'));
    const scr = $('#screen-' + n);
    if (scr) scr.classList.remove('hidden');
    const on = STEP_FILL[n] || 1;
    $$('.stepbar .seg').forEach((seg, i) => seg.classList.toggle('on', i < on));
    $('#step-label').textContent = STEP_LABELS[n] || '';
    window.scrollTo(0, 0);
  }

  // ── STEP 1: URL 확보 ──
  function setUrlStatus(html, kind) {
    const el = $('#url-status');
    el.className = 'url-status ' + (kind || '');
    el.innerHTML = html;
    el.classList.remove('hidden');
  }

  function showManualZone(show) {
    $('#manual-zone').classList.toggle('hidden', !show);
    if (show) $('#advanced-zone').open = true;
  }

  async function handleFetch() {
    const raw = $('#f-url').value;
    const url = MVPV.urlFetcher.normalizeUrl(raw);
    if (!url) {
      setUrlStatus('⚠️ 올바른 URL 형식이 아닙니다. 예: https://example-mvp.com', 'warn');
      return;
    }
    $('#f-url').value = url;
    $('#btn-fetch').disabled = true;
    // 수집 체인: ① 직접 fetch → ② 프록시 fetch → ③ 수동 안내
    const res = await MVPV.urlFetcher.acquire(url, (stage) => {
      if (stage === 'direct') setUrlStatus('⏳ 1/2 직접 수집 시도 중… (최대 8초)', '');
      if (stage === 'proxy') setUrlStatus('⏳ 2/2 프록시 경유 수집 시도 중… (최대 12초)', '');
    });
    $('#btn-fetch').disabled = false;
    if (res.ok) {
      applySnapshot({ url, source: res.source, pages: [{ name: '첫 페이지', html: res.html }] });
      if (res.truncated) setUrlStatus($('#url-status').innerHTML + '<br>ℹ️ 페이지가 커서 앞부분 2MB만 수집되었습니다.', 'ok');
    } else {
      const dGuide = MVPV.urlFetcher.ERROR_GUIDE[res.direct.error] || '실패';
      const pGuide = res.proxy.error === 'proxy-http'
        ? '프록시가 수집을 거부했습니다' + (res.proxy.detail ? ' — ' + res.proxy.detail : '') + ' (HTTP ' + res.proxy.status + ')'
        : (MVPV.urlFetcher.ERROR_GUIDE[res.proxy.error] || '실패');
      setUrlStatus(
        '❌ <b>자동 수집 실패</b><br>· 직접 수집: ' + esc(dGuide) + '<br>· 프록시 수집: ' + esc(pGuide) +
        '<br>아래 <b>고급 설정</b>에서 프록시를 연결하거나, 소스 붙여넣기/파일 업로드를 이용해 주세요. 화면 분석 없이 진행할 수도 있습니다.',
        'warn');
      showManualZone(true);
      $('#iframe-zone').classList.remove('hidden');
    }
  }

  function applySnapshot(snapshot) {
    state.snapshot = snapshot;
    const structure = MVPV.analyzeSite(snapshot);
    state.structure = structure;
    if (!structure) {
      setUrlStatus('⚠️ HTML을 해석하지 못했습니다. 내용을 확인해 주세요.', 'warn');
      return;
    }
    const srcLabel = { fetch: '직접 자동 수집', proxy: '프록시 자동 수집', paste: '소스 붙여넣기', upload: '파일 업로드' }[snapshot.source];
    setUrlStatus(
      '✅ <b>화면 구조 확보 완료</b> (' + srcLabel + ' · ' + structure.pageCount + '개 페이지)<br>' +
      '제목: ' + esc(structure.title || '(없음)') + ' · 메뉴 ' + structure.menus.length + '개 · CTA ' + structure.ctas.length +
      '개 · 입력 필드 ' + structure.totalFields + '개' +
      (structure.priceInfo.found ? ' · 가격 발견(' + esc(structure.priceInfo.label) + ')' : ' · 가격 미발견'),
      'ok');
    prefillFromStructure(structure);
  }

  function prefillFromStructure(s) {
    const setIfEmpty = (id, v) => { const el = $('#' + id); if (el && !el.value.trim() && v) el.value = v; };
    setIfEmpty('f-name', s.title);
    setIfEmpty('f-tagline', s.description || s.h1);
    setIfEmpty('f-coreFeatures', s.featureCandidates.join(', '));
    if (s.priceInfo.found) setIfEmpty('f-price', s.priceInfo.label);
  }

  function bindUrlScreen() {
    $('#btn-fetch').addEventListener('click', handleFetch);
    $('#btn-paste-analyze').addEventListener('click', () => {
      const html = $('#f-paste').value.trim();
      if (html.length < 50) { setUrlStatus('⚠️ 붙여넣은 내용이 너무 짧습니다. 페이지 전체 소스를 붙여넣어 주세요.', 'warn'); return; }
      const url = MVPV.urlFetcher.normalizeUrl($('#f-url').value) || '';
      applySnapshot({ url, source: 'paste', pages: [{ name: '붙여넣은 페이지', html }] });
    });
    $('#f-files').addEventListener('change', async (e) => {
      const pages = await MVPV.urlFetcher.readFiles(e.target.files);
      if (!pages.length) { setUrlStatus('⚠️ 읽을 수 있는 HTML 파일이 없습니다.', 'warn'); return; }
      const url = MVPV.urlFetcher.normalizeUrl($('#f-url').value) || '';
      applySnapshot({ url, source: 'upload', pages });
    });
    $('#btn-iframe-preview').addEventListener('click', () => {
      const url = MVPV.urlFetcher.normalizeUrl($('#f-url').value);
      if (!url) return;
      const frame = $('#preview-frame');
      frame.src = url;
      frame.classList.remove('hidden');
      $('#iframe-note').classList.remove('hidden');
    });
    // 프록시 설정 — 개발자용 (기본 프록시는 코드에 내장, 여기서 일시 오버라이드)
    const proxyInput = $('#f-proxy');
    const uf = MVPV.urlFetcher;
    proxyInput.value = uf.getProxyOverride(); // 오버라이드만 표시 (기본값은 비워둠)
    const refreshProxyBadge = () => {
      const override = uf.getProxyOverride();
      const effective = uf.getProxyUrl();
      let msg;
      if (override) msg = '🛠️ 개발자 오버라이드 사용 중: ' + override;
      else if (uf.hasBuiltinProxy()) msg = '✅ 기본 프록시 내장됨 — 일반 사용자는 URL만 입력하면 자동 수집됩니다';
      else msg = '⚪ 기본 프록시가 아직 배포되지 않았습니다 (url-fetcher.js의 DEFAULT_PROXY 교체 · proxy/README.md 참고)';
      $('#proxy-state').textContent = msg;
    };
    refreshProxyBadge();
    $('#btn-proxy-save').addEventListener('click', () => {
      uf.setProxyUrl(proxyInput.value);
      proxyInput.value = uf.getProxyOverride();
      refreshProxyBadge();
    });
    $('#btn-proxy-reset').addEventListener('click', () => {
      uf.setProxyUrl('');
      proxyInput.value = '';
      refreshProxyBadge();
    });
    $('#btn-url-next').addEventListener('click', () => showStep(1));
    $('#btn-skip-url').addEventListener('click', () => {
      state.snapshot = null; state.structure = null;
      showStep(1);
    });
  }

  // ── STEP 2/3: 입력 수집 ──
  const FIELDS = ['name', 'tagline', 'problem', 'coreFeatures', 'userFlow', 'price',
    'competitors', 'stage', 'keyQuestion', 'extraNotes', 'targetUsers'];

  function collectInput() {
    const input = {};
    for (const f of FIELDS) {
      const el = $('#f-' + f);
      if (el) input[f] = el.value.trim();
    }
    const chips = $$('#target-chips .chip.on').map(c => c.dataset.v);
    if (chips.length) {
      input.targetUsers = (input.targetUsers ? input.targetUsers + ' ' : '') + chips.join(' ');
    }
    state.input = input;
    try { localStorage.setItem(LS_DRAFT, JSON.stringify(input)); } catch (e) {}
    return input;
  }

  function restoreDraft() {
    try {
      const raw = localStorage.getItem(LS_DRAFT);
      if (!raw) return;
      const d = JSON.parse(raw);
      for (const f of FIELDS) {
        const el = $('#f-' + f);
        if (el && d[f]) el.value = d[f];
      }
    } catch (e) {}
  }

  // ── STEP 4: 인원/모드 ──
  function bindCountCards() {
    $$('.count-card').forEach(card => {
      card.addEventListener('click', () => {
        $$('.count-card').forEach(c => c.classList.remove('on'));
        card.classList.add('on');
        state.count = parseInt(card.dataset.n, 10);
      });
    });
  }

  async function detectAi() {
    try { state.aiSupported = await MVPV.ai.isSupported(); }
    catch (e) { state.aiSupported = false; }
    const aiBox = $('#mode-ai');
    if (!state.aiSupported) {
      aiBox.classList.add('disabled');
      aiBox.querySelector('.m-desc').textContent = '이 기기는 WebGPU를 지원하지 않아 사용할 수 없습니다. 로컬 표준 검증 모드로 진행됩니다.';
    }
  }

  function bindModeBoxes() {
    $('#mode-standard').addEventListener('click', () => setMode('standard'));
    $('#mode-ai').addEventListener('click', () => { if (state.aiSupported) setMode('ai'); });
  }

  function setMode(m) {
    state.useAi = (m === 'ai');
    $('#mode-standard').classList.toggle('on', m === 'standard');
    $('#mode-ai').classList.toggle('on', m === 'ai');
  }

  // ── 시뮬레이션 파이프라인 ──
  function setProgress(pct, text, emoji) {
    $('#progress-fill').style.width = pct + '%';
    $('#progress-pct').textContent = pct + '%';
    if (text) $('#progress-text').textContent = text + ' ' + pct + '%';
    if (emoji) $('#progress-emoji').textContent = emoji;
  }

  function nextTick(ms) { return new Promise(r => setTimeout(r, ms || 30)); }

  async function runValidation() {
    collectInput();
    showStep(4);
    const input = state.input;
    const structure = state.structure;

    setProgress(6, '사이트 구조 분석 중', '🧩');
    await nextTick(350);

    // 1) 입력 파싱 (+ 구조에서 발견한 가격을 입력 공백 시 반영)
    const profile = MVPV.parseMvp(input);
    if (!input.price && structure && structure.priceInfo.found) {
      profile.price = MVPV.parsePrice(structure.priceInfo.label);
    }
    // 구조 확보 시 복잡도는 실제 화면 지표를 우선
    if (structure) profile.complexity = structure.interactionComplexity;
    state.profile = profile;
    setProgress(15, '사이트 구조 분석 중', '🧩');
    await nextTick(300);

    // 2) 페르소나 생성 (결정적 시드: 입력 + URL/스냅샷 크기 + 오프셋)
    const snapLen = state.snapshot ? state.snapshot.pages.reduce((s, p) => s + p.html.length, 0) : 0;
    const seedInput = { ...input, __url: state.snapshot ? state.snapshot.url : '', __snap: snapLen };
    setProgress(24, '가상 사용자 생성 중', '🧑‍🤝‍🧑');
    const { personas } = MVPV.generatePersonas(seedInput, profile, state.count, state.seedOffset);
    setProgress(32, '가상 사용자 생성 중', '🧑‍🤝‍🧑');
    await nextTick(350);

    // 3) 평가 + 여정 시뮬레이션 + 의견 (100명은 청크 처리)
    const seedBase = JSON.stringify(seedInput) + '|s=' + state.seedOffset;
    const results = [];
    const chunk = state.count >= 100 ? 20 : state.count;
    for (let i = 0; i < personas.length; i++) {
      const p = personas[i];
      const rng = new MVPV.Rng(seedBase + '|eval|' + p.id);
      const evaluation = MVPV.evaluate(p, profile, rng);
      const rngJ = new MVPV.Rng(seedBase + '|journey|' + p.id);
      const journey = MVPV.simulateJourney(p, structure, profile, rngJ);
      // 여정에서 발견한 마찰을 근거 파이프라인에 합류 → 개선 TOP5·통계에 자동 반영
      for (const f of journey.frictions) {
        evaluation.reasons.push({ key: f.key, dir: -1, text: f.text });
      }
      const r = { persona: p, evaluation, journey, opinions: null };
      if (p.detailed) {
        r.opinions = MVPV.generateOpinions(p, evaluation, profile, input, rng);
      }
      results.push(r);
      if ((i + 1) % chunk === 0) {
        setProgress(32 + Math.round(((i + 1) / personas.length) * 26), '사용 여정 시뮬레이션 중', '🧭');
        await nextTick(40);
      }
    }
    setProgress(58, '사용 여정 시뮬레이션 중', '🧭');
    await nextTick(300);

    // 100명 모드: 대표 페르소나 상세 의견 생성
    if (state.count >= 100) {
      const reps = MVPV.pickRepresentatives(results, 8);
      for (const r of reps) {
        const rng = new MVPV.Rng(seedBase + '|rep|' + r.persona.id);
        r.persona.detailed = true;
        r.persona.expectedFeature = profile.features.length ? rng.pick(profile.features) : '핵심 기능';
        r.opinions = MVPV.generateOpinions(r.persona, r.evaluation, profile, input, rng);
        r.isRepresentative = true;
      }
    }

    // 4) 집계
    setProgress(72, '결과 집계 중', '📊');
    await nextTick(300);
    const agg = MVPV.aggregate(results, profile);
    setProgress(82, '결과 집계 중', '📊');
    await nextTick(250);

    // 5) 보고서
    setProgress(90, '최종 보고서 작성 중', '📝');
    const report = MVPV.buildReport(agg, profile, input, results);
    await nextTick(250);

    state.mode = 'standard';
    // 6) AI 심층 모드 (옵트인)
    if (state.useAi && state.aiSupported) {
      try {
        setProgress(92, 'AI 모델 준비 중 (최초 1회 다운로드)', '🤖');
        await MVPV.ai.load((pct, txt) => {
          setProgress(92, 'AI 모델 로딩 ' + pct + '% — ' + (txt || '').slice(0, 40), '🤖');
        });
        const targets = results.filter(r => r.opinions).slice(0, 8);
        for (let i = 0; i < targets.length; i++) {
          setProgress(93 + Math.round((i / targets.length) * 5), 'AI 사용자 의견 생성 중', '🤖');
          targets[i].opinions = await MVPV.ai.rewriteOpinions(targets[i], input);
        }
        state.mode = 'ai';
      } catch (e) {
        state.mode = 'standard';
      }
    }

    setProgress(100, '검증 완료', '✅');
    await nextTick(400);

    state.results = results;
    state.agg = agg;
    state.report = report;
    renderResults();
    showStep(6);
  }

  // ── 결과 렌더링 ──
  function barClass(v) { return v >= 60 ? 'sf-good' : v >= 40 ? 'sf-mid' : 'sf-bad'; }

  function scoreRows(scores, labels) {
    return Object.keys(labels).map(k => {
      const v = scores[k];
      if (v == null) return '';
      return '<div class="score-row"><div class="s-label">' + labels[k] + '</div>' +
        '<div class="s-bar"><div class="s-fill ' + barClass(v) + '" style="width:' + v + '%"></div></div>' +
        '<div class="s-num">' + v + '</div></div>';
    }).join('');
  }

  const SENTIMENT_LABEL = { positive: '긍정', neutral: '중립', negative: '부정', skeptical: '회의적' };
  const STEP_ICON = { pass: '✅', friction: '⚠️', drop: '⛔', not_reached: '⬜' };

  function journeyTimeline(journey) {
    return '<div class="journey"><div class="j-title">🧭 사용 여정 추정 (화면 구조 기반 시뮬레이션 — 실제 조작 아님)</div>' +
      journey.steps.map(st =>
        '<div class="jstep jstep-' + st.result + '"><span class="j-ic">' + STEP_ICON[st.result] + '</span>' +
        '<div><div class="j-label">' + esc(st.label) + '</div>' +
        '<div class="j-reason">' + esc(st.reason) + '</div></div></div>').join('') +
      (journey.dropPoint
        ? '<div class="j-drop">⛔ 이탈 예상 지점: <b>' +
          esc((MVPV.JOURNEY_STEPS.find(s => s.key === journey.dropPoint) || {}).label || journey.dropPoint) + '</b></div>'
        : '<div class="j-drop ok">✅ 여정 완주 가능성이 높은 사용자로 추정</div>') +
      '</div>';
  }

  function personaCard(r) {
    const p = r.persona, s = r.evaluation.scores, j = r.journey;
    const head =
      '<div class="persona-head">' +
      '<div class="persona-avatar">' + p.archetypeEmoji + '</div>' +
      '<div><div class="persona-name">' + esc(p.name) + ' <span style="font-weight:400;font-size:12px">(' + p.age + '세 · ' + esc(p.gender) + ')</span></div>' +
      '<div class="persona-meta">' + esc(p.occupation) + ' · ' + esc(p.archetypeLabel) + (r.isRepresentative ? ' · 대표 표본' : '') + '</div></div>' +
      '<span class="sentiment-tag st-' + r.evaluation.sentiment + '">' + SENTIMENT_LABEL[r.evaluation.sentiment] + '</span>' +
      '</div>';

    const mini =
      '<div class="mini-scores">' +
      [['firstImpression', '첫인상'], ['signupIntent', '가입 의향'], ['paymentIntent', '결제 의향']].map(([k, lbl]) =>
        '<span class="mini-score">' + lbl + ' <b>' + j.jScores[k] + '</b></span>').join('') +
      (j.dropPoint ? '<span class="mini-score">⛔ <b>' + esc((MVPV.JOURNEY_STEPS.find(x => x.key === j.dropPoint) || {}).label || '') + '</b></span>' : '') +
      '</div>';

    let body = '<div class="persona-body">';
    body += '<div class="persona-meta" style="margin-bottom:8px">' +
      esc(p.lifestyle) + ' · 소득 ' + esc(p.incomeLevel) + '<br>' +
      '현재 해결: ' + esc(p.currentSolution) + ' · 결정 성향: ' + esc(p.decisionStyle.label) + '<br>' +
      '중시 가치: ' + esc(p.coreValue.label) + '</div>';
    body += journeyTimeline(j);
    body += '<h3 style="font-size:13px;margin-top:12px">📊 여정 기반 점수</h3>' + scoreRows(j.jScores, MVPV.JSCORE_LABELS);
    body += '<h3 style="font-size:13px;margin-top:12px">📊 성향 기반 점수</h3>' + scoreRows(s, MVPV.SCORE_LABELS);
    if (r.opinions) {
      body += '<h3 style="font-size:13px;margin-top:12px">💬 사용자 의견' +
        (r.opinions._aiRewritten ? ' <span class="mode-badge">AI 생성</span>' : '') + '</h3>';
      for (const cat in MVPV.OPINION_LABELS) {
        if (!r.opinions[cat]) continue;
        body += '<div class="op-item"><div class="op-k">' + MVPV.OPINION_LABELS[cat] + '</div>' +
          '<div class="op-v">' + esc(r.opinions[cat]) + '</div></div>';
      }
    }
    if (j.frictions.length) {
      body += '<div class="reason-list"><div style="font-size:12px;font-weight:700;margin-bottom:5px">😖 가장 불편할 것으로 추정되는 부분</div><ul>' +
        j.frictions.slice(0, 4).map(f => '<li>' + esc(f.text) + '</li>').join('') + '</ul></div>';
    }
    if (r.evaluation.reasons.length) {
      body += '<div class="reason-list"><div style="font-size:12px;font-weight:700;margin-bottom:5px">📌 왜 이 점수인가?</div><ul>' +
        r.evaluation.reasons.slice(0, 8).map(x => '<li>' + (x.dir > 0 ? '➕ ' : '➖ ') + esc(x.text) + '</li>').join('') +
        '</ul></div>';
    }
    body += '</div>';

    return '<div class="persona-card" data-pid="' + p.id + '">' + head + mini + body +
      '<div class="toggle-hint">탭하여 상세 보기</div></div>';
  }

  function renderStructureCard() {
    const s = state.structure;
    const box = $('#structure-card');
    if (!s) {
      box.innerHTML = '<h2>🧩 화면 구조 분석</h2><p class="hint">HTML을 확보하지 않아 화면 구조 분석 없이 <b>입력 정보 기반 시뮬레이션</b>으로 진행되었습니다. STEP 1에서 소스 붙여넣기나 파일 업로드를 하면 실제 화면 구조 기반으로 정확도가 올라갑니다.</p>';
      return;
    }
    const yn = v => v ? '✅' : '❌';
    box.innerHTML =
      '<h2>🧩 화면 구조 분석 결과</h2>' +
      '<p class="hint" style="margin-bottom:10px">' + esc(s.url || '(URL 미입력)') + ' · ' +
      ({ fetch: '직접 자동 수집', proxy: '프록시 자동 수집', paste: '소스 붙여넣기', upload: '파일 업로드' }[s.source] || '') + ' · ' + s.pageCount + '개 페이지 정적 분석</p>' +
      '<div class="stat-grid">' +
      '<div class="stat-cell"><div class="v">' + Math.round(s.purposeClarity * 100) + '점</div><div class="k">첫 화면 목적 이해도</div></div>' +
      '<div class="stat-cell"><div class="v">' + s.menus.length + '개</div><div class="k">메뉴 항목</div></div>' +
      '<div class="stat-cell"><div class="v">' + s.ctas.length + '개</div><div class="k">버튼·CTA</div></div>' +
      '<div class="stat-cell"><div class="v">' + s.totalFields + '개</div><div class="k">입력 필드</div></div>' +
      '</div>' +
      '<div class="struct-lines">' +
      '<div>' + yn(s.priceInfo.found) + ' 가격 정보 ' + (s.priceInfo.found ? '발견: ' + esc(s.priceInfo.label) : '미발견') + '</div>' +
      '<div>' + yn(s.auth.hasSignup) + ' 가입 경로 ' + (s.auth.hasSignup ? '있음' : '미발견') + ' · ' + yn(s.auth.hasLogin) + ' 로그인 ' + (s.auth.hasLogin ? '있음' : '미발견') + (s.auth.socialLogin ? ' · 소셜 로그인 감지' : '') + '</div>' +
      '<div>' + yn(s.mobile.hasViewport) + ' 모바일 viewport 설정' + (s.mobile.mediaQueryHint ? ' · 반응형 스타일 흔적' : '') + '</div>' +
      '<div>' + yn(s.a11y.altRatio >= 0.7) + ' 이미지 대체텍스트 ' + Math.round(s.a11y.altRatio * 100) + '% · ' +
      yn(s.a11y.labelRatio >= 0.7) + ' 입력 라벨 ' + Math.round(s.a11y.labelRatio * 100) + '% · ' +
      yn(s.a11y.headingOk) + ' H1 구조 · ' + yn(s.a11y.langSet) + ' lang 속성</div>' +
      (s.ctas.length ? '<div style="margin-top:6px">주요 CTA: ' + s.ctas.slice(0, 6).map(c => '<span class="mini-score">' + esc(c.label) + '</span>').join(' ') + '</div>' : '') +
      '</div>' +
      (s.warnings.length
        ? '<div class="reason-list" style="margin-top:10px"><div style="font-size:12px;font-weight:700;margin-bottom:5px">🚫 미분석 영역 (정직성 안내)</div><ul>' +
          s.warnings.map(w => '<li>' + esc(w) + '</li>').join('') + '</ul></div>'
        : '');
  }

  function renderResults() {
    const agg = state.agg, report = state.report;
    const modeLabel = state.mode === 'ai' ? '🤖 AI 심층 검증 모드' : '🧮 로컬 표준 검증 모드';
    $('#result-mode-badge').textContent = modeLabel;
    $('#result-n').textContent = '가상 사용자 ' + agg.n + '명 시뮬레이션';
    $('#analysis-badge').textContent = state.structure
      ? '🧩 화면 구조 기반 사용 시뮬레이션'
      : '✍️ 입력 정보 기반 시뮬레이션 (화면 미분석)';

    const confEl = $('#conf-warning');
    if (agg.confidenceLevel === 'low') {
      confEl.classList.remove('hidden');
      confEl.textContent = '⚠️ 검증 신뢰도 낮음 (' + agg.confidence + '점) — 입력되지 않은 항목이 ' +
        state.profile.missingFields.length + '개라 결과 해석에 주의가 필요합니다.';
    } else if (agg.confidenceLevel === 'mid') {
      confEl.classList.remove('hidden');
      confEl.textContent = 'ℹ️ 검증 신뢰도 보통 (' + agg.confidence + '점) — 입력을 보강하면 더 정밀한 결과를 얻을 수 있습니다.';
    } else {
      confEl.classList.add('hidden');
    }

    $('#overall-num').textContent = agg.overall;
    const v = report.verdict;
    const pill = $('#verdict-pill');
    pill.textContent = v.emoji + ' ' + v.label;
    pill.className = 'verdict-pill v-' + report.verdictKey;
    $('#verdict-desc').textContent = v.desc;

    renderStructureCard();

    // 여정 기반 평균 + 성향 기반 평균
    let scoresHtml = '';
    if (agg.journey) {
      scoresHtml += '<h3 style="margin-top:0">🧭 여정 기반 지표</h3>' + scoreRows(agg.journey.means, MVPV.JSCORE_LABELS);
      scoresHtml += '<h3>🎯 성향 기반 지표</h3>';
    }
    scoresHtml += scoreRows(agg.means, MVPV.SCORE_LABELS);
    $('#main-scores').innerHTML = scoresHtml;
    $('#churn-conf').innerHTML =
      '<div class="stat-cell"><div class="v">' + agg.churnRate + '%</div><div class="k">예상 이탈률</div></div>' +
      '<div class="stat-cell"><div class="v">' + agg.confidence + '점</div><div class="k">검증 신뢰도</div></div>';

    // 여정 통계
    const jBox = $('#journey-stats');
    if (agg.journey) {
      jBox.classList.remove('hidden');
      const J = agg.journey;
      $('#journey-grid').innerHTML =
        '<div class="stat-cell"><div class="v">' + J.findRate + '%</div><div class="k">핵심 기능 발견률(추정)</div></div>' +
        '<div class="stat-cell"><div class="v">' + J.signupRate + '%</div><div class="k">가입 예상률</div></div>' +
        '<div class="stat-cell"><div class="v">' + J.retentionRate + '%</div><div class="k">지속 사용 예상률</div></div>' +
        '<div class="stat-cell"><div class="v">' + J.paymentRate + '%</div><div class="k">결제 예상률</div></div>';
      $('#journey-drop').innerHTML =
        '<div class="report-item"><div class="r-k">주요 이탈 지점</div><div class="r-v">' + esc(report.dropText || '') + '</div></div>' +
        '<div class="report-item"><div class="r-k">가장 많이 발생할 것으로 추정되는 불편</div><div class="r-v">' + esc(report.frictionText || '') + '</div></div>';
    } else {
      jBox.classList.add('hidden');
    }

    $('#sentiment-grid').innerHTML = Object.keys(SENTIMENT_LABEL).map(k =>
      '<div class="stat-cell"><div class="v">' + agg.sentimentCount[k] + '명</div><div class="k">' +
      SENTIMENT_LABEL[k] + ' 반응</div></div>').join('');

    const bulkEl = $('#bulk-stats');
    if (agg.bulk) {
      bulkEl.classList.remove('hidden');
      $('#bulk-grid').innerHTML =
        '<div class="stat-cell"><div class="v">' + agg.bulk.activeUsers + '명</div><div class="k">적극 사용 예상</div></div>' +
        '<div class="stat-cell"><div class="v">' + agg.bulk.considering + '명</div><div class="k">사용 고려</div></div>' +
        '<div class="stat-cell"><div class="v">' + agg.bulk.nonUsers + '명</div><div class="k">사용 안 할 예상</div></div>' +
        '<div class="stat-cell"><div class="v">' + agg.bulk.payers + '명</div><div class="k">결제 의향 예상</div></div>';
      $('#bulk-opinions').innerHTML =
        '<div class="report-item"><div class="r-k">가장 많이 나온 긍정 신호</div><div class="r-v">' +
        esc(agg.bulk.topPositiveOpinion ? agg.bulk.topPositiveOpinion.text + ' (' + agg.bulk.topPositiveOpinion.count + '명)' : '집계된 긍정 신호 없음') + '</div></div>' +
        '<div class="report-item"><div class="r-k">가장 많이 나온 부정 신호</div><div class="r-v">' +
        esc(agg.bulk.topNegativeOpinion ? agg.bulk.topNegativeOpinion.text + ' (' + agg.bulk.topNegativeOpinion.count + '명)' : '집계된 부정 신호 없음') + '</div></div>' +
        '<div class="report-item"><div class="r-k">기대가 집중된 기능</div><div class="r-v">' + esc(agg.bulk.topRequestedFeature) + '</div></div>' +
        '<div class="report-item"><div class="r-k">가장 큰 이탈 원인</div><div class="r-v">' +
        esc(agg.bulk.topChurnCause ? agg.bulk.topChurnCause.text + ' (' + agg.bulk.topChurnCause.count + '명)' : '집계 없음') + '</div></div>';
    } else {
      bulkEl.classList.add('hidden');
    }

    const listEl = $('#persona-list');
    const detailed = state.results.filter(r => r.opinions);
    const brief = state.results.filter(r => !r.opinions);
    let html = detailed.map(personaCard).join('');
    if (brief.length) {
      html += '<p class="hint" style="margin-top:6px">나머지 ' + brief.length +
        '명은 경량 페르소나로 전체 통계에만 반영되었습니다. (대표 표본 ' + detailed.length + '명 상세 분석)</p>';
    }
    listEl.innerHTML = html;
    $$('#persona-list .persona-card').forEach(card => {
      card.addEventListener('click', () => card.classList.toggle('open'));
    });

    $('#segment-list').innerHTML = agg.segmentDefs.map(seg => {
      const members = agg.segments[seg.key];
      if (!members.length) return '';
      const names = members.slice(0, 6).map(r => r.persona.name + '(' + r.persona.age + ')').join(', ') +
        (members.length > 6 ? ' 외 ' + (members.length - 6) + '명' : '');
      return '<div class="seg-block"><div class="seg-title">' + seg.emoji + ' ' + seg.label +
        ' <span class="seg-count">' + members.length + '명</span></div>' +
        '<div class="seg-why">' + seg.why + '</div>' +
        '<div class="seg-names">' + esc(names) + '</div></div>';
    }).join('') || '<p class="hint">분류된 세그먼트가 없습니다.</p>';

    renderReport();
  }

  function renderReport() {
    const r = state.report, agg = state.agg;
    const item = (k, v) => '<div class="report-item"><div class="r-k">' + k + '</div><div class="r-v">' + v + '</div></div>';
    const list = (k, arr, ordered) => '<div class="report-item"><div class="r-k">' + k + '</div><' +
      (ordered ? 'ol' : 'ul') + '>' + arr.map(x => '<li>' + esc(x) + '</li>').join('') + '</' + (ordered ? 'ol' : 'ul') + '></div>';

    let journeyItems = '';
    if (r.dropText) {
      journeyItems = item('주요 이탈 지점 (여정 시뮬레이션)', esc(r.dropText)) +
        item('가장 많이 발생할 것으로 추정되는 불편', esc(r.frictionText));
    }

    $('#report-body').innerHTML =
      item('문제의 강도', esc(r.problemStrengthText)) +
      item('가장 가능성 높은 핵심 타깃', esc(r.coreTarget)) +
      item('타깃에서 제외를 권하는 사용자', esc(r.excludeTarget)) +
      journeyItems +
      item('가장 강력한 기능', esc(r.strongFeature)) +
      item('후순위로 미룰 기능', esc(r.deferFeature)) +
      '<div class="report-item"><div class="r-k">가장 먼저 개선해야 할 문제 TOP 5</div><ol class="top5">' +
      r.improvements.map(im => '<li><b>' + esc(im.title) + (im.count ? ' (감점 근거 ' + im.count + '회)' : '') +
        '</b><span>' + esc(im.text) + '</span></li>').join('') + '</ol></div>' +
      item('추가하면 좋은 기능', esc(r.addSuggestion)) +
      item('가격 평가', esc(r.priceText)) +
      list('출시 전 반드시 검증할 가설', r.hypotheses, false) +
      list('실제 사용자 인터뷰 질문', r.interviewQs, false) +
      list('다음 개발 우선순위', r.nextPriorities, true);

    const v = state.report.verdict;
    $('#report-verdict').innerHTML =
      '<div class="overall-box"><div class="verdict-pill v-' + state.report.verdictKey + '">' +
      v.emoji + ' ' + v.label + '</div><p style="font-size:13.5px;margin-top:10px">' + esc(v.desc) + '</p>' +
      '<p class="hint" style="margin-top:6px">종합 ' + agg.overall + '점 · 신뢰도 ' + agg.confidence + '점 · 현재 시뮬레이션 기준</p></div>';
  }

  // ── 초기화 ──
  function init() {
    restoreDraft();
    bindUrlScreen();
    bindCountCards();
    bindModeBoxes();
    detectAi();

    $$('#target-chips .chip').forEach(c =>
      c.addEventListener('click', () => c.classList.toggle('on')));

    $('#btn-to-2').addEventListener('click', () => { collectInput(); showStep(2); });
    $('#btn-to-url').addEventListener('click', () => showStep('url'));
    $('#btn-to-1').addEventListener('click', () => showStep(1));
    $('#btn-to-3').addEventListener('click', () => { collectInput(); showStep(3); });
    $('#btn-back-2').addEventListener('click', () => showStep(2));
    $('#btn-run').addEventListener('click', () => {
      state.seedOffset = 0;
      runValidation().catch(err => {
        alert('검증 중 오류가 발생했습니다: ' + err.message);
        showStep(3);
      });
    });
    $('#btn-to-report').addEventListener('click', () => showStep(7));
    $('#btn-back-result').addEventListener('click', () => showStep(6));
    $('#btn-reshuffle').addEventListener('click', () => {
      state.seedOffset += 1;
      runValidation().catch(() => showStep(3));
    });
    $('#btn-restart').addEventListener('click', () => showStep('url'));

    showStep('url');
  }

  document.addEventListener('DOMContentLoaded', init);
})(window);
