import * as THREE from 'three'; 
import * as CANNON from 'cannon';
import gsap from 'gsap';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GUI } from 'dat.gui'

import Engine from './engine'; 
import Helpers from './helpers'; 
import Voxel from './voxel'; 
import ObjectPortfolio from './objectPortfolio';

/* ENGINE STATES CONST */
const worldStepValue = 1/60; 

const defaultParams = 
{
    gridSize: .2,
    modelSize: 6,
    boxSize : .2,
    boxRoundness: .025
};

const usesJson = true; 
const glbPath = "../meshes/Spaceship.glb";
const projectDataPathArray = 
[
    '../data/Spaceship_data.json',
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

        this.defaultJsonPath = projectDataPathArray[this.currentProjectIndex]; 

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
        this.renderer.shadowMap.type = THREE.BasicShadowMap;
        this.renderer.localClippingEnabled = true; 

        // Create the composer for post-processing
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));

        // Create and configure the bloom pass
        const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
        this.composer.addPass(bloomPass);

        this.camera = new THREE.PerspectiveCamera(
            80,
            window.innerWidth / window.innerHeight,
            0.1,
            100000
        );
        
        this.dummyCamera = new THREE.OrthographicCamera(
            window.innerWidth / - 2, 
            window.innerWidth / 2, 
            window.innerHeight / 2, 
            window.innerHeight / - 2,
            - 10000, 
            10000
        );
        this.dummyCamera.position.z = 1; 
        this.dummyScene = new THREE.Scene(); 
        this.rtTexture = new THREE.WebGLRenderTarget( 
            window.innerWidth / 4, //resolution x
            window.innerHeight / 4, //resolution y
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
        this.renderer.autoClear = false;

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    }

    InitializeCannon() 
    {
        this.world = new CANNON.World();
        this.world.gravity.set(0, -9.81, 0); // Set gravity to zero initially
    }

    async InitializeGame() 
    {
        super.InitializeGame(); 

        this.camera.position.set(0, 1, 10); // Adjust the position as needed
        this.camera.lookAt(0, 1, 0);

        this.controls.mouseButtons = 
        {
            MIDDLE: THREE.MOUSE.ROTATE
        }

        var ambientLight = new THREE.DirectionalLight(0xFFFFFF, 3);
        ambientLight.position.set(10, 10, 10); 
        ambientLight.castShadow = true; 

        this.scene.add(ambientLight);

        this.canvas = document.createElement('canvas');
        this.context = this.canvas.getContext('2d', {willReadFrequently: true});
        this.canvas.width = 512;
        this.canvas.height = 512;

        Helpers.CreateCarouselDots(projectDataPathArray.length, this.currentProjectIndex);

        if (this.useJsonData) 
        {
            try 
            {
                this.currentPFObject = new ObjectPortfolio("Load", this.defaultJsonPath);
                
                // Load the object asynchronously
                await this.currentPFObject.load();

                this.gradientTexture = Helpers.CreateGradientTexture(this.currentPFObject.metadata, this.context, this.canvas);
                this.scene.background = this.gradientTexture; 
        
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
                    Helpers.AnimateVoxels(this.currentPFObject);

                    this.currentPFObject.voxelizedMesh.position.x += 2; 

                    this.scene.add(this.shadowPlane);
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
                    this.scene.add(this.currentPFObject.originalMesh); 
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
        document.getElementById('author-name').textContent = portfolioMetadata.yearStart;
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
            gradientStart: "#000000", 
            gradientEnd: "#000000"
        };

        const portfolioMetadata = 
        {
            projectName: "projectName", 
            companyName: "companyName",
            yearStart: "2023",
            yearEnd: "2024", 
            tasks: "Game Design", 
            description: "A short description of the project. Maximum number of characters: 64"
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
            darkOverlay.style.opacity = opacity;
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

        this.nextPFObject = new ObjectPortfolio("Load", projectDataPathArray[this.currentProjectIndex]);
        await this.nextPFObject.load();

        const currentMetadata = this.currentPFObject.metadata; 
        const newMetadata = this.nextPFObject.metadata;  
        const currentGradient = {start: currentMetadata.gradientStart, end: currentMetadata.gradientEnd};
        const newGradient = {start: newMetadata.gradientStart, end: newMetadata.gradientEnd};
        this.SmoothGradientTransition(currentGradient, newGradient, duration * 1000);

        const positionOffset = direction * window.innerWidth * 0.05; 
        this.nextPFObject.voxelizedMesh.position.x = positionOffset; 
        this.scene.add(this.nextPFObject.voxelizedMesh); 

        Helpers.UpdateCarouselDots(this.currentProjectIndex); 

        gsap.to(this.currentPFObject.voxelizedMesh.position, {
            x: -positionOffset, // Move the current object out of the screen
            duration: duration, 
            ease: "power2.inOut"
        });

        gsap.to(this.currentPFObject.originalMesh.position, {
            x: -positionOffset, // Move the current object out of the screen
            duration: duration, 
            ease: "power2.inOut"
        });
    
        gsap.to(this.nextPFObject.voxelizedMesh.position, {
            x: 0, // Move the new object to the center
            duration: duration,
            ease: "power2.inOut",
            onComplete: () => {
                // Clean up old object
                this.ClearPortfolioObject();
                this.currentPFObject = this.nextPFObject;
                this.currentPFObject.voxelStartAnimationOver = true; 
                this.InitializeHTML(); 
                this.canSwitchObject = true; 
            }
        });

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
    
    SmoothGradientTransition(oldGradient, newGradient, duration = 500) 
    {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 512;
        canvas.height = 512;
    
        let startTime = null;
    
        const interpolateColor = (start, end, t) => {
            const startRGB = start.match(/\w\w/g).map((x) => parseInt(x, 16));
            const endRGB = end.match(/\w\w/g).map((x) => parseInt(x, 16));
            const interpolated = startRGB.map((start, i) => Math.round(start + (endRGB[i] - start) * t));
            return `#${interpolated.map((x) => x.toString(16).padStart(2, '0')).join('')}`;
        };
    
        const animate = (timestamp) => {
            if (!startTime) startTime = timestamp;
            const elapsed = timestamp - startTime;
            const t = Math.min(elapsed / duration, 1);
    
            const startColor = interpolateColor(oldGradient.start, newGradient.start, t);
            const endColor = interpolateColor(oldGradient.end, newGradient.end, t);
    
            const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
            gradient.addColorStop(0, startColor);
            gradient.addColorStop(1, endColor);
    
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

        this.AnimateVoxelizedMesh();

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
                ease: "power1.inOut",  // Smoother easing
                onStart: () => {
                    console.log("Animation Start - Position:", this.currentPFObject.voxelizedMesh.position);
                },
                onComplete: () => {
                    console.log("Animation Complete - Position:", this.currentPFObject.voxelizedMesh.position);
                }
            });
    
            // Continuous rotation animation
            timeline.to(this.currentPFObject.voxelizedMesh.rotation, {
                y: "+=" + Math.PI * 2, // Rotate 360 degrees around the Y axis
                duration: 16,  // Duration of one full rotation
                ease: "none",  // Linear rotation
                onUpdate: () => {
                    // Force update of rotation
                    this.currentPFObject.voxelizedMesh.rotation.y += 0; 
                    this.currentPFObject.voxelizedMesh.needsUpdate = true;
                }
            }, .33); // Start immediately after 1 second

            // Continuous rotation animation
            timeline.to(this.currentPFObject.voxelizedMesh.position, {
                y: "+=" + 1,
                duration: 16,
                ease: "elastic.out",  // Linear rotation
                onUpdate: () => {
                    // Force update of rotation
                    this.currentPFObject.voxelizedMesh.rotation.y += 0; 
                    this.currentPFObject.voxelizedMesh.needsUpdate = true;
                }
            }, .1); // Start immediately after .1 second
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
