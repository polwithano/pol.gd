import * as THREE from 'three';
import CannonDebugger from 'cannon-es-debugger'; 

export default class Engine 
{
    constructor(canvasID) 
    {
        this.clock = new THREE.Clock(); 
        this.canvasID = canvasID; 
        this.isRunning = true; 
        this.animationFrameID = null; 
        this.toggleDebug = false; 

        this.buttons = []; 
    }

    // #region Initialize Methods
    Initialize() 
    {
        this.InitializeThreeJS();
        this.DefineListeners(); 
        this.AddEventListeners(); 
        this.InitializeDebug(); 
        this.CreateButtons();

        this.renderer.debug.checkShaderErrors = true;
    }

    InitializeThreeJS() 
    {
        this.renderer = new THREE.WebGLRenderer({antialias: true, alpha: true, canvas: document.querySelector(this.canvasID)});
        this.scene = new THREE.Scene(); 
    }

    InitializeDebug() 
    {
        if (this.toggleDebug) 
        {
            this.debugAxes = new THREE.AxesHelper(50);
            this.scene.add(this.debugAxes); 

            this.cannonDebugger = new CannonDebugger(this.scene, this.world); 
        }
        else 
        {
            this.scene.remove(this.debugAxes); 
            this.debugAxes = null; 

            //this.cannonDebugger.destroy(); 
        }
    }

    InitializeGame() 
    {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x000000); 
    }

    CreateButtons() {}
    // #endregion

    GameLoop() 
    {
        if (!this.isRunning) return; 
        this.HandleWindowResize(); 

        this.animationFrameID = requestAnimationFrame(() => this.GameLoop());

        if (this.toggleDebug) this.cannonDebugger.update();
        this.camera.updateMatrixWorld(); 
    }
    
    // #region Events Listeners
    DefineListeners() {}
    AddEventListeners() 
    {
        this.handleResize = this.HandleWindowResize.bind(this); 
        window.addEventListener('resize', this.handleResize);
    }
    RemoveEventListeners() 
    {
        window.removeEventListener('resize', this.handleResize); 
    }

    IsButton(event) 
    {
        const clickedButton = event.target.closest('.buttons'); 
        if (clickedButton) return true; 
        else return false; 
    }
    // #endregion

    Reset() 
    {
        this.DestroyButtons(); 
        this.Initialize(this.canvasID); 
    }

    Destroy() 
    {
        this.isRunning = false;

        if (this.animationFrameID !== null) 
        {
            cancelAnimationFrame(this.animationFrameID); // Cancel the animation frame
        } 

        this.DestroyButtons(); 
        this.RemoveEventListeners();
        
        this.renderer.clear(); 
        this.renderer.domElement.addEventListener('dblclick', null, false); //Remove listener to render

        this.renderer = null; 
        this.scene = null;
        this.world = null; 
        this.camera = null; 
    }

    DestroyButtons() 
    {
        if (this.buttons != null && this.buttons.length > 0) 
        {
            for (let i = 0; i < this.buttons.length; i++) 
            {
                const button = this.buttons[i];
                button.Remove(); 
            }
            this.buttons = []; 
        }
    }

    Empty(element) 
    {
        while (element.lastChild) elem.removeChild(element.lastChild);
    }

    HandleWindowResize() 
    {
        const canvas = this.renderer.domElement; 
        const width = canvas.clientWidth; 
        const height = canvas.clientHeight;

        if (canvas.width != width || canvas.height != height) 
        {
            // Update the size of the renderer and camera
            let scale = window.devicePixelRatio;
            this.renderer.setSize(width / scale, height / scale, true); 
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();

            console.log('Canvas Size:', canvas.clientWidth, canvas.clientHeight);
            console.log('Renderer Size:', this.renderer.width, this.renderer.height);
            console.log('Camera Aspect Ratio:', this.camera.aspect);
        }
    }
}