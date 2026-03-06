(function () {
  document.body.classList.add('AVELI');

  const onScroll = () => {
    document.body.classList.toggle('ql-nav-scrolled', window.scrollY > 12);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  document.querySelectorAll('[data-ql-carousel]').forEach((carousel) => {
    const items = carousel.querySelectorAll('.ql-carousel-item');
    const base = Math.max(140, items.length * 18);
    carousel.style.setProperty('--ql-carousel-duration', `${base}s`);
  });

  document.querySelectorAll('[data-ql-player]').forEach((playerWrap) => {
    const audio = playerWrap.querySelector('[data-ql-audio]');
    const rows = Array.from(playerWrap.querySelectorAll('[data-ql-track]'));

    if (!audio || !rows.length) return;

    let active = 0;

    const setTrack = (index) => {
      active = (index + rows.length) % rows.length;
      const row = rows[active];
      const src = row.getAttribute('data-src') || '';
      if (!src) return;
      audio.src = src;
      audio.load();
    };

    const tryPlay = () => {
      audio.play().catch(() => {});
    };

    setTrack(0);

    audio.addEventListener('ended', () => {
      setTrack(active + 1);
      tryPlay();
    });

    // Try autoplay immediately; if blocked, retry on first interaction.
    tryPlay();
    const unlock = () => {
      tryPlay();
      document.removeEventListener('click', unlock);
      document.removeEventListener('touchstart', unlock);
      document.removeEventListener('keydown', unlock);
    };
    document.addEventListener('click', unlock, { once: true });
    document.addEventListener('touchstart', unlock, { once: true });
    document.addEventListener('keydown', unlock, { once: true });
  });
})();
