// ══════════════════════════════════════════
// 머니냥 문의 시스템 (자체 문의 — 구글폼 대체)
// 구조: InquiryAPI(저장 레이어) / InquiryDevice(자동 기기정보) / showInquiryPopup(UI)
// 저장: LocalStorage + EmailJS(이메일 전송).
// ══════════════════════════════════════════

// ── EmailJS 설정 ──
// https://www.emailjs.com 에서 아래 3개 값을 발급받아 교체하세요.
var EMAILJS_CONFIG = {
  publicKey:  'HNNH7A3WDbWY33N27',
  serviceId:  'service_bkvhnxb',
  templateId: 'template_c0e04u5'
};

// EmailJS 초기화 (SDK 로드 후 1회)
(function(){
  try{
    if(typeof emailjs !== 'undefined' && EMAILJS_CONFIG.publicKey !== 'YOUR_PUBLIC_KEY'){
      emailjs.init({ publicKey: EMAILJS_CONFIG.publicKey });
    }
  }catch(e){}
})();

// ── 저장 백엔드 인터페이스: { create(inquiry)→Promise, list()→Promise, get(id)→Promise }
var InquiryLocalBackend = {
  _KEY: 'atm2_inquiries',
  _load: function(){
    try{ return JSON.parse(localStorage.getItem(this._KEY)||'[]'); }catch(e){ return []; }
  },
  _save: function(arr){
    try{ localStorage.setItem(this._KEY, JSON.stringify(arr)); return true; }catch(e){ return false; }
  },
  create: function(inquiry){
    var self = this;
    return new Promise(function(resolve, reject){
      var arr = self._load();
      arr.push(inquiry);
      if(self._save(arr)) resolve(inquiry);
      else {
        // 용량 초과(주로 이미지) → 이미지 제거 후 재시도
        inquiry.images = [];
        inquiry.imagesDropped = true;
        arr[arr.length-1] = inquiry;
        if(self._save(arr)) resolve(inquiry);
        else reject(new Error('STORAGE_FULL'));
      }
    });
  },
  list: function(){
    return Promise.resolve(this._load());
  },
  get: function(id){
    var found = this._load().filter(function(q){ return q.id===id; })[0] || null;
    return Promise.resolve(found);
  }
};

/* 서버 연동 예시 (Supabase/Firebase/Node/Spring 무엇이든 이 형태로 교체):
var InquiryHttpBackend = {
  create: function(inquiry){
    return fetch('https://api.moneynyang.app/inquiries', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify(inquiry)
    }).then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); });
  },
  list: function(){ return fetch('.../inquiries').then(function(r){ return r.json(); }); },
  get: function(id){ return fetch('.../inquiries/'+id).then(function(r){ return r.json(); }); }
};
InquiryAPI.setBackend(InquiryHttpBackend);
*/

// ── 이메일 전송 (EmailJS) ──
function _inqSendEmail(inquiry){
  if(typeof emailjs === 'undefined' || EMAILJS_CONFIG.publicKey === 'YOUR_PUBLIC_KEY') return Promise.resolve();
  var catLabel = INQUIRY_CATEGORIES.filter(function(c){ return c.v === inquiry.category; })[0];
  var dev = inquiry.deviceInfo || {};
  var templateParams = {
    inquiry_id:    inquiry.id,
    category:      catLabel ? catLabel.l : inquiry.category,
    title:         inquiry.title,
    content:       inquiry.content,
    app_version:   inquiry.appVersion,
    os:            dev.os || '',
    browser:       dev.browser || '',
    screen:        dev.screen || '',
    page:          dev.page || '',
    jobs:          dev.jobs || '',
    occurred_at:   dev.occurredAt || '',
    created_at:    inquiry.createdAt,
    image_count:   (inquiry.images||[]).length + '장',
    user_id:       inquiry.userId
  };
  return emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.templateId, templateParams)
    .catch(function(){ /* 이메일 실패해도 로컬 저장은 성공 — 무시 */ });
}

var InquiryAPI = (function(){
  var _backend = InquiryLocalBackend;
  return {
    setBackend: function(b){ _backend = b; },
    submit: function(data){
      var inquiry = {
        id: 'inq_' + Date.now() + '_' + Math.random().toString(36).slice(2,8),
        userId: InquiryDevice.userId(),
        category: data.category,
        title: data.title,
        content: data.content,
        images: data.images || [],
        status: 'pending',
        answer: null,
        answeredAt: null,
        createdAt: new Date().toISOString(),
        appVersion: (typeof APP_VERSION!=='undefined') ? APP_VERSION : '?',
        deviceInfo: InquiryDevice.collect()
      };
      return _backend.create(inquiry).then(function(saved){
        _inqSendEmail(saved);
        return saved;
      });
    },
    list: function(){ return _backend.list(); },
    get: function(id){ return _backend.get(id); }
  };
})();

// ── 자동 기기/컨텍스트 정보 수집 ──
var InquiryDevice = {
  userId: function(){
    // 익명 식별자 — 최초 1회 생성 후 유지 (회원 시스템 연동 시 교체 지점)
    try{
      var uid = localStorage.getItem('atm2_anon_uid');
      if(!uid){ uid = 'anon_' + Date.now() + '_' + Math.random().toString(36).slice(2,10); localStorage.setItem('atm2_anon_uid', uid); }
      return uid;
    }catch(e){ return 'anon_unknown'; }
  },
  os: function(){
    var ua = navigator.userAgent;
    if(/Android/i.test(ua)){
      var m = ua.match(/Android\s([\d.]+)/);
      return 'Android' + (m ? ' ' + m[1] : '');
    }
    if(/iPhone|iPad|iPod/i.test(ua)){
      var im = ua.match(/OS\s([\d_]+)/);
      return 'iOS' + (im ? ' ' + im[1].replace(/_/g,'.') : '');
    }
    if(/Windows NT 10/i.test(ua)) return 'Windows 10/11';
    if(/Windows/i.test(ua)) return 'Windows';
    if(/Mac OS X/i.test(ua)) return 'macOS';
    if(/Linux/i.test(ua)) return 'Linux';
    return 'Unknown';
  },
  browser: function(){
    var ua = navigator.userAgent;
    if(/SamsungBrowser/i.test(ua)) return 'Samsung Internet';
    if(/Edg\//i.test(ua)) return 'Edge';
    if(/Chrome/i.test(ua)) return 'Chrome';
    if(/Safari/i.test(ua)) return 'Safari';
    if(/Firefox/i.test(ua)) return 'Firefox';
    return 'Unknown';
  },
  isPWA: function(){
    try{ return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone===true; }catch(e){ return false; }
  },
  currentPage: function(){
    // showPage 전역 상태가 없으므로 페이지 display로 판별 (기존 코드 무변경)
    var map = { 'home-page':'홈', 'att-page':'근태관리', 'salary-page':'수입관리',
                'dash-page':'연간요약', 'budget-page':'생존관리', 'settings-page':'설정' };
    for(var id in map){
      var el = document.getElementById(id);
      if(el && el.style.display !== 'none' && el.offsetParent !== null) return map[id];
    }
    return '알 수 없음';
  },
  jobs: function(){
    try{
      var jobs = JSON.parse(localStorage.getItem('atm2_selectedJobs')||'[]');
      if(!jobs.length) return '미선택';
      var names = jobs.map(function(j){
        return (typeof JOB_TYPES!=='undefined' && JOB_TYPES[j]) ? JOB_TYPES[j].name : j;
      });
      return names.join(', ');
    }catch(e){ return '미선택'; }
  },
  collect: function(){
    var now = new Date();
    var pad = function(n){ return String(n).padStart(2,'0'); };
    return {
      os: this.os(),
      browser: this.browser() + (this.isPWA() ? ' (PWA)' : ''),
      screen: window.innerWidth + 'x' + window.innerHeight,
      page: this.currentPage(),
      jobs: this.jobs(),
      occurredAt: now.getFullYear()+'-'+pad(now.getMonth()+1)+'-'+pad(now.getDate())+' '+pad(now.getHours())+':'+pad(now.getMinutes()),
      userAgent: navigator.userAgent
    };
  }
};

// ── 문의 작성 UI (카드형 Bottom Sheet) ──
var _inqImages = [];   // dataURL 배열 (최대 3장)

var INQUIRY_CATEGORIES = [
  {v:'bug',     l:'🐛 버그 신고'},
  {v:'feature', l:'💡 기능 제안'},
  {v:'usage',   l:'📖 사용법 문의'},
  {v:'payment', l:'💳 결제 문의'},
  {v:'account', l:'👤 계정 문의'},
  {v:'etc',     l:'📝 기타'}
];

function showInquiryPopup(){
  var existing = document.getElementById('inq-overlay');
  if(existing) existing.remove();
  _inqImages = [];

  var catOpts = INQUIRY_CATEGORIES.map(function(c){
    return '<option value="'+c.v+'">'+c.l+'</option>';
  }).join('');

  var dev = InquiryDevice.collect();

  var overlay = document.createElement('div');
  overlay.id = 'inq-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.55);z-index:99990;display:flex;align-items:flex-end;justify-content:center;';
  overlay.innerHTML =
    '<div id="inq-sheet" style="background:var(--surface,#1e2235);border-radius:20px 20px 0 0;width:100%;max-width:560px;max-height:88vh;overflow-y:auto;padding:22px 20px 24px;box-sizing:border-box;">'

    + '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px;">'
    + '<div style="font-size:19px;font-weight:800;color:var(--text,#eee);">😺 문의하기</div>'
    + '<button id="inq-close" style="background:none;border:none;font-size:20px;color:var(--text3,#999);cursor:pointer;padding:4px 8px;min-width:44px;min-height:44px;">✕</button>'
    + '</div>'
    + '<div style="font-size:15px;color:var(--text2,#b8bdd4);line-height:1.6;margin-bottom:16px;">궁금한 점이나 불편한 점을 알려주세요.<br>빠르게 확인하겠습니다.</div>'

    + '<label style="display:block;font-size:14px;font-weight:700;color:var(--text2,#b8bdd4);margin-bottom:6px;">문의 유형</label>'
    + '<select id="inq-category" style="width:100%;padding:12px;border-radius:10px;border:1px solid var(--border,rgba(255,255,255,.15));background:var(--bg,#161927);color:var(--text,#eee);font-size:15px;font-family:\'Noto Sans KR\',sans-serif;margin-bottom:14px;box-sizing:border-box;">'+catOpts+'</select>'

    + '<label style="display:block;font-size:14px;font-weight:700;color:var(--text2,#b8bdd4);margin-bottom:6px;">제목</label>'
    + '<input id="inq-title" type="text" maxlength="60" placeholder="한 줄로 요약해주세요" style="width:100%;padding:12px;border-radius:10px;border:1px solid var(--border,rgba(255,255,255,.15));background:var(--bg,#161927);color:var(--text,#eee);font-size:15px;font-family:\'Noto Sans KR\',sans-serif;margin-bottom:14px;box-sizing:border-box;">'

    + '<label style="display:block;font-size:14px;font-weight:700;color:var(--text2,#b8bdd4);margin-bottom:6px;">문의 내용 <span style="font-weight:400;color:var(--text3,#999);">(최소 10자)</span></label>'
    + '<textarea id="inq-content" rows="5" placeholder="어떤 상황에서 어떤 문제가 있었는지 적어주시면 더 빠르게 해결할 수 있어요" style="width:100%;padding:12px;border-radius:10px;border:1px solid var(--border,rgba(255,255,255,.15));background:var(--bg,#161927);color:var(--text,#eee);font-size:15px;line-height:1.6;font-family:\'Noto Sans KR\',sans-serif;margin-bottom:4px;box-sizing:border-box;resize:vertical;"></textarea>'
    + '<div id="inq-count" style="font-size:12px;color:var(--text3,#999);text-align:right;margin-bottom:14px;">0자</div>'

    + '<label style="display:block;font-size:14px;font-weight:700;color:var(--text2,#b8bdd4);margin-bottom:6px;">사진 첨부 <span style="font-weight:400;color:var(--text3,#999);">(최대 3장, 선택)</span></label>'
    + '<div id="inq-thumbs" style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap;"></div>'
    + '<button id="inq-attach" style="padding:10px 16px;border-radius:10px;border:1px dashed var(--border,rgba(255,255,255,.25));background:none;color:var(--text2,#b8bdd4);font-size:14px;cursor:pointer;font-family:\'Noto Sans KR\',sans-serif;margin-bottom:16px;min-height:44px;">📷 사진 선택</button>'
    + '<input id="inq-file" type="file" accept="image/*" multiple style="display:none;">'

    + '<div style="background:var(--bg,#161927);border:1px solid var(--border,rgba(255,255,255,.1));border-radius:10px;padding:12px 14px;margin-bottom:18px;">'
    + '<div style="font-size:13px;font-weight:700;color:var(--text3,#999);margin-bottom:6px;">🔧 아래 정보가 자동으로 함께 전송돼요</div>'
    + '<div style="font-size:13px;color:var(--text2,#b8bdd4);line-height:1.7;">'
    + '머니냥 '+((typeof APP_VERSION!=='undefined')?APP_VERSION:'?')+' · '+dev.os+' · '+dev.browser
    + '<br>화면 '+dev.screen+' · '+dev.page+' 화면에서 작성'
    + '<br>직업: '+dev.jobs+' · '+dev.occurredAt
    + '</div></div>'

    + '<button id="inq-submit" style="width:100%;padding:15px 0;border-radius:14px;border:none;background:var(--accent,#4f7cff);color:#fff;font-size:17px;font-weight:800;cursor:pointer;font-family:\'Noto Sans KR\',sans-serif;min-height:52px;">문의 보내기</button>'
    + '</div>';

  document.body.appendChild(overlay);

  overlay.addEventListener('click', function(e){ if(e.target===overlay) overlay.remove(); });
  document.getElementById('inq-close').addEventListener('click', function(){ overlay.remove(); });

  var contentEl = document.getElementById('inq-content');
  contentEl.addEventListener('input', function(){
    var n = contentEl.value.trim().length;
    var cnt = document.getElementById('inq-count');
    cnt.textContent = n+'자';
    cnt.style.color = n>=10 ? 'var(--green,#3dd68c)' : 'var(--text3,#999)';
  });

  // 사진 첨부
  var fileInput = document.getElementById('inq-file');
  document.getElementById('inq-attach').addEventListener('click', function(){ fileInput.click(); });
  fileInput.addEventListener('change', function(){
    var files = Array.prototype.slice.call(fileInput.files || []);
    files.forEach(function(f){
      if(_inqImages.length >= 3) return;
      if(!/^image\//.test(f.type)) return;
      _inqResizeToDataURL(f, function(dataUrl){
        if(_inqImages.length >= 3) return;
        _inqImages.push(dataUrl);
        _inqRenderThumbs();
      });
    });
    fileInput.value = '';
  });

  // 전송
  document.getElementById('inq-submit').addEventListener('click', function(){
    var title = document.getElementById('inq-title').value.trim();
    var content = contentEl.value.trim();
    var category = document.getElementById('inq-category').value;
    if(!title){ if(typeof showToast==='function') showToast('제목을 입력해주세요'); document.getElementById('inq-title').focus(); return; }
    if(content.length < 10){ if(typeof showToast==='function') showToast('문의 내용을 10자 이상 적어주세요'); contentEl.focus(); return; }

    var btn = document.getElementById('inq-submit');
    btn.disabled = true; btn.textContent = '전송 중...';

    InquiryAPI.submit({ category:category, title:title, content:content, images:_inqImages })
      .then(function(){ _inqShowSuccess(overlay); })
      .catch(function(){
        btn.disabled = false; btn.textContent = '문의 보내기';
        if(typeof showToast==='function') showToast('저장에 실패했어요. 사진을 줄이고 다시 시도해주세요.');
      });
  });
}

// 이미지 리사이즈 (긴 변 1000px, JPEG 압축 — localStorage 용량 보호)
function _inqResizeToDataURL(file, cb){
  var reader = new FileReader();
  reader.onload = function(e){
    var img = new Image();
    img.onload = function(){
      var MAX = 1000;
      var w = img.width, h = img.height;
      if(w > MAX || h > MAX){
        if(w >= h){ h = Math.round(h*MAX/w); w = MAX; }
        else { w = Math.round(w*MAX/h); h = MAX; }
      }
      var cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(img, 0, 0, w, h);
      cb(cv.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = function(){ cb(e.target.result); };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function _inqRenderThumbs(){
  var box = document.getElementById('inq-thumbs');
  if(!box) return;
  box.innerHTML = _inqImages.map(function(src, i){
    return '<div style="position:relative;width:72px;height:72px;">'
      + '<img src="'+src+'" style="width:72px;height:72px;object-fit:cover;border-radius:8px;border:1px solid var(--border,rgba(255,255,255,.15));">'
      + '<button data-inq-del="'+i+'" style="position:absolute;top:-6px;right:-6px;width:22px;height:22px;border-radius:50%;border:none;background:var(--red,#ff5c7a);color:#fff;font-size:12px;font-weight:700;cursor:pointer;line-height:1;">✕</button>'
      + '</div>';
  }).join('');
  box.querySelectorAll('[data-inq-del]').forEach(function(btn){
    btn.addEventListener('click', function(){
      _inqImages.splice(parseInt(btn.getAttribute('data-inq-del')), 1);
      _inqRenderThumbs();
    });
  });
}

function _inqShowSuccess(overlay){
  var sheet = document.getElementById('inq-sheet');
  if(!sheet) return;
  sheet.innerHTML =
    '<div style="text-align:center;padding:36px 12px 28px;">'
    + '<div style="font-size:52px;margin-bottom:14px;">😺</div>'
    + '<div style="font-size:18px;font-weight:800;color:var(--text,#eee);margin-bottom:8px;">문의가 정상적으로 접수되었습니다.</div>'
    + '<div style="font-size:15px;color:var(--text2,#b8bdd4);line-height:1.6;margin-bottom:24px;">가능한 빠르게 답변드리겠습니다.</div>'
    + '<button id="inq-done" style="width:100%;padding:14px 0;border-radius:14px;border:none;background:var(--accent,#4f7cff);color:#fff;font-size:16px;font-weight:800;cursor:pointer;font-family:\'Noto Sans KR\',sans-serif;min-height:48px;">확인</button>'
    + '</div>';
  document.getElementById('inq-done').addEventListener('click', function(){ overlay.remove(); });
}
