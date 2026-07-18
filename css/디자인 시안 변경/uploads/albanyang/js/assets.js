// ══════════════════════════════════════════════════════════════
// assets.js — Home 자산 카드 (직접 입력 금융데이터, 은행 API 미사용)
// v=20260702a
//
// 데이터: localStorage 'atm2_assets' 단일 키 (신규 — 기존 키 비변경)
// { version:1, updatedAt:'YYYY-MM-DD'|null, items:{ cash:{amount:0}, ... } }
//
// ★ 미입력/0원 구분: items에는 사용자가 저장한 항목만 키가 존재한다.
//   "0" 입력 → { amount:0 } 키 생성 / 빈칸 저장 → 키 삭제(미입력 복귀).
//   판정은 값 비교가 아닌 키 존재 여부(hasAssetData)로만 한다.
// ★ 파생값(총자산/총부채/순자산)은 저장하지 않고 getAssetSummary()로만 계산.
// ══════════════════════════════════════════════════════════════

var ASSET_ITEMS = [
  { id:'cash',     icon:'💵', label:'현금',        kind:'asset' },
  { id:'checking', icon:'🏦', label:'입출금통장',   kind:'asset' },
  { id:'savings',  icon:'🐷', label:'적금',        kind:'asset' },
  { id:'deposit',  icon:'📜', label:'예금',        kind:'asset' },
  { id:'stock',    icon:'📈', label:'주식',        kind:'asset' },
  { id:'crypto',   icon:'🪙', label:'가상자산',     kind:'asset' },
  { id:'cardUsed', icon:'💳', label:'카드 사용금액', kind:'debt'  },
  { id:'loan',     icon:'🏛️', label:'대출 잔액',    kind:'debt'  }
];

function loadAssets(){
  try{
    var raw = localStorage.getItem('atm2_assets');
    if(raw){
      var s = JSON.parse(raw);
      if(s && typeof s==='object'){
        if(!s.items || typeof s.items!=='object') s.items = {};
        return s;
      }
    }
  }catch(e){}
  return { version:1, updatedAt:null, items:{} };
}

// 저장 유일 경로 — updatedAt은 여기서만 자동 갱신(호출부 세팅 무시)
function saveAssets(state){
  state.updatedAt = new Date().toISOString().slice(0,10);
  try{ localStorage.setItem('atm2_assets', JSON.stringify(state)); }catch(e){}
}

// 입력/미입력 구분 — items 키 존재 여부로만 판정 (amount 값 비교 금지)
function hasAssetData(state){
  var s = state || loadAssets();
  return Object.keys(s.items||{}).length > 0;
}

// 화면은 반드시 이 게이트웨이만 호출 (getIncomeSummary 패턴과 동일)
function getAssetSummary(){
  var s = loadAssets();
  var totalAsset = 0, totalDebt = 0;
  ASSET_ITEMS.forEach(function(it){
    var e = s.items[it.id];
    if(!e) return; // 미입력 항목은 합산 제외
    var n = parseInt(e.amount, 10)||0;
    if(it.kind==='asset') totalAsset += n; else totalDebt += n;
  });
  return {
    totalAsset: totalAsset,
    totalDebt: totalDebt,
    netWorth: totalAsset - totalDebt,
    hasData: hasAssetData(s),
    updatedAt: s.updatedAt,
    items: s.items
  };
}

function _astFmt(n){ return (n<0?'-':'')+Math.abs(n).toLocaleString('ko-KR')+'원'; }

// ── Home 카드 (읽기 전용 요약) ──
function renderHomeAssetCard(){
  var a = getAssetSummary();
  var H = '<div class="home-card" id="home-asset-card">';
  var dateBadge = '';
  if(a.hasData && a.updatedAt){
    var stale = false;
    try{ stale = (Date.now() - new Date(a.updatedAt).getTime()) > 30*86400000; }catch(e){}
    var md = a.updatedAt.slice(5).replace('-','/').replace(/^0/,'').replace('/0','/');
    dateBadge = '<span style="font-size:11px;color:'+(stale?'var(--orange)':'var(--text3)')+';font-weight:400;">'
      +(stale?'⚠ 오래된 정보예요 · ':'')+md+' 기준</span>';
  }
  H += '<div class="home-lbl" style="display:flex;justify-content:space-between;align-items:center;">💎 내 자산 '+dateBadge+'</div>';
  if(!a.hasData){
    H += '<div style="text-align:center;padding:8px 0 4px;">'
      +'<div style="font-size:13px;color:var(--text3);line-height:1.7;margin-bottom:8px;">자산을 입력하면 순자산을 보여드려요</div>'
      +'<button onclick="openAssetModal()" style="padding:8px 18px;border-radius:20px;border:1px solid var(--accent);background:rgba(79,124,255,.08);color:var(--accent);font-size:13px;font-weight:700;cursor:pointer;font-family:\'Noto Sans KR\';">+ 자산 입력하기</button>'
      +'</div>';
  } else {
    var negNet = a.netWorth < 0;
    // v4.2.2-beta.8 (디자인 시안): 왼쪽 숫자 + 오른쪽 머니냥 캐릭터 크게
    H += '<div style="display:flex;align-items:center;gap:12px;padding:4px 0 2px;" onclick="openAssetModal()">'
      +'<div style="flex:1;min-width:0;text-align:left;">'
      +'<div style="font-size:11px;color:var(--text3);margin-bottom:2px;">순자산</div>'
      +'<div style="font-size:26px;font-weight:900;font-family:\'JetBrains Mono\';color:'+(negNet?'var(--red)':'var(--accent)')+';">'+_astFmt(a.netWorth)+'</div>'
      +(negNet?'<div style="font-size:11px;color:var(--red);margin-top:2px;">부채가 자산보다 많아요</div>':'')
      +'<div style="display:flex;gap:16px;margin-top:8px;font-size:12px;color:var(--text2);">'
      +'<span>총자산 <b style="color:var(--green);font-family:\'JetBrains Mono\';">'+_astFmt(a.totalAsset)+'</b></span>'
      +'<span>총부채 <b style="color:var(--red);font-family:\'JetBrains Mono\';">'+_astFmt(a.totalDebt)+'</b></span>'
      +'</div>'
      +'<div style="font-size:11px;color:var(--text3);margin-top:8px;">▸ 탭하여 수정</div>'
      +'</div>'
      +'<img src="img/emoji/수입돈.png" alt="머니냥" style="width:84px;height:84px;object-fit:contain;flex:none;">'
      +'</div>';
  }
  return H + '</div>';
}

// ── 입력 모달 ──
function openAssetModal(){
  if(document.getElementById('asset-modal-overlay')) return;
  var s = loadAssets();
  var inputRow = function(it){
    var e = s.items[it.id];
    var val = e ? (parseInt(e.amount,10)||0).toLocaleString('ko-KR') : '';
    return '<div style="margin-bottom:8px;">'
      +'<div style="font-size:11px;color:var(--text3);margin-bottom:3px;">'+it.icon+' '+it.label+'</div>'
      +'<input id="ast-'+it.id+'" type="text" inputmode="numeric" value="'+val+'" placeholder="미입력"'
      +' oninput="this.value=this.value.replace(/[^0-9,]/g,\'\')"'
      +' style="width:100%;background:var(--surface);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:9px 12px;font-size:15px;font-family:\'JetBrains Mono\';box-sizing:border-box;outline:none;text-align:right;">'
      +'</div>';
  };
  var assetRows = ASSET_ITEMS.filter(function(i){return i.kind==='asset';}).map(inputRow).join('');
  var debtRows  = ASSET_ITEMS.filter(function(i){return i.kind==='debt';}).map(inputRow).join('');

  var ov = document.createElement('div');
  ov.id = 'asset-modal-overlay';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9000;display:flex;align-items:center;justify-content:center;padding:16px;';
  ov.innerHTML = '<div style="background:var(--bg);border:1px solid var(--border);border-radius:16px;max-width:420px;width:100%;max-height:85vh;overflow-y:auto;padding:18px;" onclick="event.stopPropagation()">'
    +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">'
    +'<div style="font-size:16px;font-weight:800;">💎 내 자산 입력</div>'
    +'<button onclick="closeAssetModal()" style="background:none;border:none;color:var(--text3);font-size:20px;cursor:pointer;line-height:1;">✕</button>'
    +'</div>'
    +'<div style="font-size:11px;color:var(--text3);margin-bottom:12px;line-height:1.6;">빈칸으로 저장하면 미입력으로 돌아가요 · 0원도 입력할 수 있어요</div>'
    +'<div style="font-size:12px;font-weight:700;color:var(--green);margin-bottom:6px;">자산</div>'+assetRows
    +'<div style="font-size:12px;font-weight:700;color:var(--red);margin:12px 0 6px;">부채</div>'+debtRows
    +'<button onclick="saveAssetModal()" style="width:100%;margin-top:12px;padding:12px;border-radius:10px;border:none;background:var(--accent);color:#fff;font-size:15px;font-weight:700;cursor:pointer;font-family:\'Noto Sans KR\';">💾 저장</button>'
    +'</div>';
  ov.addEventListener('click', closeAssetModal);
  document.body.appendChild(ov);
}

function closeAssetModal(){
  var ov = document.getElementById('asset-modal-overlay');
  if(ov) ov.remove();
}

function saveAssetModal(){
  var s = loadAssets();
  var bad = null;
  ASSET_ITEMS.forEach(function(it){
    var el = document.getElementById('ast-'+it.id);
    if(!el) return;
    var raw = el.value.trim();
    if(raw === ''){ delete s.items[it.id]; return; } // 빈칸 = 미입력으로 되돌림
    var n = parseInt(raw.replace(/,/g,''), 10);
    if(isNaN(n) || n < 0){ bad = it.label; return; }
    s.items[it.id] = { amount: n };
  });
  if(bad){ if(typeof showToast==='function') showToast('⚠️ '+bad+' 값을 확인해주세요'); return; }
  saveAssets(s);
  closeAssetModal();
  if(typeof showToast==='function') showToast('✅ 자산 저장됨');
  if(typeof renderHomePage==='function') renderHomePage();
}
