import MenuEntry from "./menuEntry";

export default class FolderEntry extends MenuEntry 
{
    constructor(icon, yearID) 
    {
        super(); 
        
        this.icon = icon; 
        this.yearID = yearID; 

        this.element = this.CreateMenuEntry(); 
    }

    CreateMenuEntry() 
    {
        const entry = document.createElement('div'); 
        entry.classList.add('folder'); 

        entry.innerHTML = `
        <div class="folder-header" data-folder-id="folder-${this.yearID}">
            <span class="arrow">&#9654;</span>
            <img src="${this.icon.default || this.icon}" alt="Folder Icon" class="folder-icon"> ${this.yearID}/
        </div>
        <ul class="folder-content" id="folder-${this.yearID}"></ul>`;

        return entry; 
    }
}