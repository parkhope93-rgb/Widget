const STORAGE_KEY = "todo-widget-items";
const CATEGORY_KEY = "todo-widget-category";
const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const CATEGORIES = ["SCHEDULE", "SKKU", "ESF", "MRCC", "GUITAR"];
const CATEGORY_ICONS = {
  SCHEDULE: "img/Calendar.svg",
  SKKU: "img/skku.svg",
  ESF: "img/esf.svg",
  MRCC: "img/mrcc.svg",
  GUITAR: "img/guitar.svg",
};

const root = document.querySelector(".to-do");
const weekDaysEl = document.querySelector(".week-days");
const dateButtons = [...weekDaysEl.querySelectorAll(".datebutton")];
const dateSlider = weekDaysEl.querySelector(".date-slider");
const filterBox = document.querySelector(".filterbox");
const filterSlider = filterBox.querySelector(".filter-slider");
const listEl = document.getElementById("item-list");
const composer = document.querySelector(".composer");
const addForm = document.getElementById("add-form");
const taskInput = addForm.querySelector(".task-input");

const state = {
  view: "todo",
  selectedDate: todayStr(),
  weekStart: startOfWeekSunday(todayStr()),
  panelOpen: false,
  selectedCategory: localStorage.getItem(CATEGORY_KEY) || "SCHEDULE",
};

let items = loadItems();
let enteringIds = new Set();
let fadeTimer = null;

function todayStr() {
  const now = new Date();
  return formatDate(now);
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function startOfWeekSunday(dateStr) {
  const date = parseDate(dateStr);
  date.setDate(date.getDate() - date.getDay());
  return formatDate(date);
}

function addDays(dateStr, amount) {
  const date = parseDate(dateStr);
  date.setDate(date.getDate() + amount);
  return formatDate(date);
}

function formatBadge(dateStr) {
  const date = parseDate(dateStr);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random()}`;
}

function defaultItems() {
  return [
    {
      id: uid(),
      text: "18시 데사수2",
      category: "SCHEDULE",
      date: todayStr(),
      status: "todo",
    },
  ];
}

function loadItems() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultItems();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : defaultItems();
  } catch {
    return defaultItems();
  }
}

function saveItems() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function changeWeek(direction) {
  const offset = direction * 7;
  state.weekStart = addDays(state.weekStart, offset);
  state.selectedDate = addDays(state.selectedDate, offset);
  render();
}

function selectDate(date) {
  state.selectedDate = date;
  render();
}

function switchView(view) {
  if (view === state.view) return;
  if (view !== "todo" && state.panelOpen) {
    state.panelOpen = false;
  }
  listEl.classList.add("is-fading");
  clearTimeout(fadeTimer);
  fadeTimer = setTimeout(() => {
    state.view = view;
    render();
    requestAnimationFrame(() => listEl.classList.remove("is-fading"));
  }, 150);
}

function addItem(text, category) {
  const trimmed = text.trim();
  if (!trimmed) return;
  const item = {
    id: uid(),
    text: trimmed,
    category,
    date: state.selectedDate,
    status: "todo",
  };
  items.push(item);
  enteringIds.add(item.id);
  saveItems();
  render();
  taskInput.value = "";
  taskInput.focus();
}

function setStatus(id, status) {
  const item = items.find((entry) => entry.id === id);
  if (!item) return;
  item.status = status;
  saveItems();
  render();
}

function moveHoldToToday(id) {
  const item = items.find((entry) => entry.id === id);
  if (!item) return;
  item.status = "todo";
  item.date = todayStr();
  saveItems();
  render();
}

function deleteItem(id) {
  items = items.filter((entry) => entry.id !== id);
  saveItems();
  render();
}

function togglePanel() {
  state.panelOpen = !state.panelOpen;
  renderComposer();
  if (state.panelOpen) {
    taskInput.focus();
  }
}

function selectCategory(category) {
  state.selectedCategory = category;
  localStorage.setItem(CATEGORY_KEY, category);
  renderComposer();
}

function animateRemove(id, after) {
  const el = listEl.querySelector(`[data-id="${id}"]`);
  if (!el) {
    after();
    return;
  }
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    el.removeEventListener("transitionend", onEnd);
    after();
  };
  const onEnd = (event) => {
    if (event.target !== el) return;
    finish();
  };
  el.classList.add("is-removing");
  el.addEventListener("transitionend", onEnd);
  setTimeout(finish, 360);
}

function visibleItems() {
  if (state.view === "hold") {
    return items
      .filter((item) => item.status === "hold")
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date) || a.text.localeCompare(b.text));
  }
  return items.filter(
    (item) => item.status === state.view && item.date === state.selectedDate
  );
}

function renderDateBar() {
  dateButtons.forEach((button, index) => {
    const date = addDays(state.weekStart, index);
    const day = parseDate(date).getDate();
    button.dataset.date = date;
    button.classList.toggle("is-sun", index === 0);
    button.classList.toggle("is-sat", index === 6);
    button.classList.toggle("is-selected", date === state.selectedDate);
    button.innerHTML = `
      <span class="day-label">${DAY_LABELS[index]}</span>
      <time class="date-num" datetime="${date}">${day}</time>
    `;
  });
  const selected = dateButtons.find((button) => button.dataset.date === state.selectedDate);
  if (selected) {
    updateSliders();
  }
}

function renderTabs() {
  root.dataset.view = state.view;
  filterBox.querySelectorAll(".filter").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === state.view);
  });
  const active = filterBox.querySelector(".filter.is-active");
  if (active) {
    updateSliders();
  }
}

function itemActions(item) {
  if (state.view === "todo") {
    return `
      <button class="todo-check" type="button" data-action="check" data-id="${item.id}" aria-label="완료"></button>
      <span class="todo-text">${escapeHtml(item.text)}</span>
      <button class="listfunction-icon" type="button" data-action="hold" data-id="${item.id}" aria-label="보류">
        <img src="img/holdarrow.svg" alt="">
      </button>
      <button class="listfunction-icon" type="button" data-action="delete" data-id="${item.id}" aria-label="삭제">
        <img src="img/trash.svg" alt="">
      </button>
    `;
  }
  if (state.view === "done") {
    return `
      <button class="todo-check is-checked" type="button" data-action="check" data-id="${item.id}" aria-label="미완료로"></button>
      <span class="todo-text">${escapeHtml(item.text)}</span>
    `;
  }
  return `
    <span class="todo-text">${escapeHtml(item.text)}</span>
    <button class="listfunction-icon" type="button" data-action="restore" data-id="${item.id}" aria-label="오늘 할 일로">
      <img src="img/Calendar.svg" alt="">
    </button>
    <span class="hold-date">${formatBadge(item.date)}</span>
    <button class="listfunction-icon" type="button" data-action="delete" data-id="${item.id}" aria-label="삭제">
      <img src="img/trash.svg" alt="">
    </button>
  `;
}

function itemMarkup(item) {
  const extra = state.view === "done" ? " is-done" : state.view === "hold" ? " is-hold" : "";
  const entering = enteringIds.has(item.id) ? " is-entering" : "";
  return `
    <div class="todo-item${extra}${entering}" data-id="${item.id}">
      <div class="todo-item-inner">
        ${itemActions(item)}
      </div>
    </div>
  `;
}

function renderList() {
  const shown = visibleItems();
  if (state.view === "hold") {
    listEl.innerHTML = `
      <div class="hold-list">
        ${shown.map(itemMarkup).join("")}
      </div>
    `;
  } else {
    listEl.innerHTML = CATEGORIES.map((category) => {
      const grouped = shown.filter((item) => item.category === category);
      return `
        <section class="category" data-category="${category}">
          <div class="category-header">
            <img class="icon cate-icon" src="${CATEGORY_ICONS[category]}" alt="">
            <h2 class="cate-title">${category}</h2>
          </div>
          <div class="category-content">
            ${grouped.map(itemMarkup).join("")}
          </div>
        </section>
      `;
    }).join("");
  }

  if (enteringIds.size) {
    const ids = [...enteringIds];
    enteringIds.clear();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        ids.forEach((id) => {
          listEl.querySelector(`[data-id="${id}"]`)?.classList.remove("is-entering");
        });
      });
    });
  }
}

function renderComposer() {
  composer.classList.toggle("is-open", state.panelOpen);
  composer.querySelectorAll(".add-icon").forEach((button) => {
    button.classList.toggle("is-selected", button.dataset.category === state.selectedCategory);
  });
  const toggle = composer.querySelector(".toggle-form-btn");
  toggle.setAttribute("aria-label", state.panelOpen ? "입력창 닫기" : "할 일 추가");
}

function updateSliders() {
  const selected = dateButtons.find((button) => button.dataset.date === state.selectedDate);
  if (selected) {
    weekDaysEl.style.setProperty("--pill-x", `${selected.offsetLeft}px`);
    dateSlider.style.width = `${selected.offsetWidth}px`;
  }
  const active = filterBox.querySelector(".filter.is-active");
  if (active) {
    filterBox.style.setProperty("--pill-x", `${active.offsetLeft}px`);
    filterSlider.style.width = `${active.offsetWidth}px`;
  }
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function handleCheck(id) {
  const item = items.find((entry) => entry.id === id);
  if (!item) return;
  if (state.view === "todo") {
    const check = listEl.querySelector(`[data-id="${id}"] .todo-check`);
    check?.classList.add("is-checked");
    setTimeout(() => {
      animateRemove(id, () => setStatus(id, "done"));
    }, 160);
    return;
  }
  animateRemove(id, () => setStatus(id, "todo"));
}

root.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action]");
  if (!target || !root.contains(target)) return;
  const { action, id, date, view, category } = target.dataset;

  if (action === "prev-week") changeWeek(-1);
  if (action === "next-week") changeWeek(1);
  if (action === "select-date") selectDate(date || target.closest(".datebutton")?.dataset.date);
  if (action === "switch-view") switchView(view);
  if (action === "toggle-panel") togglePanel();
  if (action === "select-category") selectCategory(category);
  if (action === "check") handleCheck(id);
  if (action === "hold") animateRemove(id, () => setStatus(id, "hold"));
  if (action === "delete") animateRemove(id, () => deleteItem(id));
  if (action === "restore") animateRemove(id, () => moveHoldToToday(id));
});

addForm.addEventListener("submit", (event) => {
  event.preventDefault();
  addItem(taskInput.value, state.selectedCategory);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && state.panelOpen) {
    state.panelOpen = false;
    renderComposer();
  }
});

function render() {
  renderDateBar();
  renderTabs();
  renderList();
  renderComposer();
  requestAnimationFrame(updateSliders);
}

window.addEventListener("resize", updateSliders);

render();
