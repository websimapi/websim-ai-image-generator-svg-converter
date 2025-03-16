import processPath from 'https://cdn.jsdelivr.net/npm/potrace-js@0.0.6/src/processPath.js';
import Point from 'https://cdn.jsdelivr.net/npm/potrace-js@0.0.6/src/Point.js';
import Curve from 'https://cdn.jsdelivr.net/npm/potrace-js@0.0.6/src/Curve.js';

// DOM Elements
const promptInput = document.getElementById('prompt-input');
const aspectRatioSelect = document.getElementById('aspect-ratio');
const generateBtn = document.getElementById('generate-btn');
const loadingElement = document.getElementById('loading');
const resultContainer = document.getElementById('result-container');
const originalImageContainer = document.getElementById('original-image-container');
const svgContainer = document.getElementById('svg-container');
const downloadBtn = document.getElementById('download-btn');
const tabButtons = document.querySelectorAll('.tab-btn');

// Variables to store generated content
let generatedImageUrl = '';
let generatedSvg = '';

// Event Listeners
generateBtn.addEventListener('click', handleGenerate);
downloadBtn.addEventListener('click', handleDownload);

tabButtons.forEach(button => {
  button.addEventListener('click', () => {
    // Remove active class from all tabs
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
    
    // Add active class to clicked tab
    button.classList.add('active');
    const tabId = button.getAttribute('data-tab');
    document.getElementById(`${tabId}-tab`).classList.add('active');
  });
});

// Main Functions
async function handleGenerate() {
  const prompt = promptInput.value.trim();
  if (!prompt) {
    alert('Please enter an image prompt');
    return;
  }
  
  // Show loading
  loadingElement.classList.remove('hidden');
  resultContainer.classList.add('hidden');
  generateBtn.disabled = true;
  downloadBtn.disabled = true;
  
  try {
    // Generate AI image
    const imageResult = await generateAIImage(prompt, aspectRatioSelect.value);
    generatedImageUrl = imageResult.url;
    
    // Display original image
    displayOriginalImage(generatedImageUrl);
    
    // Convert to SVG and display
    await convertToSvg(generatedImageUrl);
    
    // Hide loading, show results
    loadingElement.classList.add('hidden');
    resultContainer.classList.remove('hidden');
    downloadBtn.disabled = false;
    generateBtn.disabled = false;
    
  } catch (error) {
    console.error('Error generating image:', error);
    alert('Error generating image. Please try again.');
    loadingElement.classList.add('hidden');
    generateBtn.disabled = false;
  }
}

async function generateAIImage(prompt, aspectRatio) {
  // Use the LLM image generation API
  return await websim.imageGen({
    prompt: prompt,
    aspect_ratio: aspectRatio
  });
}

function displayOriginalImage(imageUrl) {
  originalImageContainer.innerHTML = '';
  const img = document.createElement('img');
  img.src = imageUrl;
  img.alt = 'Generated image';
  originalImageContainer.appendChild(img);
}

async function convertToSvg(imageUrl) {
  try {
    // Create a canvas to process the image
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Load the image
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = imageUrl;
    });
    
    // Set canvas dimensions
    canvas.width = img.width;
    canvas.height = img.height;
    
    // Draw image to canvas
    ctx.drawImage(img, 0, 0);
    
    // Get pixel data
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // Create a simplified SVG
    const svgContent = createSimplifiedSvg(imageData, canvas.width, canvas.height);
    generatedSvg = svgContent;
    
    // Display SVG
    svgContainer.innerHTML = svgContent;
    
  } catch (error) {
    console.error('Error converting to SVG:', error);
    svgContainer.innerHTML = '<p>Error converting to SVG. Please try again.</p>';
    // Ensure we're not stuck in loading state
    loadingElement.classList.add('hidden');
    resultContainer.classList.remove('hidden');
    generateBtn.disabled = false;
  }
}

function createSimplifiedSvg(imageData, width, height) {
  // Create a simpler SVG version using edge detection
  const { data } = imageData;
  const threshold = 128;
  const svgPaths = [];
  const pixelSize = Math.max(1, Math.floor(width / 100)); // Reduce resolution for performance
  
  // Sample pixels and create simple rectangles for edges
  for (let y = 0; y < height; y += pixelSize) {
    for (let x = 0; x < width; x += pixelSize) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      
      // Calculate grayscale value
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      
      // If the pixel is dark enough, add a rectangle to represent it
      if (gray < threshold) {
        svgPaths.push(`<rect x="${x}" y="${y}" width="${pixelSize}" height="${pixelSize}" fill="black" />`);
      }
    }
  }
  
  // Limit the number of paths to prevent browser freezing
  const maxPaths = 5000;
  const pathsToUse = svgPaths.length > maxPaths 
    ? svgPaths.slice(0, maxPaths) 
    : svgPaths;
  
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    ${pathsToUse.join('\n')}
  </svg>`;
}

function handleDownload() {
  // Create a Blob containing the SVG data
  const blob = new Blob([generatedSvg], { type: 'image/svg+xml' });
  
  // Create a temporary URL for the Blob
  const url = URL.createObjectURL(blob);
  
  // Create a temporary link element and trigger download
  const link = document.createElement('a');
  link.href = url;
  link.download = 'generated-image.svg';
  document.body.appendChild(link);
  link.click();
  
  // Clean up
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}