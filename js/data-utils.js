/* ── 모바일 드로어 ── */
function toggleDrawer(){
  // ★ 직장인/회사알바가 아닌 직종(일반알바·프리랜서 등)에서는 사이드바가 비활성화되어 있으므로
  //   햄버거 버튼이 어떤 경로로든 호출되더라도 드로어가 열리지 않도록 방어
  if(document.body.classList.contains('sidebar-disabled')) return;
  const s = document.getElementById('sidebar');
  const o = document.getElementById('drawer-overlay');
  const isOpen = s.classList.contains('open');
  if(isOpen){ closeDrawer(); } else {
    s.classList.add('open');
    o.classList.add('show');
    document.body.style.overflow = 'hidden';
  }
}
function closeDrawer(){
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('drawer-overlay').classList.remove('show');
  document.body.style.overflow = '';
}

/* ── 하단 탭 활성화 ── */
function setMobActive(page){
  document.querySelectorAll('.mob-nav-btn').forEach(b => b.classList.remove('active'));
  const el = document.getElementById('mob-btn-' + page);
  if(el) el.classList.add('active');
}

/* 기존 showPage 후처리 — 모바일 탭 동기화 */
/* _origShowPage removed - not needed */

/* ── 스와이프로 드로어 열기 (좌→우 스와이프) ── */
(function(){
  let startX = 0, startY = 0;
  document.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });
  document.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - startX;
    const dy = Math.abs(e.changedTouches[0].clientY - startY);
    // 왼쪽 엣지(40px)에서 오른쪽으로 50px+ 스와이프
    if(startX < 40 && dx > 50 && dy < 80){
      const s = document.getElementById('sidebar');
      if(!s.classList.contains('open')) toggleDrawer();
    }
    // 드로어 열린 상태에서 오른쪽→왼쪽 스와이프로 닫기
    if(dx < -60 && dy < 80){
      const s = document.getElementById('sidebar');
      if(s.classList.contains('open')) closeDrawer();
    }
  }, { passive: true });
})();

/* SAO 방사형 메뉴 제거 (2026-07-28 소유자 결정) —
   오른쪽 엣지 스와이프 폐지. 항목은 삼선 드로어 "빠른 메뉴"(#sidebar)와
   설정 탭(renderSettingsPage)에서 계속 접근 가능. */


