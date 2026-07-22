/**
 * ai-engine.js — 로컬 LLM(WebLLM) 옵트인 래퍼
 * - WebGPU 지원 감지 → 지원 시에만 "AI 심층 검증 모드" 선택지 노출
 * - 사용자가 명시적으로 켠 경우에만 모델 다운로드 (수백 MB, 최초 1회)
 * - 점수는 절대 LLM이 만들지 않음 — 대표 페르소나의 자연어 의견 재작성만 담당
 * - 로드/생성 실패 시 조용히 템플릿 결과 유지 (서비스 중단 없음)
 */
(function (global) {
  'use strict';
  const MVPV = global.MVPV = global.MVPV || {};

  const MODEL_ID = 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC'; // 소형 모델 (약 400~500MB)
  const CDN_URL = 'https://esm.run/@mlc-ai/web-llm';

  let engine = null;
  let loading = null;

  async function isSupported() {
    if (!('gpu' in navigator)) return false;
    try {
      const adapter = await navigator.gpu.requestAdapter();
      return !!adapter;
    } catch (e) {
      return false;
    }
  }

  /**
   * 모델 로드 (옵트인 시에만 호출)
   * @param {function} onProgress (percent 0~100, text)
   */
  async function load(onProgress) {
    if (engine) return engine;
    if (loading) return loading;
    loading = (async () => {
      const webllm = await import(CDN_URL);
      engine = await webllm.CreateMLCEngine(MODEL_ID, {
        initProgressCallback: (p) => {
          if (onProgress) onProgress(Math.round((p.progress || 0) * 100), p.text || '');
        },
      });
      return engine;
    })();
    try {
      return await loading;
    } catch (e) {
      loading = null;
      engine = null;
      throw e;
    }
  }

  /**
   * 대표 페르소나 의견 재작성 — 실패하면 원본(템플릿) 유지
   * @param {object} result {persona, evaluation, opinions}
   * @param {object} input MvpInput
   */
  async function rewriteOpinions(result, input) {
    if (!engine) return result.opinions;
    const p = result.persona;
    const s = result.evaluation.scores;
    const prompt = [
      '당신은 아래 프로필의 가상 사용자입니다. 이 인물의 입장에서, 소개된 서비스에 대한 의견을 한국어 반말이 아닌 자연스러운 존댓말 구어체로 작성하세요.',
      '',
      '[사용자 프로필]',
      '- ' + p.age + '세 ' + p.gender + ', ' + p.occupation,
      '- 성향: ' + p.archetypeLabel + ' / 디지털 숙련도 ' + Math.round(p.digitalLiteracy * 100) + '점',
      '- 현재 해결 방법: ' + p.currentSolution,
      '- 가장 중요하게 여기는 가치: ' + p.coreValue.label,
      '',
      '[서비스]',
      '- 이름: ' + (input.name || '(무명)'),
      '- 소개: ' + (input.tagline || input.problem || ''),
      '- 가격: ' + (input.price || '미정'),
      '',
      '[이 사용자의 평가 점수 — 이 태도를 반드시 유지할 것]',
      '- 첫 사용 의향 ' + s.firstUse + '/100, 결제 의향 ' + s.payment + '/100, 지속 사용 ' + s.retention + '/100',
      '',
      '아래 두 항목만 각각 1~2문장으로 작성하세요. 점수가 낮으면 반드시 부정적/회의적으로 쓰세요.',
      '1) 첫인상:',
      '2) 한 줄 평가:',
    ].join('\n');

    try {
      const reply = await engine.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 220,
      });
      const text = (reply.choices && reply.choices[0] && reply.choices[0].message.content) || '';
      const first = text.match(/1\)?[.)]?\s*첫인상\s*[::]?\s*([\s\S]*?)(?=2\)|$)/);
      const one = text.match(/2\)?[.)]?\s*한\s*줄\s*평가\s*[::]?\s*([\s\S]*)/);
      const out = { ...result.opinions };
      if (first && first[1].trim().length > 5) out.firstImpression = first[1].trim();
      if (one && one[1].trim().length > 5) out.oneLiner = one[1].trim();
      out._aiRewritten = true;
      return out;
    } catch (e) {
      return result.opinions; // 실패 시 템플릿 결과 유지
    }
  }

  MVPV.ai = { isSupported, load, rewriteOpinions, get ready() { return !!engine; }, MODEL_ID };
})(window);
