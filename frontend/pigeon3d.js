/**
 * 3D Pigeon GLTF Loader
 * Loads and displays animated pigeon.gltf model using Three.js
 */

let pigeonScene, pigeonCamera, pigeonRenderer, pigeonModel, pigeonMixer, pigeonClock;

/**
 * Initialize 3D Pigeon scene
 */
function initPigeon3D() {
    const container = document.getElementById('pigeon3DContainer');
    if (!container) {
        console.warn('Pigeon container not found');
        return;
    }

    // Scene setup
    pigeonScene = new THREE.Scene();
    pigeonScene.background = null; // Transparent background

    // Camera setup
    const width = container.clientWidth || 400;
    const height = container.clientHeight || 400;
    pigeonCamera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    pigeonCamera.position.set(0, 0, 5);

    // Renderer setup
    pigeonRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    pigeonRenderer.setSize(width, height);
    pigeonRenderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(pigeonRenderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    pigeonScene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    pigeonScene.add(directionalLight);

    // Clock for animations
    pigeonClock = new THREE.Clock();

    // Load GLTF model
    loadPigeonModel();

    // Handle window resize
    window.addEventListener('resize', onPigeonResize);
}

/**
 * Load pigeon.gltf model
 */
async function loadPigeonModel() {
    // Check if Three.js is available
    if (typeof THREE === 'undefined') {
        console.error('Three.js not loaded');
        showPigeonPlaceholder();
        return;
    }

    // Use GLTFLoader from THREE namespace
    if (!THREE.GLTFLoader) {
        console.error('GLTFLoader not available');
        showPigeonPlaceholder();
        return;
    }

    const loader = new THREE.GLTFLoader();
    const modelPath = 'pigeon.gltf'; // Path to your GLTF file

    loader.load(
        modelPath,
        (gltf) => {
            pigeonModel = gltf.scene;
            
            // Scale and position the model
            pigeonModel.scale.set(1, 1, 1);
            pigeonModel.position.set(0, 0, 0);
            
            pigeonScene.add(pigeonModel);

            // Setup animations if available
            if (gltf.animations && gltf.animations.length > 0) {
                pigeonMixer = new THREE.AnimationMixer(pigeonModel);
                
                gltf.animations.forEach((clip) => {
                    pigeonMixer.clipAction(clip).play();
                });
            }

            // Start animation loop
            animatePigeon();
        },
        (progress) => {
            // Loading progress
            console.log('Loading pigeon model:', (progress.loaded / progress.total * 100) + '%');
        },
        (error) => {
            console.error('Error loading pigeon model:', error);
            // Fallback: Show a placeholder or message
            showPigeonPlaceholder();
        }
    );
}

/**
 * Show placeholder if model fails to load
 */
function showPigeonPlaceholder() {
    const container = document.getElementById('pigeon3DContainer');
    if (container) {
        container.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">🕊️</div>';
    }
}

/**
 * Animation loop
 */
function animatePigeon() {
    requestAnimationFrame(animatePigeon);

    if (pigeonMixer) {
        const delta = pigeonClock.getDelta();
        pigeonMixer.update(delta);
    }

    // Rotate model slowly
    if (pigeonModel) {
        pigeonModel.rotation.y += 0.005;
    }

    if (pigeonRenderer && pigeonScene && pigeonCamera) {
        pigeonRenderer.render(pigeonScene, pigeonCamera);
    }
}

/**
 * Handle window resize
 */
function onPigeonResize() {
    const container = document.getElementById('pigeon3DContainer');
    if (!container || !pigeonCamera || !pigeonRenderer) return;

    const width = container.clientWidth || 400;
    const height = container.clientHeight || 400;

    pigeonCamera.aspect = width / height;
    pigeonCamera.updateProjectionMatrix();
    pigeonRenderer.setSize(width, height);
}

// Check if Three.js is available before initializing
function checkThreeJSAndInit() {
    if (typeof THREE === 'undefined') {
        console.warn('Three.js not loaded for pigeon. Loading from CDN...');
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js';
        script.onload = () => {
            initPigeon3D();
        };
        script.onerror = () => {
            console.error('Failed to load Three.js');
            showPigeonPlaceholder();
        };
        document.head.appendChild(script);
    } else {
        initPigeon3D();
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkThreeJSAndInit);
} else {
    checkThreeJSAndInit();
}

