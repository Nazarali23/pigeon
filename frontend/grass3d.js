/**
 * 3D Grass Renderer
 * Creates realistic 3D grass above the chat screen using Three.js
 */

let grassScene, grassCamera, grassRenderer, grassContainer;
const grassBlades = [];

const shouldAutoInitGrass = typeof THREE !== 'undefined';

if (!shouldAutoInitGrass) {
    console.warn('Three.js not loaded for grass. Loading from CDN...');
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js';
    script.onload = () => {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initGrass3D);
        } else {
            initGrass3D();
        }
    };
    document.head.appendChild(script);
}

/**
 * Initialize 3D Grass scene
 */
function initGrass3D() {
    const container = document.getElementById('grass3DContainer');
    if (!container) {
        console.warn('Grass container not found');
        return;
    }

    grassContainer = container;

    // Scene setup
    grassScene = new THREE.Scene();
    grassScene.background = null; // Transparent background

    // Camera setup
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || 100;
    grassCamera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    grassCamera.position.set(0, 2, 5);
    grassCamera.lookAt(0, 0, 0);

    // Renderer setup
    grassRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    grassRenderer.setSize(width, height);
    grassRenderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(grassRenderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x7CB342, 0.6);
    grassScene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0x8BC34A, 0.8);
    directionalLight.position.set(5, 10, 5);
    grassScene.add(directionalLight);

    // Create grass
    createGrass();

    // Start animation loop
    animateGrass();

    // Handle window resize
    window.addEventListener('resize', onGrassResize);
}

/**
 * Create 3D grass blades
 */
function createGrass() {
    const grassCount = 200;
    const grassGeometry = new THREE.PlaneGeometry(0.05, 0.3);
    
    // Create grass texture/material
    const grassMaterial = new THREE.MeshLambertMaterial({
        color: 0x7CB342,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9
    });

    // Create multiple grass blades
    for (let i = 0; i < grassCount; i++) {
        const grassBlade = new THREE.Mesh(grassGeometry, grassMaterial.clone());
        
        // Random position
        const x = (Math.random() - 0.5) * 20;
        const z = (Math.random() - 0.5) * 2;
        const y = 0;
        
        grassBlade.position.set(x, y, z);
        
        // Random rotation
        grassBlade.rotation.y = Math.random() * Math.PI * 2;
        grassBlade.rotation.z = (Math.random() - 0.5) * 0.2;
        
        // Random scale
        const scale = 0.8 + Math.random() * 0.4;
        grassBlade.scale.set(scale, scale, scale);
        
        // Store original position and rotation for animation
        grassBlade.userData = {
            originalY: y,
            originalRotationZ: grassBlade.rotation.z,
            swaySpeed: 0.5 + Math.random() * 0.5,
            swayAmount: 0.1 + Math.random() * 0.1
        };
        
        grassScene.add(grassBlade);
        grassBlades.push(grassBlade);
    }

    // Add ground plane
    const groundGeometry = new THREE.PlaneGeometry(20, 2);
    const groundMaterial = new THREE.MeshLambertMaterial({
        color: 0x558B2F,
        side: THREE.DoubleSide
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.15;
    grassScene.add(ground);
}

/**
 * Animate grass (swaying effect)
 */
function animateGrass() {
    requestAnimationFrame(animateGrass);

    const time = Date.now() * 0.001;

    grassBlades.forEach((blade) => {
        const { originalRotationZ, swaySpeed, swayAmount } = blade.userData;
        blade.rotation.z = originalRotationZ + Math.sin(time * swaySpeed) * swayAmount;
        blade.rotation.y += 0.001; // Slight rotation
    });

    if (grassRenderer && grassScene && grassCamera) {
        grassRenderer.render(grassScene, grassCamera);
    }
}

/**
 * Handle window resize
 */
function onGrassResize() {
    if (!grassContainer || !grassCamera || !grassRenderer) return;

    const width = grassContainer.clientWidth || window.innerWidth;
    const height = grassContainer.clientHeight || 100;

    grassCamera.aspect = width / height;
    grassCamera.updateProjectionMatrix();
    grassRenderer.setSize(width, height);
}

if (shouldAutoInitGrass) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initGrass3D);
    } else {
        initGrass3D();
    }
}

