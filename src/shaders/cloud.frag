uniform float iTime;
uniform vec3 iResolution;
// Add other uniforms here, like gravity sources

void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;
    
    // Your raymarching code here
    // ...

    gl_FragColor = vec4(uv, 0.5 + 0.5 * sin(iTime), 1.0);
}
