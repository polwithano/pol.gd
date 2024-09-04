import * as THREE from 'three';
import Helpers from './helpers';  
import Loader from './loader'; 
import Voxel from './voxel'; 

export default class ObjectPortfolio 
{
    constructor(objectMethod = "Create", jsonPath = null, glbPath = null, defaultParams = null)
    {
        this.objectMethod = objectMethod;

        // Project-Related Data
        this.projectMetadata = []; 
        this.projectContent = []; 

        // Model-Related Data
        this.originalMesh = null;
        this.voxelMetadata = [];
        this.voxelParams = [];
        this.meshes = [];
        this.voxels = [];
        this.voxelizedMesh = null;

        this.voxelStartAnimationOver = false;
        this.voxelAnimationInitialized = false;  

        this.jsonPath = jsonPath;
        this.glbPath = glbPath;
        this.defaultParams = defaultParams; 
    }

    async load() 
    {
        if (this.objectMethod == "Create") 
        {
            await this.CreateObject();
        } 
        else if (this.objectMethod == "Load") 
        {
            await this.LoadObject();
        }
        return this;
    }

    async LoadObject() 
    {
        await this.LoadJsonData(this.jsonPath);

        this.voxelizedMesh = await Voxel.GetVoxelGeometry(this.voxelParams, this.voxels.length);
        Voxel.RecreateInstancedVoxelMesh(this.voxelizedMesh, this.voxels);

        await this.LoadCompliantOriginalModel();

        Helpers.CloneMeshMaterials(this.voxelizedMesh);
        Helpers.CloneMeshMaterials(this.originalMesh);

        this.voxelizedMesh.castShadow = true;
        this.voxelizedMesh.receiveShadow = false;
        this.voxelizedMesh.frustumCulled = false; 
    }

    async LoadJsonData(jsonPath) 
    {
        const response_project = await fetch(jsonPath);
        const project_data = await response_project.json();

        this.projectMetadata = project_data.metadata;
        this.projectContent = project_data.content; 

        const response_voxel = await fetch(this.projectMetadata.voxelPath); 
        const voxel_data = await response_voxel.json(); 

        this.voxelMetadata = voxel_data.metadata; 
        this.voxelParams = voxel_data.params;
        this.voxels = voxel_data.voxels;
    }

    async LoadCompliantOriginalModel() 
    {
        const model = await Loader.LoadGLTFMesh(this.voxelMetadata.originalMeshPath);

        let boundingBox = new THREE.Box3().setFromObject(model);
        const size = boundingBox.getSize(new THREE.Vector3());
        const scaleFactor = this.voxelParams.modelSize / size.length();
        const center = boundingBox.getCenter(new THREE.Vector3()).multiplyScalar(-scaleFactor);

        model.scale.multiplyScalar(scaleFactor);
        model.position.copy(center);

        this.originalMesh = model;
    }

    async CreateObject() 
    {
        try 
        {
            if (!this.glbPath) throw new Error('GLB path is not provided for CreateObject method.');
            if (!this.defaultParams) throw new Error('Default parameters are not provided for CreateObject method.');
    
            this.originalMesh = await Loader.LoadGLTFMesh(this.glbPath);
            if (!this.originalMesh) throw new Error('Failed to load original GLB model.');
    
            let result = await Voxel.VoxelizeMesh(this.defaultParams, this.originalMesh);

            this.voxels = result.voxels;
            this.voxelizedMesh = result.instancedMesh;

            if (!this.voxels || !this.voxelizedMesh) throw new Error('Failed to voxelize the original mesh.');
        } 
        catch (error) 
        {
            console.error('Error in CreateObject:', error);
            throw error;
        }
    }

    // Voxel Methods
    MinY() {
        if (!this.voxels || !this.voxelParams) return 0;
        return Math.min(...this.voxels.map(v => v._p.y)) - this.voxelParams.voxelSize / 2;
    }

    MinX() {
        if (!this.voxels || !this.voxelParams) return 0;
        return Math.min(...this.voxels.map(v => v._p.x)) - this.voxelParams.voxelSize / 2;
    }

    MinZ() {
        if (!this.voxels || !this.voxelParams) return 0;
        return Math.min(...this.voxels.map(v => v._p.z)) + this.voxelParams.voxelSize / 2;
    }
    
    MaxY() {
        if (!this.voxels || !this.voxelParams) return 0;
        return Math.max(...this.voxels.map(v => v._p.y)) + this.voxelParams.voxelSize / 2;
    }

    MaxX() {
        if (!this.voxels || !this.voxelParams) return 0;
        return Math.max(...this.voxels.map(v => v._p.x)) + this.voxelParams.voxelSize / 2;
    }

    MaxZ() {
        if (!this.voxels || !this.voxelParams) return 0;
        return Math.max(...this.voxels.map(v => v._p.z)) + this.voxelParams.voxelSize / 2;
    }
    
    VoxelHeight() {
        if (!this.voxels || !this.voxelParams) return 0;
        return (this.MaxY() - this.MinY()) / this.voxelParams.voxelSize;
    }
}
