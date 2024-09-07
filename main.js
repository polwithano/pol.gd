import './style.css';

import * as THREE from 'three';
import EnginePortfolio from './src/portfolio/enginePortfolio';

// ELEMENTS
const canvasID = '#bg';  
const engines = [EnginePortfolio];

let currentEngineIndex = 0; 
let currentEngine = null; 

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOMContentLoaded event triggered");

    const prevButton = document.getElementById('prev-button');
    const nextButton = document.getElementById('next-button');

    function LoadEngine() 
    {
        console.log("LoadEngine function called");
        const engineClassName = 'EnginePortfolio';
        console.log("Loading Engine " + engineClassName);

        if (currentEngine != null) {
            console.log("Destroying engine");
            currentEngine.Destroy();
            currentEngine = null;
        }

        currentEngine = CreateEngine(engineClassName, canvasID);

        const gl = currentEngine.renderer.getContext();
        if (!gl) console.error("WebGL context failed to initialize.");
        else console.log("WebGL context initialized successfully.");

        const canvas = document.querySelector(canvasID);
        console.log("Canvas width:", canvas.width, "Canvas height:", canvas.height);
        console.log("Renderer size:", currentEngine.renderer.getSize(new THREE.Vector2()));
    }

    function CreateEngine(className, canvasID)
    {
        // Check the class name and create an instance accordingly
        switch (className) 
        {
            case 'EnginePortfolio':
                return new EnginePortfolio(canvasID); 
            default:
                throw new Error(`Unknown engine class: ${className}`);
        }
    }

    // Initial load
    LoadEngine();

    document.addEventListener('keydown', (event) => 
    {
        if (event.key === 'ArrowDown' ) 
        {
            ChangeEngineIndex(-1);
        }
        if (event.key === 'ArrowUp') 
        {
            ChangeEngineIndex(1); 
        } 
    }); 

    document.addEventListener('mousedown', () => 
    {

    });
    /*
    prevButton.addEventListener('click', () => {
        ChangeEngineIndex(-1); 
    });

    nextButton.addEventListener('click', () => {
        ChangeEngineIndex(1); 
    });
    */
    function ChangeEngineIndex(indexOffset) 
    {
        currentEngineIndex = indexOffset === 1 ? (currentEngineIndex + 1) % engines.length : (currentEngineIndex - 1 + engines.length) % engines.length;
        LoadEngine();
    }
});
