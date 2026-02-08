// Priority 1: MOST SPECIFIC - Match exact "width X and height Y to Z" or "width X and height Y" patterns
const DIMENSION_PATTERNS_SPECIFIC = [
  // English: "width should be 160 pixels and height should be 200 to 212 pixels"
  /width\s+(?:should\s+be\s+)?(\d+)\s+(?:pixels?)?(?:and|,)\s+height\s+(?:should\s+be\s+)?(\d+)\s+to\s+(\d+)\s+pixels?/i,
  // English: "width should be 160 pixels and height should be 212 pixels"
  /width\s+(?:should\s+be\s+)?(\d+)\s+(?:pixels?)?(?:and|,)\s+height\s+(?:should\s+be\s+)?(\d+)\s+pixels?/i,
  // Any language: "160" ... "200 to 212" with pixel markers
  /(\d+)\s+(?:pixels?|पिक्सेल)[^\d]*?(\d+)\s+(?:to|and|-)\s+(\d+)\s+(?:pixels?|पिक्सेल)/i,
  // Height first (Marathi style): "200 to 212" ... "160"
  /(\d+)\s+to\s+(\d+)\s+(?:pixels?|पिक्सेल)[^\d]*?(\d+)\s+(?:pixels?|पिक्सेल)/i,
];

// Priority 2: Explicit width/height keywords (English)
const DIMENSION_PATTERNS_EXPLICIT = [
  /width[:\s]+(?:should\s+be\s+)?(\d+)\s*(?:px|pixel|pixels)?[,\s]+(?:and\s+)?height[:\s]+(?:should\s+be\s+)?(\d+)(?:\s+to\s+(\d+))?\s*(?:px|pixel|pixels)?/i,
  /height[:\s]+(?:should\s+be\s+)?(\d+)(?:\s+to\s+(\d+))?\s*(?:px|pixel|pixels)?[,\s]+(?:and\s+)?width[:\s]+(?:should\s+be\s+)?(\d+)\s*(?:px|pixel|pixels)?/i,
];

// Priority 3: Generic patterns (fallback)
const DIMENSION_PATTERNS_GENERIC = [
  /(\d+)\s*[xX×]\s*(\d+)\s*(px|pixel|pixels|पिक्सेल)?/i,
  /(\d+)\s*[*]\s*(\d+)\s*(px|pixel|pixels|पिक्सेल)?/i,
  /width[:\s]*(\d+)\s*(?:px)?[,\s]*height[:\s]*(\d+)\s*(?:px)?/i,
  /height[:\s]*(\d+)\s*(?:px)?[,\s]*width[:\s]*(\d+)\s*(?:px)?/i,
];

const SIZE_PATTERNS = [
  /between\s+(\d+)\s*kb\s+(?:to|and|-)\s+(\d+)\s*kb/i,
  /between\s+(\d+)\s*kb\s+(?:to|and|-)\s+(\d+)/i,
  /(\d+)\s*kb\s+(?:to|and|-)\s+(\d+)\s*kb/i,
  /(?:max(?:imum)?|less\s+than|below|under|up\s+to)[:\s]*(\d+)\s*kb/i,
  /(\d+)\s*kb\s*(?:max|maximum|or\s+less)/i,
  /(?:size|file)[:\s]*(\d+)\s*kb/i,
  /size.*?(\d+)\s*kb\s+(?:to|and|-)\s+(\d+)\s*kb/i,
];

export function detectRequirements(text) {
  console.log('[FormFit Detector] detectRequirements called with text (first 200 chars):', text.substring(0, 200));
  if (!text) {
    console.log('[FormFit Detector] Text is empty');
    return null;
  }

  let width = null;
  let height = null;
  let maxSizeKB = null;

  // Try most specific patterns first (exact requirements text format)
  console.log('[FormFit Detector] Trying SPECIFIC patterns...');
  for (let i = 0; i < DIMENSION_PATTERNS_SPECIFIC.length; i++) {
    const pattern = DIMENSION_PATTERNS_SPECIFIC[i];
    const match = text.match(pattern);
    if (match) {
      console.log(`[FormFit Detector] SPECIFIC pattern #${i} match:`, match);
      
      // Pattern 0 & 1: English "width...height" - groups: (width, height_min, height_max?)
      if (i <= 1) {
        const w = Number.parseInt(match[1], 10);
        const h1 = Number.parseInt(match[2], 10);
        const h2 = match[3] ? Number.parseInt(match[3], 10) : null;
        
        if (w > 0 && h1 > 0 && w <= 10000 && h1 <= 10000) {
          width = w;
          height = h2 || h1; // Use range max if available
          console.log('[FormFit Detector] ✓ SPECIFIC pattern found: width=', width, 'height=', height);
          break;
        }
      }
      
      // Pattern 2: "(\d+) px ... (\d+) to (\d+) px" - (single_num, range_min, range_max)
      else if (i === 2) {
        const num1 = Number.parseInt(match[1], 10);
        const num2 = Number.parseInt(match[2], 10);
        const num3 = Number.parseInt(match[3], 10);
        
        // Heuristic: the single number is likely width, the range is height
        if (num1 > 0 && num2 > 0 && num3 > 0) {
          width = num1;
          height = num3; // Use max of range
          console.log('[FormFit Detector] ✓ SPECIFIC pattern found (type2): width=', width, 'height=', height);
          break;
        }
      }
      
      // Pattern 3: "(\d+) to (\d+) px ... (\d+) px" - (height_min, height_max, single_num)
      else if (i === 3) {
        const num1 = Number.parseInt(match[1], 10);
        const num2 = Number.parseInt(match[2], 10);
        const num3 = Number.parseInt(match[3], 10);
        
        // Heuristic: the range is height, the single number is width
        if (num1 > 0 && num2 > 0 && num3 > 0) {
          width = num3;
          height = num2; // Use max of range
          console.log('[FormFit Detector] ✓ SPECIFIC pattern found (type3): width=', width, 'height=', height);
          break;
        }
      }
    }
  }

  // Try explicit width/height patterns if specific didn't work
  if (!width || !height) {
    console.log('[FormFit Detector] Trying EXPLICIT patterns...');
    for (const pattern of DIMENSION_PATTERNS_EXPLICIT) {
      const match = text.match(pattern);
      if (match) {
        console.log('[FormFit Detector] EXPLICIT pattern match:', match);
        const num1 = Number.parseInt(match[1], 10);
        const num2 = Number.parseInt(match[2], 10);
        let finalNum2 = num2;
        
        if (match[3] && !isNaN(Number.parseInt(match[3], 10))) {
          const rangeNum = Number.parseInt(match[3], 10);
          if (rangeNum > num2) {
            finalNum2 = rangeNum;
            console.log('[FormFit Detector] Found range, using max:', finalNum2);
          }
        }
        
        if (num1 > 0 && finalNum2 > 0 && num1 <= 10000 && finalNum2 <= 10000) {
          if (pattern.source.indexOf('width') < pattern.source.indexOf('height')) {
            width = num1;
            height = finalNum2;
          } else {
            height = num1;
            width = finalNum2;
          }
          console.log('[FormFit Detector] ✓ EXPLICIT pattern found: width=', width, 'height=', height);
          break;
        }
      }
    }
  }

  // Try generic patterns only as last resort
  if (!width || !height) {
    console.log('[FormFit Detector] Trying generic patterns (fallback)...');
    for (const pattern of DIMENSION_PATTERNS_GENERIC) {
      const match = text.match(pattern);
      if (match) {
        const num1 = Number.parseInt(match[1], 10);
        const num2 = Number.parseInt(match[2], 10);
        if (num1 > 0 && num2 > 0 && num1 <= 10000 && num2 <= 10000) {
          width = num1;
          height = num2;
          console.log('[FormFit Detector] Generic pattern found (fallback): width=', width, 'height=', height);
          break;
        }
      }
    }
  }

  for (const pattern of SIZE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      console.log('[FormFit Detector] Size match found:', match);
      let size = Number.parseInt(match[1], 10);
      
      // If pattern captures two numbers (range), use the second (max)
      if (match[2]) {
        const size2 = Number.parseInt(match[2], 10);
        if (!isNaN(size2) && size2 > 0) {
          size = Math.max(size, size2);
          console.log('[FormFit Detector] Found size range, using max:', size, 'KB');
        }
      }
      
      if (size > 0 && size <= 10240) {
        maxSizeKB = size;
        console.log('[FormFit Detector] Max size set to:', maxSizeKB, 'KB');
        break;
      }
    }
  }

  if (!width && !height && !maxSizeKB) {
    return null;
  }

  const result = {
    width,
    height,
    maxSizeKB,
  };
  console.log('[FormFit Detector] Final result:', result);
  return result;
}
