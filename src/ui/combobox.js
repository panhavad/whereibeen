import { debounce } from '../core/util.js';

let comboId = 0;

/**
 * Turns an <input> inside a .combo wrapper into an accessible autocomplete.
 * search(q) → Promise<items>, render(item) → HTML string, onSelect(item).
 */
export function combobox(input, { search, render, onSelect, empty = 'No matches' }) {
  const wrap = input.closest('.combo');
  const listId = `combo-list-${++comboId}`;
  let list = null;
  let items = [];
  let active = -1;
  let token = 0;

  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-controls', listId);
  input.setAttribute('autocomplete', 'off');

  const close = () => {
    list?.remove();
    list = null;
    active = -1;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  };

  const highlight = (i) => {
    active = i;
    list?.querySelectorAll('.combo-option').forEach((el, idx) => {
      el.setAttribute('aria-selected', String(idx === i));
      if (idx === i) {
        input.setAttribute('aria-activedescendant', el.id);
        el.scrollIntoView({ block: 'nearest' });
      }
    });
  };

  const select = (i) => {
    const item = items[i];
    if (!item) return;
    close();
    onSelect(item);
  };

  const show = () => {
    if (!list) {
      list = document.createElement('ul');
      list.className = 'combo-list';
      list.id = listId;
      list.setAttribute('role', 'listbox');
      list.setAttribute('data-lenis-prevent', '');
      wrap.appendChild(list);
      list.addEventListener('pointerdown', (e) => {
        const option = e.target.closest('.combo-option');
        if (!option) return;
        e.preventDefault();
        select(Number(option.dataset.index));
      });
    }
    input.setAttribute('aria-expanded', 'true');
    list.innerHTML = items.length
      ? items.map((item, i) => `<li class="combo-option" role="option" id="${listId}-${i}" data-index="${i}" aria-selected="false">${render(item)}</li>`).join('')
      : `<li class="combo-empty">${empty}</li>`;
    highlight(items.length ? 0 : -1);
  };

  const run = async () => {
    const mine = ++token;
    const result = await search(input.value);
    if (mine !== token || document.activeElement !== input) return;
    items = result || [];
    show();
  };
  const runDebounced = debounce(run, 110);

  input.addEventListener('input', runDebounced);
  input.addEventListener('focus', () => {
    input.select();
    run();
  });
  input.addEventListener('blur', () => setTimeout(close, 120));
  input.addEventListener('keydown', (e) => {
    if (!list && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      run();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      highlight(Math.min(items.length - 1, active + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      highlight(Math.max(0, active - 1));
    } else if (e.key === 'Enter' && list && active >= 0) {
      e.preventDefault();
      select(active);
    } else if (e.key === 'Escape' && list) {
      e.stopPropagation();
      close();
    }
  });

  return { close, refresh: run };
}
