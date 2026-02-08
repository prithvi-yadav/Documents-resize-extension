# FormFit - Smart Image Resizer & Form Upload Assistant

A Chrome Extension that automatically detects image requirements on web forms and resizes/compresses images accordingly.

## Features

### ✨ Core Features
- **Auto-detection**: Automatically detects image dimension and size requirements from webpage text
- **Auto-processing**: Automatically resizes and compresses images when you select a file (can be toggled)
- **Smart Upload**: One-click resize and upload with detected requirements
- **Manual Control**: Override detected settings manually if needed
- **Floating Buttons**: Quick-access buttons appear next to file inputs
- **Per-Site Settings**: Enable/disable floating buttons globally or per-site

### 🎯 Detection Capabilities
The extension detects various requirement patterns:
- Dimensions: `200x200`, `200 × 200`, `200*200`, `width: 200, height: 200`
- File size: `max 50KB`, `less than 100kb`, `maximum size: 50 KB`, `under 80kb`
- Multiple formats and variations

### 🔧 Settings
- **Auto-process uploads**: When enabled, automatically resizes images when you select them
- **Floating buttons**: Show/hide FormFit buttons next to file inputs
- **Per-site control**: Override global settings for specific websites
- **Import/Export**: Backup and restore your site preferences

## Installation

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked**
4. Select the `formfit-extension` folder
5. The extension is now installed!

## Testing

1. Open `test.html` in Chrome (File > Open File)
2. The extension will automatically:
   - Scan each file input
   - Detect requirements from nearby text
   - Show FormFit buttons next to inputs
   - Display detected size in tooltips

### Testing Auto-Processing
1. Click the extension icon to open the popup
2. Ensure "Auto-process uploads" is enabled (on by default)
3. Click any file input on the test page
4. Select an image from your computer
5. **The extension will automatically resize it!**
6. Check the console to see the file size has changed

### Testing Manual Upload
1. Click the extension icon
2. You'll see auto-filled dimensions (if detected)
3. Select an image
4. Click "Smart Resize & Upload" or "Resize & Upload to Page"

### Testing Floating Buttons
1. Hover over the blue "FormFit" button next to file inputs
2. Tooltip shows detected requirements (e.g., "FormFit: 200x200px, max 50KB")
3. Click the button to select a file
4. The file will be auto-processed if auto-process is enabled

## How It Works

### 1. Detection Phase
- Content script scans the page for `<input type="file">` elements
- Reads nearby text (labels, parent elements, form text)
- Uses regex patterns to detect dimensions and file size limits
- Stores detected requirements per input

### 2. Auto-Processing (when enabled)
- User clicks a file input and selects an image
- Extension checks if requirements were detected
- If yes, automatically:
  - Resizes image to detected dimensions
  - Compresses to meet size limit
  - Replaces the selected file
  - Shows visual confirmation (✓ on button)

### 3. Manual Processing
- User opens popup
- Sees auto-filled requirements (or enters manually)
- Selects image and output format
- Clicks download or upload button
- Extension processes and delivers the result

## File Structure

```
formfit-extension/
├── manifest.json           # Extension configuration
├── popup.html             # Popup UI
├── popup.js               # Popup logic
├── style.css              # Popup styles
├── content.js             # Page interaction script
├── background.js          # Background service worker
├── utils/
│   ├── imageProcessor.js  # Image resize/compress logic
│   └── detector.js        # Requirement detection patterns
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── test.html             # Test page

```

## Usage Tips

### For Government Forms
- Open the form page
- Click on the file input
- The extension auto-detects requirements
- Select your photo
- It's automatically resized!

### For Job Applications
- Navigate to the application form
- Requirements are detected from labels
- Upload resumes, photos, signatures with one click

### For Custom Requirements
- If auto-detection doesn't work, use the popup
- Manually enter dimensions and size limits
- Process and upload

## Troubleshooting

### Extension doesn't detect requirements
- Check if requirements are in visible text near the file input
- Try opening the popup and entering manually
- Some websites hide requirements - check their help text

### Image quality is too low
- Increase the max size limit in the popup
- JPEG compression reduces quality; try PNG for better quality

### Floating buttons don't appear
- Check if "Floating buttons" is enabled in popup
- Check per-site settings
- Refresh the page after enabling

### Auto-process isn't working
- Enable "Auto-process uploads" in the popup
- Make sure requirements were detected (check tooltip)
- Try manual upload if auto-process fails

## Privacy & Security

- **All processing happens locally** - no data is sent to external servers
- **No tracking** - extension doesn't collect any user data
- **Minimal permissions** - only requests necessary Chrome APIs
- **Open source** - code is fully inspectable

## Advanced Features

### Site Management
- Export your site settings as JSON
- Import settings on another device
- Clear all site overrides with one click

### Smart Detection
- Handles multiple dimension formats
- Detects file size in various phrasings
- Validates detected values (reasonable ranges)

## Future Enhancements (Not Yet Implemented)

These features are prepared in the architecture but not yet coded:
- Auto-crop for passport photos
- Background removal
- AI face detection and centering
- Preset templates (Passport, Signature, etc.)
- Batch processing

## Support

For issues or suggestions:
1. Check the troubleshooting section
2. Review the test page for examples
3. Inspect console for error messages

## License

This extension is provided as-is for educational and personal use.
