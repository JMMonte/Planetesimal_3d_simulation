# Gravity Simulator using THREEJs + CANNONJS 

## Description

Gravity Simulator is a 3D simulation built with Three.js and CANNON.js, providing a visual and interactive experience of gravity and physics in a simulated environment. Users can manipulate various elements such as the number of spheres, gravity constants, and velocities to observe different gravitational effects.

## Features

- Dynamic 3D rendering using Three.js.
- Realistic physics simulation with CANNON.js.
- Interactive GUI with dat.GUI for real-time parameter adjustments.
- Customizable lighting and shadows for a more immersive experience.
- Effects composer with SSAO for enhanced visual depth.

## Setup

Follow these steps to set up the simulation locally:

1. Clone the repository:
   ```bash
   git clone https://github.com/JMMonte/gravity_sim.git
   ```
2. Navigate to the project directory:
   ```bash
   cd gravity_sim
   ```
3. Install the necessary dependencies:
   ```bash
   npm install
   ```
4. Launch the development server:
   ```bash
   npm run start
   ```

The simulation should now be available at [http://localhost:8080](http://localhost:8080).

## Building for Production

To create a production build, execute:

```bash
npm run build
```

This generates a `dist` folder containing the optimized assets ready for deployment.

## Deployment

After building for production, deploy by uploading the contents of the `dist` folder to your server's root directory. Ensure the server serves `index.html` as the entry point.

## Contributing

Contributions to Gravity Simulator are welcome! To contribute, please fork the repository, make your changes, and submit a pull request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE.md) file for details.

## Acknowledgments

- [Three.js](https://threejs.org/)
- [CANNON.js](https://github.com/schteppe/cannon.js)
- [dat.GUI](https://github.com/dataarts/dat.gui)
- [Stats.js](https://github.com/mrdoob/stats.js/)
