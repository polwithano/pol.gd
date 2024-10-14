import * as THREE from 'three';

import EngineProject from './project/engineProject';
import JSON from '../data/masterJSON';
import MenuController from './menuController';
import gsap from 'gsap';

export default class Manager 
{
    constructor(canvasID) 
    {
        this.introductionPanelOpen = true;        
        this.canvasID = canvasID; 
        this.canvas = document.querySelector(canvasID); 
        this.currentEngine = null; 
    }

    async Initialize() 
    {
        this.DefineListeners(); 
        this.AddEventListeners(); 
        
        await this.InitializeMenu();
        await this.LoadEngine('EngineProject'); 
    }

    async InitializeMenu() 
    {
        this.menuController = new MenuController(); 
        await this.menuController.Initialize(); 

        // Menu Listeners
        document.querySelector('.explorer').addEventListener('click', (event) => 
        {
            if (this.IsCurrentEngine('EngineProject')) 
            {
                const folderHeader = event.target.closest('.folder-header');
                const project = event.target.closest('.project'); 
    
                if (folderHeader) 
                {
                    const folderID = folderHeader.getAttribute('data-folder-id');
                    this.menuController.ToggleFolder(folderID);
    
                    return; 
                }
                if (project) 
                {
                    const projectName = project.getAttribute('data-project-name');
                    const index = JSON.projects.indexOf(projectName);
    
                    if (index == this.currentEngine.indexProject || this.currentEngine.allowProjectLoading == false) return; 

                    this.currentEngine.TransitionProject(index)
                    this.menuController.UpdateSelectedProject(index); 

                    return; 
                }   
            }
            else if (this.IsCurrentEngine('EngineBlog')) 
            {
                
            }
        });
    }

    // #region Engine Methods
    async LoadEngine(engineName) 
    {
        if (this.currentEngine != null) 
        {
            this.currentEngine.Destroy(); 
            this.currentEngine = null; 
        }

        this.currentEngine = this.GetEngine(engineName);
        await this.currentEngine.Initialize();  

        const context = this.currentEngine.renderer.getContext();
        if (!context) console.error("WebGL context failed to initialize.");

        console.log("Canvas width:", this.canvas.width, "Canvas height:", this.canvas.height);
        console.log("Renderer size:", this.currentEngine.renderer.getSize(new THREE.Vector2()));
    }

    GetEngine(engineName) 
    {
        switch (engineName) 
        {
            case 'EngineProject': 
                return new EngineProject(this.canvasID); 
            default:
                throw new Error(`Unknown engine class: ${engineName}`);
        }
    }

    IsCurrentEngine(name) 
    {
        return this.currentEngine && this.currentEngine.constructor.name === name; 
    }
    // #endregion

    CloseIntroductionPanel() 
    {
        const panel = document.getElementById('intro-section');
        this.introductionPanelOpen = false; 
        
        // Limit the scroll position so that it doesn't move beyond a certain point
        const maxScroll = window.innerHeight; // Adjust based on how far you want to move it
    
        // Use GSAP to animate the position and opacity smoothly
        gsap.to(panel, {
            y: -maxScroll * 0.90,   // equivalent to `translateY`
            duration: 1.5,       // adjust for how smooth/fast you want it
            ease: "elastic.inOut",   // easing function for a smoother animation
            onComplete: () => {
                panel.style.pointerEvents = 'none';  // Disable pointer events after fade out 
            }
        });
    }

    // #region Listener Methods
    DefineListeners() 
    {
        this.scrollListener = (event) => this.OnScroll(event);
    }

    AddEventListeners() 
    {
        window.addEventListener('wheel', this.scrollListener, false);

        document.getElementById('arrow-down').addEventListener('click', () => 
        {
            if (this.introductionPanelOpen) this.CloseIntroductionPanel(); 
        })
    }
    // #endregion

    // #region Input Methods
    OnScroll(event) 
    {
        if (this.introductionPanelOpen) this.CloseIntroductionPanel(); 
    }
    // #endregion
}