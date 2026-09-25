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
