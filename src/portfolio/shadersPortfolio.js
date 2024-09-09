const fragment_pixelized = `
    uniform sampler2D tDiffuse;
    uniform vec3 iResolution;
    
    varying vec2 vUv;
    
    void main() 
    {
        // Simplified: directly sample the texture
        vec4 color = texture2D(tDiffuse, vUv);
        gl_FragColor = vec4(pow(color.rgb, vec3(1.0 / 2.2)), color.a);
    }`

const vertex_pixelized =`        
    varying vec2 vUv;

    void main() 
    {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

    }`

const fragment_outline = `
    uniform sampler2D tDiffuse;   // Original pixelated scene texture
    uniform sampler2D tDepth;     // Depth texture
    uniform float pixelationScale; // Controls pixelation/texel size scale
    
    varying vec2 vUv;
    varying vec3 vWorldPosition;  // Received from vertex shader
    varying vec3 vNormal;         // Received from vertex shader

    vec3 getNormalFromDepth(vec2 uv) {
        // Calculate the texel size based on the current pixelation scale
        vec2 texelSize = vec2(pixelationScale) / vec2(textureSize(tDepth, 0));

        // Get depth at current and neighboring pixels
        float depth = texture2D(tDepth, uv).r;
        float depthX = texture2D(tDepth, uv + vec2(texelSize.x, 0.0)).r;
        float depthY = texture2D(tDepth, uv + vec2(0.0, texelSize.y)).r;

        // Calculate the position differences in screen space
        vec3 p0 = vec3(uv, depth);
        vec3 px = vec3(uv + vec2(texelSize.x, 0.0), depthX);
        vec3 py = vec3(uv + vec2(0.0, texelSize.y), depthY);

        // Compute the normal using cross product
        vec3 normal = normalize(cross(px - p0, py - p0));
        return normal;
    }

    vec4 applyGaussianBlur(sampler2D inputTexture, vec2 uv, vec2 texelSize) {
        vec4 color = vec4(0.0);
        
        // Gaussian kernel for 3x3 blur
        float kernel[9];
        kernel[0] = 1.0 / 16.0;
        kernel[1] = 2.0 / 16.0;
        kernel[2] = 1.0 / 16.0;
        kernel[3] = 2.0 / 16.0;
        kernel[4] = 4.0 / 16.0;
        kernel[5] = 2.0 / 16.0;
        kernel[6] = 1.0 / 16.0;
        kernel[7] = 2.0 / 16.0;
        kernel[8] = 1.0 / 16.0;

        // Predefine offset array for sampling neighboring pixels
        vec2 offsets[9];
        offsets[0] = vec2(-1.0, -1.0) * texelSize; // top-left
        offsets[1] = vec2( 0.0, -1.0) * texelSize; // top-center
        offsets[2] = vec2( 1.0, -1.0) * texelSize; // top-right
        offsets[3] = vec2(-1.0,  0.0) * texelSize; // middle-left
        offsets[4] = vec2( 0.0,  0.0);             // center (no offset)
        offsets[5] = vec2( 1.0,  0.0) * texelSize; // middle-right
        offsets[6] = vec2(-1.0,  1.0) * texelSize; // bottom-left
        offsets[7] = vec2( 0.0,  1.0) * texelSize; // bottom-center
        offsets[8] = vec2( 1.0,  1.0) * texelSize; // bottom-right

        // Apply Gaussian blur by summing weighted samples
        for (int i = 0; i < 9; i++) {
            color += texture2D(inputTexture, uv + offsets[i]) * kernel[i];
        }

        return color;
    }

    void main() {
        vec2 texelSize = vec2(pixelationScale) / vec2(textureSize(tDiffuse, 0));

        float depth = texture2D(tDepth, vUv).r;
        float smoothedDepth = 0.0;

        smoothedDepth += texture2D(tDepth, vUv + vec2(-texelSize.x, -texelSize.y)).r;
        smoothedDepth += texture2D(tDepth, vUv + vec2(0.0, -texelSize.y)).r;
        smoothedDepth += texture2D(tDepth, vUv + vec2(texelSize.x, -texelSize.y)).r;
        smoothedDepth += texture2D(tDepth, vUv + vec2(-texelSize.x, 0.0)).r;
        smoothedDepth += depth;
        smoothedDepth += texture2D(tDepth, vUv + vec2(texelSize.x, 0.0)).r;
        smoothedDepth += texture2D(tDepth, vUv + vec2(-texelSize.x, texelSize.y)).r;
        smoothedDepth += texture2D(tDepth, vUv + vec2(0.0, texelSize.y)).r;
        smoothedDepth += texture2D(tDepth, vUv + vec2(texelSize.x, texelSize.y)).r;
        smoothedDepth /= 9.0;
    
        vec3 worldPosition = vWorldPosition;
        vec3 normal = normalize(vNormal);
        vec3 viewDir = normalize(worldPosition - cameraPosition);

        float edgeStrength = 0.5 - abs(dot(viewDir, normal));
        float edgeWidth = 2.0;
        float accumulatedEdgeStrength = 0.0;

        for (float x = -edgeWidth; x <= edgeWidth; x++) {
            for (float y = -edgeWidth; y <= edgeWidth; y++) {
                vec2 offset = vec2(x, y) * texelSize;
                float sampleDepth = texture2D(tDepth, vUv + offset).r;
                accumulatedEdgeStrength += abs(smoothedDepth - sampleDepth);
            }
        }

        accumulatedEdgeStrength /= (edgeWidth * edgeWidth * 0.20);
        edgeStrength = max(edgeStrength, accumulatedEdgeStrength);

        vec4 blurredEdges = applyGaussianBlur(tDiffuse, vUv, texelSize);
        float smoothedEdge = smoothstep(0.4, 0.6, edgeStrength);

        vec4 originalColor = texture2D(tDiffuse, vUv);
        vec4 edgeColor = vec4(0.0, 0.0, 0.0, smoothedEdge);
        gl_FragColor = mix(originalColor, edgeColor, smoothedEdge);
    }`

const vertex_outline = `
    varying vec2 vUv;
    varying vec3 vWorldPosition;  // Pass world position to the fragment shader
    varying vec3 vNormal;         // Pass normal to the fragment shader

    void main() {
        vUv = uv;
        
        // Compute world position of the vertex
        vec4 worldPosition = modelViewMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;

        // Pass the normal (which can be used for lighting or edge detection)
        vNormal = normalMatrix * normal;

        gl_Position = projectionMatrix * worldPosition;  // Standard position transformation
    }`

    export default {vertex_pixelized, vertex_outline, fragment_pixelized, fragment_outline}