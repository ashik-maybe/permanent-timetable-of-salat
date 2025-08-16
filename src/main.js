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

// Parse "1 Jan" → Date (uses current year)
function parseDate(dateStr) {
  const [day, monthName] = dateStr.split(' ');
  const months = { "Jan":0,"Feb":1,"Mar":2,"Apr":3,"May":4,"Jun":5,"Jul":6,"Aug":7,"Sep":8,"Oct":9,"Nov":10,"Dec":11 };
  const year = new Date().getFullYear();
  return new Date(year, months[monthName], parseInt(day));
}

// Get today's data
async function getTodayData() {
  try {
    const res = await fetch(DATA_URL);
    const data = await res.json();
    const today = new Date();
    let best = null;

    for (const row of data) {
      const rowDate = parseDate(row.date);
      if (rowDate <= today) {
        if (!best || rowDate > parseDate(best.date)) {
          best = row;
        }
      }
    }

    return best || data[0];
  } catch (err) {
    console.error("Load failed", err);
    return null;
  }
}

// "05:14 AM" → minutes
function timeToMinutes(timeStr) {
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return 0;
  let h = parseInt(match[1]);
  const m = parseInt(match[2]);
  const period = match[3].toUpperCase();

  if (h === 12 && period === "AM") h = 0;
  else if (h < 12 && period === "PM") h += 12;

  return h * 60 + m;
}

// Set current date
function setCurrentDate() {
  const now = new Date();
  const options = { weekday: 'short', month: 'short', day: 'numeric' };
  currentDateEl.textContent = now.toLocaleDateString(undefined, options);
}

// Update UI
async function update() {
  const data = await getTodayData();
  if (!data) return;

  const prayers = [
    { name: "Subhe Sadik", time: data["subhe sadik"] },
    { name: "Sunrise", time: data.sunrise },
    { name: "Johr", time: data.johr },
    { name: "Asr", time: data.asr },
    { name: "Magrib", time: data.magrib },
    { name: "Esha", time: data.esha }
  ].map(p => ({ ...p, minutes: timeToMinutes(p.time) }))
  .sort((a, b) => a.minutes - b.minutes);

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  let current = prayers[0];
  let next = prayers[0];

  for (const p of prayers) {
    if (p.minutes <= nowMinutes) current = p;
    if (p.minutes > nowMinutes) {
      next = p;
      break;
    }
  }

  if (!next || next === current) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextData = await getTodayData();
    const nextMinutes = timeToMinutes(nextData["subhe sadik"]) + 1440;
    next = { name: "Subhe Sadik", time: nextData["subhe sadik"], minutes: nextMinutes };
  }

  // Update DOM
  currentPrayerEl.textContent = current.name;
  currentTimeEl.textContent = current.time;
  nextPrayerEl.textContent = next.name;
  nextTimeEl.textContent = next.time;

  // Countdown with seconds
  const nowSec = now.getTime() / 1000;
  const nextTime = new Date(now);
  const [h, mRaw] = next.time.split(':');
  const m = mRaw.split(' ')[0];
  const period = next.time.includes('PM') && h !== '12';
  let hours = parseInt(h);
  if (period) hours += 12;
  if (!period && h === '12') hours = 0;

  nextTime.setHours(hours, parseInt(m), 0, 0);
  if (next.minutes < nowMinutes) nextTime.setDate(nextTime.getDate() + 1);

  const diffSec = Math.max(0, (nextTime.getTime() / 1000) - nowSec);
  const hoursLeft = Math.floor(diffSec / 3600);
  const minsLeft = Math.floor((diffSec % 3600) / 60);
  const secsLeft = Math.floor(diffSec % 60);

  hoursEl.textContent = String(hoursLeft).padStart(2, '0');
  minutesEl.textContent = String(minsLeft).padStart(2, '0');
  secondsEl.textContent = String(secsLeft).padStart(2, '0');
}

// Populate Table
async function populateTable() {
  try {
    const res = await fetch(DATA_URL);
    const data = await res.json();
    const tbody = document.getElementById('table-body');
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
    document.getElementById('table-body').innerHTML = `<tr><td colspan="7">Failed to load</td></tr>`;
  }
}

// 🌙 Theme Toggle Logic
const themeToggleBtn = document.getElementById('theme-toggle');
const themeIcon = themeToggleBtn.querySelector('i');
const STORAGE_KEY = 'salat-theme';

function getSavedTheme() {
  return localStorage.getItem(STORAGE_KEY) || 'light';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  if (theme === 'dark') {
    themeIcon.classList.replace('fa-moon', 'fa-sun');
    themeToggleBtn.setAttribute('aria-label', 'Switch to light theme');
  } else {
    themeIcon.classList.replace('fa-sun', 'fa-moon');
    themeToggleBtn.setAttribute('aria-label', 'Switch to dark theme');
  }
}

// ✅ DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  // Apply saved theme
  const savedTheme = getSavedTheme();
  applyTheme(savedTheme);

  // Initialize app
  setCurrentDate();
  populateTable();
  update();
  setInterval(update, 1000); // Update every second

  // Modal Controls
  const modal = document.getElementById('modal');
  const modalCloseBtn = document.getElementById('modal-close');
  const openTableBtn = document.getElementById('open-table');

  openTableBtn.addEventListener('click', () => {
    modal.classList.add('active');
  });

  modalCloseBtn.addEventListener('click', () => {
    modal.classList.remove('active');
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('active');
    }
  });

  // Theme Toggle
  themeToggleBtn.addEventListener('click', () => {
    const currentTheme = getSavedTheme();
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    applyTheme(newTheme);
    localStorage.setItem(STORAGE_KEY, newTheme);
  });
});
