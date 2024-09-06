async function LoadIcon(key) 
{
    if (key == "unity") return require('./unity.png'); 
    if (key == "blender") return require('./blender.png'); 
    if (key == "controller") return require('./controller.png');
    else return require('../placeholder-image.jpg');
} 

export default {LoadIcon}