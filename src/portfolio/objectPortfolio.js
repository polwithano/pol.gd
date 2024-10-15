import * as THREE from 'three';

import Helpers from '../helpers';
import Loader from '../loader';
import PROJECTS from '../ledgers/projects';
import Voxel from '../voxel';

export default class ObjectPortfolio 
{
    constructor(objectMethod = "Create", jsonPath = null, glbPath = null, defaultParams = null)
    {
        this.objectMethod = objectMethod;

        // Project-Related Data
        this.data = []; 
        this.metadata = []; 
        this.content = []; 
        this.assets = []; 

        // Model-Related Data
        this.originalMesh = null;
        this.voxelizedMesh = null;
        this.voxelMetadata = [];
        this.voxelParams = [];
        this.meshes = [];
        this.voxels = [];

        this.voxelStartAnimationOver = false;
        this.voxelAnimationInitialized = false;  

        this.jsonPath = jsonPath;
        this.glbPath = glbPath;
        this.defaultParams = defaultParams; 

        // Rotation tracking variables
        this.isDragging = false;
        this.initialMouseX = 0;
        this.initialMouseY = 0;
        this.rotationSpeed = 0.01;  // Control how sensitive the rotation is to mouse movement
        this.rotationLimit = Math.PI / 1;  // Rotation limits

        // Inertia-related variables
        this.currentRotationX = 0; // Actual current rotation X
        this.currentRotationY = 0; // Actual current rotation Y
        this.targetRotationX = 0;  // Target rotation X
        this.targetRotationY = 0;  // Target rotation Y
        this.velocityX = 0;        // Velocity for X rotation
        this.velocityY = 0;        // Velocity for Y rotation
        this.dampingFactor = 0.01;  // Damping factor to smooth the movement
    }

    async Load() 
    {
        if (this.objectMethod == "Create") await this.CreateObject();
        else if (this.objectMethod == "Load") await this.LoadObject();
        return this;
    }

    async LoadObject() 
    {
        await this.LoadJsonData(this.jsonPath);

        this.voxelizedMesh = await Voxel.GetVoxelGeometry(this.voxelParams, this.voxels.length);
        Voxel.RecreateInstancedVoxelMesh(this.voxelizedMesh, this.voxels);

        //await this.LoadCompliantOriginalModel();

        Helpers.CloneMeshMaterials(this.voxelizedMesh);
        //Helpers.CloneMeshMaterials(this.originalMesh);

        this.voxelizedMesh.castShadow = true;
        this.voxelizedMesh.receiveShadow = true;
        this.voxelizedMesh.frustumCulled = false; 

        this.UpdateInertia(); 
    }

    async LoadJsonData(projectName) 
    {
        try 
        {
            this.data = await PROJECTS.LoadProjectData(projectName);
            
            const project_data = this.data.project; 
            const voxel_data = this.data.voxel; 
    
            this.metadata = project_data.metadata;
            this.content = project_data.content;   
    
            this.voxelMetadata = voxel_data.metadata; 
            this.voxelParams = voxel_data.params;
            this.voxels = voxel_data.voxels;
        }
        catch (error) 
        {
            console.error("Failed to import JSON:", error);
        }
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

    OnDragStart(clientX, clientY) {
        this.isDragging = true;
        this.initialMouseX = clientX;
        this.initialMouseY = clientY;
    }

    OnDrag(clientX, clientY) {
        if (this.isDragging) {
            // Calculate the target rotation based on mouse movement
            const deltaX = (clientX - this.initialMouseX) * this.rotationSpeed;
            const deltaY = (clientY - this.initialMouseY) * this.rotationSpeed;

            // Set the target rotations
            this.targetRotationX += deltaY;
            this.targetRotationY += deltaX;

            // Limit the rotations
            this.targetRotationX = Math.max(-this.rotationLimit, Math.min(this.rotationLimit, this.targetRotationX));
            this.targetRotationY = Math.max(-this.rotationLimit, Math.min(this.rotationLimit, this.targetRotationY));

            // Reset mouse positions for the next frame
            this.initialMouseX = clientX;
            this.initialMouseY = clientY;
        }
    }

    OnDragEnd() {
        this.isDragging = false;
    }

    UpdateInertia() {
        // Apply damping to smooth the rotation
        this.velocityX += (this.targetRotationX - this.currentRotationX) * this.dampingFactor;
        this.velocityY += (this.targetRotationY - this.currentRotationY) * this.dampingFactor;

        // Update the current rotation by applying velocity
        this.currentRotationX += this.velocityX;
        this.currentRotationY += this.velocityY;

        // Slowly reduce the velocity over time (damping effect)
        this.velocityX *= 0.9;  // You can tweak the value to make it feel more responsive or sluggish
        this.velocityY *= 0.9;

        // Apply the actual rotation to the mesh
        if (this.voxelizedMesh) {
            this.voxelizedMesh.rotation.x = this.currentRotationX;
            this.voxelizedMesh.rotation.y = this.currentRotationY;
        }

        // Request the next animation frame to keep updating
        requestAnimationFrame(() => this.UpdateInertia());
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
