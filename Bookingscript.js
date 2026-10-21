/* ==========================================================================
   Student Accommodation Booking System Logic
   ========================================================================== */

const GOOGLE_SHEET_URL = "https://script.google.com/macros/s/AKfycbz9DZmaD-nVdg-rOrgqx2HFFMTT2h8MS-z8394S43xxwngWQkofsEyMiOeT4N8a3KL64w/exec";

// Maximum occupants per room
const MAX_OCCUPANTS = 2;

// Simplified Block Definitions
const BLOCKS_CONFIG = {
  Female: ["Block A", "Block B", "Block D", "Block G"],
  Male: ["Block A", "Block C", "Block D", "Block G"]
};

// Exact Gender-Specific Room Number Arrays
const ROOM_NUMBERS = {
  Female: {
    "Block B": Array.from({ length: 16 }, (_, i) => `B${i + 1}`), // B1 - B16
    "Block A": Array.from({ length: 3 }, (_, i) => `A${i + 1}`),  // A1 - A3
    "Block D": Array.from({ length: 5 }, (_, i) => `D${i + 1}`),  // D1 - D5
    "Block G": Array.from({ length: 2 }, (_, i) => `G${i + 1}`)   // G1 - G2
  },
  Male: {
    "Block A": Array.from({ length: 6 }, (_, i) => `A${i + 4}`),  // A4 - A9
    "Block C": Array.from({ length: 8 }, (_, i) => `C${i + 1}`),  // C1 - C8
    "Block D": Array.from({ length: 5 }, (_, i) => `D${i + 6}`),  // D6 - D10
    "Block G": ["G3", "G5", "G6"]                                 // G3, G5, G6
  }
};

// Global State management (Synced with Google Apps Script + fallback to localStorage)
let bookings = JSON.parse(localStorage.getItem('accommodation_bookings')) || [];

// DOM Elements
const form = document.getElementById('bookingForm');
const firstNameInput = document.getElementById('firstName');
const surnameInput = document.getElementById('surname');
const studentNumInput = document.getElementById('studentNum');
const phoneNumInput = document.getElementById('phoneNum');
const idNumberInput = document.getElementById('idNumber');
const studyYearSelect = document.getElementById('studyYear');
const blockSelect = document.getElementById('blockSelect');
const roomSelect = document.getElementById('roomSelect');
const submitBtn = document.getElementById('submitBtn');
const roomAlert = document.getElementById('roomAlert');
const receiptModal = document.getElementById('receiptModal');
const receiptBody = document.getElementById('receiptBody');
const closeModalBtn = document.getElementById('closeModalBtn');

/* ==========================================================================
   Initialization & Live Data Sync Across All Devices
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  setupGenderListeners();
  setupValidationListeners();

  blockSelect.addEventListener('change', () => {
    handleBlockChange();
    validateForm();
  });

  form.addEventListener('submit', handleFormSubmit);
  closeModalBtn.addEventListener('click', closeModal);

  // Close modal when clicking dark backdrop
  window.addEventListener('click', (e) => {
    if (e.target === receiptModal) closeModal();
  });

  // Fetch live bookings from Google Sheet across all devices
  fetchLiveBookings();

  // Initial check to keep button disabled on load
  validateForm();
});

/* ==========================================================================
   Fetch Live Bookings from Google Apps Script (GET Request)
   ========================================================================== */
async function fetchLiveBookings() {
  if (!GOOGLE_SHEET_URL || GOOGLE_SHEET_URL.includes("YOUR_GOOGLE_APPS_SCRIPT")) return;

  try {
    const response = await fetch(GOOGLE_SHEET_URL);
    if (response.ok) {
      const liveData = await response.json();
      if (Array.isArray(liveData)) {
        bookings = liveData;
        localStorage.setItem('accommodation_bookings', JSON.stringify(bookings));
        
        // Re-render blocks/rooms if block is already selected
        if (blockSelect.value) {
          handleBlockChange();
        }
        validateForm();
      }
    }
  } catch (error) {
    console.error("Could not fetch live bookings from Google Sheet. Using local cache:", error);
  }
}

/* ==========================================================================
   South African 13-Digit ID & Cell Phone Verification Logic
   ========================================================================== */
function isValidSAID(id) {
  if (!/^\d{13}$/.test(id)) return false;

  const month = parseInt(id.substring(2, 4), 10);
  if (month < 1 || month > 12) return false;

  const day = parseInt(id.substring(4, 6), 10);
  if (day < 1 || day > 31) return false;

  let sum = 0;
  for (let i = 0; i < 13; i++) {
    let digit = parseInt(id.charAt(i), 10);
    if (i % 2 !== 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }

  return sum % 10 === 0;
}

function isValidPhone(phone) {
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  const isStandardSA = /^0[678]\d{8}$/.test(cleaned);
  const isInternationalSA = /^\+27[678]\d{8}$/.test(cleaned);
  return isStandardSA || isInternationalSA;
}

/* ==========================================================================
   Real-Time Form Validation (Enables Submit Button & Prevents Duplicate ID)
   ========================================================================== */
function setupValidationListeners() {
  const inputs = [firstNameInput, surnameInput, studentNumInput, phoneNumInput, idNumberInput, studyYearSelect, roomSelect];
  
  inputs.forEach((input) => {
    input.addEventListener('input', validateForm);
    input.addEventListener('change', validateForm);
  });
}

function validateForm() {
  const firstName = firstNameInput.value.trim();
  const surname = surnameInput.value.trim();
  const studentNum = studentNumInput.value.trim();
  const phoneNum = phoneNumInput ? phoneNumInput.value.trim() : "";
  const idNumber = idNumberInput.value.trim();
  const studyYear = studyYearSelect.value;
  const genderRadio = document.querySelector('input[name="gender"]:checked');
  const selectedBlock = blockSelect.value;
  const selectedRoom = roomSelect.value;

  const validID = isValidSAID(idNumber);
  const validPhone = isValidPhone(phoneNum);

  // Check against global live bookings
  const alreadyBooked = bookings.some(
    (b) => String(b.idNumber).trim() === idNumber || String(b.studentNum).trim() === studentNum
  );

  if (alreadyBooked && (idNumber.length > 0 || studentNum.length > 0)) {
    showAlert("You have already booked a room with this ID or Student Number.", "warning");
  } else if (phoneNum.length > 0 && !validPhone) {
    showAlert("Please enter a valid 10-digit South African cell phone number (starting with 06, 07, or 08).", "warning");
  } else if (idNumber.length > 0 && !validID) {
    showAlert("Please enter a valid 13-digit South African ID number.", "warning");
  } else if (idNumber.length === 13 && validID && validPhone) {
    hideAlert();
  }

  const isFormValid =
    firstName !== "" &&
    surname !== "" &&
    studentNum !== "" &&
    validPhone &&
    validID &&
    !alreadyBooked &&
    studyYear !== "" &&
    genderRadio !== null &&
    selectedBlock !== "" &&
    selectedRoom !== "";

  submitBtn.disabled = !isFormValid;
}

/* ==========================================================================
   Gender Selection Logic
   ========================================================================== */
function setupGenderListeners() {
  const genderBtns = document.querySelectorAll('.gender-btn');

  genderBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const radio = btn.querySelector('input[type="radio"]');
      if (!radio) return;

      radio.checked = true;
      const selectedGender = radio.value;

      genderBtns.forEach((b) => {
        const input = b.querySelector('input[type="radio"]');
        if (input && input.value === selectedGender) {
          b.classList.add('active');
        } else {
          b.classList.remove('active');
        }
      });

      populateBlocks(selectedGender);
      validateForm();
    });
  });
}

function populateBlocks(gender) {
  blockSelect.innerHTML = '<option value="">-- Select Block --</option>';
  roomSelect.innerHTML = '<option value="">-- Select block first --</option>';
  roomSelect.disabled = true;

  const blockList = BLOCKS_CONFIG[gender];

  if (blockList) {
    blockList.forEach((blockName) => {
      const option = document.createElement('option');
      option.value = blockName;
      option.textContent = blockName;
      blockSelect.appendChild(option);
    });
  }

  blockSelect.disabled = false;
  hideAlert();
}

/* ==========================================================================
   Exact Room Selection & Capacity Calculation (Calculated against Live Data)
   ========================================================================== */
function handleBlockChange() {
  const selectedBlock = blockSelect.value;
  const genderRadio = document.querySelector('input[name="gender"]:checked');

  roomSelect.innerHTML = '<option value="">-- Select Room --</option>';

  if (!selectedBlock || !genderRadio) {
    roomSelect.disabled = true;
    hideAlert();
    return;
  }

  const gender = genderRadio.value;
  const roomList = ROOM_NUMBERS[gender] && ROOM_NUMBERS[gender][selectedBlock];

  if (!roomList) {
    roomSelect.disabled = true;
    hideAlert();
    return;
  }

  let totalFreeSpots = 0;

  roomList.forEach((rawRoomCode) => {
    const displayLabel = `Room ${rawRoomCode}`;

    // Count occupants from live global bookings
    const currentOccupants = bookings.filter(
      (b) => String(b.roomCode).trim() === displayLabel
    ).length;

    const spotsRemaining = MAX_OCCUPANTS - currentOccupants;
    if (spotsRemaining > 0) {
      totalFreeSpots += spotsRemaining;
    }

    const option = document.createElement('option');
    option.value = displayLabel;

    if (currentOccupants >= MAX_OCCUPANTS) {
      option.textContent = `${displayLabel} (FULL - 2/2 occupied)`;
      option.disabled = true;
    } else {
      option.textContent = `${displayLabel} (${currentOccupants}/${MAX_OCCUPANTS} occupied - ${spotsRemaining} spot left)`;
    }

    roomSelect.appendChild(option);
  });

  roomSelect.disabled = false;

  if (totalFreeSpots === 0) {
    showAlert('All rooms in this block are currently full.', 'warning');
  } else {
    showAlert(`${totalFreeSpots} total bed spots available in ${selectedBlock}.`, 'info');
  }
}

/* ==========================================================================
   Form Submission & Persistence
   ========================================================================== */
function handleFormSubmit(e) {
  e.preventDefault();

  const firstName = firstNameInput.value.trim();
  const surname = surnameInput.value.trim();
  const studentNum = studentNumInput.value.trim();
  const phoneNum = phoneNumInput ? phoneNumInput.value.trim() : "";
  const idNumber = idNumberInput.value.trim();
  const studyYear = studyYearSelect.value;
  const genderRadio = document.querySelector('input[name="gender"]:checked');
  const selectedRoomCode = roomSelect.value;

  // Double-check duplicate submission across live data
  const isDuplicate = bookings.some(
    (b) => String(b.idNumber).trim() === idNumber || String(b.studentNum).trim() === studentNum
  );

  if (isDuplicate) {
    alert('A booking has already been submitted under this ID or Student Number.');
    validateForm();
    return;
  }

  const currentOccupants = bookings.filter((b) => String(b.roomCode).trim() === selectedRoomCode).length;
  if (currentOccupants >= MAX_OCCUPANTS) {
    alert('Sorry, this room was just filled! Please select another room.');
    handleBlockChange();
    validateForm();
    return;
  }

  const bookingData = {
    id: 'BK-' + Date.now().toString().slice(-6),
    timestamp: new Date().toLocaleString(),
    firstName,
    surname,
    studentNum,
    phoneNum,
    idNumber,
    studyYear,
    gender: genderRadio.value,
    block: blockSelect.value,
    roomCode: selectedRoomCode
  };

  // Add to local state and update localStorage
  bookings.push(bookingData);
  localStorage.setItem('accommodation_bookings', JSON.stringify(bookings));

  // Post booking to Google Spreadsheet
  if (GOOGLE_SHEET_URL) {
    sendToGoogleSheet(GOOGLE_SHEET_URL, bookingData);
  }

  showReceipt(bookingData);

  // Reset form and controls
  form.reset();
  document.querySelectorAll('.gender-btn').forEach(btn => btn.classList.remove('active'));
  blockSelect.disabled = true;
  roomSelect.disabled = true;
  blockSelect.innerHTML = '<option value="">-- Please select gender first --</option>';
  roomSelect.innerHTML = '<option value="">-- Select block first --</option>';
  hideAlert();
  
  validateForm();
}

/* ==========================================================================
   Google Spreadsheet Automatic POST
   ========================================================================== */
function sendToGoogleSheet(url, data) {
  fetch(url, {
    method: 'POST',
    mode: 'no-cors',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  })
    .then(() => {
      console.log('Booking automatically sent to Google Sheet.');
      // Refetch live bookings to update room count globally after submit
      setTimeout(fetchLiveBookings, 1500);
    })
    .catch((err) => console.error('Error sending to Google Sheet:', err));
}

/* ==========================================================================
   Modal & Receipt Display
   ========================================================================== */
function showReceipt(data) {
  receiptBody.innerHTML = `
    <div class="receipt-card">
      <div class="receipt-row">
        <span>Booking Reference</span>
        <span>${data.id}</span>
      </div>
      <div class="receipt-row">
        <span>Student Name</span>
        <span>${data.firstName} ${data.surname}</span>
      </div>
      <div class="receipt-row">
        <span>Student Number</span>
        <span>${data.studentNum}</span>
      </div>
      <div class="receipt-row">
        <span>Cell Phone</span>
        <span>${data.phoneNum}</span>
      </div>
      <div class="receipt-row">
        <span>Academic Year</span>
        <span>${data.studyYear}</span>
      </div>
      <div class="receipt-row">
        <span>Gender Wing</span>
        <span>${data.gender}</span>
      </div>
      <div class="receipt-row">
        <span>Allocated Room</span>
        <span style="color: var(--primary-blue, #2563eb);">${data.roomCode}</span>
      </div>
      <div class="receipt-row">
        <span>Date & Time</span>
        <span>${data.timestamp}</span>
      </div>
    </div>
  `;

  receiptModal.classList.add('active');
}

function closeModal() {
  receiptModal.classList.remove('active');
}

/* ==========================================================================
   Helper Utilities
   ========================================================================== */
function showAlert(message, type = 'info') {
  roomAlert.textContent = message;
  roomAlert.className = `alert ${type}`;
}

function hideAlert() {
  roomAlert.className = 'alert hidden';
}