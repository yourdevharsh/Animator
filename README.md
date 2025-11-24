# ✍️ Animator: Frame-by-Frame Canvas Animation Tool

Animator is a web-based, frame-by-frame animation application that allows users to draw, move, and rotate strokes across multiple frames. It features professional tools like onion skinning and leverages a Node.js server and FFmpeg to stitch the resulting frames into a final MP4 video.

## 🌟 Intro

This project provides a functional, intuitive interface for traditional 2D animation principles, all within a browser environment. It solves the key technical challenge of converting dynamic canvas drawing data into a standardized, shareable video format by offloading the intensive encoding process to a dedicated backend service.

## 🛠️ How It Works

The system operates in two distinct phases:

### Phase 1: Client-Side Drawing and Management (`index.html`, `main.js`)

1.  **Stroke Data:** All drawing is done using HTML Canvas. Strokes are saved as structured JavaScript objects containing an array of `{x, y}` points, color, and width.
2.  **Frames:** The animation sequence is stored as an array of stroke arrays (`frames = [ [stroke1, stroke2], [stroke3], ... ]`).
3.  **Onion Skinning:** The client can toggle an "Onion Skin" feature, which draws the previous frame's content at a low opacity, aiding in frame-to-frame movement consistency.
4.  **Transformation Tools:** Users can select, move, and rotate existing strokes on the current frame, providing a crucial feature often missing in simple canvas tools.

### Phase 2: Server-Side Video Rendering (`server.js`)

1.  **Export Trigger:** When the user clicks "Download," the client iterates through all frames, redraws each one (including a white background), and converts the canvas content into **Base64 encoded PNG data**.
2.  **API Call:** This array of Base64 strings is sent to the Node.js server's `/render-video` endpoint.
3.  **File Creation:** The server saves each Base64 string as a separate, sequentially numbered PNG file (`frame-001.png`, `frame-002.png`, etc.) in a temporary, job-specific directory.
4.  **FFmpeg Encoding:** The server uses the `fluent-ffmpeg` wrapper to execute **FFmpeg**, stitching the sequence of PNG images into a high-quality H.264 MP4 video.
5.  **Cleanup & Download:** The server streams the final MP4 file back to the client and then automatically cleans up the temporary directory containing the PNG frames.

## ✨ Features

* **Frame-Based Timeline:** Easy addition, duplication, and navigation of animation frames.
* **Essential Drawing Tools:** Draw, undo/redo, color picker, and two modes of eraser (stroke-delete and area-erase).
* **Object Manipulation:** Tools for moving and rotating existing strokes on the canvas.
* **Onion Skinning:** Visual reference to the previous frame to aid in smooth animation.
* **MP4 Video Export:** Seamless client-to-server pipeline for rendering and downloading the final animation video.

## 💻 Tech Stack

| Component | Technology | Role |
| :--- | :--- | :--- |
| **Frontend UI** | **HTML / CSS** | Layout, styling, and control buttons. |
| **Drawing Core** | **JavaScript / Canvas API** | Handles all drawing, manipulation logic, and state management of frames/strokes. |
| **Backend** | **Node.js / Express** | Server hosting, receiving frame data, and managing the FFmpeg pipeline. |
| **Video Encoding** | **FFmpeg (via `fluent-ffmpeg`)** | Command-line utility for stitching and encoding image sequences into MP4 video. |
| **Data Transfer** | **Base64 PNG Data** | Used to send the pixel content of each frame from the browser to the server. |

## 🚀 Getting Started

### Prerequisites

* Node.js (LTS recommended)
* FFmpeg (must be installed and accessible in the system's PATH for the server to work)

### Setup and Installation

1.  **Clone the repository:**
    ```bash
    git clone <your-repo-url>
    cd animator
    ```
2.  **Install Node.js dependencies:**
    ```bash
    npm install express body-parser cors fluent-ffmpeg
    ```
3.  **Ensure FFmpeg is installed:**
    * **Mac:** `brew install ffmpeg`
    * **Windows/Linux:** Refer to the official FFmpeg documentation.
4.  **Run the server:**
    ```bash
    node server.js
    ```

### Usage

1.  Open your browser to `http://localhost:3000`.
2.  Use the **Draw** tool to create a stroke.
3.  Click **+ New** or **⧉ Duplicate** to advance frames.
4.  Use the **Move** or **Rotate** tools to slightly adjust the strokes across frames.
5.  Click **▶ Play** to preview the animation.
6.  Click **⬇ Video** to send all frames to the server and download the resulting MP4 file.

## 📐 System Design and Architecture

### IPC (Client to Server)

The video export relies on a critical IPC pattern:

1.  **Serialization:** The client's canvas state (a temporary pixel buffer, not the stroke data) is serialized into a large Base64 string.
2.  **Transmission:** An array of these large strings is sent to the server via a `POST` request with an increased payload limit (`500mb`).
3.  **Deserialization:** The server reconstructs the image files from the Base64 data and saves them to disk.
4.  **Execution:** FFmpeg is executed as a separate external process, referencing the files saved to disk.

### Potential System Improvements

* **Stroke Serialization:** Currently, the client sends raw pixel data (Base64 PNGs) which is inefficient. A more robust system would save the structured stroke data (the array of points) to the server via a database, and perform all rendering (including complex anti-aliasing or special effects) on the server using a canvas-like library (like Node-Canvas).
* **Frame Deletion/Reordering:** Add UI functionality to delete specific frames and drag-and-drop frames to reorder the animation sequence.

## 📊 DSA Analysis and Potential Improvements

### Transformation Algorithms

* **Data Structure:** The core unit is the `Stroke` object, which contains a simple Array of `{x: number, y: number}` point objects.
* **Move Operation:** Simple vector addition (`p.x += dx`, `p.y += dy`). Complexity: $O(N)$, where $N$ is the number of points in the stroke.
* **Rotate Operation:** Uses the standard **2D Rotation Matrix** algorithm:
    $$
    x' = x \cos \theta - y \sin \theta \\
    y' = x \sin \theta + y \cos \theta
    $$
    Complexity: $O(N)$.
* **Hit Detection:** The `getStrokeIndexAtPoint` function iterates over every stroke and every point, checking distance against a small hit radius. This is a simple **Nearest Neighbor Search** approximation.
* **Potential Improvement:** For hit detection, instead of checking every point, sample a subset of points or implement a more efficient spatial partitioning structure (like a **Quadtree**) if the animation frames contained hundreds of independent strokes.

## 📈 Performance Metrics

The application performance is split between client responsiveness and server processing power.

| Metric | Description | Expected Value / Impact |
| :--- | :--- | :--- |
| **Client Drawing Latency** | Responsiveness during active drawing. | **Very Low (<10ms).** Drawing directly to Canvas is highly optimized. |
| **Video Generation Latency** | Time from pressing Download to receiving the MP4. | **High (5-30+ seconds).** Bottlenecked by the network transfer of large Base64 arrays and the CPU-intensive FFmpeg encoding process. |
| **File Size (Download)** | Size of the final MP4. | Determined by FFmpeg's encoding settings (`-crf 18` for quality). This is a trade-off against encoding speed. |
| **Memory Usage (Server)** | Server memory consumption during the process. | High. The server must hold all Base64 frame data in memory simultaneously before writing to disk, requiring a high `bodyParser` limit. |

## ⚖️ Trade-offs: Why Use That?

| Trade-off | Rationale for Current Choice |
| :--- | :--- |
| **Client-Side vs. Server-Side Encoding** | **Chosen:** Server-Side (FFmpeg). Client-side encoding (using WebAssembly or browser APIs) is often slow, unreliable, and limited to smaller files. FFmpeg provides a standardized, high-quality MP4 output necessary for professional use. |
| **Base64 Transfer vs. Binary Transfer** | **Chosen:** Base64 Transfer. While binary file transfer is more efficient, using Base64 embedded in a JSON `POST` request is vastly simpler to implement in JavaScript and Node.js without relying on complex multi-part form data processing. |
| **Undo/Redo Storage** | **Chosen:** Deep Copy of Strokes (`JSON.parse(JSON.stringify(strokes))`). This approach is simple and guarantees immutability for the history stack, preventing accidental corruption, even though it uses more memory than a true Command Pattern or Delta storage. |
| **Stroke Representation** | **Chosen:** Simple Array of Points. This is easy to draw and manipulate. Complex curve interpolation (like Bezier curves) was avoided to keep the core drawing and transformation logic straightforward. |

## 🔮 Future Updates

* **Multi-Layer Support:** Implement drawing layers, allowing strokes to be organized and edited independently, or locked in place.
* **Interpolation/Tweening:** Add an option for the application to automatically generate in-between frames (tweening) between two keyframes, accelerating the animation process.
* **Stroke Thickness/Size Tool:** Introduce a slider or control to dynamically change the `currentWidth` of the drawing tool.
* **Frame Timing:** Allow the user to set a custom duration or FPS for the final video output.
