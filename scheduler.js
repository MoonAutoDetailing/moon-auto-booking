export function createScheduler({
  supabase,
  businessHours,
  slotIntervalMinutes,
  onAvailabilityRendered
}) {
  let selectedVehicleSize = null;
  let selectedServiceType = null;
  let selectedDateISO = null;

  let baseDurationMinutes = null;
  let travelPaddingMinutes = 0;
  let effectiveDurationMinutes = null;
  let priceCents = null;

  const uiState = {
    quoteStatus: "idle",
    calendarStatus: "locked"
  };

  return {
    setVehicleSize,
    setServiceType,
    setDate
  };

  function setVehicleSize(size) {
    selectedVehicleSize = size;
    reset();
    resolveQuote();
  }

  function setServiceType(type) {
    selectedServiceType = type;
    reset();
    resolveQuote();
  }

  function setDate(dateISO) {
    selectedDateISO = dateISO;
    tryUnlockCalendar();
  }

  async function resolveQuote() {
    if (!selectedVehicleSize || !selectedServiceType) return;

    const { data, error } = await supabase
      .from("service_pricing")
      .select("duration_minutes, price_cents")
      .eq("vehicle_size", selectedVehicleSize)
      .eq("service_type", selectedServiceType)
      .eq("is_active", true)
      .maybeSingle();

    if (error || !data) {
      console.error("Pricing lookup failed", error);
      return;
    }

    baseDurationMinutes = data.duration_minutes;
    priceCents = data.price_cents;

    travelPaddingMinutes = 0;
    effectiveDurationMinutes = baseDurationMinutes + travelPaddingMinutes;

    tryUnlockCalendar();
  }

  function tryUnlockCalendar() {
    if (
      !selectedDateISO ||
      !Number.isInteger(effectiveDurationMinutes)
    ) return;

    loadAvailability();
  }

  async function loadAvailability() {
    const bookings = await fetchBookingsForDay(selectedDateISO);
    const slots = generateSlots(selectedDateISO);

    const availability = slots.map(start => ({
      start,
      available: isAvailable(start, bookings)
    }));

    onAvailabilityRendered(availability, {
      baseDurationMinutes,
      priceCents
    });
  }

  async function fetchBookingsForDay(dateISO) {
    const start = new Date(dateISO);
    start.setHours(0, 0, 0, 0);

    const end = new Date(dateISO);
    end.setHours(23, 59, 59, 999);

    const { data } = await supabase
      .from("bookings")
      .select("scheduled_start, scheduled_end")
      .eq("status", "confirmed")
      .gte("scheduled_start", start.toISOString())
      .lte("scheduled_start", end.toISOString());

    return data || [];
  }

  function generateSlots(dateISO) {
    const slots = [];
    const base = new Date(dateISO);
    base.setHours(0, 0, 0, 0);

    for (let h = businessHours.start; h < businessHours.end; h++) {
      for (let m = 0; m < 60; m += slotIntervalMinutes) {
        const d = new Date(base);
        d.setHours(h, m, 0, 0);
        slots.push(d);
      }
    }

    return slots;
  }

  function isAvailable(start, bookings) {
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + effectiveDurationMinutes);

    return !bookings.some(b => {
      const bs = new Date(b.scheduled_start);
      const be = new Date(b.scheduled_end);
      return start < be && end > bs;
    });
  }

  function reset() {
    effectiveDurationMinutes = null;
  }
}
