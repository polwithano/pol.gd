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

export default {LoadFBXMesh, LoadOBJMesh, LoadGLTFMesh}; 