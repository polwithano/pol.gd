import MenuEntry from "./menuEntry";
import TagManager from '../portfolio/tagManager'

export default class ProjectEntry extends MenuEntry 
{
    constructor(metadata) 
    {
        super(metadata); 
        
        this.name = this.metadata.projectName; 
        this.favorite = this.metadata.isFavorite; 
        this.tag = this.metadata.tag; 

        this.element = this.CreateMenuEntry(); 
    }

    CreateMenuEntry() 
    {
        const entry = document.createElement('li');
        entry.classList.add('project'); 
        entry.setAttribute('data-project-name', this.name);

        if (this.favorite) entry.classList.add('favorite'); 
        entry.textContent = this.name; 
        entry.appendChild(TagManager.TagElement(this.tag, 'small-tag')); 

        return entry; 
    }
}