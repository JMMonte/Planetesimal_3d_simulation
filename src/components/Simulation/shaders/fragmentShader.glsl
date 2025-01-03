varying vec3 vNormal;
varying vec3 vPosition;

uniform vec3 uCameraPosition; // Camera position for reflection calculations
uniform vec3 uLightPosition;  // Position of the light source
uniform vec3 uLightColor;     // Color of the light source
uniform vec3 uAmbientColor;   // Ambient light color
uniform vec3 uSpecularColor;  // Specular highlight color
uniform float uShininess;     // Shininess coefficient for specular highlights
uniform samplerCube uEnvMap;  // Environment map for reflections

void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDirection = normalize(vPosition - uCameraPosition);

    // Adjust normals near the edges (bevel effect)
    float edgeFactor = dot(viewDirection, normal);
    edgeFactor = 1.0 - smoothstep(0.95, 1.0, edgeFactor);
    normal = mix(normal, viewDirection, edgeFactor);

    // Phong reflection model
    vec3 lightDirection = normalize(uLightPosition - vPosition);
    float diff = max(dot(normal, lightDirection), 0.0);
    vec3 diffuse = diff * uLightColor;

    vec3 viewDir = normalize(-vPosition);
    vec3 reflectDir = reflect(-lightDirection, normal);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), uShininess);
    vec3 specular = uSpecularColor * spec;

    vec3 ambient = uAmbientColor;

    // Reflections (adjust reflectionFactor for strength of reflection)
    float reflectionFactor = 0.5;
    vec3 reflectedRay = reflect(viewDir, normal);
    vec3 reflection = textureCube(uEnvMap, reflectedRay).rgb * reflectionFactor;

    // Final color calculation
    vec3 finalColor = ambient + diffuse + specular + reflection;

    gl_FragColor = vec4(finalColor, 1.0);
}
