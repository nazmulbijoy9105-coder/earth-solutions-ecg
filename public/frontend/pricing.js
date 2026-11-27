'use strict';

document.addEventListener('click', event => {
  const button = event.target instanceof Element ? event.target.closest('[data-stage-filter]') : null;
  if (!button) return;
  const stage = button.getAttribute('data-stage-filter');
  document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
  button.classList.add('active');
  document.querySelectorAll('.stage-row').forEach(row => {
    row.style.display = stage === 'all' || row.dataset.stage === stage ? '' : 'none';
  });
});
