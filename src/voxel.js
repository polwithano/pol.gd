import * as THREE from 'three'; 
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast, MeshBVH } from 'three-mesh-bvh';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import Loader from './loader'; 

const raycaster = new THREE.Raycaster();
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

let metadata = []; 
let voxels = [];
let meshes = [];   
let params = []; 

async function VoxelizeMesh(paramsInput, mesh) {
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

    for (let i = boundingBox.min.x; i < boundingBox.max.x; i += localParams.gridSize) {
        for (let j = boundingBox.min.y; j < boundingBox.max.y; j += localParams.gridSize) {
            for (let k = boundingBox.min.z; k < boundingBox.max.z; k += localParams.gridSize) {
                for (let meshCount = 0; meshCount < localMeshes.length; meshCount++) {
                    const pos = new THREE.Vector3(i, j, k);
                    const currentMesh = localMeshes[meshCount];

                    if (IsInsideMesh(localParams, raycaster, pos, { x: 0, y: 0, z: 1 }, currentMesh) ||
                        IsInsideMesh(localParams, raycaster, pos, { x: 0, y: 0, z: -1 }, currentMesh) ||
                        IsInsideMesh(localParams, raycaster, pos, { x: 0, y: 1, z: 0 }, currentMesh) ||
                        IsInsideMesh(localParams, raycaster, pos, { x: 0, y: -1, z: 0 }, currentMesh) ||
                        IsInsideMesh(localParams, raycaster, pos, { x: 1, y: 0, z: 0 }, currentMesh) ||
                        IsInsideMesh(localParams, raycaster, pos, { x: -1, y: 0, z: 0 }, currentMesh)) {
                        
                        const material = currentMesh.material;
                        const isEmissive = material.emissive && (material.emissive.r !== 0 || material.emissive.g !== 0 || material.emissive.b !== 0);
                        let color = new THREE.Color();

                        if (isEmissive) {
                            color.copy(material.emissive);
                        } else {
                            const { h, s, l } = material.color.getHSL(color);
                            color.setHSL(h, s * 0.8, l * 0.8 + 0.2);
                        }

                        localVoxels.push({
                            color: color,
                            position: pos,
                            materialType: isEmissive ? 'Emissive' : 'BSDF',
                            emissiveIntensity: isEmissive ? material.emissiveIntensity : null
                        });

                        if (pos.y < minY) minY = pos.y;
                        break;
                    }
                }
            }
        }
    }

    console.log('Voxels instantiated:', localVoxels.length);
    WeightedAmbientOcclusion(localVoxels, paramsInput.gridSize); 

    let instancedMesh = GetVoxelGeometry(localParams, localVoxels.length);
    CreateInstancedVoxelMesh(instancedMesh, localVoxels);

    console.log('Mesh instantiated:', instancedMesh);

    if (!localVoxels.length || !instancedMesh) {
        console.error('Voxelization failed or returned empty data.');
        return null;
    }

    return { voxels: localVoxels, instancedMesh };
}

function FastAmbientOcclusion(localVoxels, gridSize) {
    const voxelMap = new Map();

    // Store voxel positions in a map for quick neighbor lookup
    localVoxels.forEach(voxel => {
        const key = `${voxel.position.x},${voxel.position.y},${voxel.position.z}`;
        voxelMap.set(key, voxel);
    });

    localVoxels.forEach(voxel => {
        let occlusion = 0;

        // Check neighbors in all 6 directions (right, left, top, bottom, front, back)
        const directions = [
            new THREE.Vector3(1, 0, 0),
            new THREE.Vector3(-1, 0, 0),
            new THREE.Vector3(0, 1, 0),
            new THREE.Vector3(0, -1, 0),
            new THREE.Vector3(0, 0, 1),
            new THREE.Vector3(0, 0, -1)
        ];

        directions.forEach(dir => {
            const neighborPos = voxel.position.clone().add(dir.multiplyScalar(gridSize));
            const neighborKey = `${neighborPos.x},${neighborPos.y},${neighborPos.z}`;
            if (voxelMap.has(neighborKey)) {
                occlusion++;
            }
        });

        // The more neighbors, the more occluded this voxel is
        const occlusionFactor = 1 - occlusion / directions.length;  // Range 0 to 1

        // Apply a simple darkening based on occlusion factor
        voxel.color.multiplyScalar(occlusionFactor);
    });
}

function WeightedAmbientOcclusion(localVoxels, gridSize) {
    const voxelMap = new Map();

    // Store voxel positions in a map for quick neighbor lookup
    localVoxels.forEach(voxel => {
        const key = `${voxel.position.x},${voxel.position.y},${voxel.position.z}`;
        voxelMap.set(key, voxel);
    });

    localVoxels.forEach(voxel => {
        let occlusion = 0;
        let totalWeight = 0;

        // Define neighbor offsets and their weights
        const directions = [
            { offset: new THREE.Vector3(1, 0, 0), weight: 1.0 },   // Right
            { offset: new THREE.Vector3(-1, 0, 0), weight: 1.0 },  // Left
            { offset: new THREE.Vector3(0, 1, 0), weight: 1.0 },   // Top
            { offset: new THREE.Vector3(0, -1, 0), weight: 0.5 },  // Bottom
            { offset: new THREE.Vector3(0, 0, 1), weight: 1.0 },   // Front
            { offset: new THREE.Vector3(0, 0, -1), weight: 1.0 },  // Back
            { offset: new THREE.Vector3(1, 1, 0), weight: 0.6 },   // Top-right diagonal
            { offset: new THREE.Vector3(-1, 1, 0), weight: 0.6 },  // Top-left diagonal
            { offset: new THREE.Vector3(1, -1, 0), weight: 0.6 },  // Bottom-right diagonal
            { offset: new THREE.Vector3(-1, -1, 0), weight: 0.6 }, // Bottom-left diagonal
            // Add more diagonals if needed with lower weights
        ];

        // Check each neighbor and accumulate occlusion based on weights
        directions.forEach(dir => {
            const neighborPos = voxel.position.clone().add(dir.offset.multiplyScalar(gridSize));
            const neighborKey = `${neighborPos.x},${neighborPos.y},${neighborPos.z}`;
            if (voxelMap.has(neighborKey)) {
                occlusion += dir.weight;
            }
            totalWeight += dir.weight;
        });

        // Normalize the occlusion to range 0 to 1 based on total possible weight
        const occlusionFactor = 1 - occlusion / totalWeight;

        // Apply a simple darkening based on occlusion factor
        voxel.color.multiplyScalar(occlusionFactor);
    });
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
    let voxelGeometry = new THREE.BoxGeometry(params.boxSize, params.boxSize, params.boxSize);
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
        dummy.position.copy(data[i].position);
        dummy.updateMatrix();

        mesh.setMatrixAt(i, dummy.matrix);

        let color = new THREE.Color();

        if (typeof data[i].color === 'string' || typeof data[i].color === 'number') 
        {
            color.set(data[i].color);
        } 
        else if (data[i].color instanceof THREE.Color) 
        {
            color.copy(data[i].color);
        } 
        else 
        {
            console.warn("Unknown color format:", data[i].color);
        }

        mesh.setColorAt(i, color);

        if (data[i].materialType == "Emissive") 
        {
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
        // Convert color from decimal to hex string and then to THREE.Color
        const colorDecimal = data[i].color;
        const colorHex = '#' + colorDecimal.toString(16).padStart(6, '0').toUpperCase();
        const color = new THREE.Color(colorHex);

        mesh.setColorAt(i, color);

        dummy.position.copy(data[i].position);
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

    instancedMesh.receiveShadow = true; 
    return instancedMesh;
}

function MinY() {return Math.min(...voxels.map(v => v.position.y)) - params.boxSize / 2;}
function MaxY() {return Math.max(...voxels.map(v => v.position.y)) + params.boxSize / 2;}
function VoxelHeight() {return ((MaxY() - MinY()) / params.boxSize);}
function Metadata() {return metadata;}

export default {GetVoxelGeometry, VoxelizeMesh, SaveVoxelData, LoadVoxelData, RecreateInstancedVoxelMesh, GetOriginalModel, CreateVoxelGrid, MinY, MaxY, VoxelHeight, Metadata}; 