(function () {
  const navToggle = document.querySelector(".nav-toggle");
  const siteNav = document.querySelector(".site-nav");
  const yearEl = document.getElementById("year");

  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }

  const servicesDropdown = document.querySelector(".nav-dropdown");
  const servicesDropdownToggle = document.querySelector(".nav-dropdown-toggle");

  function closeServicesDropdown() {
    if (!servicesDropdown || !servicesDropdownToggle) return;
    servicesDropdown.classList.remove("is-open");
    servicesDropdownToggle.setAttribute("aria-expanded", "false");
  }

  if (servicesDropdown && servicesDropdownToggle) {
    servicesDropdownToggle.addEventListener("click", (event) => {
      event.stopPropagation();
      const open = servicesDropdown.classList.toggle("is-open");
      servicesDropdownToggle.setAttribute("aria-expanded", String(open));
    });

    document.addEventListener("click", (event) => {
      if (!servicesDropdown.contains(event.target)) {
        closeServicesDropdown();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeServicesDropdown();
      }
    });
  }

  if (navToggle && siteNav) {
    navToggle.addEventListener("click", () => {
      const open = siteNav.classList.toggle("is-open");
      document.body.classList.toggle("nav-open", open);
      navToggle.setAttribute("aria-expanded", String(open));
      navToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      if (!open) closeServicesDropdown();
    });

    siteNav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        siteNav.classList.remove("is-open");
        document.body.classList.remove("nav-open");
        navToggle.setAttribute("aria-expanded", "false");
        navToggle.setAttribute("aria-label", "Open menu");
        closeServicesDropdown();
      });
    });
  }

  const lightbox = document.getElementById("vb-lightbox");
  const lightboxImg = document.getElementById("vb-lightbox-img");
  const lightboxPrev = document.getElementById("vb-lightbox-prev");
  const lightboxNext = document.getElementById("vb-lightbox-next");
  let gallerySlides = [];
  let currentSlideIndex = 0;

  function anyServiceModalOpen() {
    return document.querySelector(".service-modal.is-open") !== null;
  }

  function syncGallerySlides(container) {
    if (!container) {
      gallerySlides = [];
      return;
    }
    gallerySlides = [...container.querySelectorAll(".vb-gallery-trigger img")].map((img) => ({
      src: img.currentSrc || img.src,
      alt: img.alt,
    }));
  }

  function setNavVisible(button, visible) {
    if (!button) return;
    button.hidden = !visible;
    button.disabled = !visible;
    button.setAttribute("aria-hidden", String(!visible));
  }

  function updateLightboxNav() {
    const total = gallerySlides.length;
    setNavVisible(lightboxPrev, total > 1 && currentSlideIndex > 0);
    setNavVisible(lightboxNext, total > 1 && currentSlideIndex < total - 1);
  }

  function showSlide(index) {
    if (!lightbox || !lightboxImg || !gallerySlides.length) return;
    currentSlideIndex = Math.max(0, Math.min(index, gallerySlides.length - 1));
    const slide = gallerySlides[currentSlideIndex];
    lightboxImg.src = slide.src;
    lightboxImg.alt = slide.alt || "Gallery photo";
    updateLightboxNav();
  }

  function openLightboxAt(index, container) {
    if (!lightbox || !lightboxImg) return;
    syncGallerySlides(container);
    if (!gallerySlides.length) return;
    showSlide(index);
    lightbox.classList.add("is-open");
    lightbox.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
  }

  function stepSlide(delta) {
    if (!lightbox?.classList.contains("is-open") || gallerySlides.length < 2) return;
    const nextIndex = currentSlideIndex + delta;
    if (nextIndex < 0 || nextIndex >= gallerySlides.length) return;
    showSlide(nextIndex);
  }

  function closeLightbox() {
    if (!lightbox) return;
    lightbox.classList.remove("is-open");
    lightbox.setAttribute("aria-hidden", "true");
    if (!anyServiceModalOpen()) {
      document.body.classList.remove("modal-open");
    }
    if (lightboxImg) lightboxImg.removeAttribute("src");
    currentSlideIndex = 0;
    gallerySlides = [];
  }

  function bindGalleryLightbox(container) {
    if (!container) return;
    container.querySelectorAll(".vb-gallery-trigger").forEach((btn, index) => {
      btn.addEventListener("click", (event) => {
        event.stopPropagation();
        openLightboxAt(index, container);
      });
    });
  }

  function renderGalleryItems(container, items) {
    if (!container) return;
    container.replaceChildren();
    items.forEach((item) => {
      const figure = document.createElement("figure");
      figure.className = "vb-gallery-item";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "vb-gallery-trigger";
      button.setAttribute("aria-label", "View larger image");
      const img = document.createElement("img");
      img.src = item.src;
      img.alt = item.alt;
      img.loading = "lazy";
      button.appendChild(img);
      figure.appendChild(button);
      container.appendChild(figure);
    });
    container.setAttribute("aria-busy", "false");
    bindGalleryLightbox(container);
  }

  function loadGallery(container, jsonUrl) {
    if (!container) return;
    fetch(jsonUrl)
      .then((response) => {
        if (!response.ok) throw new Error("Gallery unavailable");
        return response.json();
      })
      .then((items) => renderGalleryItems(container, items))
      .catch(() => {
        container.setAttribute("aria-busy", "false");
        container.innerHTML = '<p class="vb-gallery-error">Gallery photos could not be loaded.</p>';
      });
  }

  lightbox?.querySelectorAll("[data-close-lightbox]").forEach((el) => {
    el.addEventListener("click", closeLightbox);
  });

  lightboxPrev?.addEventListener("click", (event) => {
    event.stopPropagation();
    stepSlide(-1);
  });

  lightboxNext?.addEventListener("click", (event) => {
    event.stopPropagation();
    stepSlide(1);
  });

  const serviceModals = new Map();

  function initServiceModal(config) {
    const modal = document.getElementById(config.modalId);
    const gallery = document.getElementById(config.galleryId);
    if (!modal) return;

    let lastFocus = null;

    const openModal = () => {
      lastFocus = document.activeElement;
      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden", "false");
      document.body.classList.add("modal-open");
      modal.querySelector(".service-modal-close")?.focus();
    };

    const closeModal = () => {
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
      closeLightbox();
      if (!anyServiceModalOpen()) {
        document.body.classList.remove("modal-open");
      }
      if (lastFocus && typeof lastFocus.focus === "function") {
        lastFocus.focus();
      }
    };

    serviceModals.set(config.modalId, { openModal, closeModal });

    loadGallery(gallery, config.jsonUrl);

    const trigger = document.querySelector(`[data-service-modal='${config.modalId}']`);
    if (trigger) {
      trigger.addEventListener("click", openModal);
      trigger.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openModal();
        }
      });
    }

    document.querySelectorAll(`[data-open-service-modal='${config.modalId}']`).forEach((el) => {
      el.addEventListener("click", (event) => {
        event.preventDefault();
        openModal();
      });
    });

    modal.querySelectorAll("[data-close-modal]").forEach((el) => {
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

    modal.querySelector(".service-modal-backdrop")?.addEventListener("click", closeModal);

    if (config.hash && window.location.hash === config.hash) {
      openModal();
    }
  }

  const SERVICE_GALLERY_URLS = [
    "data/vehicle-branding-gallery.json",
    "data/dealer-boards-gallery.json",
    "data/interior-branding-gallery.json",
    "data/display-units-gallery.json",
    "data/3d-signage-gallery.json",
    "data/exhibition-stalls-gallery.json",
    "data/billboards-gallery.json",
    "data/lightboxes-gallery.json",
  ];

  function interleaveGalleries(galleries) {
    const items = [];
    const maxLen = Math.max(0, ...galleries.map((gallery) => gallery.length));
    for (let i = 0; i < maxLen; i += 1) {
      galleries.forEach((gallery) => {
        if (gallery[i]) items.push(gallery[i]);
      });
    }
    return items;
  }

  function loadAllServiceGalleryItems() {
    return Promise.all(
      SERVICE_GALLERY_URLS.map((url) =>
        fetch(url)
          .then((response) => (response.ok ? response.json() : []))
          .then((items) => (Array.isArray(items) ? items : []))
          .catch(() => [])
      )
    ).then(interleaveGalleries);
  }

  initServiceModal({
    modalId: "vehicle-branding-modal",
    galleryId: "vehicle-branding-modal-gallery",
    jsonUrl: SERVICE_GALLERY_URLS[0],
    hash: "#vehicle-branding",
  });

  initServiceModal({
    modalId: "dealer-boards-modal",
    galleryId: "dealer-boards-modal-gallery",
    jsonUrl: SERVICE_GALLERY_URLS[1],
    hash: "#dealer-boards",
  });

  initServiceModal({
    modalId: "interior-branding-modal",
    galleryId: "interior-branding-modal-gallery",
    jsonUrl: SERVICE_GALLERY_URLS[2],
    hash: "#interior-branding",
  });

  initServiceModal({
    modalId: "display-units-modal",
    galleryId: "display-units-modal-gallery",
    jsonUrl: SERVICE_GALLERY_URLS[3],
    hash: "#display-units",
  });

  initServiceModal({
    modalId: "3d-signage-modal",
    galleryId: "3d-signage-modal-gallery",
    jsonUrl: SERVICE_GALLERY_URLS[4],
    hash: "#3d-signage",
  });

  initServiceModal({
    modalId: "exhibition-stalls-modal",
    galleryId: "exhibition-stalls-modal-gallery",
    jsonUrl: SERVICE_GALLERY_URLS[5],
    hash: "#exhibition-stalls",
  });

  initServiceModal({
    modalId: "billboards-modal",
    galleryId: "billboards-modal-gallery",
    jsonUrl: SERVICE_GALLERY_URLS[6],
    hash: "#billboards",
  });

  initServiceModal({
    modalId: "lightboxes-modal",
    galleryId: "lightboxes-modal-gallery",
    jsonUrl: SERVICE_GALLERY_URLS[7],
    hash: "#lightboxes",
  });

  function initHeroGalleryRotator() {
    const heroVisual = document.querySelector(".hero-visual[data-hero-gallery]");
    const mainImg = document.getElementById("hero-main-img");
    const secondaryImg = document.getElementById("hero-secondary-img");

    if (!heroVisual || !mainImg || !secondaryImg) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ROTATE_MS = 5000;
    const FADE_MS = 450;

    loadAllServiceGalleryItems()
      .then((items) => {
        if (items.length < 2) return;

        let index = 0;

        const applySlide = (img, item) => {
          img.src = item.src;
          img.alt = item.alt || "Supreme Advertising signage project";
        };

        const preload = (item) => {
          const image = new Image();
          image.src = item.src;
        };

        items.forEach(preload);

        const swapImage = (img, item) => {
          img.classList.add("is-fading");
          window.setTimeout(() => {
            applySlide(img, item);
            requestAnimationFrame(() => {
              img.classList.remove("is-fading");
            });
          }, FADE_MS);
        };

        const rotate = () => {
          index = (index + 1) % items.length;
          const secondaryIndex = (index + 1) % items.length;
          swapImage(mainImg, items[index]);
          swapImage(secondaryImg, items[secondaryIndex]);
        };

        applySlide(mainImg, items[0]);
        applySlide(secondaryImg, items[1]);

        if (!prefersReducedMotion) {
          window.setInterval(rotate, ROTATE_MS);
        }
      })
      .catch(() => {
        /* Keep static fallback images from HTML */
      });
  }

  initHeroGalleryRotator();

  const clientsGrid = document.getElementById("clients-grid");

  if (clientsGrid) {
    fetch("data/clients.json")
      .then((response) => {
        if (!response.ok) throw new Error("Clients unavailable");
        return response.json();
      })
      .then((clients) => {
        clientsGrid.innerHTML = clients
          .map(
            (client) => `
          <li class="clients-item">
            <img src="${client.logo}" alt="${client.name}" loading="lazy" decoding="async" />
          </li>`
          )
          .join("");
        clientsGrid.removeAttribute("aria-busy");
      })
      .catch(() => {
        clientsGrid.classList.add("is-error");
        clientsGrid.textContent = "Client logos could not be loaded.";
        clientsGrid.removeAttribute("aria-busy");
      });
  }

  document.addEventListener("keydown", (event) => {
    if (lightbox?.classList.contains("is-open")) {
      if (event.key === "ArrowLeft" && !lightboxPrev?.hidden) {
        event.preventDefault();
        stepSlide(-1);
        return;
      }
      if (event.key === "ArrowRight" && !lightboxNext?.hidden) {
        event.preventDefault();
        stepSlide(1);
        return;
      }
      if (event.key === "Escape") {
        closeLightbox();
        return;
      }
    }

    if (event.key === "Escape") {
      document.querySelectorAll(".service-modal.is-open").forEach((modal) => {
        serviceModals.get(modal.id)?.closeModal();
      });
    }
  });
})();
