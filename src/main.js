const DATA_URL = 'src/data.json';

// DOM Elements
const currentDateEl = document.getElementById('current-date');
const currentPrayerEl = document.getElementById('current-prayer');
const currentTimeEl = document.getElementById('current-time');
const nextPrayerEl = document.getElementById('next-prayer');
const nextTimeEl = document.getElementById('next-time');
const hoursEl = document.getElementById('hours');
const minutesEl = document.getElementById('minutes');
const secondsEl = document.getElementById('seconds');

// Parse "1 Jan" → Date (current year)
function parseDate(dateStr) {
  const [day, monthName] = dateStr.trim().split(' ');
  const months = {
    "Jan": 0, "Feb": 1, "Mar": 2, "Apr": 3,
    "May": 4, "Jun": 5, "Jul": 6, "Aug": 7,
    "Sep": 8, "Oct": 9, "Nov": 10, "Dec": 11
  };
  const year = new Date().getFullYear();
  return new Date(year, months[monthName], parseInt(day, 10));
}

// "05:14 AM" → minutes since midnight
function timeToMinutes(timeStr) {
  const match = timeStr.trim().match(/(\d{1,2}):(\d{2})\s*([APap][Mm])/);
  if (!match) return 0;
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const period = match[3].toUpperCase();

  if (h === 12 && period === "AM") h = 0;
  else if (h < 12 && period === "PM") h += 12;

  return h * 60 + m;
}

// Get data for a specific civil date
async function getDataForDate(targetDate) {
  try {
    const res = await fetch(DATA_URL);
    const data = await res.json();
    let best = null;
    for (const row of data) {
      const rowDate = parseDate(row.date);
      if (rowDate <= targetDate) {
        if (!best || rowDate > parseDate(best.date)) {
          best = row;
        }
      }
    }
    return best;
  } catch (err) {
    console.error("Failed to load data", err);
    return null;
  }
}

// Determine current and next prayer with Islamic day logic
async function getCurrentAndNext() {
  const now = new Date();
  const civilToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const civilYesterday = new Date(civilToday);
  civilYesterday.setDate(civilToday.getDate() - 1);

  const todayData = await getDataForDate(civilToday);
  const yesterdayData = await getDataForDate(civilYesterday);

  if (!todayData) return null;

  // Extract prayers for today
  const prayers = [
    { name: "Subhe Sadik", time: todayData["subhe sadik"] },
    { name: "Sunrise", time: todayData.sunrise },
    { name: "Johr", time: todayData.johr },
    { name: "Asr", time: todayData.asr },
    { name: "Magrib", time: todayData.magrib },
    { name: "Esha", time: todayData.esha }
  ]
    .map(p => ({ ...p, minutes: timeToMinutes(p.time) }))
    .sort((a, b) => a.minutes - b.minutes);

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const subhMinutes = timeToMinutes(todayData["subhe sadik"]);

  // Check if we're in early morning (after midnight but before Subhe Sadik)
  const isAfterMidnight = now.getHours() < 5; // before 5 AM
  const isBeforeSubh = nowMinutes < subhMinutes;

  if (isAfterMidnight && isBeforeSubh && yesterdayData) {
    // Current = yesterday's Esha, Next = today's Subhe Sadik
    return {
      current: { name: "Esha", time: yesterdayData.esha },
      next: { name: "Subhe Sadik", time: todayData["subhe sadik"] },
      todayData
    };
  }

  // Normal flow
  let current = prayers[0];
  let next = null;

  for (const p of prayers) {
    if (p.minutes <= nowMinutes) current = p;
    if (p.minutes > nowMinutes && !next) next = p;
  }

  // If no next prayer today, get tomorrow's Subhe Sadik
  if (!next) {
    const civilTomorrow = new Date(civilToday);
    civilTomorrow.setDate(civilToday.getDate() + 1);
    const tomorrowData = await getDataForDate(civilTomorrow);
    if (tomorrowData) {
      next = { name: "Subhe Sadik", time: tomorrowData["subhe sadik"] };
    } else {
      next = prayers[0]; // fallback
    }
  }

  return { current, next, todayData };
}

// Set current date
function setCurrentDate() {
  const now = new Date();
  const options = { weekday: 'short', month: 'short', day: 'numeric' };
  currentDateEl.textContent = now.toLocaleDateString(undefined, options);
}

// Update UI
async function update() {
  const result = await getCurrentAndNext();
  if (!result) return;

  const { current, next } = result;

  // Update current prayer
  currentPrayerEl.textContent = current.name;
  currentTimeEl.textContent = current.time;

  // Update next prayer
  nextPrayerEl.textContent = next.name;
  nextTimeEl.textContent = next.time;

  // === COUNTDOWN LOGIC ===
  const nextTimeStr = next.time;
  if (!nextTimeStr) return;

  const match = nextTimeStr.trim().match(/(\d{1,2}):(\d{2})\s*([APap][Mm])/);
  if (!match) return;

  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const period = match[3].toUpperCase();

  if (h === 12 && period === "AM") h = 0;
  else if (h < 12 && period === "PM") h += 12;

  const nextTime = new Date();
  nextTime.setHours(h, m, 0, 0);

  // If in the past, add 1 day
  if (nextTime < new Date()) {
    nextTime.setDate(nextTime.getDate() + 1);
  }

  // Calculate difference
  const diff = nextTime - new Date();
  const totalSeconds = Math.max(0, Math.floor(diff / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  // Update display
  hoursEl.textContent = String(hours).padStart(2, '0');
  minutesEl.textContent = String(minutes).padStart(2, '0');
  secondsEl.textContent = String(seconds).padStart(2, '0');
}

// Populate Table
async function populateTable() {
  try {
    const res = await fetch(DATA_URL);
    const data = await res.json();
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = '';
    data.forEach(row => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${row.date}</td>
        <td>${row["subhe sadik"]}</td>
        <td>${row.sunrise}</td>
        <td>${row.johr}</td>
        <td>${row.asr}</td>
        <td>${row.magrib}</td>
        <td>${row.esha}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    document.getElementById('table-body').innerHTML = `
      <tr><td colspan="7">Failed to load</td></tr>
    `;
  }
}

// 🌙 Theme Toggle
const themeToggleBtn = document.getElementById('theme-toggle');
const themeIcon = themeToggleBtn.querySelector('i');
const STORAGE_KEY = 'salat-theme';

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  if (theme === 'dark') {
    themeIcon.classList.replace('fa-moon', 'fa-sun');
    themeToggleBtn.setAttribute('aria-label', 'Light Mode');
  } else {
    themeIcon.classList.replace('fa-sun', 'fa-moon');
    themeToggleBtn.setAttribute('aria-label', 'Dark Mode');
  }
}

// Init
document.addEventListener('DOMContentLoaded', () => {
  // Apply saved theme
  const savedTheme = localStorage.getItem(STORAGE_KEY) || 'light';
  applyTheme(savedTheme);

  // Initialize
  setCurrentDate();
  populateTable();
  update();
  setInterval(update, 1000); // Update every second

  // Modal Controls
  const modal = document.getElementById('modal');
  const openBtn = document.getElementById('open-table');
  const closeBtn = document.getElementById('modal-close');

  openBtn.addEventListener('click', () => modal.classList.add('active'));
  closeBtn.addEventListener('click', () => modal.classList.remove('active'));
  modal.addEventListener('click', e => {
    if (e.target === modal) {
      modal.classList.remove('active');
    }
  });

  // Theme toggle
  themeToggleBtn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem(STORAGE_KEY, next);
  });
});
