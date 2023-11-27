// shaderLoader.js

/**
 * Asynchronously loads a shader file.
 * @param {string} url The URL of the shader file.
 * @returns {Promise<string>} A promise that resolves with the shader code as a string.
 */
async function loadShader(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.text();
    } catch (error) {
        console.error('Error loading shader:', error);
        throw error;
    }
}

export default loadShader;
