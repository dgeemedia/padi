// src/js/main.js

async function loadPartial(id, file, callback) {
  try {
    const res = await fetch(file);
    const html = await res.text();
    const el = document.getElementById(id);
    if (el) {
      el.innerHTML = html;
      if (callback) callback();
    }
  } catch (err) {
    console.error(`Error loading ${file}:`, err);
  }
}

// Detect path depth
const isInPagesFolder = window.location.pathname.includes("/pages/");
const basePath = isInPagesFolder ? ".." : ".";

// Header
loadPartial("header-placeholder", `${basePath}/partials/header.html`, () => {
  const toggleButton = document.getElementById("menu-toggle");
  const navMenu = document.getElementById("nav-menu");

  if (toggleButton && navMenu) {
    toggleButton.addEventListener("click", () => {
      toggleButton.classList.toggle("open");
      navMenu.classList.toggle("open");
    });
  }
});

// Footer
loadPartial("footer-placeholder", `${basePath}/partials/footer.html`);

// Hero (index only)
if (document.getElementById("hero-placeholder")) {
  loadPartial("hero-placeholder", `${basePath}/partials/hero.html`, () => {
    const slides = document.querySelectorAll('.slide');
    const prevBtn = document.querySelector('.prev');
    const nextBtn = document.querySelector('.next');
    const dotsContainer = document.querySelector('.dots');

    let currentIndex = 0;
    let slideInterval;

    // Create dots dynamically
    slides.forEach((_, i) => {
      const dot = document.createElement("span");
      dot.classList.add("dot");
      if (i === 0) dot.classList.add("active");
      dot.addEventListener("click", () => goToSlide(i));
      dotsContainer.appendChild(dot);
    });

    const dots = document.querySelectorAll(".dot");

    function showSlide(index) {
      slides.forEach(slide => slide.classList.remove("active"));
      dots.forEach(dot => dot.classList.remove("active"));
      slides[index].classList.add("active");
      dots[index].classList.add("active");
      currentIndex = index;
    }

    function nextSlide() {
      let nextIndex = (currentIndex + 1) % slides.length;
      showSlide(nextIndex);
    }

    function prevSlide() {
      let prevIndex = (currentIndex - 1 + slides.length) % slides.length;
      showSlide(prevIndex);
    }

    function goToSlide(index) {
      showSlide(index);
      resetInterval();
    }

    function startInterval() {
      slideInterval = setInterval(nextSlide, 5000);
    }

    function resetInterval() {
      clearInterval(slideInterval);
      startInterval();
    }

    // Event listeners
    if (nextBtn) nextBtn.addEventListener("click", () => { nextSlide(); resetInterval(); });
    if (prevBtn) prevBtn.addEventListener("click", () => { prevSlide(); resetInterval(); });

    // ===============================
    // Swipe / Drag support
    // ===============================
    let startX = 0;
    let endX = 0;

    const slider = document.querySelector('.slider');

    // Touch Events
    slider.addEventListener("touchstart", e => {
      startX = e.touches[0].clientX;
    });

    slider.addEventListener("touchend", e => {
      endX = e.changedTouches[0].clientX;
      handleSwipe();
    });

    // Mouse Events (for desktop drag)
    slider.addEventListener("mousedown", e => {
      startX = e.clientX;
    });

    slider.addEventListener("mouseup", e => {
      endX = e.clientX;
      handleSwipe();
    });

    function handleSwipe() {
      const diff = endX - startX;
      if (Math.abs(diff) > 50) { // threshold to detect swipe
        if (diff > 0) {
          prevSlide();
        } else {
          nextSlide();
        }
        resetInterval();
      }
    }

    // Start auto-slide
    startInterval();
  });
}

// Services (index only)
if (document.getElementById("services-placeholder")) {
  loadPartial("services-placeholder", `${basePath}/partials/services.html`);
}
