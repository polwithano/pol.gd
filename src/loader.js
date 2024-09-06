import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

async function LoadFBXMesh(meshPath) 
{
    return new Promise((resolve, reject) => {
        const loader = new FBXLoader(); 
        loader.load(
            meshPath,
            (object) => {
                resolve(object);  // Resolve the promise with the loaded object
            },
            (xhr) => {
                console.log((xhr.loaded / xhr.total * 100) + '% loaded');
            },
            (error) => {
                console.error('An error happened while loading the FBX model:', error);
                reject(error);  // Reject the promise if there's an error
            }
        );
    });
}

async function LoadOBJMesh(meshPath) {
    return new Promise((resolve, reject) => {
        const loader = new OBJLoader();
        loader.load(
            meshPath,
            (object) => {
                resolve(object);  // Resolve the promise with the loaded object
            },
            (xhr) => {
                console.log((xhr.loaded / xhr.total * 100) + '% loaded');
            },
            (error) => {
                console.error('An error happened while loading the OBJ model:', error);
                reject(error);  // Reject the promise if there's an error
            }
        );
    });
}

async function LoadGLTFMesh(meshPath) {
    return new Promise((resolve, reject) => {
        const loader = new GLTFLoader();
        loader.load(
            meshPath,
            (gltf) => {
                const object = gltf.scene;  // Access the loaded scene
                resolve(object);  // Resolve the promise with the loaded object
            },
            (xhr) => {
                console.log((xhr.loaded / xhr.total * 100) + '% loaded');
            },
            (error) => {
                console.error('An error happened while loading the GLTF model:', error);
                reject(error);  // Reject the promise if there's an error
            }
        );
    });
}

function CreateVoxelDataFiles(voxelObject, voxelParams, projectName, modelName) 
{
    if (!voxelObject.voxels || voxelObject.voxels.length === 0) 
    {
        console.warn("No voxel data available to save.");
        return;
    }

    const voxelMetadata = {
        modelName: modelName, 
        author: "author", 
        modelLink: "https://google.com",
        originalMeshFolder: "../meshes/",
        originalMeshPath: "",
        startingRotation: "0"
    };
    voxelMetadata.originalMeshPath = voxelMetadata.originalMeshFolder + voxelMetadata.modelName + ".glb";

    const voxelData = {
        metadata: voxelMetadata,
        params: voxelParams,
        voxels: voxelObject.voxels
    }

    const voxelJsonName = `${projectName}_voxel.json`;
    const voxelJson = JSON.stringify(voxelData, null, 0); 
    DownloadJsonFile(voxelJson, voxelJsonName, "application/json");
}

function CreateProjectDataFiles(voxelObject, voxelParams, projectName, modelName) 
{
    const voxelPath = "../data/voxels/" + projectName + "_voxel.json";
    const projectMetadata = {
        tag: "video game",
        projectName: projectName, 
        companyName: "companyName",
        yearString: "1970",
        yearID: "1970", 
        tasks: "tasksList", 
        description: "A short description of the project.",
        isFavorite: false,
        voxelPath: voxelPath,
        gradientBackground : ["#000000", "#2B2B2B", "#FFFFFF"], 
        gradientGrid : ["#000000", "#2B2B2B", "#FFFFFF"],
    }

    const projectContent = DefaultProjectContent(projectName);

    const projectData = {
        metadata: projectMetadata,
        content: projectContent
    }
    

    const projectJsonName = `${projectName}_data.json`;
    const projectJson = JSON.stringify(projectData, null, 2); 
 
    DownloadJsonFile(projectJson, projectJsonName, "application/json"); 
    CreateVoxelDataFiles(voxelObject, voxelParams, projectName, modelName); 
}

function DefaultProjectContent(projectName) 
{
    const projectData = 
    {
        title: projectName, 
        tagline: "Project Tagline", 
        background: "media/placeholder-image.jpg",
        icons: [
        {
            name: "Name", 
            image: "media/portfolio-icons/unreal.png"
        },
        {
            name: "Name", 
            image: "media/portfolio-icons/unreal.png"
        },
        {
            name: "Name", 
            image: "media/portfolio-icons/unreal.png"
        }],
        sections: [
            {
                type: "category", 
                content: 
                {
                    title: "Description"
                }
            },
            { type: "spacer" },
            {
                type: "text-image",
                content: {
                    paragraph: "This is a paragraph.", 
                    image: {
                        src: "media/placeholder-image.jpg", 
                        alt: "project image", 
                        position: "left"
                    }
                }
            },
            { type: "spacer" },
            {
                type: "text-image",
                content: {
                    paragraph: "This is a paragraph.", 
                    image: {
                        src: "media/placeholder-image.jpg", 
                        alt: "project image", 
                        position: "right"
                    }
                }
            },
            { type: "spacer" },
            {
                type: "video",
                content: {
                    videoId: "dQw4w9WgXcQ",
                    caption: "This is a caption for the video."
                }
            },
            { type: "spacer"}
            ],
        download: {
            url: "https://github.com/polwithano", 
            label: "Git Repository"
        }
    }    
    
    return projectData;
}

function DownloadJsonFile(content, fileName, contentType) 
{
    const a = document.createElement("a");
    const file = new Blob([content], { type: contentType });
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    a.click();
}

export default {LoadFBXMesh, LoadOBJMesh, LoadGLTFMesh, CreateVoxelDataFiles, CreateProjectDataFiles}; 