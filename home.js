
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
  document.getElementById('profileBtn').addEventListener('click', function() {
    window.location.href = 'profile.html';
  });
  const profileBtn = document.getElementById("profileBtn");

// Suppose your saved profile picture URL is stored in `profilePicURL`
let profilePicURL = localStorage.getItem("profilePic");  // example: load from storage or database

if (profilePicURL) {
  const img = document.createElement("img");
  img.src = profilePicURL;
  img.alt = "Profile Picture";
  img.style.width = "30px";
  img.style.height = "30px";
  img.style.borderRadius = "50%";
  img.style.objectFit = "cover";

  profileBtn.innerHTML = "";       // remove "Profile" text
  profileBtn.appendChild(img);     // put image in button
}
