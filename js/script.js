(function () {
  'use strict';

  /* ---------- Helpers ---------- */
  const KEYS = {
    tasks: 'lifeDashboard.tasks',
    links: 'lifeDashboard.links',
    name: 'lifeDashboard.name',
    theme: 'lifeDashboard.theme'
  };
  const $ = (id) => document.getElementById(id);

  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage full or blocked */ }
  }
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }
  function pad(n) { return String(n).padStart(2, '0'); }
  function showError(el, message) {
    el.textContent = message || '';
    el.hidden = !message;
  }
  function makeButton(text, action, variant) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = ('btn small ' + (variant || '')).trim();
    b.dataset.action = action;
    b.textContent = text;
    return b;
  }

  /* ---------- Theme (Challenge: Light / Dark mode) ---------- */
  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    const btn = $('theme-toggle');
    $('theme-label').textContent = theme === 'dark' ? 'Light mode' : 'Dark mode';
    btn.setAttribute('aria-pressed', String(theme === 'dark'));
  }
  let theme = load(KEYS.theme, null) ||
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  applyTheme(theme);
  $('theme-toggle').addEventListener('click', function () {
    theme = theme === 'dark' ? 'light' : 'dark';
    save(KEYS.theme, theme);
    applyTheme(theme);
  });

  /* ---------- Greeting, clock and date (Challenge: custom name) ---------- */
  let userName = load(KEYS.name, '');
  $('name-input').value = userName;
  $('tz').textContent = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local';

  function getGreeting(hour) {
    if (hour >= 5 && hour < 12) return 'Good Morning';
    if (hour >= 12 && hour < 18) return 'Good Afternoon';
    if (hour >= 18 && hour < 22) return 'Good Evening';
    return 'Good Night';
  }
  function updateClock() {
    const now = new Date();
    $('clock').textContent = pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());
    $('date').textContent = now.toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    $('greeting').textContent = getGreeting(now.getHours()) + (userName ? ', ' + userName : '');
    $('day-progress').textContent = Math.round((now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()) / 864) + '%';
    $('avatar').textContent = userName ? userName.charAt(0).toUpperCase() : '?';
  }
  function saveName(e) {
    if (e) e.preventDefault();
    userName = $('name-input').value.trim();
    save(KEYS.name, userName);
    updateClock();
  }
  $('name-form').addEventListener('submit', saveName);
  $('name-input').addEventListener('change', saveName);
  updateClock();
  setInterval(updateClock, 1000);

  /* ---------- Focus timer (25 minutes) ---------- */
  const TIMER_SECONDS = 25 * 60;
  let remaining = TIMER_SECONDS;
  let timerId = null;
  let endTime = 0;

  function renderTimer() {
    $('timer-display').textContent = pad(Math.floor(remaining / 60)) + ':' + pad(remaining % 60);
    $('timer-progress').textContent = Math.round((1 - remaining / TIMER_SECONDS) * 100) + '%';
  }
  function setTimerState(state) {
    var a = $('timer-start');
    var b = $('timer-stop');
    a.dataset.state = state === 'running' ? 'running' : '';
    b.dataset.state = state === 'idle' ? 'idle' : '';
  }
  function stopTimer() {
    clearInterval(timerId);
    timerId = null;
  }
  function tick() {
    remaining = Math.max(0, Math.round((endTime - Date.now()) / 1000));
    renderTimer();
    if (remaining === 0) {
      stopTimer();
      $('timer-status').textContent = "Time's up! Take a short break.";
      setTimerState("idle");
    }
  }
  $('timer-start').addEventListener('click', function () {
    if (timerId) return;
    if (remaining <= 0) remaining = TIMER_SECONDS;
    endTime = Date.now() + remaining * 1000;
    timerId = setInterval(tick, 250);
    setTimerState('running');
    $('timer-status').textContent = 'Focus mode is on';
  });
  $('timer-stop').addEventListener('click', function () {
    if (!timerId) return;
    stopTimer();
    setTimerState('idle');
    $('timer-status').textContent = 'Paused';
  });
  $('timer-reset').addEventListener('click', function () {
    stopTimer();
    remaining = TIMER_SECONDS;
    renderTimer();
    setTimerState('idle');
    $('timer-status').textContent = 'Ready to focus';
  });
  renderTimer();

  /* ---------- To-do list ---------- */
  let tasks = load(KEYS.tasks, []);
  let editingId = null;
  const taskList = $('task-list');
  const taskError = $('task-error');

  // Challenge: prevent duplicate tasks (case-insensitive)
  function isDuplicate(text, ignoreId) {
    const t = text.trim().toLowerCase();
    return tasks.some(function (x) { return x.id !== ignoreId && x.text.trim().toLowerCase() === t; });
  }
  function persistTasks() { save(KEYS.tasks, tasks); }

  let filter = 'all';
  let query = '';
  function visibleTasks() {
    return tasks.filter(function (t) {
      if (filter === 'active' && t.done) return false;
      if (filter === 'done' && !t.done) return false;
      return t.text.toLowerCase().indexOf(query) > -1;
    });
  }
  function renderSummary() {
    const total = tasks.length;
    const done = tasks.filter(function (t) { return t.done; }).length;
    const pct = total ? Math.round(done / total * 100) : 0;
    $('count-all').textContent = total;
    $('count-active').textContent = total - done;
    $('count-done').textContent = done;
    $('sum-text').textContent = done + ' / ' + total;
    $('sum-left').textContent = total ? (total - done) + ' left to do' : 'No tasks yet';
    $('sum-done').textContent = done;
    $('sum-percent').textContent = pct + '%';
    $('sum-bar').style.width = pct + '%';
  }

  function renderTasks() {
    taskList.replaceChildren();
    visibleTasks().forEach(function (task) {
      const li = document.createElement('li');
      li.className = 'task' + (task.done ? ' done' : '');
      li.dataset.id = task.id;
      if (task.id === editingId) {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'edit-input';
        input.value = task.text;
        input.maxLength = 120;
        input.setAttribute('aria-label', 'Edit task');
        li.append(input, makeButton('Save', 'save'), makeButton('Cancel', 'cancel', 'ghost'));
      } else {
        const check = document.createElement('input');
        check.type = 'checkbox';
        check.checked = task.done;
        check.setAttribute('aria-label', 'Mark "' + task.text + '" as done');
        const label = document.createElement('span');
        label.className = 'task-text';
        label.textContent = task.text;
        li.append(check, label, makeButton('Edit', 'edit', 'ghost'), makeButton('Delete', 'delete', 'danger'));
      }
      taskList.append(li);
    });
    const empty = $('task-empty');
    empty.hidden = taskList.children.length > 0;
    empty.textContent = tasks.length ? 'No matching tasks.' : 'No tasks yet. Add your first one above.';
    renderSummary();
    const editInput = taskList.querySelector('.edit-input');
    if (editInput) { editInput.focus(); editInput.select(); }
  }

  function saveEdit(id) {
    const input = taskList.querySelector('.edit-input');
    const text = input.value.trim();
    if (!text) return showError(taskError, 'Task cannot be empty.');
    if (isDuplicate(text, id)) return showError(taskError, 'That task already exists.');
    tasks.find(function (t) { return t.id === id; }).text = text;
    editingId = null;
    showError(taskError, '');
    persistTasks();
    renderTasks();
  }

  $('task-form').addEventListener('submit', function (e) {
    e.preventDefault();
    const input = $('task-input');
    const text = input.value.trim();
    if (!text) return showError(taskError, 'Type a task first.');
    if (isDuplicate(text)) return showError(taskError, 'That task already exists.');
    tasks.push({ id: uid(), text: text, done: false });
    input.value = '';
    showError(taskError, '');
    persistTasks();
    renderTasks();
  });

  taskList.addEventListener('change', function (e) {
    if (!e.target.matches('input[type="checkbox"]')) return;
    const task = tasks.find(function (t) { return t.id === e.target.closest('li').dataset.id; });
    task.done = e.target.checked;
    persistTasks();
    renderTasks();
  });

  taskList.addEventListener('click', function (e) {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.closest('li').dataset.id;
    const action = btn.dataset.action;
    if (action === 'edit') { editingId = id; showError(taskError, ''); renderTasks(); }
    if (action === 'cancel') { editingId = null; showError(taskError, ''); renderTasks(); }
    if (action === 'save') saveEdit(id);
    if (action === 'delete') {
      tasks = tasks.filter(function (t) { return t.id !== id; });
      if (editingId === id) editingId = null;
      persistTasks();
      renderTasks();
    }
  });

  taskList.addEventListener('keydown', function (e) {
    if (!e.target.matches('.edit-input')) return;
    const id = e.target.closest('li').dataset.id;
    if (e.key === 'Enter') saveEdit(id);
    if (e.key === 'Escape') { editingId = null; showError(taskError, ''); renderTasks(); }
  });

  document.querySelector('.chips').addEventListener('click', function (e) {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    filter = chip.dataset.filter;
    document.querySelectorAll('.chip').forEach(function (c) { c.classList.toggle('active', c === chip); });
    renderTasks();
  });
  $('search-input').addEventListener('input', function (e) {
    query = e.target.value.trim().toLowerCase();
    renderTasks();
  });
  $('add-shortcut').addEventListener('click', function () {
    $('tasks').scrollIntoView({ block: 'center' });
    $('task-input').focus({ preventScroll: true });
  });

  renderTasks();

  /* ---------- Quick links ---------- */
  const defaultLinks = [
    { id: 'default-google', name: 'Google', url: 'https://www.google.com/' },
    { id: 'default-gmail', name: 'Gmail', url: 'https://mail.google.com/' },
    { id: 'default-calendar', name: 'Calendar', url: 'https://calendar.google.com/' }
  ];
  let links = load(KEYS.links, null);
  if (!Array.isArray(links)) {
    links = defaultLinks;
    save(KEYS.links, links);
  }
  const linkList = $('link-list');
  const linkError = $('link-error');

  function normalizeUrl(value) {
    let v = value.trim();
    if (!v) return null;
    if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
    try {
      const u = new URL(v);
      return u.hostname.indexOf('.') > -1 ? u.href : null;
    } catch (e) {
      return null;
    }
  }

  function renderLinks() {
    linkList.replaceChildren();
    links.forEach(function (link) {
      const li = document.createElement('li');
      li.className = 'link-item';
      li.dataset.id = link.id;
      const a = document.createElement('a');
      a.className = 'link-btn';
      a.href = link.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = link.name;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'link-remove';
      remove.textContent = '\u00d7';
      remove.setAttribute('aria-label', 'Remove ' + link.name);
      li.append(a, remove);
      linkList.append(li);
    });
  }

  $('link-form').addEventListener('submit', function (e) {
    e.preventDefault();
    const name = $('link-name').value.trim();
    const url = normalizeUrl($('link-url').value);
    if (!name) return showError(linkError, 'Give the link a name.');
    if (!url) return showError(linkError, 'Enter a valid URL, like github.com.');
    links.push({ id: uid(), name: name, url: url });
    save(KEYS.links, links);
    $('link-name').value = '';
    $('link-url').value = '';
    showError(linkError, '');
    renderLinks();
  });

  linkList.addEventListener('click', function (e) {
    if (!e.target.matches('.link-remove')) return;
    const id = e.target.closest('li').dataset.id;
    links = links.filter(function (l) { return l.id !== id; });
    save(KEYS.links, links);
    renderLinks();
  });

  renderLinks();
})();