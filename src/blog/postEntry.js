import MenuEntry from "./menuEntry";

export default class PostEntry extends MenuEntry
{
    constructor(metadata, date) 
    {
        super(metadata); 
        
        this.date = date; 
        this.title = metadata.title; 
        this.tags = metadata.tags; 
        
        this.dateDelta = this.date - new Date(this.metadata.date); 
        this.daysDelta = Math.floor(this.dateDelta / (1000 * 60 * 60 * 24)); 
        this.datationText = this.DatationDescription(); 

        this.element = this.CreateMenuEntry(); 
    }

    CreateMenuEntry() 
    {
        const entry = document.createElement('li'); 
        entry.classList.add('post'); 
        entry.setAttribute('data-post-name', this.title); 

        const name = document.createElement('span'); 
        name.classList.add('post-name'); 
        name.textContent = this.title; 

        const datation = document.createElement('span');
        datation.classList.add('post-datation'); 
        datation.textContent = this.datationText; 

        entry.appendChild(name);
        entry.appendChild(datation);  

        return entry; 
    }

    DatationDescription() 
    {
        let description = "";
        
        if (this.daysDelta < 7) {
            description = `${this.daysDelta} day${this.daysDelta > 1 ? 's' : ''} ago`;
        }
        else if (this.daysDelta < 30) {
            const weeks = Math.floor(this.daysDelta / 7);
            description = `${weeks} week${weeks > 1 ? 's' : ''} ago`;
        }
        else {
            const months = Math.floor(this.daysDelta / 30);
            description = `${months} month${months > 1 ? 's' : ''} ago`;
        }
    
        return description;
    }
    
}