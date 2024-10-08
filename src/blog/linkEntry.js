import ICON from "../../public/media/portfolio-icons/masterICON";
import MenuEntry from "./menuEntry";

export default class LinkEntry extends MenuEntry 
{
    constructor(data) 
    {
        super(data); 
        
        this.link = data.link; 

        this.iconName = data.icon;  
        this.linkIcon = ICON.LoadIcon(this.iconName); 
        this.externalIcon = ICON.LoadIcon('external');

        this.label = data.label;
        this.newPage = data.openInNewPage;
        
        this.element = this.CreateMenuEntry(); 
        this.LoadIcons(); 
    }

    async LoadIcons() {
        try {
            // Load both the link icon and external icon asynchronously
            const linkIconModule = await ICON.LoadIcon(this.iconName);
            const externalIconModule = await ICON.LoadIcon('external');

            // Set the loaded icon paths to the image elements
            this.element.querySelector('.link-logo').src = linkIconModule.default;
            this.element.querySelector('.external-icon').src = externalIconModule.default;

        } catch (error) {
            console.error('Failed to load icon:', error);
        }
    }

    CreateMenuEntry() 
    {
        const entry = document.createElement('div');
        entry.classList.add('link');
    
        const link = document.createElement('a');
        link.href = this.link;
        link.classList.add('link-content');

        if (this.newPage) 
        {
            link.target = "_blank";
            link.rel = "noopener noreferrer";
        }

        // Create a wrapper for the link logo and label
        const contentWrapper = document.createElement('div');
        contentWrapper.classList.add('content-wrapper');
    
        const linkLogo = document.createElement('img');
        linkLogo.src = this.linkIcon;
        linkLogo.alt = `${this.label} logo`;
        linkLogo.classList.add('link-logo');
    
        const labelSpan = document.createElement('span');
        labelSpan.textContent = this.label;
        labelSpan.classList.add('website-name');
    
        contentWrapper.appendChild(linkLogo);
        contentWrapper.appendChild(labelSpan);
    
        // Create the external icon
        const externalIcon = document.createElement('img');
        externalIcon.src = ICON.LoadIcon('external'); // Load your external icon correctly
        externalIcon.alt = "External link";
        externalIcon.classList.add('external-icon');
    
        // Append the content wrapper and external icon to the entry
        link.appendChild(contentWrapper);
        entry.appendChild(link);
        entry.appendChild(externalIcon); // Append the external icon to the entry
    
        return entry;
    }
    
}