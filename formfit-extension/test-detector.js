// Quick test for detector patterns
import { detectRequirements } from './utils/detector.js';

const testCases = [
  "Photograph size should be between 5kb to 20",
  "Photograph size should be between 5kb to 20kb",
  "between 5kb to 20 kb",
  "5kb to 20kb",
  "max 50KB",
  "200 x 200 pixels",
  "200x200",
  "width: 200, height: 200",
  "Size: 200 × 200 pixels. Maximum file size: 50 KB",
];

console.log('Testing detector patterns:\n');
testCases.forEach(text => {
  const result = detectRequirements(text);
  console.log(`Text: "${text}"`);
  console.log(`Result:`, result);
  console.log('---');
});
