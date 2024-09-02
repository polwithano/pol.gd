import * as THREE from 'three'; 
import * as CANNON from 'cannon';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GUI } from 'dat.gui'
import gsap from 'gsap';
import Stats from 'three/addons/libs/stats.module.js';

import Engine from './engine'; 
import HelpersBackground from './helpersBackground';
import Helpers from './helpers'; 
import Voxel from './voxel'; 
import ObjectPortfolio from './objectPortfolio';
import { SimplexNoise } from 'three/examples/jsm/Addons.js';

/* ENGINE STATES CONST */
const worldStepValue = 1/60;
const DEFAULT_RENDER_SCALE = 1; 
const LOFI_RENDER_SCALE = 4;  

// Define the parameters for the camera's orbit
const orbitRadius = 8;  // Distance from the object
const orbitSpeed = .1; // Speed of the rotation
const orbitHeight = 1;   // Height of the camera relative to the object

const xyCoef = 8; 
const zCoef = 2; 

const defaultParams = 
{
    gridSize: .1,
    modelSize: 10,
    boxSize : .1,
    boxRoundness: .025
};

const usesJson = true; 
const glbPath = "../meshes/Airplane.glb";
const projectDataPathArray = 
[
    '../data/Airplane_data.json',
    '../data/Spaceship_data.json',
    '../data/Spaceship_data.json',
    '../data/Spaceship_data.json',
    '../data/Spaceship_data.json',
]

export default class EnginePortfolio extends Engine 
{
    constructor(canvasID) 
    {
        super(canvasID) 

        this.mouseDownListener = (event) => this.OnRightMouseDown(event);
        this.mouseUpListener = (event) => this.OnRightMouseUp(event);
        this.mouseMoveListener = (event) => this.OnMouseMove(event);
        this.keyDownListener = (event) => this.OnKeyDown(event); 

        this.composer = null; 
        this.currentPFObject = null; 
        this.nextPFObject = null; 
        this.clippingPlane = null; 
        this.currentProjectIndex = 0; 
        this.canSwitchObject = true; 
        this.useJsonData = usesJson;  
        this.canRotateCamera = true; 
        this.animationStartTime = 0; 

        this.defaultJsonPath = projectDataPathArray[this.currentProjectIndex]; 

        this.simplex = new SimplexNoise(); 
        this.gridMinY = Infinity;
        this.gridMaxY = -Infinity;
        this.gridSize = 0.5; 

        this.Initialize(); 
        this.GameLoop(this.currentTimestamp); 
        this.SetupEventListeners(); 
    }

    // #region Initialize Methods
    Initialize() 
    {
        super.Initialize();

        this.InitializeCannon();
        if (!this.useJsonData) this.InitializeGUI();   
        this.InitializeGame(); 
    }

    InitializeThreeJS() 
    {
        super.InitializeThreeJS(); 

        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.shadowMap.soft = false; 
        this.renderer.localClippingEnabled = true; 

        this.camera = new THREE.PerspectiveCamera(
            80,
            2,
            0.0001,
            100000
        );

        this.dummyCamera = new THREE.OrthographicCamera(
            window.innerWidth  / -2, 
            window.innerWidth   / 2, 
            window.innerHeight  / 2, 
            window.innerHeight / -2,
            - 10000, 
            10000
        );
        this.dummyCamera.position.z = 1; 
        this.dummyScene = new THREE.Scene(); 
        this.rtTexture = new THREE.WebGLRenderTarget( 
            Math.floor(window.innerWidth / LOFI_RENDER_SCALE), //resolution x
            Math.floor(window.innerHeight / LOFI_RENDER_SCALE), //resolution y
            { 
              minFilter: THREE.LinearFilter, 
              magFilter: THREE.NearestFilter, 
              format: THREE.RGBAFormat 
            });
        this.uniforms = {
            tDiffuse: { value: this.rtTexture.texture },
            iResolution:  { value: new THREE.Vector3() },
          };
        this.materialScreen = new THREE.ShaderMaterial( {

            uniforms: this.uniforms, // rtTexture = material from perspective camera
            vertexShader: document.getElementById( 'vertexShader' ).textContent,
            fragmentShader: document.getElementById( 'fragment_shader_screen' ).textContent,
            depthWrite: false
        
        });
        this.renderPlane = new THREE.PlaneGeometry( window.innerWidth, window.innerHeight );
        let quad = new THREE.Mesh(this.renderPlane, this.materialScreen);
        quad.position.z = -100; 
        this.dummyScene.add(quad); 

        this.renderer.setSize( window.innerWidth, window.innerHeight );
        this.renderer.autoClear = true;

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);

        this.stats = new Stats();  
        document.getElementById('canvas-container').appendChild(this.stats.dom);

        // Change the position and top/left of the stats panel
        this.stats.dom.style.position = 'relative';  // Make sure it's positioned relative to its parent
        this.stats.dom.style.top = null;
        this.stats.dom.style.right = null; 
        this.stats.dom.style.bottom = '90%';
        this.stats.dom.style.left = '0%';          // Set the left position relative to the parent container
    }

    InitializeCannon() 
    {
        this.world = new CANNON.World();
        this.world.gravity.set(0, -9.81, 0); // Set gravity to zero initially
    }

    async InitializeGame() 
    {
        super.InitializeGame(); 

        this.camera.position.set(0, 1, 0); // Adjust the position as needed
        this.camera.lookAt(0, 1, 0);

        this.controls.mouseButtons = 
        {
            MIDDLE: THREE.MOUSE.ROTATE
        }

        // Directional light setup
        this.directionalLight = new THREE.DirectionalLight(0xffffff, 4);
        this.directionalLight.position.set(10, 10, 10); 

        // Enable shadows
        this.directionalLight.castShadow = true;

        // Configure shadow map size for better resolution
        this.directionalLight.shadow.mapSize.width = 2048;
        this.directionalLight.shadow.mapSize.height = 2048;

        // Adjust shadow bias to minimize artifacts
        this.directionalLight.shadow.bias = -0.005; // Start with a small negative value
        this.directionalLight.shadow.normalBias = 0.02;  // Adjust based on your model

        // Adjust shadow camera settings for more precise shadows
        this.directionalLight.shadow.camera.near = 10;
        this.directionalLight.shadow.camera.far = 100;
        this.directionalLight.shadow.camera.left = -20;
        this.directionalLight.shadow.camera.right = 20;
        this.directionalLight.shadow.camera.top = 20;
        this.directionalLight.shadow.camera.bottom = -20;

        // Add the light to the scene
        this.scene.add(this.directionalLight);
        this.scene.fog = new THREE.Fog(0x2B2B2B, 0.5, 45); 

        this.canvas = document.createElement('canvas');
        this.context = this.canvas.getContext('2d', {willReadFrequently: true});
        this.canvas.width = 512;
        this.canvas.height = 512;

        Helpers.CreateCarouselDots(projectDataPathArray.length, this.currentProjectIndex);

        //this.planeBuffer = Helpers.CreatePlaneBufferGeometry(100, 40); 
        //this.scene.add(this.planeBuffer); 

        if (this.useJsonData) 
        {
            try 
            {
                this.currentPFObject = new ObjectPortfolio("Load", this.defaultJsonPath);
                
                // Load the object asynchronously
                await this.currentPFObject.load();

                this.gradientTexture = HelpersBackground.CreateMultiGradientTexture(this.currentPFObject.metadata.gradient, this.context, this.canvas);
                //this.gradientTexture = HelpersBackground.CreateCheckerboardTexture(this.currentPFObject.metadata.gradientStart, this.currentPFObject.metadata.gradientEnd, 2, 2, this.context, this.canvas); 
                //this.gradientTexture = HelpersBackground.CreateChartPieTexture(this.currentPFObject.metadata.gradientStart, this.currentPFObject.metadata.gradientEnd, 24, this.context, this.canvas); 

                this.scene.background = this.gradientTexture; 
                this.voxelGrid = Voxel.CreateVoxelGrid(100, 100, this.gridSize); 
                this.scene.add(this.voxelGrid);
                this.voxelGrid.receiveShadow = true;  
        
                // Ensure that the meshes are not null
                if (this.currentPFObject.voxelizedMesh) 
                {
                    /*
                    this.clippingPlane1 = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
                    this.clippingPlane1.constant = this.currentPFObject.MaxY();
                    this.clippingPlane2 = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
                    this.clippingPlane2.constant = this.currentPFObject.MinY();
        
                    Helpers.AddClippingPlaneToMaterials(this.currentPFObject.originalMesh, this.clippingPlane1);
                    Helpers.AddClippingPlaneToMaterials(this.currentPFObject.voxelizedMesh, this.clippingPlane2);
                    */

                    //this.scene.add(this.currentPFObject.originalMesh);
                    this.shadowPlane = Helpers.CreateShadowPlane(this.currentPFObject.MinY());
                    this.reflectorPlane = Helpers.CreateReflectorPlane(this.currentPFObject.MinY());

                    this.currentPFObject.voxelizedMesh.position.x = 0;
                    this.currentPFObject.voxelizedMesh.position.z = 0; 

                    Helpers.AnimateVoxels(this.currentPFObject, 20);
                    this.InitializeCamera(); 

                    //this.scene.add(this.shadowPlane);
                    //this.scene.add(this.reflectorPlane); 
                    this.scene.add(this.currentPFObject.voxelizedMesh);

                    this.InitializeHTML(); 
                    this.RenderProjectPage(this.currentPFObject.projectData); 
                }
                else 
                {
                    console.error('Meshes are not loaded correctly.');
                }
            } 
            catch (error) 
            {
                console.error('Failed to load JSON:', error);
            }
        }
        else 
        {
            try 
            {
                this.currentPFObject = new ObjectPortfolio("Create", this.defaultJsonPath, glbPath, defaultParams);

                await this.currentPFObject.load();

                if (this.currentPFObject.originalMesh && this.currentPFObject.voxelizedMesh) 
                {
                    this.scene.add(this.currentPFObject.voxelizedMesh);
                    //this.scene.add(this.currentPFObject.originalMesh); 
                }
                else 
                {
                    console.error('Meshes are not loaded correctly.');
                }
            } 
            catch (error) 
            {
                console.error('Failed to create ObjectPortfolio:', error);
            }
        }
    }

    InitializeHTML() 
    {
        const portfolioMetadata = this.currentPFObject.metadataPorfolio;
        const metadata = this.currentPFObject.metadata; 

        document.getElementById('project-name').textContent = portfolioMetadata.projectName;
        document.getElementById('company-name').textContent = portfolioMetadata.companyName;
        document.getElementById('author-name').textContent = portfolioMetadata.yearString;
        document.getElementById('project-year').textContent = portfolioMetadata.tasks;
        document.getElementById('project-description').textContent = portfolioMetadata.description;
        document.getElementById('copyright-model').textContent = "© Model • " + metadata.author; 
    }

    InitializeGUI() 
    {
        this.gui = new GUI();  // Create a new GUI instance

        // Add parameters to the GUI
        this.gui.add(defaultParams, 'gridSize', 0.1, 10).name('Grid Size').onChange(this.UpdateVoxelization.bind(this));
        this.gui.add(defaultParams, 'modelSize', 1, 100).name('Model Size').onChange(this.UpdateVoxelization.bind(this));
        this.gui.add(defaultParams, 'boxSize', 0.1, 5).name('Box Size').onChange(this.UpdateVoxelization.bind(this));
        this.gui.add(defaultParams, 'boxRoundness', 0, 1).name('Box Roundness').onChange(this.UpdateVoxelization.bind(this));

        const metadata = {
            modelName: "modelName", 
            author: "author", 
            originalMeshFolder: "../meshes/",
            originalMeshPath: "",
            gradient: ["#000000", "#2B2B2B", "#FFFFFF"]
        };

        const portfolioMetadata = 
        {
            projectName: "projectName", 
            companyName: "companyName",
            yearString: "1970",
            yearID: "1970", 
            tasks: "tasksList", 
            description: "A short description of the project.",
            isFavorite: false
        }

        const projectData = Helpers.GenericProjectData(); 

        this.gui.add(metadata, 'modelName').name('Model Name');
        this.gui.add(metadata, 'author').name('Author');
        this.gui.add(metadata, 'originalMeshFolder').name('Mesh Folder');

        this.gui.add({save: () => Voxel.SaveVoxelData(this.currentPFObject, metadata, portfolioMetadata, defaultParams, projectData) }, 'save').name('Save Voxel Data');
    }

    SetupEventListeners() 
    {
        const projectDescription = document.getElementById('project-description');
        const projectContainer = document.getElementById('project-container'); 
        
        projectDescription.addEventListener('mouseenter', () => {
            projectDescription.classList.add('hovered');
            projectContainer.classList.add('visible');
            projectContainer.classList.remove('hidden'); 
        });
    
        projectContainer.addEventListener('mouseleave', () => {
            projectDescription.classList.remove('hovered');
            projectContainer.classList.remove('visible');
            projectContainer.classList.add('hidden');
        });
    
        document.querySelectorAll('.folder-header').forEach(header => {
            header.addEventListener('click', (event) => {
                const target = event.target.closest('.folder-header');
                const folderId = target.getAttribute('data-folder-id');
                console.log(`Folder ID: ${folderId}`);
                this.ToggleFolder(folderId);
            });
        });
    }    

    // Method to update voxelization with new params
    UpdateVoxelization() 
    {
        this.scene.clear();  // Clear existing scene objects
        this.InitializeGame();  // Reinitialize the scene with updated parameters
    }
    // #endregion

    // #region Listeners
    DefineListeners() 
    {
        super.DefineListeners(); 

        this.mouseDownListener = (event) => {
            if (!this.IsButton(event)) 
            {
                if (event.button == 0) 
                {
                    this.OnRightMouseDown(event); 
                }
            }
        }; 

        this.mouseUpListener = (event) =>  {
            if (!this.IsButton(event)) 
            {
                if (event.button == 0) 
                {
                    this.OnRightMouseUp(event); 
                }
            }
        }; 

        this.mouseMoveListener = (event) =>  
        {
            this.OnMouseMove(event); 
        }; 

        this.keyDownListener = event => 
        {
            if (this.useJsonData) this.OnKeyDown(event); 
        }
    }

    AddEventListeners() 
    {
        super.AddEventListeners(); 

        // Add new event listeners to the buttons using stored references
        document.addEventListener('mousedown', this.mouseDownListener);    
        document.addEventListener('mouseup', this.mouseUpListener); 
        document.addEventListener('mousemove', this.mouseMoveListener); 

        document.addEventListener('keydown', this.keyDownListener); 
    }

    RemoveEventListeners() 
    {
        super.RemoveEventListeners(); 

        // Remove existing event listeners for the buttons using stored references
        document.removeEventListener('mousedown', this.mouseDownListener);
        document.removeEventListener('mouseup', this.mouseUpListener);
        document.removeEventListener('mousemove', this.mouseMoveListener);

        document.removeEventListener('keydown', this.keyDownListener); 
    }
    // #endregion

    // #region Mouse Events
    OnRightMouseDown(event) 
    {

    }

    OnRightMouseUp(event) 
    {

    }

    OnMouseMove(event) 
    {
        this.mouseX = event.clientX; 
        this.mouseY = event.clientY;

        if (this.currentPFObject && this.clippingPlane1 && this.clippingPlane2) 
        {
            const margin = 0.33;
            const heightMargin = window.innerHeight * margin;
            let mouseY = 0;  
            
            if (event.clientY >= heightMargin & event.clientY <= window.innerHeight - heightMargin) 
            {
                mouseY = (event.clientY - heightMargin) / (window.innerHeight - heightMargin * 2); // This gives a value between 0 and 1
            }
            else if (event.clientY < heightMargin) 
            {
                mouseY = 0;
            }
            else if (event.clientY >= window.innerHeight - heightMargin) 
            {
                mouseY = 1; 
            }

            this.UpdateClippingPlanes(mouseY); 
        }

        const darkOverlay = document.getElementById('darkOverlay');
        
        if (event.clientY >= window.innerHeight / 2) 
        {
            const opacity = (event.clientY / (window.innerHeight)) - 0.2;
            darkOverlay.style.opacity = 0;
        }
        else 
        {
            // Ensure the overlay is invisible if the mouse is below the middle
            darkOverlay.style.opacity = 0;
        }
    }

    OnKeyDown(event) 
    {
        if (event.key === 'ArrowLeft') this.SwitchToPreviousObject(); 
        else if (event.key === 'ArrowRight') this.SwitchToNextObject();
    }

    async SwitchToPreviousObject() 
    {
        if (!this.canSwitchObject) return; 
        if (this.currentProjectIndex > 0) 
        {
            this.currentProjectIndex--;
            await this.SwitchObject(-1, 0.5); 
        }
    }

    async SwitchToNextObject() 
    {
        if (!this.canSwitchObject) return; 
        if (this.currentProjectIndex < projectDataPathArray.length - 1) 
        {
            this.currentProjectIndex++;
            await this.SwitchObject(1, 0.5); 
        } 
    }

    async SwitchObject(direction, duration) 
    {
        this.canSwitchObject = false; 
        this.canRotateCamera = false; 
    
        // Load the next portfolio object
        this.nextPFObject = new ObjectPortfolio("Load", projectDataPathArray[this.currentProjectIndex]);
        await this.nextPFObject.load();

        this.SmoothGradientTransition(this.currentPFObject.metadata.gradient, this.nextPFObject.metadata.gradient, duration);
    
        // Calculate the camera's left and right direction vectors
        const cameraDirection = new THREE.Vector3();
        this.camera.getWorldDirection(cameraDirection);
        
        // Calculate the perpendicular direction (left or right)
        let perpendicularDirection = this.camera.position.clone();
        perpendicularDirection.applyAxisAngle(this.camera.up, direction * Math.PI / 2);

        // Calculate spawn position for the new object (a bit to the left or right of the current object)
        const spawnDistance = window.innerWidth * 0.1;
        const spawnPosition = perpendicularDirection.multiplyScalar(spawnDistance);

        // Set initial position of the new object
        this.nextPFObject.voxelizedMesh.position.copy(spawnPosition);
        this.scene.add(this.nextPFObject.voxelizedMesh);
    
        // Animate the current object out of the scene
        gsap.to(this.currentPFObject.voxelizedMesh.position, {
            x: -spawnPosition.x,
            z: -spawnPosition.z,
            duration: duration, 
            ease: "power2.inOut"
        });
    
        // Animate the new object into the center of the scene
        gsap.to(this.nextPFObject.voxelizedMesh.position, {
            x: 0, y: 0, z: 0,
            duration: duration,
            ease: "power2.inOut",
            onComplete: () => {
                // Clean up old object and finalize the switch
                this.ClearPortfolioObject();
                this.currentPFObject = this.nextPFObject;
                this.currentPFObject.voxelStartAnimationOver = true; 
                this.InitializeHTML(); 
                this.canSwitchObject = true;
                this.canRotateCamera = true; 
                this.animationStartTime = 0; 
                Helpers.UpdateCarouselDots(this.currentProjectIndex);  
            }
        });
    
        // Update shadow plane (if necessary)
        gsap.to(this.shadowPlane.position, {
            y: this.nextPFObject.MinY(),
            duration: duration,
            ease: "power2.inOut"
        });
    }
    
    // #endregion 

    ClearPortfolioObject() 
    {
        if (this.currentPFObject) 
        {
            this.scene.remove(this.currentPFObject.voxelizedMesh); 
            this.scene.remove(this.currentPFObject.originalMesh);
        }
    }
    
    SmoothGradientTransition(oldGradient, newGradient, duration = 0.5) {
        duration *= 1000; // Convert seconds to milliseconds
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 512;
        canvas.height = 512;
    
        let startTime = null;
    
        // Function to interpolate between two colors
        const interpolateColor = (start, end, t) => {
            const startRGB = start.match(/\w\w/g).map(x => parseInt(x, 16));
            const endRGB = end.match(/\w\w/g).map(x => parseInt(x, 16));
            const interpolated = startRGB.map((start, i) => Math.round(start + (endRGB[i] - start) * t));
            return `#${interpolated.map(x => x.toString(16).padStart(2, '0')).join('')}`;
        };
    
        // Function to create a linear gradient on the canvas
        const createGradient = (colors) => {
            const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
            colors.forEach((color, i) => gradient.addColorStop(i / (colors.length - 1), color));
            return gradient;
        };
    
        const animate = (timestamp) => {
            if (!startTime) startTime = timestamp;
            const elapsed = timestamp - startTime;
            const t = Math.min(elapsed / duration, 1);
    
            // Interpolate colors for each stop in the gradient
            const interpolatedGradient = oldGradient.map((color, i) => {
                const newColor = newGradient[i] || oldGradient[i];
                return interpolateColor(color, newColor, t);
            });
    
            // Create gradient texture
            const gradient = createGradient(interpolatedGradient);
            context.fillStyle = gradient;
            context.fillRect(0, 0, canvas.width, canvas.height);
    
            const texture = new THREE.CanvasTexture(canvas);
            this.scene.background = texture;
    
            if (t < 1) {
                requestAnimationFrame(animate);
            }
        };
    
        requestAnimationFrame(animate);
    }

    UpdateClippingPlanes(mouseY) 
    {
        const minY = this.currentPFObject.MinY(); 
        const maxY = this.currentPFObject.MaxY();
        const voxelHeight = this.currentPFObject.VoxelHeight() + 1;
        
        // Calculate the step size based on the number of voxel layers
        const stepSize = 1 / (voxelHeight - 1);  // "-1" because we're considering intervals between layers
        
        // Snap mouseY to the nearest step
        const normalizedMouseY = Math.floor(mouseY / stepSize) * stepSize;

        const meshHeight = maxY - minY;

        const planeHeight1 = minY + normalizedMouseY * meshHeight;
        const planeHeight2 = maxY - normalizedMouseY * meshHeight;

        // Update clipping plane constants w/o Z-fighting
        this.clippingPlane1.constant = planeHeight1 + 0.0001;
        this.clippingPlane2.constant = planeHeight2 + 0.0001;
    }
    
    GameLoop() 
    {
        super.GameLoop();
        this.world.step(worldStepValue);
        this.stats.update(); 

        //this.AnimatePlane();
        if (this.useJsonData) 
        {
            this.AnimateVoxelGrid(this.voxelGrid, this.simplex, 0.00006, xyCoef, zCoef);  
            this.AnimateVoxelizedMesh();
            this.AnimateCamera(); 
            this.renderer.shadowMap.needsUpdate = true;
        }

        // 2. Render the voxelized objects at lower resolution
        this.renderer.setRenderTarget(this.rtTexture); 
        this.renderer.clear();  
        this.renderer.render(this.scene, this.camera);

        // 3. Composite the low-res voxelized render on top of the high-res background
        this.renderer.setRenderTarget(null); // render to the screen
        this.renderer.clearDepth(); // clear depth buffer so voxel render is not occluded by background
        this.renderer.render(this.dummyScene, this.dummyCamera);  
    }

    AnimateVoxelizedMesh() 
    {
        if (this.gravityEnabled) return; 

        if (this.currentPFObject != null && 
            this.currentPFObject.voxelStartAnimationOver === true && 
            this.currentPFObject.voxelAnimationInitialized === false) 
        {
            this.currentPFObject.voxelAnimationInitialized = true; 
    
            // Log initial position and rotation
            console.log("Initial Position:", this.currentPFObject.voxelizedMesh.position);
            console.log("Initial Rotation:", this.currentPFObject.voxelizedMesh.rotation);
    
            const timeline = gsap.timeline({
                repeat: -1,  // Repeat indefinitely
                yoyo: true,  // Reverses the animation each time it repeats
                ease: "none",  // Smoother easing
                onStart: () => {
                    console.log("Animation Start - Position:", this.currentPFObject.voxelizedMesh.position);
                },
                onComplete: () => {
                    console.log("Animation Complete - Position:", this.currentPFObject.voxelizedMesh.position);
                }
            });

            // Continuous rotation animation
            timeline.to(this.currentPFObject.voxelizedMesh.position, {
                y: "+=" + 1,
                duration: 8,
                ease: "linear",  // Linear rotation
                onUpdate: () => {
                    // Force update of rotation
                    this.currentPFObject.voxelizedMesh.rotation.y += 0;
                    this.currentPFObject.voxelizedMesh.updateMatrixWorld(true); 
                    this.currentPFObject.voxelizedMesh.needsUpdate = true;
                }
            }, .1); // Start immediately after .1 second
        }
    }

    AnimatePlane() 
    {
        const time = Date.now() * 0.0002;
        const gArray = this.planeBuffer.geometry.attributes.position.array; 

        for (let i = 0; i < gArray.length; i += 3) 
        {
            gArray[i + 2] = this.simplex.noise4d(gArray[i] / xyCoef,
                gArray[i + 1] / xyCoef, time, 2) * zCoef; 
        }

        this.planeBuffer.geometry.attributes.position.needsUpdate = true; 
    }

    AnimateVoxelGrid(instancedMesh, simplex, timeFactor, xyCoef, zCoef) 
    {
        const time = Date.now() * timeFactor;
        const voxelCount = instancedMesh.count;

        const gradient = this.currentPFObject.metadata.gradient; 

        if (gradient == undefined) return; 

        const colorGradientStart = new THREE.Color(gradient[gradient.length - 1]);
        const colorGradientEnd = new THREE.Color(gradient[0]);
    
        for (let i = 0; i < voxelCount; i++) 
        {
            let matrix = new THREE.Matrix4; 
            let position = new THREE.Vector3;
            
            instancedMesh.getMatrixAt(i, matrix); 
            position.setFromMatrixPosition(matrix);
    
            // Compute the new Y position using Simplex noise, adjusted to the nearest multiple of gridSize
            position.y = Math.round(simplex.noise4d(position.x / xyCoef, position.z / xyCoef, time, 2) * zCoef / this.gridSize) * this.gridSize - 5;

            if (position.y < this.gridMinY) this.gridMinY = position.y;
            if (position.y > this.gridMaxY) this.gridMaxY = position.y;

            matrix.setPosition(position); 
            instancedMesh.setMatrixAt(i, matrix); 
        }

        for (let i = 0; i < voxelCount; i++) 
        {
            let matrix = new THREE.Matrix4; 
            let position = new THREE.Vector3; 

            instancedMesh.getMatrixAt(i, matrix); 
            position.setFromMatrixPosition(matrix);

            const normalizedY = (position.y - this.gridMinY) / (this.gridMaxY - this.gridMinY);
            const color = new THREE.Color().lerpColors(colorGradientStart, colorGradientEnd, normalizedY); 

            matrix.setPosition(position);
            instancedMesh.setMatrixAt(i, matrix);
            instancedMesh.setColorAt(i, color)
        }

        instancedMesh.instanceMatrix.needsUpdate = true; 
        instancedMesh.instanceColor.needsUpdate = true; 
    }

    InitializeCamera() {
        if (this.currentPFObject != null) {
            const x = orbitRadius * Math.sin((this.animationStartTime) * orbitSpeed);
            const z = orbitRadius * Math.cos((this.animationStartTime) * orbitSpeed);
    
            // Set the camera's initial position
            this.camera.position.set(x, orbitHeight, z);
    
            // Set the camera to look at the initial position of the target object
            this.camera.lookAt(this.currentPFObject.voxelizedMesh.position.x, this.currentPFObject.MaxY() / 2, this.currentPFObject.voxelizedMesh.position.z);
        }
    }

    AnimateCamera() {
        if (this.currentPFObject != null &&
            this.currentPFObject.voxelStartAnimationOver === true &&
            this.canRotateCamera)
        {
            this.animationStartTime += this.clock.getDelta(); 
            // Calculate elapsed time since the animation started
            const elapsedTime = (this.animationStartTime) * orbitSpeed;

            // Calculate the new camera position based on elapsed time
            const x = orbitRadius * Math.sin(-elapsedTime);
            const z = orbitRadius * Math.cos(-elapsedTime);

            // Set the camera's position
            this.camera.position.set(x, orbitHeight, z);

            // Set the camera to look at the initial position of the target object
            this.camera.lookAt(this.currentPFObject.voxelizedMesh.position.x, this.currentPFObject.MaxY() / 2, this.currentPFObject.voxelizedMesh.position.z);
        }
    }

    RenderProjectPage(projectData) 
    {
        const container = document.getElementById('project-container');
    
        // Clear previous content
        container.innerHTML = '';
    
        // Create and add project header
        const header = document.createElement('div');
        header.className = 'project-header';
        header.innerHTML = `
            <h1 class="project-title">${projectData.title}</h1>
            <p class="project-tagline">${projectData.tagline}</p>
        `;
        container.appendChild(header);
    
        // Create and add content sections
        projectData.sections.forEach(section => {
            const sectionDiv = document.createElement('div');
            sectionDiv.className = 'content-section';
            
            if (section.type === 'text-image') {
                sectionDiv.innerHTML = `
                    <img src="${section.content.image.src}" alt="${section.content.image.alt}" class="content-image ${section.content.image.position}">
                    <p class="content-paragraph">${section.content.paragraph}</p>
                `;
            } else if (section.type === 'video') {
                sectionDiv.innerHTML = `
                    <div class="video-section">
                        <iframe width="560" height="315" src="https://www.youtube.com/embed/${section.content.videoId}" frameborder="0" allowfullscreen></iframe>
                        <p class="content-paragraph">${section.content.caption || ''}</p>
                    </div>
                `;
            }
            
            container.appendChild(sectionDiv);
        });
    
        // Create and add download section
        if (projectData.download) {
            const downloadDiv = document.createElement('div');
            downloadDiv.className = 'download-section';
            downloadDiv.innerHTML = `
                <a href="${projectData.download.url}" class="download-button">${projectData.download.label}</a>
            `;
            container.appendChild(downloadDiv);
        }
    
        // Show the container
        container.classList.remove('hidden');
    }

    ToggleFolder(folderId) 
    {
        console.log('Received Folder ID:', folderId);  // Debugging output
    
        if (!folderId) {
            console.warn('folderId is null or undefined');  // Extra warning if folderId is null
            return;
        }

        const folderContent = document.getElementById(folderId);
        const folderHeader = document.querySelector(`[data-folder-id="${folderId}"]`);

        if (folderContent) 
        {
            if (folderContent.style.display === "none" || folderContent.style.display === "") 
            {
                folderHeader.classList.add('open');  
                folderContent.style.display = "block";
            } 
            else 
            {
                folderHeader.classList.remove('open');  
                folderContent.style.display = "none";
            }
            console.log('Toggled folder content:', folderContent);  // Debugging output
        } 
        else 
        {
            console.warn('No element found with ID:', folderId);  // Warn if no element is found
        }
    }
}
