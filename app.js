// State
let balance = 1247;
let selectedRate = 12;
let selectedWasteName = 'Пластик';

// Navbar scroll effect
window.addEventListener('scroll', () => {
  document.getElementById('navbar').classList.toggle('scrolled', window.scrollY > 50);
});

// Counter animation
function animateCounter(el) {
  const target = parseInt(el.dataset.target);
  const duration = 2000;
  const step = target / (duration / 16);
  let current = 0;
  const timer = setInterval(() => {
    current = Math.min(current + step, target);
    el.textContent = Math.floor(current).toLocaleString('ru-RU');
    if (current >= target) clearInterval(timer);
  }, 16);
}

// Intersection observer for counters
const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      animateCounter(e.target);
      observer.unobserve(e.target);
    }
  });
}, { threshold: 0.5 });

document.querySelectorAll('[data-target]').forEach(el => observer.observe(el));

// Activity bars
function initActivityBars() {
  const days = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
  const values = [45, 70, 30, 85, 60, 90, 55];
  const container = document.getElementById('activityBars');
  if (!container) return;
  const max = Math.max(...values);
  container.innerHTML = days.map((d, i) => `
    <div class="act-bar" style="height:${(values[i]/max)*100}%" title="${values[i]} монет">
      <span class="act-label">${d}</span>
    </div>
  `).join('');
}
initActivityBars();

// Smooth scroll
function scrollTo(selector) {
  document.querySelector(selector)?.scrollIntoView({ behavior: 'smooth' });
}

// Show section (scroll to)
function showSection(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
}

// Modal
function addCoins() {
  document.getElementById('addModal').classList.add('show');
}
function closeModal() {
  document.getElementById('addModal').classList.remove('show');
}
document.getElementById('addModal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeModal();
});

// Waste selection
function selectWaste(btn, name) {
  document.querySelectorAll('.waste-opt').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  selectedRate = parseInt(btn.dataset.rate);
  selectedWasteName = name;
  calcCoins();
}

// Calc coins
function calcCoins() {
  const weight = parseFloat(document.getElementById('weightInput').value) || 0;
  document.getElementById('calcResult').textContent = Math.round(weight * selectedRate);
}

// Confirm add
function confirmAdd() {
  const weight = parseFloat(document.getElementById('weightInput').value) || 0;
  const earned = Math.round(weight * selectedRate);
  balance += earned;
  document.getElementById('balanceAmount').textContent = balance.toLocaleString('ru-RU');

  // Add transaction
  const txList = document.getElementById('txList');
  const now = new Date();
  const timeStr = now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0');
  const icons = { 'Пластик':'🧴','Бумага':'📦','Стекло':'🍾','Металл':'🔩' };
  const newTx = document.createElement('div');
  newTx.className = 'tx-item';
  newTx.style.animation = 'slideUp 0.3s ease';
  newTx.innerHTML = `
    <div class="tx-icon">${icons[selectedWasteName]}</div>
    <div class="tx-info"><span>${selectedWasteName} — ${weight} кг</span><small>Только что, ${timeStr}</small></div>
    <div class="tx-amount plus">+${earned} 🪙</div>
  `;
  txList.prepend(newTx);
  closeModal();

  // Flash balance
  const bal = document.getElementById('balanceAmount');
  bal.style.transform = 'scale(1.2)';
  bal.style.color = '#4ade80';
  setTimeout(() => { bal.style.transform = 'scale(1)'; bal.style.color = ''; }, 400);
}

// Buttons
document.getElementById('loginBtn').addEventListener('click', () => {
  alert('Вход через Telegram скоро будет доступен! 🔜');
});
document.getElementById('startBtn').addEventListener('click', () => {
  showSection('dashboard');
});

// Burger menu
document.getElementById('burger').addEventListener('click', () => {
  const links = document.getElementById('navLinks');
  links.style.display = links.style.display === 'flex' ? 'none' : 'flex';
  links.style.flexDirection = 'column';
  links.style.position = 'absolute';
  links.style.top = '64px';
  links.style.left = '0';
  links.style.right = '0';
  links.style.background = 'rgba(6,13,10,0.97)';
  links.style.padding = '20px 24px';
  links.style.gap = '20px';
  links.style.borderBottom = '1px solid rgba(34,197,94,0.15)';
});

// Waste bar animation on scroll
const wasteObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.querySelectorAll('.waste-fill').forEach(bar => {
        const w = bar.style.width;
        bar.style.width = '0';
        setTimeout(() => { bar.style.width = w; }, 100);
      });
    }
  });
}, { threshold: 0.3 });
const wasteCard = document.querySelector('.waste-card');
if (wasteCard) wasteObserver.observe(wasteCard);

// Card hover glow effect
document.querySelectorAll('.dash-card, .stat-card, .step-card, .partner-card, .pest-card').forEach(card => {
  card.addEventListener('mousemove', (e) => {
    const rect = card.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    card.style.setProperty('--mx', x + '%');
    card.style.setProperty('--my', y + '%');
  });
});

console.log('🌿 ЭКО Coin платформа загружена!');
