const menuBtn = document.getElementById('menuBtn');
const sideMenu = document.getElementById('sideMenu');
const overlay = document.getElementById('overlay');
const themeToggle = document.getElementById('themeToggle');

menuBtn.addEventListener('click', () => {
  sideMenu.classList.add('open');
  overlay.style.display = 'block';
});

overlay.addEventListener('click', () => {
  sideMenu.classList.remove('open');
  overlay.style.display = 'none';
});

themeToggle.addEventListener('click', () => {
  document.body.classList.toggle('dark-mode');
});