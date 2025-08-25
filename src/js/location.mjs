// location.mjs
import nigeria_states_lgas from "./data/nigeria_states_lgas.json" assert { type: "json" };

export function initLocationDropdowns() {
  const countrySelect = document.getElementById("country");
  const stateSelect = document.getElementById("state");
  const lgaSelect = document.getElementById("lga");

  if (!countrySelect || !stateSelect || !lgaSelect) return;

  // Populate states if Nigeria already selected (restore mode)
  if (countrySelect.value === "Nigeria") {
    populateStates();
  }

  // Listen for country change
  countrySelect.addEventListener("change", (e) => {
    if (e.target.value === "Nigeria") {
      populateStates();
    } else {
      stateSelect.innerHTML = '<option value="">-- Select State --</option>';
      lgaSelect.innerHTML = '<option value="">-- Select LGA --</option>';
    }
  });

  // On state change → populate LGAs
  stateSelect.addEventListener("change", (e) => {
    const selectedState = e.target.value;
    populateLGAs(selectedState);
  });

  function populateStates() {
    stateSelect.innerHTML = '<option value="">-- Select State --</option>';
    Object.keys(nigeria_states_lgas).forEach((state) => {
      const option = document.createElement("option");
      option.value = state;
      option.textContent = state;
      stateSelect.appendChild(option);
    });

    // Auto-populate saved state if available
    const savedProfile = JSON.parse(localStorage.getItem("mypadiman_profile"));
    if (savedProfile?.location?.state) {
      stateSelect.value = savedProfile.location.state;
      populateLGAs(savedProfile.location.state);
    }
  }

  function populateLGAs(state) {
    lgaSelect.innerHTML = '<option value="">-- Select LGA --</option>';
    if (nigeria_states_lgas[state]) {
      nigeria_states_lgas[state].forEach((lga) => {
        const opt = document.createElement("option");
        opt.value = lga;
        opt.textContent = lga;
        lgaSelect.appendChild(opt);
      });
    }

    // Auto-populate saved LGA if available
    const savedProfile = JSON.parse(localStorage.getItem("mypadiman_profile"));
    if (savedProfile?.location?.lga) {
      lgaSelect.value = savedProfile.location.lga;
    }
  }
}
