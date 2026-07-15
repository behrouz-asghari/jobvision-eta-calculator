// JobVision Navigation Calc - Background Service Worker

// ========== Geocoding ==========

async function geocodeStreet(streetName) {
  // Try with خیابان prefix first
  const query1 = `استان تهران ، شهر تهران ، خیابان ${streetName}`;
  const result1 = await searchRaah(query1);
  if (result1) return result1;

  // Fallback: try with میدان prefix
  const query2 = `استان تهران ، شهر تهران ، میدان ${streetName}`;
  const result2 = await searchRaah(query2);
  if (result2) return result2;

  // Fallback: search without prefix (just the name)
  const query3 = `استان تهران ، شهر تهران ، ${streetName}`;
  return await searchRaah(query3);
}

async function searchRaah(text) {
  try {
    const encoded = encodeURIComponent(text);
    const url = `https://search.raah.ir/v6/?text=${encoded}`;
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    if (!data.results || data.results.length === 0) return null;

    // Find first road result
    const roadResult = data.results.find(r => r.type === "road" && r.center_point);
    if (roadResult) {
      return { lat: roadResult.center_point[1], lng: roadResult.center_point[0] };
    }

    // If no road, take first result with center_point
    const firstWithCoords = data.results.find(r => r.center_point);
    if (firstWithCoords) {
      return { lat: firstWithCoords.center_point[1], lng: firstWithCoords.center_point[0] };
    }

    return null;
  } catch (e) {
    console.error("Geocoding error:", e);
    return null;
  }
}

// ========== Navigation ==========

async function getNavigation(originLat, originLng, destLat, destLng) {
  try {
    const url = `https://direction.raah.ir/navigation-v7/directions/v5/mapbox/driving-traffic/${originLng},${originLat};${destLng},${destLat}`;
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    if (!data.routes || data.routes.length === 0) return null;

    const route = data.routes[0];
    const durationSeconds = route.duration;
    const distanceMeters = route.distance;

    const minutes = Math.round(durationSeconds / 60);
    const distanceKm = (distanceMeters / 1000).toFixed(1);

    return { minutes, distanceKm };
  } catch (e) {
    console.error("Navigation error:", e);
    return null;
  }
}

// ========== Message Listener ==========

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "geocodeAndNavigate") {
    handleGeocodeAndNavigate(message.streetName, message.originLat, message.originLng)
      .then(result => sendResponse(result));
    return true; // async response
  }

  if (message.action === "getOrigin") {
    chrome.storage.local.get(["originLat", "originLng"], (data) => {
      sendResponse({
        originLat: data.originLat || null,
        originLng: data.originLng || null
      });
    });
    return true;
  }
});

async function handleGeocodeAndNavigate(streetName, originLat, originLng) {
  if (!originLat || !originLng) {
    return { error: "origin_not_set" };
  }

  // Geocode the street
  const coords = await geocodeStreet(streetName);
  if (!coords) {
    return { error: "geocode_failed" };
  }

  // Get navigation
  const nav = await getNavigation(originLat, originLng, coords.lat, coords.lng);
  if (!nav) {
    return { error: "navigation_failed" };
  }

  return {
    minutes: nav.minutes,
    distanceKm: nav.distanceKm,
    destLat: coords.lat,
    destLng: coords.lng
  };
}
