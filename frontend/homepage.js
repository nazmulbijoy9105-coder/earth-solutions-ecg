(function () {
  "use strict";

  function initHomepage() {
    const body = document.body;
    const home = document.getElementById("peopoleHomepage");
    if (!home) return;

    body.classList.add("homepage-active");

    const menuBtn = document.getElementById("homeMenuBtn");
    const mobileNav = document.getElementById("homeMobileNav");
    const nav = document.getElementById("homeNav");

    function closeMobileNav() {
      if (!menuBtn || !mobileNav) return;
      mobileNav.classList.remove("open");
      mobileNav.setAttribute("aria-hidden", "true");
      menuBtn.setAttribute("aria-expanded", "false");
    }

    if (menuBtn && mobileNav) {
      menuBtn.addEventListener("click", function () {
        const open = mobileNav.classList.toggle("open");
        mobileNav.setAttribute("aria-hidden", String(!open));
        menuBtn.setAttribute("aria-expanded", String(open));
      });
      mobileNav.querySelectorAll("a").forEach(function (link) {
        link.addEventListener("click", closeMobileNav);
      });
    }

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeMobileNav();
    });
    window.addEventListener("resize", function () {
      if (window.innerWidth > 1100) closeMobileNav();
    });

    function openConsultation(stageId) {
      closeMobileNav();

      const stageModal = document.getElementById("stageModalBackdrop");
      if (!stageModal) {
        console.error("Peopole AI: existing consultation flow not found.");
        return;
      }

      body.classList.remove("homepage-active");
      window.scrollTo(0, 0);

      stageModal.classList.remove("hidden");
      stageModal.setAttribute("aria-hidden", "false");

      if (stageId) {
        const card = stageModal.querySelector('.stage-card[data-stage="' + stageId + '"]');
        if (card) card.click();
      }
    }

    function openAdvisor() {
      closeMobileNav();

      const existingWhatsApp = document.querySelector('.whatsapp-btn[href*="wa.me"]');
      if (existingWhatsApp) {
        existingWhatsApp.click();
        return;
      }

      window.open(
        "https://wa.me/8801535778111?text=Hello%20Peopole%20AI%2C%20I%20need%20academic%20guidance.",
        "_blank",
        "noopener"
      );
    }

    function bind(ids, handler) {
      ids.forEach(function (id) {
        const element = document.getElementById(id);
        if (element) element.addEventListener("click", handler);
      });
    }

    bind(["homeJourneyBtn", "homeHeroJourney", "homeFinalJourney", "homeMobileJourney"], function () {
      openConsultation();
    });
    bind(["homeAdvisorBtn", "homeHeroAdvisor", "homeFinalAdvisor", "homeMobileAdvisor"], openAdvisor);
    bind(["homeParentsMode"], function () {
      openConsultation(7);
    });

    document.querySelectorAll(".home-framework-disclosure").forEach(function (button) {
      button.addEventListener("click", function () {
        const targetId = button.getAttribute("aria-controls");
        const target = targetId ? document.getElementById(targetId) : null;
        if (!target) return;

        const expanded = button.getAttribute("aria-expanded") === "true";
        button.setAttribute("aria-expanded", String(!expanded));
        target.hidden = expanded;
        button.classList.toggle("is-expanded", !expanded);
      });
    });

    const frameworkLink = document.getElementById("homeFrameworkLink");
    if (frameworkLink) {
      frameworkLink.addEventListener("click", function () {
        const target = document.getElementById("homeFramework");
        if (target) {
          target.scrollIntoView({
            behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
            block: "start"
          });
        }
      });
    }

    function syncNav() {
      if (nav) nav.classList.toggle("scrolled", window.scrollY > 20);
    }
    window.addEventListener("scroll", syncNav, { passive: true });
    syncNav();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initHomepage);
  } else {
    initHomepage();
  }
})();
