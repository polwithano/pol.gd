import ICON from '../../public/media/portfolio-icons/masterICON';
import JSON from '../../data/masterJSON';
import TagManager from './tagManager'

export default class MenuPortfolio 
{
    constructor() 
    {
        // 0 = Project Mode, 1 = Blog Mode
        this.menuMode = 0; 
        // 0 = EN, 1 = FR
        this.languageMode = 0; 

        this.explorer = document.querySelector('.explorer'); 
        this.explorer.innerHTML = '';

        this.projectContainer = document.createElement('div'); 
        this.articleContainer = document.createElement('div'); 
        this.explorer.append(this.projectContainer, this.articleContainer); 

        this.InitializeListeners();
    }

    async Initialize() 
    {
        const folders = {}; 
        const metadatas = await JSON.FetchProjectsMetadata();
    
        const projectTitle = document.createElement('h1');
        projectTitle.classList.add('explorer-header');
        projectTitle.textContent = 'projects';

        const articleTitle = document.createElement('h1');
        articleTitle.classList.add('explorer-header');
        articleTitle.textContent = 'articles';
    
        this.projectContainer.appendChild(projectTitle); 
        this.articleContainer.appendChild(articleTitle); 
        this.articleContainer.appendChild(this.NoMatchMessage('article')); 
    
        // Sort metadatas by yearID in descending order (newest first)
        metadatas.sort((a, b) => parseInt(b.yearID) - parseInt(a.yearID));
    
        // Use a for...of loop to handle asynchronous operations correctly
        for (const metadata of metadatas) {
            const { yearID, projectName, isFavorite, tag } = metadata; 
    
            // Create a folder if there's none with the yearID of the project. 
            if (!folders[yearID]) {
                folders[yearID] = await this.CreateFolder(yearID); 
                this.projectContainer.appendChild(folders[yearID]); 
            }
    
            // Create a project item
            const project = await this.CreateProject(projectName, isFavorite, tag); 
    
            // Append project item to the corresponding folder
            folders[yearID].querySelector('.folder-content').appendChild(project);
        }
    
        this.UpdateSelectedProject(0); 
        this.SwitchMode(0); 
    }
    
    InitializeListeners() 
    {
        const projectsButton = document.getElementById('toggle-projects');
        const blogButton = document.getElementById('toggle-blog');
        const searchBar = document.querySelector('.search-bar input'); 
        const languageToggle = document.getElementById('language-select'); 

        projectsButton.addEventListener('click', () => 
        {
            projectsButton.classList.add('active');
            blogButton.classList.remove('active');
            this.SwitchMode(0);
        });

        blogButton.addEventListener('click', () => 
        {
            blogButton.classList.add('active');
            projectsButton.classList.remove('active');
            this.SwitchMode(1);
        });

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
        const currentProjectName = JSON.projects[index]; 

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
            console.log('Toggled folder content:', folderContent);  // Debugging output
        } 
        else console.warn('No element found with ID:', folderID);  // Warn if no element is found
    }

    async CreateFolder(yearID) 
    {
        const icon = await ICON.LoadIcon('folder');  
        const folder = document.createElement('div'); 
        folder.classList.add('folder');
        folder.innerHTML = `
        <div class="folder-header" data-folder-id="folder-${yearID}">
            <span class="arrow">&#9654;</span>
            <img src="${icon.default || icon}" alt="Folder Icon" class="folder-icon"> ${yearID}/
        </div>
        <ul class="folder-content" id="folder-${yearID}"></ul>`;

        return folder; 
    }

    async CreateProject(name, favorite, tag) 
    {
        const project = document.createElement('li'); 
        project.classList.add('project'); 
        project.setAttribute('data-project-name', name);

        if (favorite) project.classList.add('favorite'); 

        project.textContent = name; 
        project.appendChild(TagManager.TagElement(tag, "small-tag"));         

        return project; 
    }

    SwitchMode(menuMode) 
    {
        this.menuMode = menuMode; 
        const folders = document.querySelectorAll('.folder'); // Select all folder elements
    
        if (menuMode == 0) // Project Mode
        {
            this.projectContainer.style.display = 'block'; 
            this.articleContainer.style.display = 'none'; 
        }
        if (menuMode == 1) // Blog Mode
        {
            this.projectContainer.style.display = 'none'; 
            this.articleContainer.style.display = 'block'; 
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
            this.explorer.appendChild(projectSearchResults);
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