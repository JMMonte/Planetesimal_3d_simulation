import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as dat from 'dat.gui';
import Simulation from './sim.js';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import * as CANNON from 'cannon';

// Setup ------------------------------------
const canvas = document.querySelector('canvas.webgl');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);
const gui = new dat.GUI();
const stats = new Stats();

// Sizes ------------------------------------
const sizes = { width: window.innerWidth, height: window.innerHeight };

// Camera -----------------------------------
const camera = new THREE.PerspectiveCamera(
    75,
    sizes.width / sizes.height,
    0.1,
    10000
);
camera.position.x = 200;
camera.position.y = 200;
camera.position.z = 200;
scene.add(camera);

// Renderer ---------------------------------
const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
    alpha: true
});
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;

// Controls ---------------------------------
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = false;

// Lights -----------------------------------
const directionalLights = [
    { color: 0xffffff, intensity: 10.5, position: new THREE.Vector3(1, 1, 1) },
    { color: 0xffffff, intensity: 0.5, position: new THREE.Vector3(-1, -1, -1) },
];

directionalLights.forEach((light, index) => {
    const dirLight = new THREE.DirectionalLight(light.color, light.intensity);
    dirLight.position.copy(light.position);
    scene.add(dirLight);

    // Shadow
    dirLight.castShadow = true;

    // Shadow map resolution
    dirLight.shadow.mapSize.width = 2048; // Increase if your shadow is not detailed enough
    dirLight.shadow.mapSize.height = 2048; // Increase if your shadow is not detailed enough

    // Adjust the frustum of the shadow camera
    const size = 500; // The size should be based on your scene's scale
    dirLight.shadow.camera.left = -size;
    dirLight.shadow.camera.right = size;
    dirLight.shadow.camera.top = size;
    dirLight.shadow.camera.bottom = -size;
    dirLight.shadow.camera.near = -500; // Adjust based on your scene
    dirLight.shadow.camera.far = 500; // Adjust based on your scene


    // GUI for lights
    const lightFolder = gui.addFolder(`Directional Light ${index + 1}`);
    lightFolder.add(dirLight.position, 'x', -5, 5, 0.01).name('X Position');
    lightFolder.add(dirLight.position, 'y', -5, 5, 0.01).name('Y Position');
    lightFolder.add(dirLight.position, 'z', -5, 5, 0.01).name('Z Position');
    lightFolder.add(dirLight, 'intensity', 0, 100, 0.01).name('Intensity');
    lightFolder.add(dirLight, 'castShadow').name('Cast Shadow');

    scene.add(dirLight);

    // const helper = new THREE.CameraHelper(dirLight.shadow.camera);
    // scene.add(helper);
});

// Export and Import Buttons -------------------------------
gui.add({exportCrystals: () => exportCrystals(simulation.bodies, simulation.meshes)}, 'exportCrystals').name('Export Crystals');
gui.add({importCrystals: () => document.getElementById('fileInput').click()}, 'importCrystals').name('Import Crystals');


// Simulation --------------------------------
const gravityConstant = 6.67430;
const sphereCount = 850;
const worldsize = 450;
const velocityX = 20;
const velocityY = 20;
const velocityZ = 20;
const simulation = new Simulation(gravityConstant * 10e-6, sphereCount, worldsize, velocityX, velocityY, velocityZ, scene);
scene.add(simulation.getMeshes());

// GUI for simulation properties
const simulationProperties = {
    totalSpheres: sphereCount,
    gravityConstant: gravityConstant,
    worldsize: worldsize,
    velocityX: velocityX,
    velocityY: velocityY,
    velocityZ: velocityZ,
    throwForce: 100,
    amountOfCrystals: 1,
    radiusOfThrow: 5,
    start: () => toggleSimulation(true),
    stop: () => toggleSimulation(false),
    // Function to update the throw force, called when the GUI slider is changed
    updateThrowForce: (value) => {
        simulationProperties.throwForce = value;
    }
};

// add helper grid
const gridHelper = new THREE.GridHelper(1000, 100);
scene.add(gridHelper);

// GUI checkbox to show/hide gridHelper
const gridHelperCheckbox = gui.add({ showGridHelper: true }, 'showGridHelper').name('Show Grid Helper');
gridHelperCheckbox.onChange((value) => {
    gridHelper.visible = value;
});

let colormapping = false;
// GUI checkbox to show/hide color mapping
const colorMappingCheckbox = gui.add({ showColorMapping: false }, 'showColorMapping').name('See gravity');
colorMappingCheckbox.onChange((value) => {
    colormapping = value;
});

// Add GUI controls --------------------------------
addSimulationGUI(gui, simulation, simulationProperties);

// Event Listeners -------------------------------
window.addEventListener('resize', onWindowResize);

// Set up the Effect Composer --------------------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

// Create SSAO pass --------------------------------
const ssaoPass = new SSAOPass(scene, camera, sizes.width, sizes.height);
ssaoPass.kernelRadius = 16;
ssaoPass.minDistance = 0.005;
ssaoPass.maxDistance = 0.1;
composer.addPass(ssaoPass);

// add bloom pass
const bloomPass = new UnrealBloomPass(new THREE.Vector2(sizes.width, sizes.height), 1.5, 0.4, 0.85);
bloomPass.threshold = 0.1;
bloomPass.strength = 0.2;
bloomPass.radius = 1.5;
composer.addPass(bloomPass);




// Animation Loop -------------------------------
const animate = () => {
    stats.begin();
    if (simulationProperties.running) simulation.update(1 / 60, colormapping);
    renderer.render(scene, camera);
    stats.end();
    composer.render();
    requestAnimationFrame(animate);
};

// Helper Functions -----------------------------
function addSimulationGUI(gui, simulation, props) {
    gui.add(props, 'totalSpheres', 1, 10000, 1).name('Total Spheres').onChange(value => {
        simulation.sphereCount = value;
        simulation.restart();
        props.running = false;
        scene.add(simulation.getMeshes());
    });

    gui.add(props, 'gravityConstant', 0, 60000, 0.01).name('Gravity Constant').onChange(value => {
        simulation.gravityConstant = value * 10e-6;
        scene.add(simulation.getMeshes());
    });

    gui.add(props, 'worldsize', 0, 10000, 1).name('World Size').onChange(value => {
        simulation.worldSize = value;
        simulation.restart();
        props.running = false;
        scene.add(simulation.getMeshes());
    });

    gui.add(props, 'velocityX', 0, 100, 1).name('Velocity X').onChange(value => {
        simulation.velocityX = value;
        simulation.restart();
        props.running = false;
        scene.add(simulation.getMeshes());
    });

    gui.add(props, 'velocityY', 0, 100, 1).name('Velocity Y').onChange(value => {
        simulation.velocityY = value;
        simulation.restart();
        props.running = false;
        scene.add(simulation.getMeshes());
    });

    gui.add(props, 'velocityZ', 0, 100, 1).name('Velocity Z').onChange(value => {
        simulation.velocityZ = value;
        simulation.restart();
        props.running = false;
        scene.add(simulation.getMeshes());
    });

    gui.add(props, 'throwForce', 0, 200, 1).name('Throw Force').onChange(props.updateThrowForce);
    gui.add(props, 'amountOfCrystals', 1, 100, 1).name('Amount of Crystals');
    gui.add(props, 'radiusOfThrow', 1, 50, 0.1).name('Radius of Throw');

    gui.add(props, 'start').name('Start Simulation');
    gui.add(props, 'stop').name('Stop Simulation');
}

function onWindowResize() {
    // Update sizes
    sizes.width = window.innerWidth;
    sizes.height = window.innerHeight;

    // Update camera
    camera.aspect = sizes.width / sizes.height;
    camera.updateProjectionMatrix();

    // Update renderer
    renderer.setSize(sizes.width, sizes.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}

function toggleSimulation(running) {
    simulationProperties.running = running;
    if (running && simulation.sphereCount > 0) simulation.restart();
    if (!running) simulation.restart();
}
let isDragging = false;
let mouseDown = false;

// Export Crystals ------------------------------
function exportCrystals(bodies, meshes) {
    const crystalData = bodies.map((body, index) => {
        const mesh = meshes[index];
        return {
            mass: body.mass,
            position: { x: body.position.x, y: body.position.y, z: body.position.z },
            velocity: { x: body.velocity.x, y: body.velocity.y, z: body.velocity.z },
            orientation: { x: body.quaternion.x, y: body.quaternion.y, z: body.quaternion.z, w: body.quaternion.w },
            geometry: mesh.geometry.toJSON() // Serializing Three.js mesh geometry
        };
    });

    const json = JSON.stringify(crystalData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    // Create a link and trigger a download
    const a = document.createElement('a');
    a.href = url;
    a.download = 'crystals.json';
    a.click();

    // Cleanup
    URL.revokeObjectURL(url);
}

document.getElementById('fileInput').addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const data = JSON.parse(e.target.result);
            importCrystals(data, simulation); // Assuming this is where the error occurs
        };
        reader.readAsText(file);
    }
});


function importCrystals(data, simulationInstance) {
    // Clear the current scene before importing new data
    simulationInstance.clearScene();

    data.forEach(item => {
        if (!item.geometry) {
            console.error('Invalid or missing geometry data', item);
            return; // Skip this item
        }
        // Add the mesh to the simulation
        simulationInstance.addMesh(item); // Assuming item contains the entire mesh data

        // Recreate the physics body and add it to the simulation
        // Assumes addBody method accepts parameters for mass, position, velocity, and orientation
        simulationInstance.addBody(item.mass, item.position, item.velocity, item.orientation);
    });

    // Additional steps for scene update, if necessary
}

// Throw Crystals on Mouse Click ------------------

// Listen for mouse down event
canvas.addEventListener('mousedown', function () {
    // When the mouse is pressed down, we assume it might be a click
    mouseDown = true;
    isDragging = false; // Reset the dragging flag
}, false);

// Listen for mouse move event
canvas.addEventListener('mousemove', function (event) {
    if (mouseDown) {
        // If the mouse is down and moving, consider it dragging
        isDragging = true;
    }
}, false);

// Listen for mouse up event
canvas.addEventListener('mouseup', function (event) {
    mouseDown = false; // Reset mouse down flag
    if (!isDragging) {
        // If the mouse is released and dragging is false, throw a crystal
        onCanvasClick(event);
    }
    isDragging = false; // Reset the dragging flag
}, false);

// Existing onCanvasClick function remains the same
function onCanvasClick(event) {
    // Calculate mouse position in normalized device coordinates (-1 to +1) for both components
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    throwCrystal(x, y);
}

function throwCrystal(x, y) {
    // Create a raycaster with the camera and the mouse position
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), camera);

    // Get the direction from raycaster
    const direction = raycaster.ray.direction.normalize(); // Normalize the direction

    // Convert the direction to CANNON.Vec3
    const cannonDirection = new CANNON.Vec3(direction.x, direction.y, direction.z);

    // Calculate the base velocity from the direction and throw force
    let baseVelocity = cannonDirection.scale(simulationProperties.throwForce);

    if (simulationProperties.amountOfCrystals > 1) {
        for (let i = 0; i < simulationProperties.amountOfCrystals; i++) {
            // Randomize position within the specified radius
            const angle = Math.random() * Math.PI * 2;
            const u = Math.random() + Math.random();
            const r = u > 1 ? 2 - u : u;
            const offset = new CANNON.Vec3(
                simulationProperties.radiusOfThrow * r * Math.cos(angle),
                simulationProperties.radiusOfThrow * r * Math.sin(angle),
                (Math.random() - 0.5) * 2 * simulationProperties.radiusOfThrow
            );

            // Adjust the starting position to be spread within the radius of throw
            const startPosition = new CANNON.Vec3().copy(camera.position).vadd(offset);

            // Create a random orientation for the crystal
            const orientation = new CANNON.Vec3(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI
            );

            // Define the size and shape of the crystal
            const baseRadius = 3 * (0.5 + Math.random());
            const height = 3 * (1 + Math.random() * 2); // Height is 1 to 3 times the base radius
            const radialSegments = Math.floor(3 + Math.random() * 5); // Randomly choose between 3 and 7 sides
            const density = 2100; // example density for crystals

            // Adjust velocity for each crystal to vary the throw pattern in the direction of the throw
            const velocityVariance = new CANNON.Vec3(
                (Math.random() - 0.5) * 2 * baseVelocity.x,
                (Math.random() - 0.5) * 2 * baseVelocity.y,
                (Math.random() - 0.5) * 2 * baseVelocity.z
            );
            const velocity = baseVelocity.vadd(velocityVariance);

            // Call the addCrystal method with the calculated parameters
            simulation.addCrystal(baseRadius, height, radialSegments, startPosition, orientation, density, velocity);
        }
    } else {
        // For a single crystal, use the camera position and direction without randomization
        const startPosition = new CANNON.Vec3().copy(camera.position);
        const orientation = new CANNON.Vec3(0, 0, 0); // No rotation
        const baseRadius = 3 * (0.5 + Math.random());
        const height = 3 * (1 + Math.random() * 2); // Height is 1 to 3 times the base radius
        const radialSegments = Math.floor(3 + Math.random() * 5); // Randomly choose between 3 and 7 sides
        const density = 2100; // example density for crystals

        // Call the addCrystal method with the calculated parameters
        simulation.addCrystal(baseRadius, height, radialSegments, startPosition, orientation, density, baseVelocity);
    }
}

// Initialize
document.body.appendChild(stats.dom);
animate();
