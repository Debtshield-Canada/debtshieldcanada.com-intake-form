const form = document.querySelector("[data-intake-form]");
const success = document.querySelector("[data-success]");
const errorBox = document.querySelector("[data-error]");

const incomeRows = [
  ["employment", "Net employment income (after taxes)"],
  ["work_pension", "Work pensions"],
  ["gov_pension", "Gov't pensions"],
  ["child_support", "Child support"],
  ["child_benefit", "Child care benefit"],
  ["spousal_support", "Spousal support"],
  ["ei", "EI benefits"],
  ["ontario_works", "Ontario Works"],
  ["trillium", "Trillium (if received monthly)"],
  ["gross_self_employ", "Gross self-employment income"],
  ["net_self_employ", "Net self-employment income"],
  ["other", "Other income"],
];

const personalAssetRows = [
  ["pa_re1", "Real estate property 1"],
  ["pa_re2", "Real estate property 2"],
  ["pa_re3", "Real estate property 3"],
  ["pa_auto1", "Vehicle 1"],
  ["pa_auto2", "Vehicle 2"],
  ["pa_cash", "Cash"],
  ["pa_bank", "Bank account"],
  ["pa_furniture", "Furniture"],
  ["pa_insurance", "Life insurance / RRSP"],
  ["pa_securities", "Securities"],
  ["pa_rec", "Recreational vehicle"],
  ["pa_taxrefund", "Tax refund"],
  ["pa_other1", "Other"],
];

const businessAssetRows = [
  ["ba_re1", "Real estate property 1"],
  ["ba_re2", "Real estate property 2"],
  ["ba_re3", "Real estate property 3"],
  ["ba_auto1", "Vehicle 1"],
  ["ba_auto2", "Vehicle 2"],
  ["ba_cash", "Cash / bank account"],
  ["ba_furniture", "Furniture & fixtures"],
  ["ba_equipment", "Equipment / tools"],
  ["ba_inventory", "Inventory"],
  ["ba_ar", "Accounts receivable"],
  ["ba_taxrefund", "Tax refund"],
  ["ba_other1", "Other"],
];

if (form) {
  renderIncomeRows();
  renderAssetRows("personal", personalAssetRows);
  renderAssetRows("business", businessAssetRows);
  renderLiabilityRows("pl");
  renderLiabilityRows("bl");

  const panels = Array.from(form.querySelectorAll("[data-step-panel]"));
  const stepLabels = Array.from(form.querySelectorAll("[data-step-label]"));
  const stepCount = form.querySelector("[data-step-count]");
  const progressBar = form.querySelector("[data-progress-bar]");
  const previousButton = form.querySelector("[data-prev-step]");
  const nextButton = form.querySelector("[data-next-step]");
  const submitButton = form.querySelector("[data-submit-step]");
  const prefillPdfLink = form.querySelector("[data-prefill-pdf]");
  const fadeMs = 190;

  let activeStep = 0;
  let isTransitioning = false;
  let currentPdfUrl = "";

  updateStepUi();
  calculateAll();

  previousButton?.addEventListener("click", () => {
    showStep(activeStep - 1);
  });

  nextButton?.addEventListener("click", () => {
    if (validateStep()) {
      showStep(activeStep + 1);
    }
  });

  form.querySelectorAll("[data-add-liability]").forEach((button) => {
    button.addEventListener("click", () => {
      revealLiabilityRows(button.dataset.addLiability);
    });
  });

  prefillPdfLink?.addEventListener("click", async (event) => {
    event.preventDefault();
    calculateAll();
    hideError();

    const pdfWindow = window.open("", "_blank");
    const originalText = prefillPdfLink.textContent;

    try {
      prefillPdfLink.textContent = "Preparing PDF...";
      prefillPdfLink.setAttribute("aria-busy", "true");

      const pdfBytes = await buildPrefilledPdf();
      const pdfBlob = new Blob([pdfBytes], { type: "application/pdf" });

      if (currentPdfUrl) {
        URL.revokeObjectURL(currentPdfUrl);
      }

      currentPdfUrl = URL.createObjectURL(pdfBlob);
      prefillPdfLink.href = currentPdfUrl;

      if (pdfWindow) {
        pdfWindow.location.href = currentPdfUrl;
      } else {
        window.location.href = currentPdfUrl;
      }
    } catch (error) {
      console.error("Unable to prepare prefilled PDF:", error);
      showError("We could not prepare the PDF. Please try again from a local web server.");

      if (pdfWindow) {
        pdfWindow.close();
      }
    } finally {
      prefillPdfLink.textContent = originalText;
      prefillPdfLink.removeAttribute("aria-busy");
    }
  });

  form.addEventListener("input", (event) => {
    if (event.target.matches("[data-money], input[type='radio']")) {
      calculateAll();
    }
  });

  form.addEventListener("change", calculateAll);

  form.addEventListener(
    "blur",
    (event) => {
      if (event.target.matches("[data-money]") && event.target.value.trim()) {
        event.target.value = formatMoney(parseMoney(event.target.value));
      }
    },
    true
  );

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    if (!validateStep()) {
      return;
    }

    calculateAll();
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    console.log("Debt Shield intake payload:", payload);

    form.classList.add("is-fading");
    window.setTimeout(() => {
      form.hidden = true;
      form.classList.remove("is-fading");

      if (success) {
        success.hidden = false;
        success.classList.add("is-fading");
        window.requestAnimationFrame(() => {
          success.classList.remove("is-fading");
        });
      }
    }, fadeMs);
  });

  function showStep(nextStep) {
    if (
      isTransitioning ||
      nextStep < 0 ||
      nextStep >= panels.length ||
      nextStep === activeStep
    ) {
      return;
    }

    isTransitioning = true;
    hideError();

    const currentPanel = panels[activeStep];
    const nextPanel = panels[nextStep];

    currentPanel.classList.add("is-fading");

    window.setTimeout(() => {
      currentPanel.hidden = true;
      currentPanel.classList.remove("is-fading");

      nextPanel.hidden = false;
      nextPanel.classList.add("is-fading");
      activeStep = nextStep;
      updateStepUi();

      window.requestAnimationFrame(() => {
        nextPanel.classList.remove("is-fading");
        form.scrollIntoView({ behavior: "smooth", block: "start" });
        isTransitioning = false;
      });
    }, fadeMs);
  }

  function updateStepUi() {
    const totalSteps = panels.length;
    const currentPanel = panels[activeStep];
    const stepTitle = currentPanel?.dataset.stepTitle || "";

    if (stepCount) {
      stepCount.textContent = `Step ${activeStep + 1} of ${totalSteps}: ${stepTitle}`;
    }

    if (progressBar) {
      progressBar.style.width = `${((activeStep + 1) / totalSteps) * 100}%`;
    }

    stepLabels.forEach((label, index) => {
      label.classList.toggle("is-active", index === activeStep);
      label.classList.toggle("is-complete", index < activeStep);
    });

    if (previousButton) {
      previousButton.disabled = activeStep === 0;
    }

    if (nextButton) {
      nextButton.hidden = activeStep === totalSteps - 1;
    }

    if (submitButton) {
      submitButton.hidden = activeStep !== totalSteps - 1;
    }
  }

  function validateStep() {
    const currentPanel = panels[activeStep];
    const requiredFields = Array.from(currentPanel.querySelectorAll("[required]"));

    for (const field of requiredFields) {
      if (!field.checkValidity()) {
        showError("Please complete the required fields before continuing.");
        field.reportValidity();
        field.focus({ preventScroll: false });
        return false;
      }
    }

    hideError();
    return true;
  }

  function showError(message) {
    if (!errorBox) {
      return;
    }

    errorBox.textContent = message;
    errorBox.hidden = false;
  }

  function hideError() {
    if (!errorBox) {
      return;
    }

    errorBox.textContent = "";
    errorBox.hidden = true;
  }

  function revealLiabilityRows(prefix) {
    const rows = Array.from(form.querySelectorAll(`[data-liability-row="${prefix}"]`));
    const rowsToShow = rows.filter((row) => row.hidden).slice(0, 3);

    rowsToShow.forEach((row) => {
      row.hidden = false;
    });

    updateLiabilityButtons();
  }

  function updateLiabilityButtons() {
    form.querySelectorAll("[data-add-liability]").forEach((button) => {
      const prefix = button.dataset.addLiability;
      const hiddenRows = form.querySelectorAll(`[data-liability-row="${prefix}"][hidden]`);
      button.hidden = hiddenRows.length === 0;
    });
  }

  async function buildPrefilledPdf() {
    if (!window.PDFLib) {
      throw new Error("PDFLib is not loaded.");
    }

    const response = await fetch("./Intake_Form.pdf");

    if (!response.ok) {
      throw new Error(`Unable to load PDF template: ${response.status}`);
    }

    const templateBytes = await response.arrayBuffer();
    const pdfDoc = await window.PDFLib.PDFDocument.load(templateBytes);
    const pdfForm = pdfDoc.getForm();
    const payload = getPdfPayload();

    Object.entries(payload).forEach(([name, value]) => {
      fillPdfField(pdfForm, name, value);
    });

    pdfForm.updateFieldAppearances();

    return pdfDoc.save();
  }
}

function renderIncomeRows() {
  const container = document.querySelector("[data-income-rows]");

  if (!container) {
    return;
  }

  container.innerHTML = `
    <div class="entry-header">
      <span>Income source</span>
      <span>Applicant 1</span>
      <span>Applicant 2</span>
    </div>
    ${incomeRows
      .map(([key, label]) => {
        return `
          <div class="entry-row">
            <div class="entry-name">${escapeHtml(label)}</div>
            <label class="money-field">
              <span>Applicant 1</span>
              <input class="intake-input" name="inc_${key}_a1" inputmode="decimal" data-money />
            </label>
            <label class="money-field">
              <span>Applicant 2</span>
              <input class="intake-input" name="inc_${key}_a2" inputmode="decimal" data-money />
            </label>
          </div>
        `;
      })
      .join("")}
  `;
}

function renderAssetRows(type, rows) {
  const container = document.querySelector(`[data-asset-rows="${type}"]`);

  if (!container) {
    return;
  }

  container.innerHTML = `
    <div class="entry-header">
      <span>Asset</span>
      <span>Estimated value</span>
      <span>Debt owing</span>
      <span>Net</span>
    </div>
    ${rows
      .map(([key, label]) => {
        const escapedLabel = escapeHtml(label);
        const nameField =
          label === "Other"
            ? `<input class="intake-input asset-note" name="${key}_name" placeholder="Describe other asset" />`
            : `<input type="hidden" name="${key}_name" value="${escapedLabel}" />`;

        return `
          <div class="entry-row" data-asset-row="${key}">
            <div class="entry-name">
              ${escapedLabel}
              ${nameField}
            </div>
            <label class="money-field">
              <span>Estimated value</span>
              <input class="intake-input" name="${key}_value" inputmode="decimal" data-money />
            </label>
            <label class="money-field">
              <span>Debt owing</span>
              <input class="intake-input" name="${key}_debt" inputmode="decimal" data-money />
            </label>
            <div>
              <span class="mobile-field-label">Net</span>
              <output class="money-output" data-money-output="${key}_net">$0.00</output>
              <input type="hidden" name="${key}_net" data-money-hidden="${key}_net" />
            </div>
          </div>
        `;
      })
      .join("")}
  `;
}

function renderLiabilityRows(prefix) {
  const container = document.querySelector(`[data-liability-rows="${prefix}"]`);

  if (!container) {
    return;
  }

  const rows = Array.from({ length: 24 }, (_, index) => {
    const rowNumber = index + 1;
    const isHidden = rowNumber > 6 ? "hidden" : "";

    return `
      <div class="entry-row" data-liability-row="${prefix}" ${isHidden}>
        <label class="field">
          <span>Creditor ${rowNumber}</span>
          <input class="intake-input" name="${prefix}_${rowNumber}_creditor" />
        </label>
        <label class="field">
          <span>Account number</span>
          <input class="intake-input" name="${prefix}_${rowNumber}_account" />
        </label>
        <label class="money-field">
          <span>Amount</span>
          <input class="intake-input" name="${prefix}_${rowNumber}_amount" inputmode="decimal" data-money />
        </label>
      </div>
    `;
  }).join("");

  container.innerHTML = `
    <div class="entry-header">
      <span>Creditor</span>
      <span>Account number</span>
      <span>Amount</span>
    </div>
    ${rows}
  `;
}

function calculateAll() {
  if (!form) {
    return;
  }

  syncYesNoFields();
  calculateIncome();
  calculateAssets();
  calculateLiabilities("pl");
  calculateLiabilities("bl");
  calculateReview();
}

function calculateIncome() {
  const applicant1Total = incomeRows.reduce((total, [key]) => {
    return total + getMoney(`inc_${key}_a1`);
  }, 0);

  const applicant2Total = incomeRows.reduce((total, [key]) => {
    return total + getMoney(`inc_${key}_a2`);
  }, 0);

  setMoney("inc_total_a1", applicant1Total);
  setMoney("inc_total_a2", applicant2Total);
}

function calculateAssets() {
  const personal = calculateAssetGroup(personalAssetRows, "pa");
  const business = calculateAssetGroup(businessAssetRows, "ba");

  setMoney("as_total_value", personal.value + business.value);
  setMoney("as_total_debt", personal.debt + business.debt);
  setMoney("as_total_net", personal.net + business.net);
}

function calculateAssetGroup(rows, prefix) {
  const totals = rows.reduce(
    (total, [key]) => {
      const value = getMoney(`${key}_value`);
      const debt = getMoney(`${key}_debt`);
      const net = value - debt;

      setMoney(`${key}_net`, net);

      total.value += value;
      total.debt += debt;
      total.net += net;

      return total;
    },
    { value: 0, debt: 0, net: 0 }
  );

  setMoney(`${prefix}_subtotal_value`, totals.value);
  setMoney(`${prefix}_subtotal_debt`, totals.debt);
  setMoney(`${prefix}_subtotal_net`, totals.net);

  return totals;
}

function calculateLiabilities(prefix) {
  let total = 0;

  for (let index = 1; index <= 24; index += 1) {
    total += getMoney(`${prefix}_${index}_amount`);
  }

  setMoney(`${prefix}_total`, total);
}

function calculateReview() {
  const householdIncome = getMoney("inc_total_a1") + getMoney("inc_total_a2");
  const totalLiabilities = getMoney("pl_total") + getMoney("bl_total");
  const estimatedPosition = getMoney("as_total_net") - totalLiabilities;

  setSummary("householdIncome", householdIncome);
  setSummary("allLiabilities", totalLiabilities);
  setSummary("estimatedPosition", estimatedPosition);
}

function syncYesNoFields() {
  form.querySelectorAll("[data-yes-no]").forEach((group) => {
    const key = group.dataset.yesNo;
    const selected = form.querySelector(`input[name="${key}"]:checked`);
    const yesField = form.elements[`${key}_yes`];
    const noField = form.elements[`${key}_no`];

    if (yesField) {
      yesField.value = selected?.value === "yes" ? "Yes" : "";
    }

    if (noField) {
      noField.value = selected?.value === "no" ? "No" : "";
    }
  });
}

function getPdfPayload() {
  const payload = {};

  form.querySelectorAll("[name]").forEach((field) => {
    if (field.type === "radio") {
      return;
    }

    if (field.type === "checkbox") {
      payload[field.name] = field.checked ? field.value : "";
      return;
    }

    payload[field.name] = field.value || "";
  });

  return payload;
}

function fillPdfField(pdfForm, name, rawValue) {
  let field;

  try {
    field = pdfForm.getField(name);
  } catch {
    return;
  }

  const value = String(rawValue || "");

  if (typeof field.setText === "function") {
    field.setText(value);
    return;
  }

  if (typeof field.check === "function") {
    if (isAffirmative(value)) {
      field.check();
    } else if (typeof field.uncheck === "function") {
      field.uncheck();
    }
    return;
  }

  if (typeof field.select === "function" && value) {
    try {
      field.select(value);
    } catch {
      field.setText?.(value);
    }
  }
}

function isAffirmative(value) {
  return ["yes", "true", "on", "checked", "confirmed"].includes(String(value).toLowerCase());
}

function getMoney(name) {
  const field = form.elements[name];

  if (!field) {
    return 0;
  }

  return parseMoney(field.value);
}

function parseMoney(value) {
  const numeric = String(value || "").replace(/[^0-9.-]/g, "");
  const parsed = Number.parseFloat(numeric);

  return Number.isFinite(parsed) ? parsed : 0;
}

function setMoney(name, value) {
  const output = form.querySelector(`[data-money-output="${name}"]`);
  const hidden = form.querySelector(`[data-money-hidden="${name}"]`);
  const formatted = formatMoney(value);

  if (output) {
    output.textContent = formatted;
    output.classList.toggle("is-negative", value < 0);
  }

  if (hidden) {
    hidden.value = formatted;
  }
}

function setSummary(name, value) {
  const output = form.querySelector(`[data-summary="${name}"]`);

  if (!output) {
    return;
  }

  output.textContent = formatMoney(value);
  output.classList.toggle("is-negative", value < 0);
}

function formatMoney(value) {
  const amount = Number.isFinite(value) ? value : 0;
  const absolute = Math.abs(amount).toLocaleString("en-CA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return `${amount < 0 ? "-" : ""}$${absolute}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
