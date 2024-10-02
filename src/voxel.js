import * as THREE from 'three';

import { MeshBVH, acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh';

import Loader from './loader';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const raycaster = new THREE.Raycaster();
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

let metadata = []; 
let voxels = [];
let params = []; 

async function VoxelizeMesh(paramsInput, mesh) 
{
    if (mesh.material && mesh.material.map) 
    {
        const texture = mesh.material.map;
    
        // Set texture wrapping to repeat for both axes
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
    
        // Set filtering to nearest for better accuracy in voxelization
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
    
        // Disable mipmaps to avoid LOD-related issues
        texture.generateMipmaps = false;
    }
    
    let localMeshes = [];
    let localVoxels = [];
    let localParams = paramsInput;

    let boundingBox = new THREE.Box3().setFromObject(mesh);
    const size = boundingBox.getSize(new THREE.Vector3());
    const scaleFactor = localParams.modelSize / size.length();
    const center = boundingBox.getCenter(new THREE.Vector3()).multiplyScalar(-scaleFactor);

    mesh.scale.multiplyScalar(scaleFactor);
    mesh.position.copy(center);
    ProcessMeshes(mesh, localMeshes);

    boundingBox = new THREE.Box3().setFromObject(mesh);
    let minY = Infinity;

    for (let i = boundingBox.min.x; i < boundingBox.max.x; i += localParams.gridSize) 
    {
        for (let j = boundingBox.min.y; j < boundingBox.max.y; j += localParams.gridSize) 
        {
            for (let k = boundingBox.min.z; k < boundingBox.max.z; k += localParams.gridSize) 
            {
                for (let meshCount = 0; meshCount < localMeshes.length; meshCount++) 
                {
                    const position = new THREE.Vector3(i, j, k);
                    const positionSnapped = new THREE.Vector3(
                        snapToGrid(position.x, localParams.gridSize),
                        snapToGrid(position.y, localParams.gridSize),
                        snapToGrid(position.z, localParams.gridSize)
                    );
                    const positionRounded = new THREE.Vector3(
                        roundToPrecision(positionSnapped.x, 10),
                        roundToPrecision(positionSnapped.y, 10),
                        roundToPrecision(positionSnapped.z, 10)
                    );
                    const currentMesh = localMeshes[meshCount];

                    if (IsInsideMeshAllDirections(localParams, raycaster, positionSnapped, currentMesh))
                    {
                        let color = new THREE.Color();
                        const material = currentMesh.material;
                        const isEmissive = material.emissive && (material.emissive.r !== 0 || material.emissive.g !== 0 || material.emissive.b !== 0);

                        if (material.map) {
                            const uv = getUVAtVoxelPosition(positionSnapped, currentMesh, raycaster);
                            if (uv) {
                                const clampedUV = clampUV(uv);
                                color = getColorFromTextureAtUV(uv, material.map);
                            }
                        }
                        else 
                        {
                            if (isEmissive) color.copy(material.emissive);
                            else 
                            {
                                const { h, s, l } = material.color.getHSL(color);
                                color.setHSL(h, s * 0.8, l * 0.8 + 0.2);
                            }
                        }                        

                        localVoxels.push({
                            _c: color,
                            _p: positionRounded,
                            _mt: isEmissive ? 'Emissive' : 'BSDF',
                            _ei: isEmissive ? material.emissiveIntensity : null,
                            _o: 0
                        });

                        if (positionSnapped.y < minY) minY = positionSnapped.y;
                        break;
                    }
                }
            }
        }
    }

    console.log('Voxels instantiated:', localVoxels.length);

    WeightedAmbientOcclusion(localVoxels, paramsInput.gridSize, false); 
    localVoxels = RemoveFullyOccludedVoxels(localVoxels, 0.1); 

    let instancedMesh = GetVoxelGeometry(localParams, localVoxels.length);
    CreateInstancedVoxelMesh(instancedMesh, localVoxels);

    console.log('Mesh instantiated:', instancedMesh);

    if (!localVoxels.length || !instancedMesh) {
        console.error('Voxelization failed or returned empty data.');
        return null;
    }

    return { voxels: localVoxels, instancedMesh };
}

function IsInsideMeshAllDirections(params, raycaster, position, mesh) 
{
    const directions = [
        { x: 0, y: 0, z: 1 },
        { x: 0, y: 0, z: -1 },
        { x: 0, y: 1, z: 0 },
        { x: 0, y: -1, z: 0 },
        { x: 1, y: 0, z: 0 },
        { x: -1, y: 0, z: 0 }
    ]
    for (let i = 0; i < directions.length; i++) if (IsInsideMesh(params, raycaster, position, directions[i], mesh)) return true;
    return false; 
}

function snapToGrid(value, gridSize) {
    return Math.round(value / gridSize) * gridSize;
}

function roundToPrecision(value, precision = 10) {
    return Math.round(value * precision) / precision;
}

function getUVAtVoxelPosition(voxelPosition, mesh, raycaster) {
    // Cast a ray downwards to intersect with the mesh
    raycaster.set(voxelPosition, new THREE.Vector3(0, -1, 0)); 
    raycaster.firstHitOnly = true; 
    const intersects = raycaster.intersectObject(mesh);

    if (intersects.length > 0) {
        const uv = new THREE.Vector2();
        uv.copy(intersects[0].uv); // Use the precomputed UV from the intersection

        // Clamp UVs to avoid out-of-bound values
        uv.x = THREE.MathUtils.clamp(uv.x, 0, 1);
        uv.y = THREE.MathUtils.clamp(uv.y, 0, 1);

        return uv;
    }

    return null; // No intersection
}

function getColorFromTextureAtUV(uv, texture) {
    const width = texture.image.width;
    const height = texture.image.height;

    const x = Math.floor(uv.x * width);
    const y = Math.floor(uv.y * height);

    // Create an off-screen canvas to draw the texture for pixel access
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(texture.image, 0, 0);

    // Get pixel data at the calculated UV coordinate
    const pixelData = ctx.getImageData(x, y, 1, 1).data;

    // If the pixel has transparency (alpha < 255), handle accordingly
    if (pixelData[3] < 255) {
        console.log('Transparent pixel detected');
        // Optionally, handle transparent pixels here (e.g., return a default color)
        return new THREE.Color(1, 1, 1); // Return white for transparency, adjust as needed
    }

    // Convert pixel data to a THREE.Color object
    const color = new THREE.Color(
        pixelData[0] / 255,
        pixelData[1] / 255,
        pixelData[2] / 255
    );

    return color;
}

function clampUV(uv) {
    uv.x = Math.min(Math.max(uv.x, 0), 1);
    uv.y = Math.min(Math.max(uv.y, 0), 1);
    return uv;
}

function FastAmbientOcclusion(localVoxels, gridSize, debug = false) {
    const voxelMap = new Map();

    // Store voxel positions in a map for quick neighbor lookup
    localVoxels.forEach(voxel => {
        const key = `${voxel._p.x},${voxel._p.y},${voxel._p.z}`;
        voxelMap.set(key, voxel);
    });

    localVoxels.forEach(voxel => {
        let occlusion = 0;
        let totalWeight = 0;

        // Check neighbors in all 6 directions (right, left, top, bottom, front, back)
        const directions = [
            new THREE.Vector3(1, 0, 0),
            new THREE.Vector3(-1, 0, 0),
            new THREE.Vector3(0, 1, 0),
            new THREE.Vector3(0, -1, 0),
            new THREE.Vector3(0, 0, 1),
            new THREE.Vector3(0, 0, -1)
        ];

        directions.forEach(dir => 
        {
            const neighborPos = voxel._p.clone().add(dir.offset.multiplyScalar(gridSize));
            const snappedPos = new THREE.Vector3(
                snapToGrid(neighborPos.x, gridSize),
                snapToGrid(neighborPos.y, gridSize),
                snapToGrid(neighborPos.z, gridSize)
            );
            const roundedPos = new THREE.Vector3(
                roundToPrecision(snappedPos.x, 10),
                roundToPrecision(snappedPos.y, 10),
                roundToPrecision(snappedPos.z, 10)
            );
            const neighborKey = `${roundedPos.x},${roundedPos.y},${roundedPos.z}`
            
            if (voxelMap.has(neighborKey)) occlusion += dir.weight;
            totalWeight += dir.weight;
        });

        // The more neighbors, the more occluded this voxel is
        const occlusionFactor = 1 - occlusion / totalWeight;  // Range 0 to 1

        if (debug) 
        {
            // Visualize AO as grayscale
            // Assuming voxel._c is a THREE.Color instance
            const grayscale = occlusionFactor; // 0 (fully occluded) to 1 (no occlusion)
            voxel._c.setRGB(grayscale, grayscale, grayscale);
        } 
        else 
        {
            // Apply AO as a darkening factor
            voxel._c.multiplyScalar(occlusionFactor);
        }
    });
}

function WeightedAmbientOcclusion(localVoxels, gridSize, debug = false) {
    const voxelMap = new Map();

    // Store voxel positions in a map for quick neighbor lookup
    localVoxels.forEach(voxel => {
        const key = `${voxel._p.x},${voxel._p.y},${voxel._p.z}`;
        voxelMap.set(key, voxel);
    });

    localVoxels.forEach(voxel => {
        let occlusion = 0;
        let totalWeight = 0;

        // Define neighbor offsets and their weights
        const directions = [
            // Primary directions
            { offset: new THREE.Vector3(1, 0, 0),    weight: 0.015 }, // RIGHT
            { offset: new THREE.Vector3(-1, 0, 0),   weight: 0.015 }, // LEFT
            { offset: new THREE.Vector3(0, 1, 0),    weight: 0.450 }, // TOP
            { offset: new THREE.Vector3(0, -1, 0),   weight: 0.050 }, // BOTTOM
            { offset: new THREE.Vector3(0, 0, 1),    weight: 0.150 }, // FRONT
            { offset: new THREE.Vector3(0, 0, -1),   weight: 0.010 }, // BACK
        
            // 2D Diagonals
            { offset: new THREE.Vector3(1, 1, 0),    weight: 0.150 }, // TOP-RIGHT
            { offset: new THREE.Vector3(-1, 1, 0),   weight: 0.150 }, // TOP-LEFT
            { offset: new THREE.Vector3(1, -1, 0),   weight: 0.025 }, // BOT-RIGHT
            { offset: new THREE.Vector3(-1, -1, 0),  weight: 0.025 }, // BOT-LEFT
            
            // 3D Diagonals
            { offset: new THREE.Vector3(1, 1, 1),    weight: 0.150 }, // TOP-RIGHT-FRONT
            { offset: new THREE.Vector3(-1, 1, 1),   weight: 0.150 }, // TOP-LEFT-FRONT
            { offset: new THREE.Vector3(1, -1, 1),   weight: 0.025 }, // BOT-RIGHT-FRONT
            { offset: new THREE.Vector3(-1, -1, 1),  weight: 0.025 }, // BOT-LEFT-FRONT
            { offset: new THREE.Vector3(1, 1, -1),   weight: 0.010 }, // TOP-RIGHT-BACK
            { offset: new THREE.Vector3(-1, 1, -1),  weight: 0.010 }, // TOP-LEFT-BACK
            { offset: new THREE.Vector3(1, -1, -1),  weight: 0.010 }, // BOT-RIGHT-BACK
            { offset: new THREE.Vector3(-1, -1, -1), weight: 0.010 }  // BOT-LEFT-BACK
        ];
        
        // Check each neighbor and accumulate occlusion based on weights
        directions.forEach(dir => 
        {
            const neighborPos = voxel._p.clone().add(dir.offset.multiplyScalar(gridSize));
            const snappedPos = new THREE.Vector3(
                snapToGrid(neighborPos.x, gridSize),
                snapToGrid(neighborPos.y, gridSize),
                snapToGrid(neighborPos.z, gridSize)
            );
            const roundedPos = new THREE.Vector3(
                roundToPrecision(snappedPos.x, 10),
                roundToPrecision(snappedPos.y, 10),
                roundToPrecision(snappedPos.z, 10)
            );
            const neighborKey = `${roundedPos.x},${roundedPos.y},${roundedPos.z}`
        
            //console.log(`Voxel Position: ${voxel.position.x}, ${voxel.position.y}, ${voxel.position.z}`);
            //console.log(`Neighbor Position: ${roundedPos.x},${roundedPos.y},${roundedPos.z}`);

            if (voxelMap.has(neighborKey)) occlusion += dir.weight;
            totalWeight += dir.weight;
        });

        // Normalize the occlusion to range 0 to 1 based on total possible weight
        const occlusionFactor = THREE.MathUtils.clamp(1 - (occlusion / totalWeight), 0, 1);
        voxel._o = occlusionFactor; 

        if (debug) 
        {
            // Visualize AO as grayscale
            const grayscale = occlusionFactor; // 0 (fully occluded) to 1 (no occlusion)
            voxel._c.setRGB(grayscale, grayscale, grayscale);
            /*
            console.log(`Voxel at ${voxel.position.x}, ${voxel.position.y}, ${voxel.position.z}`);
            console.log(`  Occlusion: ${occlusion}`);
            console.log(`  Total Weight: ${totalWeight}`);
            console.log(`  Occlusion Factor: ${occlusionFactor}`);
            */
        } 
        else 
        {
            // Apply AO as a darkening factor
            voxel._c.multiplyScalar(occlusionFactor);
        }
    });
}

function RemoveFullyOccludedVoxels(localVoxels, darknessThreshold = 0.1) {
    const cleanedVoxels = [];

    for (let i = 0; i < localVoxels.length; i++) {
        const voxel = localVoxels[i];
        const { r, g, b } = voxel._c;

        // Check if the voxel color is below the darkness threshold for all RGB channels
        //const isFullyOccluded = r <= darknessThreshold && g <= darknessThreshold && b <= darknessThreshold;
        const occlusionThreshold = voxel._o <= darknessThreshold;  

        // If the voxel is not fully occluded, keep it
        if (!occlusionThreshold) {
            cleanedVoxels.push(voxel);
        }
    }

    console.log(`Original voxel count: ${localVoxels.length}`);
    console.log(`Cleaned voxel count: ${cleanedVoxels.length}`);

    return cleanedVoxels;
}

async function SaveVoxelData(object, metadata, portfolioMetadata, params, projectData) 
{
    if (!object.voxels || object.voxels.length === 0) 
    {
        console.warn("No voxel data available to save.");
        return;
    }

    metadata.originalMeshPath = metadata.originalMeshFolder + metadata.modelName + ".glb"; 

    const data = {
        metadata: metadata,
        portfolioMetadata: portfolioMetadata,
        params: params,  
        projectData: projectData,
        voxels: object.voxels 
    }

    const json = JSON.stringify(data, null, 2);

    // Trigger file download
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${metadata.modelName}_data.json`;
    link.click();
    
    // Clean up
    URL.revokeObjectURL(url);
}

async function LoadVoxelData(json) 
{
    const response = await fetch(json);
    const data = await response.json();

    params = data.params; 
    voxels = data.voxels;
    metadata = data.metadata; 

    const instancedMesh = GetVoxelGeometry(params, voxels.length); 
    RecreateInstancedVoxelMesh(instancedMesh, voxels); 

    return instancedMesh; 
} 

function ProcessMeshes(mesh, meshes) 
{
    mesh.traverse((child) => 
    {
        if (child instanceof THREE.Mesh) 
        {
            child.material.side = THREE.DoubleSide;
            child.geometry.computeBoundsTree();
            meshes.push(child);
        }
    });
}

function IsInsideMesh(params, raycaster, position, direction, mesh)
{
    raycaster.set(position, direction); 
    raycaster.firstHitOnly = true; 
    const intersection = raycaster.intersectObject(mesh); 

    return (intersection.length % 2 === 1 && intersection[0].distance <= 1.5 * params.gridSize);
}

function GetVoxelGeometry(params, length) 
{
    let voxelGeometry = new THREE.BoxGeometry(params.voxelSize, params.voxelSize, params.voxelSize);
    let voxelMaterial = new THREE.MeshBasicMaterial({ 
        fog: true,
    });
    voxelGeometry.computeBoundsTree(); 

    return new THREE.InstancedMesh(voxelGeometry, voxelMaterial, length); 
}

function CreateInstancedVoxelMesh(mesh, data) 
{
    let dummy = new THREE.Object3D();

    for (let i = 0; i < data.length; i++) 
    {
        dummy.position.copy(data[i]._p);
        dummy.updateMatrix();

        mesh.setMatrixAt(i, dummy.matrix);

        let color = new THREE.Color();

        if (typeof data[i]._c === 'string' || typeof data[i]._c === 'number') color.set(data[i]._c);  // Handle string or number color formats
        else if (data[i]._c instanceof THREE.Color) color.copy(data[i]._c);  // Copy the color if it's already a THREE.Color instance
        else console.warn("Unknown color format:", data[i]._c);

        mesh.setColorAt(i, color);

        // Handle emissive materials (commented out since not being used)
        if (data[i]._mt == "Emissive") {
            //mesh.material.emissive.set(color); // Set the emissive color
            //mesh.material.emissiveIntensity = (data[i].emissiveIntensity * 1); 
        }
    }

    mesh.instanceColor.needsUpdate = true;
    mesh.instanceMatrix.needsUpdate = true; 
}

function RecreateInstancedVoxelMesh(mesh, data) 
{
    let dummy = new THREE.Object3D();

    for (let i = 0; i < data.length; i++) 
    {
        const color = new THREE.Color();

        if (typeof data[i]._c === 'string' || typeof data[i]._c === 'number') color.set(data[i]._c);  // Handle string or number color formats
        else if (data[i]._c instanceof THREE.Color) color.copy(data[i]._c);  // Copy the color if it's already a THREE.Color instance
        else console.warn("Unknown color format:", data[i]._c);

        mesh.setColorAt(i, color);

        dummy.position.copy(data[i]._p);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
    }

    mesh.instanceColor.needsUpdate = true;
    mesh.instanceMatrix.needsUpdate = true;
}


async function GetOriginalModel() 
{
    const model = await Loader.LoadGLTFMesh(metadata.originalMeshPath);
    
    let boundingBox = new THREE.Box3().setFromObject(model); 
    const size = boundingBox.getSize(new THREE.Vector3());
    const scaleFactor = params.modelSize / size.length();
    const center = boundingBox.getCenter(new THREE.Vector3()).multiplyScalar(-scaleFactor);

    model.scale.multiplyScalar(scaleFactor);
    model.position.copy(center);
    //model.position.y = MinY(); 

    return model; 
}

function CreateVoxelGrid(width, depth, spacing) {
    const voxelSize = spacing;
    const voxelGeometry = new THREE.BoxGeometry(voxelSize, voxelSize, voxelSize);
    const voxelMaterial = new THREE.MeshBasicMaterial({color: '#ffffff', wireframe: false });

    // Create an InstancedMesh with the number of voxels
    const numVoxels = width * depth;
    const instancedMesh = new THREE.InstancedMesh(voxelGeometry, voxelMaterial, numVoxels);

    // Set up the matrix for each instance
    const dummy = new THREE.Object3D();
    let index = 0;
    
    for (let x = 0; x < width; x++) 
    {
        for (let z = 0; z < depth; z++) 
        {
            dummy.position.set(
                x * voxelSize - width * voxelSize / 2,
                0,
                z * voxelSize - depth * voxelSize / 2,
            );
            dummy.updateMatrix();

            //instancedMesh.setColorAt(index, THREE.Color()); 
            instancedMesh.setMatrixAt(index++, dummy.matrix);
        }
    }

    instancedMesh.receiveShadow = false; 
    return instancedMesh;
}

function CreateVoxelCircle(radius, spacing) {
    const voxelSize = spacing;
    const voxelGeometry = new THREE.BoxGeometry(voxelSize, voxelSize, voxelSize);
    const voxelMaterial = new THREE.MeshBasicMaterial({ color: '#ffffff', wireframe: false});

    // Estimate the number of voxels needed (approximately the area of the circle divided by voxel area)
    const numVoxels = Math.ceil(Math.PI * Math.pow(radius, 2) / Math.pow(voxelSize, 2));
    const instancedMesh = new THREE.InstancedMesh(voxelGeometry, voxelMaterial, numVoxels);

    // Set up the matrix for each instance
    const dummy = new THREE.Object3D();
    let index = 0;

    for (let x = -radius; x <= radius; x++) {
        for (let z = -radius; z <= radius; z++) {
            // Check if the (x, z) position is within the circle
            if (x * x + z * z <= radius * radius) {
                dummy.position.set(
                    x * voxelSize,
                    0,
                    z * voxelSize,
                );
                dummy.updateMatrix();

                // Set matrix and color for each voxel
                instancedMesh.setMatrixAt(index++, dummy.matrix);
            }
        }
    }

    instancedMesh.receiveShadow = true;
    return instancedMesh;
}

function MinY() {return Math.min(...voxels.map(v => v._p.y)) - params.voxelSize / 2;}
function MaxY() {return Math.max(...voxels.map(v => v._p.y)) + params.voxelSize / 2;}
function VoxelHeight() {return ((MaxY() - MinY()) / params.voxelSize);}
function Metadata() {return metadata;}

export default {GetVoxelGeometry, VoxelizeMesh, SaveVoxelData, LoadVoxelData, RecreateInstancedVoxelMesh, GetOriginalModel, CreateVoxelGrid, CreateVoxelCircle, MinY, MaxY, VoxelHeight, Metadata}; 