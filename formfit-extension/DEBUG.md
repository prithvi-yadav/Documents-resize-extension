# 🔧 DEBUGGING GUIDE - FormFit Extension

## Your Issue: Fields Are Empty

Based on your screenshot, the extension popup shows empty fields even though the modal clearly shows requirements.

## ✅ IMMEDIATE FIX - Follow These Steps:

### Step 1: Reload the Extension
1. Go to `chrome://extensions`
2. Find **FormFit**
3. Click the **Reload** button (circular arrow icon)
4. ✅ Confirm you see "Errors" is empty

### Step 2: Test on the Simulator Page
1. Open `test-modal.html` from the extension folder
2. Press **F12** to open DevTools → **Console** tab
3. Click the **"Upload Photo"** button on the page
4. **KEEP CONSOLE OPEN** - you should see:
   ```
   [FormFit] Content script initialized and observing DOM
   [FormFit] New file input detected in added node, rescanning...
   [FormFit] Detected requirements: {width: 160, height: 212, maxSizeKB: 20} from text: ...
   ```
5. Click the **FormFit extension icon** (blue button in toolbar)
6. **Check the popup:** Width should show `160`, Height `212`, Max size `20`

### Step 3: Test on Your Actual Website
1. **IMPORTANT:** First refresh the page you're testing
2. Open **DevTools Console** (F12)
3. Click on the file input in the modal
4. Look for console messages starting with `[FormFit]`
5. Click the **FormFit extension icon**
6. Check if fields are auto-filled

## 🐛 What Console Messages Mean:

### ✅ Good Messages (Working):
```
[FormFit] Content script initialized and observing DOM
[FormFit] Detector loaded successfully
[FormFit] Detected requirements: {width: 160, height: 212, maxSizeKB: 20}
[FormFit] Auto-selected input: <input>
[FormFit Popup] Filling fields with: {width: 160, height: 212, maxSizeKB: 20}
```

### ❌ Bad Messages (Not Working):
```
[FormFit] No requirements detected from text: ...
[FormFit] No file inputs found on page
[FormFit Popup] No data to fill
```

## 📋 Common Issues & Solutions:

### Issue 1: "No file inputs found"
- **Cause:** Modal opened AFTER extension loaded
- **Fix:** The extension now auto-rescans when modals appear
- **Test:** Close and reopen the modal, then click extension icon

### Issue 2: "No requirements detected from text"
- **Cause:** Text format not matching patterns
- **Fix:** Check console - it shows what text was scanned
- **Action:** Copy that text and report it

### Issue 3: Console shows empty/no messages
- **Cause:** Content script not loading
- **Fix 1:** Reload extension
- **Fix 2:** Refresh the webpage
- **Fix 3:** Check extension permissions

### Issue 4: Fields empty in popup
- **Cause:** Timing issue - popup opened before scan completed
- **Fix:** Close and reopen the popup after clicking the input

## 🔍 Debug Commands (Run in Console):

```javascript
// Check if extension is loaded
console.log('Extension loaded');

// Force a rescan
chrome.runtime.sendMessage({type: 'rescan'});

// Check what text is being scanned
const input = document.querySelector('input[type="file"]');
if (input) {
  console.log('Input found:', input);
  console.log('Parent text:', input.parentElement?.innerText);
  console.log('Modal text:', input.closest('[role="dialog"], .modal')?.innerText);
}
```

## 📝 What Changed in Latest Update:

1. **Better Pattern Detection:**
   - Now detects: "width should be 160 pixels and height should be 200 to 212 pixels"
   - Now detects: "between 5kb to 20 kb"
   - Takes maximum from ranges (212 pixels, 20kb)

2. **Modal Support:**
   - Automatically rescans when modals/dialogs appear
   - Checks modal containers for text

3. **Debug Logging:**
   - Every step now logs to console
   - Easy to see what's detected

## 🎯 Expected Behavior:

1. **Page loads** → Extension scans all file inputs
2. **Modal opens** → Extension detects new input, rescans
3. **You click input** → Extension highlights it, scans nearby text
4. **You open popup** → Extension auto-fills detected values
5. **You select file** → Extension auto-processes it (if enabled)

## 📸 Quick Test Checklist:

- [ ] Extension reloaded in chrome://extensions
- [ ] DevTools console is open (F12)
- [ ] Page refreshed
- [ ] Clicked on file input in modal
- [ ] See `[FormFit] Detected requirements` in console
- [ ] Opened extension popup
- [ ] See width/height/size filled automatically

## ❓ Still Not Working?

**Share these details:**
1. Screenshot of DevTools console
2. Screenshot of extension popup
3. Text from the webpage (copy the requirements text)
4. What browser messages you see

The console logs will tell us exactly where it's failing!
