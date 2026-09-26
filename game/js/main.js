'use strict';
// ---------- frame loop ----------
function frame(now) {
  stepTweens(now);
  const t = now / 1000;
  g = ag;
  OX = Math.floor(SCENE === 'title' ? W * 0.63 : W / 2);
  const use3D = V3.on && SCENE !== 'campaign' && !!B;
  show3D(use3D);
  HD = use3D;
  if (use3D) { g = hdg; hdg.setTransform(1, 0, 0, 1, 0, 0); hdg.clearRect(0, 0, hdC.width, hdC.height); hdg.setTransform(PX, 0, 0, PX, 0, 0); hdg.imageSmoothingEnabled = true; }
  if (SCENE === 'campaign') renderCampaign(now);
  else if (B) renderBattle(now, { clean: SCENE !== 'battle', three: use3D });
  drawSnow(t);
  shakeAmt *= 0.86;
  const sx = shakeAmt > 0.3 ? Math.round((Math.random() - 0.5) * shakeAmt) : 0, sy = shakeAmt > 0.3 ? Math.round((Math.random() - 0.5) * shakeAmt) : 0;
  if (use3D) { dg.clearRect(0, 0, stage.width, stage.height); render3D(sx, sy); dg.drawImage(hdC, sx * PX, sy * PX); g = ag; HD = false; }
  else { dg.fillStyle = '#0b1016'; dg.fillRect(0, 0, stage.width, stage.height); dg.drawImage(artC, sx * PX, sy * PX, W * PX, H * PX); }
  requestAnimationFrame(frame);
}
window.addEventListener('resize', () => { fitStage(); renderHud(); });
init3D();
fitStage();
showTitle();
requestAnimationFrame(frame);

// Hooks for the automated playtest (tools/playtest.js).
window.__sf = {
  get B() { return B; }, get CAMP() { return CAMP; }, get SCENE() { return SCENE; },
  setSpeed(s) { SPEED = s; },
  unitAt, weaponTargets, weaponEffects, reach, playerMove, playerFire, enemyPhase, supportStrike, threats,
  isBusy: () => busy,
};
