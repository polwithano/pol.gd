import FolderEntry from './blog/folderEntry';
import ICON from './ledgers/icons';
import LINKS from './ledgers/links';
import LinkEntry from './blog/linkEntry';
import POSTS from './ledgers/posts';
import PROJECTS from './ledgers/projects';
import PostEntry from './blog/postEntry';
import ProjectEntry from './blog/projectEntry';

export default class MenuController 
{
    constructor() 
    {
        this.menuMode = "Portfolio"; 
        // 0 = EN, 1 = FR
        this.languageMode = 0; 

        this.explorer = document.querySelector('.explorer'); 
        this.projectContainer = document.createElement('div'); 
        this.postContainer = document.createElement('div'); 
        this.linkContainer = document.createElement('div'); 
        
        this.explorer.innerHTML = '';
        this.explorer.append(this.projectContainer, this.postContainer, this.linkContainer); 

        this.InitializeListeners();
    }

    async Initialize() 
    {
        await this.InitializePortfolioProjects();
        await this.InitializeBlogPosts();  
        await this.InitializeLinks(); 

        this.SwitchMode(this.menuMode); 
    }

    async InitializePortfolioProjects() 
    {
        const metadatas = await PROJECTS.FetchProjectsMetadata();
        const icon = await ICON.LoadIcon('folder');
        const title = document.createElement('h1');
        
        this.projectEntries = []; 
        this.projectFolderEntries = {}; 
        
        title.classList.add('explorer-header'); 
        title.textContent = 'projects'; 
        this.projectContainer.appendChild(title);

        // Sort metadatas by yearID in descending order (newest first)
        metadatas.sort((a, b) => parseInt(b.yearID) - parseInt(a.yearID));
    
        // Use a for...of loop to handle asynchronous operations correctly
        for (const metadata of metadatas) 
        {    
            // Create a folder if there's none with the yearID of the project. 
            if (!this.projectFolderEntries[metadata.yearID]) 
            {
                const folder = new FolderEntry(icon, metadata.yearID); 
                this.projectFolderEntries[metadata.yearID] = folder;  
                this.projectContainer.appendChild(this.projectFolderEntries[metadata.yearID].element); 
            }
    
            // Create a project item
            const entry = new ProjectEntry(metadata); 
            this.projectEntries.push(entry); 
    
            // Append project item to the corresponding folder
            this.projectFolderEntries[metadata.yearID].element.querySelector('.folder-content').appendChild(entry.element);
        }
      
    }

    async InitializeBlogPosts() 
    {
        this.postEntries = []; 
        
        const title = document.createElement('h1'); 
        title.classList.add('explorer-header'); 
        title.textContent = 'posts'; 
        this.postContainer.appendChild(title);
        
        const currentDay = new Date(); 
        const metadatas = await POSTS.FetchPostsMetadata(); 
        const tagSet = new Set();   

        for (const metadata of metadatas) 
        {
            const entry = new PostEntry(metadata, currentDay); 
            this.postEntries.push(entry);  
        }

        if (this.postEntries.length != 0) 
        {
            this.postEntries.sort((a, b) => a.daysDelta - b.daysDelta);

            for (const entry of this.postEntries)
            {
                this.postContainer.appendChild(entry.element);            
                for (const tag of entry.tags) tagSet.add(tag); 
            }   
        }
        else 
        {
            this.postContainer.append(this.NoMatchMessage('post')); 
        }
    }

    async InitializeLinks() 
    {
        const title = document.createElement('h1'); 
        title.classList.add('explorer-header'); 
        title.textContent = 'contact & stuff'; 
        this.linkContainer.appendChild(title); 
        
        this.linkEntries = []; 

        const datas = await LINKS.FetchLinks(); 

        for (const data of datas) 
        {
            const entry = new LinkEntry(data); 
            this.linkEntries.push(entry); 
        }

        if (this.linkEntries.length != 0) 
        {
            for (const entry of this.linkEntries) 
            {
                this.linkContainer.appendChild(entry.element); 
            }
        }
        else 
        {
            this.postContainer.append(this.NoMatchMessage('link')); 
        }
    }
    
    InitializeListeners() 
    {
        const searchBar = document.querySelector('.search-bar input'); 
        const languageToggle = document.getElementById('language-select'); 

        searchBar.addEventListener('input', (event) =>
        {
            if (this.menuMode == 0) 
            {
                const query = event.target.value.toLowerCase(); 
                this.FilterProjects(query);  
            }
        });

        languageToggle.addEventListener('change', (event) => 
        {
            const selectedLanguage = event.target.value;
            if (selectedLanguage == 'en') this.languageMode = 0; 
            if (selectedLanguage == 'fr') this.languageMode = 1; 
        })
    }

    UpdateSelectedProject(index) 
    {
        const currentProjectName = PROJECTS.projects[index]; 

        document.querySelectorAll('.project').forEach(project => 
        {
            const projectName = project.getAttribute('data-project-name');
    
            if (projectName === currentProjectName) project.classList.add('selected');
            else project.classList.remove('selected');
        });
    }

    ToggleFolder(folderID) 
    {
        if (!folderID) 
        {
            console.warn('folderId is null or undefined');  // Extra warning if folderId is null
            return;
        }

        const folderContent = document.getElementById(folderID);
        const folderHeader = document.querySelector(`[data-folder-id="${folderID}"]`);

        if (folderContent) 
        {
            if (folderContent.style.display === "none" || folderContent.style.display === "") 
            {
                folderHeader.classList.add('open');  
                folderContent.style.display = "block";
            } 
            else 
            {
                folderHeader.classList.remove('open');  
                folderContent.style.display = "none";
            }
            //console.log('Toggled folder content:', folderContent);
        } 
        else console.warn('No element found with ID:', folderID);  // Warn if no element is found
    }

    SwitchMode(menuMode) 
    {
        const togglePortfolio = document.getElementById('toggle-projects');
        const toggleBlog = document.getElementById('toggle-blog');
        const toggleLinks = document.getElementById('toggle-links');  

        this.menuMode = menuMode; 
        
        this.projectContainer.style.display = 'none'; 
        this.postContainer.style.display = 'none'; 
        this.linkContainer.style.display = 'none'; 
        
        togglePortfolio.classList.remove('active');
        toggleBlog.classList.remove('active');
        toggleLinks.classList.remove('active');

        if (menuMode == "Portfolio") 
        {
            togglePortfolio.classList.add('active'); 
            this.projectContainer.style.display = 'block';
        } 
        if (menuMode == "Blog") 
        {
            toggleBlog.classList.add('active');
            this.postContainer.style.display = 'block';
        } 
        if (menuMode == "Links") 
        {
            toggleLinks.classList.add('active');
            this.linkContainer.style.display = 'block';
        } 
    }

    FilterProjects(query) 
    {
        const folders = document.querySelectorAll('.folder');
        const projects = document.querySelectorAll('.project');

        // Remove "No projects found" message if it exists
        const noProjectsMessage = document.getElementById('no-project-message');
        if (noProjectsMessage) noProjectsMessage.remove();

        // Container for displaying matched projects outside the folders
        let projectSearchResults = document.getElementById('search-results-container');
        
        // If container doesn't exist, create it
        if (!projectSearchResults) 
        {
            projectSearchResults = document.createElement('div');
            projectSearchResults.id = 'search-results-container';
            this.projectContainer.appendChild(projectSearchResults);
        }
        
        while (projectSearchResults.firstChild) 
        { 
            const child = projectSearchResults.firstChild;
            projectSearchResults.removeChild(child);
        }

        if (!query) 
        {
            // If the search bar is empty, reset everything:
            // - Hide the search results container
            projectSearchResults.style.display = 'none';
            // - Display all folders and projects as usual
            folders.forEach(folder => folder.style.display = 'block');
            projects.forEach(project => project.style.display = 'list-item');
            
            return;
        }

        // If query is present, hide all folders
        folders.forEach(folder => folder.style.display = 'none');
        
        let found = false;
        
        projects.forEach(project => 
        {
            const projectName = project.getAttribute('data-project-name').toLowerCase();
            
            // If the project matches the query
            if (projectName.includes(query)) 
            {
                const alreadyExists = Array.from(projectSearchResults.children).some(child => 
                {
                    return child.getAttribute('data-project-name').toLowerCase() === projectName;        
                }); 
                if (!alreadyExists) 
                {
                    const projectCopy = project.cloneNode(true);
                    projectSearchResults.appendChild(projectCopy);
                    found = true;
                }
            }
        });

        // If no projects were found, show a "No projects found" message
        if (!found) {
            projectSearchResults.appendChild(this.NoMatchMessage('project'));
        }

        // Ensure the search results container is visible when results are found
        projectSearchResults.style.display = 'block';
    }

    NoMatchMessage(type) {
        const p = document.createElement('p');
        p.id = `no-${type}-message`;
        p.textContent = `No ${type}s found`;
        return p;
    }
}