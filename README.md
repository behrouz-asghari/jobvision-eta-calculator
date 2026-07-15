# JobVision ETA Calculator

A Chrome extension that calculates driving time from your location to job listings on [JobVision](https://jobvision.ir).

<img width="1217" height="903" alt="Screenshot 2026-07-15 145219" src="https://github.com/user-attachments/assets/82f28530-a3b1-47c4-9d27-91fc1045b170" />

## Features

- Extracts street names from job cards automatically
- Calculates real-time driving ETA using [Raah.ir](https://raah.ir) navigation API
- Color-coded badges: green (<15 min), yellow (15-30 min), red (>30 min)
- Caches results per session to avoid redundant API calls
- Works with dynamic content (infinite scroll, pagination)

### Recommended commute time ranges

- **Ideal minimum:** 15-25 minutes
- **Balanced range:** 30-45 minutes
- **Average acceptable range:** 45-60 minutes
- **Maximum acceptable range:** 60-75 minutes
- **High-risk range:** more than 75 minutes

### HR interpretation

- **Up to 30 minutes:** highly preferred
- **30-45 minutes:** balanced and optimal
- **45-60 minutes:** acceptable, especially in large cities
- **60-75 minutes:** requires additional review
- **More than 75 minutes:** higher risk of fatigue, lateness, and turnover

### Notes

- Use commute time as a decision support factor, not a strict rejection rule.
- Evaluate it together with role type, work model, traffic conditions, and transport access.

## Privacy

**No data is tracked, stored, or sent to any third party.**

- Your origin coordinates are stored **only in your browser** (via `chrome.storage.local`)
- All API calls are made directly from your browser to Raah.ir — no intermediate server
- No analytics, telemetry, or tracking of any kind
- The extension works entirely offline after initial setup (fonts are bundled)

## How It Works (Technical)

1. **Street Extraction**: The content script parses JobVision's job card DOM, extracting street names from location spans (e.g., `تهران ، آرژانتین` → `آرژانتین`)

2. **Geocoding via Raah.ir Search API**:
   - Sends request: `GET https://search.raah.ir/v6/?text=استان تهران ، شهر تهران ، خیابان {streetName}`
   - If no road result found, retries with `میدان` prefix
   - Returns `center_point` coordinates from the first matching result

3. **Navigation via Raah.ir Direction API**:
   - Sends request: `GET https://direction.raah.ir/navigation-v7/directions/v5/mapbox/driving-traffic/{originLng},{originLat};{destLng},{destLat}`
   - Extracts `routes[0].duration` (seconds) and `routes[0].distance` (meters)
   - Converts to minutes and kilometers for display

4. **Display**: Injects a styled badge next to each job card's location showing `🚗 X دقیقه (Y km)`

## Installation

### Option 1: From GitHub Releases (Recommended)

1. Go to the [Releases](../../releases) page
2. Download the latest `jobvision-eta-calc-vX.X.X.zip`
3. Extract the zip file to a folder on your computer
4. Open Chrome and navigate to `chrome://extensions/`
5. Enable **Developer mode** (toggle in top-right corner)
6. Click **Load unpacked**
7. Select the extracted folder
8. The extension icon will appear in your toolbar

### Option 2: From Source (Developer)

1. Clone this repository:
   ```
   git clone https://github.com/your-username/jobvision-eta-calculator.git
   ```
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode**
4. Click **Load unpacked**
5. Select the cloned repository folder

## Usage

1. Click the extension icon in the Chrome toolbar
2. Enter your coordinates (Latitude & Longitude), or click **"موقعیت فعلی"** (Current Location) to auto-detect
3. Click **"ذخیره"** (Save) — you only need to do this once
4. Navigate to [jobvision.ir](https://jobvision.ir) and search for jobs
5. Driving ETAs will appear next to each job's location

## Permissions

| Permission | Why |
|------------|-----|
| `storage` | Save your origin coordinates locally |
| `activeTab` | Access the current JobVision page |
| `geolocation` | Auto-detect your current location |
| `host_permissions` | Call Raah.ir geocoding and navigation APIs |

## Tech Stack

- Chrome Extension Manifest V3
- Vanilla JavaScript (no frameworks)
- Vazirmatn font (bundled, offline)
- Raah.ir APIs for geocoding and navigation
