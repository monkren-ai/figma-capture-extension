(async () => {
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  if (!window.figma?.captureForDesign) {
    throw new Error('window.figma.captureForDesign is not available. capture.js may not have loaded.');
  }
  
  const scrollStep = Math.max(400, Math.floor(window.innerHeight * 0.8));
  
  for (let y = 0; y < document.body.scrollHeight; y += scrollStep) {
    window.scrollTo(0, y);
    await sleep(400);
  }
  
  await sleep(1500);
  window.scrollTo(0, 0);
  
  const images = Array.from(document.images || []);
  await Promise.allSettled(images.map(img => 
    img.complete 
      ? Promise.resolve() 
      : new Promise(resolve => {
          img.addEventListener('load', resolve, { once: true });
          img.addEventListener('error', resolve, { once: true });
          setTimeout(resolve, 1000);
        })
  ));
  
  if (document.fonts?.ready) {
    await Promise.allSettled([document.fonts.ready, sleep(3000)]);
  }
  
  await sleep(1000);
  
  const result = await window.figma.captureForDesign({ selector: 'body' });
  
  window.__figmaCaptureResult = result;
  
  return result;
})();
