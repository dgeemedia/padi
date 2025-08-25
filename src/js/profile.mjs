const PROFILE_KEY = "mypadiman_profile";

/**
 * Initialize profile form handlers
 */
export function initProfileForm() {
  const roleFieldsContainer   = document.getElementById("role-specific-fields");
  const roleCheckboxes        = document.querySelectorAll("input[name='role']");
  const profileForm           = document.querySelector(".profile-form");
  const profilePhotoInput     = document.getElementById("profilePhoto");
  const profilePhotoPreview   = document.getElementById("profilePhotoPreview");

  if (!roleFieldsContainer || !roleCheckboxes.length || !profileForm) return;

  // Load saved profile if exists
  const savedProfile = loadProfile();
  if (savedProfile) {
    populateForm(savedProfile, roleFieldsContainer, roleCheckboxes, profilePhotoPreview);
  }

  // Instant profile photo preview
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

  // Watch for role selection
  roleCheckboxes.forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      renderRoleFields(roleFieldsContainer);
    });
  });

  // Handle profile save
  profileForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const formData = new FormData(profileForm);
    const roles = Array.from(roleCheckboxes)
      .filter((cb) => cb.checked)
      .map((cb) => cb.value);

    const profileData = {
      phone: formData.get("phone"),
      roles,
      skills: formData.get("skills") || null,
      avatar: null, // base64 profile photo
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
    };

    const avatarFile   = profilePhotoInput?.files[0];
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
          bReader.onload = () => {
            profileData.business.photo = bReader.result;
            processSaves();
          };
          bReader.readAsDataURL(businessFile);
        } else {
          processSaves();
        }
      };
      reader.readAsDataURL(avatarFile);
    } else if (businessFile) {
      const bReader = new FileReader();
      bReader.onload = () => {
        profileData.business.photo = bReader.result;
        processSaves();
      };
      bReader.readAsDataURL(businessFile);
    } else {
      processSaves();
    }
  });
}

/* ----------------------------
   LocalStorage Helpers
---------------------------- */
function saveProfile(profileData) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profileData));
  updateSidebarAvatar(profileData.avatar);
}

function loadProfile() {
  const data = localStorage.getItem(PROFILE_KEY);
  return data ? JSON.parse(data) : null;
}

/* ----------------------------
   Restore form with saved data
---------------------------- */
function populateForm(profile, roleFieldsContainer, roleCheckboxes, profilePhotoPreview) {
  // Phone
  const phoneInput = document.querySelector("input[name='phone']");
  if (phoneInput) phoneInput.value = profile.phone || "";

  // Avatar (form + sidebar)
  if (profile.avatar && profilePhotoPreview) {
    profilePhotoPreview.innerHTML = `<img src="${profile.avatar}" style="max-width:120px;border-radius:50%;" />`;
  }
  updateSidebarAvatar(profile.avatar);

  // Roles
  roleCheckboxes.forEach((cb) => {
    cb.checked = profile.roles.includes(cb.value);
  });
  renderRoleFields(roleFieldsContainer);

  // Artisan fields
  if (profile.skills) {
    const skillsInput = document.querySelector("input[name='skills']");
    if (skillsInput) skillsInput.value = profile.skills;
  }

  // Business fields
  if (profile.business?.name) {
    const businessName = document.querySelector("input[name='businessName']");
    if (businessName) businessName.value = profile.business.name;
  }
  if (profile.business?.description) {
    const businessDesc = document.querySelector("textarea[name='businessDesc']");
    if (businessDesc) businessDesc.value = profile.business.description;
  }
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

  // Location
  if (profile.location) {
    const countrySelect = document.querySelector("#country");
    const stateSelect   = document.querySelector("#state");
    const lgaSelect     = document.querySelector("#lga");
    const addressInput  = document.querySelector("#address");

    if (countrySelect) countrySelect.value = profile.location.country || "";

    // ⚡ delay until dropdowns populated
    setTimeout(() => {
      if (stateSelect) stateSelect.value = profile.location.state || "";
      if (lgaSelect) lgaSelect.value = profile.location.lga || "";
    }, 200);

    if (addressInput) addressInput.value = profile.location.address || "";
  }
}

/* ----------------------------
   Render extra fields by role
---------------------------- */
function renderRoleFields(container) {
  container.innerHTML = "";

  const selectedRoles = Array.from(
    document.querySelectorAll("input[name='role']:checked")
  ).map((cb) => cb.value);

  if (selectedRoles.includes("artisan")) {
    container.insertAdjacentHTML(
      "beforeend",
      `
      <div class="role-fields artisan-fields">
        <h3>Artisan Skills</h3>
        <input type="text" name="skills" placeholder="e.g. Plumbing, Tailoring, Carpentry" />
      </div>
      `
    );
  }

  if (selectedRoles.includes("business")) {
    container.insertAdjacentHTML(
      "beforeend",
      `
      <div class="role-fields business-fields">
        <h3>Business Information</h3>
        <input type="text" name="businessName" placeholder="Business name" />
        <textarea name="businessDesc" placeholder="Describe your business"></textarea>
        <label>Upload Photo</label>
        <input type="file" name="businessPhoto" accept="image/*" />
      </div>
      `
    );
  }
}

/* ----------------------------
   Sidebar Avatar Updater
---------------------------- */
function updateSidebarAvatar(avatarBase64) {
  const sidebarAvatar = document.getElementById("sidebarAvatar");
  if (!sidebarAvatar) return;

  if (avatarBase64) {
    sidebarAvatar.innerHTML = `<img src="${avatarBase64}" alt="User Avatar" />`;
  } else {
    sidebarAvatar.textContent = "👤"; // fallback icon
  }
}
