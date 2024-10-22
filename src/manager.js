import * as THREE from 'three';

import EngineBlog from './blog/engineBlog';
import EngineProject from './project/engineProject';
import MenuController from './menuController';
import PROJECTS from './ledgers/projects';
import gsap from 'gsap';

export default class Manager 
{
    constructor(canvasID, path, urlParams) 
    {
        this.introductionPanelOpen = true;        
        this.canvasID = canvasID; 
        this.canvas = document.querySelector(canvasID); 
        this.currentEngine = null; 

        this.path = path; 
        this.urlParams = urlParams; 

        console.log('URL path:', this.path);
        console.log('URL parameters:', this.urlParams);
    }

    async Initialize() 
    {
        await this.InitializeMenu();
        
        this.DefineListeners(); 
        this.AddEventListeners(); 
        
        await this.LoadEngineUsingURLParams(); 
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
                    this.menuController.ToggleFolderWithID(folderID);
    
                    return; 
                }
                if (project) 
                {
                    const projectName = project.getAttribute('data-project-name');
                    const index = PROJECTS.projects.indexOf(projectName);
    
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

    async LoadEngineUsingURLParams() 
    {
        if (this.path.includes('/portfolio')) 
        {
            await this.LoadEngine('EngineProject', this.urlParams);
            this.menuController.SwitchMode("Portfolio");  
        }
        else if (this.path.includes('/blog')) 
        {
            await this.LoadEngine('EngineBlog', this.urlParams); 
            this.menuController.SwitchMode("Blog");
        }
        else if (this.path.includes('/links')) 
        {
            await this.LoadEngine('EngineProject');  
            this.menuController.SwitchMode("Links");
        }
        else 
        {
            await this.LoadEngine('EngineProject'); 
            this.menuController.SwitchMode("Portfolio");
        }
    }

    // #region Engine Methods
    async LoadEngine(engineName, params) 
    {
        if (this.currentEngine != null) 
        {
            this.currentEngine.Destroy(); 
            this.currentEngine = null; 
        }

        this.currentEngine = this.GetEngine(engineName, params);
        await this.currentEngine.Initialize();  

        const context = this.currentEngine.renderer.getContext();
        if (!context) console.error("WebGL context failed to initialize.");

        console.log("Canvas width:", this.canvas.width, "Canvas height:", this.canvas.height);
        console.log("Renderer size:", this.currentEngine.renderer.getSize(new THREE.Vector2()));
    }

    GetEngine(engineName, params) 
    {
        switch (engineName) 
        {
            case 'EngineProject': 
                return new EngineProject(this.canvasID, params, this.menuController); 
            case 'EngineBlog':
                return new EngineBlog(this.canvasID, params); 
            default:
                throw new Error(`Unknown engine class: ${engineName}`);
        }
    }

    IsCurrentEngine(engineClass) 
    {
        switch (engineClass) {
            case 'EngineProject':
                return this.currentEngine instanceof EngineProject;
            case 'EngineBlog':
                return this.currentEngine instanceof EngineBlog;
            default:
                return false;
        }
    }
    
    // #endregion

    CloseIntroductionPanel() 
    {
        const panel = document.getElementById('intro-section');
        this.introductionPanelOpen = false; 
        
        const maxScroll = window.innerHeight; 
    
        gsap.to(panel, {
            y: -maxScroll * 1.2,   
            duration: 1.5,       
            ease: "elastic.inOut",   
            onComplete: () => {
                panel.style.pointerEvents = 'none';  // Disable pointer events after fade out 
                panel.style.opacity = '0'; 
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

        document.getElementById('scroll-indicator').addEventListener('click', () => 
        {
            if (this.introductionPanelOpen) this.CloseIntroductionPanel(); 
        })

        // Menu-related listeners
        const togglePortfolio = document.getElementById('toggle-projects');
        const toggleBlog = document.getElementById('toggle-blog');
        const toggleLinks = document.getElementById('toggle-links');  

        togglePortfolio.addEventListener('click', () => 
        {
            this.menuController.SwitchMode("Portfolio");
            if (!this.IsCurrentEngine('EngineProject')) 
            {
                this.LoadEngine('EngineProject');
                // Update URL to /portfolio
                history.pushState({}, '', '/portfolio');
            } 
        });

        toggleBlog.addEventListener('click', () => 
        {
            this.menuController.SwitchMode("Blog");
            if (!this.IsCurrentEngine('EngineBlog')) 
            {
                this.LoadEngine('EngineBlog');
                // Update URL to /blog
                history.pushState({}, '', '/blog');
            } 
        });

        toggleLinks.addEventListener('click', () => 
        {                 
            this.menuController.SwitchMode("Links");
            // Update URL to /links
            history.pushState({}, '', '/links'); 
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