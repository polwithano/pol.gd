import * as THREE from 'three';

import Engine from '../engine';

export default class EngineBlog extends Engine 
{
    constructor(canvasID, urlParams) 
    {
        super(canvasID); 
        this.urlParams = urlParams; 

        this.currentPost = null; 
        this.indexPost = 0; 
    }

    // #region Initialize Methods
    async Initialize() 
    {
        super.Initialize(); 

        await this.CreateHTML(); 
        await this.InitializeLogic();  
    }

    InitializeThreeJS() 
    {
        super.InitializeThreeJS(); 

        this.camera = new THREE.PerspectiveCamera(80, 2, 1, 1000);
    }

    async InitializeLogic() 
    {
        super.InitializeLogic(); 

        if (this.urlParams != null && this.urlParams != undefined) 
        {
            const postID = parseInt(this.urlParams.get('post-id'), 10);
            console.log(postID);
        }
    }
    // #endregion

    // #region HTML/Elements Methods
    async CreateHTML() 
    {
        const container = document.getElementById('canvas-container'); 
        const elements = container.querySelectorAll(':not(#bg)'); 
        
        elements.forEach(element => element.remove()); 
    }
    // #endregion

    // #region Post Methods
    async LoadPostUsingName(name) 
    {
        
    }
    // #endregion
}