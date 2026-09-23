(function () {
  "use strict";

  function initHomepage() {
    const body = document.body;
    const home = document.getElementById("peopoleHomepage");

    if (!home) return;

    body.classList.add("homepage-active");

    const menuBtn = document.getElementById("homeMenuBtn");
    const mobileNav = document.getElementById("homeMobileNav");

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

    function openConsultation() {
      closeMobileNav();

      const stageModal = document.getElementById("stageModalBackdrop");

      if (!stageModal) {
        console.error("Peopole AI: existing consultation flow not found.");
        return;
      }

      body.classList.remove("homepage-active");

      stageModal.classList.remove("hidden");
      stageModal.setAttribute("aria-hidden", "false");
    }

    function openAdvisor() {
      closeMobileNav();

      const existingWhatsApp = document.querySelector(
        '.whatsapp-btn[href*="wa.me"]'
      );

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

    [
      "homeJourneyBtn",
      "homeHeroJourney",
      "homeFinalJourney",
      "homeMobileJourney"
    ].forEach(function (id) {
      const element = document.getElementById(id);
      if (element) element.addEventListener("click", openConsultation);
    });

    [
      "homeAdvisorBtn",
      "homeHeroAdvisor",
      "homeFinalAdvisor",
      "homeMobileAdvisor"
    ].forEach(function (id) {
      const element = document.getElementById(id);
      if (element) element.addEventListener("click", openAdvisor);
    });

    const frameworkLink = document.getElementById("homeFrameworkLink");

    if (frameworkLink) {
      frameworkLink.addEventListener("click", function () {
        document.getElementById("homeFramework")?.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "auto"
            : "smooth",
          block: "start"
        });
      });
    }

    const languageButtons = [
      document.getElementById("homeLangBtn")
    ].filter(Boolean);

    languageButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        const existingLanguageButton = document.getElementById("langBtn");

        if (existingLanguageButton) {
          existingLanguageButton.click();
        }
      });
    });

    const nav = document.getElementById("homeNav");

    window.addEventListener(
      "scroll",
      function () {
        if (!nav) return;

        nav.classList.toggle("scrolled", window.scrollY > 20);
      },
      { passive: true }
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initHomepage);
  } else {
    initHomepage();
  }
})();
