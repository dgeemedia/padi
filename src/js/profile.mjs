// Patched profile form to include contactConsent and minor robustness fixes.

const PROFILE_KEY = "mypadiman_profile";

export function initProfileForm() {
  const roleFieldsContainer = document.getElementById("role-specific-fields");
  const roleCheckboxes = document.querySelectorAll("input[name='role']");
  const profileForm = document.querySelector(".profile-form");
  const profilePhotoInput = document.getElementById("profilePhoto");
  const profilePhotoPreview = document.getElementById("profilePhotoPreview");

  if (!roleFieldsContainer || !roleCheckboxes.length || !profileForm) return;

  const savedProfile = loadProfile();
  if (savedProfile) {
    populateForm(savedProfile, roleFieldsContainer, roleCheckboxes, profilePhotoPreview);
  }

  if (profilePhotoInput) {
    profilePhotoInput.addEventListener("change", () => {
      const file = profilePhotoInput.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = () => {
          profilePhotoPreview.innerHTML = `<img src="${reader.result}" style="max-width:120px;border-radius:50%;" />`;
        };
        reader.readAsDataURL(file);
      }
    });
  }

  roleCheckboxes.forEach((checkbox) => checkbox.addEventListener("change", () => renderRoleFields(roleFieldsContainer)));

  profileForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const formData = new FormData(profileForm);
    const roles = Array.from(roleCheckboxes).filter(cb => cb.checked).map(cb => cb.value);

    const profileData = {
      phone: formData.get("phone"),
      roles,
      skills: formData.get("skills") || null,
      avatar: null,
      business: {
        name: formData.get("businessName") || null,
        description: formData.get("businessDesc") || null,
        photo: null,
      },
      location: {
        country: formData.get("country"),
        state: formData.get("state"),
        lga: formData.get("lga"),
        address: formData.get("address"),
      },
      contactConsent: formData.get("contactConsent") === "on",
      geo: null,
    };

    const avatarFile = profilePhotoInput?.files[0];
    const businessFile = document.querySelector("input[name='businessPhoto']")?.files[0];

    const processSaves = () => {
      saveProfile(profileData);
      alert("Profile updated successfully! ✅");
    };

    if (avatarFile) {
      const reader = new FileReader();
      reader.onload = () => {
        profileData.avatar = reader.result;
        if (businessFile) {
          const bReader = new FileReader();
          bReader.onload = () => { profileData.business.photo = bReader.result; processSaves(); };
          bReader.readAsDataURL(businessFile);
        } else processSaves();
      };
      reader.readAsDataURL(avatarFile);
    } else if (businessFile) {
      const bReader = new FileReader();
      bReader.onload = () => { profileData.business.photo = bReader.result; processSaves(); };
      bReader.readAsDataURL(businessFile);
    } else processSaves();
  });
}

function saveProfile(profileData) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profileData));
  updateSidebarAvatar(profileData.avatar);
}
function loadProfile() {
  const data = localStorage.getItem(PROFILE_KEY);
  return data ? JSON.parse(data) : null;
}

function populateForm(profile, roleFieldsContainer, roleCheckboxes, profilePhotoPreview) {
  const phoneInput = document.querySelector("input[name='phone']");
  if (phoneInput) phoneInput.value = profile.phone || "";

  if (profile.avatar && profilePhotoPreview) profilePhotoPreview.innerHTML = `<img src="${profile.avatar}" style="max-width:120px;border-radius:50%;" />`;
  updateSidebarAvatar(profile.avatar);

  roleCheckboxes.forEach(cb => cb.checked = profile.roles?.includes(cb.value));
  renderRoleFields(roleFieldsContainer);

  // FIX: Safely assign only if the element exists and value is not null
  const skillsInput = document.querySelector("input[name='skills']");
  if (profile.skills != null && skillsInput) skillsInput.value = profile.skills;

  const businessNameInput = document.querySelector("input[name='businessName']");
  if (profile.business?.name != null && businessNameInput) businessNameInput.value = profile.business.name;

  const businessDescInput = document.querySelector("textarea[name='businessDesc']");
  if (profile.business?.description != null && businessDescInput) businessDescInput.value = profile.business.description;

  if (profile.business?.photo) {
    const container = document.querySelector(".business-fields");
    if (container) {
      const preview = document.createElement("img");
      preview.src = profile.business.photo;
      preview.style.maxWidth = "150px";
      preview.style.display = "block";
      container.appendChild(preview);
    }
  }

  // Location: set country immediately; wait for location module to populate state/LGA
  const countrySelect = document.querySelector("#country");
  const stateSelect   = document.querySelector("#state");
  const lgaSelect     = document.querySelector("#lga");
  const addressInput  = document.querySelector("#address");

  if (countrySelect) {
    countrySelect.value = profile.location?.country || "";
    // FIX: Manually dispatch 'change' event to trigger population if country is Nigeria
    if (countrySelect.value === "Nigeria") {
      countrySelect.dispatchEvent(new Event('change'));
    }
  }

  // Function to set state/lga once options are present
  function setStateAndLgaIfPossible() {
    if (!stateSelect || !lgaSelect) return false;
    // only set if options include the value
    try {
      if (profile.location?.state) {
        const hasStateOption = Array.from(stateSelect.options).some(o => o.value === profile.location.state);
        if (hasStateOption) stateSelect.value = profile.location.state;
      }
      if (profile.location?.lga) {
        const hasLgaOption = Array.from(lgaSelect.options).some(o => o.value === profile.location.lga);
        if (hasLgaOption) lgaSelect.value = profile.location.lga;
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  // Try immediate set (in case location.mjs already ran)
  if (!setStateAndLgaIfPossible()) {
    // Wait for location module to signal readiness
    const onReady = (ev) => {
      setStateAndLgaIfPossible();
      document.removeEventListener("mypadiman_location_ready", onReady);
    };
    document.addEventListener("mypadiman_location_ready", onReady);
  }

  if (addressInput) addressInput.value = profile.location?.address || "";

  // contactConsent
  const consent = document.querySelector("input[name='contactConsent']");
  if (consent) consent.checked = !!profile.contactConsent;
}

function renderRoleFields(container) {
  container.innerHTML = "";
  const selectedRoles = Array.from(document.querySelectorAll("input[name='role']:checked")).map(cb => cb.value);

  // contact consent -- always show
  container.insertAdjacentHTML("beforeend", `
    <div class="role-fields contact-consent">
      <h3>Contact & Privacy</h3>
      <label><input type="checkbox" name="contactConsent" checked /> Allow MyPadiMan to share my contact with accepted runners after payment</label>
    </div>
  `);

  if (selectedRoles.includes("artisan")) {
    container.insertAdjacentHTML("beforeend", `
      <div class="role-fields artisan-fields">
        <h3>Artisan Skills</h3>
        <input type="text" name="skills" placeholder="e.g. Plumbing, Tailoring, Carpentry" />
      </div>
    `);
  }

  if (selectedRoles.includes("business")) {
    container.insertAdjacentHTML("beforeend", `
      <div class="role-fields business-fields">
        <h3>Business Information</h3>
        <input type="text" name="businessName" placeholder="Business name" />
        <textarea name="businessDesc" placeholder="Describe your business"></textarea>
        <label>Upload Photo</label>
        <input type="file" name="businessPhoto" accept="image/*" />
      </div>
    `);
  }
}

function updateSidebarAvatar(avatarBase64) {
  const sidebarAvatar = document.getElementById("sidebarAvatar");
  if (!sidebarAvatar) return;
  if (avatarBase64) sidebarAvatar.innerHTML = `<img src="${avatarBase64}" alt="User Avatar" />`;
  else sidebarAvatar.textContent = "👤";
}

export { loadProfile };