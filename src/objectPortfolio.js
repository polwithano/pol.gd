import * as THREE from 'three';
import * as CANNON from 'cannon';
import Helpers from './helpers';  
import Loader from './loader'; 
import Voxel from './voxel'; 

export class ObjectMethod 
{
    static Load = new ObjectMethod("Load"); 
    static Create = new ObjectMethod("Create"); 

    constructor(name) {this.name = name;}
    toString() {return `ObjectMethod.${this.name}`;}
}

export default class ObjectPortfolio 
{
    constructor(objectMethod, jsonPath = null, glbPath = null, defaultParams = null)
    {
        this.metadata = [];
        this.metadataPorfolio = []; 
        this.projectData = []; 
        this.originalMesh = null;

        // Voxel Object
        this.params = [];
        this.meshes = [];
        this.voxels = [];
        this.voxelizedMesh = null;

        this.voxelStartAnimationOver = false;
        this.voxelAnimationInitialized = false;  

        this.objectMethod = objectMethod;
        this.jsonPath = jsonPath;
        this.glbPath = glbPath;
        this.defaultParams = defaultParams; 
    }

    async load() 
    {
        if (this.objectMethod === ObjectMethod.Create.name) 
        {
            await this.CreateObject();
        } 
        else if (this.objectMethod === ObjectMethod.Load.name) 
        {
            await this.LoadObject();
        }
        return this;
    }

    async LoadObject() 
    {
        await this.LoadJsonData(this.jsonPath);

        this.voxelizedMesh = await Voxel.GetVoxelGeometry(this.params, this.voxels.length);
        Voxel.RecreateInstancedVoxelMesh(this.voxelizedMesh, this.voxels);

        await this.LoadCompliantOriginalModel();

        Helpers.CloneMeshMaterials(this.voxelizedMesh);
        Helpers.CloneMeshMaterials(this.originalMesh);

        this.voxelizedMesh.castShadow = true;
        this.voxelizedMesh.receiveShadow = false;
        this.voxelizedMesh.frustumCulled = false; 
    }

    async LoadJsonData(json) 
    {
        const response = await fetch(json);
        const data = await response.json();

        this.metadata = data.metadata;
        this.metadataPorfolio = data.portfolioMetadata
        this.params = data.params;
        this.projectData = data.projectData; 
        this.voxels = data.voxels;
    }

    async LoadCompliantOriginalModel() 
    {
        const model = await Loader.LoadGLTFMesh(this.metadata.originalMeshPath);

        let boundingBox = new THREE.Box3().setFromObject(model);
        const size = boundingBox.getSize(new THREE.Vector3());
        const scaleFactor = this.params.modelSize / size.length();
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
        if (!this.voxels || !this.params) return 0;
        return Math.min(...this.voxels.map(v => v.position.y)) - this.params.boxSize / 2;
    }

    MinX() {
        if (!this.voxels || !this.params) return 0;
        return Math.min(...this.voxels.map(v => v.position.x)) - this.params.boxSize / 2;
    }

    MinZ() {
        if (!this.voxels || !this.params) return 0;
        return Math.min(...this.voxels.map(v => v.position.z)) + this.params.boxSize / 2;
    }
    
    MaxY() {
        if (!this.voxels || !this.params) return 0;
        return Math.max(...this.voxels.map(v => v.position.y)) + this.params.boxSize / 2;
    }

    MaxX() {
        if (!this.voxels || !this.params) return 0;
        return Math.max(...this.voxels.map(v => v.position.x)) + this.params.boxSize / 2;
    }

    MaxZ() {
        if (!this.voxels || !this.params) return 0;
        return Math.max(...this.voxels.map(v => v.position.z)) + this.params.boxSize / 2;
    }
    
    VoxelHeight() {
        if (!this.voxels || !this.params) return 0;
        return (this.MaxY() - this.MinY()) / this.params.boxSize;
    }
}
