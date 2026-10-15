const themeKey = 'jinquan-space:theme:v1';
const themeSelect = document.querySelector<HTMLSelectElement>('#theme-select');
const media = matchMedia('(prefers-color-scheme: dark)');
let preference = 'system';
try {
  const value = localStorage.getItem(themeKey);
  if (value && ['system', 'light', 'dark'].includes(value)) preference = value;
} catch {
  /* Storage may be unavailable; system preference remains usable. */
}
function applyTheme() {
  if (preference === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = preference;
  document.dispatchEvent(new Event('jinquan:theme-change'));
}
if (themeSelect) {
  themeSelect.value = preference;
  themeSelect.addEventListener('change', () => {
    preference = themeSelect.value;
    try {
      localStorage.setItem(themeKey, preference);
    } catch {
      /* Theme is applied in memory. */
    }
    applyTheme();
  });
}
media.addEventListener('change', () => {
  if (preference === 'system') applyTheme();
});
const menu = document.querySelector<HTMLDetailsElement>('.mobile-menu');
menu?.addEventListener('toggle', () =>
  menu.querySelector('summary')?.setAttribute('aria-expanded', String(menu.open)),
);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && menu?.open) {
    menu.open = false;
    menu.querySelector('summary')?.focus();
  }
});
document.querySelectorAll<HTMLPreElement>('pre').forEach((pre) => {
  const wrapper = document.createElement('div');
  wrapper.className = 'code-wrap';
  pre.before(wrapper);
  wrapper.append(pre);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'copy-button';
  button.textContent = '复制代码';
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(
        pre.querySelector('code')?.textContent || pre.textContent || '',
      );
      button.textContent = '已复制';
    } catch {
      button.textContent = '复制失败，请选中文本复制';
      const selection = getSelection();
      const range = document.createRange();
      range.selectNodeContents(pre);
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  });
  wrapper.append(button);
});
