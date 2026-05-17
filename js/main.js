(function () {
  const navToggle = document.querySelector(".nav-toggle");
  const siteNav = document.querySelector(".site-nav");
  const yearEl = document.getElementById("year");

  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }

  if (navToggle && siteNav) {
    navToggle.addEventListener("click", () => {
      const open = siteNav.classList.toggle("is-open");
      document.body.classList.toggle("nav-open", open);
      navToggle.setAttribute("aria-expanded", String(open));
      navToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    });

    siteNav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        siteNav.classList.remove("is-open");
        document.body.classList.remove("nav-open");
        navToggle.setAttribute("aria-expanded", "false");
        navToggle.setAttribute("aria-label", "Open menu");
      });
    });
  }

  const lightbox = document.getElementById("vb-lightbox");
  const lightboxImg = document.getElementById("vb-lightbox-img");
  const lightboxClose = document.querySelector("[data-close-lightbox]");

  function openLightbox(src, alt) {
    if (!lightbox || !lightboxImg) return;
    lightboxImg.src = src;
    lightboxImg.alt = alt || "Vehicle branding photo";
    lightbox.classList.add("is-open");
    lightbox.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
  }

  function closeLightbox() {
    if (!lightbox) return;
    lightbox.classList.remove("is-open");
    lightbox.setAttribute("aria-hidden", "true");
    if (!document.getElementById("vehicle-branding-modal")?.classList.contains("is-open")) {
      document.body.classList.remove("modal-open");
    }
    lightboxImg.removeAttribute("src");
  }

  function bindGalleryLightbox(container) {
    if (!container) return;
    container.querySelectorAll(".vb-gallery-trigger").forEach((btn) => {
      const img = btn.querySelector("img");
      if (!img) return;
      btn.addEventListener("click", (event) => {
        event.stopPropagation();
        openLightbox(img.src, img.alt);
      });
    });
  }

  const vehicleBrandingModal = document.getElementById("vehicle-branding-modal");
  const modalGallery = document.getElementById("vehicle-branding-modal-gallery");
  bindGalleryLightbox(modalGallery);

  lightboxClose?.addEventListener("click", closeLightbox);
  lightbox?.querySelector(".vb-lightbox-backdrop")?.addEventListener("click", closeLightbox);

  const vehicleBrandingTrigger = document.querySelector("[data-service-modal='vehicle-branding-modal']");
  const openModalTriggers = document.querySelectorAll("[data-open-vehicle-branding]");

  if (!vehicleBrandingModal) return;

  let lastFocus = null;

  const openModal = () => {
    lastFocus = document.activeElement;
    vehicleBrandingModal.classList.add("is-open");
    vehicleBrandingModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    vehicleBrandingModal.querySelector(".service-modal-close")?.focus();
  };

  const closeModal = () => {
    vehicleBrandingModal.classList.remove("is-open");
    vehicleBrandingModal.setAttribute("aria-hidden", "true");
    closeLightbox();
    document.body.classList.remove("modal-open");
    if (lastFocus && typeof lastFocus.focus === "function") {
      lastFocus.focus();
    }
  };

  if (vehicleBrandingTrigger) {
    vehicleBrandingTrigger.addEventListener("click", openModal);
    vehicleBrandingTrigger.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openModal();
      }
    });
  }

  openModalTriggers.forEach((el) => {
    el.addEventListener("click", (event) => {
      event.preventDefault();
      openModal();
    });
  });

  vehicleBrandingModal.querySelectorAll("[data-close-modal]").forEach((el) => {
    el.addEventListener("click", (event) => {
      if (el.tagName === "A" && el.getAttribute("href")?.startsWith("#")) {
        closeModal();
        return;
      }
      if (el.hasAttribute("data-close-modal")) {
        event.preventDefault();
        closeModal();
      }
    });
  });

  vehicleBrandingModal.querySelector(".service-modal-backdrop")?.addEventListener("click", closeModal);

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (lightbox?.classList.contains("is-open")) {
      closeLightbox();
      return;
    }
    if (vehicleBrandingModal.classList.contains("is-open")) {
      closeModal();
    }
  });

  if (window.location.hash === "#vehicle-branding") {
    openModal();
  }
})();
