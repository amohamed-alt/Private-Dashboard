(() => {
  "use strict";

  function removeBestPlusLost() {
    document.querySelectorAll('[data-scenario="bestPlusLost"]').forEach((element) => element.remove());

    document.querySelectorAll("tr").forEach((row) => {
      const firstCell = row.querySelector("td, th");
      if (firstCell && firstCell.textContent.trim() === "Best + Lost") {
        row.remove();
      }
    });

    document.querySelectorAll(".kpi").forEach((card) => {
      const label = card.querySelector(".label");
      if (label && label.textContent.trim() === "Best + Lost") {
        card.remove();
      }
    });

    document.getElementById("management-cost-section")?.remove();
    document.getElementById("management-cost-styles")?.remove();
  }

  removeBestPlusLost();

  const observer = new MutationObserver(removeBestPlusLost);
  observer.observe(document.body, { childList: true, subtree: true });
})();
