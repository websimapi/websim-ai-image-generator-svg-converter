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
    
  } catch (error) {
    console.error('Error generating image:', error);
    alert('Error generating image. Please try again.');
    loadingElement.classList.add('hidden');
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
    
    // Convert to black and white for tracing
    const bwData = convertToBlackAndWhite(imageData);
    
    // Generate SVG paths
    const svgContent = generateSvgPaths(bwData, canvas.width, canvas.height);
    generatedSvg = svgContent;
    
    // Display SVG
    svgContainer.innerHTML = svgContent;
    
  } catch (error) {
    console.error('Error converting to SVG:', error);
    svgContainer.innerHTML = '<p>Error converting to SVG. Please try again.</p>';
  }
}

function convertToBlackAndWhite(imageData) {
  const { data, width, height } = imageData;
  const bwData = new Uint8Array(width * height);
  
  // Simple thresholding to convert to black and white
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      // Calculate grayscale value using RGB values
      const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      // Apply threshold to make it black or white
      bwData[y * width + x] = gray < 128 ? 1 : 0;
    }
  }
  
  return { data: bwData, width, height };
}

function findPaths(bwData) {
  const { data, width, height } = bwData;
  const visited = new Array(width * height).fill(false);
  const paths = [];
  
  // Directions for traversal: right, down-right, down, down-left, left, up-left, up, up-right
  const dx = [1, 1, 0, -1, -1, -1, 0, 1];
  const dy = [0, 1, 1, 1, 0, -1, -1, -1];
  
  // Find paths in the image
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      
      // Skip if already visited or not a black pixel
      if (visited[idx] || data[idx] === 0) {
        continue;
      }
      
      // Start a new path
      const path = [];
      const stack = [{x, y}];
      visited[idx] = true;
      
      // Add starting point
      path.push(new Point(x, y));
      
      while (stack.length > 0) {
        const current = stack.pop();
        
        // Try all 8 directions
        for (let i = 0; i < 8; i++) {
          const nx = current.x + dx[i];
          const ny = current.y + dy[i];
          
          // Check if in bounds
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const nidx = ny * width + nx;
            
            // If pixel is black and not visited
            if (data[nidx] === 1 && !visited[nidx]) {
              visited[nidx] = true;
              stack.push({x: nx, y: ny});
              path.push(new Point(nx, ny));
              break; // Move in this direction
            }
          }
        }
      }
      
      if (path.length > 5) { // Only keep paths with enough points
        paths.push({
          points: path,
          isHole: false
        });
      }
    }
  }
  
  return paths;
}

function generateSvgPaths(bwData, width, height) {
  // Find all paths in the image
  const paths = findPaths(bwData);
  
  // Process paths to get smooth curves
  for (const path of paths) {
    // Process the path with potrace algorithm
    processPath([path], { 
      turdsize: 2,
      turnpolicy: 4,
      alphamax: 1,
      opticurve: true,
      opttolerance: 0.2
    });
  }
  
  // Generate SVG content
  let svgContent = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;
  
  // Add paths to SVG
  for (const path of paths) {
    if (path.curve) {
      const svgPath = curvesToSvgPath(path.curve);
      svgContent += `<path d="${svgPath}" fill="black" />`;
    }
  }
  
  svgContent += '</svg>';
  return svgContent;
}

function curvesToSvgPath(curve) {
  let path = '';
  const n = curve.n;
  
  // Start path
  path += `M${curve.c[curve.n * 3 - 1].x.toFixed(3)},${curve.c[curve.n * 3 - 1].y.toFixed(3)} `;
  
  // Add curves
  for (let i = 0; i < n; i++) {
    if (curve.tag[i] === 'CURVE') {
      path += `C${curve.c[i * 3 + 0].x.toFixed(3)},${curve.c[i * 3 + 0].y.toFixed(3)} `;
      path += `${curve.c[i * 3 + 1].x.toFixed(3)},${curve.c[i * 3 + 1].y.toFixed(3)} `;
      path += `${curve.c[i * 3 + 2].x.toFixed(3)},${curve.c[i * 3 + 2].y.toFixed(3)} `;
    } else {
      path += `L${curve.c[i * 3 + 1].x.toFixed(3)},${curve.c[i * 3 + 1].y.toFixed(3)} `;
      path += `L${curve.c[i * 3 + 2].x.toFixed(3)},${curve.c[i * 3 + 2].y.toFixed(3)} `;
    }
  }
  
  path += 'Z';
  return path;
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

