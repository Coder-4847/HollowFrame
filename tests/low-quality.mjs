// Gameplay suites hold keys for fixed wall-clock times. Under the SwiftShader software renderer
// used in CI, bloom and ambient occlusion drop the frame rate so far that too little game time
// passes, so these suites start at Low quality. Rendering is covered by the other suites.
export function lowQuality(page) {
  return page.addInitScript(() => {
    try {
      const save = JSON.parse(localStorage.getItem('hollowframe-v1') || '{}');
      if (!save.settings?.quality) {
        save.settings = { ...save.settings, quality: 'low' };
        localStorage.setItem('hollowframe-v1', JSON.stringify(save));
      }
    } catch {}
  });
}
// Deploying draws one warm-up frame containing every pooled effect and enemy variant so that
// play never stalls on first use. Under SwiftShader that frame takes a few hundred ms to
// execute, so suites that measure input in short wall-clock windows first wait for the game
// loop to be running at its normal pace.
export function settled(page) {
  return page.waitForFunction(
    () => __HOLLOWFRAME__.state === 'playing' && __HOLLOWFRAME__.elapsed > 0.3,
  );
}
