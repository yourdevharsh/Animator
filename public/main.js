const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// --- UI Elements ---
const drawBtn = document.querySelector('.drawBtn');
const moveBtn = document.querySelector('.moveBtn');
const rotateBtn = document.querySelector('.rotateBtn');
const eraserBtn = document.querySelector('.eraserBtn');
const eraserSelect = document.getElementById('eraserSelect');
const undoBtn = document.querySelector('.undoBtn');
const redoBtn = document.querySelector('.redoBtn');
const colorPicker = document.getElementById('colorPicker');

const prevBtn = document.querySelector('.prevBtn');
const nextBtn = document.querySelector('.nextBtn');
const addFrameBtn = document.querySelector('.addFrameBtn');
const duplicateBtn = document.querySelector('.duplicateBtn');
const playBtn = document.querySelector('.playBtn');
const onionBtn = document.querySelector('.onionBtn');
const downloadBtn = document.querySelector('.downloadBtn');
const frameDisplay = document.querySelector('.frame-display');

// --- App State ---
let currentState = "draw"; 
let currentColor = "#000000";
let currentWidth = 3;

// Animation Data
let frames = [ [] ]; 
let currentFrameIndex = 0;
let isPlaying = false;
let playInterval = null;
let onionSkinEnabled = true;

let getStrokes = () => frames[currentFrameIndex];

let undoStack = [];
let redoStack = [];

// Interaction Variables
let drawing = false;
let isDragging = false;
let currentStrokePoints = [];
let selectedStroke = null; 
let offsetPoint = { x: 0, y: 0 };
let rotateCenter = { x: 0, y: 0 };
let initialAngle = 0;

// --- Download ---
downloadBtn.addEventListener('click', async () => {
    if (frames.length === 0) return;
    
    const originalIndex = currentFrameIndex;
    const originalText = downloadBtn.innerText;
    
    downloadBtn.innerText = "Processing...";
    downloadBtn.disabled = true;

    try {
        const base64Frames = [];
        for (let i = 0; i < frames.length; i++) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = "#FFFFFF";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            drawStrokes(frames[i]); 
            base64Frames.push(canvas.toDataURL('image/png'));
        }

        const response = await fetch('http://localhost:3000/render-video', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ frames: base64Frames, fps: 10 })
        });

        if (!response.ok) throw new Error("Server failed");

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = 'animation.mp4';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        
    } catch (err) {
        console.error(err);
        alert("Failed to generate video. Is the server running?");
    } finally {
        downloadBtn.innerText = originalText;
        downloadBtn.disabled = false;
        currentFrameIndex = originalIndex;
        redrawCanvas();
    }
});

// --- Frame ---
function updateFrameUI() {
    frameDisplay.textContent = `${currentFrameIndex + 1} / ${frames.length}`;
    prevBtn.disabled = currentFrameIndex === 0;
    nextBtn.disabled = currentFrameIndex === frames.length - 1;
    undoStack = [];
    redoStack = [];
    selectedStroke = null;
    redrawCanvas();
}

addFrameBtn.addEventListener('click', () => {
    frames.splice(currentFrameIndex + 1, 0, []);
    currentFrameIndex++;
    updateFrameUI();
});

duplicateBtn.addEventListener('click', () => {
    const currentStrokes = frames[currentFrameIndex];
    const copiedStrokes = JSON.parse(JSON.stringify(currentStrokes));
    frames.splice(currentFrameIndex + 1, 0, copiedStrokes);
    currentFrameIndex++;
    updateFrameUI();
});

prevBtn.addEventListener('click', () => {
    if (currentFrameIndex > 0) {
        currentFrameIndex--;
        updateFrameUI();
    }
});

nextBtn.addEventListener('click', () => {
    if (currentFrameIndex < frames.length - 1) {
        currentFrameIndex++;
        updateFrameUI();
    }
});

onionBtn.addEventListener('click', () => {
    onionSkinEnabled = !onionSkinEnabled;
    onionBtn.classList.toggle('toggle-on', onionSkinEnabled);
    onionBtn.textContent = onionSkinEnabled ? "Onion Skin: ON" : "Onion Skin: OFF";
    redrawCanvas();
});

playBtn.addEventListener('click', () => {
    if (isPlaying) stopAnimation();
    else startAnimation();
});

function startAnimation() {
    isPlaying = true;
    playBtn.textContent = "⏹ Stop";
    playBtn.classList.add('active');
    canvas.style.pointerEvents = "none";
    
    playInterval = setInterval(() => {
        currentFrameIndex++;
        if (currentFrameIndex >= frames.length) currentFrameIndex = 0; 
        frameDisplay.textContent = `${currentFrameIndex + 1} / ${frames.length}`;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        drawStrokes(frames[currentFrameIndex]);
    }, 100); 
}

function stopAnimation() {
    isPlaying = false;
    playBtn.textContent = "▶ Play";
    playBtn.classList.remove('active');
    clearInterval(playInterval);
    canvas.style.pointerEvents = "auto"; 
    updateFrameUI(); 
}

// --- Drawing ---

function redrawCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (onionSkinEnabled && currentFrameIndex > 0 && !isPlaying) {
        ctx.globalAlpha = 0.2;
        drawStrokes(frames[currentFrameIndex - 1]);
        ctx.globalAlpha = 1.0;
    }

    drawStrokes(frames[currentFrameIndex]);
}

function drawStrokes(strokeArray) {
    for (const stroke of strokeArray) {
        if (stroke.points.length < 2) continue;

        ctx.beginPath();
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (let i = 1; i < stroke.points.length; i++) {
            ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
        }
        
        if (stroke === selectedStroke && !isPlaying) {
            ctx.shadowColor = "rgba(0,0,0,0.3)";
            ctx.shadowBlur = 10;
            ctx.lineWidth = (stroke.width || 3) + 4; 
        } else {
            ctx.shadowBlur = 0;
            ctx.lineWidth = stroke.width || 3;
        }

        ctx.strokeStyle = stroke.color;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.stroke();
        ctx.shadowBlur = 0; 
    }
}

function drawLineSegment(points, color, width) {
    if (points.length < 2) return;
    ctx.beginPath();
    const p1 = points[points.length - 2];
    const p2 = points[points.length - 1];
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
}

// --- Tools and Mode ---

function setMode(mode) {
    currentState = mode;
    
    [drawBtn, moveBtn, rotateBtn, eraserBtn].forEach(btn => btn.classList.remove('active'));
    eraserSelect.style.display = 'none';

    if (mode === 'draw') {
        drawBtn.classList.add('active');
        canvas.style.cursor = 'crosshair';
        currentColor = colorPicker.value;
        currentWidth = 3;
    } 
    else if (mode === 'move') {
        moveBtn.classList.add('active');
        canvas.style.cursor = 'move';
    } 
    else if (mode === 'rotate') {
        rotateBtn.classList.add('active');
        canvas.style.cursor = 'alias';
    }
    else if (mode === 'eraser') {
        eraserBtn.classList.add('active');
        eraserSelect.style.display = 'inline-block';
        canvas.style.cursor = 'cell';
    }
    
    selectedStroke = null;
    redrawCanvas();
}

drawBtn.addEventListener('click', () => setMode('draw'));
moveBtn.addEventListener('click', () => setMode('move'));
rotateBtn.addEventListener('click', () => setMode('rotate'));
eraserBtn.addEventListener('click', () => setMode('eraser'));

colorPicker.addEventListener('input', (e) => {
    currentColor = e.target.value;
    if ((currentState === 'move' || currentState === 'rotate') && selectedStroke) {
        saveState();
        selectedStroke.color = currentColor;
        redrawCanvas();
    }
});

// --- Mouse Events ---
canvas.addEventListener('mousedown', (e) => {
    if (isPlaying) return; 

    const click = { x: e.offsetX, y: e.offsetY };
    const currentStrokes = getStrokes(); 

    // --- DRAW MODE ---
    if (currentState === "draw") {
        saveState();
        drawing = true;
        currentStrokePoints = [click];
        currentWidth = 3;
    } 
    
    // --- ERASER MODE ---
    else if (currentState === "eraser") {
        const type = eraserSelect.value;

        if (type === "stroke") {
            const foundIndex = getStrokeIndexAtPoint(click, currentStrokes);
            if (foundIndex !== -1) {
                saveState();
                currentStrokes.splice(foundIndex, 1);
                redrawCanvas();
            }
        } else {
            // Area Eraser
            saveState();
            drawing = true;
            currentStrokePoints = [click];
            currentColor = "#FFFFFF";
            currentWidth = 20;
        }
    }

    // --- MOVE and ROTATE MODE ---
    else if (currentState === "move" || currentState === "rotate") {
        const found = getStrokeAtPoint(click, currentStrokes);
        if (found) {
            saveState();
            selectedStroke = found;
            isDragging = true;
            
            colorPicker.value = selectedStroke.color;
            currentColor = selectedStroke.color;
            offsetPoint = click;

            if (currentState === "rotate") {
                rotateCenter = getStrokeCenter(selectedStroke.points);
                const dx = click.x - rotateCenter.x;
                const dy = click.y - rotateCenter.y;
                initialAngle = Math.atan2(dy, dx);
            }
            redrawCanvas();
        } else {
            selectedStroke = null;
            redrawCanvas();
        }
    }
});

canvas.addEventListener('mousemove', (e) => {
    if (isPlaying) return;

    const point = { x: e.offsetX, y: e.offsetY };

    if (drawing) {
        currentStrokePoints.push(point);
        drawLineSegment(currentStrokePoints, currentColor, currentWidth);
    } 
    
    else if (currentState === "move" && selectedStroke && isDragging) { 
        const dx = point.x - offsetPoint.x;
        const dy = point.y - offsetPoint.y;
        for (let p of selectedStroke.points) {
            p.x += dx;
            p.y += dy;
        }
        offsetPoint = point;
        redrawCanvas();
    } 
    
    else if (currentState === "rotate" && selectedStroke && isDragging) {
        const dx = point.x - rotateCenter.x;
        const dy = point.y - rotateCenter.y;
        const newAngle = Math.atan2(dy, dx);
        const deltaAngle = newAngle - initialAngle;
        rotateStrokePoints(selectedStroke.points, rotateCenter, deltaAngle);
        initialAngle = newAngle; 
        redrawCanvas();
    }
}); 

canvas.addEventListener('mouseup', () => {
    if (isPlaying) return;

    if (drawing) {
        const currentStrokes = getStrokes();
        currentStrokes.push({
            points: currentStrokePoints,
            color: currentColor,
            width: currentWidth
        });
        currentStrokePoints = [];
        drawing = false;
        
        if (currentState === "eraser") {
             currentColor = colorPicker.value; 
        }
        redrawCanvas();
    }
    isDragging = false;
});

// --- Utils ---
function getStrokeAtPoint(point, strokeList) {
    const index = getStrokeIndexAtPoint(point, strokeList);
    return index !== -1 ? strokeList[index] : null;
}

function getStrokeIndexAtPoint(point, strokeList) {
    for (let i = strokeList.length - 1; i >= 0; i--) {
        const stroke = strokeList[i];
        for (let p of stroke.points) {
            const dx = p.x - point.x;
            const dy = p.y - point.y;
            const hitRadius = (stroke.width || 3) + 5; 
            if (Math.sqrt(dx * dx + dy * dy) < hitRadius) return i;
        }
    }
    return -1;
}

function getStrokeCenter(points) {
    let sumX = 0, sumY = 0;
    for (let p of points) {
        sumX += p.x;
        sumY += p.y;
    }
    return { x: sumX / points.length, y: sumY / points.length };
}

function rotateStrokePoints(points, center, angle) {
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    for (let p of points) {
        const dx = p.x - center.x;
        const dy = p.y - center.y;
        p.x = center.x + dx * cosA - dy * sinA;
        p.y = center.y + dx * sinA + dy * cosA;
    }
}

// Undo Redo

function saveState() {
    const currentStrokes = getStrokes();
    undoStack.push(JSON.parse(JSON.stringify(currentStrokes)));
    redoStack = [];
}

undoBtn.addEventListener('click', () => {
    if (undoStack.length === 0) return;
    
    const currentStrokes = getStrokes();
    redoStack.push(JSON.parse(JSON.stringify(currentStrokes)));
    
    const prev = undoStack.pop();
    frames[currentFrameIndex] = prev;
    
    selectedStroke = null;
    redrawCanvas();
});

redoBtn.addEventListener('click', () => {
    if (redoStack.length === 0) return;
    
    const currentStrokes = getStrokes();
    undoStack.push(JSON.parse(JSON.stringify(currentStrokes)));
    
    const next = redoStack.pop();
    frames[currentFrameIndex] = next;
    
    selectedStroke = null;
    redrawCanvas();
});

document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undoBtn.click();
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Z')) {
        e.preventDefault();
        redoBtn.click();
    }
});

updateFrameUI();