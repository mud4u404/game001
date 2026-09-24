'use strict';
// ---------- frame loop ----------
function frame(now) {
  stepTweens(now);
  const t = now / 1000;
  g = ag;
  OX = Math.floor(SCENE === 'title' ? W * 0.63 : W / 2);
  if (SCENE === 'campaign') renderCampaign(now);
  else if (B) renderBattle(now, { clean: SCENE !== 'battle' });
  drawSnow(t);
  shakeAmt *= 0.86;
  const sx = shakeAmt > 0.3 ? Math.round((Math.random() - 0.5) * shakeAmt) : 0, sy = shakeAmt > 0.3 ? Math.round((Math.random() - 0.5) * shakeAmt) : 0;
  dg.fillStyle = '#0b1016'; dg.fillRect(0, 0, stage.width, stage.height);
  dg.drawImage(artC, sx * PX, sy * PX, W * PX, H * PX);
  requestAnimationFrame(frame);
}
window.addEventListener('resize', () => { fitStage(); renderHud(); });
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
