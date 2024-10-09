import * as THREE from 'three';

import Engine from './engine';
import JSON from '../data/masterJSON';
import Shaders from './shadersPortfolio';

const TOGGLE_DEBUG = false; 
const WORLD_STEP_VALUE = 0.16667; 
const LOFI_RENDER_SCALE = 4; 
const CARROUSEL_TIMER = 15; 

const CAMERA_PARAMS = {
    orbitalRadius:     7,
    orbitalSpeed:   0.25,
    orbitalMinHeight:  0,
    orbitalMaxHeight:  3 
}

const GRID_PARAMS = {
    type:        "circ",
    size:            50,
    voxelSize:     0.75,
    frameSkip:        4,
    coefficientXY:   20,
    coefficientZ:     3,
    updateSpeed: 0.00002
}

export default class EngineProject extends Engine 
{
    constructor(canvasID) 
    {
        super(canvasID); 

        this.renderModeLofi = false;
        this.renderModeGrid = true;  

        this.currentProject = null; 
        this.nextProject = null; 
        this.indexProject = 0; 
    }

    // #region Initialize Methods
    Initialize() 
    {
        super.Initialize(); 
    }

    InitializeThreeJS() 
    {
        super.InitializeThreeJS(); 

        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.shadowMap.soft = false; 
        this.renderer.localClippingEnabled = true; 
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.autoClear = true;

        this.camera = new THREE.PerspectiveCamera(80, 2, 1, 1000);
        this.InitializeRenderTarget(this.renderModeLofi);

        if (TOGGLE_DEBUG) 
        {
            
        }
    }

    InitializeRenderTarget(defaultRenderMode) 
    {
        const renderScale = defaultRenderMode ? LOFI_RENDER_SCALE : 1; 
        const pixelationScale = defaultRenderMode ? 0 : 1;
        const renderPlane = new THREE.PlaneGeometry(window.innerWidth, window.innerHeight);

        this.sceneDummy = new THREE.Scene(); 
        this.cameraDummy = new THREE.OrthographicCamera(
            window.innerWidth / -2, 
            window.innerWidth / 2, 
            window.innerHeight / 2, 
            window.innerHeight / -2, 
            -10000, 
            10000
        );
        this.cameraDummy.position.z = 1; 

        this.renderTarget = new THREE.WebGLRenderTarget( 
            Math.floor(window.innerWidth / renderScale),
            Math.floor(window.innerHeight / renderScale),
            { 
                minFilter: THREE.NearestFilter, 
                magFilter: THREE.NearestFilter, 
                format: THREE.RGBAFormat 
            }
        );

        this.renderTarget.depthTexture = new THREE.DepthTexture();
        this.renderTarget.depthTexture.type = THREE.UnsignedShortType;
        
        const pixelationMaterial = Shaders.PixelationMaterial(this.renderTarget)
        const edgeDetectionMaterial = Shaders.EdgeDetectionMaterial(this.renderTarget, this.camera.position, pixelationScale); 

        if (this.quad != null) this.sceneDummy.remove(this.quad); 
        this.quad = new THREE.Mesh(renderPlane, pixelationMaterial);
        this.quad.position.z = -1000;

        if (this.outlineQuad != null) this.sceneDummy.remove(this.outlineQuad); 
        this.outlineQuad = new THREE.Mesh(renderPlane, edgeDetectionMaterial);
        this.outlineQuad.position.z = -1000; 

        this.sceneDummy.add(this.quad);
        this.sceneDummy.add(this.outlineQuad); 
    }

    async InitializeLogic() 
    {
        super.InitializeLogic(); 
    }
    // #endregion

    // #region Projects Methods
    
    // #endregion
}