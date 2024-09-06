async function LoadIcon(key) 
{
    if (key == "blender") return import('./blender.png'); 
    if (key == "controller") return import('./controller.png');
    if (key == "oculus") return import('./oculus.png');
    if (key == "unity") return import('./unity.png');
    if (key == "unreal") return import('./unreal.png');
    if (key == "vr") return import('./vr.png');
    if (key == "windows") return import('./windows.png');  
    else return import('../placeholder-image.jpg');
} 

export default {LoadIcon}