import { retargetClip } from 'three/examples/jsm/utils/SkeletonUtils.js';

async function LoadIcon(key) 
{
    if (key == "adobe") return import('./adobe.png');
    if (key == "blender") return import('./blender.png'); 
    if (key == "boardgame") return import('./boardgame.png');
    if (key == "controller") return import('./controller.png');
    if (key == "cplus") return import('./cplus.png');
    if (key == "external") return import('./external.png'); 
    if (key == "folder") return import('./folder.png');
    if (key == "github") return import('./github.png'); 
    if (key == "itchio") return import ('./itchio.png'); 
    if (key == "js") return import('./js.png'); 
    if (key == "keyboard") return import('./keyboard.png'); 
    if (key == "linkedin") return import('./linkedin.png'); 
    if (key == "mail") return import('./mail.png'); 
    if (key == "network") return import('./network.png')
    if (key == "oculus") return import('./oculus.png');
    if (key == "reddit") return import('./reddit.png'); 
    if (key == "resume") return import('./resume.png'); 
    if (key == "return") return import('./return.png')
    if (key == "tool") return import('./tool.png');
    if (key == "unity") return import('./unity.png');
    if (key == "unreal") return import('./unreal.png');
    if (key == "vr") return import('./vr.png');
    if (key == "web") return import('./web.png');  
    if (key == "windows") return import('./windows.png');  
    else return import('../placeholder-image.jpg');
} 

export default {LoadIcon}