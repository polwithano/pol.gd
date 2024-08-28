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

    let instancedMesh = GetVoxelGeometry(localParams, localVoxels.length);
    CreateInstancedVoxelMesh(instancedMesh, localVoxels);

    console.log('Mesh instantiated:', instancedMesh);

    instancedMesh.castShadow = true;
    instancedMesh.receiveShadow = false;

    if (!localVoxels.length || !instancedMesh) {
        console.error('Voxelization failed or returned empty data.');
        return null;
    }

    return { voxels: localVoxels, instancedMesh };
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

    instancedMesh.castShadow = true; 
    instancedMesh.receiveShadow = true; 

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
    let voxelGeometry = new RoundedBoxGeometry(params.boxSize, params.boxSize, params.boxSize, 2, params.boxRoundness);
    let voxelMaterial = new THREE.MeshStandardMaterial({ 
        flatShading: true,
        emissive: new THREE.Color(0x000000), // default emissive color
        emissiveIntensity: 1 // adjust as needed
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

function MinY() {return Math.min(...voxels.map(v => v.position.y)) - params.boxSize / 2;}
function MaxY() {return Math.max(...voxels.map(v => v.position.y)) + params.boxSize / 2;}
function VoxelHeight() {return ((MaxY() - MinY()) / params.boxSize);}
function Metadata() {return metadata;}

export default {GetVoxelGeometry, VoxelizeMesh, SaveVoxelData, LoadVoxelData, RecreateInstancedVoxelMesh, GetOriginalModel, MinY, MaxY, VoxelHeight, Metadata}; 