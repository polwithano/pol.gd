import * as CANNON from 'cannon';
import * as THREE from 'three';

import Backgrounds from './helpers/backgrounds';
import Engine from '../engine';
import { GUI } from 'dat.gui'
import Helpers from '../helpers';
import ICON from '../../public/media/portfolio-icons/masterICON';
import JSON from '../../data/masterJSON';
import Loader from '../loader';
import MenuPortfolio from './menuPortfolio';
import ObjectPortfolio from './objectPortfolio';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import ProjectPageFactory from './projectPageFactory';
import Shaders from './shadersPortfolio';
import { SimplexNoise } from 'three/examples/jsm/Addons.js'
import SplitType from 'split-type';
import Stats from 'three/addons/libs/stats.module.js';
import TagManager from './tagManager';
import Voxel from '../voxel';
import gsap from 'gsap';

/* ENGINE STATES CONST */
const WORLD_STEP_VALUE = 1/60;
const DEFAULT_RENDER_SCALE = 1; 
const LOFI_RENDER_SCALE = 4; 
const TIMER_SWITCH = 15.0; 
const USE_JSON = true; 
const USE_DEBUG = false; 
const DEFAULT_GLB_PATH = "../meshes/Biplane.glb"; 

// Define the parameters for the camera's orbit
const orbitRadius = 8;  // Distance from the object
const orbitSpeed = .25; // Speed of the rotation
const orbitMinheight = 0; 
const orbitMaxHeight = 3;

let touchStartX = 0
let touchEndX = 0
let touchLastX = 0; 
let touchLastY = 0; 
let touchStartY = 0; 
let touchEndY = 0; 
let deltaTouchX = 0; 
let deltaTouchY = 0; 
let lastScrollTop = 0; 
let isDragging = false;
let initialMouseX = 0;
let initialMouseY = 0;
let initialRotationX = 0;
let initialRotationY = 0;
const rotationLimit = Math.PI / 1.33; // Limit rotation to 45 degrees
const rotationSpeed = 0.0055; // Speed of rotation

const paramsGrid = {
    coefXY:          20,
    coefZ:            3,
    voxelSize:      .75,
    animSpeed:  .000015,
    radius:          50,
    gridType:    "circ",
    frameSkip:        4,
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
        this.scrollListener = (event) => this.OnScroll(event); 
        this.touchStartListener = (event) => this.OnTouchStart(event); 
        this.touchEndListener = (event) => this.OnTouchEnd(event); 
        this.touchMoveListener = (event) => this.OnTouchMove(event)

        // Rendering 
        this.composer = null; 
        this.useLofi = false; 
        this.useGrid = true; 
        
        // Portfolio States
        this.projectPageFactory = new ProjectPageFactory(document.getElementById('project-container')); 
        this.projectPageFactory.Initialize(); 
        this.currentPFObject = null; 
        this.nextPFObject = null; 
        this.currentProjectIndex = 0; 
        this.canSwitchObject = false; 
        this.useJsonData = USE_JSON;  
        this.canRotateCamera = false; 
        this.currentLookAt = new THREE.Vector3(); 
        this.canOpenPage = false; 
        this.animationStartTime = 0;
        this.switchTimer = TIMER_SWITCH;
        this.canUpdateTimer = false;  
        this.canPinch = false; 
        this.introPanelClosed = false; 

        this.defaultJsonPath = JSON.projects[this.currentProjectIndex]; 
        this.defaultGLBPath = DEFAULT_GLB_PATH; 

        // Voxel Grid
        this.simplex = new SimplexNoise(); 
        this.gridMinY = Infinity;
        this.gridMaxY = -Infinity;

        this.Initialize(); 
        this.GameLoop(this.currentTimestamp); 
    }

    // #region Initialize Methods
    Initialize() 
    {
        super.Initialize();

        this.InitializeCannon();
        this.InitializeMenu();    
        this.InitializeGame(); 
        this.SetupEventListeners();

        if (!this.useJsonData) 
        {
            this.InitializeGUI();
            this.ScrollIntroPanel(); 
        } 

        this.canUpdateTimer = true;
        this.canRotateCamera = true; 
        this.canSwitchObject = true;
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
        this.InitializeRenderTarget(this.useLofi);
        
        if (USE_DEBUG) 
        {
            this.stats = new Stats();  
            document.getElementById('canvas-container').appendChild(this.stats.dom);
            this.stats.dom.style.position = 'relative'; 
            this.stats.dom.style.top = null;
            this.stats.dom.style.right = null; 
            this.stats.dom.style.bottom = '90%';
            this.stats.dom.style.left = '0%';       
            this.stats.dom.style.zIndex = '1';    
        }

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

        this.renderPlane = new THREE.PlaneGeometry(window.innerWidth, window.innerHeight);

        this.rtTexture = new THREE.WebGLRenderTarget
        ( 
            Math.floor(window.innerWidth / (pixelated ? LOFI_RENDER_SCALE : DEFAULT_RENDER_SCALE)),
            Math.floor(window.innerHeight / (pixelated ? LOFI_RENDER_SCALE : DEFAULT_RENDER_SCALE)),
            { 
                minFilter: THREE.NearestFilter, 
                magFilter: THREE.NearestFilter, 
                format: THREE.RGBAFormat 
            }
        );
        
        // Add a depth texture
        this.rtTexture.depthTexture = new THREE.DepthTexture();
        this.rtTexture.depthTexture.type = THREE.UnsignedShortType;

        this.uniforms = { tDiffuse: { value: this.rtTexture.texture }, iResolution: { value: new THREE.Vector3() }};
        this.materialScreen = new THREE.ShaderMaterial({
            uniforms: this.uniforms, // rtTexture = material from perspective camera
            vertexShader: Shaders.vertex_pixelized,
            fragmentShader: Shaders.fragment_pixelized,
            depthWrite: false
        });

        const pixelationScale = this.useLofi ? 0 : 1;

        const edgeDetectionMaterial = new THREE.ShaderMaterial({
            uniforms: {
                tDiffuse: { value: this.rtTexture.texture },
                tDepth: { value: this.rtTexture.depthTexture },  // Depth texture
                pixelationScale: { value: pixelationScale },  // Pixelation or screen resolution scale
                cameraPosition: { value: this.camera.position },  // Camera's world position
            },
            vertexShader: Shaders.vertex_outline,
            fragmentShader: Shaders.fragment_outline,
            depthWrite: false,
        });        

        if (this.quad != null) this.dummyScene.remove(this.quad); 
        this.quad = new THREE.Mesh(this.renderPlane, this.materialScreen);
        this.quad.position.z = -1000;

        // Create a quad for the final pass
        if (this.outlineQuad != null) this.dummyScene.remove(this.outlineQuad); 
        this.outlineQuad = new THREE.Mesh(this.renderPlane, edgeDetectionMaterial);
        this.outlineQuad.position.z = -1000; 

        this.dummyScene.add(this.quad);
        this.dummyScene.add(this.outlineQuad); 
    }

    InitializeCannon() 
    {
        this.world = new CANNON.World();
        this.world.gravity.set(0, -9.81, 0); // Set gravity to zero initially
    }

    async InitializeMenu() 
    {
        this.menu = new MenuPortfolio(); 
        await this.menu.Initialize(); 

        // Use event delegation for the explorer
        document.querySelector('.explorer').addEventListener('click', (event) => 
        {
            const folderHeader = event.target.closest('.folder-header');
            if (folderHeader) 
            {
                const folderID = folderHeader.getAttribute('data-folder-id');
                this.menu.ToggleFolder(folderID);
                //console.log(`Folder ID: ${folderID}`);
                return;
            }

            const project = event.target.closest('.project');
            if (project) 
            {
                const projectName = project.getAttribute('data-project-name');
                const newIndex = JSON.projects.indexOf(projectName);

                if (newIndex === this.currentProjectIndex || !this.canSwitchObject) return;

                const direction = newIndex > this.currentProjectIndex ? 1 : -1;
                this.currentProjectIndex = newIndex;
                this.SwitchObject(direction, 0.5); 
                this.menu.UpdateSelectedProject(this.currentProjectIndex);
            }
        });
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
        this.scene.fog = new THREE.Fog(0xFFFFFF, 10, paramsGrid.radius * 0.95); 

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
            await this.projectPageFactory.CreatePage(this.currentPFObject); 
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
            this.gradientTexture = Backgrounds.CreateMultiGradientTexture(this.currentPFObject.metadata.gradientBackground, this.context, this.canvas);
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
        const projectMetadata = this.currentPFObject.metadata;
        const voxelMetadata = this.currentPFObject.voxelMetadata; 

        document.getElementById('project-name').textContent = projectMetadata.projectName;
        document.getElementById('project-tag').appendChild(TagManager.TagElement(projectMetadata.tag, "tag")); 
        document.getElementById('company-name').textContent = projectMetadata.companyName;
        document.getElementById('author-name').textContent = projectMetadata.yearString;
        document.getElementById('project-year').textContent = projectMetadata.tasks;
        document.getElementById('project-description').textContent = projectMetadata.description;
        document.getElementById('copyright-model').innerHTML = `© Original Model • <a href="${voxelMetadata.modelLink}" target="_blank">${voxelMetadata.author}</a>`;

        Helpers.CreateCarouselDots(JSON.projects.length, this.currentProjectIndex); 
        document.querySelectorAll('.dot').forEach(dot => {
            dot.addEventListener('click', (event) => {
                const target = event.target.closest('.dot');
                const projectIndex = parseInt(target.getAttribute('project-index'), 10); 

                if (projectIndex == this.currentProjectIndex) return; 
                if (!this.canSwitchObject) return;

                this.currentProjectIndex = projectIndex; 
                const direction = projectIndex > this.currentProjectIndex ? 1 : -1;
                this.SwitchObject(direction, 0.5); 
            })
        })

        this.UpdateIcons();

        this.canOpenPage = true;  
    }

    UpdateIcons() 
    {
        const iconsContainer = document.getElementById('portfolio-icons');
        iconsContainer.innerHTML = '';
    
        this.currentPFObject.content.icons.forEach(icon => {
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
        const projectMetadata = this.currentPFObject.metadata;
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
        document.getElementById('project-tag').innerHTML = '';  
        document.getElementById('project-tag').appendChild(TagManager.TagElement(projectMetadata.tag, "tag")); 
        document.getElementById('copyright-model').innerHTML = `© Original Model • <a href="${voxelMetadata.modelLink}" target="_blank">${voxelMetadata.author}</a>`;

        this.UpdateIcons();
    }    

    InitializeGUI() 
    {
        this.gui = new GUI({width: 300});  // Create a new GUI instance

        this.gui.domElement.style.position = 'relative';
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
            '../meshes/Rifle.glb',
            '../meshes/Airplane.glb',
            '../meshes/Bear.glb',
            '../meshes/Earth.glb',
            '../meshes/Probe.glb',
            '../meshes/Dish.glb',
            '../meshes/Tile.glb',
            '../meshes/Doom.glb',
            '../meshes/Camera.glb',
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
        const switches = document.querySelectorAll('input[type="checkbox"]');

        switches.forEach((switchElement) => {
            const isLofiSwitch = switchElement.closest('.switch').classList.contains('lofi');
            const isGridSwitch = switchElement.closest('.switch').classList.contains('grid');

            // Set the checked state based on current boolean values
            if (isLofiSwitch) {
                switchElement.checked = this.useLofi;
            } else if (isGridSwitch) {
                switchElement.checked = this.useGrid;
            }

            // Attach event listeners for state changes
            switchElement.addEventListener('change', (event) => {
                if (isLofiSwitch) {
                    this.useLofi = event.target.checked;
                    this.InitializeRenderTarget(this.useLofi);
                } else if (isGridSwitch) {
                    this.useGrid = event.target.checked;
                    if (this.voxelGrid != undefined) {
                        this.useGrid ? this.scene.add(this.voxelGrid) : this.scene.remove(this.voxelGrid);
                    }
                }
            });
        });

        document.getElementById('leftArrowSwitch').addEventListener('click', (event) => {
            this.SwitchToPreviousObject(); 
        });
        
        document.getElementById('rightArrowSwitch').addEventListener('click', (event) => {
            this.SwitchToNextObject(); 
        });

        document.getElementById('scroll-indicator').addEventListener('click', (event) => {
            this.ScrollIntroPanel(); 
        })

        const darkOverlay = document.getElementById('darkOverlay');
        const projectDescription = document.getElementById('project-description');
        const projectContainer = document.getElementById('project-container');

        const bufferTimeline = gsap.timeline({
            paused: true, 
            ease: "expo.inOut",
            onComplete: () => {
                if (!this.canOpenPage) return; 
                this.canSwitchObject = false;
                this.switchTimer = TIMER_SWITCH;  
                this.canUpdateTimer = false;  
                expandTimeline.timeScale(1.2).play(); // Play the animation at normal speed
            },
        })

        bufferTimeline.to(projectDescription, {
            duration: 0.500,
        });

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
                this.canUpdateTimer = true; 
                
                gsap.to(projectDescription, {
                    duration: 0.2, // Control the duration of the smooth transition
                    width: 'auto',
                    onComplete: () => {
                        // Remove the inline width after the animation completes
                        gsap.set(projectDescription, {clearProps: "width"});
                    }
                });

                projectContainer.classList.remove('visible');
                projectContainer.classList.add('hidden');
                projectContainer.style.pointerEvents = 'none';  // Enable interaction after animation
            }});

        expandTimeline.to(darkOverlay, {
            duration: 0.1,
            opacity: '0.67'
        }).to(projectDescription, {
            duration: 0.20,
            opacity: 0.95,
            color: 'rgb(0, 0, 0, 0)', 
            backgroundColor: 'rgb(0, 0, 0, 0.96)',
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
            
        projectDescription.addEventListener('mouseenter', () => {
            bufferTimeline.timeScale(1).play(); 
        });

        projectDescription.addEventListener('mouseleave', () => {
            bufferTimeline.timeScale(1).reverse(); 
        });

        projectContainer.addEventListener('mouseleave', () => {
            expandTimeline.timeScale(1.7).reverse(); // Faster reverse speed
            this.projectPageFactory.PauseVideos(); 
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
            if (!this.IsButton(event)) {
                if (event.button == 0) {
                    this.OnRightMouseDown(event);
                }
            }
        };
    
        this.mouseUpListener = (event) => {
            if (!this.IsButton(event)) {
                if (event.button == 0) {
                    this.OnRightMouseUp(event);
                }
            }
        };
    
        this.mouseMoveListener = (event) => {this.OnMouseMove(event);};
        this.keyDownListener = (event) => {if (this.useJsonData) this.OnKeyDown(event);};
        this.scrollListener = (event) => {if (this.useJsonData) this.OnScroll(event);};
        this.touchStartListener = (event) => this.OnTouchStart(event); 
        this.touchEndListener = (event) => this.OnTouchEnd(event); 
    }
    
    AddEventListeners() {
        super.AddEventListeners(); 
    
        // Add new event listeners to the document using stored references
        document.addEventListener('mousedown', this.mouseDownListener);    
        document.addEventListener('mouseup', this.mouseUpListener); 
        document.addEventListener('mousemove', this.mouseMoveListener); 
        document.addEventListener('keydown', this.keyDownListener);
        window.addEventListener('wheel', this.scrollListener, false);

        document.addEventListener('touchstart', this.touchStartListener); 
        document.addEventListener('touchend', this.touchEndListener);
        document.addEventListener('touchmove', this.touchMoveListener); 
    }
    
    RemoveEventListeners() {
        super.RemoveEventListeners(); 
    
        // Remove existing event listeners for the document using stored references
        document.removeEventListener('mousedown', this.mouseDownListener);
        document.removeEventListener('mouseup', this.mouseUpListener);
        document.removeEventListener('mousemove', this.mouseMoveListener);
        document.removeEventListener('keydown', this.keyDownListener);
        window.removeEventListener('wheel', this.scrollListener, false);

        document.removeEventListener('touchstart', this.touchStartListener); 
        document.removeEventListener('touchend', this.touchEndListener); 
        document.removeEventListener('touchmove', this.touchMoveListener); 
    }
    // #endregion

    // #region Mouse Events
    OnRightMouseDown(event) 
    {
        if (this.canPinch == false) return; 
        if (this.currentPFObject && this.currentPFObject.voxelizedMesh) 
        {
            isDragging = true;
            this.switchTimer = TIMER_SWITCH; 
            this.canUpdateTimer = false; 
            initialMouseX = event.clientX;
            initialMouseY = event.clientY;
            // Store the current rotation of the object when the drag starts, including the startingRotation
            initialRotationX = this.currentPFObject.voxelizedMesh.rotation.x;
            initialRotationY = this.currentPFObject.voxelizedMesh.rotation.y;
        }
    }

    OnRightMouseUp(event) 
    {
        if (isDragging) {
            isDragging = false;
            this.canUpdateTimer = true; 
            // Animate the return to the default position when the mouse is released
            gsap.to(this.currentPFObject.voxelizedMesh.rotation, {
                x: 0,
                y: this.currentPFObject.voxelMetadata.startingRotation * (Math.PI / 180),
                duration: 1,
                ease: "elastic.out(3, 10)" // "Rubber band" effect
            });
        }
    }

    OnMouseMove(event) 
    {
        if (isDragging) {
            const deltaX = (event.clientX - initialMouseX) * rotationSpeed;
            const deltaY = (event.clientY - initialMouseY) * rotationSpeed;
    
            // Apply rotation based on the initial rotation values saved on drag start
            this.currentPFObject.voxelizedMesh.rotation.x = initialRotationX + deltaY;
            this.currentPFObject.voxelizedMesh.rotation.y = initialRotationY + deltaX;
    
            // Ensure the new rotation stays within the defined limits (optional)
            this.currentPFObject.voxelizedMesh.rotation.x = Math.max(-rotationLimit, Math.min(rotationLimit, this.currentPFObject.voxelizedMesh.rotation.x));
            this.currentPFObject.voxelizedMesh.rotation.y = Math.max(-rotationLimit, Math.min(rotationLimit, this.currentPFObject.voxelizedMesh.rotation.y));
        }
    }

    OnKeyDown(event) 
    {
        if (event.key === 'ArrowLeft') this.SwitchToPreviousObject(); 
        else if (event.key === 'ArrowRight') this.SwitchToNextObject();
    }

    OnScroll(event) 
    {
        const delta = Math.abs(event.deltaY); // Scroll amount
        this.ScrollIntroPanel(); 
    }

    OnTouchStart(event) 
    {
        touchStartX = event.changedTouches[0].screenX; 
        touchStartY = event.changedTouches[0].screenY; 

        touchLastX = touchStartX;
        touchLastY = touchStartY;
    }

    OnTouchMove(event) 
    {
        event.preventDefault(); 

        touchLastX = event.changedTouches[0].screenX; 
        touchLastY = event.changedTouches[0].screenY; 

        deltaTouchX = Math.abs(touchLastX - touchStartX); 
        deltaTouchY = Math.abs(touchLastY - touchStartY); 

        console.log('Delta Touch X: ' + deltaTouchX); 
        console.log('Delta Touch Y: ' + deltaTouchY); 

        if (deltaTouchY > deltaTouchX) this.SwipeVertical();
        else this.SwipeHorizontal();  
    }

    OnTouchEnd(event) 
    {
        /*
        touchEndX = event.changedTouches[0].screenX; 
        touchEndY = event.changedTouches[0].screenY; 

        deltaTouchX = Math.abs(touchEndX - touchStartX); 
        deltaTouchY = Math.abs(touchEndY - touchStartY); 

        console.log('Delta Touch X: ' + deltaTouchX); 
        console.log('Delta Touch Y: ' + deltaTouchY); 

        if (deltaTouchY > deltaTouchX) this.SwipeVertical();
        else this.SwipeHorizontal();  
        */
    }

    SwipeVertical() 
    {
        const direction = touchEndY > touchStartY ? 'down' : 'up'; 
        console.log(`Vertical ${direction} Swipe`); 
        if (direction == 'up') 
        {
            this.ScrollIntroPanel(); 
        }
    }

    SwipeHorizontal() 
    {
        const direction = touchEndX > touchStartX ? 'right' : 'left'; 
        console.log(`Horizontal ${direction} Swipe`); 
    }

    ScrollIntroPanel() 
    {
        if (this.introPanelClosed) return; 
        this.introPanelClosed = true;
        
        const introSection = document.getElementById('intro-section');
        
        // Limit the scroll position so that it doesn't move beyond a certain point
        const maxScroll = window.innerHeight; // Adjust based on how far you want to move it
    
        // Use GSAP to animate the position and opacity smoothly
        gsap.to(introSection, {
            y: -maxScroll,   // equivalent to `translateY`
            duration: 2,       // adjust for how smooth/fast you want it
            ease: "power2.out",   // easing function for a smoother animation
            onComplete: () => {
                introSection.style.pointerEvents = 'none';  // Disable pointer events after fade out 
            }
        });
    }

    async SwitchToPreviousObject() 
    {
        if (!this.canSwitchObject) return; 
        if (this.currentProjectIndex > 0) 
        {
            this.currentProjectIndex--;
        }
        else this.currentProjectIndex = JSON.projects.length - 1; 
        await this.SwitchObject(-1, 0.5); 
    }

    async SwitchToNextObject() 
    {
        if (!this.canSwitchObject) return; 
        if (this.currentProjectIndex < JSON.projects.length - 1) 
        {
            this.currentProjectIndex++;
        } 
        else this.currentProjectIndex = 0; 
        await this.SwitchObject(1, 0.66); 
    }

    async SwitchObject(direction, duration) 
    {
        Helpers.UpdateCarouselDots(this.currentProjectIndex); 

        this.canSwitchObject = false; 
        this.canRotateCamera = true; 
        this.switchTimer = TIMER_SWITCH;  
        this.canUpdateTimer = false; 
        this.canPinch = true; 

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
        this.SmoothGradientTransition(this.currentPFObject.metadata.gradientBackground, this.nextPFObject.metadata.gradientBackground, duration);

        await this.projectPageFactory.CreatePage(this.nextPFObject); 
    
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

                //this.animationStartTime = 0; 
                this.currentPFObject.voxelStartAnimationOver = true; 
                this.canRotateCamera = true; 
                this.canSwitchObject = true;
                this.canUpdateTimer = true; 
 
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
        const delta = this.clock.getDelta(); 
        this.world.step(WORLD_STEP_VALUE);

        if (this.stats) this.stats.update(); 

        //this.AnimatePlane();
        if (this.useJsonData) 
        {
            this.UpdateSwitchTimer(delta);  
            this.AnimateCamera(delta); 
            
            if (this.frameCounter % paramsGrid.frameSkip == 0) this.AnimateVoxelGrid(); 
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

    UpdateSwitchTimer(delta) 
    {
        if (this.canUpdateTimer) this.switchTimer -= delta; 

        const gradientPercentage = (1 - (this.switchTimer / TIMER_SWITCH)) * 100;  
        const dot = document.querySelector('.dot.active'); // Select the dot with the active class
        if (dot) dot.style.background = `conic-gradient(#949494 ${gradientPercentage}%, 0, #FFFFFF)`;
    
        if (this.switchTimer <= 0) 
        {
            this.switchTimer = TIMER_SWITCH; // Reset the timer
            this.SwitchToNextObject(); 
        }
    }

    AnimateVoxelGrid() 
    {
        if (this.voxelGrid == null) return; 
        const gradient = this.currentPFObject.metadata.gradientGrid; 
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
                * paramsGrid.voxelSize - 8;

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
            this.camera.position.set(x, (orbitMinheight + orbitMaxHeight) / 2, z);

            const lookAtY = this.currentPFObject.MaxY() / 2;
            this.currentLookAt.set(this.currentPFObject.voxelizedMesh.position.x, lookAtY, this.currentPFObject.voxelizedMesh.position.z);
    
            // Set the camera to look at the initial position of the target object
            this.camera.lookAt(this.currentLookAt);
        }
    }

    AnimateCamera(delta) {
        if (this.currentPFObject != null &&
            this.currentPFObject.voxelStartAnimationOver === true &&
            this.canRotateCamera)
        {
            this.animationStartTime += delta; 
            // Calculate elapsed time since the animation started
            const elapsedTime = (this.animationStartTime) * orbitSpeed;

            // Calculate the new camera position based on elapsed time
            const x = orbitRadius * Math.sin(-elapsedTime);
            const z = orbitRadius * Math.cos(-elapsedTime);
            
            // Calculate the vertical Y position with up-and-down oscillation
            const midpointY = (orbitMinheight + orbitMaxHeight) / 2;
            const amplitudeY = (orbitMinheight - orbitMaxHeight) / 2;
            const frequency = 2; // Adjust for the speed of the vertical motion

            const y = midpointY + amplitudeY * Math.sin(frequency * elapsedTime);

            // Set the camera's position
            this.camera.position.set(x, y, z);

            // Set the camera to look at the initial position of the target object
            this.camera.lookAt(this.currentLookAt);
        }
    }
}    
