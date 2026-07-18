// ══════════════════════════════════════════
// login.js — v2.8 로그인 화면 (UI 우선, OAuth는 추후 연결)
//
// LoginProvider 인터페이스:
//   LoginProvider.google.login() / kakao.login() / naver.login() / email.login()
//   → 지금은 전부 _completeLogin()만 호출 (임시: isLoggedIn=true 저장 후 Home 이동)
//   → 나중에 각 provider의 login() 안에 OAuth 코드만 넣으면 됨.
//     OAuth 성공 콜백에서 _completeLogin(providerId, profile)을 호출하는 구조.
//
// 게이트: 앱 실행 시 isLoggedIn !== 'true'면 로그인 화면 표시, true면 바로 Home.
// 로그아웃: logoutMoneynyang() — isLoggedIn=false 후 로그인 화면 재표시.
// 기존 localStorage 데이터는 건드리지 않음 (isLoggedIn / loginProvider 키만 추가).
// ══════════════════════════════════════════

// ── 공통 완료 처리 — OAuth 연결 후에도 이 함수만 호출하면 됨 ──
function _completeLogin(providerId, profile){
  try{
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('loginProvider', providerId||'guest');
    localStorage.setItem('moneynyang_visited', '1');
    if(profile) localStorage.setItem('loginProfile', JSON.stringify(profile));
  }catch(e){}
  _loginHide();
  _loginGoHome();
  // 구 스플래시(시작하기)에서 하던 신규 사용자 유도 — 직업 미선택이면 수익원 선택 위저드
  var selJ = [];
  try{ selJ = JSON.parse(localStorage.getItem('atm2_selectedJobs')||'[]'); }catch(e){}
  if(selJ.length===0){
    setTimeout(function(){ if(typeof showJobTypeSelector==='function') showJobTypeSelector(true); }, 300);
  }
}

function _loginGoHome(){
  try{ if(typeof showPage==='function') showPage('home'); }catch(e){}
}

// ── LoginProvider 인터페이스 (OAuth 연결 지점) ──
var LoginProvider = {
  google: {
    id: 'google',
    login: function(){
      // TODO(OAuth): Google Identity Services 연동 — 성공 콜백에서 _loginTransition('google', profile)
      _loginTransition('google');
    }
  },
  kakao: {
    id: 'kakao',
    login: function(){
      // TODO(OAuth): Kakao JavaScript SDK(Kakao.Auth.authorize) 연동
      _loginTransition('kakao');
    }
  },
  naver: {
    id: 'naver',
    login: function(){
      // TODO(OAuth): 네이버 아이디로 로그인(naver_id_login) 연동
      _loginTransition('naver');
    }
  },
  email: {
    id: 'email',
    login: function(){
      // TODO: 이메일 로그인 폼 — 현재는 임시 통과
      _loginTransition('email');
    }
  }
};

function loginWithGoogle(){ LoginProvider.google.login(); }
function loginWithKakao(){ LoginProvider.kakao.login(); }
function loginWithNaver(){ LoginProvider.naver.login(); }
function loginWithEmail(){ LoginProvider.email.login(); }

// ── 로그아웃 ──
function logoutMoneynyang(){
  try{
    localStorage.setItem('isLoggedIn', 'false');
    localStorage.removeItem('loginProvider');
  }catch(e){}
  _loginShow();
}

// ── 로그인 화면 표시/숨김 ──
function _loginHide(){
  var el = document.getElementById('login-screen');
  if(el) el.remove();
}

// v3.6.1: 디자인 시스템(.mn-*) 기반 로그인 — 풍성한 배경 + 캐릭터 말풍선 + 로그인 전환 연출
function _loginShow(){
  if(document.getElementById('login-screen')) return;
  var el = document.createElement('div');
  el.id = 'login-screen';
  el.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:99980;overflow-y:auto;overflow-x:hidden;'
    + 'background:linear-gradient(160deg,#c3d9fb 0%,#e9f1ff 45%,#d4e3fd 100%);'
    + 'display:flex;justify-content:center;'
    + "font-family:'Noto Sans KR',sans-serif;";
  // 배경 장식: 반투명 원형 오브젝트 + 흐릿한 서비스 아이콘 (달력·그래프·지갑·AI)
  var blob = function(size, top, left, color, blur){
    return '<div style="position:absolute;width:'+size+'px;height:'+size+'px;border-radius:50%;'
      + 'background:'+color+';filter:blur('+blur+'px);top:'+top+';left:'+left+';pointer-events:none;"></div>';
  };
  var bgIcon = function(icon, size, top, left, rot){
    return '<div style="position:absolute;font-size:'+size+'px;top:'+top+';left:'+left+';opacity:.10;'
      + 'transform:rotate('+rot+'deg);pointer-events:none;filter:blur(.4px);">'+icon+'</div>';
  };
  var brandBtn = function(fn, bg, fg, border, icon, label){
    return '<button onclick="'+fn+'()" class="mn-btn mn-btn--lg mn-btn--block" '
      + 'style="background:'+bg+';color:'+fg+';'+(border?'border:1px solid '+border+';':'')+'margin-bottom:16px;justify-content:flex-start;padding:0 18px;">'
      + '<span style="width:26px;text-align:center;font-size:17px;font-weight:900;">'+icon+'</span>'
      + '<span style="flex:1;text-align:center;">'+label+'</span>'
      + '<span style="opacity:.45;">›</span></button>';
  };
  var nick = '';
  try{ if(typeof memName!=='undefined' && memName) nick = memName+'님, '; }catch(e){}
  el.innerHTML =
    // 손 흔들기 애니메이션 (로그인 전환 연출용)
    '<style>@keyframes mn-wave{0%,100%{transform:rotate(0)}20%{transform:rotate(-8deg)}40%{transform:rotate(10deg)}60%{transform:rotate(-6deg)}80%{transform:rotate(6deg)}}'
    + '.mn-waving{animation:mn-wave .9s ease-in-out infinite;transform-origin:70% 90%;}</style>'
    // ── 배경 오브젝트 레이어 ──
    + '<div style="position:absolute;inset:0;overflow:hidden;">'
    + blob(340, '-90px', '-110px', 'rgba(79,124,255,.16)', 30)
    + blob(260, '30%', '78%', 'rgba(124,92,255,.13)', 34)
    + blob(300, '72%', '-80px', 'rgba(79,124,255,.12)', 36)
    + blob(160, '58%', '82%', 'rgba(255,209,102,.14)', 26)
    + bgIcon('📅', 46, '9%',  '8%',  -12)
    + bgIcon('📊', 52, '20%', '82%', 10)
    + bgIcon('👛', 44, '46%', '6%',  8)
    + bgIcon('🤖', 40, '64%', '86%', -8)
    + bgIcon('⏰', 38, '84%', '12%', 12)
    + bgIcon('🐾', 44, '90%', '74%', -14)
    + '</div>'
    // ── 콘텐츠 ──
    + '<div class="mn-stagger" style="position:relative;width:100%;max-width:480px;padding:34px 20px 26px;box-sizing:border-box;text-align:center;">'
    // ① 브랜드 헤드 (캐릭터보다 시선이 덜 가도록 로고는 절제)
    + '<div style="font-size:34px;font-weight:900;color:#1d4ed8;letter-spacing:1px;">머니냥<span style="font-size:16px;">🐾</span>'
    + '<div style="font-size:10px;font-weight:400;color:#8ea2c4;letter-spacing:6px;margin-top:1px;">MONEY + MEOW</div></div>'
    + '<div style="font-size:16px;font-weight:700;color:#2c3e63;line-height:1.5;margin-top:8px;">당신의 <span style="color:#2f6bff;">한 달</span>을 <span style="color:#2f6bff;">끝까지</span> 지켜주는<br>AI 비서</div>'
    // ② 캐릭터 Hero — 캐릭터 시스템 컴포넌트 (화면 주인공, 카드 위에 겹침)
    + '<div style="position:relative;z-index:2;margin-top:20px;margin-bottom:-68px;">'
    + MnCharacter.img('welcome', 'hero', { id:'login-char', animate:'pop' })
    + '</div>'
    // ③ 로그인 카드 — 캐릭터가 얹히는 Hero 구조 (상단 여백으로 버튼 안 밀림)
    + '<div id="login-card" style="background:rgba(255,255,255,.94);border-radius:var(--mn-r-xl);padding:84px 20px 18px;box-shadow:var(--mn-shadow-3);backdrop-filter:blur(6px);">'
    + '<div id="login-bubble" style="font-size:14.5px;color:#2c3e63;line-height:1.55;margin-bottom:18px;">'
    + (nick
        ? '"안녕하세요, '+nick.replace(', ','')+'!<br><b>오늘도 한 달을 함께 관리해드릴게요.</b>"'
        : '"반가워요!<br><b>오늘도 돈과 시간을 함께 관리해볼까요?</b>"')
    + '</div>'
    + brandBtn('loginWithGoogle', '#ffffff', '#222222', '#e3e8f4', '<span style="color:#4285F4;">G</span>', 'Google로 계속하기')
    + brandBtn('loginWithKakao',  '#FEE500', '#191919', null, '💬', '카카오로 계속하기')
    + brandBtn('loginWithNaver',  '#03C75A', '#ffffff', null, 'N', '네이버로 계속하기')
    + '<div style="display:flex;align-items:center;gap:10px;margin:4px 0 12px;"><div style="flex:1;height:1px;background:#dfe6f5;"></div><span style="font-size:12px;color:#98a4bd;">또는</span><div style="flex:1;height:1px;background:#dfe6f5;"></div></div>'
    + brandBtn('loginWithEmail', '#ffffff', '#222222', '#e3e8f4', '✉️', '이메일로 로그인하기')
    + '<div style="font-size:12px;color:#98a4bd;margin-top:8px;">🔒 데이터는 기기에 안전하게 암호화되어 저장됩니다</div>'
    + '</div>'
    // ④ 회원가입
    + '<div style="margin-top:14px;font-size:14px;color:#3a4a6b;">🐾 처음이신가요? <a href="javascript:loginWithEmail()" style="color:#2f6bff;font-weight:700;text-decoration:none;">회원가입 ›</a></div>'
    + '</div>';
  document.body.appendChild(el);
}

// 로그인 전환 연출 — 캐릭터가 표정으로 말한다 (일반 이모지 없음)
// 생각중(로그인 중) → 칭찬축하(환영합니다!) → Home. 캐릭터 상태 교체는 MnCharacter.swap 단일 경로.
function _loginTransition(providerId, profile){
  var ch = document.getElementById('login-char');
  var card = document.getElementById('login-card');
  if(!ch){ _completeLogin(providerId, profile); return; }
  // 1단계: 생각중 — 로그인 중
  MnCharacter.swap(ch, 'thinking');
  if(card) card.innerHTML = '<div style="padding:56px 0 26px;">'
    + '<div style="font-size:16px;font-weight:700;color:#2f6bff;">로그인 중입니다...</div>'
    + '<div style="font-size:13.5px;color:#8ea2c4;margin-top:6px;">잠시만 기다려주세요.</div></div>';
  setTimeout(function(){
    // 2단계: 칭찬축하 — 환영 (손 흔들기)
    MnCharacter.swap(ch, 'celebrate', true);
    if(card) card.innerHTML = '<div class="mn-fade-in" style="padding:56px 0 26px;">'
      + '<div style="font-size:16px;font-weight:700;color:#2f6bff;">환영합니다!</div>'
      + '<div style="font-size:13.5px;color:#8ea4c4;margin-top:6px;">오늘도 함께 시작해볼까요?</div></div>';
    setTimeout(function(){ _completeLogin(providerId, profile); }, 550);
  }, 500);
}

// 로그인 실패 연출 (향후 OAuth 에러 콜백에서 호출) — 울음오류 캐릭터
function _loginFail(){
  var ch = document.getElementById('login-char');
  var bubble = document.getElementById('login-bubble');
  if(ch) MnCharacter.swap(ch, 'error');
  if(bubble) bubble.innerHTML = '"로그인에 실패했어요.<br><b>다시 한 번 시도해주세요.</b>"';
}

// ── 앱 실행 게이트 ──
(function(){
  function gate(){
    var logged = null;
    try{ logged = localStorage.getItem('isLoggedIn'); }catch(e){}
    if(logged !== 'true') _loginShow();
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', gate);
  else gate();
})();
