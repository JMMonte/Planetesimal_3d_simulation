import { Vec3 } from 'cannon-es';

export class OctreeNode {
    constructor(center, halfDimension) {
        this.center = center;
        this.halfDimension = halfDimension;
        this.children = new Array(8).fill(null);
        this.body = null;
        this.mass = 0;
        this.centerOfMass = new Vec3(0, 0, 0);
    }
    // Clears this node and all its children recursively
    clear() {
        // Reset properties
        this.mass = 0;
        this.centerOfMass.set(0, 0, 0);
        this.body = null;

        // Recursively clear all non-null children
        for (let i = 0; i < this.children.length; i++) {
            if (this.children[i] !== null) {
                this.children[i].clear();
                this.children[i] = null;
            }
        }
    }

    // Check if this node is a leaf node (no children)
    isLeaf() {
        // Typically, a node is a leaf if it has no children
        return this.children.every(child => child === null);
    }

    // Determine the correct octant for a point in space
    getOctantIndex(position) {
        let index = 0;
        if (position.x >= this.center.x) index |= 4;
        if (position.y >= this.center.y) index |= 2;
        if (position.z >= this.center.z) index |= 1;
        return index;
    }

    // Subdivide the octant into 8 children
    subdivide() {
        const newHalf = this.halfDimension.scale(0.5);
        for (let i = 0; i < 8; i++) {
            // Calculate new center for each child
            let x = this.center.x + newHalf.x * (i & 4 ? 0.5 : -0.5);
            let y = this.center.y + newHalf.y * (i & 2 ? 0.5 : -0.5);
            let z = this.center.z + newHalf.z * (i & 1 ? 0.5 : -0.5);
            let newCenter = new Vec3(x, y, z);
            this.children[i] = new OctreeNode(newCenter, newHalf);
        }
    }

    // Insert a body into the tree
    insert(body) {
        // If this node doesn't have a body, put the new body here
        if (!this.body && this.isLeaf()) {
            this.body = body;
            this.mass = body.mass;
            this.centerOfMass.copy(body.position);
            return;
        }

        // If this node is a leaf, but has a body, subdivide and then insert both bodies
        if (this.isLeaf()) {
            this.subdivide();
            this.children[this.getOctantIndex(this.body.position)].insert(this.body);
            this.body = null; // Now, this node is an internal node and thus cannot hold a body
        }

        // Insert the new body in the appropriate octant
        let octantIndex = this.getOctantIndex(body.position);
        if (!this.children[octantIndex]) {
            let newCenter = new Vec3(
                this.center.x + this.halfDimension.x * (octantIndex & 4 ? 0.5 : -0.5),
                this.center.y + this.halfDimension.y * (octantIndex & 2 ? 0.5 : -0.5),
                this.center.z + this.halfDimension.z * (octantIndex & 1 ? 0.5 : -0.5)
            );
            this.children[octantIndex] = new OctreeNode(newCenter, this.halfDimension.scale(0.5));
        }
        this.children[octantIndex].insert(body);

        // Update the mass and center of mass for the node
        this.updateMassAndCenterOfMass(body);
    }

    // Update the mass and center of mass for this node
    updateMassAndCenterOfMass(body) {
        let totalMass = this.mass + body.mass;
        let com = (this.centerOfMass.scale(this.mass)).vadd(body.position.scale(body.mass)).scale(1 / totalMass);
        this.centerOfMass = com;
        this.mass = totalMass;
        // Update parent nodes recursively if necessary...
    }

    /**
     * Calculates the gravitational force exerted by this node on the given body.
     * If this node is a leaf node, calculate the direct gravitational force.
     * Otherwise, use the center of mass and total mass to approximate the force.
     * @param {Body} body - The body to calculate the force on.
     * @param {number} theta - The Barnes-Hut approximation threshold.
     * @param {Vec3} force - The vector to add the calculated force to.
     * @param {number} G - The gravitational constant to be used in force calculations.
     */
    calculateForcesOnBody(body, theta, force, G) {
        if (this.mass === 0 || body === this.body) return;
    
        const distanceSquared = this.centerOfMass.distanceSquared(body.position);
    
        // Avoid dividing by 0 or self-interaction
        if (distanceSquared === 0) return;
    
        // Use squared distance to check if we're far enough away, or it's a leaf
        if (this.size * this.size / distanceSquared < theta * theta || this.isLeaf()) {
            // Calculate and apply gravitational force directly
            const magnitude = G * this.mass * body.mass / distanceSquared;
            const direction = this.centerOfMass.vsub(body.position).normalize().scale(magnitude);
            force.vadd(direction, force);
        } else {
            // Recursively calculate forces using child nodes
            for (let child of this.children) {
                child?.calculateForcesOnBody(body, theta, force, G);
            }
        }
    }
    
}
