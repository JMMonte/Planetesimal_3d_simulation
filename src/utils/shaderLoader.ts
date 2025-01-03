/**
 * Asynchronously loads a shader file.
 * @param url The URL of the shader file.
 * @returns A promise that resolves with the shader code as a string.
 */
export async function loadShader(url: string): Promise<string> {
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