import * as THREE from 'three';

import gsap from 'gsap';

const CAMERA_PARAMS = {
    orbitalRadius:     7,
    orbitalSpeed:   .125,
    orbitalMinHeight:  0,
    orbitalMaxHeight:  3 
}

export default class CameraProject
{
    constructor(camera) 
    {
        this.camera = camera; 
        this.currentLookAt = new THREE.Vector3(); 
        this.currentTime = 0; 

        this.canRotate = true; 
    }

    Initialize(project) 
    {
        const x = CAMERA_PARAMS.orbitalRadius * Math.sin((0) * CAMERA_PARAMS.orbitalSpeed);
        const z = CAMERA_PARAMS.orbitalRadius * Math.cos((0) * CAMERA_PARAMS.orbitalSpeed);
        const lookAtY = project.MaxY() / 2;

        // Set the camera's initial position
        this.camera.position.set(x, (CAMERA_PARAMS.orbitalMinHeight + CAMERA_PARAMS.orbitalMaxHeight) / 2, z);
        this.currentLookAt.set(project.voxelizedMesh.position.x, lookAtY, project.voxelizedMesh.position.z);
        // Set the camera to look at the initial position of the target object
        this.camera.lookAt(this.currentLookAt);        
    }

    Update(delta) 
    {
        if (!this.canRotate) return; 
        
        this.currentTime += delta; 
        
        const elapsedTime = this.currentTime * CAMERA_PARAMS.orbitalSpeed; 
        const x = CAMERA_PARAMS.orbitalRadius * Math.sin((elapsedTime) * CAMERA_PARAMS.orbitalSpeed);
        const z = CAMERA_PARAMS.orbitalRadius * Math.cos((elapsedTime) * CAMERA_PARAMS.orbitalSpeed);

        const midpointY = (CAMERA_PARAMS.orbitalMinHeight + CAMERA_PARAMS.orbitalMaxHeight) / 2;
        const amplitudeY = (CAMERA_PARAMS.orbitalMinHeight - CAMERA_PARAMS.orbitalMaxHeight) / 2;
        const frequency = 2; 
        const y = midpointY + amplitudeY * Math.sin(frequency * elapsedTime);

        this.camera.position.set(x, y, z);
        this.camera.lookAt(this.currentLookAt);
    }

    ProjectTransition(lookAt, duration) 
    {
        gsap.to(this.currentLookAt, 
        {
            y: lookAt,
            duration: duration,
            ease: "power2.inOut"
        });
    }
}