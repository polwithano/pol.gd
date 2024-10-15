import './style.css';

import Manager from './src/manager';

const canvasID = '#bg'; 
const path = window.location.pathname.toLowerCase();
const urlParams = new URLSearchParams(window.location.search);

const manager = new Manager(canvasID, path, urlParams);
manager.Initialize();
