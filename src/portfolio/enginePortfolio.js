import * as THREE from 'three'; 
import * as CANNON from 'cannon';
import SplitType from 'split-type'; 
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GUI } from 'dat.gui'
import gsap from 'gsap';
import Stats from 'three/addons/libs/stats.module.js';
import { SimplexNoise } from 'three/examples/jsm/Addons.js'

import Engine from '../engine'; 
import Backgrounds from './helpers/backgrounds';
import Loader from '../loader'; 
import Helpers from '../helpers'; 
import Voxel from '../voxel'; 
import JSON from '../../data/masterJSON'; 
import ICON from '../../media/portfolio-icons/masterICON';
import ObjectPortfolio from './objectPortfolio';

/* ENGINE STATES CONST */
const WORLD_STEP_VALUE = 1/60;
const DEFAULT_RENDER_SCALE = 1; 
const LOFI_RENDER_SCALE = 4; 
const USE_JSON = true; 
const DEFAULT_GLB_PATH = "../meshes/Biplane.glb"; 

// Define the parameters for the camera's orbit
const orbitRadius = 6;  // Distance from the object
const orbitSpeed = .1; // Speed of the rotation
const orbitHeight = 1;   // Height of the camera relative to the object

const paramsGrid = {
    coefXY:          15,
    coefZ:            3,
    voxelSize:      0.4,
    animSpeed: 0.000015,
    radius:          40,
    gridType:    "circ",
}

const paramsGen = {
    gridSize:          .10,
    modelSize:          10,
    voxelSize :        .10,
    enableRoundness: false,
    voxelRoundess:    .025,
};

export default class EnginePortfolio extends Engine 
{
    constructor(canvasID) 
    {
        super(canvasID) 

        this.mouseDownListener = (event) => this.OnRightMouseDown(event);
        this.mouseUpListener = (event) => this.OnRightMouseUp(event);
        this.mouseMoveListener = (event) => this.OnMouseMove(event);
        this.keyDownListener = (event) => this.OnKeyDown(event); 

        // Rendering 
        this.composer = null; 
        this.lofi = false; 
        
        // Portfolio States
        this.currentPFObject = null; 
        this.nextPFObject = null; 
        this.currentProjectIndex = 0; 
        this.canSwitchObject = true; 
        this.useJsonData = USE_JSON;  
        this.canRotateCamera = true; 
        this.currentLookAt = new THREE.Vector3(); 
        this.canOpenPage = false; 
        this.animationStartTime = 0;

        this.defaultJsonPath = JSON.projects[this.currentProjectIndex]; 
        this.defaultGLBPath = DEFAULT_GLB_PATH; 

        // Voxel Grid
        this.simplex = new SimplexNoise(); 
        this.gridMinY = Infinity;
        this.gridMaxY = -Infinity;

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
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.autoClear = true;

        this.camera = new THREE.PerspectiveCamera(80, 2, 1, 1000);
        this.InitializeRenderTarget(this.lofi);

        this.stats = new Stats();  
        document.getElementById('canvas-container').appendChild(this.stats.dom);
        this.stats.dom.style.position = 'relative'; 
        this.stats.dom.style.top = null;
        this.stats.dom.style.right = null; 
        this.stats.dom.style.bottom = '90%';
        this.stats.dom.style.left = '0%';       
        this.stats.dom.style.zIndex = '1'; 

        if (!this.useJsonData) 
        {
            this.controls = new OrbitControls(this.camera, this.renderer.domElement);
            this.controls.mouseButtons = { MIDDLE: THREE.MOUSE.ROTATE }
        }
    }

    InitializeRenderTarget(pixelated) 
    {
        this.dummyCamera = new THREE.OrthographicCamera(window.innerWidth  / -2, window.innerWidth   / 2, window.innerHeight  / 2, window.innerHeight / -2, -10000, 10000);
        this.dummyCamera.position.z = 1; 
        this.dummyScene = new THREE.Scene(); 

        this.rtTexture = new THREE.WebGLRenderTarget( 
            Math.floor(window.innerWidth / (pixelated ? LOFI_RENDER_SCALE : DEFAULT_RENDER_SCALE)),
            Math.floor(window.innerHeight / (pixelated ? LOFI_RENDER_SCALE : DEFAULT_RENDER_SCALE)),
            { minFilter: THREE.LinearFilter, magFilter: THREE.NearestFilter, format: THREE.RGBAFormat });

        this.uniforms = { tDiffuse: { value: this.rtTexture.texture }, iResolution: { value: new THREE.Vector3() }};
        this.materialScreen = new THREE.ShaderMaterial({
            uniforms: this.uniforms, // rtTexture = material from perspective camera
            vertexShader: document.getElementById( 'vertexShader' ).textContent,
            fragmentShader: document.getElementById( 'fragment_shader_screen' ).textContent,
            depthWrite: false
        });

        this.renderPlane = new THREE.PlaneGeometry(window.innerWidth, window.innerHeight);

        if (this.quad != null) this.dummyScene.remove(this.quad); 
        this.quad = new THREE.Mesh(this.renderPlane, this.materialScreen);
        this.quad.position.z = -100;

        this.dummyScene.add(this.quad); 
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
        this.camera.lookAt(0, 0, 0);
    
        // Directional light setup
        this.directionalLight = new THREE.DirectionalLight(0xffffff, 4);
        this.directionalLight.position.set(10, 10, 10); 

        // Add the light to the scene
        this.scene.add(this.directionalLight);
        this.scene.fog = new THREE.Fog(0x2B2B2B, 2, 25); 

        this.canvas = document.createElement('canvas');
        this.context = this.canvas.getContext('2d', {willReadFrequently: true});
        this.canvas.width = 2048;
        this.canvas.height = 2048;

        if (this.useJsonData) 
        {
            this.currentPFObject = await this.LoadPortfolioObject(this.defaultJsonPath); 

            this.SetScene();
            this.InitializeCamera(); 
            this.InitializeHTML(); 
            this.RenderProjectPage(this.currentPFObject.projectContent); 
            Helpers.AnimateVoxels(this.currentPFObject, 20);  
        }
        else 
        {
            this.currentPFObject = await this.CreatePortfolioObject(); 
            
            this.gridHelper = new THREE.GridHelper(paramsGen.modelSize, paramsGen.modelSize / paramsGen.gridSize); 
            this.gridHelper.position.x += paramsGen.voxelSize / 2; 
            this.gridHelper.position.z += paramsGen.voxelSize / 2; 
            this.gridHelper.position.y += paramsGen.voxelSize / 2; 
            
            this.scene.add(this.gridHelper); 
        }
    }

    async LoadPortfolioObject(path) 
    {
        try 
        {
            const PFObject = new ObjectPortfolio("Load", path);
            await PFObject.Load(); 

            if (PFObject.voxelizedMesh != null) 
            {
                PFObject.voxelizedMesh.position.x = 0; 
                PFObject.voxelizedMesh.position.y = (PFObject.MinY() + PFObject.MaxY()) / 2; 
                PFObject.voxelizedMesh.rotation.y = PFObject.voxelMetadata.startingRotation * (Math.PI / 180); 

                this.scene.add(PFObject.voxelizedMesh); 

                return PFObject; 
            }
            else console.error('ObjectPortfolio could not load voxelized mesh.')
        }
        catch (e) {console.error(`ObjectPortfolio failed to load JSON: ${e}`);} 
    }

    async CreatePortfolioObject() 
    {
        try 
        {
            const PFObject = new ObjectPortfolio("Create", this.defaultJsonPath, this.defaultGLBPath, paramsGen); 
            await PFObject.Load(); 

            if (PFObject.voxelizedMesh != null) 
            {
                this.scene.add(PFObject.voxelizedMesh);

                return PFObject; 
            }
            else console.error('Voxelized Mesh was not loaded correctly.'); 
        }
        catch (e) {console.error(`ObjectPortfolio creation failed: ${e}`);}
    }

    SetScene() 
    {
        if (this.gradientTexture == null) 
        {
            this.gradientTexture = Backgrounds.CreateMultiGradientTexture(this.currentPFObject.projectMetadata.gradientBackground, this.context, this.canvas);
            this.scene.background = this.gradientTexture; 
        }
        if (this.voxelGrid == null) 
        {
            this.voxelGrid = Voxel.CreateVoxelCircle(paramsGrid.radius, paramsGrid.voxelSize);  
            this.scene.add(this.voxelGrid);
        }
    }

    InitializeHTML() 
    {
        const projectMetadata = this.currentPFObject.projectMetadata;
        const voxelMetadata = this.currentPFObject.voxelMetadata; 

        document.getElementById('project-name').textContent = projectMetadata.projectName;
        document.getElementById('company-name').textContent = projectMetadata.companyName;
        document.getElementById('author-name').textContent = projectMetadata.yearString;
        document.getElementById('project-year').textContent = projectMetadata.tasks;
        document.getElementById('project-description').textContent = projectMetadata.description;
        document.getElementById('copyright-model').innerHTML = `© Original Model • <a href="${voxelMetadata.modelLink}" target="_blank">${voxelMetadata.author}</a>`;

        Helpers.CreateCarouselDots(JSON.projects.length, this.currentProjectIndex); 
        this.UpdateIcons();

        this.canOpenPage = true;  
    }

    UpdateIcons() 
    {
        const iconsContainer = document.getElementById('portfolio-icons');
        iconsContainer.innerHTML = '';
    
        this.currentPFObject.projectContent.icons.forEach(icon => {
            const iconDiv = document.createElement('div');
            iconDiv.className = 'icon';
    
            const img = document.createElement('img');
            img.className = 'icon-img';
            
            ICON.LoadIcon(icon.image).then(iconSrc => {
                img.src = iconSrc.default || iconSrc;  // Set the image source after resolution
                img.className = 'icon-img';

                const p = document.createElement('p');
                p.textContent = icon.name;

                iconDiv.appendChild(img);
                iconDiv.appendChild(p);

                iconsContainer.appendChild(iconDiv);
            }).catch(error => {
                console.error('Failed to load icon:', error);
            });
        });
    }

    UpdateHTML() 
    {
        const projectMetadata = this.currentPFObject.projectMetadata;
        const voxelMetadata = this.currentPFObject.voxelMetadata; 
        this.canOpenPage = false; 

        const vsOpts = {
            duration: 0.20,
            lineHeight: 100
        };
    
        const elements = {
            projectName: document.getElementById('project-name'),
            companyName: document.getElementById('company-name'),
            authorName: document.getElementById('author-name'),
            projectYear: document.getElementById('project-year'),
            projectDescription: document.getElementById('project-description'),
            copyrightModel: document.getElementById('copyright-model')
        };
    
        // Function to update text with animations
        const updateTextWithAnimation = (element, newText) => 
        {
            const splitInstance = new SplitType(element, { types: 'chars' });
            const oldChars = splitInstance.chars;
            
            // Animate out the old text (slide up and fade out)
            gsap.to(oldChars, 
            {
                duration: vsOpts.duration,
                y: -vsOpts.lineHeight,
                opacity: 0,
                stagger: vsOpts.duration / 10,
                ease: "steps(2)",

                onComplete: () => 
                {
                    splitInstance.revert(); 
                    // Update text content once old text is gone
                    element.textContent = newText;
                    
                    // Re-split new text into characters
                    const newSplitInstance = new SplitType(element, { types: 'chars' });
                    const newChars = newSplitInstance.chars;
    
                    // Animate in the new text (slide down and fade in)
                    gsap.from(newChars, 
                    {
                        duration: vsOpts.duration,
                        y: vsOpts.lineHeight,
                        opacity: 0,
                        stagger: vsOpts.duration / 10,
                        ease: "steps(2)",

                        onComplete: () => 
                        {
                            splitInstance.revert();  
                            element.innerHTML = ''; 
                            element.textContent = newText;
                            this.canOpenPage = true; 
                        }
                    });
                }
            });
        };

        updateTextWithAnimation(elements.projectName, projectMetadata.projectName);
        updateTextWithAnimation(elements.projectYear, projectMetadata.tasks);
        updateTextWithAnimation(elements.projectDescription, projectMetadata.description);

        document.getElementById('company-name').textContent = projectMetadata.companyName;
        document.getElementById('author-name').textContent = projectMetadata.yearString;
        document.getElementById('copyright-model').innerHTML = `© Original Model • <a href="${voxelMetadata.modelLink}" target="_blank">${voxelMetadata.author}</a>`;

        this.UpdateIcons();
    }    

    InitializeGUI() 
    {
        this.gui = new GUI({width: 300});  // Create a new GUI instance

        this.gui.domElement.style.position = 'absolute';
        this.gui.domElement.style.marginTop = '100px';
        this.gui.domElement.style.width = '300px';

        const models = [
            '../meshes/Biplane.glb',
            '../meshes/Statue.glb',
            '../meshes/Computer.glb',
            '../meshes/Spaceship.glb',
            '../meshes/Fighter.glb',
            '../meshes/Gloves.glb',
            '../meshes/Keg.glb',
            '../meshes/UFO.glb',
            '../meshes/Knight.glb',
            '../meshes/Airplane.glb',
        ];
        const modelOptions = {selectedModel: models[0]}; 

        // Extract the model name from the selectedModel path
        const extractModelName = (modelPath) => {
            const parts = modelPath.split('/');
            const fileName = parts[parts.length - 1];
            const modelName = fileName.split('.')[0];
            return modelName;
        }

        const guiParams = 
        {
            modelName: extractModelName(modelOptions.selectedModel),
            enableWireframe: false,
            enableLofi: false,
            enableAO: true, 
            enableAODebug: false, 
            projectName: "project_name", 
        }

        this.gui.add(modelOptions, 'selectedModel', models).name('Model').onChange((value) => {
            this.defaultGLBPath = value; 
            guiParams.modelName = extractModelName(modelOptions.selectedModel);
            this.gui.updateDisplay(); 
            this.UpdateVoxelization();
        })
        this.gui.add(paramsGen, 'gridSize', 0.01, 1).name('Grid Size').onChange(this.UpdateVoxelization.bind(this));
        this.gui.add(paramsGen, 'modelSize', 1, 100).name('Model Size').onChange(this.UpdateVoxelization.bind(this));
        this.gui.add(paramsGen, 'voxelSize', 0.01, 1).name('Voxel Size').onChange(this.UpdateVoxelization.bind(this));
        this.gui.add(paramsGen, 'enableRoundness').name('Roundess').onChange(this.UpdateVoxelization.bind(this));
        this.gui.add(paramsGen, 'voxelRoundess', 0.01, 1).name('Voxel Roundness').onChange(this.UpdateVoxelization.bind(this));
        this.gui.add(guiParams, 'enableLofi').name('Lo-Fi').onChange(value => this.InitializeRenderTarget(value));
        this.gui.add(guiParams, 'enableWireframe').name('Wireframe').onChange(this.UpdateVoxelization.bind(this));
        this.gui.add(guiParams, 'enableAO').name('AO').onChange(this.UpdateVoxelization.bind(this));
        this.gui.add(guiParams, 'enableAODebug').name('AO Debug').onChange(this.UpdateVoxelization.bind(this));
        this.gui.add(guiParams, 'modelName').name('Model Name').onChange(value => guiParams.modelName = value);
        this.gui.add(guiParams, 'projectName').name('Project Name');

        this.gui.add({save: () => Loader.CreateVoxelDataFiles(this.currentPFObject, paramsGen, guiParams.projectName, guiParams.modelName) }, 'save').name('Save Voxel Data');
        this.gui.add({save: () => Loader.CreateProjectDataFiles(this.currentPFObject, paramsGen, guiParams.projectName, guiParams.modelName) }, 'save').name('Save Project Data');
    }

    SetupEventListeners() 
    {
        const switchElement = document.getElementById('switch');

        switchElement.addEventListener('change', (event) => {
            this.lofi = event.target.checked; 
            this.InitializeRenderTarget(this.lofi);
        });

        const darkOverlay = document.getElementById('darkOverlay');
        const projectDescription = document.getElementById('project-description');
        const projectContainer = document.getElementById('project-container');

        const expandTimeline = gsap.timeline({ 
            paused: true,
            ease: "expo.inOut",
            onComplete: () => {
                projectContainer.classList.add('visible');
                projectContainer.classList.remove('hidden'); 
                projectContainer.style.pointerEvents = 'auto';  // Enable interaction after animation
            },
            onReverseComplete: () => {
                this.canSwitchObject = true; 
                
                gsap.to(projectDescription, {
                    duration: 0.2, // Control the duration of the smooth transition
                    width: 'auto',
                    onComplete: () => {
                        // Remove the inline width after the animation completes
                        gsap.set(projectDescription, { clearProps: "width" });
                    }
                });

                projectContainer.classList.remove('visible');
                projectContainer.classList.add('hidden');
                projectContainer.style.pointerEvents = 'none';  // Enable interaction after animation
            }});

        expandTimeline.to(darkOverlay, {
            duration: 0.1,
            opacity: '0.5'
        }).to(projectDescription, {
            duration: 0.20,
            color: 'rgb(0, 0, 0, 0)', 
            backgroundColor: 'rgb(0, 0, 0, 0.9)',
            width: projectDescription.parentElement.offsetWidth + 'px',
            bottom: '-18px',
            padding: '4px 8px',
            borderRadius: '0px',
            autoRound: false
        }, "+=0.1") // Starts 0.5 seconds after the previous animation ends
        .to(projectDescription, {
            duration: 0.30,
            height: '100%',
        }, "+=0.1") // Starts 0.3 seconds after the previous animation ends
        .to(projectContainer, {
            duration: 0.2,
            opacity: '1',
        }, "+=0.2"); // Starts 0.4 seconds after the previous animation ends
            
        // Adjust timeScale to speed up reverse
        const reverseSpeedMultiplier = 1.5; // Speed up reverse by 2x

        projectDescription.addEventListener('mouseenter', () => {
            if (!this.canOpenPage) return; 
            this.canSwitchObject = false; 
            expandTimeline.timeScale(1.1).play(); // Play the animation at normal speed
        });

        projectContainer.addEventListener('mouseleave', () => {
            expandTimeline.timeScale(reverseSpeedMultiplier).reverse(); // Faster reverse speed
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
    OnRightMouseDown(event) {}
    OnRightMouseUp(event) {}
    OnMouseMove(event) {}

    OnKeyDown(event) 
    {
        if (event.key === 'ArrowLeft') this.SwitchToPreviousObject(); 
        else if (event.key === 'ArrowRight') this.SwitchToNextObject();
    }

    OnScroll(event) 
    {
        console.log("deltaX: ", event.deltaX, "deltaY: ", event.deltaY);
        // Check if horizontal scroll (deltaX) or vertical scroll (deltaY) is detected
        if (event.deltaX < 0) {
            // Scrolling left (negative deltaX)
            this.SwitchToPreviousObject();
        } else if (event.deltaX > 0) {
            // Scrolling right (positive deltaX)
            this.SwitchToNextObject();
        }
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
        if (this.currentProjectIndex < JSON.projects.length - 1) 
        {
            this.currentProjectIndex++;
            await this.SwitchObject(1, 0.66); 
        } 
    }

    async SwitchObject(direction, duration) 
    {
        this.canSwitchObject = false; 
        this.canRotateCamera = true; 

        const perpDirection = this.camera.position.clone().applyAxisAngle(this.camera.up, direction * Math.PI / 2);         
        // Calculate spawn position for the new object (a bit to the left or right of the current object)
        const spawnDistance = window.innerWidth * 0.0025;
        const spawnPosition = perpDirection.multiplyScalar(spawnDistance); 
    
        // Load the next portfolio object
        this.nextPFObject = await this.LoadPortfolioObject(JSON.projects[this.currentProjectIndex]);
        // Store camera next LookAt
        const newLookAtY = (this.nextPFObject.MinY() + this.nextPFObject.MaxY()) / 2;
        // Set initial position of the new object
        this.nextPFObject.voxelizedMesh.position.copy(spawnPosition);
        this.nextPFObject.voxelizedMesh.rotation.y = this.nextPFObject.voxelMetadata.startingRotation  * (Math.PI / 180); 

        // Update the background
        this.SmoothGradientTransition(this.currentPFObject.projectMetadata.gradientBackground, this.nextPFObject.projectMetadata.gradientBackground, duration);
    
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
            onComplete: () => 
            {
                this.ClearPortfolioObject();
                this.currentPFObject = this.nextPFObject;

                this.UpdateHTML(); 
                this.RenderProjectPage(this.currentPFObject.projectContent); 
                Helpers.UpdateCarouselDots(this.currentProjectIndex);  

                //this.animationStartTime = 0; 
                this.currentPFObject.voxelStartAnimationOver = true; 
                this.canRotateCamera = true; 
                this.canSwitchObject = true;
 
                gsap.to(this.currentLookAt, {
                    y: newLookAtY,
                    duration: duration,
                    ease: "power2.inOut"
                });
            }
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
        canvas.width = 2048;
        canvas.height = 2048;
    
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
    
    GameLoop() 
    {
        super.GameLoop();
        this.world.step(WORLD_STEP_VALUE);
        this.stats.update(); 

        //this.AnimatePlane();
        if (this.useJsonData) 
        {
            if (this.frameCounter % 4 == 0) this.AnimateVoxelGrid();  
            //this.AnimateVoxelizedMesh();
            this.AnimateCamera(); 
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
                duration: 32,
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

    AnimateVoxelGrid() 
    {
        if (this.voxelGrid == null) return; 
        const gradient = this.currentPFObject.projectMetadata.gradientGrid; 
        if (gradient == undefined) return; 
        
        const time = Date.now() * paramsGrid.animSpeed;
        const voxelCount = this.voxelGrid.count;

        const colorStart = new THREE.Color(gradient[gradient.length - 1]);
        const colorEnd = new THREE.Color(gradient[0]);
    
        const matrix = new THREE.Matrix4();
        const position = new THREE.Vector3();
        const color = new THREE.Color();

        for (let i = 0; i < voxelCount; i++) 
        {            
            this.voxelGrid.getMatrixAt(i, matrix); 
            position.setFromMatrixPosition(matrix);
    
            // Compute the new Y position using Simplex noise, adjusted to the nearest multiple of gridSize
            position.y = Math.round(this.simplex.noise4d(
                position.x / paramsGrid.coefXY, 
                position.z / paramsGrid.coefXY, time, 
                2) * paramsGrid.coefZ / paramsGrid.voxelSize) 
                * paramsGrid.voxelSize - 5;

            if (position.y < this.gridMinY) this.gridMinY = position.y;
            if (position.y > this.gridMaxY) this.gridMaxY = position.y;

            matrix.setPosition(position); 
            this.voxelGrid.setMatrixAt(i, matrix); 
        }

        for (let i = 0; i < voxelCount; i++) 
        {
            this.voxelGrid.getMatrixAt(i, matrix); 
            position.setFromMatrixPosition(matrix);

            const normalizedY = (position.y - this.gridMinY) / (this.gridMaxY - this.gridMinY);
            color.lerpColors(colorStart, colorEnd, normalizedY); 

            matrix.setPosition(position);
            this.voxelGrid.setMatrixAt(i, matrix);
            this.voxelGrid.setColorAt(i, color)
        }

        this.voxelGrid.instanceMatrix.needsUpdate = true; 
        this.voxelGrid.instanceColor.needsUpdate = true; 
    }

    InitializeCamera() {
        if (this.currentPFObject != null) {
            const x = orbitRadius * Math.sin((this.animationStartTime) * orbitSpeed);
            const z = orbitRadius * Math.cos((this.animationStartTime) * orbitSpeed);
    
            // Set the camera's initial position
            this.camera.position.set(x, 1.5, z);

            const lookAtY = this.currentPFObject.MaxY() / 2;
            this.currentLookAt.set(this.currentPFObject.voxelizedMesh.position.x, lookAtY, this.currentPFObject.voxelizedMesh.position.z);
    
            // Set the camera to look at the initial position of the target object
            this.camera.lookAt(this.currentLookAt);
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
            
            // Calculate the vertical Y position with up-and-down oscillation
            const minY = -0.5;
            const maxY = 3.5;
            const midpointY = (minY + maxY) / 2;
            const amplitudeY = (maxY - minY) / 2;
            const frequency = 2; // Adjust for the speed of the vertical motion

            const y = midpointY + amplitudeY * Math.sin(frequency * elapsedTime);

            // Set the camera's position
            this.camera.position.set(x, y, z);

            // Set the camera to look at the initial position of the target object
            this.camera.lookAt(this.currentLookAt);
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
            <p class="content-spacer"></p>
        `;
        header.style.backgroundImage = `linear-gradient(to top, rgba(0, 0, 0, 0.8), rgba(0, 0, 0, 0)), url('${projectData.background}')`;
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
            } 
            else if (section.type === 'video') {
                sectionDiv.innerHTML = `
                    <div class="video-section">
                        <iframe width="560" height="315" src="https://www.youtube.com/embed/${section.content.videoId}" frameborder="0" allowfullscreen></iframe>
                        <p class="content-subtitle">${section.content.caption || ''}</p>
                    </div>
                `;
            }
            else if (section.type === 'category') {
                sectionDiv.innerHTML = `
                    <div class="category-section">
                        <h2 class="category-title">${section.content.title}</h2>
                    </div>
                `;
            }
            else if (section.type === 'spacer') {
                sectionDiv.innerHTML = `
                    <p class="content-paragraph"></p>
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
