const DATA_URL = "data/indomaret_stores_clean.csv";
const INITIAL_CENTER = [-2.7, 118.0];
const INITIAL_ZOOM = 5;
const DEFAULT_PAGE_SIZE = 25;

const INVALID_NAME_PREFIXES =
  /^(atm|bank|bri|bca|mandiri|muamalat|cimb|bni|warkop|warung|pt\.?|kantor|gudang|dc\b|depo\b|training|persiapan|indomarco|indomart|indomarer)/i;
const REVIEW_NAME_TERMS =
  /(spbu|hybrid|point cafe|mini market|minimarket|market|toko|tomira|oke shop|modern|commercial|outlet|gerai|pom)/i;

let allStores = [];
let filteredStores = [];
let currentPage = 1;
let pageSize = DEFAULT_PAGE_SIZE;
let validationStats = {
  valid: 0,
  review: 0,
  invalid: 0,
};
let sortState = {
  key: "provinsi",
  direction: "asc",
};

const map = L.map("map", {
  center: INITIAL_CENTER,
  zoom: INITIAL_ZOOM,
  preferCanvas: true,
  zoomControl: false,
});

L.control.zoom({ position: "topright" }).addTo(map);

L.tileLayer(
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
  {
    subdomains: "abcd",
    maxZoom: 20,
    attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
  },
).addTo(map);

// Branded marker icon (Indomaret red pin)
const brandIcon = L.divIcon({
  className: "indomap-marker",
  html: `<span class="indomap-pin"><span class="indomap-pin-dot"></span></span>`,
  iconSize: [22, 28],
  iconAnchor: [11, 28],
  popupAnchor: [0, -26],
});

const markerLayer = L.markerClusterGroup({
  chunkedLoading: true,
  chunkInterval: 150,
  chunkDelay: 40,
  maxClusterRadius: 52,
});

map.addLayer(markerLayer);

const elements = {
  totalStores: document.getElementById("totalStores"),
  totalProvinces: document.getElementById("totalProvinces"),
  totalCities: document.getElementById("totalCities"),
  visibleStores: document.getElementById("visibleStores"),
  provinceFilter: document.getElementById("provinceFilter"),
  cityFilter: document.getElementById("cityFilter"),
  searchInput: document.getElementById("searchInput"),
  resetBtn: document.getElementById("resetBtn"),
  tableBody: document.getElementById("storeTableBody"),
  tableInfo: document.getElementById("tableInfo"),
  pageSizeSelect: document.getElementById("pageSizeSelect"),
  pagination: document.getElementById("pagination"),
  topCities: document.getElementById("topCities"),
};

document.addEventListener("DOMContentLoaded", initApp);

function initApp() {
  setLoading(true);

  Papa.parse(DATA_URL, {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      const normalizedData = normalizeData(results.data);
      const validatedData = validateData(normalizedData);

      allStores = validatedData.valid;
      validationStats = validatedData.stats;
      filteredStores = [...allStores];

      populateProvinceFilter();
      populateCityFilter();
      updateStaticStats();
      applyFilters();
      bindEvents();

      setLoading(false);
    },
    error: (error) => {
      console.error(error);
      setLoading(false);
      elements.tableInfo.textContent =
        "Data gagal dimuat. Jalankan proyek melalui localhost, bukan langsung membuka file HTML.";
      elements.tableBody.innerHTML = `
        <tr>
          <td colspan="5" class="empty-state">
            Data gagal dimuat. Coba jalankan: python -m http.server 8000
          </td>
        </tr>
      `;
    },
  });
}

function normalizeData(rows) {
  return rows
    .map((row, index) => ({
      id: row.id || String(index + 1),
      nama_gerai: cleanText(row.nama_gerai) || "Indomaret",
      tipe_lokasi: cleanText(row.tipe_lokasi),
      alamat: cleanText(row.alamat),
      kab_kota: cleanText(row.kab_kota),
      tipe_wilayah: cleanText(row.tipe_wilayah),
      nama_kab_kota: cleanText(row.nama_kab_kota),
      provinsi: cleanText(row.provinsi),
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      google_maps: cleanText(row.google_maps),
    }))
    .filter(
      (store) =>
        Number.isFinite(store.latitude) &&
        Number.isFinite(store.longitude) &&
        store.latitude >= -11 &&
        store.latitude <= 7 &&
        store.longitude >= 94 &&
        store.longitude <= 142,
    );
}

function validateData(rows) {
  const valid = [];
  const review = [];
  const invalid = [];

  rows.forEach((store) => {
    const name = store.nama_gerai.toLowerCase();

    if (!name.includes("indomaret")) {
      invalid.push(store);
      return;
    }

    if (INVALID_NAME_PREFIXES.test(name)) {
      invalid.push(store);
      return;
    }

    if (!name.startsWith("indomaret")) {
      review.push(store);
      return;
    }

    if (REVIEW_NAME_TERMS.test(name)) {
      review.push(store);
      return;
    }

    valid.push(store);
  });

  return {
    valid,
    review,
    invalid,
    stats: {
      valid: valid.length,
      review: review.length,
      invalid: invalid.length,
    },
  };
}

function cleanText(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function bindEvents() {
  elements.provinceFilter.addEventListener("change", () => {
    populateCityFilter();
    applyFilters();
  });

  elements.cityFilter.addEventListener("change", applyFilters);
  elements.searchInput.addEventListener("input", debounce(applyFilters, 250));

  elements.resetBtn.addEventListener("click", () => {
    elements.provinceFilter.value = "";
    elements.searchInput.value = "";
    populateCityFilter();
    elements.cityFilter.value = "";
    applyFilters();
    map.setView(INITIAL_CENTER, INITIAL_ZOOM);
  });

  elements.pageSizeSelect.addEventListener("change", () => {
    pageSize = Number(elements.pageSizeSelect.value) || DEFAULT_PAGE_SIZE;
    currentPage = 1;
    renderTable();
  });

  elements.pagination.addEventListener("click", (event) => {
    const target = event.target.closest("button[data-page]");
    if (!target || target.disabled) return;
    const page = Number(target.dataset.page);
    if (!Number.isFinite(page)) return;
    goToPage(page);
  });

  document.querySelectorAll("th[data-sort]").forEach((th) => {
    th.addEventListener("click", () => {
      const key = th.dataset.sort;

      if (sortState.key === key) {
        sortState.direction = sortState.direction === "asc" ? "desc" : "asc";
      } else {
        sortState.key = key;
        sortState.direction = "asc";
      }

      applySorting();
      renderTable();
      updateTableHeaderIndicators();
    });
  });
}

function updateStaticStats() {
  elements.totalStores.textContent = formatNumber(allStores.length);
  elements.totalProvinces.textContent = formatNumber(
    new Set(allStores.map((store) => store.provinsi).filter(Boolean)).size,
  );
  elements.totalCities.textContent = formatNumber(
    new Set(allStores.map((store) => store.kab_kota).filter(Boolean)).size,
  );
}

function populateProvinceFilter() {
  const provinces = uniqueSorted(allStores.map((store) => store.provinsi));

  elements.provinceFilter.innerHTML = `<option value="">Semua Provinsi</option>`;

  provinces.forEach((province) => {
    const option = document.createElement("option");
    option.value = province;
    option.textContent = province;
    elements.provinceFilter.appendChild(option);
  });
}

function populateCityFilter() {
  const selectedProvince = elements.provinceFilter.value;
  const source = selectedProvince
    ? allStores.filter((store) => store.provinsi === selectedProvince)
    : allStores;

  const cities = uniqueSorted(source.map((store) => store.kab_kota));

  elements.cityFilter.innerHTML = `<option value="">Semua Kabupaten/Kota</option>`;

  cities.forEach((city) => {
    const option = document.createElement("option");
    option.value = city;
    option.textContent = city;
    elements.cityFilter.appendChild(option);
  });
}

function applyFilters() {
  const selectedProvince = elements.provinceFilter.value;
  const selectedCity = elements.cityFilter.value;
  const keyword = elements.searchInput.value.trim().toLowerCase();

  filteredStores = allStores.filter((store) => {
    const matchProvince =
      !selectedProvince || store.provinsi === selectedProvince;
    const matchCity = !selectedCity || store.kab_kota === selectedCity;
    const matchKeyword =
      !keyword ||
      [
        store.nama_gerai,
        store.alamat,
        store.kab_kota,
        store.nama_kab_kota,
        store.provinsi,
      ]
        .join(" ")
        .toLowerCase()
        .includes(keyword);

    return matchProvince && matchCity && matchKeyword;
  });

  resetPagination();
  applySorting();
  renderMap();
  renderTable();
  renderTopCities();
  updateVisibleStats();
}

function resetPagination() {
  currentPage = 1;
}

function applySorting() {
  const { key, direction } = sortState;
  const modifier = direction === "asc" ? 1 : -1;

  filteredStores.sort((a, b) => {
    const first = String(a[key] || "").toLowerCase();
    const second = String(b[key] || "").toLowerCase();

    return first.localeCompare(second, "id") * modifier;
  });
}

function renderMap() {
  map.invalidateSize();
  markerLayer.clearLayers();

  const markers = filteredStores.map((store) => {
    const marker = L.marker([store.latitude, store.longitude], {
      icon: brandIcon,
    });

    marker.bindPopup(`
      <h3 class="popup-title">${escapeHtml(store.nama_gerai)}</h3>
      <p class="popup-text"><strong>Alamat:</strong> ${escapeHtml(store.alamat)}</p>
      <p class="popup-text"><strong>Kab/Kota:</strong> ${escapeHtml(store.kab_kota)}</p>
      <p class="popup-text"><strong>Provinsi:</strong> ${escapeHtml(store.provinsi)}</p>
      ${
        store.google_maps
          ? `<p class="popup-text"><a class="maps-link" href="${escapeAttribute(
              store.google_maps,
            )}" target="_blank" rel="noopener"><i class="ph-fill ph-navigation-arrow"></i> Buka Maps</a></p>`
          : ""
      }
    `);

    return marker;
  });

  markerLayer.addLayers(markers);

  if (filteredStores.length > 0) {
    const bounds = L.latLngBounds(
      filteredStores.map((store) => [store.latitude, store.longitude]),
    );

    if (bounds.isValid()) {
      map.fitBounds(bounds, {
        padding: [28, 28],
        maxZoom: filteredStores.length === 1 ? 15 : 11,
      });
    }
  }
}

function renderTable() {
  const totalRows = filteredStores.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));

  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalRows);
  const rowsToShow = filteredStores.slice(startIndex, endIndex);

  if (rowsToShow.length === 0) {
    elements.tableBody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-state">Tidak ada data yang sesuai dengan filter.</td>
      </tr>
    `;
  } else {
    elements.tableBody.innerHTML = rowsToShow
      .map(
        (store) => `
          <tr>
            <td>
              <strong>${escapeHtml(store.nama_gerai)}</strong>
              <br />
              <small>${escapeHtml(store.tipe_lokasi || "-")}</small>
            </td>
            <td class="address-cell">${escapeHtml(store.alamat || "-")}</td>
            <td>${escapeHtml(store.kab_kota || "-")}</td>
            <td>${escapeHtml(store.provinsi || "-")}</td>
            <td>
              ${
                store.google_maps
                  ? `<a class="maps-link" href="${escapeAttribute(
                      store.google_maps,
                    )}" target="_blank" rel="noopener"><i class="ph-fill ph-navigation-arrow"></i> Maps</a>`
                  : "-"
              }
            </td>
          </tr>
        `,
      )
      .join("");
  }

  if (totalRows === 0) {
    elements.tableInfo.textContent = `Tidak ada gerai sesuai filter. Tersaring ${formatNumber(
      validationStats.review,
    )} review dan ${formatNumber(validationStats.invalid)} invalid dari data mentah.`;
  } else {
    elements.tableInfo.textContent = `Menampilkan ${formatNumber(
      startIndex + 1,
    )}–${formatNumber(endIndex)} dari ${formatNumber(
      totalRows,
    )} gerai · Halaman ${formatNumber(currentPage)} dari ${formatNumber(
      totalPages,
    )}`;
  }

  renderPagination(totalPages);
}

function renderPagination(totalPages) {
  if (totalPages <= 1 || filteredStores.length === 0) {
    elements.pagination.innerHTML = "";
    return;
  }

  const pages = buildPageList(currentPage, totalPages);

  const prevDisabled = currentPage === 1 ? "disabled" : "";
  const nextDisabled = currentPage === totalPages ? "disabled" : "";

  const pageButtons = pages
    .map((page) => {
      if (page === "...") {
        return `<span class="page-ellipsis" aria-hidden="true">…</span>`;
      }
      const isActive = page === currentPage;
      return `
        <button
          type="button"
          class="page-btn ${isActive ? "is-active" : ""}"
          data-page="${page}"
          ${isActive ? 'aria-current="page"' : ""}
        >${page}</button>
      `;
    })
    .join("");

  elements.pagination.innerHTML = `
    <button
      type="button"
      class="page-btn page-nav"
      data-page="${currentPage - 1}"
      ${prevDisabled}
      aria-label="Halaman sebelumnya"
    >
      <i class="ph ph-caret-left"></i>
      <span>Sebelumnya</span>
    </button>
    <div class="page-numbers">${pageButtons}</div>
    <button
      type="button"
      class="page-btn page-nav"
      data-page="${currentPage + 1}"
      ${nextDisabled}
      aria-label="Halaman berikutnya"
    >
      <span>Berikutnya</span>
      <i class="ph ph-caret-right"></i>
    </button>
  `;
}

function buildPageList(current, total) {
  // Always show first, last, current, and neighbors. Use "..." between gaps.
  const delta = 1;
  const range = [];
  const result = [];

  for (
    let i = Math.max(2, current - delta);
    i <= Math.min(total - 1, current + delta);
    i++
  ) {
    range.push(i);
  }

  result.push(1);

  if (range[0] > 2) {
    result.push("...");
  } else if (total > 1 && range[0] === 2) {
    // No gap, will be added by range below
  }

  range.forEach((i) => result.push(i));

  if (range[range.length - 1] < total - 1) {
    result.push("...");
  }

  if (total > 1) {
    result.push(total);
  }

  return result;
}

function goToPage(page) {
  const totalPages = Math.max(1, Math.ceil(filteredStores.length / pageSize));
  const target = Math.min(Math.max(1, page), totalPages);
  if (target === currentPage) return;
  currentPage = target;
  renderTable();

  // Smooth scroll table card into view
  const tableCard = elements.tableBody.closest(".card");
  if (tableCard) {
    tableCard.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function renderTopCities() {
  const counter = new Map();

  filteredStores.forEach((store) => {
    const key = store.kab_kota || "Tidak diketahui";
    counter.set(key, (counter.get(key) || 0) + 1);
  });

  const topCities = [...counter.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "id"))
    .slice(0, 10);

  if (topCities.length === 0) {
    elements.topCities.innerHTML = `<li class="empty-state">Tidak ada data.</li>`;
    return;
  }

  elements.topCities.innerHTML = topCities
    .map(
      ([city, count]) => `
        <li>
          <span class="ranking-city">${escapeHtml(city)}</span>
          <span class="ranking-count">${formatNumber(count)} gerai</span>
        </li>
      `,
    )
    .join("");
}

function updateVisibleStats() {
  elements.visibleStores.textContent = formatNumber(filteredStores.length);
}

function updateTableHeaderIndicators() {
  document.querySelectorAll("th[data-sort]").forEach((th) => {
    const key = th.dataset.sort;
    const originalText = th.textContent.replace(/\s[↑↓]$/, "");

    if (key === sortState.key) {
      th.textContent = `${originalText} ${sortState.direction === "asc" ? "↑" : "↓"}`;
    } else {
      th.textContent = originalText;
    }
  });
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "id"),
  );
}

function formatNumber(value) {
  return new Intl.NumberFormat("id-ID").format(value);
}

function debounce(callback, delay = 250) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => callback.apply(null, args), delay);
  };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

function setLoading(isLoading) {
  document.body.classList.toggle("loading", isLoading);
}
