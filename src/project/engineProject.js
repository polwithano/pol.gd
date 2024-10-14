import * as THREE from 'three';

import Background from '../portfolio/helpers/backgrounds';
import CameraProject from './cameraProject';
import Engine from '../engine';
import Helpers from '../helpers';
import ICON from '../../public/media/portfolio-icons/masterICON'
import JSON from '../../data/masterJSON';
import ObjectPortfolio from '../portfolio/objectPortfolio';
import ProjectPageFactory from '../portfolio/projectPageFactory';
import Shaders from '../portfolio/shadersPortfolio';
import { SimplexNoise } from 'three/examples/jsm/Addons.js';
import SplitType from 'split-type';
import TagManager from '../portfolio/tagManager'
import Voxel from '../voxel';
import gsap from 'gsap';

const SIMPLEX = new SimplexNoise(); 
const TOGGLE_DEBUG = false; 
const LOFI_RENDER_SCALE = 4; 
const CARROUSEL_TIMER = 15; 

const CAMERA_PARAMS = {
    orbitalRadius:     7,
    orbitalSpeed:    .25,
    orbitalMinHeight:  0,
    orbitalMaxHeight:  3 
}

const GRID_PARAMS = {
    type:        "circ",
    size:            50,
    voxelSize:      .75,
    frameSkip:        4,
    coefficientXY:   20,
    coefficientZ:     3,
    updateDelta: .000015
}

export default class EngineProject extends Engine 
{
    constructor(canvasID) 
    {
        super(canvasID); 

        this.renderModeLofi = false;
        this.renderModeGrid = true;
        
        this.allowProjectLoading = true;  
        this.allowPageLoading = false;  

        this.currentProject = null; 
        this.nextProject = null; 
        this.indexProject = 0; 
    }

    // #region Initialize Methods
    async Initialize() 
    {
        super.Initialize(); 

        await this.InitializeLogic(); 
        this.InitializeScene();
        this.InitializeHTML(); 
        this.InitializeListeners(); 
        
        this.GameLoop(this.currentTimestamp);
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

        this.canvas = document.createElement('canvas');
        this.context = this.canvas.getContext('2d', {willReadFrequently: true});
        this.canvas.width = 2048;
        this.canvas.height = 2048;

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
        this.cameraDummy = new THREE.OrthographicCamera(window.innerWidth / -2, window.innerWidth / 2, window.innerHeight / 2, window.innerHeight / -2, -10000, 10000);
        this.cameraDummy.position.z = 1; 

        this.renderTarget = Shaders.RenderTarget(window, renderScale); 
        
        const pixelationMaterial = Shaders.PixelationMaterial(this.renderTarget)
        const edgeDetectionMaterial = Shaders.EdgeDetectionMaterial(this.renderTarget, this.camera.position, pixelationScale); 

        if (this.quad != null) this.sceneDummy.remove(this.quad);
        if (this.outlineQuad != null) this.sceneDummy.remove(this.outlineQuad); 

        this.quad = new THREE.Mesh(renderPlane, pixelationMaterial);
        this.outlineQuad = new THREE.Mesh(renderPlane, edgeDetectionMaterial);
        
        this.quad.position.z = -1000;
        this.outlineQuad.position.z = -1000; 

        this.sceneDummy.add(this.quad);
        this.sceneDummy.add(this.outlineQuad); 
    }

    async InitializeLogic() 
    {
        super.InitializeLogic();

        this.pageFactory = new ProjectPageFactory(document.getElementById('project-container'));
        await this.pageFactory.Initialize(); 
        this.currentProject = await this.LoadProject(JSON.projects[this.indexProject]);
        
        this.cameraController = new CameraProject(this.camera);
        this.cameraController.Initialize(this.currentProject); 
    }

    InitializeScene() 
    {
        this.directionalLight = new THREE.DirectionalLight(0xffffff, 4);
        this.directionalLight.position.set(10, 10, 10); 

        const gradientTexture = Background.CreateMultiGradientTexture(this.currentProject.metadata.gradientBackground, this.context, this.canvas);
        this.voxelBackground = Voxel.CreateVoxelCircle(GRID_PARAMS.size, GRID_PARAMS.voxelSize);
         
        this.scene.fog = new THREE.Fog(0xFFFFFF, 10, GRID_PARAMS.size * 0.95); 
        this.scene.background = gradientTexture; 
        this.scene.add(this.directionalLight); 
        this.scene.add(this.voxelBackground);
    }

    InitializeListeners() 
    {
        const elements = this.FetchHTMLElements(); 
        const switches = document.querySelectorAll('input[type="checkbox"]');
        const previousArrow = document.getElementById('leftArrowSwitch'); 
        const nextArrow = document.getElementById('rightArrowSwitch'); 

        previousArrow.addEventListener('click', () => {this.TransitionToPrevious();});     
        nextArrow.addEventListener('click', () => {this.TransitionToNext(); });  

        switches.forEach((switchElement) => 
        {
            const isLofiSwitch = switchElement.closest('.switch').classList.contains('lofi');
            const isGridSwitch = switchElement.closest('.switch').classList.contains('grid');

            // Set the checked state based on current boolean values
            if (isLofiSwitch) switchElement.checked = this.renderModeLofi;
            else if (isGridSwitch) switchElement.checked = this.renderModeGrid;
            
            switchElement.addEventListener('change', (event) => {
                if (isLofiSwitch) 
                {
                    this.renderModeLofi = event.target.checked;
                    this.InitializeRenderTarget(this.renderModeLofi);
                } 
                else if (isGridSwitch) 
                {
                    this.renderModeGrid = event.target.checked;
                    if (this.voxelBackground != undefined && this.voxelBackground != null) this.renderModeGrid ? this.scene.add(this.voxelBackground) : this.scene.remove(this.voxelBackground);
                }
            });
        });

        elements.carouselDots.forEach(dot => 
        {
            dot.addEventListener('click', (event) => 
            {
                const target = event.target.closest('.dot');
                const index = parseInt(target.getAttribute('project-index'), 10);

                if (index === this.indexProject || !this.allowProjectLoading) return;
                this.TransitionProject(index); 
            });
        });

        this.descriptionBufferTimeline = Helpers.ElementScreenShake(0.175, 0.80, 12, elements.projectDescription, () => 
        {
            this.pageFactory.OpenPage();  
        });

        elements.projectDescription.addEventListener('mouseenter', () => {
            if (this.allowPageLoading) {
                this.descriptionBufferTimeline.timeScale(1).play();
            }
        });
        elements.projectDescription.addEventListener('mouseleave', () => {this.descriptionBufferTimeline.timeScale(1.67).reverse();});
    }
    // #endregion

    // #region Projects Methods
    async LoadProject(path) 
    {
        try 
        {
            const object = new ObjectPortfolio("Load", path);
            await object.Load(); 

            if (object.voxelizedMesh != null) 
            {
                object.voxelizedMesh.position.x = 0; 
                object.voxelizedMesh.position.y = (object.MinY() + object.MaxY()) / 2; 
                object.voxelizedMesh.rotation.y = object.voxelMetadata.startingRotation * (Math.PI / 180); 

                this.scene.add(object.voxelizedMesh);        
                await this.pageFactory.CreatePage(object);  
                
                return object; 
            }
            else console.error('ObjectPortfolio could not load voxelized mesh.')
        }
        catch (e) {console.error(`ObjectPortfolio failed to load JSON: ${e}`);} 
    }

    TransitionToNext() 
    {
        if (!this.allowProjectLoading) return; 

        let index = this.indexProject + 1; 
        if (index > JSON.projects.length) index = 0; 

        this.TransitionProject(index); 
    }

    TransitionToPrevious() 
    {
        if (!this.allowProjectLoading) return;

        let index = this.indexProject - 1;
        if (index < 0) index = JSON.projects.length - 1;  
        
        this.TransitionProject(index)
    }

    async TransitionProject(index) 
    {
        if (!this.allowProjectLoading) return; 
        
        const direction = index > this.indexProject ? 1 : -1; 
        const duration = 0.5; 
        const perpendicular = this.camera.position.clone().applyAxisAngle(this.camera.up, direction * Math.PI / 2);
        const distance = window.innerWidth * 0.005;
        const position = perpendicular.multiplyScalar(distance);
        const project = await this.LoadProject(JSON.projects[index]); 
        const lookAt = (project.MinY() + project.MaxY()) / 2;   

        this.allowProjectLoading = false; 
        this.cameraController.canRotate = false;
        
        Helpers.UpdateCarouselDots(index);
 
        project.voxelizedMesh.position.copy(position); 
        project.voxelizedMesh.rotation.y = project.voxelMetadata.startingRotation * (Math.PI / 180); 

        gsap.to(this.currentProject.voxelizedMesh.position, 
        {
            x: -position.x, 
            z: -position.z, 
            duration: duration,
            ease: "power2.inOut"        
        }); 

        gsap.to(project.voxelizedMesh.position, 
        {
            x: 0, y: 0, z: 0, 
            duration: duration,
            ease: "power2.inOut", 
            onComplete: () => 
            {
                this.ClearProject(this.currentProject);
                this.currentProject = project;
                this.UpdateHTML();  

                this.allowProjectLoading = true; 
                this.cameraController.canRotate = true; 
                this.cameraController.ProjectTransition(lookAt, duration);
                
                this.indexProject = index; 
            }
        }); 
    }

    ClearProject(project) 
    { 
        this.scene.remove(project.voxelizedMesh); 
        this.scene.remove(project.originalMesh);
    }
    // #endregion

    // #region HTML/Elements Methods
    InitializeHTML() 
    {
        const elements = this.FetchHTMLElements(); 
        const projectMetadata = this.currentProject.metadata; 
        const voxelMetadata = this.currentProject.voxelMetadata; 

        this.UpdateTextElement(elements.projectName, projectMetadata.projectName);
        this.UpdateTextElement(elements.companyName, projectMetadata.companyName);
        this.UpdateTextElement(elements.authorName, projectMetadata.yearString);
        this.UpdateTextElement(elements.projectYear, projectMetadata.tasks);
        this.UpdateTextElement(elements.projectDescription, projectMetadata.description);
        this.UpdateIcons(); 

        elements.projectTag.innerHTML = ''; // Clear the tag container
        elements.projectTag.appendChild(TagManager.TagElement(projectMetadata.tag, "tag"));
        elements.copyrightModel.innerHTML = `© Original Model • <a href="${voxelMetadata.modelLink}" target="_blank">${voxelMetadata.author}</a>`;

        Helpers.CreateCarouselDots(JSON.projects.length, this.indexProject);  

        this.allowPageLoading = true; 
    }

    async UpdateHTML() 
    {
        this.allowPageLoading = false; 
        
        const elements = this.FetchHTMLElements(); 
        const projectMetadata = this.currentProject.metadata; 
        const voxelMetadata = this.currentProject.voxelMetadata; 

        const vsOpts = {duration: 0.20, lineHeight: 100};

        // Array of promises to update text content with animations
        const promises = [
            this.UpdateTextWithAnimation(elements.projectName, projectMetadata.projectName, vsOpts),
            this.UpdateTextWithAnimation(elements.projectYear, projectMetadata.tasks, vsOpts),
            this.UpdateTextWithAnimation(elements.projectDescription, projectMetadata.description, vsOpts)
        ];

        this.UpdateTextElement(elements.companyName, projectMetadata.companyName);
        this.UpdateTextElement(elements.authorName, projectMetadata.yearString);
        elements.projectTag.innerHTML = '';  // Clear the tag container
        elements.projectTag.appendChild(TagManager.TagElement(projectMetadata.tag, "tag"));
        elements.copyrightModel.innerHTML = `© Original Model • <a href="${voxelMetadata.modelLink}" target="_blank">${voxelMetadata.author}</a>`;

        await Promise.all(promises);
        await this.UpdateIcons();

        this.allowPageLoading = true; 
    }

    FetchHTMLElements() 
    {
        return {
            projectName: document.getElementById('project-name'),
            projectTag: document.getElementById('project-tag'),
            companyName: document.getElementById('company-name'),
            authorName: document.getElementById('author-name'),
            projectYear: document.getElementById('project-year'),
            projectDescription: document.getElementById('project-description'),
            overlay: document.getElementById('darkOverlay'),
            projectContainer: document.getElementById('project-container'),
            copyrightModel: document.getElementById('copyright-model'),
            iconsContainer: document.getElementById('portfolio-icons'),
            carouselDots: document.querySelectorAll('.dot')
        };
    }

    UpdateTextElement(element, textContent) {element.textContent = textContent;}

    async UpdateIcons() 
    {
        const elements = this.FetchHTMLElements();
        const iconsContainer = elements.iconsContainer;
        iconsContainer.innerHTML = '';
        
        const iconPromises = this.currentProject.content.icons.map(async (icon) => 
        {
            const iconDiv = document.createElement('div');
            iconDiv.className = 'icon';

            const img = document.createElement('img');
            img.className = 'icon-img';

            try 
            {
                const iconSrc = await ICON.LoadIcon(icon.image);
                img.src = iconSrc.default || iconSrc;
                img.className = 'icon-img';

                const p = document.createElement('p');
                p.textContent = icon.name;

                iconDiv.appendChild(img);
                iconDiv.appendChild(p);
                iconsContainer.appendChild(iconDiv);
            } 
            catch (error) 
            {
                console.error('Failed to load icon:', error);
            }
        });

        await Promise.all(iconPromises); // Wait for all icons to load
    }

    UpdateTextElement(element, textContent) {
        element.textContent = textContent;
    }

    // Helper function to handle animated text updates
    async UpdateTextWithAnimation(element, newText, options) 
    {
        return new Promise((resolve) => 
        {
            const splitInstance = new SplitType(element, {types: 'chars'});
            const oldChars = splitInstance.chars;

            gsap.to(oldChars, 
            {
                duration: options.duration,
                y: -options.lineHeight,
                opacity: 0,
                stagger: options.duration / 10,
                ease: "steps(2)",
                onComplete: () => 
                {
                    splitInstance.revert();
                    element.textContent = newText;

                    const newSplitInstance = new SplitType(element, {types: 'chars'});
                    const newChars = newSplitInstance.chars;

                    gsap.from(newChars, {
                        duration: options.duration,
                        y: options.lineHeight,
                        opacity: 0,
                        stagger: options.duration / 10,
                        ease: "steps(2)",
                        onComplete: () => {
                            splitInstance.revert();
                            resolve();
                        }
                    });
                }
            });
        });
    }
    // #endregion

    // #region Listeners Methods
    DefineListeners() 
    {
        super.DefineListeners(); 
    
        this.mouseDownListener = (event) => {
            if (!this.IsButton(event)) {
                if (event.button == 0) {
                    this.OnLeftMouseDown(event);
                }
            }
        };
    
        this.mouseUpListener = (event) => {
            if (!this.IsButton(event)) {
                if (event.button == 0) {
                    this.OnLeftMouseUp(event);
                }
            }
        };
    
        this.mouseMoveListener = (event) => {this.OnMouseMove(event);};
    }
    
    AddEventListeners() 
    {
        super.AddEventListeners(); 
    
        // Add new event listeners to the document using stored references
        document.addEventListener('mousedown', this.mouseDownListener);    
        document.addEventListener('mouseup', this.mouseUpListener); 
        document.addEventListener('mousemove', this.mouseMoveListener); 
    }
    
    RemoveEventListeners() 
    {
        super.RemoveEventListeners(); 
    
        // Remove existing event listeners for the document using stored references
        document.removeEventListener('mousedown', this.mouseDownListener);
        document.removeEventListener('mouseup', this.mouseUpListener);
        document.removeEventListener('mousemove', this.mouseMoveListener);
    }
    // #endregion

    // #region Input Methods
    OnMouseMove(event) 
    {
        if (this.currentProject) this.currentProject.OnDrag(event.clientX, event.clientY); 
    }

    OnLeftMouseDown(event) 
    {
        if (this.currentProject) this.currentProject.OnDragStart(event.clientX, event.clientY); 
    }

    OnLeftMouseUp(event) 
    {
        if (this.currentProject) this.currentProject.OnDragEnd(); 
    }
    // #endregion

    GameLoop() 
    {
        super.GameLoop();
        const delta = this.clock.getDelta(); 

        this.cameraController.Update(delta); 
        if (this.frameCounter % GRID_PARAMS.frameSkip == 0) this.UpdateVoxelBackground(); 

        // 1. Render the voxelized objects at lower resolution
        this.renderer.setRenderTarget(this.renderTarget);  
        this.renderer.clear();  
        this.renderer.render(this.scene, this.camera);

        // 2. Composite the low-res voxelized render on top of the high-res background
        this.renderer.setRenderTarget(null); 
        this.renderer.clearDepth();
        this.renderer.render(this.sceneDummy, this.cameraDummy); 
    }

    UpdateVoxelBackground() 
    {
        if (this.voxelBackground == null || this.voxelBackground == undefined) return; 

        const gradient = this.currentProject != undefined ? this.currentProject.metadata.gradientGrid : ['#FFFFFF', '#BBBBBB']
        const time = Date.now() * GRID_PARAMS.updateDelta;
        const voxelCount = this.voxelBackground.count; 

        const colorA = new THREE.Color(gradient[gradient.length - 1]);
        const colorB = new THREE.Color(gradient[0]);

        const m_ =  new THREE.Matrix4();
        const p_ = new THREE.Vector3();
        const c_ = new THREE.Color(); 

        let minY = Infinity; 
        let maxY = -Infinity; 

        for (let i = 0; i < voxelCount; i++) 
        {
            this.voxelBackground.getMatrixAt(i, m_); 
            p_.setFromMatrixPosition(m_); 

            const noise = SIMPLEX.noise4d(
                p_.x / GRID_PARAMS.coefficientXY,
                p_.z / GRID_PARAMS.coefficientXY,
                time,
                2
            )
            p_.y = Math.round(noise * GRID_PARAMS.coefficientZ / GRID_PARAMS.voxelSize) * GRID_PARAMS.voxelSize - 8;
            
            if (p_.y < minY) minY = p_.y; 
            if (p_.y > maxY) maxY = p_.y; 

            m_.setPosition(p_); 
            this.voxelBackground.setMatrixAt(i, m_); 
        }
        
        for (let i = 0; i < voxelCount; i++) 
        {
            this.voxelBackground.getMatrixAt(i, m_); 
            p_.setFromMatrixPosition(m_); 

            const normalizedY = (p_.y - minY) / (maxY - minY);
            c_.lerpColors(colorA, colorB, normalizedY); 

            m_.setPosition(p_); 
            this.voxelBackground.setMatrixAt(i, m_);
            this.voxelBackground.setColorAt(i, c_)
        }

        this.voxelBackground.instanceMatrix.needsUpdate = true; 
        this.voxelBackground.instanceColor.needsUpdate = true; 
    }
}