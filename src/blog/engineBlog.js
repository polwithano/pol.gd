import Engine from '../engine';

export default class EngineBlog extends Engine 
{
    constructor(canvasID, urlParams) 
    {
        super(canvasID); 
        this.urlParams = urlParams; 
    }

    async Initialize() 
    {
        super.Initialize(); 

        await this.CreateHTML(); 
    }

    // #region HTML/Elements Methods
    async CreateHTML() 
    {
        const container = document.getElementById('canvas-container'); 
        const elements = container.querySelectorAll(':not(#bg)'); 
        
        elements.forEach(element => element.remove()); 
    }
    // #endregion
}