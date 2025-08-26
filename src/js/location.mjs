import nigeria_states_lgas from "./data/nigeria_states_lgas.json" assert { type: "json" };

export function initLocationDropdowns() {
  console.log("initLocationDropdowns fired");

  const countrySelect = document.getElementById("country");
  const stateSelect = document.getElementById("state");
  const lgaSelect = document.getElementById("lga");

  if (!countrySelect || !stateSelect || !lgaSelect) {
    console.warn("Missing one of the location dropdowns!");
    return;
  }

  // Insert test option
  countrySelect.innerHTML = `<option value="">--Select Country--</option>`;
  stateSelect.innerHTML = `<option value="">--Select State--</option>`;
  lgaSelect.innerHTML = `<option value="">--Select LGA--</option>`;

  // Add sample Nigeria
  countrySelect.innerHTML += `<option value="Nigeria">Nigeria</option>`;
  console.log("Inserted Nigeria test option into country select");

  // Try to read saved profile
  let savedProfile = null;
  try {
    savedProfile = JSON.parse(localStorage.getItem("mypadiman_profile"));
  } catch (e) {
    savedProfile = null;
  }

  // If saved profile has a country, set it now so populateStates() will run when needed
  if (savedProfile?.location?.country) {
    countrySelect.value = savedProfile.location.country;
  }

  // If country is Nigeria (either from DOM or saved profile), populate states immediately
  if (countrySelect.value === "Nigeria" || savedProfile?.location?.country === "Nigeria") {
    populateStates();
  } else {
    // ensure state/lga are empty placeholders
    stateSelect.innerHTML = '<option value="">-- Select State --</option>';
    lgaSelect.innerHTML = '<option value="">-- Select LGA --</option>';
    dispatchLocationReady();
  }

  // Listen for country change
  countrySelect.addEventListener("change", (e) => {
    if (e.target.value === "Nigeria") {
      populateStates();
    } else {
      stateSelect.innerHTML = '<option value="">-- Select State --</option>';
      lgaSelect.innerHTML = '<option value="">-- Select LGA --</option>';
      dispatchLocationReady();
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

    if (savedProfile?.location?.state) {
      setTimeout(() => {
        stateSelect.value = savedProfile.location.state || "";
        populateLGAs(savedProfile.location.state);
      }, 0);
    } else {
      dispatchLocationReady();
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

    if (savedProfile?.location?.lga) {
      setTimeout(() => {
        lgaSelect.value = savedProfile.location.lga || "";
      }, 0);
    }

    dispatchLocationReady();
  }

  function dispatchLocationReady() {
    try {
      const evt = new CustomEvent("mypadiman_location_ready", {
        detail: {
          country: countrySelect.value,
          state: stateSelect.value,
          lga: lgaSelect.value,
        },
      });
      document.dispatchEvent(evt);
    } catch (e) {
      // ignore
    }
  }
}
