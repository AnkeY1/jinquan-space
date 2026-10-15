const group = document.querySelector<HTMLElement>('[data-filter-group]');
if (group) {
  const buttons = [...group.querySelectorAll<HTMLButtonElement>('[data-filter]')];
  const cards = [...document.querySelectorAll<HTMLElement>('#filtered-content>article')];
  const key = group.dataset.filterGroup === 'category' ? 'category' : 'tag';
  function update(value: string, push = false) {
    const selected = buttons.some((b) => b.dataset.filter === value) ? value : 'all';
    let count = 0;
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === selected)));
    cards.forEach((c) => {
      const show =
        selected === 'all' ||
        c.dataset.category === selected ||
        c.dataset.tags?.split(',').includes(selected);
      c.hidden = !show;
      if (show) count++;
    });
    document.querySelector('#filter-count')!.textContent =
      `共 ${count} ${key === 'category' ? '个项目' : '篇文章'}`;
    const empty = document.querySelector<HTMLElement>('#filter-empty');
    if (empty) empty.hidden = count > 0;
    if (push) {
      const url = new URL(location.href);
      if (selected === 'all') url.searchParams.delete(key);
      else url.searchParams.set(key, selected);
      history.pushState(null, '', url);
    }
  }
  buttons.forEach((b) =>
    b.addEventListener('click', () => update(b.dataset.filter || 'all', true)),
  );
  window.addEventListener('popstate', () =>
    update(new URL(location.href).searchParams.get(key) || 'all'),
  );
  update(new URL(location.href).searchParams.get(key) || 'all');
}
