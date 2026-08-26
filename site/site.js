const menuButton = document.querySelector('[data-menu-button]');
const sidebar = document.querySelector('[data-docs-sidebar]');

if (menuButton && sidebar) {
  menuButton.addEventListener('click', () => {
    const isOpen = sidebar.classList.toggle('is-open');
    menuButton.setAttribute('aria-expanded', String(isOpen));
    menuButton.textContent = isOpen ? 'Close topics' : 'Browse topics';
  });
}

document.querySelectorAll('.doc-content pre').forEach((block) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'copy-code';
  button.textContent = 'Copy';
  button.setAttribute('aria-label', 'Copy code to clipboard');
  button.addEventListener('click', async () => {
    const code = block.querySelector('code')?.textContent ?? block.textContent;
    await navigator.clipboard.writeText(code);
    button.textContent = 'Copied';
    window.setTimeout(() => { button.textContent = 'Copy'; }, 1600);
  });
  block.append(button);
});

const revealTargets = document.querySelectorAll('[data-reveal]');
const revealObserver = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      revealObserver.unobserve(entry.target);
    }
  }
}, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
revealTargets.forEach((element) => revealObserver.observe(element));
