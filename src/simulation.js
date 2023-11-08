import * as THREE from 'three';
import Ammo from 'ammo.js';

export default class Simulation {
    constructor(scene, volumes, totalSpheres, G, simulationSpeed) {
        this.scene = scene;
        this.volumes = volumes;
        this.totalSpheres = totalSpheres;
        this.simulationSpeed = simulationSpeed; // Adjust this value to speed up or slow down the simulation
        this.spheres = []; // Initialize spheres
        this.velocities = []; // Store the velocities for each sphere
        this.trails = []; // Store the trails for each sphere
        this.G = G; // Gravitational constant, tuned for visible effect
        this.density = this.totalSpheres / this.totalVolume;
        this.totalVolume = this.calculateTotalVolume();
    }
    destroySpheres() {
        this.spheres.forEach(sphere => {
            this.scene.remove(sphere);
        });
        this.spheres = [];
        this.velocities = [];
        this.trails = [];
    }

    calculateTotalVolume() {
        let totalVolume = 0;
        this.volumes.forEach(volume => {
            totalVolume += (4 / 3) * Math.PI * Math.pow(volume.radius, 3);
        });
        return totalVolume;
    }

    // Function to generate a random color within the brown-gray-gold spectrum
    getRandomColor() {
        // Exponential distribution function
        function expRandom(scale) {
            return -Math.log(1 - Math.random()) * scale;
        }

        // Define hue range for gray, brown, and gold
        // Grays will have hue close to 0 or 360, browns around 30, golds around 50-60
        var grayHue = expRandom(0.5) * (Math.random() > 0.9 ? 1 : -1);
        var brownHue = 45 + expRandom(0.00001) * (Math.random() > 0.95 ? 1 : -1);
        var goldHue = 55 + expRandom(0.00001) * (Math.random() > 0.99 ? 1 : -1);
        var hue = Math.random() > 0.5 ? (Math.random() > 0.55 ? goldHue : brownHue) : grayHue;

        // Saturation: mostly low, rarely very high
        var saturation = expRandom(0.3);
        saturation = Math.random() > 0.9 ? 1 - saturation : saturation; // Rarely very high

        // Value: mostly dark, rarely very bright
        var value = expRandom(0.7);
        value = Math.random() > 0.9 ? 1 - value : value; // Rarely very bright

        // Convert HSV to RGB using Three.js's built-in function
        var color = new THREE.Color();
        color.setHSL((hue + 360) % 360 / 360, saturation, value); // Ensure hue is between 0 and 1

        return color;
    }

    updateColors() {
        const maxSpeed = this.getMaxSpeed(); // Fixed to use this context

        this.spheres.forEach((sphere, i) => {
            const speed = this.velocities[i].length();
            const color = this.getSpeedColor(speed, maxSpeed);

            sphere.material.color.set(color);
            this.trails[i].line.material.color.set(color);
        });
    }

    getMaxSpeed() {
        return this.velocities.reduce((max, velocity) => Math.max(max, velocity.length()), 0);
    }

    getSpeedColor(speed, maxSpeed) {
        const hue = (1 - (speed / maxSpeed)) * 240;
        return new THREE.Color(`hsl(${hue}, 100%, 50%)`);
    }


    init() {
        this.totalVolume = this.calculateTotalVolume(); // Moved up before density calculation
        this.density = this.totalSpheres / this.totalVolume; // Moved down after totalVolume is calculated
    
        this.volumes.forEach(volume => {
            let volumeSpheres = Math.round(this.density * (4 / 3) * Math.PI * Math.pow(volume.radius, 3));
            for (let i = 0; i < volumeSpheres; i++) {
                this.createSphere(volume);
            }
        });
    }

    // Function to create a single sphere at a random position
    createSphere(volume) {
        const mass = Math.random() * 100 + 100;
        const density = 2000; // kg/m^3
        const radius = Math.cbrt((3 * mass) / (4 * Math.PI * density));

        const geometry = new THREE.SphereGeometry(radius, 4, 4);
        const material = new THREE.MeshPhongMaterial({ color: this.getRandomColor() });
        const sphere = new THREE.Mesh(geometry, material);

        sphere.mass = mass;
        sphere.castShadow = false;
        sphere.receiveShadow = false;

        // Set a random position for the sphere inside the spherical volume
        var phi = Math.acos(2 * Math.random() - 1); // random angle for latitude
        var theta = Math.random() * Math.PI * 2; // random angle for longitude
        var r = volume.radius * Math.cbrt(Math.random()); // random radius within the volume

        sphere.position.x = volume.center.x + r * Math.sin(phi) * Math.cos(theta);
        sphere.position.y = volume.center.y + r * Math.sin(phi) * Math.sin(theta);
        sphere.position.z = volume.center.z + r * Math.cos(phi);

        // Add the sphere to the scene
        this.scene.add(sphere);
        this.spheres.push(sphere);

        // Assign a random initial velocity, then add the collective velocity of the volume
        var initialVelocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.2, // Random velocity in x
            (Math.random() - 0.5) * 0.2, // Random velocity in y
            (Math.random() - 0.5) * 0.2  // Random velocity in z
        ).add(volume.collectiveVelocity); // Add the collective velocity

        this.velocities.push(initialVelocity);

        // Create the trail for the sphere
        var trailGeometry = new THREE.BufferGeometry();
        var trailPositions = new Float32Array(this.trailLength * 3); // 3 vertices per point, using this.trailLength
        trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
        trailGeometry.setDrawRange(0, 0); // Initially draw nothing

        var trailMaterial = new THREE.LineBasicMaterial({ color: sphere.material.color });
        var trail = new THREE.Line(trailGeometry, trailMaterial);
        this.scene.add(trail); // Assuming scene is a property of Simulation class
        this.trails.push({ line: trail, currentPoint: 0 });
    }


    update(event = { delta: 16.666 }) {  // Assuming 60 FPS as default
        const delta = event.delta * 0.001 * this.simulationSpeed;

        this.updatePhysics(delta);
        this.updateColors();
    }


    // Function to update physics
    updatePhysics(delta) {
        for (var i = 0; i < this.spheres.length; i++) {
            var sphereA = this.spheres[i];
            for (var j = i + 1; j < this.spheres.length; j++) {
                var sphereB = this.spheres[j];
                var distanceVector = sphereB.position.clone().sub(sphereA.position);
                var distance = distanceVector.length();

                // Collision detection
                var radiusSum = sphereA.geometry.parameters.radius + sphereB.geometry.parameters.radius;
                if (distance < radiusSum) {
                    // Simple collision response with impact absorption
                    var restitution = 0.2; // 50% bounce
                    this.handleCollision(sphereA, sphereB, restitution, i, j);
                    continue;
                }

                if (distance < 0.2) continue; // Prevent division by zero and overlapping spheres

                var forceMagnitude = this.G * (sphereA.mass * sphereB.mass) / (distance * distance);
                var forceDirection = distanceVector.normalize();
                var accelerationA = forceDirection.clone().multiplyScalar(forceMagnitude / sphereA.mass);
                var accelerationB = forceDirection.clone().multiplyScalar(-forceMagnitude / sphereB.mass);

                this.velocities[i].add(accelerationA.multiplyScalar(delta));
                this.velocities[j].add(accelerationB.multiplyScalar(delta));
            }
        }

        // Update positions based on velocities
        for (var i = 0; i < this.spheres.length; i++) {
            this.spheres[i].position.add(this.velocities[i].clone().multiplyScalar(delta));
        }
    }

    // Function to handle collisions with impact absorption
    handleCollision(sphereA, sphereB, restitution, indexA, indexB) {
        // Calculate the normal of the collision
        var collisionNormal = sphereB.position.clone().sub(sphereA.position).normalize();

        // Calculate the relative velocity in terms of the normal direction
        var relativeVelocity = this.velocities[indexB].clone().sub(this.velocities[indexA]);
        var velocityAlongNormal = relativeVelocity.dot(collisionNormal);

        // Do not resolve the collision if the velocities are separating
        if (velocityAlongNormal > 0) return;

        // Calculate the impulse scalar
        var impulseScalar = -(1 + restitution) * velocityAlongNormal;
        impulseScalar /= (1 / sphereA.mass) + (1 / sphereB.mass);

        var impulse = collisionNormal.multiplyScalar(impulseScalar);
        var impulseA = impulse.clone().divideScalar(sphereA.mass);
        var impulseB = impulse.clone().divideScalar(sphereB.mass);
        
        // Apply impulse to each object
        this.velocities[indexA].sub(impulseA);
        this.velocities[indexB].add(impulseB);
    }
}
