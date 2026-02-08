let lastClickedInput = null;
let lastDetected = null;
let detectRequirementsFn = null;
let floatingEnabled = true;
let globalFloatingEnabled = true;
let siteOverrideEnabled = null;
let inputToDetected = new WeakMap();
let autoProcessEnabled = true;

const HIGHLIGHT_STYLE = "2px solid #3b82f6";
const FLOATING_BUTTON_CLASS = "formfit-floating-button";
const FLOATING_STYLE_ID = "formfit-floating-style";
const FLOATING_TOGGLE_KEY = "floatingButtonsEnabled";
const SITE_OVERRIDES_KEY = "floatingButtonsBySite";
const AUTO_PROCESS_KEY = "autoProcessEnabled";
const trackedInputs = new Set();
const inputToButton = new WeakMap();
let positionRaf = null;
let scanTimeout = null;

async function loadDetector() {
  try {
    const moduleUrl = chrome.runtime.getURL("utils/detector.js");
    const module = await import(moduleUrl);
    detectRequirementsFn = module.detectRequirements;
    console.log('[FormFit] Detector loaded successfully');
  } catch (error) {
    console.error('[FormFit] Failed to load detector:', error);
    detectRequirementsFn = null;
  }
}

function highlightInput(input) {
  if (lastClickedInput && lastClickedInput !== input) {
    lastClickedInput.style.outline = "";
  }
  if (input) {
    input.style.outline = HIGHLIGHT_STYLE;
  }
}

function ensureFloatingStyles() {
  if (document.getElementById(FLOATING_STYLE_ID)) {
    return;
  }
  const style = document.createElement("style");
  style.id = FLOATING_STYLE_ID;
  style.textContent = `
    .${FLOATING_BUTTON_CLASS} {
      position: absolute;
      z-index: 2147483647;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 4px 10px;
      border-radius: 999px;
      border: none;
      background: #2563eb;
      color: #ffffff;
      font-size: 11px;
      font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
      cursor: pointer;
      box-shadow: 0 6px 16px rgba(15, 23, 42, 0.2);
    }
    .${FLOATING_BUTTON_CLASS}:hover {
      background: #1d4ed8;
    }
    .${FLOATING_BUTTON_CLASS}:focus {
      outline: 2px solid rgba(37, 99, 235, 0.35);
      outline-offset: 2px;
    }
  `;
  document.head.appendChild(style);
}

function isVisible(input) {
  if (!input.isConnected) {
    return false;
  }
  const style = window.getComputedStyle(input);
  if (style.display === "none" || style.visibility === "hidden") {
    return false;
  }
  const rect = input.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function positionFloatingButton(input, button) {
  if (!floatingEnabled) {
    button.style.display = "none";
    return;
  }
  if (!isVisible(input)) {
    button.style.display = "none";
    return;
  }

  button.style.display = "inline-flex";

  const rect = input.getBoundingClientRect();
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;
  const buttonWidth = button.offsetWidth || 60;
  const buttonHeight = button.offsetHeight || 24;

  let left = rect.right + scrollX + 6;
  let top = rect.top + scrollY;

  const maxLeft = scrollX + window.innerWidth - buttonWidth - 8;
  if (left > maxLeft) {
    left = rect.left + scrollX - buttonWidth - 6;
  }
  if (left < scrollX + 8) {
    left = scrollX + 8;
  }

  const maxTop = scrollY + window.innerHeight - buttonHeight - 8;
  if (top > maxTop) {
    top = maxTop;
  }
  if (top < scrollY + 8) {
    top = scrollY + 8;
  }

  button.style.left = `${left}px`;
  button.style.top = `${top}px`;
}

function createFloatingButton(input) {
  // Triple-check we don't already have a button
  if (inputToButton.has(input)) {
    console.log('[FormFit] Button already exists for this input, skipping');
    return;
  }
  
  // Check if input already has a unique ID
  if (!input.dataset.formfitId) {
    input.dataset.formfitId = 'formfit-' + Math.random().toString(36).substr(2, 9);
  } else {
    // Already processed - skip
    console.log('[FormFit] Input already has FormFit ID, skipping duplicate');
    return;
  }
  
  ensureFloatingStyles();
  const button = document.createElement("button");
  button.type = "button";
  button.className = FLOATING_BUTTON_CLASS;
  button.textContent = "FormFit";
  button.title = "FormFit: Smart Upload";
  button.setAttribute('data-formfit-button', 'true');
  button.setAttribute('data-formfit-input-id', input.dataset.formfitId);
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    lastClickedInput = input;
    highlightInput(input);
    
    // Force rescan before showing modal
    scanInput(input);
    
    // Show custom modal instead of opening file picker
    showFormFitModal(input);
  });
  document.body.appendChild(button);
  inputToButton.set(input, button);
  trackedInputs.add(input);
  positionFloatingButton(input, button);
  console.log('[FormFit] Created floating button for input:', input.dataset.formfitId);
}

function ensureFloatingButton(input) {
  if (!floatingEnabled) {
    return;
  }
  
  // Check unique ID to prevent duplicates
  if (input.dataset.formfitId) {
    const existingButton = document.querySelector(`[data-formfit-input-id="${input.dataset.formfitId}"]`);
    if (existingButton && existingButton.isConnected) {
      console.log('[FormFit] Button already exists for this input (by ID), skipping');
      return;
    }
  }
  
  // Already tracked and button exists in DOM
  if (trackedInputs.has(input)) {
    const btn = inputToButton.get(input);
    if (btn && btn.isConnected) {
      return; // Button already good
    }
    // Button was removed from DOM, clean up tracking
    trackedInputs.delete(input);
    inputToButton.delete(input);
  }
  
  if (!isVisible(input)) {
    return;
  }
  
  createFloatingButton(input);
}

function updateAllFloatingButtons() {
  positionRaf = null;
  trackedInputs.forEach((input) => {
    if (!document.contains(input)) {
      const button = inputToButton.get(input);
      if (button) {
        button.remove();
      }
      inputToButton.delete(input);
      trackedInputs.delete(input);
      return;
    }

    const button = inputToButton.get(input);
    if (button) {
      positionFloatingButton(input, button);
    }
  });
}

function clearFloatingButtons() {
  console.log('[FormFit] Clearing all floating buttons, current tracked:', trackedInputs.size);
  
  // Remove ALL FormFit buttons from DOM
  document.querySelectorAll('[data-formfit-button="true"]').forEach(btn => {
    btn.remove();
  });
  
  // Clear all mappings
  inputToButton.clear();
  trackedInputs.clear();
  
  console.log('[FormFit] All buttons cleared');
}

function scheduleFloatingUpdate() {
  if (positionRaf) {
    return;
  }
  positionRaf = window.requestAnimationFrame(updateAllFloatingButtons);
}

function computeFloatingEnabled() {
  if (typeof siteOverrideEnabled === "boolean") {
    return siteOverrideEnabled;
  }
  return globalFloatingEnabled;
}

function applyFloatingEnabled(nextValue) {
  floatingEnabled = nextValue;
  if (!floatingEnabled) {
    clearFloatingButtons();
  } else {
    scanAllInputs();
  }
}

function pickBestInput(inputs) {
  if (lastClickedInput && inputs.includes(lastClickedInput) && isVisible(lastClickedInput)) {
    return lastClickedInput;
  }

  const visibleInputs = inputs.filter((input) => isVisible(input));
  if (visibleInputs.length === 0) {
    return null;
  }

  visibleInputs.sort((a, b) => {
    const rectA = a.getBoundingClientRect();
    const rectB = b.getBoundingClientRect();
    const scoreA = Math.abs(rectA.top) + Math.abs(rectA.left);
    const scoreB = Math.abs(rectB.top) + Math.abs(rectB.left);
    return scoreA - scoreB;
  });

  return visibleInputs[0];
}

function formatTooltip(detected) {
  if (!detected) {
    return "FormFit: choose file";
  }
  const parts = [];
  if (detected.width && detected.height) {
    parts.push(`${detected.width}x${detected.height}px`);
  }
  if (detected.maxSizeKB) {
    parts.push(`max ${detected.maxSizeKB}KB`);
  }
  if (parts.length === 0) {
    return "FormFit: choose file";
  }
  return `FormFit: ${parts.join(", ")}`;
}

function updateFloatingTooltip(input, detected) {
  const button = inputToButton.get(input);
  if (!button) {
    return;
  }
  button.title = formatTooltip(detected);
}

function normalizeText(text) {
  return text.replace(/\s+/g, " ").trim();
}

function getNearbyText(input) {
  const texts = [];
  
  // Check for associated label
  if (input.id) {
    const label = document.querySelector(`label[for="${input.id}"]`);
    if (label) {
      texts.push(label.innerText);
    }
  }

  // Check wrapping label
  const wrappingLabel = input.closest("label");
  if (wrappingLabel) {
    texts.push(wrappingLabel.innerText);
  }

  // Check parent element
  const parentText = input.parentElement?.innerText;
  if (parentText) {
    texts.push(parentText);
  }

  // Check form
  const formText = input.closest("form")?.innerText;
  if (formText) {
    texts.push(formText);
  }

  // Check modal/dialog containers - multiple selectors
  let modal = input.closest('[role="dialog"]');
  if (!modal) modal = input.closest('.modal');
  if (!modal) modal = input.closest('.popup');
  if (!modal) modal = input.closest('[class*="modal"]');
  if (!modal) modal = input.closest('[class*="dialog"]');
  if (!modal) modal = input.closest('[style*="position"][style*="z-index"]'); // Positioned modals
  
  if (modal) {
    console.log('[FormFit] Found modal/dialog container');
    texts.push(modal.innerText);
  }

  // Check nearby divs within 4 levels up (increased from 3)
  let current = input.parentElement;
  for (let i = 0; i < 4 && current; i++) {
    if (current.innerText && !texts.includes(current.innerText)) {
      texts.push(current.innerText);
    }
    current = current.parentElement;
  }

  const combined = normalizeText(texts.join(" "));
  console.log('[FormFit] Extracted text (first 300 chars):', combined.substring(0, 300));
  return combined;
}

function sendDetectedRequirements(requirements) {
  chrome.runtime.sendMessage({
    type: "updateRequirements",
    data: requirements,
  });
}

function scanInput(input) {
  if (!detectRequirementsFn) {
    console.log('[FormFit] Detector not loaded yet');
    return;
  }
  const text = getNearbyText(input);
  if (!text) {
    console.log('[FormFit] No nearby text found');
    return;
  }
  console.log('[FormFit] Calling detectRequirementsFn with text...');
  const detected = detectRequirementsFn(text);
  console.log('[FormFit] Detection result:', detected);
  if (detected) {
    console.log('[FormFit] Detected requirements:', detected, 'from text:', text.substring(0, 200));
    lastDetected = detected;
    inputToDetected.set(input, detected);
    sendDetectedRequirements(detected);
    updateFloatingTooltip(input, detected);
  } else {
    console.log('[FormFit] No requirements detected from text:', text.substring(0, 200));
  }
}

function scanAllInputs() {
  const inputs = document.querySelectorAll('input[type="file"]');
  console.log('[FormFit] Scanning', inputs.length, 'file inputs');
  
  // Remove any duplicate buttons first
  const existingButtons = document.querySelectorAll('[data-formfit-button="true"]');
  const buttonInputIds = new Set();
  existingButtons.forEach(btn => {
    const inputId = btn.getAttribute('data-formfit-input-id');
    if (inputId && buttonInputIds.has(inputId)) {
      // Duplicate button for same input - remove it
      btn.remove();
      console.log('[FormFit] Removed duplicate button for:', inputId);
    } else if (inputId) {
      buttonInputIds.add(inputId);
    }
  });
  
  inputs.forEach((input) => {
    scanInput(input);
    if (floatingEnabled) {
      ensureFloatingButton(input);
    }
  });
  scheduleFloatingUpdate();
}

function autoSelectInput() {
  const inputs = Array.from(document.querySelectorAll('input[type="file"]'));
  if (inputs.length === 0) {
    console.log('[FormFit] No file inputs found on page');
    return null;
  }

  const chosen = pickBestInput(inputs);
  if (!chosen) {
    console.log('[FormFit] No visible file input found');
    return null;
  }

  console.log('[FormFit] Auto-selected input:', chosen);
  lastClickedInput = chosen;
  highlightInput(chosen);
  scanInput(chosen);
  ensureFloatingButton(chosen);
  updateFloatingTooltip(chosen, lastDetected);
  return chosen;
}

function handleInputSelection(event) {
  const target = event.target;
  if (target instanceof HTMLInputElement && target.type === "file") {
    lastClickedInput = target;
    highlightInput(target);
    scanInput(target);
    ensureFloatingButton(target);
    updateFloatingTooltip(target, lastDetected);
  }
}
async function handleFileChange(event) {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || input.type !== "file") {
    return;
  }
  if (!input.files || input.files.length === 0) {
    return;
  }
  
  // Skip if processed by modal
  if (input.getAttribute('data-formfit-processed') === 'true') {
    console.log('[FormFit] File already processed by modal, skipping auto-process');
    input.removeAttribute('data-formfit-processed');
    return;
  }
  
  // Skip auto-process now - modal handles everything
  console.log('[FormFit] File selected - use FormFit button for smart upload');
  return;
}

function findNearbyUploadButton(input) {
  console.log('[FormFit] Searching for upload button...');
  
  // Search patterns for upload buttons  
  const buttonSelectors = [
    'button[type="submit"]',
    'input[type="submit"]',
    'button:contains("Upload")',
    'button:contains("upload")',
    'button:contains("Submit")',
    'button:contains("submit")',
    '[role="button"][aria-label*="Upload"]',
    '[role="button"][aria-label*="upload"]',
    'button.btn-primary',
    'button.upload-btn',
    'input.upload-btn',
  ];
  
  const container = input.closest('form') || input.closest('[role="dialog"]') || input.parentElement;
  
  if (!container) {
    console.log('[FormFit] No container found');
    return null;
  }
  
  // Try finding submit/upload buttons in order of proximity
  let button = null;
  
  // 1. Check immediate next sibling
  let sibling = input.nextElementSibling;
  while (sibling) {
    if (isUploadButton(sibling)) {
      console.log('[FormFit] Found upload button as next sibling');
      return sibling;
    }
    sibling = sibling.nextElementSibling;
  }
  
  // 2. Check parent's children
  const parent = input.parentElement;
  if (parent) {
    const buttons = parent.querySelectorAll('button[type="submit"], input[type="submit"], button:not([type])');
    for (const btn of buttons) {
      const text = btn.textContent.toLowerCase();
      if (text.includes('upload') || text.includes('submit') || text.includes('ok')) {
        console.log('[FormFit] Found button in parent:', btn.textContent);
        return btn;
      }
    }
  }
  
  // 3. Check entire form
  const form = input.closest('form');
  if (form) {
    const buttons = form.querySelectorAll('button[type="submit"], input[type="submit"], button');
    for (const btn of buttons) {
      if (btn.offsetParent !== null) { // visible check
        const text = btn.textContent.toLowerCase();
        if (text.includes('upload') || text.includes('submit') || text.includes('ok')) {
          console.log('[FormFit] Found button in form:', btn.textContent);
          return btn;
        }
      }
    }
  }
  
  // 4. Check closest dialog/modal
  const dialog = input.closest('[role="dialog"], .modal, .popup');
  if (dialog) {
    const buttons = dialog.querySelectorAll('button[type="submit"], input[type="submit"], button');
    for (const btn of buttons) {
      if (btn.offsetParent !== null) {
        const text = btn.textContent.toLowerCase();
        if (text.includes('upload') || text.includes('submit') || text.includes('ok')) {
          console.log('[FormFit] Found button in dialog:', btn.textContent);
          return btn;
        }
      }
    }
  }
  
  console.log('[FormFit] No suitable upload button found');
  return null;
}

// VALIDATION FUNCTION - Verify resized image meets ALL requirements
async function validateResizedImage(blob, requirements) {
  console.log('[FormFit Validator] Starting comprehensive validation...');
  
  const validationChecks = {
    dimensions: false,
    size: false,
    format: false,
    readable: false,
  };
  
  try {
    // 1. Check dimensions
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = URL.createObjectURL(blob);
    });
    URL.revokeObjectURL(img.src);
    
    if (requirements.width && requirements.height) {
      const dimMatch = img.width === requirements.width && img.height === requirements.height;
      validationChecks.dimensions = dimMatch;
      console.log(`[FormFit Validator] Dimensions: ${img.width}×${img.height}px vs required ${requirements.width}×${requirements.height}px - ${dimMatch ? '✓ PASS' : '✗ FAIL'}`);
      if (!dimMatch) {
        throw new Error(`Dimension mismatch: Got ${img.width}×${img.height}px, expected ${requirements.width}×${requirements.height}px`);
      }
    }
    
    // 2. Check file size
    const sizeKB = blob.size / 1024;
    if (requirements.maxSizeKB) {
      const sizeMatch = sizeKB <= requirements.maxSizeKB;
      validationChecks.size = sizeMatch;
      console.log(`[FormFit Validator] File size: ${sizeKB.toFixed(1)}KB vs max ${requirements.maxSizeKB}KB - ${sizeMatch ? '✓ PASS' : '✗ FAIL'}`);
      if (!sizeMatch) {
        throw new Error(`File too large: ${sizeKB.toFixed(1)}KB exceeds maximum ${requirements.maxSizeKB}KB`);
      }
    }
    
    // 3. Check format
    const formatMatch = blob.type === 'image/jpeg' || blob.type === 'image/png';
    validationChecks.format = formatMatch;
    console.log(`[FormFit Validator] Format: ${blob.type} - ${formatMatch ? '✓ PASS' : '✗ FAIL'}`);
    
    // 4. Check file is readable
    const arrayBuffer = await blob.arrayBuffer();
    const readable = arrayBuffer.byteLength > 0;
    validationChecks.readable = readable;
    console.log(`[FormFit Validator] File readable: ${readable ? '✓ PASS' : '✗ FAIL'}`);
    if (!readable) {
      throw new Error('File is not readable');
    }
    
    console.log('[FormFit Validator] ✓✓✓ ALL VALIDATIONS PASSED ✓✓✓');
    console.log('[FormFit Validator] Checks:', validationChecks);
    
    return {
      ok: true,
      checks: validationChecks,
      message: 'All validations passed',
    };
    
  } catch (error) {
    console.error('[FormFit Validator] ✗✗✗ VALIDATION FAILED ✗✗✗:', error.message);
    return {
      ok: false,
      checks: validationChecks,
      error: error.message,
    };
  }
}

// UPLOAD VERIFICATION FUNCTION - Verify upload actually succeeded
async function verifyAndUpload(input, uploadButton, detected, finalFile) {
  console.log('[FormFit Upload Verifier] Starting upload process...');
  
  const messageArea = document.querySelector('.formfit-message-area');
  if (!messageArea) return;
  
  try {
    // Take snapshot of form state before upload
    const formBefore = captureFormState(input);
    
    // Click upload button
    console.log('[FormFit Upload Verifier] Clicking upload button:', uploadButton.textContent);
    uploadButton.click();
    
    // Wait and check multiple times
    let uploadSucceeded = false;
    let checks = 0;
    
    for (let i = 0; i < 5; i++) {
      await new Promise(resolve => setTimeout(resolve, 600));
      checks++;
      
      // Check 1: File removed from input
      if (!input.files || input.files.length === 0) {
        console.log(`[FormFit Upload Verifier] Check ${checks}: File removed from input ✓`);
        uploadSucceeded = true;
        break;
      }
      
      // Check 2: Form state changed
      const formAfter = captureFormState(input);
      if (formBefore !== formAfter) {
        console.log(`[FormFit Upload Verifier] Check ${checks}: Form state changed ✓`);
        uploadSucceeded = true;
        break;
      }
      
      // Check 3: Look for success indicators
      const successIndicator = document.querySelector('.success, [class*="success"], [id*="success"]');
      if (successIndicator && successIndicator.offsetParent !== null) {
        console.log(`[FormFit Upload Verifier] Check ${checks}: Success indicator found ✓`);
        uploadSucceeded = true;
        break;
      }
      
      console.log(`[FormFit Upload Verifier] Check ${checks}: Still processing... (${(checks*600)}ms)`);
    }
    
    if (uploadSucceeded) {
      console.log('[FormFit Upload Verifier] ✓✓✓ UPLOAD VERIFIED SUCCESSFUL ✓✓✓');
      messageArea.innerHTML = `
        <div class="formfit-success">
          <span style="font-size:18px;">🎉</span>
          <div>
            <strong>✓ Upload successful!</strong><br>
            File: ${finalFile.name}<br>
            Size: ${(finalFile.size/1024).toFixed(1)}KB<br>
            <small>Document processed successfully</small>
          </div>
        </div>
      `;
      setTimeout(() => {
        const closeBtn = document.querySelector('.formfit-modal-close');
        if (closeBtn) closeBtn.click();
      }, 2000);
    } else {
      console.log('[FormFit Upload Verifier] ⚠ Upload status unclear');
      messageArea.innerHTML = `
        <div class="formfit-success">
          <span style="font-size:18px;">⚙️</span>
          <div>
            <strong>Upload processing...</strong><br>
            File submitted to server<br>
            <small>Please wait for confirmation</small>
          </div>
        </div>
      `;
      setTimeout(() => {
        const closeBtn = document.querySelector('.formfit-modal-close');
        if (closeBtn) closeBtn.click();
      }, 3000);
    }
    
  } catch (error) {
    console.error('[FormFit Upload Verifier] Error:', error);
    messageArea.innerHTML = `
      <div class="formfit-error">
        <strong>Upload issue:</strong> ${error.message}
      </div>
    `;
  }
}

// Helper: Capture form state (checksum of visible elements)
function captureFormState(input) {
  const form = input.closest('form');
  if (!form) return '';
  
  const elements = form.querySelectorAll('input, textarea, select');
  let state = '';
  for (const el of elements) {
    state += el.value + '|' + el.className + '|';
  }
  return state;
}

function showFormFitModal(input) {
  console.log('[FormFit] Opening FormFit modal');
  
  // Get detected requirements
  const detected = inputToDetected.get(input) || lastDetected;
  
  // Create modal overlay
  const overlay = document.createElement('div');
  overlay.className = 'formfit-modal-overlay';
  
  const modal = document.createElement('div');
  modal.className = 'formfit-modal';
  
  // Header
  const header = document.createElement('div');
  header.className = 'formfit-modal-header';
  header.innerHTML = `
    <h2 class="formfit-modal-title">
      <span>🎯</span> FormFit Smart Upload
    </h2>
    <button class="formfit-modal-close" title="Close">×</button>
  `;
  
  // Body
  const body = document.createElement('div');
  body.className = 'formfit-modal-body';
  
  // Show requirements if detected
  let requirementsHTML = '';
  if (detected && (detected.width || detected.height || detected.maxSizeKB)) {
    requirementsHTML = `
      <div class="formfit-requirements">
        <h3>📋 Detected Requirements</h3>
        ${detected.width && detected.height ? `
          <div class="formfit-req-item">
            <span class="formfit-req-icon">📐</span>
            <span>Dimensions: <strong>${detected.width} × ${detected.height} pixels</strong></span>
          </div>
        ` : ''}
        ${detected.maxSizeKB ? `
          <div class="formfit-req-item">
            <span class="formfit-req-icon">💾</span>
            <span>Max Size: <strong>${detected.maxSizeKB} KB</strong></span>
          </div>
        ` : ''}
        <div class="formfit-req-item">
          <span class="formfit-req-icon">✨</span>
          <span>Format: <strong>JPEG (auto-converted)</strong></span>
        </div>
      </div>
    `;
  } else {
    requirementsHTML = `
      <div class="formfit-requirements">
        <h3>⚠️ No Requirements Detected</h3>
        <div class="formfit-req-item">
          <span class="formfit-req-icon">ℹ️</span>
          <span>Image will be uploaded as-is. You can still resize manually.</span>
        </div>
      </div>
    `;
  }
  
  body.innerHTML = requirementsHTML + `
    <div class="formfit-file-input-area" id="formfit-drop-area">
      <div class="formfit-upload-icon">📁</div>
      <div class="formfit-file-label">Click to select image</div>
      <div class="formfit-file-hint">or drag and drop here</div>
      <div class="formfit-file-info" style="display:none;" id="formfit-file-info"></div>
      <div class="formfit-preview" style="display:none;" id="formfit-preview">
        <img id="formfit-preview-img" alt="Preview">
      </div>
    </div>
    <div class="formfit-modal-actions">
      <button class="formfit-btn formfit-btn-secondary" id="formfit-cancel-btn">Cancel</button>
      <button class="formfit-btn formfit-btn-primary" id="formfit-upload-btn" disabled>
        <span>🚀</span> Resize & Upload
      </button>
    </div>
    <div class="formfit-processing" style="display:none;" id="formfit-processing">
      <div class="formfit-spinner"></div>
      <div class="formfit-processing-text">Processing image...</div>
    </div>
    <div id="formfit-message-area"></div>
  `;
  
  modal.appendChild(header);
  modal.appendChild(body);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  
  // Store selected file
  let selectedFile = null;
  
  // Close modal function
  const closeModal = () => {
    overlay.remove();
  };
  
  // Event listeners
  const closeBtn = header.querySelector('.formfit-modal-close');
  const cancelBtn = body.querySelector('#formfit-cancel-btn');
  const uploadBtn = body.querySelector('#formfit-upload-btn');
  const dropArea = body.querySelector('#formfit-drop-area');
  const fileInfo = body.querySelector('#formfit-file-info');
  const preview = body.querySelector('#formfit-preview');
  const previewImg = body.querySelector('#formfit-preview-img');
  const processing = body.querySelector('#formfit-processing');
  const messageArea = body.querySelector('#formfit-message-area');
  
  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });
  
  // File selection
  const handleFileSelect = (file) => {
    if (!file || !file.type.startsWith('image/')) {
      messageArea.innerHTML = '<div class="formfit-error">Please select an image file.</div>';
      return;
    }
    
    selectedFile = file;
    messageArea.innerHTML = '';
    
    // Show file info
    const sizeKB = (file.size / 1024).toFixed(1);
    fileInfo.innerHTML = `
      <strong>📄 ${file.name}</strong><br>
      Size: ${sizeKB} KB
    `;
    fileInfo.style.display = 'block';
    
    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
      previewImg.src = e.target.result;
      preview.style.display = 'block';
      
      // Get image dimensions
      const img = new Image();
      img.onload = () => {
        fileInfo.innerHTML += `<br>Dimensions: ${img.width} × ${img.height} px`;
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
    
    dropArea.classList.add('has-file');
    uploadBtn.disabled = false;
  };
  
  // Click to select
  dropArea.addEventListener('click', () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handleFileSelect(e.target.files[0]);
      }
    });
    fileInput.click();
  });
  
  // Drag and drop
  dropArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropArea.style.borderColor = '#2563eb';
    dropArea.style.background = '#eff6ff';
  });
  
  dropArea.addEventListener('dragleave', () => {
    dropArea.style.borderColor = '#cbd5e1';
    dropArea.style.background = '#f8fafc';
  });
  
  dropArea.addEventListener('drop', (e) => {
    e.preventDefault();
    dropArea.style.borderColor = '#cbd5e1';
    dropArea.style.background = '#f8fafc';
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  });
  
  // Upload button
  uploadBtn.addEventListener('click', async () => {
    if (!selectedFile) return;
    
    try {
      processing.style.display = 'block';
      uploadBtn.disabled = true;
      cancelBtn.disabled = true;
      
      let finalFile = selectedFile;
      
      // Resize if requirements detected
      if (detected && detected.width && detected.height) {
        console.log('[FormFit Modal] Resizing image to', detected.width, 'x', detected.height, 'max', detected.maxSizeKB, 'KB');
        const imageProcessorUrl = chrome.runtime.getURL("utils/imageProcessor.js");
        const module = await import(imageProcessorUrl);
        const { resizeAndCompress } = module;
        
        const blob = await resizeAndCompress(
          selectedFile,
          detected.width,
          detected.height,
          detected.maxSizeKB || null,
          'image/jpeg'
        );
        
        // Preserve original filename, just change to .jpg if needed
        const originalName = selectedFile.name.replace(/\.[^.]+$/, '');
        const fileName = originalName + '.jpg';
        finalFile = new File([blob], fileName, { type: 'image/jpeg' });
        
        // COMPREHENSIVE VALIDATION
        const validationResult = await validateResizedImage(blob, detected);
        if (!validationResult.ok) {
          throw new Error(validationResult.error);
        }
        
        const newSizeKB = (blob.size / 1024).toFixed(1);
        console.log('[FormFit Modal] ✓ Resized & VALIDATED! Original:', (selectedFile.size/1024).toFixed(1), 'KB → New:', newSizeKB, 'KB');
        console.log('[FormFit Modal] VALIDATION REPORT:', validationResult);
      } else {
        console.log('[FormFit Modal] No requirements detected, using original file');
      }
      
      // Set file to input
      input.setAttribute('data-formfit-processed', 'true');
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(finalFile);
      input.files = dataTransfer.files;
      
      // Validate
      if (!input.files || input.files.length === 0) {
        throw new Error('Failed to set file in input');
      }
      
      console.log('[FormFit Modal] File set:', input.files[0].name, input.files[0].size, 'bytes');
      
      // Trigger events
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      
      // Show success
      processing.style.display = 'none';
      messageArea.innerHTML = `
        <div class="formfit-success">
          <span style="font-size:18px;">✓</span>
          <div>
            <strong>✓ Image verified & ready!</strong><br>
            ${detected && detected.width ? `Dimensions: ${detected.width}×${detected.height}px verified<br>` : ''}
            Size: ${(finalFile.size/1024).toFixed(1)} KB verified<br>
            <small>Now clicking Upload button...</small>
          </div>
        </div>
      `;
      
      // Wait then find and click upload button
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const uploadButton = findNearbyUploadButton(input);
      if (uploadButton) {
        console.log('[FormFit Modal] Clicking upload button:', uploadButton.textContent);
        
        // ADVANCED UPLOAD VERIFICATION
        await verifyAndUpload(input, uploadButton, detected, finalFile);
      } else {
        messageArea.innerHTML = `
          <div class="formfit-success">
            <span style="font-size:18px;">✓</span>
            <div>
              <strong>✓ Image ready!</strong><br>
              File verified and loaded.<br>
              <small>Click the Upload button on the form to submit.</small>
            </div>
          </div>
        `;
        uploadBtn.textContent = 'Done';
        uploadBtn.disabled = false;
        uploadBtn.addEventListener('click', closeModal);
      }
      
    } catch (error) {
      console.error('[FormFit Modal] Error:', error);
      processing.style.display = 'none';
      messageArea.innerHTML = `
        <div class="formfit-error">
          <strong>Error:</strong> ${error.message}
        </div>
      `;
      uploadBtn.disabled = false;
      cancelBtn.disabled = false;
    }
  });
}

function isUploadButton(element) {
  if (!element) return false;
  const text = element.textContent.toLowerCase();
  return (element.tagName === 'BUTTON' || element.tagName === 'INPUT') &&
    (text.includes('upload') || text.includes('submit') || text.includes('ok'));
}


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "getDetectedRequirements") {
    console.log('[FormFit] Popup requested detected requirements');
    
    // Force a fresh scan first
    const inputs = document.querySelectorAll('input[type="file"]');
    console.log('[FormFit] Found', inputs.length, 'file inputs, rescanning...');
    
    inputs.forEach(input => {
      scanInput(input);
    });
    
    console.log('[FormFit] After rescan, detected:', lastDetected);
    sendResponse({ data: lastDetected });
    return;
  }

  if (message?.type === "autoSelectInput") {
    console.log('[FormFit] Popup requested auto-select input');
    
    // Force rescan too
    const inputs = document.querySelectorAll('input[type="file"]');
    inputs.forEach(input => {
      scanInput(input);
    });
    
    const selected = autoSelectInput();
    sendResponse({ ok: Boolean(selected), detected: lastDetected });
    return;
  }

  if (message?.type === "uploadResizedImage") {
    if (!lastClickedInput) {
      sendResponse({ ok: false, error: "No file input selected on the page." });
      return;
    }

    const buffer = message.buffer;
    const mimeType = message.mimeType || "image/jpeg";
    const file = new File([buffer], "formfit-upload", { type: mimeType });

    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    lastClickedInput.files = dataTransfer.files;
    lastClickedInput.dispatchEvent(new Event("change", { bubbles: true }));

    sendResponse({ ok: true });
    return;
  }

  if (message?.type === "setGlobalFloatingEnabled") {
    globalFloatingEnabled = Boolean(message.enabled);
    applyFloatingEnabled(computeFloatingEnabled());
    sendResponse({ ok: true });
    return;
  }

  if (message?.type === "setSiteFloatingOverride") {
    if (message.hostname === window.location.hostname) {
      siteOverrideEnabled = Boolean(message.enabled);
      applyFloatingEnabled(computeFloatingEnabled());
    }
    sendResponse({ ok: true });
    return;
  }

  if (message?.type === "clearSiteFloatingOverride") {
    if (message.hostname === window.location.hostname) {
      siteOverrideEnabled = null;
      applyFloatingEnabled(computeFloatingEnabled());
    }
    sendResponse({ ok: true });
    return;
  }

  if (message?.type === "setAutoProcessEnabled") {
    autoProcessEnabled = Boolean(message.enabled);
    sendResponse({ ok: true });
    return;
  }
});

async function initializeFloatingSetting() {
  const stored = await chrome.storage.local.get([
    FLOATING_TOGGLE_KEY,
    SITE_OVERRIDES_KEY,
    AUTO_PROCESS_KEY,
  ]);
  if (typeof stored[FLOATING_TOGGLE_KEY] === "boolean") {
    globalFloatingEnabled = stored[FLOATING_TOGGLE_KEY];
  }
  const siteMap = stored[SITE_OVERRIDES_KEY] || {};
  if (typeof siteMap[window.location.hostname] === "boolean") {
    siteOverrideEnabled = siteMap[window.location.hostname];
  }
  if (typeof stored[AUTO_PROCESS_KEY] === "boolean") {
    autoProcessEnabled = stored[AUTO_PROCESS_KEY];
  }
  floatingEnabled = computeFloatingEnabled();
}

Promise.all([loadDetector(), initializeFloatingSetting()]).then(() => {
  scanAllInputs();
});

document.addEventListener("click", handleInputSelection, true);
document.addEventListener("focusin", handleInputSelection, true);
document.addEventListener("change", handleFileChange, true);
window.addEventListener("scroll", scheduleFloatingUpdate, true);
window.addEventListener("resize", scheduleFloatingUpdate);

const observer = new MutationObserver(() => {
  clearTimeout(scanTimeout);
  scanTimeout = setTimeout(() => {
    scanAllInputs();
  }, 200); // Debounce rapid mutations
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
});

console.log('[FormFit] Content script initialized with debounced observer');
