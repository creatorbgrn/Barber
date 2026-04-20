const schedule = [
  { days: [1, 2, 3, 4, 5, 6], open: { hour: 9, minute: 0 }, close: { hour: 19, minute: 0 } },
  { days: [0], open: { hour: 10, minute: 0 }, close: { hour: 18, minute: 0 } }
];

const defaultServices = [
  { name: "Haircut", duration: "35 min", price: "£15", description: "Standard haircut with a tidy finish.", featured: true, active: true },
  { name: "Skin or Zero Fade", duration: "40 min", price: "£17", description: "Sharp fade with clean detailing.", featured: true, active: true },
  { name: "Scissor Cut", duration: "35 min", price: "£16", description: "Scissor work for shape, length, and texture.", active: true },
  { name: "Kids Haircut (Under 12)", duration: "30 min", price: "£13", description: "Simple haircut for younger clients.", active: true },
  { name: "Kids Skin or Zero Fade", duration: "35 min", price: "£16", description: "Fade service for under 12s.", active: true },
  { name: "All Over", duration: "20 min", price: "£12", description: "Single-length clipper cut.", active: true },
  { name: "Hot Towel Shave", duration: "30 min", price: "£17", description: "Classic shave with hot towel finish.", active: true },
  { name: "Hot Towel Head Shave", duration: "30 min", price: "£17", description: "Close head shave with hot towel.", active: true },
  { name: "Beard Trim and Shape Up", duration: "20 min", price: "£13", description: "Trim, tidy, and shape the beard line.", active: true },
  { name: "Beard Trim", duration: "15 min", price: "£8", description: "Quick beard trim and tidy-up.", active: true },
  { name: "Shape Up", duration: "15 min", price: "£8", description: "Freshen up the hairline and edges.", active: true },
  { name: "Threading", duration: "15 min", price: "£8", description: "Quick tidy-up for extra detail.", active: true },
  { name: "Old Age Pensioner (67+)", duration: "30 min", price: "£13", description: "Reduced-price haircut for over 67s.", active: true },
  { name: "Double Zero", duration: "10 min", price: "£5", description: "Very short clipper cut.", active: true },
  { name: "Nose Wax and Ear Wax", duration: "10 min", price: "£7", description: "Quick grooming add-on.", active: true }
];

const defaultGallery = [
  { title: "Shop front", text: "Crewe Cut Barber on Boswall Parkway.", src: "images/storefront.jpg", fallback: "images/interior-wide.jpg", active: true },
  { title: "Main stations", text: "Main cutting stations inside the shop.", src: "images/interior-wide.jpg", fallback: "images/interior-row.jpg", active: true },
  { title: "Interior", text: "Ready for the day.", src: "images/interior-row.jpg", fallback: "images/interior-wide.jpg", active: true },
  { title: "Chairs", text: "Classic barber chairs and mirror line.", src: "images/chairs.jpg", fallback: "images/interior-row.jpg", active: true },
  { title: "Finished cut", text: "Fresh cut in the chair.", src: "images/cut-detail.jpg", fallback: "images/fade-finish.jpg", active: true },
  { title: "Fade detail", text: "Clean blend and finish.", src: "images/fade-finish.jpg", fallback: "images/cut-detail.jpg", active: true },
  { title: "In the chair", text: "Service in progress.", src: "images/client-chair.jpg", fallback: "images/chairs.jpg", active: true }
];

const defaultShopSettings = {
  services: defaultServices,
  gallery: defaultGallery,
  maxBookingsPerSlot: 1,
  slotIntervalMinutes: 30,
  unavailableDates: [],
  unavailableSlots: []
};

const config = window.CREWE_CUT_CONFIG || {};
let supabaseClient = null;
let shopSettings = structuredClone(defaultShopSettings);

function hasSupabaseConfig() {
  return Boolean(
    config.supabaseUrl &&
    config.supabaseAnonKey &&
    !config.supabaseUrl.includes("YOUR_PROJECT") &&
    !config.supabaseAnonKey.includes("YOUR_SUPABASE_ANON_KEY")
  );
}

function getSupabaseClient() {
  if (supabaseClient) {
    return supabaseClient;
  }

  if (!hasSupabaseConfig() || !window.supabase?.createClient) {
    return null;
  }

  supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
  return supabaseClient;
}

function minutesOf(dayConfig, type) {
  return (dayConfig[type].hour * 60) + dayConfig[type].minute;
}

function formatTime(hour, minute) {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return new Intl.DateTimeFormat("en-GB", {
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function getScheduleForDay(day) {
  return schedule.find((entry) => entry.days.includes(day)) ?? null;
}

function getNextOpening(now) {
  for (let offset = 0; offset < 7; offset += 1) {
    const day = (now.getDay() + offset) % 7;
    const configForDay = getScheduleForDay(day);

    if (configForDay) {
      return { offset, config: configForDay };
    }
  }

  return null;
}

function updateOpenStatus() {
  const topbarStatus = document.getElementById("shop-status");
  const liveTitle = document.getElementById("live-status-title");
  const liveCopy = document.getElementById("live-status-copy");

  if (!topbarStatus && !liveTitle && !liveCopy) {
    return;
  }

  const now = new Date();
  const today = getScheduleForDay(now.getDay());
  const currentMinutes = (now.getHours() * 60) + now.getMinutes();

  let title = "Open today";
  let copy = "Check current opening hours.";
  let topbar = "Open 7 days";

  if (today && currentMinutes >= minutesOf(today, "open") && currentMinutes < minutesOf(today, "close")) {
    title = "Open now";
    copy = `Open until ${formatTime(today.close.hour, today.close.minute)} today.`;
    topbar = `Open now until ${formatTime(today.close.hour, today.close.minute)}`;
  } else {
    const nextOpening = getNextOpening(now);

    if (nextOpening) {
      const { offset, config: upcoming } = nextOpening;
      const dayLabel = offset === 0
        ? "today"
        : offset === 1
          ? "tomorrow"
          : new Intl.DateTimeFormat("en-GB", { weekday: "long" }).format(
              new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset)
            );

      title = "Currently closed";
      copy = `Opens ${dayLabel} at ${formatTime(upcoming.open.hour, upcoming.open.minute)}.`;
      topbar = `Closed now, opens ${dayLabel} at ${formatTime(upcoming.open.hour, upcoming.open.minute)}`;
    }
  }

  if (topbarStatus) {
    topbarStatus.textContent = topbar;
  }

  if (liveTitle) {
    liveTitle.textContent = title;
  }

  if (liveCopy) {
    liveCopy.textContent = copy;
  }
}

function setupReveal() {
  const revealItems = document.querySelectorAll(".reveal");

  if (!revealItems.length) {
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("revealed");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.14 });

  revealItems.forEach((item, index) => {
    item.style.setProperty("--reveal-delay", `${Math.min(index * 35, 280)}ms`);
    observer.observe(item);
  });
}

function setupLightbox() {
  const lightbox = document.getElementById("gallery-lightbox");
  const image = document.getElementById("lightbox-image");
  const title = document.getElementById("lightbox-title");
  const text = document.getElementById("lightbox-text");
  const closeButton = document.querySelector(".lightbox-close");
  const triggers = document.querySelectorAll("[data-gallery-src]");

  if (!lightbox || !image || !title || !text || !closeButton || !triggers.length) {
    return;
  }

  const close = () => {
    lightbox.classList.remove("is-open");
    lightbox.setAttribute("aria-hidden", "true");
    document.body.classList.remove("lightbox-open");
  };

  triggers.forEach((trigger) => {
    trigger.addEventListener("click", () => {
      image.setAttribute("src", trigger.getAttribute("data-gallery-src") || "");
      image.setAttribute("alt", trigger.getAttribute("data-gallery-title") || "");
      title.textContent = trigger.getAttribute("data-gallery-title") || "";
      text.textContent = trigger.getAttribute("data-gallery-text") || "";
      lightbox.classList.add("is-open");
      lightbox.setAttribute("aria-hidden", "false");
      document.body.classList.add("lightbox-open");
    });
  });

  closeButton.addEventListener("click", close);
  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) {
      close();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      close();
    }
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

function normaliseSettings(settings) {
  return {
    ...defaultShopSettings,
    ...(settings || {}),
    services: Array.isArray(settings?.services) && settings.services.length ? settings.services : defaultServices,
    gallery: Array.isArray(settings?.gallery) && settings.gallery.length ? settings.gallery : defaultGallery,
    unavailableDates: Array.isArray(settings?.unavailableDates) ? settings.unavailableDates : [],
    unavailableSlots: Array.isArray(settings?.unavailableSlots) ? settings.unavailableSlots : []
  };
}

function renderServices(settings = shopSettings) {
  const grid = document.getElementById("services-grid");
  const select = document.getElementById("booking-service");
  const services = settings.services.filter((service) => service.active !== false);

  if (grid) {
    grid.innerHTML = services.map((service) => `
      <article class="service-card reveal ${service.featured ? "featured" : ""}">
        <div class="service-meta">
          <span>${escapeHtml(service.duration || "30 min")}</span>
          <strong>${escapeHtml(service.price || "")}</strong>
        </div>
        <h3>${escapeHtml(service.name)}</h3>
        <p>${escapeHtml(service.description || "")}</p>
      </article>
    `).join("");
  }

  if (select) {
    const current = select.value;
    select.innerHTML = '<option value="">Select a service</option>' + services.map((service) => (
      `<option value="${escapeAttribute(service.name)}">${escapeHtml(service.name)} - ${escapeHtml(service.price || "")}</option>`
    )).join("");
    if (current && services.some((service) => service.name === current)) {
      select.value = current;
    }
  }

  setupReveal();
}

function renderGallery(settings = shopSettings) {
  const grid = document.getElementById("gallery-grid");
  if (!grid) {
    return;
  }

  const photos = settings.gallery.filter((photo) => photo.active !== false && photo.src).slice(0, 15);

  grid.innerHTML = photos.map((photo, index) => `
    <article class="gallery-card reveal gallery-card-${index + 1}">
      <button class="gallery-button" type="button" data-gallery-src="${escapeAttribute(photo.src)}" data-gallery-title="${escapeAttribute(photo.title || "Shop photo")}" data-gallery-text="${escapeAttribute(photo.text || "")}">
        <img src="${escapeAttribute(photo.src)}" alt="${escapeAttribute(photo.title || "Shop photo")}" loading="lazy" onerror="this.onerror=null;this.src='${escapeAttribute(photo.fallback || "images/interior-wide.jpg")}'">
      </button>
      <div class="gallery-overlay">
        <h3>${escapeHtml(photo.title || "Shop photo")}</h3>
        <p>${escapeHtml(photo.text || "")}</p>
      </div>
    </article>
  `).join("");

  setupLightbox();
  setupReveal();
}

function renderTimeOptions(settings = shopSettings) {
  const select = document.getElementById("booking-time");
  if (!select) {
    return;
  }

  const current = select.value;
  const interval = Number(settings.slotIntervalMinutes) || 30;
  const times = [];

  for (let mins = 9 * 60; mins <= 18 * 60 + 30; mins += interval) {
    const hour = String(Math.floor(mins / 60)).padStart(2, "0");
    const minute = String(mins % 60).padStart(2, "0");
    times.push(`${hour}:${minute}`);
  }

  select.innerHTML = '<option value="">Select a time</option>' + times
    .map((time) => `<option value="${time}">${time}</option>`)
    .join("");

  if (current && times.includes(current)) {
    select.value = current;
  }
}

function isSlotUnavailable(day, time) {
  const slot = day && time ? `${day} ${time}` : "";
  return shopSettings.unavailableDates.includes(day) || shopSettings.unavailableSlots.includes(slot);
}

function updateAvailabilityNote(message, type = "info") {
  const note = document.getElementById("availability-note");
  if (!note) {
    return;
  }

  if (!message) {
    note.hidden = true;
    note.textContent = "";
    note.className = "availability-note";
    return;
  }

  note.hidden = false;
  note.className = `availability-note ${type}`;
  note.textContent = message;
}

function applyShopSettings(settings) {
  shopSettings = normaliseSettings(settings);
  renderServices(shopSettings);
  renderGallery(shopSettings);
  renderTimeOptions(shopSettings);
}

async function loadShopSettings() {
  applyShopSettings(defaultShopSettings);
  const supabase = getSupabaseClient();
  if (!supabase) {
    return;
  }

  const { data, error } = await supabase
    .from("site_settings")
    .select("settings")
    .eq("key", "main")
    .maybeSingle();

  if (!error && data?.settings) {
    applyShopSettings(data.settings);
  }
}

function setupHeroMotion() {
  if (!window.matchMedia("(pointer:fine)").matches) {
    return;
  }

  const hero = document.querySelector("[data-hero-parallax]");
  const visual = document.querySelector(".hero-visual img");
  const cards = document.querySelectorAll(".floating-card");
  const statusCard = document.querySelector(".live-status-card");

  if (!hero || !visual) {
    return;
  }

  const apply = (x, y) => {
    visual.style.transform = `translate3d(${x * 10}px, ${y * 12}px, 0) scale(1.02)`;

    cards.forEach((card, index) => {
      const factor = index === 0 ? 14 : 9;
      card.style.transform = `translate3d(${x * factor * -1}px, ${y * factor * -1}px, 0)`;
    });

    if (statusCard) {
      statusCard.style.transform = `translate3d(${x * -8}px, ${y * -8}px, 0)`;
    }
  };

  hero.addEventListener("mousemove", (event) => {
    const rect = hero.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) - 0.5;
    const y = ((event.clientY - rect.top) / rect.height) - 0.5;
    apply(x, y);
  });

  hero.addEventListener("mouseleave", () => {
    apply(0, 0);
  });
}

function setFeedback(element, type, message) {
  if (!element) {
    return;
  }

  element.hidden = false;
  element.className = `form-message ${type}`;
  element.textContent = message;
}

function setupBookingForm() {
  const form = document.getElementById("booking-form");
  const feedback = document.getElementById("booking-feedback");
  const submitButton = document.getElementById("booking-submit");
  const preferredDayInput = form?.querySelector("input[name='preferredDay']");
  const preferredTimeInput = form?.querySelector("select[name='preferredTime']");

  if (!form || !feedback || !submitButton) {
    return;
  }

  if (preferredDayInput) {
    preferredDayInput.min = new Date().toISOString().slice(0, 10);
  }

  [preferredDayInput, preferredTimeInput].forEach((input) => {
    input?.addEventListener("change", () => {
      const formData = new FormData(form);
      const day = String(formData.get("preferredDay") || "").trim();
      const time = String(formData.get("preferredTime") || "").trim();

      if (!day || !time) {
        updateAvailabilityNote("");
        return;
      }

      if (isSlotUnavailable(day, time)) {
        updateAvailabilityNote("That date or time is unavailable. Please choose another slot.", "error");
        return;
      }

      updateAvailabilityNote(`This slot accepts up to ${shopSettings.maxBookingsPerSlot} booking${Number(shopSettings.maxBookingsPerSlot) === 1 ? "" : "s"}.`, "info");
    });
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    feedback.hidden = true;

    const supabase = getSupabaseClient();
    if (!supabase) {
      setFeedback(
        feedback,
        "error",
        "The booking form is not ready yet. Please call the shop for now."
      );
      return;
    }

    const formData = new FormData(form);
    const payload = {
      client_name: String(formData.get("clientName") || "").trim(),
      phone: String(formData.get("phone") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      service: String(formData.get("service") || "").trim(),
      preferred_day: String(formData.get("preferredDay") || "").trim(),
      preferred_time: String(formData.get("preferredTime") || "").trim(),
      notes: String(formData.get("notes") || "").trim(),
      status: "new"
    };

    if (
      !payload.client_name ||
      !payload.phone ||
      !payload.email ||
      !payload.service ||
      !payload.preferred_day ||
      !payload.preferred_time
    ) {
      setFeedback(feedback, "error", "Please fill in all required fields.");
      return;
    }

    if (isSlotUnavailable(payload.preferred_day, payload.preferred_time)) {
      setFeedback(feedback, "error", "That date or time is unavailable. Please choose another slot.");
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Sending request...";

    const { data: bookingCount, error: capacityError } = await supabase.rpc("get_slot_booking_count", {
      p_day: payload.preferred_day,
      p_time: payload.preferred_time
    });
    const count = Number(bookingCount || 0);

    if (!capacityError && count >= Number(shopSettings.maxBookingsPerSlot || 1)) {
      submitButton.disabled = false;
      submitButton.textContent = "Send request";
      updateAvailabilityNote("That time is fully booked. Please choose another slot.", "error");
      setFeedback(feedback, "error", "That time is fully booked. Please choose another slot.");
      return;
    }

    const { error } = await supabase.from("bookings").insert([payload]);

    submitButton.disabled = false;
    submitButton.textContent = "Send request";

    if (error) {
      setFeedback(
        feedback,
        "error",
        "We could not send your request right now. Please try again or call the shop."
      );
      console.error(error);
      return;
    }

    form.reset();
    if (preferredDayInput) {
      preferredDayInput.min = new Date().toISOString().slice(0, 10);
    }
    renderTimeOptions();
    updateAvailabilityNote("");
    setFeedback(feedback, "success", "Thanks. Your request has been sent and the shop will be in touch soon.");
  });
}

updateOpenStatus();
setupHeroMotion();
setupBookingForm();
loadShopSettings();
