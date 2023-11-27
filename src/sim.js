import * as CANNON from 'cannon';
import * as THREE from 'three';
import Octree from './octree.js';

class Simulation {
    constructor(gravityConstant, sphereCount, worldSize, velocityX, velocityY, velocityZ, scene) {
        this.scene = scene;
        this.gravityConstant = gravityConstant;
        this.worldSize = worldSize;
        this.sphereGroup = new THREE.Group();
        this.radius = 3;
        this.meshes = [];
        this.bodies = [];

        // Velocity for the initial state of the simulation
        this.velocityX = velocityX;
        this.velocityY = velocityY;
        this.velocityZ = velocityZ;

        // Configure the Cannon.js world
        this.world = new CANNON.World();
        this.world.gravity.set(0, 0, 0); // Gravity is handled manually, so set to zero in cannon.js

        // Set up the world with a broadphase algorithm suitable for large number of objects
        this.world.broadphase = new CANNON.SAPBroadphase(this.world);

        // Set the world's default contact material properties
        const defaultMaterial = new CANNON.Material('default');
        const defaultContactMaterial = new CANNON.ContactMaterial(defaultMaterial, defaultMaterial, {
            friction: 0.5,
            restitution: 0.9, // Lower restitution reduces bounciness
        });
        this.world.addContactMaterial(defaultContactMaterial);
        this.world.defaultContactMaterial = defaultContactMaterial;

        // Apply damping to reduce the energy over time
        this.world.defaultContactMaterial.contactEquationStiffness = 1e9;
        this.world.defaultContactMaterial.contactEquationRelaxation = 10;

        // Configure solver iterations for better accuracy
        this.world.solver.iterations = 2; // Number of iterations to apply at each simulation step
        this.world.solver.tolerance = 0.01; // Force solver to use more iterations to satisfy tolerance
        this.addCrystals(sphereCount, 2000); // 5000 kg/m^3 could be a sample density for a crystal
        this.octree = new Octree(this.worldSize, this.gravityConstant);

        // sleep
        this.world.allowSleep = true;
        this.world.bodies.forEach(body => {
            body.sleepSpeedLimit = 0.1; // Or another appropriate value
            body.sleepTimeLimit = 1; // Or another appropriate value
        });
    }

    clearScene() {
        // Remove all Cannon.js bodies
        while (this.world.bodies.length > 0) {
            this.world.removeBody(this.world.bodies[0]);
        }
        this.bodies = [];

        // Remove all Three.js objects
        while (this.scene.children.length > 0) {
            const object = this.scene.children[0];
            if (object.isMesh) {
                object.geometry.dispose(); // Dispose geometry
                if (object.material.isMaterial) {
                    object.material.dispose(); // Dispose material
                }
                this.scene.remove(object); // Remove from scene
            }
        }
        this.meshes = [];
    }

    restart() {
        // Remove all meshes from the Three.js scene
        this.meshes.forEach(mesh => {
            this.sphereGroup.remove(mesh);
            mesh.geometry.dispose(); // Dispose of the geometry
            mesh.material.dispose(); // Dispose of the material
        });
        this.meshes = []; // Clear the meshes array
    
        // Remove all bodies from the Cannon.js world
        this.bodies.forEach(body => this.world.remove(body));
        this.bodies = []; // Clear the bodies array
    
        // Ensure sphereCount is correctly defined
        this.sphereCount = this.sphereCount || 1500; // Set default if not defined
    
        // Re-add crystals to the simulation
        this.addCrystals(this.sphereCount, 2000); // Assuming 2000 is the desired density
    
        // Reset the octree
        this.octree.clear();
        this.bodies.forEach(body => {
            this.octree.insert({
                mass: body.mass,
                position: body.position
            });
        });
        // Important: Update the scene with the new meshes
        this.meshes.forEach(mesh => this.sphereGroup.add(mesh));
    }
    
// ----------------- Crystal -----------------

    addCrystal(baseRadius, height, radialSegments, position, orientation, density, velocity = this.generateRandomVelocity()) {
        // Create a geometry that starts as a cylinder
        const crystalGeometry = new THREE.CylinderGeometry(
            baseRadius, // top radius
            baseRadius, // bottom radius
            height, // height of the crystal
            radialSegments // number of radial segments
        );
    
        // Elongate the crystal by scaling it along the Y-axis
        crystalGeometry.scale(1, Math.random() + 0.5, 1); // Random elongation factor between 0.5 and 1.5
    
        // Apply the random orientation to the geometry
        const eulerRotation = new THREE.Euler(orientation.x, orientation.y, orientation.z);
        crystalGeometry.rotateX(eulerRotation.x);
        crystalGeometry.rotateY(eulerRotation.y);
        crystalGeometry.rotateZ(eulerRotation.z);
    
        // Material and mesh creation
        const crystalMaterial = new THREE.MeshPhongMaterial({
            color: new THREE.Color(0x808080),
            specular: new THREE.Color(0xffffff),
            shininess: 30,
            flatShading: true,
        });
        const crystalMesh = new THREE.Mesh(crystalGeometry, crystalMaterial);

        // Add shadow
        crystalMesh.castShadow = true;
        crystalMesh.receiveShadow = true;

        crystalMesh.position.copy(position);
    
        // Calculate volume and mass based on the geometry and density
        const volume = Math.PI * baseRadius * baseRadius * height;
        const mass = density * volume;
    
        // Create the physics body for the crystal from the threejs mesh
        const shape = new CANNON.Box(new CANNON.Vec3(baseRadius, baseRadius, height / 2));
        const crystalBody = new CANNON.Body({
            mass: mass,
            position: new CANNON.Vec3(position.x, position.y, position.z),
            shape: shape,
            velocity: velocity,
        });
    
        // Apply the same orientation to the physics body
        const quaternion = new CANNON.Quaternion();
        quaternion.setFromEuler(orientation.x, orientation.y, orientation.z);
        crystalBody.quaternion = quaternion;
    
        this.world.addBody(crystalBody);
        this.bodies.push(crystalBody);
    
        this.sphereGroup.add(crystalMesh);
        this.meshes.push(crystalMesh);
    }

    addCrystals(numberOfCrystals, density) {
        const volumeSize = this.worldSize / 2;
        for (let i = 0; i < numberOfCrystals; i++) {
            const position = this.generateRandomPosition(volumeSize);
            const baseRadius = this.radius * (0.5 + Math.random());
            const height = this.radius * (1 + Math.random() * 2); // Height is 1 to 3 times the base radius
            const radialSegments = Math.floor(3 + Math.random() * 5); // Randomly choose between 3 and 7 sides
            const orientation = this.generateRandomOrientation();
            this.addCrystal(baseRadius, height, radialSegments, position, orientation, density);
        }
    }

    generateRandomOrientation() {
        return new CANNON.Vec3(
            Math.random() * Math.PI, // Rotation around X axis
            Math.random() * Math.PI, // Rotation around Y axis
            Math.random() * Math.PI  // Rotation around Z axis
        );
    }
    generateRandomVelocity() {
        return new CANNON.Vec3(
            (Math.random() - 0.5) * this.velocityX, // X velocity
            (Math.random() - 0.5) * this.velocityY, // Y velocity
            (Math.random() - 0.5) * this.velocityZ  // Z velocity
        );
    }
    generateRandomPosition(volumeSize) {
        return new CANNON.Vec3(
            (Math.random() - 0.5) * volumeSize,
            (Math.random() - 0.5) * volumeSize,
            (Math.random() - 0.5) * volumeSize
        );
    }

    calculateAcceleration(body) {
        // Use the Octree to calculate the gravitational force on the body
        let force = this.octree.calculateGravity(body);
    
        // Calculate the acceleration by dividing the force by the mass of the body
        let acceleration = force.scale(1 / body.mass);
        
        return acceleration; // This is a CANNON.Vec3 object representing acceleration
    }
    
    calculateMaxAcceleration() {
        let maxAccelerationMagnitude = 0;
    
        this.bodies.forEach((body) => {
            // Calculate the acceleration for the current body
            let acceleration = this.calculateAcceleration(body);
    
            // Calculate the magnitude of the acceleration
            let accelerationMagnitude = acceleration.length();
    
            // Update maxAccelerationMagnitude if the current one is larger
            maxAccelerationMagnitude = Math.max(maxAccelerationMagnitude, accelerationMagnitude);
        });
    
        return maxAccelerationMagnitude;
    }

    // ----------------- IMPORT -----------------

    addBody(mass, position, velocity, orientation) {
        // Create Cannon.js body
        const body = new CANNON.Body({
            mass: mass, // Set mass
            position: new CANNON.Vec3(position.x, position.y, position.z),
            velocity: new CANNON.Vec3(velocity.x, velocity.y, velocity.z),
            quaternion: new CANNON.Quaternion(orientation.x, orientation.y, orientation.z, orientation.w)
        });

        // Define the shape of the body, e.g., a sphere or box
        const shape = new CANNON.Box(new CANNON.Vec3(/* dimensions */));
        body.addShape(shape);

        // Add body to the world
        this.world.addBody(body);
        this.bodies.push(body);
    }

    addMesh(meshData) {
        if (meshData.geometry.type === 'CylinderGeometry') {
            const geomParams = meshData.geometry;
            const geometry = new THREE.CylinderGeometry(
                geomParams.radiusTop,
                geomParams.radiusBottom,
                geomParams.height,
                geomParams.radialSegments,
                geomParams.heightSegments,
                geomParams.openEnded,
                geomParams.thetaStart,
                geomParams.thetaLength
            );
    
            const material = new THREE.MeshPhongMaterial({
                color: new THREE.Color(0x808080), // You can adjust the material properties
                specular: new THREE.Color(0xffffff),
                shininess: 30,
                flatShading: true,
            });
    
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(meshData.position.x, meshData.position.y, meshData.position.z);
            mesh.quaternion.set(meshData.orientation.x, meshData.orientation.y, meshData.orientation.z, meshData.orientation.w);
    
            this.scene.add(mesh);
            this.meshes.push(mesh);
        } else {
            console.error('Unsupported geometry type:', meshData.geometry.type);
        }
    }


    // ----------------- Gravity -----------------

    applyGravity() {
        // 1. Construct the octree for the current positions of the bodies.
        let octree = new Octree(this.worldSize, this.gravityConstant);
    
        // 2. Insert all bodies into the octree.
        this.bodies.forEach(body => {
            // Create a new object with the expected structure for the octree
            let bodyObject = {
                mass: body.mass,
                position: body.position
            };
            octree.insert(bodyObject);
        });
    
        // 3. Compute the force for each body using the octree.
        this.bodies.forEach(body => {
            let force = octree.calculateGravity(body);
            
            // Apply the calculated force to the body
            body.force.vadd(force, body.force);
        });
    }
    

    // ----------------- Update -----------------

    update(deltaTime, enableColorMapping) {
        // Adjust deltaTime if necessary for your simulation timing

        // Update the octree with the current bodies
        this.octree.clear(); // Clear the octree for the new simulation step
        this.bodies.forEach(body => {
            this.octree.insert(body); // Re-insert bodies into the octree
        });

        // Calculate and apply gravitational forces using the octree
        this.bodies.forEach(body => {
            const gravityForce = this.octree.calculateGravity(body);
            body.applyForce(gravityForce, body.position); // Apply the calculated gravitational force
        });

        this.world.step(deltaTime); // Step the physics simulation

        // Calculate the maximum acceleration for all bodies in the simulation
        const maxAcceleration = this.calculateMaxAcceleration();
        
        // Update Three.js meshes to match the physics world's updated state
        for (let i = 0; i < this.bodies.length; i++) {
            const body = this.bodies[i];
            const mesh = this.meshes[i];
            
            mesh.position.copy(body.position);
            mesh.quaternion.copy(body.quaternion);
            
            
            if (enableColorMapping) {
                // Calculate the acceleration for the body using the octree
                const acceleration = this.calculateAcceleration(body);
                // Get the magnitude of the acceleration for color mapping
                const accelerationMagnitude = acceleration.length();

                // Apply the color from the acceleration using updateColor
                mesh.material.color = this.updateColor(accelerationMagnitude, maxAcceleration);
            } else {
                // Reset the color to the default
                mesh.material.color = new THREE.Color(0x808080);
            }
        }
    }

    updateColor(acceleration, maxAcceleration) {
        // Update the color of current crystal based on its acceleration vs the maximum acceleration of all crystals.
        const color = new THREE.Color();
        // Invert the mapping: higher acceleration gives a lower hue value (closer to red)
        const hue = 240 - (240 * (Math.max(0, Math.min(1, acceleration / maxAcceleration))));
        color.setHSL(hue / 360, 1.0, 0.5);
        return color;
    }

    getMeshes() {
        return this.sphereGroup;
    }
}

export default Simulation;
