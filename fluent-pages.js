(() => {
  "use strict";

  const embedded = window !== window.top;
  if (embedded) {
    document.body.classList.add("fluent-embedded");
    if (!document.body.dataset.embedded) {
      document.body.dataset.embedded = "true";
    }
  }
})();
