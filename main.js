import { supabase } from "./supabaseClient.js";
import { createScheduler } from "./scheduler.js";

const scheduler = createScheduler({
  supabase,
  businessHours: { start: 8, end: 18 },
  slotIntervalMinutes: 30,
  onAvailabilityRendered
});

document.querySelectorAll("[data-vehicle]").forEach(btn => {
  btn.onclick = () => scheduler.setVehicleSize(btn.dataset.vehicle);
});

document.querySelectorAll("[data-service]").forEach(btn => {
  btn.onclick = () => scheduler.setServiceType(btn.dataset.service);
});

document.getElementById("datePicker").onchange = e => {
  scheduler.setDate(e.target.value);
};

function onAvailabilityRendered(availability, meta) {
  document.getElementById("duration").textContent =
    `Duration: ${meta.baseDurationMinutes} min`;

  document.getElementById("price").textContent =
    `Price: $${(meta.priceCents / 100).toFixed(2)}`;

  const calendar = document.getElementById("calendar");
  calendar.innerHTML = "";

  availability.forEach(slot => {
    const div = document.createElement("div");
    div.className = `slot ${slot.available ? "available" : "blocked"}`;
    div.textContent = slot.start.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });

    if (slot.available) {
      div.onclick = () => {
        console.log("Selected:", slot.start.toISOString());
      };
    }

    calendar.appendChild(div);
  });
}
