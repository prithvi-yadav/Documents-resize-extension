# 🎯 FormFit Extension - COMPLETE SETUP & TEST GUIDE

## ✅ STEP 1: LOAD EXTENSION

1. Open Chrome
2. Go to `chrome://extensions/`
3. Enable **Developer mode** (top right toggle)
4. Click **"Load unpacked"**
5. Select folder: `C:\Users\Lenovo\Downloads\AND\extension\formfit-extension`
6. Extension should load with blue icon

## ✅ STEP 2: VERIFY EXTENSION LOADED

Check for these:
- ✅ Extension appears in `chrome://extensions/`
- ✅ No errors shown
- ✅ Status shows "Errors: 0"

## ✅ STEP 3: OPEN TEST PAGE

1. Open file: `C:\Users\Lenovo\Downloads\AND\extension\TEST-COMPLETE.html`
2. Press **F12** to open DevTools Console
3. Look for these console messages:
   ```
   ✅ Test page loaded
   👀 Looking for FormFit extension...
   ✅ FormFit extension detected! Found 3 FormFit buttons
   ```

## ✅ STEP 4: TEST THE EXTENSION

### Look for Blue Buttons:
- You should see **blue "FormFit" buttons** floating next to each file input
- If you DON'T see them, check DevTools Console for errors

### Click FormFit Button:
1. Click any blue "FormFit" button
2. A **beautiful modal dialog** should open
3. Modal shows:
   - ✅ Detected requirements (width, height, file size)
   - ✅ Drag & drop area
   - ✅ "Resize & Upload" button

### Upload Process:
1. Click the file drop area (or drag image)
2. Select ANY image (doesn't matter what size)
3. See preview of your image
4. Click "🚀 Resize & Upload"
5. Image gets:
   - ✅ Resized to correct dimensions
   - ✅ Compressed to correct file size
   - ✅ Converted to JPEG
   - ✅ Set in the form
   - ✅ **Upload button clicked automatically**
6. Modal closes, upload completes

## 🔍 TROUBLESHOOTING

### No FormFit buttons visible?
**Check:**
1. Is extension enabled? Check `chrome://extensions/`
2. Open Console (F12) - any errors?
3. Hard reload page: `Ctrl+Shift+R`

### Modal not opening?
**Check Console for:**
```
[FormFit] Opening FormFit modal
```

### Detection not working?
**Console should show:**
```
[FormFit Detector] Size match found: ...
[FormFit Detector] Dimension match: ...
[FormFit Detector] Final result: {width: 160, height: 212, maxSizeKB: 20}
```

### Upload button not clicked?
**Check Console:**
```
[FormFit Modal] Searching for upload button...
[FormFit Modal] Clicking upload button: Upload
```

## 🎯 EXPECTED BEHAVIOR ON REAL GOVERNMENT WEBSITE

1. Go to: `pcs.mahaonline.gov.in` (or your government form)
2. Wait 2 seconds for extension to load
3. You'll see **blue "FormFit" buttons** next to photo upload inputs
4. Click FormFit button → Modal opens
5. **Modal shows detected requirements** (160x212px, 5-20KB)
6. Select your photo
7. Click "Resize & Upload"
8. **Done!** Photo uploaded automatically

## 📋 CONSOLE LOG CHECKLIST

When everything works, you should see:
```
[FormFit] Content script initialized with debounced observer
[FormFit] Detector loaded successfully
[FormFit] Scanning 3 file inputs
[FormFit Detector] detectRequirements called with text...
[FormFit Detector] Size match found: ["between 5kb to 20 kb", "5", "20"]
[FormFit Detector] Dimension match: ["width should be 160 pixels and height should be 200 to 212 pixels", "160", "200", "212"]
[FormFit Detector] Final result: {width: 160, height: 212, maxSizeKB: 20}
[FormFit] Created floating button for input
```

When you click FormFit:
```
[FormFit] Opening FormFit modal
```

When you click Resize & Upload:
```
[FormFit Modal] Resizing image...
[FormFit Modal] Resized: 19.2 KB
[FormFit Modal] File set: photo.jpg 19640 bytes
[FormFit Modal] Searching for upload button...
[FormFit Modal] Clicking upload button: Upload
```

## ❌ COMMON ERRORS & FIXES

### Error: "Cannot find module"
**Fix:** Reload extension in `chrome://extensions/`

### Error: "showFormFitModal is not defined"
**Fix:** content.js not loaded properly - reload extension

### No blue buttons:
**Fix:** 
1. Check if extension is enabled
2. Reload page with `Ctrl+Shift+R`
3. Check Console for errors

### Modal CSS not loading:
**Fix:** Check `manifest.json` has `"css": ["modal.css"]`

## ✨ FILES CHECKLIST

Your extension folder should have:
```
formfit-extension/
├── manifest.json         ✅ Extension config
├── content.js           ✅ Main logic (910 lines)
├── modal.css            ✅ Modal styles
├── popup.html           ✅ Extension popup
├── popup.js             ✅ Popup logic
├── style.css            ✅ Popup styles
├── background.js        ✅ Background worker
├── icons/               ✅ Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── utils/               ✅ Helper modules
    ├── detector.js      ✅ Requirement detection
    └── imageProcessor.js ✅ Image resize
```

## 🚀 QUICK START

```
1. Load extension: chrome://extensions/ → Load unpacked
2. Open: TEST-COMPLETE.html
3. Click blue "FormFit" button
4. Select image → Click "Resize & Upload"
5. ✅ DONE!
```

---

**If it's STILL not working, screenshot your Console errors and show me!**
