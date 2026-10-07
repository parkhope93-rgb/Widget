const STORAGE_KEY = "todo-widget-items";
const CATEGORY_KEY = "todo-widget-category";
const MEMO_KEY = "todo-widget-memos";
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const CATEGORIES = ["SCHEDULE", "SKKU", "ESF", "MRCC", "GUITAR"];
const CATEGORY_ICONS = {
  SCHEDULE: "img/Calendar.svg",
  SKKU: "img/skku.svg",
  ESF: "img/esf.svg",
  MRCC: "img/mrcc.svg",
  GUITAR: "img/guitar.svg",
};

const root = document.querySelector(".to-do");
const monthTitleEl = document.getElementById("calendar-month");
const doneCountEl = document.getElementById("done-count-num");
const calendarGrid = document.getElementById("calendar-grid");
const listEl = document.getElementById("item-list");
const composer = document.querySelector(".composer");
const addForm = document.getElementById("add-form");
const taskInput = addForm.querySelector(".task-input");
const memoInput = document.getElementById("memo-input");

const state = {
  page: "todo",
  view: "todo",
  selectedDate: todayStr(),
  visibleMonth: monthKey(todayStr()),
  panelOpen: false,
  selectedCategory: localStorage.getItem(CATEGORY_KEY) || "SCHEDULE",
};

let items = loadItems();
let memos = loadMemos();
let enteringIds = new Set();
let fadeTimer = null;

function todayStr() {
  return formatDate(new Date());
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

function monthKey(dateStr) {
  return dateStr.slice(0, 7);
}

function addMonths(month, amount) {
  const [y, m] = month.split("-").map(Number);
  const date = new Date(y, m - 1 + amount, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function daysInMonth(month) {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m, 0).getDate();
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

function loadMemos() {
  try {
    const raw = localStorage.getItem(MEMO_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveMemos() {
  localStorage.setItem(MEMO_KEY, JSON.stringify(memos));
}

function changeMonth(direction) {
  state.visibleMonth = addMonths(state.visibleMonth, direction);
  const [year, month] = state.visibleMonth.split("-").map(Number);
  const selected = parseDate(state.selectedDate);
  const lastDay = daysInMonth(state.visibleMonth);
  const day = Math.min(selected.getDate(), lastDay);
  state.selectedDate = formatDate(new Date(year, month - 1, day));
  render();
}

function selectDate(date) {
  if (!date) return;
  state.selectedDate = date;
  state.visibleMonth = monthKey(date);
  render();
}

function switchPage(page) {
  if (page === state.page) return;
  if (page !== "todo" && state.panelOpen) state.panelOpen = false;
  state.page = page;
  render();
}

function addItem(text, category) {
  const trimmed = text.trim();
  if (!trimmed) return;
  items.push({
    id: uid(),
    text: trimmed,
    category,
    date: state.selectedDate,
    status: "todo",
  });
  enteringIds.add(items[items.length - 1].id);
  saveItems();
  render();
  taskInput.value = "";
  taskInput.focus();
}

function deleteItem(id) {
  items = items.filter((entry) => entry.id !== id);
  saveItems();
  render();
}

function togglePanel() {
  state.panelOpen = !state.panelOpen;
  renderComposer();
  if (state.panelOpen) taskInput.focus();
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

function dateMark(dateStr) {
  const dayItems = items.filter((item) => item.date === dateStr && item.status !== "hold");
  const todos = dayItems.filter((item) => item.status === "todo");
  const dones = dayItems.filter((item) => item.status === "done");
  if (todos.length > 0) return { type: "count", value: todos.length };
  if (dones.length > 0) return { type: "done" };
  return { type: "empty" };
}

function visibleItems() {
  return items.filter(
    (item) => item.date === state.selectedDate && (item.status === "todo" || item.status === "done")
  );
}

function renderCalendar() {
  const [year, month] = state.visibleMonth.split("-").map(Number);
  monthTitleEl.textContent = `${year} ${MONTH_LABELS[month - 1]}`;
  doneCountEl.textContent = String(items.filter((item) => item.status === "done").length);

  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const totalDays = daysInMonth(state.visibleMonth);
  const cells = [];

  for (let i = 0; i < firstWeekday; i += 1) {
    cells.push(`<div class="cal-cell is-empty"></div>`);
  }

  for (let day = 1; day <= totalDays; day += 1) {
    const date = formatDate(new Date(year, month - 1, day));
    const weekday = new Date(year, month - 1, day).getDay();
    const mark = dateMark(date);
    const classes = [
      "cal-cell",
      weekday === 0 ? "is-sun" : "",
      weekday === 6 ? "is-sat" : "",
      date === state.selectedDate ? "is-selected" : "",
      mark.type === "done" ? "is-done" : "",
      mark.type === "count" ? "has-count" : "",
    ].filter(Boolean).join(" ");
    const markContent = mark.type === "count" ? mark.value : "";
    cells.push(`
      <button class="${classes}" type="button" data-action="select-date" data-date="${date}">
        <span class="cal-mark">${markContent}</span>
        <time class="cal-day" datetime="${date}">${day}</time>
      </button>
    `);
  }

  calendarGrid.innerHTML = cells.join("");
}

function renderTabs() {
  root.dataset.page = state.page;
  root.dataset.view = "todo";
  root.querySelectorAll(".page-tab").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.page === state.page);
  });
}

function renderList() {
  const shown = visibleItems();
  listEl.innerHTML = CATEGORIES.map((category) => {
    const grouped = shown
      .filter((item) => item.category === category)
      .sort((a, b) => Number(a.status === "done") - Number(b.status === "done"));
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

function itemMarkup(item) {
  const entering = enteringIds.has(item.id) ? " is-entering" : "";
  const checked = item.status === "done" ? " is-checked" : "";
  return `
    <div class="todo-item${entering}" data-id="${item.id}">
      <div class="todo-item-inner">
        <button class="todo-check${checked}" type="button" data-action="check" data-id="${item.id}" aria-label="${item.status === "done" ? "완료 취소" : "완료"}"></button>
        <span class="todo-text">${escapeHtml(item.text)}</span>
        <button class="listfunction-icon" type="button" data-action="delete" data-id="${item.id}" aria-label="삭제">
          <img src="img/trash.svg" alt="">
        </button>
      </div>
    </div>
  `;
}

function renderComposer() {
  composer.classList.toggle("is-open", state.panelOpen);
  composer.querySelectorAll(".add-icon").forEach((button) => {
    button.classList.toggle("is-selected", button.dataset.category === state.selectedCategory);
  });
  composer.querySelector(".toggle-form-btn").setAttribute(
    "aria-label",
    state.panelOpen ? "입력창 닫기" : "할 일 추가"
  );
}

function renderMemo() {
  if (document.activeElement === memoInput) return;
  memoInput.value = memos[state.selectedDate] || "";
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function handleCheck(id) {
  const index = items.findIndex((entry) => entry.id === id);
  if (index === -1) return;
  const item = items[index];
  if (item.status === "done") {
    item.status = "todo";
  } else {
    item.status = "done";
    items.splice(index, 1);
    items.push(item);
  }
  saveItems();
  render();
}

root.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action]");
  if (!target || !root.contains(target)) return;
  const { action, id, date, page, category } = target.dataset;

  if (action === "prev-month") changeMonth(-1);
  if (action === "next-month") changeMonth(1);
  if (action === "select-date") selectDate(date);
  if (action === "switch-page") switchPage(page);
  if (action === "toggle-panel") togglePanel();
  if (action === "select-category") selectCategory(category);
  if (action === "check") handleCheck(id);
  if (action === "delete") animateRemove(id, () => deleteItem(id));
});

addForm.addEventListener("submit", (event) => {
  event.preventDefault();
  addItem(taskInput.value, state.selectedCategory);
});

memoInput.addEventListener("input", () => {
  memos[state.selectedDate] = memoInput.value;
  saveMemos();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && state.panelOpen) {
    state.panelOpen = false;
    renderComposer();
  }
});

function render() {
  renderCalendar();
  renderTabs();
  renderList();
  renderMemo();
  renderComposer();
}

render();
