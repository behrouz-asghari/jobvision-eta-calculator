// JobVision Navigation Calc - Popup Script

document.addEventListener("DOMContentLoaded", () => {
  const latInput = document.getElementById("latitude");
  const lngInput = document.getElementById("longitude");
  const saveBtn = document.getElementById("saveBtn");
  const geoBtn = document.getElementById("geoBtn");
  const status = document.getElementById("status");
  const savedInfo = document.getElementById("savedInfo");
  const savedCoords = document.getElementById("savedCoords");

  // Load saved values
  chrome.storage.local.get(["originLat", "originLng"], (data) => {
    if (data.originLat && data.originLng) {
      latInput.value = data.originLat;
      lngInput.value = data.originLng;
      showSaved(data.originLat, data.originLng);
    }
  });

  // Save button
  saveBtn.addEventListener("click", () => {
    const lat = parseFloat(latInput.value);
    const lng = parseFloat(lngInput.value);

    if (isNaN(lat) || isNaN(lng)) {
      showStatus("لطفاً مقادیر صحیح وارد کنید", "error");
      return;
    }

    if (lat < 34 || lat > 40 || lng < 48 || lng > 55) {
      showStatus("مختصات خارج از محدوده تهران است", "error");
      return;
    }

    chrome.storage.local.set({ originLat: lat, originLng: lng }, () => {
      showStatus("ذخیره شد!", "success");
      showSaved(lat, lng);
    });
  });

  // Geolocation button
  geoBtn.addEventListener("click", () => {
    geoBtn.disabled = true;
    geoBtn.textContent = "در حال دریافت...";

    if (!navigator.geolocation) {
      showStatus("مرورگر از موقعیت‌یابی پشتیبانی نمی‌کند", "error");
      geoBtn.disabled = false;
      geoBtn.textContent = "موقعیت فعلی";
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        latInput.value = pos.coords.latitude.toFixed(6);
        lngInput.value = pos.coords.longitude.toFixed(6);
        showStatus("موقعیت دریافت شد", "success");
        geoBtn.disabled = false;
        geoBtn.textContent = "موقعیت فعلی";
      },
      (err) => {
        showStatus("خطا در دریافت موقعیت: " + err.message, "error");
        geoBtn.disabled = false;
        geoBtn.textContent = "موقعیت فعلی";
      },
      { enableHighAccuracy: true }
    );
  });

  function showStatus(msg, type) {
    status.textContent = msg;
    status.className = "status " + type;
    setTimeout(() => { status.textContent = ""; }, 3000);
  }

  function showSaved(lat, lng) {
    savedInfo.style.display = "block";
    savedCoords.textContent = `${lat}, ${lng}`;
  }
});
