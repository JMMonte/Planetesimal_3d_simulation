import * as CANNON from 'cannon';

class OctreeNode {
    constructor(center, halfSize) {
        this.center = center;
        this.halfSize = halfSize;
        this.mass = 0;
        this.com = new CANNON.Vec3();
        this.isLeaf = true;
        this.bodies = [];
        this.children = [];
    }

    isEmpty() {
        return this.isLeaf && this.bodies.length === 0;
    }

    insert(body) {
        if (!this.isLeaf) {
            this._insertIntoChild(body);
        } else {
            this.bodies.push(body);
            if (this.bodies.length > Octree.MAX_BODIES_PER_NODE) {
                this.subdivide();
            }
        }
        this.updateMassDistribution(body);
        // After inserting the body, check if the current node is a leaf and has too many bodies
        if (this.isLeaf && this.bodies.length > Octree.MAX_BODIES_PER_NODE) {
            this.subdivide();
        }
    }

    remove(body) {
        const index = this.bodies.indexOf(body);
        if (index !== -1) {
            this.bodies.splice(index, 1); // Remove the body from the array
            this.updateMassDistribution(); // Update the mass distribution since we've removed a body
        } else {
            // If the body is not in the bodies array, it must be in a child node
            if (!this.isLeaf) {
                for (let child of this.children) {
                    child.remove(body);
                }
            }
        }
    }

    updateMassDistribution(body = null) {
        if (body) {
            // Incremental update to the center of mass and total mass
            let newMass = this.mass + body.mass;
            this.com.x = (this.com.x * this.mass + body.position.x * body.mass) / newMass;
            this.com.y = (this.com.y * this.mass + body.position.y * body.mass) / newMass;
            this.com.z = (this.com.z * this.mass + body.position.z * body.mass) / newMass;
            this.mass = newMass;
        }
    }

    subdivide() {
        let quarterSize = this.halfSize * 0.5;
        for (let x = -1; x <= 1; x += 2) {
            for (let y = -1; y <= 1; y += 2) {
                for (let z = -1; z <= 1; z += 2) {
                    let childCenter = new CANNON.Vec3(
                        this.center.x + x * quarterSize,
                        this.center.y + y * quarterSize,
                        this.center.z + z * quarterSize
                    );
                    this.children.push(new OctreeNode(childCenter, quarterSize));
                }
            }
        }
        this.isLeaf = false;
        // Move bodies to children
        let bodiesToMove = this.bodies;
        this.bodies = [];
        bodiesToMove.forEach(body => this._insertIntoChild(body));
    }

    merge() {
        // Only merge if this node is not a leaf and all children are leaves
        if (!this.isLeaf && this.children.every(child => child.isLeaf)) {
            let totalBodies = this.children.reduce((sum, child) => sum + child.bodies.length, 0);
            if (totalBodies < Octree.MIN_BODIES_PER_NODE) {
                this.bodies = [].concat(...this.children.map(child => child.bodies));
                this.children = [];
                this.isLeaf = true;
            }
        }
    }

    _insertIntoChild(body) {
        for (let child of this.children) {
            if (child.contains(body.position)) {
                child.insert(body);
                return;
            }
        }
    }

    contains(point) {
        return point.x >= this.center.x - this.halfSize &&
                point.x <= this.center.x + this.halfSize &&
                point.y >= this.center.y - this.halfSize &&
                point.y <= this.center.y + this.halfSize &&
                point.z >= this.center.z - this.halfSize &&
                point.z <= this.center.z + this.halfSize;
    }
    containsMovedBodies() {
        if (this.isLeaf) {
            return this.bodies.some(body => body.hasMoved);
        } else {
            return this.children.some(child => child.containsMovedBodies());
        }
    }
}


class Octree {
    constructor(worldSize, gravityConstant) {
        this.gravityConstant = gravityConstant;
        let halfWorldSize = worldSize / 2;
        this.root = new OctreeNode(new CANNON.Vec3(0, 0, 0), halfWorldSize);
        this.bodies = []; // Keep track of all bodies
        this.vec3Pool = []; // Initialize the pool
        this.updateThreshold = 10; // Define the threshold for update checks
        this.framesSinceLastUpdate = 0; // Initialize frame counter
        this.MAX_BODIES_PER_NODE = Octree.MAX_BODIES_PER_NODE = 10; // Example threshold for splitting
        this.MIN_BODIES_PER_NODE = Octree.MIN_BODIES_PER_NODE = 5; // Example threshold for merging
    }

    shouldUpdate() {
        return this.framesSinceLastUpdate >= this.updateThreshold ||
                this.root.containsMovedBodies();
    }

    getVec3() {
        // Reuse a vector from the pool or create a new one if pool is empty
        return this.vec3Pool.pop() || new CANNON.Vec3();
    }

    releaseVec3(vec) {
        // Return the vector to the pool for later reuse
        this.vec3Pool.push(vec);
    }

    pruneEmptyNodes() {
        // Start the recursive pruning from the root
        this._pruneEmptyNodes(this.root);
    }

    _pruneEmptyNodes(node) {
        // If the node is not a leaf, check its children
        if (!node.isLeaf) {
            // Keep a list of non-empty children
            let nonEmptyChildren = [];

            for (let child of node.children) {
                // Recursively prune the child nodes
                this._pruneEmptyNodes(child);

                // If the child is not empty, keep it
                if (!child.isEmpty()) {
                    nonEmptyChildren.push(child);
                }
            }

            // Update the node's children to only the non-empty children
            node.children = nonEmptyChildren;

            // If there are no non-empty children, convert the node back to a leaf
            if (node.children.length === 0) {
                node.isLeaf = true;
            }
        }
    }
    // Method to update the tree dynamically
    update() {
        if (this.shouldUpdate()) {
            // Reset the frame counter
            this.framesSinceLastUpdate = 0;

            // Perform the actual update
            this.pruneEmptyNodes(); // Prune the empty nodes first

            let movedBodies = this.bodies.filter(body => body.hasMoved);
            movedBodies.forEach(body => {
                this.root.remove(body); // Remove the body from its current node
                this.root.insert(body); // Reinsert the body
                body.hasMoved = false; // Reset the moved flag
            });

            // Update the structure of the tree
            this.updateStructure();

        } else {
            // Increment the frame counter if no update was performed
            this.framesSinceLastUpdate++;
        }
    }
    
    updateStructure() {
        this._updateNodeStructure(this.root);
    }
    _updateNodeStructure(node) {
        if (node.isLeaf) {
            // If it's a leaf and too dense, subdivide it
            if (node.bodies.length > Octree.MAX_BODIES_PER_NODE) {
                node.subdivide();
            }
        } else {
            // If it's not a leaf, attempt to merge it
            node.merge();
            // Recursively update child nodes
            node.children.forEach(child => this._updateNodeStructure(child));
        }
    }

    insert(body) {
        this.root.insert(body);
    }

    calculateGravity(body, theta = 0.5) {
        let force = this.getVec3().set(0, 0, 0);
        this._calculateGravity(this.root, body, theta, force);
        return force;
    }

    _calculateGravity(node, body, theta, force) {
        if (!node.isLeaf) {
            let directionToCOM = new CANNON.Vec3().copy(node.com).vsub(body.position);
            let distance = directionToCOM.norm();
    
            if ((node.halfSize / distance) < theta) {
                let strength = (this.gravityConstant * body.mass * node.mass) / (distance * distance);
                let unitDirection = directionToCOM.unit(new CANNON.Vec3()); // Normalize the vector
                let gravityForce = unitDirection.mult(strength); // Scale the normalized vector
                force.vadd(gravityForce, force);
            } else {
                node.children.forEach(child => this._calculateGravity(child, body, theta, force));
            }
        } else {
            node.bodies.forEach(otherBody => {
                if (otherBody !== body) {
                    let direction = new CANNON.Vec3().copy(otherBody.position).vsub(body.position);
                    let distanceSquared = direction.norm2();
                    if (distanceSquared > 1e-10) {
                        let strength = (this.gravityConstant * body.mass * otherBody.mass) / distanceSquared;
                        let unitDirection = direction.unit(new CANNON.Vec3()); // Normalize the vector
                        let gravityForce = unitDirection.mult(strength); // Scale the normalized vector
                        force.vadd(gravityForce, force);
                    }
                }
            });
        }
    }
    

    clear() {
        this.root = new OctreeNode(this.root.center, this.root.halfSize);
    }
}


export default Octree;
