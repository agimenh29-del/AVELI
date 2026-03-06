const onScroll = () => {
  document.body.classList.toggle('nav-scrolled', window.scrollY > 12);
};

window.addEventListener('scroll', onScroll, { passive: true });
onScroll();
