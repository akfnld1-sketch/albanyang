/**
 * seed.js — 결정적 난수 생성기 (MVP 가상검증 시스템)
 * 동일한 MVP 입력 + 동일한 시드 → 항상 동일한 검증 결과 (재현성 보장)
 * FNV-1a 문자열 해시 + mulberry32 PRNG
 */
(function (global) {
  'use strict';

  // FNV-1a 32bit 해시 — 문자열을 시드 정수로 변환
  function fnv1a(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  // mulberry32 — 빠르고 분포 좋은 32bit PRNG
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** 결정적 난수 유틸 클래스 */
  function Rng(seedInput) {
    const seed = typeof seedInput === 'number' ? (seedInput >>> 0) : fnv1a(String(seedInput));
    this.seed = seed;
    this._next = mulberry32(seed);
  }

  Rng.prototype.next = function () { return this._next(); };

  /** min 이상 max 미만 실수 */
  Rng.prototype.range = function (min, max) { return min + (max - min) * this._next(); };

  /** min 이상 max 이하 정수 */
  Rng.prototype.int = function (min, max) { return Math.floor(this.range(min, max + 1)); };

  /** 배열에서 하나 선택 */
  Rng.prototype.pick = function (arr) { return arr[Math.floor(this._next() * arr.length)]; };

  /** 배열에서 중복 없이 n개 선택 */
  Rng.prototype.sample = function (arr, n) {
    const copy = arr.slice();
    const out = [];
    while (out.length < n && copy.length > 0) {
      out.push(copy.splice(Math.floor(this._next() * copy.length), 1)[0]);
    }
    return out;
  };

  /** 가중치 선택 — items: [{value, w}] */
  Rng.prototype.weighted = function (items) {
    const total = items.reduce((s, it) => s + it.w, 0);
    let r = this._next() * total;
    for (const it of items) {
      r -= it.w;
      if (r <= 0) return it.value;
    }
    return items[items.length - 1].value;
  };

  /** 대략적 정규분포 (중심 mean, 폭 spread) — 3회 평균 */
  Rng.prototype.gauss = function (mean, spread) {
    const v = (this._next() + this._next() + this._next()) / 3; // 0~1, 중심 0.5
    return mean + (v - 0.5) * 2 * spread;
  };

  /** 0~1 범위로 클램프 */
  function clamp01(v) { return Math.max(0, Math.min(1, v)); }
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  global.MVPV = global.MVPV || {};
  global.MVPV.Rng = Rng;
  global.MVPV.fnv1a = fnv1a;
  global.MVPV.clamp01 = clamp01;
  global.MVPV.clamp = clamp;
})(window);
